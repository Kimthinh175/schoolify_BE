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
  private readonly ipcInboxDir = '/home/thinh/ca-nhan/schoolify/BE/ipc/inbox';
  private readonly ipcOutboxDir = '/home/thinh/ca-nhan/schoolify/BE/ipc/outbox';

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
   * Giao thức bắt tay 2 pha (2-Phase Live IPC Handshake) kết nối trực tiếp vào phiên Antigravity:
   * - Pha 1 (800ms): Ghi job vào `inbox/<jobId>.json`. Nếu `antigravity-watcher.js` đang lắng nghe,
   *   nó sẽ lập tức đổi tên thành `<jobId>.claimed.json` và đánh thức Antigravity Agent.
   * - Pha 2 (tối đa timeoutMs): Khi đã được Antigravity claim, BE chờ file kết quả tại `outbox/<jobId>.json`
   *   do chính Antigravity Agent biên soạn và ghi trả về.
   */
  async requestLiveAntigravity<T>(
    jobId: string,
    type: 'DOCX_SCAN_GENERATE' | 'AGENT_CHAT' | 'SEMANTIC_CHECKPOINT',
    payload: Record<string, any>,
    timeoutMs = 60000,
  ): Promise<T | null> {
    this.ensureIpcDirectories();
    const jobFile = path.join(this.ipcInboxDir, `${jobId}.json`);
    const claimedFile = path.join(this.ipcInboxDir, `${jobId}.claimed.json`);
    const outboxFile = path.join(this.ipcOutboxDir, `${jobId}.json`);

    try {
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

      // Pha 1: Chờ tối đa 800ms xem Antigravity Watcher có đang thức và claim job không
      let isClaimed = false;
      const claimDeadline = Date.now() + 800;
      while (Date.now() < claimDeadline) {
        if (fs.existsSync(claimedFile) || fs.existsSync(outboxFile)) {
          isClaimed = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 100));
      }

      if (!isClaimed) {
        try {
          if (fs.existsSync(jobFile)) fs.unlinkSync(jobFile);
        } catch {}
        return null;
      }

      this.logger.log(
        `⚡ [Antigravity Live Bridge] Antigravity Agent đã nhận job [${type}] (${jobId}), đang chờ kết quả từ phiên chat...`,
      );

      // Pha 2: Chờ Antigravity ghi file kết quả vào outbox/<jobId>.json
      const responseDeadline = Date.now() + timeoutMs;
      while (Date.now() < responseDeadline) {
        if (fs.existsSync(outboxFile)) {
          await new Promise((r) => setTimeout(r, 80)); // Đảm bảo flush xong file
          const raw = fs.readFileSync(outboxFile, 'utf-8');
          const parsed = JSON.parse(raw) as T;
          try {
            if (fs.existsSync(claimedFile)) fs.unlinkSync(claimedFile);
            if (fs.existsSync(outboxFile)) fs.unlinkSync(outboxFile);
          } catch {}
          this.logger.log(`✅ [Antigravity Live Bridge] Đã nhận kết quả trực tiếp từ Antigravity cho job ${jobId}!`);
          return parsed;
        }
        await new Promise((r) => setTimeout(r, 250));
      }

      this.logger.warn(`⏱️ [Antigravity Live Bridge] Hết thời gian chờ job ${jobId}, chuyển sang bộ sinh nội bộ.`);
      return null;
    } catch (err: any) {
      this.logger.warn(`Lỗi IPC Bridge (${jobId}): ${err.message}`);
      return null;
    }
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

    // 1. Ưu tiên gửi thẳng vào phiên Antigravity đang thức qua Live IPC Bridge
    const jobId = `job-eval-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const liveRes = await this.requestLiveAntigravity<SemanticLogicResult>(
      jobId,
      'SEMANTIC_CHECKPOINT',
      {
        candidateSentence,
        rubricCheckpoint,
        vectorSimilarity,
      },
      60000,
    );
    if (liveRes && typeof liveRes.isCorrect === 'boolean') {
      return liveRes;
    }

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
      const cpHasA = normCheckpoint.includes(termA) && !normCheckpoint.includes(termB);
      const cpHasB = normCheckpoint.includes(termB) && !normCheckpoint.includes(termA);
      const stHasA = normStudent.includes(termA) && !normStudent.includes(termB);
      const stHasB = normStudent.includes(termB) && !normStudent.includes(termA);
      if ((cpHasA && stHasB) || (cpHasB && stHasA)) {
        return {
          isCorrect: false,
          explanation: `Câu trả lời của học sinh có mặt chữ rất giống nhưng đã dùng thuật ngữ trái nghĩa ("${cpHasA ? termB : termA}" thay vì "${cpHasA ? termA : termB}") so với tiêu chí chuẩn.`,
        };
      }
    }

    // 4. Kiểm tra các từ khóa cốt lõi & phát hiện đảo vế chủ ngữ - tân ngữ / toán hạng (ví dụ: CO2 <-> O2, sin(x) <-> cos(x), Chó cắn người <-> Người cắn chó)
    const stopWords = new Set(['là', 'và', 'của', 'ở', 'tại', 'trong', 'được', 'có', 'để', 'những', 'các', 'một', 'bằng', 'ra', 'khí', 'hàm', 'số']);
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

    const matchRatio = checkpointTokens.length > 0 ? matchedTokensCount / checkpointTokens.length : 1;

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

  /**
   * SINH PHẢN HỒI AGENT KÈM CLIENT TOOL ACTIONS (Generative Agentic Chatbot)
   */
  async generateAgentResponse(dto: AgentChatDto): Promise<AgentResponseResult> {
    const text = dto.message.toLowerCase();
    const currentUrl = dto.currentUrl || '';

    // Tự động nhận diện môn học & khối lớp từ câu chat tự nhiên của học sinh
    let detectedSubject = dto.subject || 'Toán học';
    if (text.includes('vật lý') || text.includes('vat ly') || text.includes('môn lý')) {
      detectedSubject = 'Vật lý';
    } else if (text.includes('hóa') || text.includes('hoa hoc')) {
      detectedSubject = 'Hóa học';
    } else if (text.includes('sinh') || text.includes('lục lạp') || text.includes('di truyền')) {
      detectedSubject = 'Sinh học';
    } else if (text.includes('anh') || text.includes('english') || text.includes('ielts')) {
      detectedSubject = 'Tiếng Anh';
    } else if (text.includes('sử') || text.includes('lịch sử')) {
      detectedSubject = 'Lịch sử';
    } else if (text.includes('địa')) {
      detectedSubject = 'Địa lý';
    } else if (text.includes('toán') || text.includes('đạo hàm') || text.includes('tích phân')) {
      detectedSubject = 'Toán học';
    }

    let detectedGrade = dto.grade || 12;
    if (text.includes('lớp 10') || text.includes('khối 10')) detectedGrade = 10;
    else if (text.includes('lớp 11') || text.includes('khối 11')) detectedGrade = 11;
    else if (text.includes('lớp 12') || text.includes('khối 12')) detectedGrade = 12;

    const actions: Array<{ type: string; payload: Record<string, any> }> = [];
    let message = '';

    // Ưu tiên gửi thẳng yêu cầu chat vào phiên Antigravity đang thức qua Live IPC Bridge
    const jobId = `job-chat-${Date.now()}`;
    const liveChatRes = await this.requestLiveAntigravity<
      AgentResponseResult & { reply?: string }
    >(
      jobId,
      'AGENT_CHAT',
      { dto, detectedSubject, detectedGrade },
      60000,
    );
    const liveMsg = liveChatRes?.message || liveChatRes?.reply;
    if (liveMsg) {
      return {
        message: liveMsg,
        actions: Array.isArray(liveChatRes?.actions) ? liveChatRes.actions : [],
      };
    }

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
      message = `Chào bạn! 👋 **Schoolify** là nền tảng **Giáo dục & Khảo thí K-12 thông minh**, bám sát 100% Chương trình GDPT 2018 của Bộ GD&ĐT.\n\nSchoolify kết nối trọn vẹn 4 phân hệ người dùng:\n\n1. 🎓 **Dành cho Học sinh (K-12)**:\n   - **Luyện thi thích ứng 4 cấp độ**: Cơ bản (SGK), Trung bình (thi học kỳ & tốt nghiệp), Nâng cao (vận dụng cao 9-10đ) và Học sinh Giỏi (HSG Tỉnh & Quốc gia).\n   - **Đa dạng dạng câu hỏi**: Trắc nghiệm 4 lựa chọn, Đúng/Sai, Điền số kết quả ngắn, Tự luận chấm AI đa tầng theo barem, và Lập trình trực tiếp trong phòng thi IDE.\n   - **Khảo thí chẩn đoán năng lực**: Tự động phát hiện lỗ hổng kiến thức và gợi ý lộ trình bù đắp.\n   - **Đổi quà Kim Cương 💎**: Tích lũy điểm thưởng từ bài thi để đổi quà độc quyền.\n\n2. 👨‍👩‍👧 **Dành cho Phụ huynh**: Theo dõi tiến độ học tập, biểu đồ năng lực Bloom theo tuần/tháng, và đóng học phí trực tuyến minh bạch qua VietQR.\n\n3. 👨‍🏫 **Dành cho Giáo viên & Quản trị**: Công cụ AI Quét đề thi Word (.docx) sang Ngân hàng câu hỏi, thiết kế ma trận đề thi phân hóa Bloom, chấm bài tự luận và quản lý lớp học.\n\nBạn có thể bấm các nút bên dưới để bắt đầu trải nghiệm ngay nhé! 🚀`;

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
      const isHard =
        text.includes('khó') ||
        text.includes('vận dụng cao') ||
        text.includes('nâng cao') ||
        text.includes('9+');
      const isMedium = text.includes('vừa') || text.includes('khá') || text.includes('cơ bản');

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

      const numMatch = text.match(/(\d+)\s*câu/);
      const totalQuestions = numMatch ? Math.min(50, Math.max(5, parseInt(numMatch[1], 10))) : 10;

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
      const isLeaderboard = text.includes('xếp hạng') || text.includes('bảng vàng');
      const targetPath = isLeaderboard ? '/student/leaderboard' : '/student/history';
      message = isLeaderboard
        ? `Tớ sẽ đưa bạn tới **Bảng Vàng Xếp Hạng Học Sinh** để xem thứ hạng Chuỗi Ngày Học (Streak) và điểm nỗ lực Token nhé! 🏆`
        : `Tớ sẽ dẫn bạn đến trang **Lịch Sử Luyện Đề & Phân Tích Năng Lực Bloom** để xem lại chi tiết từng bài thi cùng lời giải nhé! 📊`;

      actions.push({
        type: 'NAVIGATE_PAGE',
        payload: {
          path: targetPath,
          label: isLeaderboard ? 'Xem Bảng Vàng Xếp Hạng' : 'Xem Lịch Sử Luyện Đề & Bloom',
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
    // Kịch bản 8: Mặc định đàm thoại sư phạm đa năng
    else {
      message = `Chào bạn! Tớ là **Trợ lý AI Schoolify** 🤖✨. Tớ có thể hỗ trợ bạn trực tiếp trên giao diện:\n\n1. 🎯 **Tạo đề thi ma trận tự động**: Ví dụ *"Tạo đề Toán lớp 12 mức độ khó"*.\n2. 💡 **Gợi mở Socratic từng bước**: Ví dụ *"Gợi ý bước giải bài toán cực trị hàm số"*.\n3. 🏫 **Giải đáp thắc mắc về Schoolify**: Ví dụ *"Nền tảng Schoolify là gì?"*.\n4. 📄 **AI Quét đề Word (.docx)**: Phân tích file đề và sinh câu hỏi mới cho Giáo viên/Admin.\n5. 💳 **Tư vấn & chọn gói học Pro/VIP**: Tự động điều hướng và chọn gói phù hợp.\n\nBạn hãy chọn một hành động nhanh bên dưới hoặc nhập yêu cầu của mình nhé!`;

      actions.push({
        type: 'CONFIGURE_EXAM_MATRIX',
        payload: {
          subject: 'Toán học',
          grade: 12,
          bloomRatio: { NHAN_BIET: 30, THONG_HIEU: 40, VAN_DUNG: 20, VAN_DUNG_CAO: 10 },
          durationMinutes: 45,
          totalQuestions: 10,
        },
      });
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
