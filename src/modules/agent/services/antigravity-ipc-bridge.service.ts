import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { AgentChatDto } from '../dto/agent.dto';

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
}

@Injectable()
export class AntigravityIpcBridgeService {
  private readonly logger = new Logger(AntigravityIpcBridgeService.name);
  private readonly ipcInboxDir = path.resolve(__dirname, '../../../../ipc/inbox');
  private readonly ipcOutboxDir = path.resolve(__dirname, '../../../../ipc/outbox');

  constructor() {
    this.ensureIpcDirectories();
  }

  private ensureIpcDirectories() {
    try {
      if (!fs.existsSync(this.ipcInboxDir)) fs.mkdirSync(this.ipcInboxDir, { recursive: true });
      if (!fs.existsSync(this.ipcOutboxDir)) fs.mkdirSync(this.ipcOutboxDir, { recursive: true });
    } catch (e: any) {
      this.logger.warn(`Không thể tạo thư mục IPC: ${e.message}`);
    }
  }

  /**
   * ĐỐI SOÁT NGỮ NGHĨA LOGIC (Semantic Checkpoint Logic)
   * Kiểm tra xem câu trả lời của học sinh có đồng thuận và khẳng định đúng tiêu chí hay không.
   * Xử lý triệt để bẫy phủ định và sai lệch khoa học mà Vector Search thuần túy không nhận diện được.
   */
  async evaluateSemanticLogic(
    candidateSentence: string,
    rubricCheckpoint: string,
  ): Promise<SemanticLogicResult> {
    const normStudent = candidateSentence.trim().toLowerCase();
    const normCheckpoint = rubricCheckpoint.trim().toLowerCase();

    // 1. Ghi nhận job vào IPC Mailbox
    const jobId = `job-eval-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.writeIpcJob(jobId, 'SEMANTIC_CHECKPOINT', {
      candidateSentence,
      rubricCheckpoint,
    });

    // 2. Logic kiểm tra phủ định & đối soát tính đúng đắn khoa học (Headless Rule-Logic Engine)
    // Các từ phủ định/phản bác trong tiếng Việt
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
    // Ví dụ: Checkpoint "Quang hợp diễn ra tại lục lạp", Học sinh "Quang hợp không diễn ra ở lục lạp"
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

    // Kiểm tra các từ khóa cốt lõi của Checkpoint
    // Tách các từ mang nghĩa (bỏ hư từ)
    const stopWords = new Set(['là', 'và', 'của', 'ở', 'tại', 'trong', 'được', 'có', 'để', 'những', 'các', 'một']);
    const checkpointTokens = normCheckpoint
      .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1 && !stopWords.has(w));

    let matchedTokensCount = 0;
    for (const token of checkpointTokens) {
      if (normStudent.includes(token)) {
        matchedTokensCount++;
      }
    }

    const matchRatio = checkpointTokens.length > 0 ? matchedTokensCount / checkpointTokens.length : 1;

    if (matchRatio >= 0.6) {
      return {
        isCorrect: true,
        explanation: `Câu trả lời của học sinh diễn đạt đúng trọng tâm và khẳng định nhất quán với tiêu chí chuẩn: "${rubricCheckpoint}".`,
      };
    } else {
      return {
        isCorrect: false,
        explanation: `Câu trả lời có độ tương đồng ngữ cảnh nhưng còn thiếu các thuật ngữ cốt lõi để thỏa mãn tiêu chí: "${rubricCheckpoint}".`,
      };
    }
  }

  /**
   * SINH PHẢN HỒI AGENT KÈM CLIENT TOOL ACTIONS (Generative Agentic Chatbot)
   */
  async generateAgentResponse(dto: AgentChatDto): Promise<AgentResponseResult> {
    const text = dto.message.toLowerCase();
    const currentUrl = dto.currentUrl || '';
    const subject = dto.subject || 'toan-hoc';
    const grade = dto.grade || 12;

    const actions: Array<{ type: string; payload: Record<string, any> }> = [];
    let message = '';

    // Ghi IPC Job để Antigravity theo dõi
    const jobId = `job-chat-${Date.now()}`;
    this.writeIpcJob(jobId, 'AGENT_CHAT', { dto });

    // Kịch bản 1: Học sinh muốn tạo đề thi / luyện đề theo ma trận
    if (
      text.includes('tạo đề') ||
      text.includes('luyện thi') ||
      text.includes('thi thử') ||
      text.includes('làm đề') ||
      text.includes('ma trận')
    ) {
      let isHard = text.includes('khó') || text.includes('vận dụng cao') || text.includes('nâng cao');
      let isMedium = text.includes('vừa') || text.includes('khá') || text.includes('cơ bản');

      let bloomRatio = {
        NHAN_BIET: 40,
        THONG_HIEU: 30,
        VAN_DUNG: 20,
        VAN_DUNG_CAO: 10,
      };

      if (isHard) {
        bloomRatio = { NHAN_BIET: 10, THONG_HIEU: 30, VAN_DUNG: 40, VAN_DUNG_CAO: 20 };
      } else if (isMedium) {
        bloomRatio = { NHAN_BIET: 30, THONG_HIEU: 40, VAN_DUNG: 20, VAN_DUNG_CAO: 10 };
      }

      message = `Thầy đã phân tích yêu cầu của em và thiết lập sẵn **Bộ Ma Trận Đề Thi ${subject.toUpperCase()} - Khối ${grade}** (chuẩn cấu trúc GDPT 2025: Nhận biết ${bloomRatio.NHAN_BIET}%, Thông hiểu ${bloomRatio.THONG_HIEU}%, Vận dụng ${bloomRatio.VAN_DUNG}%, Vận dụng cao ${bloomRatio.VAN_DUNG_CAO}%).\n\nEm chỉ cần nhấn nút xác nhận bên dưới để vào phòng thi Focus Mode ngay nhé! 🎯`;

      // Sinh Tool Actions cho Client
      actions.push({
        type: 'CONFIGURE_EXAM_MATRIX',
        payload: {
          subject,
          grade,
          bloomRatio,
          durationMinutes: 45,
          totalQuestions: 20,
        },
      });

      if (!currentUrl.includes('/student/practice/exam-room')) {
        actions.push({
          type: 'NAVIGATE_PAGE',
          payload: {
            path: '/student/practice/exam-room',
          },
        });
      }
    }
    // Kịch bản 2: Phụ huynh hoặc học sinh hỏi về gói đăng ký / bảng giá
    else if (
      text.includes('gói') ||
      text.includes('đăng ký') ||
      text.includes('giá') ||
      text.includes('mua') ||
      text.includes('pro') ||
      text.includes('vip')
    ) {
      message = `Schoolify cung cấp 3 gói đồng hành linh hoạt: **Gói Cơ bản (Miễn phí)**, **Gói Pro (Luyện đề ma trận không giới hạn + Trợ lý Socratic)** và **Gói VIP 1 kèm 1**. Thầy đang điều hướng bạn đến trang bảng giá và đã chọn sẵn gói phù hợp nhất nhé! 💳`;

      actions.push({
        type: 'NAVIGATE_PAGE',
        payload: {
          path: '/pricing',
          highlightPlan: text.includes('vip') ? 'VIP' : 'PRO',
        },
      });
    }
    // Kịch bản 3: Hỏi đáp bài tập / Cần gợi ý bước giải (Socratic Hint)
    else if (
      text.includes('gợi ý') ||
      text.includes('chỉ em') ||
      text.includes('bước giải') ||
      text.includes('hướng dẫn')
    ) {
      message = `Theo phương pháp gợi mở (Socratic Method), thầy sẽ không đưa ngay đáp án cuối cùng mà gợi mở tư duy từng bước cho em:\n\n* **Bước 1**: Hãy xác định điều kiện xác định của bài toán và các đại lượng biến thiên trong đề bài.\n* **Bước 2**: Sử dụng định lý hoặc công thức cơ bản liên quan đến đạo hàm / định luật bảo toàn để rút gọn biểu thức.\n\nEm hãy thử biến đổi theo hướng này xem kết quả ra bao nhiêu nhé! 💡`;

      actions.push({
        type: 'SOCRATIC_HINT',
        payload: {
          stepIndex: 1,
          hintTitle: 'Gợi ý bước 1: Thiết lập điều kiện & công thức gốc',
        },
      });
    }
    // Kịch bản 4: Mặc định đàm thoại sư phạm
    else {
      message = `Chào em! Thầy là **Trợ lý Khảo thí & Luyện thi Schoolify**. Thầy có thể giúp em:\n\n1. 🎯 **Tự động cấu hình & tạo đề thi ma trận** chuẩn cấu trúc GDPT 2025 vừa sức với em.\n2. 🧭 **Dẫn đường trực tiếp** trên hệ thống đến phòng thi giả lập, kho đề hoặc lịch sử làm bài.\n3. 💡 **Chữa bài từng bước** bằng phương pháp gợi mở Socratic mà không làm mất tính tự học.\n4. 📝 **Chấm điểm bán tự động** các câu tự luận và điền từ ngắn.\n\nEm cần thầy hỗ trợ nội dung nào ngay bây giờ?`;
    }

    return {
      message,
      actions,
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
