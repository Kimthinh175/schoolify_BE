import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes } from '@nestjs/swagger';
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

@ApiTags('AI Agent & Semantic Intelligence (Trợ lý Tác nhân & Đối soát Ngữ nghĩa)')
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
   * Tính toán Điểm Xịn phải trả cho lượt hỏi Gia sư AI theo số lượng Token:
   * - Tỉ lệ: 1 Điểm Xịn = 1.000 Token.
   * - Quy tắc làm tròn: >= 0.5 làm tròn lên, < 0.5 làm tròn xuống.
   * - Sàn tối thiểu: Nếu < 0.5 (hoặc làm tròn = 0), vẫn tính 0.5 điểm tối thiểu.
   * - Gói 2 (STUDENT_100K): Giảm 50% Điểm Xịn.
   */
  private calculateAiTutorPointsCost(
    tokens: number,
    activePackage?: string,
  ): {
    rawPoints: number;
    pointsCost: number;
    hasDiscount: boolean;
  } {
    const ratio = tokens / 1000;
    let raw = Math.round(ratio);
    if (raw < 0.5) {
      raw = 0.5; // Sàn tối thiểu 0.5 điểm
    }

    const isStudent100k = activePackage === 'STUDENT_100K';
    const pointsCost = isStudent100k ? Number((raw * 0.5).toFixed(2)) : raw;

    return {
      rawPoints: raw,
      pointsCost,
      hasDiscount: isStudent100k,
    };
  }

  /**
   * Phân loại ý định (Intent Classification):
   * - 'PLATFORM_INFO': Câu hỏi về tính năng Schoolify, gói cước, bảng giá, nạp điểm, đăng ký, đăng nhập, hướng dẫn tạo đề... (MIỄN PHÍ 100%)
   * - 'ACADEMIC_STUDY': Câu hỏi bài tập, giải phương trình, toán, lý, hóa, giải thích kiến thức K-12... (TÍNH PHÍ ĐIỂM XỊN)
   */
  private classifyUserIntent(message: string): 'PLATFORM_INFO' | 'ACADEMIC_STUDY' {
    if (!message) return 'PLATFORM_INFO';
    const norm = message
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

    // 1. Nhận diện các từ khóa học thuật / bài tập đặc trưng -> ACADEMIC_STUDY
    const academicKeywords = [
      'giai bai',
      'giai toan',
      'giai phuong trinh',
      'phuong trinh',
      'he phuong trinh',
      'dao ham',
      'tich phan',
      'nguyen ham',
      'cuc tri',
      'dong bien',
      'nghich bien',
      'hinh hoc',
      'the tich',
      'khoang cach',
      'vecto',
      'toa do',
      'hoa hoc',
      'phuong trinh hoa hoc',
      'can bang',
      'mol',
      'vat ly',
      'dong nang',
      'the nang',
      'dao dong',
      'song co',
      'quang hop',
      'ho hap',
      'di truyen',
      'adn',
      'arn',
      'viet code',
      'python',
      'lap trinh',
      'de bai',
      'bai 1',
      'bai 2',
      'bai 3',
      'cau 1',
      'cau 2',
      'cau 3',
      'dap an cau',
      'tinh giup',
      'giai giup',
      'chi cach lam',
      'cach giai',
      'socratic',
    ];

    // Có chứa công thức toán KaTeX ($...$) hoặc ký hiệu toán học
    const hasMathSymbols = /[\$∫∑√π∆]|\b(lim|sin|cos|tan|log|ln)\b/.test(message);

    // 2. Nhận diện các từ khóa thông tin web / nền tảng -> PLATFORM_INFO
    const platformKeywords = [
      'schoolify',
      'nen tang',
      'web',
      'trang web',
      'app',
      'he thong',
      'la gi',
      'gioi thieu',
      'tinh nang',
      'chuc nang',
      'ban la ai',
      'tro ly',
      'bang gia',
      'goi pro',
      'goi vip',
      'goi 50k',
      'goi 100k',
      'mua goi',
      'dang ky goi',
      'gia bao nhieu',
      'bao nhieu tien',
      'chi phi',
      'hoc phi',
      'nap tien',
      'thanh toan',
      'payos',
      'vietqr',
      'diem xin',
      'diem free',
      'kim cuong',
      'nap diem',
      'mua diem',
      'tai khoan',
      'mat khau',
      'dang nhap',
      'dang ky',
      'doi mat khau',
      'ho tro',
      'lien he',
      'huong dan',
      'cach dung',
      'cach su dung',
      'cach tao de',
      'phong thi',
      'lich su',
      'xep hang',
      'bang vang',
      'doi qua',
      'store',
    ];

    const isPlatform = platformKeywords.some((kw) => norm.includes(kw));
    const isAcademic = academicKeywords.some((kw) => norm.includes(kw)) || hasMathSymbols;

    // Nếu chứa từ khóa platform và không có công thức toán/giải bài -> Chắc chắn là PLATFORM_INFO
    if (isPlatform && !hasMathSymbols) {
      return 'PLATFORM_INFO';
    }

    if (isAcademic) {
      return 'ACADEMIC_STUDY';
    }

    // Mặc định câu hỏi chung / chào hỏi / hỏi thông tin -> Miễn phí PLATFORM_INFO
    return 'PLATFORM_INFO';
  }

  @Post('semantic-checkpoint')
  @ApiOperation({
    summary: 'Chấm điểm đối soát ngữ nghĩa bán tự động (Tự luận / Điền từ ngắn)',
    description:
      'Quy trình Hybrid: Dùng Vector lọc câu tương đồng của học sinh. Nếu phát hiện thì chuyển câu đó + Checkpoint sang AI IPC Bridge đối soát logic True/False.',
  })
  @ApiResponse({ status: 200, description: 'Kết quả chấm điểm đối soát thành công' })
  async evaluateSemanticCheckpoint(@Body() dto: EvaluateSemanticCheckpointDto) {
    const data = await this.checkpointService.evaluate(dto);
    return {
      success: true,
      message: data.isCorrect ? 'Ý trả lời chính xác và thỏa mãn tiêu chí' : 'Ý trả lời chưa đạt tiêu chí',
      data,
    };
  }

  @Post('chat')
  @ApiOperation({
    summary: 'Trò chuyện với AI Agentic Assistant (Phân loại Intent: Hỏi Web miễn phí vs Hỏi Bài tính điểm)',
    description:
      'Phân biệt Intent: Hỏi bài tập đo lường Token & trừ Điểm Xịn (1 điểm = 1000 token, sàn 0.5đ, Gói 100k VIP giảm 50%). Hỏi thông tin web hoàn toàn MIỄN PHÍ.',
  })
  @ApiResponse({
    status: 200,
    description: 'Phản hồi từ AI Agent kèm biểu cảm robot và chi tiết Token/Điểm Xịn trừ',
    type: AgentChatResponseDto,
  })
  async chatWithAgent(@Body() dto: AgentChatDto) {
    // 1. Phân loại Ý định (Intent Classification): Hỏi thông tin Web (Miễn phí) vs Hỏi Bài Tập (Tính phí)
    const intent = this.classifyUserIntent(dto.message);
    const isFreePlatformQuestion = intent === 'PLATFORM_INFO';

    // 2. Tìm thông tin StudentProfile để xác định Gói & Điểm Xịn hiện có
    const effectiveUserId = dto.userId || 'usr-student-01';
    let profile = await this.prisma.studentProfile.findUnique({
      where: { user_id: effectiveUserId },
    });
    if (!profile) {
      profile = await this.prisma.studentProfile.findFirst();
    }

    const isPackageExpired =
      profile?.package_expires_at &&
      new Date(profile.package_expires_at).getTime() < Date.now();
    const activePackage = isPackageExpired ? 'FREE' : profile?.active_package || 'FREE';
    const currentDiamonds = Number(profile?.points ?? 0);

    // 3. Nếu là HỎI BÀI TẬP: Kiểm tra sàn số dư tối thiểu (0.25đ đối với Gói VIP 100k, 0.5đ đối với Free/Gói 50k)
    // Nếu là HỎI THÔNG TIN WEB: MIỄN PHÍ 100%, không kiểm tra số dư và không chặn người dùng!
    if (!isFreePlatformQuestion) {
      const minRequiredDiamonds = activePackage === 'STUDENT_100K' ? 0.25 : 0.5;
      if (profile && currentDiamonds < minRequiredDiamonds) {
        return {
          success: false,
          errorCode: 'INSUFFICIENT_XIN_POINTS',
          message: `Bạn không đủ Điểm Xịn (💎) để hỏi Gia sư AI. Số dư hiện tại là ${currentDiamonds} 💎 (cần tối thiểu ${minRequiredDiamonds} 💎). Hãy làm đề thi đạt trên 8.5 điểm để cày thêm Điểm Xịn miễn phí hoặc nâng cấp gói học sinh nhé!`,
          data: {
            currentDiamonds,
            minRequired: minRequiredDiamonds,
            activePackage,
            emotion: 'sad',
            emotionDurationMs: 4000,
          },
        };
      }
    }

    // 2. Kiểm tra Semantic Cache trước
    const cacheResult = await this.cacheService.findInCache(dto.message, dto.subject, dto.grade);

    let responseMessage = '';
    let responseActions: any[] = [];
    let responseEmotion: RobotEmotion | undefined;
    let responseSuggestions: string[] = [];
    let isFromCache = false;
    let cacheSimilarity = 1.0;

    if (cacheResult.hit && cacheResult.responseText) {
      isFromCache = true;
      cacheSimilarity = cacheResult.similarity ?? 1.0;
      responseMessage = cacheResult.responseText;
      responseActions = cacheResult.clientActions || [];
      responseEmotion = (cacheResult as any).emotion;
      responseSuggestions = (cacheResult as any).suggestions || [];
    } else {
      // 3. Cache Miss -> Gọi qua Antigravity Headless IPC Bridge
      const bridgeResult = await this.ipcBridgeService.generateAgentResponse(dto);
      responseMessage = bridgeResult.message;
      responseActions = bridgeResult.actions || [];
      responseEmotion = bridgeResult.emotion;
      responseSuggestions = bridgeResult.suggestions || [];

      const initialEmotion: RobotEmotion = isRobotEmotion(responseEmotion)
        ? responseEmotion
        : inferEmotion(responseMessage, responseActions);

      // Lưu vào Semantic Cache để tái sử dụng kèm emotion và suggestions (Chuẩn cho-cong-nghe)
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

    const emotion: RobotEmotion = isRobotEmotion(responseEmotion)
      ? responseEmotion
      : inferEmotion(responseMessage, responseActions);
    const emotionDurationMs = clampEmotionDuration(4000);

    // 4. Đo lường Token tiêu thụ & tính Điểm Xịn phải trả
    const promptTokens =
      this.estimateTokens(dto.message) +
      (dto.context ? this.estimateTokens(JSON.stringify(dto.context)) : 0);
    const completionTokens = this.estimateTokens(responseMessage);
    const totalTokens = promptTokens + completionTokens;

    let rawPoints = 0;
    let pointsCost = 0;
    let hasDiscount = false;

    // 5. Nếu là HỎI BÀI TẬP: Tính toán điểm theo Token & trừ Điểm Xịn
    if (!isFreePlatformQuestion) {
      const pointCalc = this.calculateAiTutorPointsCost(totalTokens, activePackage);
      rawPoints = pointCalc.rawPoints;
      pointsCost = pointCalc.pointsCost;
      hasDiscount = pointCalc.hasDiscount;

      // Kiểm tra nếu số dư không đủ cho chi phí câu trả lời đầy đủ
      if (profile && currentDiamonds < pointsCost) {
        return {
          success: false,
          errorCode: 'INSUFFICIENT_XIN_POINTS',
          message: `Bạn không đủ Điểm Xịn (💎) để nhận giải đáp đầy đủ. Lượt hỏi này tiêu thụ ${totalTokens.toLocaleString(
            'vi-VN',
          )} token (cần ${pointsCost} 💎), nhưng bạn chỉ còn ${currentDiamonds} 💎. Hãy làm bài thi đạt trên 8.5đ để kiếm thêm 💎 nhé!`,
          data: {
            currentDiamonds,
            requiredPoints: pointsCost,
            totalTokens,
            activePackage,
            emotion: 'sad',
            emotionDurationMs: 4000,
          },
        };
      }

      // Trừ Điểm Xịn trong Database & Ghi nhật ký ExamPointLog
      if (profile) {
        const pointsAfter = Number((currentDiamonds - pointsCost).toFixed(2));
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
            note: `Hỏi Gia sư AI: ${totalTokens.toLocaleString('vi-VN')} token (Trừ ${pointsCost} 💎${
              hasDiscount ? ' - Đã giảm 50% Gói VIP' : ''
            })`,
          },
        });
      }
    }

    const remainingDiamonds = profile
      ? Number((currentDiamonds - pointsCost).toFixed(2))
      : currentDiamonds;

    // 6. Tự động lưu hội thoại vào Chat Session Memory Cache (Sliding Window 40 tin - Chuẩn cho-cong-nghe)
    if (dto.sessionId) {
      const userMsg = {
        id: `usr-${Date.now()}`,
        role: 'user' as const,
        content: dto.message,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };
      const assistantMsg = {
        id: `ai-${Date.now()}`,
        role: 'assistant' as const,
        content: responseMessage,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        actions: responseActions,
        emotion,
        suggestions: responseSuggestions,
        pointUsage: {
          intent,
          isFree: isFreePlatformQuestion,
          tokensUsed: totalTokens,
          pointsDeducted: pointsCost,
          remainingDiamonds,
          hasDiscount,
          activePackage,
          badge: isFreePlatformQuestion ? '✨ Miễn phí (Hỏi thông tin web)' : `Trừ ${pointsCost} 💎`,
        },
      };
      const fullHistory = Array.isArray(dto.history)
        ? [...dto.history, userMsg, assistantMsg]
        : [userMsg, assistantMsg];
      this.chatMemoryService
        .saveSession(dto.sessionId, effectiveUserId, fullHistory as any)
        .catch(() => {});
    }

    return {
      success: true,
      fromCache: isFromCache,
      cacheSimilarity,
      pointUsage: {
        intent,
        isFree: isFreePlatformQuestion,
        tokensUsed: totalTokens,
        promptTokens,
        completionTokens,
        rawPoints,
        pointsDeducted: pointsCost,
        remainingDiamonds,
        hasDiscount,
        activePackage,
        badge: isFreePlatformQuestion ? '✨ Miễn phí (Hỏi thông tin web)' : `Trừ ${pointsCost} 💎`,
      },
      data: {
        source: isFromCache ? 'SEMANTIC_CACHE' : 'ANTIGRAVITY_AGENT',
        similarity: cacheSimilarity,
        message: responseMessage,
        actions: responseActions,
        emotion,
        emotionDurationMs,
        suggestions: responseSuggestions,
        pointUsage: {
          intent,
          isFree: isFreePlatformQuestion,
          tokensUsed: totalTokens,
          pointsDeducted: pointsCost,
          remainingDiamonds,
          hasDiscount,
          activePackage,
          badge: isFreePlatformQuestion ? '✨ Miễn phí (Hỏi thông tin web)' : `Trừ ${pointsCost} 💎`,
        },
      },
    };
  }

  @Get('chat/session/:sessionId')
  @ApiOperation({ summary: 'Lấy lại toàn bộ lịch sử tin nhắn đã cache của một session (Khôi phục khi F5)' })
  async getChatSession(@Param('sessionId') sessionId: string) {
    const messages = await this.chatMemoryService.getSession(sessionId);
    return {
      success: true,
      data: {
        sessionId,
        messages,
      },
    };
  }

  @Delete('chat/session/:sessionId')
  @ApiOperation({ summary: 'Xóa phiên trò chuyện để bắt đầu cuộc trò chuyện mới' })
  async clearChatSession(@Param('sessionId') sessionId: string) {
    const result = await this.chatMemoryService.clearSession(sessionId);
    return {
      success: result,
      message: result ? 'Đã làm mới phiên trò chuyện' : 'Không tìm thấy phiên',
    };
  }

  @Post('docx-scan-generate')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOperation({
    summary: 'Admin tải đề thi .docx -> AI quét phạm vi kiến thức & sinh ra số lượng câu hỏi theo mong muốn',
    description:
      'Nhận file .docx (multipart/form-data) hoặc dữ liệu văn bản/câu hỏi gốc từ đề .docx. AI sẽ phân tích môn học, chuyên đề, phân bố Bloom và sinh ra đúng targetCount câu hỏi nằm trong phạm vi kiến thức của đề.',
  })
  @ApiResponse({ status: 200, description: 'Quét phạm vi kiến thức và sinh câu hỏi thành công' })
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
  @ApiOperation({
    summary: 'Lưu các câu hỏi AI đã sinh từ đề .docx vào Ngân hàng câu hỏi PostgreSQL',
  })
  @ApiResponse({ status: 201, description: 'Lưu câu hỏi vào PostgreSQL thành công' })
  async saveDocxQuestionsToBank(@Body() dto: SaveGeneratedQuestionsDto) {
    const data = await this.docxGeneratorService.saveGeneratedQuestionsToBank(dto);
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
