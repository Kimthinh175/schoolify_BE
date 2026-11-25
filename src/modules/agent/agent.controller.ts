import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiCookieAuth,
  ApiBearerAuth,
} from '@nestjs/swagger';
import {
  EvaluateSemanticCheckpointDto,
  AgentChatDto,
  DocxScanGenerateDto,
  SaveGeneratedQuestionsDto,
  AgentChatResponseDto,
} from './dto/agent.dto';
import {
  RobotEmotion,
  isRobotEmotion,
  inferEmotion,
  clampEmotionDuration,
} from './constants/robot-emotion';
import { SemanticCheckpointService } from './services/semantic-checkpoint.service';
import { SemanticCacheService } from './services/semantic-cache.service';
import { AntigravityIpcBridgeService } from './services/antigravity-ipc-bridge.service';
import { DocxExamGeneratorService } from './services/docx-exam-generator.service';
import { ChatMemoryService } from './services/chat-memory.service';
import { PrismaService } from '../../database/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags(
  'AI Agent & Semantic Intelligence (Trợ lý Tác nhân & Đối soát Ngữ nghĩa)',
)
@ApiCookieAuth('access_token')
@ApiBearerAuth()
@Controller('agent')
export class AgentController {
  constructor(
    private readonly checkpointService: SemanticCheckpointService,
    private readonly cacheService: SemanticCacheService,
    private readonly ipcBridgeService: AntigravityIpcBridgeService,
    private readonly docxGeneratorService: DocxExamGeneratorService,
    private readonly chatMemoryService: ChatMemoryService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Ước lượng số lượng Token tiêu thụ cho văn bản tiếng Việt + công thức Toán KaTeX
   */
  private estimateTokens(text: string): number {
    if (!text) return 0;
    const clean = text.trim();
    return Math.max(1, Math.ceil(clean.length / 3.5));
  }

  /**
   * Tính toán Ngọc Tri Thức phải trả cho lượt hỏi Gia sư AI theo số lượng Token thực tế (Cách 1):
   * - Tỉ lệ: 1 Ngọc Tri Thức = 1.000 Token (làm tròn 2 chữ số thập phân).
   * - Sàn tối thiểu: 0.05 Ngọc Tri Thức (tránh hỏi câu ngắn như "1+1=?" bị trừ tới 0.5).
   * - Gói 2 (STUDENT_100K): Giảm 50% Ngọc Tri Thức (sàn 0.03).
   */
  private calculateAiTutorPointsCost(
    tokens: number,
    activePackage?: string,
  ): {
    rawPoints: number;
    pointsCost: number;
    hasDiscount: boolean;
  } {
    const raw = Math.max(0.05, Number((tokens / 1000).toFixed(2)));
    const isStudent100k = activePackage === 'STUDENT_100K';
    const pointsCost = isStudent100k
      ? Math.max(0.03, Number((raw * 0.5).toFixed(2)))
      : raw;

    return {
      rawPoints: raw,
      pointsCost,
      hasDiscount: isStudent100k,
    };
  }

  /**
   * Phân loại ý định (Intent Classification):
   * - 'PLATFORM_INFO': Chỉ những câu hỏi rõ ràng về tính năng web Schoolify, bảng giá, mua gói, nạp điểm, thanh toán VietQR... (MIỄN PHÍ)
   * - 'ACADEMIC_STUDY': Toàn bộ các câu hỏi bài tập, kiến thức, trò chuyện học tập... (TÍNH PHÍ NGỌC TRI THỨC THEO TOKEN)
   */
  private classifyUserIntent(
    message: string,
  ): 'PLATFORM_INFO' | 'ACADEMIC_STUDY' {
    if (!message) return 'PLATFORM_INFO';
    const norm = message
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

    // Có chứa công thức toán KaTeX ($...$), ký hiệu toán học hoặc phép tính số học (ví dụ: 1+1=?)
    const hasMathSymbols =
      /[\$∫∑√π∆]|\b(lim|sin|cos|tan|log|ln)\b|\d+\s*[\+\-\*\/\^=]\s*\d+|\bx\^?\d*\s*[\+\-=]/i.test(
        message,
      );

    // Chỉ miễn phí khi hỏi trực tiếp về nền tảng Schoolify / bảng giá / thanh toán
    const explicitPlatformKeywords = [
      'schoolify',
      'nen tang nay',
      'trang web nay',
      'web nay',
      'bang gia',
      'goi pro',
      'goi vip',
      'goi 50k',
      'goi 100k',
      'mua goi',
      'dang ky goi',
      'nap tien',
      'thanh toan',
      'payos',
      'vietqr',
      'ngoc tri thuc la gi',
      'tia sang la gi',
      'nap ngoc',
      'mua ngoc',
      'doi mat khau',
    ];

    const isExplicitPlatform = explicitPlatformKeywords.some((kw) =>
      norm.includes(kw),
    );
    if (isExplicitPlatform && !hasMathSymbols) {
      return 'PLATFORM_INFO';
    }

    // Mặc định mọi câu hỏi học tập / giải bài / trò chuyện với AI đều tính Token -> trừ Ngọc Tri Thức
    return 'ACADEMIC_STUDY';
  }

  /**
   * Cắt câu trả lời ngay giữa chừng theo tỉ lệ ngân sách Ngọc còn lại (giống Antigravity khi hết quota giữa lúc đang suy luận)
   */
  private truncateMessageAtTokenBudget(
    fullText: string,
    allowedRatio: number,
  ): {
    partialText: string;
    remainingText: string;
  } {
    const clean = (fullText || '').trim();
    if (!clean) {
      return { partialText: '', remainingText: '' };
    }
    const clampedRatio = Math.max(0.18, Math.min(0.85, allowedRatio));
    const targetCharIdx = Math.max(35, Math.floor(clean.length * clampedRatio));
    // Tìm khoảng trắng gần nhất để cắt giữa chừng tự nhiên
    const spaceIdx = clean.lastIndexOf(' ', targetCharIdx);
    const cutIdx = spaceIdx > 20 ? spaceIdx : targetCharIdx;

    const partialText = `${clean.slice(0, cutIdx).trimEnd()} ...`;
    const remainingText = clean.slice(cutIdx).trimStart();
    return { partialText, remainingText };
  }

  @Post('semantic-checkpoint')
  @ApiOperation({
    summary:
      'Chấm điểm đối soát ngữ nghĩa bán tự động (Tự luận / Điền từ ngắn)',
    description:
      'Quy trình Hybrid: Dùng Vector lọc câu tương đồng của học sinh. Nếu phát hiện thì chuyển câu đó + Checkpoint sang AI IPC Bridge đối soát logic True/False.',
  })
  @ApiResponse({
    status: 200,
    description: 'Kết quả chấm điểm đối soát thành công',
  })
  async evaluateSemanticCheckpoint(@Body() dto: EvaluateSemanticCheckpointDto) {
    const data = await this.checkpointService.evaluate(dto);
    return {
      success: true,
      message: data.isCorrect
        ? 'Ý trả lời chính xác và thỏa mãn tiêu chí'
        : 'Ý trả lời chưa đạt tiêu chí',
      data,
    };
  }

  @Post('chat')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary:
      'Trò chuyện với AI Agentic Assistant (Xác thực JWT: Đã login dùng AI thật + trừ Ngọc; Khách chỉ trả lời tự động)',
    description:
      'Xác thực người dùng qua JWT Cookie / Bearer Token. Nếu chưa đăng nhập (Guest) chỉ trả lời kịch bản tự động có sẵn, không gọi Gemini thật. Nếu đã đăng nhập: đo lường Token thực tế & trừ Ngọc Tri Thức.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Phản hồi từ AI Agent kèm biểu cảm robot và chi tiết Token/Ngọc Tri Thức trừ',
    type: AgentChatResponseDto,
  })
  async chatWithAgent(
    @Body() dto: AgentChatDto,
    @CurrentUser() currentUser?: any,
  ) {
    const isSocraticTopicHint =
      dto.questionContext?.mode === 'SOCRATIC_TOPIC_HINT';

    // 1. Phân loại Ý định (Intent Classification)
    const intent = isSocraticTopicHint
      ? 'PLATFORM_INFO'
      : this.classifyUserIntent(dto.message);
    const isFreePlatformQuestion =
      isSocraticTopicHint || intent === 'PLATFORM_INFO';

    // 2. Xác định người dùng từ JWT đã xác thực (chống giả mạo userId trong body).
    //    Nếu chưa có JWT hợp lệ => KHÁCH (isGuest = true): chỉ nhận câu trả lời tự động có sẵn, không dùng AI thật, không trừ Ngọc.
    const GUEST_USER_ID = 'usr-student-01';
    const verifiedUserId: string | null = currentUser?.id || null;
    const effectiveUserId = verifiedUserId || GUEST_USER_ID;
    const profile = verifiedUserId
      ? await this.prisma.studentProfile.findUnique({
          where: { user_id: verifiedUserId },
        })
      : null;
    const isGuest = !verifiedUserId || !profile;

    const isPackageExpired =
      profile?.package_expires_at &&
      new Date(profile.package_expires_at).getTime() < Date.now();
    const activePackage = isPackageExpired
      ? 'FREE'
      : profile?.active_package || 'FREE';
    const currentDiamonds = Number(profile?.points ?? 0);

    // 3. Nếu đã cạn sạch 0 Ngọc ngay từ trước khi suy luận -> Chặn và báo nạp/cày thêm Ngọc
    // (Nếu còn > 0 Ngọc dù rất ít như 0.01 - 0.04 💎, vẫn cho AI bắt đầu suy luận rồi dừng giữa chừng khi chạm 0 💎!)
    if (!isFreePlatformQuestion && profile && currentDiamonds <= 0) {
      return {
        success: false,
        errorCode: 'INSUFFICIENT_XIN_POINTS',
        message: `Bạn đã hết Ngọc Tri Thức (0 💎). Hãy làm đề thi đạt trên 8.5 điểm để nhận thêm Ngọc Tri Thức miễn phí hoặc nâng cấp gói học sinh để AI tiếp tục giải phần đang dang dở nhé!`,
        data: {
          currentDiamonds: 0,
          minRequired: activePackage === 'STUDENT_100K' ? 0.03 : 0.05,
          activePackage,
          emotion: 'sad',
          emotionDurationMs: 4000,
        },
      };
    }

    // Kiểm tra xem phiên hiện tại có ngữ cảnh đang giải dở từ lượt bị ngắt trước đó không
    let existingSessionMsgs: any[] = [];
    let pendingInterruptedContext: any =
      dto.context?.interruptedContext || null;
    if (dto.sessionId && !isSocraticTopicHint && !isGuest) {
      existingSessionMsgs = await this.chatMemoryService.getSession(
        dto.sessionId,
      );
      if (!pendingInterruptedContext && existingSessionMsgs.length > 0) {
        const lastAssistantMsg = [...existingSessionMsgs]
          .reverse()
          .find((m: any) => m.role === 'assistant');
        if (
          lastAssistantMsg?.isInterrupted &&
          lastAssistantMsg?.interruptedContext
        ) {
          pendingInterruptedContext = lastAssistantMsg.interruptedContext;
        }
      }
    }

    // 4. Truy xuất Bộ nhớ Vector hóa Đa tầng chuẩn Antigravity
    const vectorCtx =
      isSocraticTopicHint || isGuest
        ? {
            session: null,
            hotWindow: [],
            recalledTurns: [],
            contextSummary: '',
            instantMemoryHit: null,
            stats: {
              totalStoredTurns: 0,
              recalledTurnCount: 0,
              hotWindowCount: 0,
            },
          }
        : await this.chatMemoryService.buildVectorizedContext(
            effectiveUserId,
            dto.sessionId || '',
            dto.message,
            Array.isArray(dto.history) ? (dto.history as any) : [],
          );

    // Nếu đang có ngữ cảnh dang dở cần nối tiếp, không lấy từ cache tĩnh mà gọi thẳng Gemini để viết nối tiếp
    const isSubstantiveQuery =
      !isSocraticTopicHint &&
      !isGuest &&
      !pendingInterruptedContext &&
      dto.message.trim().length >= 14;
    const cacheResult = isSubstantiveQuery
      ? await this.cacheService.findInCache(dto.message, dto.subject, dto.grade)
      : { hit: false };

    let responseMessage = '';
    let responseActions: any[] = [];
    let responseEmotion: RobotEmotion | undefined;
    let responseSuggestions: string[] = [];
    let isFromCache = false;
    let cacheSimilarity = 1.0;
    let responseSource = isGuest ? 'SCRIPTED_GUEST' : 'GEMINI_2_5_FLASH';
    let exactUsageMetadata:
      | { promptTokens: number; completionTokens: number; totalTokens: number }
      | undefined;

    if (
      isSubstantiveQuery &&
      vectorCtx.instantMemoryHit?.hit &&
      vectorCtx.instantMemoryHit.responseMessage &&
      !vectorCtx.instantMemoryHit.responseMessage.startsWith(
        'Tớ đã nắm được ý của bạn!',
      )
    ) {
      isFromCache = true;
      cacheSimilarity = vectorCtx.instantMemoryHit.similarity;
      responseMessage = vectorCtx.instantMemoryHit.responseMessage;
      responseActions = vectorCtx.instantMemoryHit.actions || [];
      responseEmotion = vectorCtx.instantMemoryHit.emotion as
        RobotEmotion | undefined;
      responseSuggestions = vectorCtx.instantMemoryHit.suggestions || [];
      responseSource = 'VECTOR_SESSION_MEMORY';
    } else if (
      isSubstantiveQuery &&
      cacheResult.hit &&
      cacheResult.responseText &&
      !cacheResult.responseText.startsWith('Tớ đã nắm được ý của bạn!')
    ) {
      isFromCache = true;
      cacheSimilarity = cacheResult.similarity ?? 1.0;
      responseMessage = cacheResult.responseText;
      responseActions = cacheResult.clientActions || [];
      responseEmotion = (cacheResult as any).emotion;
      responseSuggestions = (cacheResult as any).suggestions || [];
      responseSource = 'SEMANTIC_CACHE';
    } else {
      // Gửi Context đã nén + Ngữ cảnh đang dang dở (nếu có) qua Gemini
      const compactedDto: AgentChatDto = {
        ...dto,
        history: vectorCtx.hotWindow as any,
        context: {
          ...(dto.context || {}),
          contextSummary: vectorCtx.contextSummary,
          recalledTurns: vectorCtx.recalledTurns,
          ...(pendingInterruptedContext
            ? { interruptedContext: pendingInterruptedContext }
            : {}),
        },
      };
      const bridgeResult = await this.ipcBridgeService.generateAgentResponse(
        compactedDto,
        {
          allowRealAi: !isGuest,
        },
      );
      responseMessage = bridgeResult.message;
      responseActions = bridgeResult.actions || [];
      responseEmotion = bridgeResult.emotion;
      responseSuggestions = bridgeResult.suggestions || [];
      exactUsageMetadata = bridgeResult.usageMetadata;

      const initialEmotion: RobotEmotion = isRobotEmotion(responseEmotion)
        ? responseEmotion
        : inferEmotion(responseMessage, responseActions);

      if (
        isSubstantiveQuery &&
        !responseMessage.startsWith('Tớ đã nắm được ý của bạn!')
      ) {
        await this.cacheService.saveToCache(
          dto.message,
          bridgeResult.message,
          bridgeResult.actions,
          dto.subject,
          dto.grade,
          initialEmotion,
          responseSuggestions,
          7,
        );
      }
    }

    // 5. Đo lường Token tiêu thụ chính xác từ Gemini usageMetadata
    const promptTokens =
      exactUsageMetadata?.promptTokens ?? this.estimateTokens(dto.message);
    let completionTokens =
      exactUsageMetadata?.completionTokens ??
      this.estimateTokens(responseMessage);
    let totalTokens =
      exactUsageMetadata?.totalTokens ?? promptTokens + completionTokens;

    let rawPoints = 0;
    let pointsCost = 0;
    let hasDiscount = false;
    let isInterrupted = false;
    let newInterruptedContext: any = null;

    if (!isFreePlatformQuestion && !isGuest) {
      const pointCalc = this.calculateAiTutorPointsCost(
        totalTokens,
        activePackage,
      );
      rawPoints = pointCalc.rawPoints;
      pointsCost = pointCalc.pointsCost;
      hasDiscount = pointCalc.hasDiscount;

      // NẾU ĐANG SUY LUẬN MÀ SỐ NGỌC CÒN LẠI KHÔNG ĐỦ CHI TRẢ TOÀN BỘ -> DỪNG GIỮA CHỪNG GIỐNG ANTIGRAVITY!
      if (profile && currentDiamonds < pointsCost) {
        const allowedRatio = currentDiamonds / pointsCost;
        const { partialText, remainingText } =
          this.truncateMessageAtTokenBudget(responseMessage, allowedRatio);

        isInterrupted = true;
        newInterruptedContext = {
          originalUserQuery:
            pendingInterruptedContext?.originalUserQuery || dto.message,
          partialAssistantReply: partialText,
          remainingUnreleasedReply: remainingText,
          interruptedAt: new Date().toISOString(),
        };

        responseMessage = partialText;
        responseActions = [];
        completionTokens = Math.max(
          1,
          Math.round(completionTokens * allowedRatio),
        );
        totalTokens = promptTokens + completionTokens;
        pointsCost = Number(currentDiamonds.toFixed(2));
      }

      // Trừ Ngọc Tri Thức trong Database & Ghi nhật ký ExamPointLog
      if (profile && pointsCost > 0) {
        const pointsAfter = Math.max(
          0,
          Number((currentDiamonds - pointsCost).toFixed(2)),
        );
        await this.prisma.studentProfile.update({
          where: { id: profile.id },
          data: { points: pointsAfter },
        });

        await this.prisma.examPointLog.create({
          data: {
            student_id: profile.id,
            action_type: 'AI_TUTOR_USAGE',
            points_before: currentDiamonds,
            points_delta: -pointsCost,
            points_after: pointsAfter,
            note: isInterrupted
              ? `Hỏi Gia sư AI (Tạm dừng giữa chừng do hết Ngọc): ${totalTokens.toLocaleString(
                  'vi-VN',
                )} token (Trừ hết ${pointsCost} 💎 còn lại)`
              : `Hỏi Gia sư AI: ${totalTokens.toLocaleString('vi-VN')} token (Trừ ${pointsCost} 💎${
                  hasDiscount ? ' - Đã giảm 50% Gói VIP' : ''
                })`,
          },
        });
      }
    }

    const remainingDiamonds = profile
      ? Math.max(0, Number((currentDiamonds - pointsCost).toFixed(2)))
      : currentDiamonds;

    // Cảnh báo khi số Ngọc Tri Thức còn lại <= 1 💎
    const lowBalanceWarning = remainingDiamonds <= 1 && remainingDiamonds > 0;
    const warningMessage = isInterrupted
      ? '⏸️ Đã dừng suy luận giữa chừng do hết Ngọc Tri Thức (0 💎). Lần nhắn tiếp theo sau khi có thêm Ngọc sẽ tự động nối tiếp ngữ cảnh đang dang dở!'
      : lowBalanceWarning
        ? `⚠️ Cảnh báo: Bạn chỉ còn ${remainingDiamonds} 💎 (≤ 1 Ngọc Tri Thức). Nếu hết Ngọc trong lúc AI đang suy luận, câu trả lời sẽ bị dừng giữa chừng!`
        : undefined;

    const emotion: RobotEmotion = isInterrupted
      ? 'sad'
      : isRobotEmotion(responseEmotion)
        ? responseEmotion
        : inferEmotion(responseMessage, responseActions);
    const emotionDurationMs = clampEmotionDuration(4000);

    const pointUsagePayload = {
      intent,
      isFree: isFreePlatformQuestion || isGuest,
      tokensUsed: totalTokens,
      promptTokens,
      completionTokens,
      rawPoints,
      pointsDeducted: pointsCost,
      remainingDiamonds: isGuest ? null : remainingDiamonds,
      hasDiscount,
      activePackage,
      lowBalanceWarning,
      isInterrupted,
      warningMessage,
      badge: isGuest
        ? '🤖 Trả lời tự động'
        : isFreePlatformQuestion
          ? '✨ Miễn phí'
          : `Trừ ${pointsCost} 💎`,
    };

    // 6. Tự động lưu hội thoại vào Chat Session Memory (kèm trạng thái isInterrupted & interruptedContext nếu bị dừng giữa chừng)
    let savedSessionSummary: any = null;
    if (dto.sessionId && !isSocraticTopicHint && !isGuest) {
      const baseHistory =
        existingSessionMsgs.length > 0
          ? existingSessionMsgs
          : Array.isArray(dto.history)
            ? dto.history
            : [];

      const userMsg = {
        id: `usr-${Date.now()}`,
        role: 'user' as const,
        content: dto.message,
        timestamp: new Date().toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
      const assistantMsg = {
        id: `ai-${Date.now()}`,
        role: 'assistant' as const,
        content: responseMessage,
        timestamp: new Date().toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        actions: responseActions,
        emotion,
        suggestions: responseSuggestions,
        isInterrupted,
        interruptedContext: newInterruptedContext,
        pointUsage: pointUsagePayload,
      };
      const fullHistory = [...baseHistory, userMsg, assistantMsg];
      savedSessionSummary = await this.chatMemoryService.saveSession(
        dto.sessionId,
        effectiveUserId,
        fullHistory as any,
      );
    }

    return {
      success: true,
      fromCache: isFromCache,
      cacheSimilarity,
      pointUsage: pointUsagePayload,
      data: {
        source: responseSource,
        similarity: cacheSimilarity,
        message: responseMessage,
        actions: responseActions,
        emotion,
        emotionDurationMs,
        suggestions: responseSuggestions,
        isInterrupted,
        interruptedContext: newInterruptedContext,
        resumedFromInterrupted: Boolean(pendingInterruptedContext),
        session: savedSessionSummary,
        vectorMemoryStats: vectorCtx.stats,
        pointUsage: pointUsagePayload,
      },
    };
  }

  @Get('sessions')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary:
      'Lấy danh sách các phiên trò chuyện của người dùng đã đăng nhập (Phân nhóm kiểu Gemini + Tìm kiếm Vector)',
  })
  async listChatSessions(
    @CurrentUser() currentUser?: any,
    @Query('q') q?: string,
  ) {
    if (!currentUser?.id) {
      return {
        success: true,
        data: {
          sessions: [],
          grouped: { pinned: [], today: [], previous7Days: [], older: [] },
        },
      };
    }
    const data = await this.chatMemoryService.listUserSessions(
      currentUser.id,
      q,
    );
    return {
      success: true,
      data,
    };
  }

  @Post('sessions')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary:
      'Tạo phiên trò chuyện mới theo phong cách Gemini (+ Cuộc trò chuyện mới)',
  })
  async createChatSession(
    @CurrentUser() currentUser?: any,
    @Body() body?: { title?: string },
  ) {
    if (!currentUser?.id) {
      const guestSessionKey = `sess-guest-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      return {
        success: true,
        data: {
          session: {
            id: guestSessionKey,
            sessionKey: guestSessionKey,
            userId: 'usr-student-01',
            title: body?.title || 'Cuộc trò chuyện mới',
            isPinned: false,
            messageCount: 0,
            lastMessagePreview: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      };
    }
    const session = await this.chatMemoryService.createNewSession(
      currentUser.id,
      body?.title,
    );
    return {
      success: true,
      data: {
        session,
      },
    };
  }

  @Get('chat/session/:sessionId')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Lấy lại toàn bộ lịch sử tin nhắn & metadata của một session',
  })
  async getChatSession(
    @Param('sessionId') sessionId: string,
    @CurrentUser() currentUser?: any,
  ) {
    if (!currentUser?.id) {
      return {
        success: true,
        data: {
          sessionId,
          session: null,
          messages: [],
        },
      };
    }
    const detail = await this.chatMemoryService.getSessionDetail(sessionId);
    if (
      detail.session &&
      detail.session.userId !== currentUser.id &&
      currentUser.role !== 'SUPER_ADMIN'
    ) {
      throw new ForbiddenException(
        'Bạn không có quyền truy cập phiên trò chuyện này',
      );
    }
    return {
      success: true,
      data: {
        sessionId,
        session: detail.session,
        messages: detail.messages,
      },
    };
  }

  @Patch('chat/session/:sessionId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Đổi tên cuộc trò chuyện hoặc Ghim / Bỏ ghim phiên trò chuyện',
  })
  async updateChatSession(
    @Param('sessionId') sessionId: string,
    @CurrentUser() currentUser: any,
    @Body() body: { title?: string; isPinned?: boolean },
  ) {
    const detail = await this.chatMemoryService.getSessionDetail(sessionId);
    if (
      detail.session &&
      detail.session.userId !== currentUser.id &&
      currentUser.role !== 'SUPER_ADMIN'
    ) {
      throw new ForbiddenException(
        'Bạn không có quyền chỉnh sửa phiên trò chuyện này',
      );
    }
    const updated = await this.chatMemoryService.updateSessionMetadata(
      sessionId,
      body || {},
    );
    return {
      success: Boolean(updated),
      data: {
        session: updated,
      },
    };
  }

  @Delete('chat/session/:sessionId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Xóa một phiên trò chuyện khỏi lịch sử' })
  async clearChatSession(
    @Param('sessionId') sessionId: string,
    @CurrentUser() currentUser: any,
  ) {
    const detail = await this.chatMemoryService.getSessionDetail(sessionId);
    if (
      detail.session &&
      detail.session.userId !== currentUser.id &&
      currentUser.role !== 'SUPER_ADMIN'
    ) {
      throw new ForbiddenException(
        'Bạn không có quyền xóa phiên trò chuyện này',
      );
    }
    const result = await this.chatMemoryService.clearSession(sessionId);
    return {
      success: result,
      message: result ? 'Đã xóa cuộc trò chuyện' : 'Không tìm thấy phiên',
    };
  }

  @Post('docx-scan-generate')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOperation({
    summary:
      'Admin tải đề thi .docx -> AI quét phạm vi kiến thức & sinh ra số lượng câu hỏi theo mong muốn',
    description:
      'Nhận file .docx (multipart/form-data) hoặc dữ liệu văn bản/câu hỏi gốc từ đề .docx. AI sẽ phân tích môn học, chuyên đề, phân bố Bloom và sinh ra đúng targetCount câu hỏi nằm trong phạm vi kiến thức của đề.',
  })
  @ApiResponse({
    status: 200,
    description: 'Quét phạm vi kiến thức và sinh câu hỏi thành công',
  })
  async scanAndGenerateFromDocx(
    @Body() dto: DocxScanGenerateDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const data = await this.docxGeneratorService.scanAndGenerateFromDocx(
      dto,
      file?.buffer,
      file?.originalname,
    );

    return {
      success: true,
      message: `AI đã quét phạm vi kiến thức của đề "${data.fileName}" và sinh thành công ${data.generatedCount} câu hỏi!`,
      data,
    };
  }

  @Post('docx-save-to-bank')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      'Lưu các câu hỏi AI đã sinh từ đề .docx vào Ngân hàng câu hỏi PostgreSQL',
  })
  @ApiResponse({
    status: 201,
    description: 'Lưu câu hỏi vào PostgreSQL thành công',
  })
  async saveDocxQuestionsToBank(@Body() dto: SaveGeneratedQuestionsDto) {
    const data =
      await this.docxGeneratorService.saveGeneratedQuestionsToBank(dto);
    return {
      success: true,
      message: `Đã lưu thành công ${data.savedCount} câu hỏi vào Ngân hàng câu hỏi PostgreSQL!`,
      data,
    };
  }

  @Get('cache-stats')
  @ApiOperation({ summary: 'Xem thống kê hiệu suất của Semantic Cache' })
  async getCacheStats() {
    const data = await this.cacheService.getStats();
    return {
      success: true,
      data,
    };
  }
}
