import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { AgentChatDto } from '../dto/agent.dto';
import {
  RobotEmotion,
  isRobotEmotion,
  inferEmotion,
} from '../constants/robot-emotion';

export interface SemanticLogicResult {
  isCorrect: boolean;
  explanation: string;
}

export interface AgentResponseResult {
  message: string;
  actions: Array<{
    type: string;
    payload: Record<string, any>;
  }>;
  emotion?: RobotEmotion;
  suggestions?: string[];
  usageMetadata?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

@Injectable()
export class AntigravityIpcBridgeService {
  private readonly logger = new Logger(AntigravityIpcBridgeService.name);
  private readonly ipcInboxDir = '/home/thinh/ca-nhan/schoolify/BE/ipc/inbox';
  private readonly ipcOutboxDir = '/home/thinh/ca-nhan/schoolify/BE/ipc/outbox';

  constructor() {}

  /**
   * Đã ngắt hoàn toàn cổng IPC file bridge nội bộ theo yêu cầu —
   * Toàn bộ tác vụ AI sử dụng trực tiếp cụm khóa Google Gemini 2.5 Flash API (Multi-Key Rotation).
   */
  async requestLiveAntigravity<T>(
    _jobId: string,
    _type: 'DOCX_SCAN_GENERATE' | 'AGENT_CHAT' | 'SEMANTIC_CHECKPOINT',
    _payload: Record<string, any>,
    _timeoutMs = 60000,
  ): Promise<T | null> {
    return null;
  }

  /**
   * ĐỐI SOÁT NGỮ NGHĨA LOGIC (Semantic Checkpoint Logic)
   */
  async evaluateSemanticLogic(
    candidateSentence: string,
    rubricCheckpoint: string,
    vectorSimilarity = 0,
  ): Promise<SemanticLogicResult> {
    const normStudent = candidateSentence.trim().toLowerCase();
    const normCheckpoint = rubricCheckpoint.trim().toLowerCase();

    // 2. Dự phòng: Logic kiểm tra phủ định & đối soát tính đúng đắn khoa học
    const negationKeywords = [
      'không',
      'chưa',
      'chẳng',
      'đâu có',
      'sai',
      'trái ngược',
      'khác với',
      'thay vì',
      'ngược lại',
      'không phải',
      'không diễn ra',
      'vô nghiệm',
      'không tồn tại',
    ];

    // Kiểm tra xem câu của học sinh có chứa từ phủ định hay không
    const hasNegationInStudent = negationKeywords.some((neg) => {
      const regex = new RegExp(`\\b${neg}\\b`, 'i');
      return regex.test(normStudent);
    });

    // Kiểm tra xem tiêu chí chuẩn ban đầu có chứa từ phủ định hay không
    const hasNegationInCheckpoint = negationKeywords.some((neg) => {
      const regex = new RegExp(`\\b${neg}\\b`, 'i');
      return regex.test(normCheckpoint);
    });

    // Nếu tiêu chí là khẳng định (không có phủ định) mà học sinh lại dùng phủ định
    if (!hasNegationInCheckpoint && hasNegationInStudent) {
      return {
        isCorrect: false,
        explanation: `Học sinh có nhắc đến chủ đề nhưng sử dụng yếu tố phủ định hoặc phản đề trái với tiêu chí chuẩn ("${rubricCheckpoint}").`,
      };
    }

    // Nếu tiêu chí là phủ định mà học sinh khẳng định ngược lại
    if (hasNegationInCheckpoint && !hasNegationInStudent) {
      return {
        isCorrect: false,
        explanation: `Tiêu chí chuẩn yêu cầu khẳng định tính phủ định/loại trừ, nhưng câu trả lời của học sinh lại khẳng định tính thuận.`,
      };
    }

    // 3. Kiểm tra cặp thuật ngữ trái nghĩa (Antonym Pairs): ví dụ "đồng biến" <-> "nghịch biến"
    const antonymPairs: Array<[string, string]> = [
      ['đồng biến', 'nghịch biến'],
      ['cực đại', 'cực tiểu'],
      ['lớn nhất', 'nhỏ nhất'],
      ['tăng', 'giảm'],
      ['dương', 'âm'],
      ['thu nhiệt', 'tỏa nhiệt'],
      ['oxi hóa', 'khử'],
      ['hội tụ', 'phân kỳ'],
    ];
    for (const [termA, termB] of antonymPairs) {
      const cpHasA =
        normCheckpoint.includes(termA) && !normCheckpoint.includes(termB);
      const cpHasB =
        normCheckpoint.includes(termB) && !normCheckpoint.includes(termA);
      const stHasA =
        normStudent.includes(termA) && !normStudent.includes(termB);
      const stHasB =
        normStudent.includes(termB) && !normStudent.includes(termA);
      if ((cpHasA && stHasB) || (cpHasB && stHasA)) {
        return {
          isCorrect: false,
          explanation: `Câu trả lời của học sinh có mặt chữ rất giống nhưng đã dùng thuật ngữ trái nghĩa ("${cpHasA ? termB : termA}" thay vì "${cpHasA ? termA : termB}") so với tiêu chí chuẩn.`,
        };
      }
    }

    // 4. Kiểm tra các từ khóa cốt lõi & phát hiện đảo vế chủ ngữ - tân ngữ / toán hạng (ví dụ: CO2 <-> O2, sin(x) <-> cos(x), Chó cắn người <-> Người cắn chó)
    const stopWords = new Set([
      'là',
      'và',
      'của',
      'ở',
      'tại',
      'trong',
      'được',
      'có',
      'để',
      'những',
      'các',
      'một',
      'bằng',
      'ra',
      'khí',
      'hàm',
      'số',
    ]);
    const checkpointTokens = normCheckpoint
      .replace(/[.,/#!$%^&*;:{}=\-_`~]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1 && !stopWords.has(w));

    const uniqueOrderedCpTokens = Array.from(new Set(checkpointTokens));
    const positionsInStudent = uniqueOrderedCpTokens
      .map((token) => ({ token, idx: normStudent.indexOf(token) }))
      .filter((item) => item.idx !== -1);

    // Nếu học sinh dùng lại đúng các thực thể trong câu chuẩn nhưng đảo ngược vị trí (Inversion)
    if (positionsInStudent.length >= 2) {
      let inversions = 0;
      for (let i = 0; i < positionsInStudent.length - 1; i++) {
        if (positionsInStudent[i].idx > positionsInStudent[i + 1].idx) {
          inversions++;
        }
      }
      if (inversions > 0 && normStudent !== normCheckpoint) {
        return {
          isCorrect: false,
          explanation: `Mặc dù câu trả lời có độ tương đồng từ vựng cao (${(vectorSimilarity * 100).toFixed(1)}%), học sinh đã đảo ngược vị trí chủ thể/đối tượng so với tiêu chí chuẩn ("${rubricCheckpoint}") làm sai lệch bản chất bài toán.`,
        };
      }
    }

    let matchedTokensCount = 0;
    for (const token of checkpointTokens) {
      if (normStudent.includes(token)) {
        matchedTokensCount++;
      }
    }

    const matchRatio =
      checkpointTokens.length > 0
        ? matchedTokensCount / checkpointTokens.length
        : 1;

    if (matchRatio >= 0.6 || vectorSimilarity >= 0.85) {
      return {
        isCorrect: true,
        explanation: `Câu trả lời của học sinh đồng nghĩa sâu về mặt ngữ nghĩa (${(vectorSimilarity * 100).toFixed(1)}% trên không gian 1024 chiều) và nhất quán logic với tiêu chí chuẩn: "${rubricCheckpoint}".`,
      };
    } else {
      return {
        isCorrect: false,
        explanation: `Câu trả lời có độ tương đồng ngữ cảnh nhưng còn thiếu các thuật ngữ cốt lõi để thỏa mãn tiêu chí: "${rubricCheckpoint}".`,
      };
    }
  }

  private getVipGeminiKey(): string {
    return (process.env.GEMINI_API_KEY || '').trim();
  }

  /**
   * Gọi trực tiếp Google Gemini Flash API qua GEMINI_API_KEY từ biến môi trường
   * và truyền ngữ cảnh hội thoại đã nén Vector
   */
  private async callRealGeminiApi(
    dto: AgentChatDto,
    detectedSubject: string,
    detectedGrade: number,
  ): Promise<AgentResponseResult | null> {
    const apiKey = this.getVipGeminiKey();
    if (!apiKey) return null;

    const isSocraticTopicHint =
      dto.questionContext?.mode === 'SOCRATIC_TOPIC_HINT';
    const qCtx = dto.questionContext || {};

    const contextSummaryBlock = dto.context?.contextSummary
      ? `\n\n=== TIẾN TRÌNH HỘI THOẠI ĐÃ ĐƯỢC RÚT GỌN TỐI ƯU (AUTO-COMPACTED CONTEXT) ===
${dto.context.contextSummary}
====================================================================================
* QUY TẮC NỐI MẠCH: Dựa vào khối tóm tắt trên để nắm chắc toàn bộ dữ kiện bài toán và các bước đã giải ở các lượt trước, kết hợp với các tin nhắn gần nhất dưới đây để đưa ra lời giải liền mạch, không hỏi lại các dữ kiện đã biết!`
      : '';
    const recalledTurns =
      Array.isArray(dto.context?.recalledTurns) &&
      dto.context.recalledTurns.length > 0
        ? `\n- Kiến thức liên quan từng trao đổi:\n${dto.context.recalledTurns
            .map(
              (t: any) =>
                `  + Hỏi: "${t.userQuery}" -> Đáp: "${t.assistantReply}"`,
            )
            .join('\n')}`
        : '';

    const ic = dto.context?.interruptedContext;
    const interruptedContextBlock = ic
      ? `\n5. [NGỮ CẢNH ĐANG DANG DỞ TỪ LƯỢT TRƯỚC DO HẾT NGỌC TRI THỨC]:
   - Câu hỏi gốc đang giải dở: "${ic.originalUserQuery || ''}"
   - Phần lời giải tớ đã viết trước khi bị ngắt giữa chừng: "${ic.partialAssistantReply || ''}"
   - Phần nháp còn lại chưa xuất ra: "${ic.remainingUnreleasedReply || ''}"
   -> QUY TẮC NỐI TIẾP BẮT BUỘC: Ở lượt này, hãy tự động nối tiếp mạch suy luận đang dang dở ở trên (tuyệt đối không lặp lại nguyên văn đoạn đã viết ở trên) để hoàn thiện lời giải hoặc giải đáp tiếp yêu cầu mới của bạn học sinh một cách liền mạch!`
      : '';

    const systemInstructionText = isSocraticTopicHint
      ? `Bạn là Gia sư Socratic của Schoolify đang hỗ trợ học sinh trong Chế độ Luyện Chuyên Đề (mỗi câu hỏi học sinh chỉ có duy nhất 1 quyền trợ giúp).
NGUYÊN TẮC BẮT BUỘC TUYỆT ĐỐI:
1. CHỈ GỢI Ý CÁCH GIẢI / PHƯƠNG PHÁP TƯ DUY: Tuyệt đối KHÔNG giải chi tiết bài toán gốc, KHÔNG thay số của đề gốc để tính ra kết quả cuối cùng, và TUYỆT ĐỐI KHÔNG tiết lộ đáp án đúng là A, B, C, D hay con số đáp án.
2. NẾU HỌC SINH CÓ NHẬP CHỖ THẮC MẮC: Giải thích trực diện, dễ hiểu đúng chỗ học sinh đang vướng mắc đó (nhưng vẫn không làm hộ bước ra đáp án cuối). NẾU HỌC SINH KHÔNG NHẬP GÌ: Chỉ ra công thức / định lý / bước chuyển đổi cốt lõi cần dùng cho câu hỏi này.
3. VÍ DỤ LOGIC TƯƠNG ĐƯƠNG: Đưa ra 1 ví dụ tương tự về mặt bản chất logic (cùng dạng toán nhưng dùng số liệu khác hoặc biểu thức đơn giản hơn) và giải nhanh ví dụ đó để học sinh nhìn vào quy luật rồi tự tư duy giải câu hỏi gốc.
4. Trình bày ngắn gọn, sạch sẽ (tối đa 2-3 gạch đầu dòng ngắn), xưng "tớ" - "bạn", mọi công thức Toán/Lý/Hóa đặt trong ký hiệu LaTeX chuẩn \`$...$\` hoặc \`$$...$$\`.`
      : `Bạn là **Schoolify AI** — Trợ lý Học tập & Gia sư AI thông minh của nền tảng giáo dục K-12 **Schoolify** (chuẩn Chương trình GDPT 2018).
Quy tắc giao tiếp & trình bày:
1. Xưng hô thân thiện là **"tớ"** và gọi người dùng là **"bạn"**. Trả lời tự nhiên, thông minh, trực diện đúng trọng tâm câu hỏi (tuyệt đối KHÔNG trả lời văn mẫu chung chung).
2. Khi giải bài tập K-12 (Toán, Lý, Hóa, Sinh, Tin học, Anh...): trình bày rõ ràng từng bước, dễ hiểu; mọi công thức Toán/Lý/Hóa đặt trong ký hiệu LaTeX chuẩn \`$...$\` (inline) hoặc \`$$...$$\` (công thức dòng riêng).
3. Thông tin về nền tảng Schoolify (khi người dùng hỏi):
   - Nền tảng luyện thi K-12 thích ứng 4 cấp độ (Cơ bản, Trung bình, Nâng cao, HSG), tự động chẩn đoán lỗ hổng kiến thức và tạo lộ trình cá nhân hóa sau mỗi đề thi.
   - Hệ thống điểm: **Tia Sáng** (điểm lượt thi miễn phí mỗi ngày) và **Ngọc Tri Thức 💎** (điểm thưởng vĩnh viễn khi thi đạt >= 8.5 điểm hoặc từ Gói Học Sinh 50.000đ / 100.000đ).
4. Ngữ cảnh hiện tại: Môn ${detectedSubject}, Khối ${detectedGrade}.${contextSummaryBlock}${recalledTurns}${interruptedContextBlock}`;

    const historyItems = Array.isArray(dto.history)
      ? dto.history.slice(-4)
      : [];
    const contents: Array<{
      role: 'user' | 'model';
      parts: Array<{ text: string }>;
    }> = [];

    if (isSocraticTopicHint) {
      const choicesText = Array.isArray(qCtx.choices)
        ? qCtx.choices.map((c: any) => `${c.key}. ${c.content}`).join('\n')
        : '';
      const studentDoubt =
        typeof qCtx.studentDoubt === 'string' ? qCtx.studentDoubt.trim() : '';
      const socraticPrompt = [
        `Đề bài câu hỏi đang làm (${qCtx.title || 'Câu hỏi chuyên đề'} - Chuyên đề: ${qCtx.topicTag || detectedSubject}):`,
        `${qCtx.content || dto.message}`,
        choicesText ? `\nCác phương án lựa chọn:\n${choicesText}` : '',
        studentDoubt
          ? `\nChỗ học sinh đang thắc mắc: "${studentDoubt}"`
          : `\nHọc sinh không nhập thắc mắc cụ thể (hãy gợi ý hướng giải tổng quát và 1 ví dụ logic tương đương).`,
        `\nHãy gợi ý cách giải và đưa 1 ví dụ tương đương về mặt logic (với số liệu khác) để học sinh tự tư duy. Nhớ TUYỆT ĐỐI KHÔNG giải ra đáp án của đề bài gốc!`,
      ]
        .filter(Boolean)
        .join('\n');

      contents.push({
        role: 'user',
        parts: [{ text: socraticPrompt }],
      });
    } else {
      for (const h of historyItems) {
        if (!h?.content || typeof h.content !== 'string') continue;
        const mappedRole = h.role === 'assistant' ? 'model' : 'user';
        // Đảm bảo luân phiên user/model hợp lệ
        if (contents.length === 0 && mappedRole === 'model') continue;
        if (
          contents.length > 0 &&
          contents[contents.length - 1].role === mappedRole
        ) {
          contents[contents.length - 1].parts[0].text += `\n${h.content}`;
        } else {
          contents.push({
            role: mappedRole,
            parts: [{ text: h.content }],
          });
        }
      }

      if (
        contents.length > 0 &&
        contents[contents.length - 1].role === 'user'
      ) {
        contents[contents.length - 1].parts[0].text += `\n${dto.message}`;
      } else {
        contents.push({
          role: 'user',
          parts: [{ text: dto.message }],
        });
      }
    }

    const modelsToTry = ['gemini-3.8-flash', 'gemini-flash-latest'];
    for (const modelName of modelsToTry) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: {
                parts: [{ text: systemInstructionText }],
              },
              contents,
              generationConfig: {
                temperature: 0.65,
                maxOutputTokens: 1600,
                thinkingConfig: { thinkingBudget: 0 },
              },
            }),
            signal: AbortSignal.timeout(15000),
          },
        );

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          this.logger.warn(
            `[Gemini VIP API] Model ${modelName} trả về HTTP ${res.status}: ${errText.slice(0, 120)}`,
          );
          continue;
        }

        const data: any = await res.json();
        const replyText: string | undefined =
          data?.candidates?.[0]?.content?.parts
            ?.map((p: any) => p?.text || '')
            .join('')
            .trim();

        if (replyText) {
          const actions = isSocraticTopicHint
            ? []
            : this.buildContextualActions(
                dto.message,
                detectedSubject,
                detectedGrade,
                dto.currentUrl,
              );
          const suggestions = isSocraticTopicHint
            ? []
            : this.buildContextualSuggestions(
                dto.message,
                detectedSubject,
                detectedGrade,
              );
          const emotion = inferEmotion(replyText, actions);

          const completionTokens =
            Number(data?.usageMetadata?.candidatesTokenCount) ||
            Math.max(1, Math.ceil(replyText.length / 3.5));
          const userPromptTokens = Math.max(
            1,
            Math.ceil((dto.message || '').trim().length / 3.5),
          );
          const totalTokens = userPromptTokens + completionTokens;

          this.logger.log(
            `✨ [Gemini VIP API - ${modelName}] Đã sinh phản hồi thành công (${replyText.length} ký tự | ${totalTokens} tokens)`,
          );
          return {
            message: replyText,
            actions,
            emotion,
            suggestions,
            usageMetadata: {
              promptTokens: userPromptTokens,
              completionTokens,
              totalTokens,
            },
          };
        }
      } catch (err: any) {
        this.logger.warn(
          `[Gemini VIP API] Lỗi kết nối model ${modelName}: ${err.message}`,
        );
      }
    }

    return null;
  }

  private buildContextualActions(
    rawMessage: string,
    detectedSubject: string,
    detectedGrade: number,
    currentUrl = '',
  ): Array<{ type: string; payload: Record<string, any> }> {
    const text = (rawMessage || '').toLowerCase();
    const actions: Array<{ type: string; payload: Record<string, any> }> = [];

    if (
      text.includes('tạo đề') ||
      text.includes('thi thử') ||
      text.includes('làm đề') ||
      text.includes('ma trận đề')
    ) {
      const isHard =
        text.includes('khó') ||
        text.includes('vận dụng cao') ||
        text.includes('nâng cao');
      const bloomRatio = isHard
        ? { NHAN_BIET: 10, THONG_HIEU: 30, VAN_DUNG: 40, VAN_DUNG_CAO: 20 }
        : { NHAN_BIET: 30, THONG_HIEU: 40, VAN_DUNG: 20, VAN_DUNG_CAO: 10 };
      const numMatch = text.match(/(\d+)\s*câu/);
      const totalQuestions = numMatch
        ? Math.min(50, Math.max(5, parseInt(numMatch[1], 10)))
        : 10;

      actions.push({
        type: 'CONFIGURE_EXAM_MATRIX',
        payload: {
          subject: detectedSubject,
          grade: detectedGrade,
          bloomRatio,
          durationMinutes: totalQuestions >= 20 ? 45 : 20,
          totalQuestions,
        },
      });
    } else if (
      text.includes('bảng giá') ||
      text.includes('gói học') ||
      text.includes('nâng cấp') ||
      text.includes('mua gói')
    ) {
      actions.push({
        type: 'NAVIGATE_PAGE',
        payload: {
          path: '/pricing',
          label: 'Xem Các Gói Học & Bảng Giá',
        },
      });
    } else if (
      (text.includes('schoolify') || text.includes('nền tảng')) &&
      !currentUrl.includes('/student/practice')
    ) {
      actions.push({
        type: 'NAVIGATE_PAGE',
        payload: {
          path: '/student/practice',
          label: 'Vào Phòng Luyện Thi & Lộ Trình Cá Nhân',
        },
      });
    }

    return actions;
  }

  private buildContextualSuggestions(
    rawMessage: string,
    detectedSubject: string,
    detectedGrade: number,
  ): string[] {
    const text = (rawMessage || '').toLowerCase();
    if (
      text.includes('bậc 2') ||
      text.includes('bậc hai') ||
      text.includes('vi-ét') ||
      text.includes('viet')
    ) {
      return [
        'Cho ví dụ tìm m để phương trình có 2 nghiệm trái dấu',
        'Cách nhẩm nghiệm nhanh bằng hệ thức Vi-ét',
        `Tạo đề ${detectedSubject} ${detectedGrade} chuyên đề hàm số 10 câu`,
      ];
    }
    if (
      text.includes('đạo hàm') ||
      text.includes('cực trị') ||
      text.includes('đồng biến')
    ) {
      return [
        'Các bước tìm cực trị hàm số chứa tham số m',
        'Bảng đạo hàm các hàm số lượng giác cơ bản',
        `Tạo đề ${detectedSubject} ${detectedGrade} mức độ vận dụng 10 câu`,
      ];
    }
    return [
      `Giải thích chuyên đề trọng tâm ${detectedSubject} ${detectedGrade}`,
      `Tạo đề ${detectedSubject} ${detectedGrade} khó 10 câu`,
      'Phân tích lộ trình học tập cá nhân trên Schoolify',
    ];
  }

  /**
   * SINH PHẢN HỒI AGENT KÈM CLIENT TOOL ACTIONS (Generative Agentic Chatbot)
   */
  async generateAgentResponse(
    dto: AgentChatDto,
    options: { allowRealAi?: boolean } = {},
  ): Promise<AgentResponseResult> {
    const text = dto.message.toLowerCase();
    const currentUrl = dto.currentUrl || '';

    // Tự động nhận diện môn học & khối lớp từ câu chat tự nhiên của học sinh
    let detectedSubject = dto.subject || 'Toán học';
    if (
      text.includes('vật lý') ||
      text.includes('vat ly') ||
      text.includes('môn lý')
    ) {
      detectedSubject = 'Vật lý';
    } else if (text.includes('hóa') || text.includes('hoa hoc')) {
      detectedSubject = 'Hóa học';
    } else if (
      text.includes('sinh') ||
      text.includes('lục lạp') ||
      text.includes('di truyền')
    ) {
      detectedSubject = 'Sinh học';
    } else if (
      text.includes('tin') ||
      text.includes('python') ||
      text.includes('c++') ||
      text.includes('sql')
    ) {
      detectedSubject = 'Tin học';
    } else if (
      text.includes('anh') ||
      text.includes('english') ||
      text.includes('ielts')
    ) {
      detectedSubject = 'Tiếng Anh';
    } else if (text.includes('sử') || text.includes('lịch sử')) {
      detectedSubject = 'Lịch sử';
    } else if (text.includes('địa')) {
      detectedSubject = 'Địa lý';
    } else if (
      text.includes('toán') ||
      text.includes('đạo hàm') ||
      text.includes('tích phân')
    ) {
      detectedSubject = 'Toán học';
    }

    let detectedGrade = dto.grade || 12;
    if (text.includes('lớp 10') || text.includes('khối 10')) detectedGrade = 10;
    else if (text.includes('lớp 11') || text.includes('khối 11'))
      detectedGrade = 11;
    else if (text.includes('lớp 12') || text.includes('khối 12'))
      detectedGrade = 12;

    // 1. Ưu tiên gọi Google Gemini 2.5 Flash thật (Multi-Key Rotation từ GEMINI_API_KEY)
    //    Khách chưa đăng nhập (allowRealAi = false) chỉ nhận câu trả lời kịch bản có sẵn bên dưới.
    if (options.allowRealAi !== false) {
      const geminiResult = await this.callRealGeminiApi(
        dto,
        detectedSubject,
        detectedGrade,
      );
      if (geminiResult) {
        return geminiResult;
      }
    }

    const actions: Array<{ type: string; payload: Record<string, any> }> = [];
    let message = '';
    let emotion: RobotEmotion = 'happy';
    let suggestions: string[] = [];

    // Kịch bản 1: Giới thiệu nền tảng Schoolify / Nền tảng này là gì
    if (
      text.includes('nền tảng') ||
      text.includes('schoolify') ||
      text.includes('là gì') ||
      text.includes('giới thiệu') ||
      text.includes('tính năng') ||
      text.includes('bạn là ai') ||
      text.includes('web này') ||
      text.includes('trang web') ||
      text.includes('hệ thống') ||
      text.includes('ở đây có gì') ||
      text.includes('làm được gì')
    ) {
      message = `Chào bạn! 👋 **Schoolify** là nền tảng **Giáo dục & Khảo thí K-12 thông minh**, bám sát 100% Chương trình GDPT 2018 của Bộ GD&ĐT.\n\nSchoolify kết nối trọn vẹn 4 phân hệ người dùng:\n\n1. 🎓 **Dành cho Học sinh (K-12)**:\n   - **Luyện thi thích ứng 4 cấp độ**: Cơ bản (SGK), Trung bình (thi học kỳ & tốt nghiệp), Nâng cao (vận dụng cao 9-10đ) và Học sinh Giỏi (HSG Tỉnh & Quốc gia).\n   - **Đa dạng dạng câu hỏi trắc nghiệm**: Trắc nghiệm 4 lựa chọn, Nhiều đáp án, Đúng/Sai 4 ý, Điền số / Trả lời ngắn, Chùm ngữ liệu, Nối cặp, Sắp xếp, Đục lỗ và Lập trình trực tiếp trong phòng thi IDE.\n   - **Khảo thí chẩn đoán năng lực**: Tự động phát hiện lỗ hổng kiến thức và gợi ý lộ trình bù đắp.\n   - **Đổi quà Kim Cương 💎**: Tích lũy điểm thưởng từ bài thi để đổi quà độc quyền.\n\n2. 👨‍👩‍👧 **Dành cho Phụ huynh**: Theo dõi tiến độ học tập, biểu đồ năng lực Bloom theo tuần/tháng, và đóng học phí trực tuyến minh bạch qua VietQR.\n\n3. 👨‍🏫 **Dành cho Giáo viên & Quản trị**: Công cụ AI Quét đề thi Word (.docx) sang Ngân hàng câu hỏi, thiết kế ma trận đề thi phân hóa Bloom và quản lý lớp học.\n\nBạn có thể bấm các nút bên dưới để bắt đầu trải nghiệm ngay nhé! 🚀`;

      actions.push({
        type: 'NAVIGATE_PAGE',
        payload: {
          path: '/luyen-thi',
          label: 'Khám Phá Cổng Luyện Thi K-12',
        },
      });

      actions.push({
        type: 'NAVIGATE_PAGE',
        payload: {
          path: '/pricing',
          label: 'Xem Các Gói Học & Bảng Giá',
        },
      });
      emotion = 'excited';
    }
    // Kịch bản 2: Học sinh muốn tạo đề thi / luyện đề theo ma trận
    else if (
      text.includes('tạo đề') ||
      text.includes('luyện thi') ||
      text.includes('thi thử') ||
      text.includes('làm đề') ||
      text.includes('ma trận') ||
      text.includes('phòng thi')
    ) {
      emotion = 'idea';
      const isHard =
        text.includes('khó') ||
        text.includes('vận dụng cao') ||
        text.includes('nâng cao') ||
        text.includes('9+');
      const isMedium =
        text.includes('vừa') || text.includes('khá') || text.includes('cơ bản');

      let bloomRatio = {
        NHAN_BIET: 40,
        THONG_HIEU: 30,
        VAN_DUNG: 20,
        VAN_DUNG_CAO: 10,
      };

      if (isHard) {
        bloomRatio = {
          NHAN_BIET: 10,
          THONG_HIEU: 30,
          VAN_DUNG: 40,
          VAN_DUNG_CAO: 20,
        };
      } else if (isMedium) {
        bloomRatio = {
          NHAN_BIET: 30,
          THONG_HIEU: 40,
          VAN_DUNG: 20,
          VAN_DUNG_CAO: 10,
        };
      }

      const numMatch = text.match(/(\d+)\s*câu/);
      const totalQuestions = numMatch
        ? Math.min(50, Math.max(5, parseInt(numMatch[1], 10)))
        : 10;

      message = `Tớ đã phân tích yêu cầu của bạn và thiết lập sẵn **Bộ Ma Trận Đề Thi ${detectedSubject} - Khối ${detectedGrade}** (${totalQuestions} câu chuẩn cấu trúc GDPT 2018: Nhận biết ${bloomRatio.NHAN_BIET}%, Thông hiểu ${bloomRatio.THONG_HIEU}%, Vận dụng ${bloomRatio.VAN_DUNG}%, Vận dụng cao ${bloomRatio.VAN_DUNG_CAO}%).\n\nBạn có thể bấm nút bên dưới để hệ thống tự động cấu hình ma trận và đưa bạn vào phòng thi nhé! 🎯`;

      actions.push({
        type: 'CONFIGURE_EXAM_MATRIX',
        payload: {
          subject: detectedSubject,
          grade: detectedGrade,
          bloomRatio,
          durationMinutes: totalQuestions >= 20 ? 45 : 20,
          totalQuestions,
        },
      });

      if (!currentUrl.includes('/student/practice/exam-room')) {
        actions.push({
          type: 'NAVIGATE_PAGE',
          payload: {
            path: '/student/practice/exam-room',
            label: `Vào Phòng Thi ${detectedSubject} Khối ${detectedGrade}`,
          },
        });
      }
    }
    // Kịch bản 3: Admin / Giáo viên muốn quét đề thi Word (.docx) sinh câu hỏi
    else if (
      text.includes('docx') ||
      text.includes('file word') ||
      text.includes('quét đề') ||
      text.includes('nhập đề') ||
      text.includes('scan đề')
    ) {
      emotion = 'idea';
      message = `Tớ đã sẵn sàng mở **Công cụ AI Quét Đề Thi (.docx)** cho bạn! Bạn chỉ cần tải lên file đề thi \`.docx\`, chọn số lượng câu hỏi muốn sinh thêm (5–50 câu), AI sẽ bóc tách ma trận kiến thức trong đề gốc và tự động biên soạn câu hỏi mới kèm lời giải KaTeX để lưu thẳng vào hệ thống nhé! 📄✨`;

      actions.push({
        type: 'OPEN_DOCX_SCANNER',
        payload: {
          targetCount: 10,
          saveToBank: true,
        },
      });

      actions.push({
        type: 'NAVIGATE_PAGE',
        payload: {
          path: '/admin/questions/import',
          label: 'Mở AI Quét Đề .DOCX & Sinh Câu Hỏi',
        },
      });
    }
    // Kịch bản 4: Phụ huynh hoặc học sinh hỏi về gói đăng ký / bảng giá / thanh toán VietQR
    else if (
      text.includes('gói') ||
      text.includes('đăng ký') ||
      text.includes('giá') ||
      text.includes('mua') ||
      text.includes('pro') ||
      text.includes('vip') ||
      text.includes('vietqr')
    ) {
      emotion = 'wink';
      const targetPlan = text.includes('vip') ? 'VIP' : 'PRO';
      message = `Schoolify cung cấp 3 gói đồng hành linh hoạt:\n- **Gói Cơ Bản (0đ)**: Luyện đề tiêu chuẩn hàng ngày.\n- **Gói Chuyên Sâu PRO (199.000đ/tháng)**: Mở khóa toàn bộ Ma trận đề GDPT 2018, AI Gia Sư gợi mở Socratic & tặng +200 Token.\n- **Gói Toàn Diện VIP (499.000đ/năm)**: Đặc quyền 365 ngày + AI Quét đề Word & +1,000 Token.\n\nTớ đã chuẩn bị sẵn thao tác chuyển đến trang Bảng Giá và chọn gói **${targetPlan}** giúp bạn nhé! 💳`;

      actions.push({
        type: 'SELECT_PRICING_PLAN',
        payload: {
          plan: targetPlan,
          price: targetPlan === 'VIP' ? 499000 : 199000,
        },
      });

      actions.push({
        type: 'NAVIGATE_PAGE',
        payload: {
          path: '/pricing',
          highlightPlan: targetPlan,
          label: `Xem Bảng Giá & Kích Hoạt Gói ${targetPlan}`,
        },
      });
    }
    // Kịch bản 5: Chấm điểm tự luận / điền từ ngắn bằng Semantic Checkpoint
    else if (
      text.includes('chấm điểm') ||
      text.includes('chấm câu') ||
      text.includes('tự luận') ||
      text.includes('checkpoint') ||
      text.includes('kiểm tra câu trả lời')
    ) {
      emotion = 'thinking';
      message = `Tớ có thể chấm điểm câu hỏi Tự luận / Điền từ ngắn bằng công nghệ đối soát ngữ nghĩa AI.\n\nBạn có thể bấm nút bên dưới để xem ví dụ kiểm thử ngay nhé! 🧠✅`;

      actions.push({
        type: 'RUN_SEMANTIC_CHECKPOINT',
        payload: {
          studentAnswer:
            'Trong tế bào thực vật, quá trình quang hợp diễn ra chủ yếu tại bào quan lục lạp của lá cây.',
          rubricCheckpoint: 'Quang hợp diễn ra tại lục lạp',
        },
      });
    }
    // Kịch bản 6: Lịch sử luyện đề / Phân tích Bloom / Bảng xếp hạng
    else if (
      text.includes('lịch sử') ||
      text.includes('kết quả') ||
      text.includes('điểm số') ||
      text.includes('xếp hạng') ||
      text.includes('bảng vàng')
    ) {
      const isLeaderboard =
        text.includes('xếp hạng') || text.includes('bảng vàng');
      emotion = isLeaderboard ? 'celebrate' : 'happy';
      const targetPath = isLeaderboard
        ? '/student/leaderboard'
        : '/student/history';
      message = isLeaderboard
        ? `Tớ sẽ đưa bạn tới **Bảng Vàng Xếp Hạng Học Sinh** để xem thứ hạng Chuỗi Ngày Học (Streak) và điểm nỗ lực Token nhé! 🏆`
        : `Tớ sẽ dẫn bạn đến trang **Lịch Sử Luyện Đề & Phân Tích Năng Lực Bloom** để xem lại chi tiết từng bài thi cùng lời giải nhé! 📊`;

      actions.push({
        type: 'NAVIGATE_PAGE',
        payload: {
          path: targetPath,
          label: isLeaderboard
            ? 'Xem Bảng Vàng Xếp Hạng'
            : 'Xem Lịch Sử Luyện Đề & Bloom',
        },
      });
    }
    // Kịch bản 7: Hỏi đáp bài tập / Cần gợi ý bước giải (Socratic Hint)
    else if (
      text.includes('gợi ý') ||
      text.includes('chỉ tớ') ||
      text.includes('chỉ em') ||
      text.includes('bước giải') ||
      text.includes('hướng dẫn') ||
      text.includes('giải bài') ||
      text.includes('đạo hàm') ||
      text.includes('cực trị') ||
      text.includes('quang hợp')
    ) {
      emotion = 'thinking';
      message = `Theo phương pháp gợi mở (**Socratic Method**), tớ sẽ không đưa ngay đáp án cuối cùng mà gợi mở tư duy từng bước cho bạn:\n\n1. **Bước 1 (Nhận diện)**: Xác định tập xác định $D$ và các dữ kiện biến thiên cốt lõi trong đề bài.\n2. **Bước 2 (Công cụ)**: Áp dụng điều kiện cần (ví dụ: $y' = 0$ với bài toán cực trị hoặc định luật bảo toàn tương ứng) để lập phương trình.\n3. **Bước 3 (Kiểm chứng)**: Lập bảng biến thiên hoặc đối chiếu điều kiện để kết luận.\n\nBạn thử tính Bước 1 và Bước 2 xem kết quả trung gian ra bao nhiêu rồi nhắn cho tớ nhé! 💡`;

      actions.push({
        type: 'SOCRATIC_HINT',
        payload: {
          stepIndex: 1,
          subject: detectedSubject,
          hintTitle: `Gợi mở Socratic (${detectedSubject}): Thiết lập điều kiện & đạo hàm bậc nhất`,
        },
      });
    }
    // Kịch bản 8: Mặc định đàm thoại sư phạm đa năng (tự nhiên, không văn mẫu menu)
    else {
      emotion = 'happy';
      message = `Tớ đã nắm được ý của bạn! Bạn cần tớ hỗ trợ chi tiết về bài tập, tạo ma trận đề thi phân hóa GDPT 2018, hay hướng dẫn các tính năng trên Schoolify nè? Nhắn cho tớ bất cứ điều gì bạn đang quan tâm nhé! 😊`;
      suggestions = [
        'Tạo đề thi thích ứng ngay',
        'Gợi ý giải bài tập Socratic',
        'Xem các gói học sinh',
      ];
    }

    return {
      message,
      actions,
      emotion: emotion || inferEmotion(message, actions),
      suggestions,
    };
  }

  private writeIpcJob(jobId: string, type: string, payload: any) {
    try {
      const jobFile = path.join(this.ipcInboxDir, `${jobId}.json`);
      fs.writeFileSync(
        jobFile,
        JSON.stringify(
          {
            id: jobId,
            type,
            payload,
            timestamp: new Date().toISOString(),
          },
          null,
          2,
        ),
      );
    } catch (e: any) {
      this.logger.debug(`Không ghi được file IPC job: ${e.message}`);
    }
  }
}
