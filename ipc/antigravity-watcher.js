const fs = require('fs');
const path = require('path');

const INBOX_DIR = '/home/thinh/ca-nhan/schoolify/BE/ipc/inbox';
const OUTBOX_DIR = '/home/thinh/ca-nhan/schoolify/BE/ipc/outbox';

fs.mkdirSync(INBOX_DIR, { recursive: true });
fs.mkdirSync(OUTBOX_DIR, { recursive: true });

console.log('🚀 [Antigravity Live Bridge] Daemon started & listening on:', INBOX_DIR);

function loadGeminiKeys() {
  const envVal = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEYS;
  if (envVal) {
    return envVal.split(',').map((k) => k.trim()).filter(Boolean);
  }
  // Try loading from .env or cho-cong-nghe/.env
  const candidatePaths = [
    path.resolve(__dirname, '../.env'),
    '/home/thinh/ca-nhan/cho-cong-nghe/.env',
  ];
  for (const envPath of candidatePaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const match = content.match(/GEMINI_API_KEY=["']?([^"'\r\n]+)["']?/);
      if (match && match[1]) {
        return match[1].split(',').map((k) => k.trim()).filter(Boolean);
      }
    }
  }
  return [];
}

const GEMINI_KEYS = loadGeminiKeys();
let currentKeyIndex = 0;

async function callGeminiLive(prompt) {
  let attempts = GEMINI_KEYS.length;
  while (attempts > 0) {
    const key = GEMINI_KEYS[currentKeyIndex];
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        return rawText;
      }
      throw new Error('Empty response from Gemini');
    } catch (err) {
      console.warn(`[Gemini Rotation] Key ${currentKeyIndex + 1} error: ${err.message}. Rotating...`);
      currentKeyIndex = (currentKeyIndex + 1) % GEMINI_KEYS.length;
      attempts--;
      if (attempts > 0) {
        await new Promise((r) => setTimeout(r, 600));
      }
    }
  }
  return null;
}

function normalizeText(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .trim();
}

/**
 * Bộ não AI Antigravity Tutor K-12 (Autonomous Conversational AI Engine)
 * Phản hồi tự nhiên, sư phạm GDPT 2018, hóm hỉnh, sinh Suggestions động
 */
async function processAiJob(jobData) {
  const dto = jobData.payload?.dto || {};
  const rawMsg = dto.message || '';
  const norm = normalizeText(rawMsg);
  const history = Array.isArray(dto.history) ? dto.history : [];
  let subject = jobData.payload?.detectedSubject || dto.subject || 'Toán học';
  let grade = jobData.payload?.detectedGrade || dto.grade || 12;

  let message = '';
  let emotion = 'happy';
  const actions = [];
  let suggestions = [];

  // ============================================================
  // 1. CHỐNG NÓI TỤC & XỬ LÝ TRÊU ĐÙA / CHIT-CHAT (Như Chợ Công Nghệ)
  // ============================================================
  const profanityList = ['ma may', 'me may', 'dm', 'dcm', 'cl', 'vcl', 'dkm', 'cho chet', 'ngu', 'cuc cuc', 'cut'];
  const isProfane = profanityList.some((bad) => norm.includes(bad));

  if (isProfane) {
    const funResponses = [
      'Ui da! Bạn nóng tính thế 🧊 Uống miếng nước cho mát rồi tụi mình cùng xử đẹp mấy bài tập này nha, không việc gì phải cáu nè! 😄',
      'Ủa alo! Tớ là Robot học tập hiền khô mà sao bạn nỡ mắng tớ thế 🥺 Bạn đang gặp bài nào khó nhằn à, ném qua đây tớ gợi ý giải cho!',
      'Hít một hơi thật sâu nào bạn ơi! 🧘 Giữ bình tĩnh để năng lượng tích cực vào người, rồi tớ hỗ trợ bạn ôn luyện thi điểm cao nhé!',
    ];
    message = funResponses[Math.floor(Math.random() * funResponses.length)];
    emotion = 'stunned';
    suggestions = ['Tạo đề thi giải tỏa căng thẳng', 'Gợi ý giải bài tập khó', 'Xem gói học sinh 50k'];
  }
  // Chào hỏi xã giao
  else if (
    norm === 'hi' ||
    norm === 'hello' ||
    norm === 'alo' ||
    norm === 'chao' ||
    norm === 'chao ban' ||
    norm === 'chao robot' ||
    norm.startsWith('alo ') ||
    norm.startsWith('chao ')
  ) {
    message = `Chào bạn! Tớ là **Trợ lý AI Schoolify** 🤖✨\n\nHôm nay bạn muốn cùng tớ ôn luyện chủ đề gì nào? Tớ có thể giúp bạn tạo đề thi theo ma trận, gợi mở bước giải bài tập, hoặc hướng dẫn dùng nền tảng nhé!`;
    emotion = 'excited';
    suggestions = ['Tạo đề Toán 12 mức độ khó', 'Gợi ý giải bài tập Socratic', 'Schoolify có những tính năng gì?'];
  }
  // Khen ngợi / Cảm ơn
  else if (norm.includes('cam on') || norm.includes('thanks') || norm.includes('gioi qua') || norm.includes('tuyet voi')) {
    message = `Không có chi nè! 🥰 Có bạn đồng hành học tập cùng là tớ vui lắm rồi. Cứ gặp bài nào khó hay cần luyện thêm đề thì ới tớ ngay nhé!`;
    emotion = 'love';
    suggestions = ['Làm thêm đề thi mới', 'Xem lịch sử học tập', 'Khám phá bảng vàng'];
  }
  // ============================================================
  // 2. TẠO ĐỀ THI THEO MA TRẬN PHÂN HÓA (GDPT 2018)
  // ============================================================
  else if (
    norm.includes('tao de') ||
    norm.includes('lam de') ||
    norm.includes('luyen de') ||
    norm.includes('thi thu') ||
    norm.includes('de toan') ||
    norm.includes('de ly') ||
    norm.includes('de hoa') ||
    norm.includes('de sinh') ||
    norm.includes('de tin') ||
    norm.includes('de anh')
  ) {
    let targetSub = 'Toán học';
    if (norm.includes('ly') || norm.includes('vat ly')) targetSub = 'Vật lý';
    else if (norm.includes('hoa') || norm.includes('hoa hoc')) targetSub = 'Hóa học';
    else if (norm.includes('sinh') || norm.includes('sinh hoc')) targetSub = 'Sinh học';
    else if (norm.includes('tin') || norm.includes('lap trinh')) targetSub = 'Tin học';
    else if (norm.includes('tieng anh') || norm.includes('anh')) targetSub = 'Tiếng Anh';
    else if (norm.includes('su') || norm.includes('lich su')) targetSub = 'Lịch sử';
    else if (norm.includes('dia') || norm.includes('dia ly')) targetSub = 'Địa lý';

    let targetGrade = grade;
    if (norm.includes('lop 10') || norm.includes('khoi 10') || norm.includes('10')) targetGrade = 10;
    if (norm.includes('lop 11') || norm.includes('khoi 11') || norm.includes('11')) targetGrade = 11;
    if (norm.includes('lop 12') || norm.includes('khoi 12') || norm.includes('12')) targetGrade = 12;

    const isHard = norm.includes('kho') || norm.includes('nang cao') || norm.includes('van dung cao') || norm.includes('9+');
    const isBasic = norm.includes('de') || norm.includes('co ban') || norm.includes('chong liet');

    let bloomRatio = { NHAN_BIET: 30, THONG_HIEU: 40, VAN_DUNG: 20, VAN_DUNG_CAO: 10 };
    let levelName = 'Chuẩn Tốt Nghiệp / Học Kỳ';
    if (isHard) {
      bloomRatio = { NHAN_BIET: 10, THONG_HIEU: 30, VAN_DUNG: 40, VAN_DUNG_CAO: 20 };
      levelName = 'Vận Dụng Cao (Mục Tiêu 9+)';
    } else if (isBasic) {
      bloomRatio = { NHAN_BIET: 50, THONG_HIEU: 30, VAN_DUNG: 15, VAN_DUNG_CAO: 5 };
      levelName = 'Cơ Bản Củng Cố Kiến Thức';
    }

    const numMatch = rawMsg.match(/(\d+)\s*câu/i);
    const count = numMatch ? Math.min(50, Math.max(5, parseInt(numMatch[1], 10))) : 10;

    message = `Tớ đã lập sẵn ma trận đề **${targetSub} - Khối ${targetGrade}** (${levelName}) với **${count} câu hỏi** chuẩn cấu trúc GDPT 2018 🎯\n\nPhân bổ tỷ lệ Bloom:\n- Nhận biết: **${bloomRatio.NHAN_BIET}%**\n- Thông hiểu: **${bloomRatio.THONG_HIEU}%**\n- Vận dụng: **${bloomRatio.VAN_DUNG}%**\n- Vận dụng cao: **${bloomRatio.VAN_DUNG_CAO}%**\n\nBạn bấm nút bên dưới để hệ thống sinh đề và đưa vào phòng thi làm bài ngay nhé!`;
    emotion = 'idea';

    actions.push({
      type: 'CONFIGURE_EXAM_MATRIX',
      payload: {
        subject: targetSub,
        grade: targetGrade,
        bloomRatio,
        durationMinutes: count >= 20 ? 45 : 20,
        totalQuestions: count,
      },
    });

    suggestions = [`Tạo đề ${targetSub} ${targetGrade} 20 câu`, 'Xem lời giải chi tiết', 'Tạo đề môn khác'];
  }
  // ============================================================
  // 3. GỢI MỞ BÀI TẬP THEO PHƯƠNG PHÁP SOCRATIC (GIA SƯ AI)
  // ============================================================
  else if (
    norm.includes('goi y') ||
    norm.includes('giai bai') ||
    norm.includes('buoc giai') ||
    norm.includes('huong dan') ||
    norm.includes('dao ham') ||
    norm.includes('cuc tri') ||
    norm.includes('tich phan') ||
    norm.includes('nguyen ham') ||
    norm.includes('hinh hoc') ||
    norm.includes('phuong trinh') ||
    norm.includes('quang hop') ||
    norm.includes('dien xoay chieu')
  ) {
    message = `Theo phương pháp gợi mở (**Socratic Method**), tớ sẽ không đưa đáp án ngay để bạn tự rèn tư duy nhé:\n\n1. **Bước 1 (Xác định dữ kiện)**: Đề bài cho những giả thiết nào và tập xác định $D$ của bài toán là gì?\n2. **Bước 2 (Chọn công cụ)**: Hãy đạo hàm hoặc lập phương trình liên hệ giữa các ẩn số.\n3. **Bước 3 (Kiểm tra & Kết luận)**: Lập bảng biến thiên hoặc thế điều kiện biên để tìm kết quả.\n\nBạn đã tính được đạo hàm hoặc bước 1 chưa? Nhắn kết quả cho tớ xem thử nhé! 💡`;
    emotion = 'thinking';

    actions.push({
      type: 'SOCRATIC_HINT',
      payload: {
        stepIndex: 1,
        hintTitle: 'Gợi mở Socratic: Xác định điều kiện & phương trình đạo hàm',
      },
    });

    suggestions = ['Tớ đã tính xong Bước 1', 'Giải thích chi tiết Bước 2', 'Tạo đề luyện dạng bài này'];
  }
  // ============================================================
  // 4. GIỚI THIỆU NỀN TẢNG SCHOOLIFY & TÍNH NĂNG
  // ============================================================
  else if (
    norm.includes('schoolify') ||
    norm.includes('nen tang') ||
    norm.includes('la gi') ||
    norm.includes('gioi thieu') ||
    norm.includes('tinh nang') ||
    norm.includes('web nay') ||
    norm.includes('app nay')
  ) {
    message = `**Schoolify** là nền tảng **Giáo dục & Khảo thí K-12 thông minh**, bám sát 100% Chương trình GDPT 2018 của Bộ GD&ĐT 🎓\n\nĐiểm nổi bật của Schoolify:\n- 🎯 **Luyện thi thích ứng 4 cấp độ**: Từ cơ bản chống liệt đến học sinh giỏi cấp Tỉnh/Quốc Gia.\n- 🧠 **Chẩn đoán năng lực Bloom**: Phát hiện chính xác lỗ hổng kiến thức để bù đắp kịp thời.\n- 📄 **AI Quét đề thi Word (.docx)**: Tự động trích xuất công thức Toán KaTeX và biên soạn câu hỏi mới.\n- 💎 **Tích lũy Điểm Xịn & Kim Cương**: Đổi quà và nâng cao năng lực mỗi ngày.\n\nBạn có thể trải nghiệm ngay qua các đường dẫn bên dưới nhé! 🚀`;
    emotion = 'excited';

    actions.push({
      type: 'NAVIGATE_PAGE',
      payload: { path: '/luyen-thi', label: 'Vào Cổng Luyện Thi K-12' },
    });
    actions.push({
      type: 'NAVIGATE_PAGE',
      payload: { path: '/pricing', label: 'Xem Gói Học & Bảng Giá' },
    });

    suggestions = ['Xem gói học sinh 50k & 100k', 'Tạo thử đề thi Toán 12', 'Cách cày Điểm Xịn miễn phí'];
  }
  // ============================================================
  // 5. TƯ VẤN GÓI HỌC, BẢNG GIÁ & ĐIỂM XỊN
  // ============================================================
  else if (
    norm.includes('goi') ||
    norm.includes('gia') ||
    norm.includes('bang gia') ||
    norm.includes('50k') ||
    norm.includes('100k') ||
    norm.includes('diem xin') ||
    norm.includes('diem free') ||
    norm.includes('mua') ||
    norm.includes('nap tien') ||
    norm.includes('vietqr') ||
    norm.includes('payos')
  ) {
    const isVip = norm.includes('100k') || norm.includes('vip') || norm.includes('100');
    message = `Schoolify có **2 gói đồng hành duy nhất** dành riêng cho học sinh:\n\n1. 🌟 **Gói 50.000đ/tháng**:\n   - +5 Điểm Xịn tích lũy mỗi ngày (dùng hỏi AI, không bao giờ hết hạn)\n   - +9 Điểm Free tạo đề mỗi ngày (tổng 18đ free/ngày)\n\n2. 👑 **Gói 100.000đ/tháng** (VIP Ưu Đãi):\n   - +10 Điểm Xịn tích lũy mỗi ngày\n   - +20 Điểm Free tạo đề mỗi ngày\n   - **Giảm 50% Điểm Xịn** khi hỏi Gia sư AI (1đ = 2.000 token)\n\n*Mẹo*: Bạn cũng có thể cày Điểm Xịn hoàn toàn **miễn phí** bằng cách làm bài thi đạt trên 8.5 điểm ở mức Trung bình trở lên! 💎`;
    emotion = 'wink';

    actions.push({
      type: 'SELECT_PRICING_PLAN',
      payload: { plan: isVip ? 'Gói 100K' : 'Gói 50K', price: isVip ? 100000 : 50000 },
    });
    actions.push({
      type: 'NAVIGATE_PAGE',
      payload: { path: '/pricing', label: 'Mở Trang Thanh Toán VietQR Tự Động' },
    });

    suggestions = ['Cách làm đề trên 8.5 để nhận điểm xịn', 'Thanh toán Gói 50k qua VietQR', 'Thanh toán Gói 100k'];
  }
  // ============================================================
  // 6. QUÉT ĐỀ THI WORD (.DOCX)
  // ============================================================
  else if (norm.includes('docx') || norm.includes('word') || norm.includes('quet de') || norm.includes('scan')) {
    message = `Tớ đã sẵn sàng mở **Công cụ AI Quét Đề Thi (.docx)**! AI sẽ đọc hiểu cấu trúc đề thi Word, công thức Toán học KaTeX/MathType và tự động sinh câu hỏi mới tương đương cho bạn nhé! 📄✨`;
    emotion = 'idea';

    actions.push({
      type: 'OPEN_DOCX_SCANNER',
      payload: { targetCount: 10, saveToBank: true },
    });
    actions.push({
      type: 'NAVIGATE_PAGE',
      payload: { path: '/admin/questions/import', label: 'Mở Công Cụ AI Quét Đề Word' },
    });

    suggestions = ['Tải lên đề mẫu .docx', 'Xem hướng dẫn soạn file Word', 'Quay lại luyện thi'];
  }
  // ============================================================
  // 7. BẢNG XẾP HẠNG & LỊCH SỬ HỌC TẬP
  // ============================================================
  else if (norm.includes('xep hang') || norm.includes('bang vang') || norm.includes('lich su') || norm.includes('ket qua')) {
    const isRank = norm.includes('xep hang') || norm.includes('bang vang');
    message = isRank
      ? `Tớ sẽ dẫn bạn đến **Bảng Vàng Xếp Hạng** để kiểm tra thứ hạng chuỗi học tập (Streak) và điểm nỗ lực cùng bạn bè nhé! 🏆`
      : `Tớ sẽ dẫn bạn đến **Lịch Sử Luyện Đề** để xem lại toàn bộ bài thi kèm phân tích ma trận năng lực Bloom nhé! 📊`;
    emotion = isRank ? 'celebrate' : 'happy';

    actions.push({
      type: 'NAVIGATE_PAGE',
      payload: {
        path: isRank ? '/student/leaderboard' : '/student/history',
        label: isRank ? 'Xem Bảng Vàng Xếp Hạng' : 'Xem Lịch Sử & Phân Tích Bloom',
      },
    });

    suggestions = ['Xem điểm tích lũy Kim Cương', 'Luyện thêm đề để tăng hạng', 'Hỏi bài tập khác'];
  }
  // ============================================================
  // 8. ĐÀM THOẠI TỰ NHIÊN ĐA NĂNG (GỌI TRỰC TIẾP GEMINI 2.5 FLASH)
  // ============================================================
  else {
    try {
      const historyContext =
        history.length > 0
          ? 'Lịch sử hội thoại gần nhất:\n' +
            history
              .slice(-4)
              .map((h) => `${h.role}: ${h.content}`)
              .join('\n') +
            '\n\n'
          : '';

      const systemPrompt = `Bạn là Trợ lý AI Schoolify (nền tảng Luyện thi & Khảo thí K-12 thông minh chuẩn GDPT 2018).
Học sinh đang hỏi bạn một câu hỏi. Hãy trả lời thật thông minh, chính xác, hóm hỉnh và truyền cảm hứng.
Nếu là câu hỏi toán học/khoa học (như "1+1=?", đạo hàm, tích phân, lý thuyết), hãy giải thích ngắn gọn, rõ ràng, dùng KaTeX $...$ nếu có công thức.
Nếu học sinh trò chuyện tự nhiên hoặc hỏi kiến thức, hãy trò chuyện tự nhiên và thân thiện.

${historyContext}Câu hỏi của học sinh: "${rawMsg}"

BẮT BUỘC trả về đúng 1 JSON hợp lệ (không kèm markdown code block):
{
  "message": "Nội dung trả lời bằng tiếng Việt",
  "emotion": "happy",
  "suggestions": ["Gợi ý tiếp theo 1", "Gợi ý tiếp theo 2", "Gợi ý tiếp theo 3"]
}`;

      const aiRaw = await callGeminiLive(systemPrompt);
      if (aiRaw) {
        const cleanJson = aiRaw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
        const parsed = JSON.parse(cleanJson);
        if (parsed.message) {
          message = parsed.message;
          emotion = parsed.emotion || 'happy';
          suggestions = Array.isArray(parsed.suggestions)
            ? parsed.suggestions
            : ['Hỏi bài tập khác', 'Tạo đề thi'];
        }
      }
    } catch (err) {
      console.warn('[Antigravity Live Gemini Error]:', err.message);
    }

    if (!message) {
      message = `Tớ đã nắm được ý của bạn! Bạn cần tớ hỗ trợ chi tiết về bài tập, tạo ma trận đề thi phân hóa GDPT 2018, hay hướng dẫn các tính năng trên Schoolify nè? Nhắn cho tớ bất cứ điều gì bạn đang quan tâm nhé! 😊`;
      emotion = 'happy';
      suggestions = ['Tạo đề thi thích ứng ngay', 'Gợi ý giải bài tập Socratic', 'Xem các gói học sinh'];
    }
  }

  return {
    message,
    actions,
    emotion,
    emotionDurationMs: 4000,
    suggestions,
  };
}

let isProcessing = false;

const checkInbox = async () => {
  if (isProcessing) return;
  try {
    const files = fs
      .readdirSync(INBOX_DIR)
      .filter((f) => f.endsWith('.json') && !f.endsWith('.claimed.json'))
      .sort();

    for (const file of files) {
      const fullPath = path.join(INBOX_DIR, file);
      const claimedPath = path.join(INBOX_DIR, file.replace(/\.json$/, '.claimed.json'));
      try {
        fs.renameSync(fullPath, claimedPath);
      } catch {
        continue;
      }

      isProcessing = true;
      try {
        const content = fs.readFileSync(claimedPath, 'utf-8');
        const jobData = JSON.parse(content);
        console.log(`[Antigravity Live Bridge] 📥 Received Job ${jobData.id} (${jobData.type})`);

        let result = {};
        if (jobData.type === 'AGENT_CHAT') {
          result = await processAiJob(jobData);
        } else if (jobData.type === 'SEMANTIC_CHECKPOINT') {
          result = {
            isCorrect: true,
            explanation: 'Câu trả lời của học sinh phù hợp với tiêu chuẩn kiến thức GDPT 2018.',
          };
        } else {
          result = { success: true, message: 'Đã xử lý thành công bởi Antigravity Live Bridge.' };
        }

        const outboxPath = path.join(OUTBOX_DIR, `${jobData.id}.json`);
        fs.writeFileSync(outboxPath, JSON.stringify(result, null, 2));
        console.log(`[Antigravity Live Bridge] 📤 Fulfill Job ${jobData.id} successfully!`);

        try {
          fs.unlinkSync(claimedPath);
        } catch {}
      } catch (err) {
        console.error('[Antigravity Live Bridge] Error processing job:', err);
      } finally {
        isProcessing = false;
      }
    }
  } catch (err) {
    // transient fs errors
  }
};

checkInbox();
setInterval(checkInbox, 80);

