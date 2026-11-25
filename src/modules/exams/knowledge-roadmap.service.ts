import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  RecordQuickDrillBehaviorDto,
  SubmitRemediationDto,
} from './dto/exam.dto';

export interface QuestionAttemptOutcome {
  questionId?: string;
  subject: string;
  grade: number;
  chapterId: number;
  chapterName?: string;
  topicTag: string;
  trapTag?: string;
  bloomLevel: 'NHAN_BIET' | 'THONG_HIEU' | 'VAN_DUNG' | 'VAN_DUNG_CAO';
  isCorrect: boolean;
  isRemediation?: boolean;
  timeSpentSeconds?: number;
  attemptedAt?: string;
}

export interface TopicDeltaItem {
  topicTag: string;
  chapterId: number;
  previousScore: number;
  currentScore: number;
  deltaScore: number;
  previousStatus: string;
  currentStatus: string;
  attemptedInExam: number;
  correctInExam: number;
  topTrapTag?: string | null;
}

interface CurriculumTopicSeed {
  chapterId: number;
  chapterName: string;
  topicTag: string;
  defaultTitle: string;
}

const CURRICULUM_TOPICS: Record<
  string,
  Record<number, CurriculumTopicSeed[]>
> = {
  'toan-hoc': {
    12: [
      {
        chapterId: 1,
        chapterName:
          'Chương 1: Ứng dụng đạo hàm để khảo sát và vẽ đồ thị hàm số',
        topicTag: 'Tính đơn điệu và cực trị của hàm số',
        defaultTitle: 'Xét chiều biến thiên & tìm điểm cực trị hàm số',
      },
      {
        chapterId: 1,
        chapterName:
          'Chương 1: Ứng dụng đạo hàm để khảo sát và vẽ đồ thị hàm số',
        topicTag: 'Giá trị lớn nhất - nhỏ nhất & Tiệm cận đồ thị',
        defaultTitle: 'Tìm GTLN, GTNN trên đoạn và đường tiệm cận',
      },
      {
        chapterId: 2,
        chapterName: 'Chương 2A: Vectơ và các phép toán vectơ trong không gian',
        topicTag: 'Vectơ trong không gian và tích vô hướng',
        defaultTitle: 'Quy tắc hình hộp và tích vô hướng trong không gian',
      },
      {
        chapterId: 7,
        chapterName: 'Chương 2B: Hệ trục tọa độ Oxyz & Biểu thức tọa độ vectơ',
        topicTag: 'Hệ trục tọa độ Oxyz và biểu thức tọa độ vectơ',
        defaultTitle: 'Tọa độ điểm, vectơ, tích có hướng và ứng dụng Oxyz',
      },
      {
        chapterId: 3,
        chapterName:
          'Chương 3: Các số đặc trưng đo mức độ phân tán mẫu số liệu ghép nhóm',
        topicTag: 'Khoảng biến thiên, tứ phân vị & phương sai mẫu ghép nhóm',
        defaultTitle: 'Phân tích mẫu số liệu ghép nhóm thống kê',
      },
      {
        chapterId: 4,
        chapterName: 'Chương 4: Nguyên hàm và tích phân',
        topicTag: 'Nguyên hàm, Tích phân và ứng dụng diện tích - thể tích',
        defaultTitle: 'Tính tích phân và ứng dụng hình học',
      },
      {
        chapterId: 5,
        chapterName:
          'Chương 5A: Phương trình mặt phẳng và đường thẳng trong Oxyz',
        topicTag: 'Phương trình mặt phẳng và đường thẳng trong Oxyz',
        defaultTitle: 'Vectơ pháp tuyến, chỉ phương và vị trí tương đối Oxyz',
      },
      {
        chapterId: 8,
        chapterName:
          'Chương 5B: Phương trình mặt cầu, Góc & Khoảng cách trong Oxyz',
        topicTag: 'Phương trình mặt cầu, góc và khoảng cách trong Oxyz',
        defaultTitle: 'Mặt cầu, góc và khoảng cách trong không gian Oxyz',
      },
      {
        chapterId: 6,
        chapterName: 'Chương 6: Xác suất có điều kiện & Công thức Bayes',
        topicTag: 'Xác suất có điều kiện và công thức Bayes',
        defaultTitle: 'Bài toán xác suất toàn phần & công thức Bayes',
      },
    ],
    11: [
      {
        chapterId: 1,
        chapterName: 'Chương 1: Hàm số lượng giác và phương trình lượng giác',
        topicTag: 'Hàm số lượng giác và phương trình lượng giác',
        defaultTitle: 'Công thức biến đổi và giải phương trình lượng giác',
      },
      {
        chapterId: 2,
        chapterName: 'Chương 2: Dãy số. Cấp số cộng và cấp số nhân',
        topicTag: 'Dãy số, Cấp số cộng và Cấp số nhân',
        defaultTitle: 'Số hạng tổng quát và tổng n số hạng đầu CSC, CSN',
      },
      {
        chapterId: 3,
        chapterName: 'Chương 3: Mẫu số liệu ghép nhóm (Xu thế trung tâm)',
        topicTag: 'Các số đặc trưng đo xu thế trung tâm mẫu ghép nhóm',
        defaultTitle:
          'Số trung bình, trung vị, tứ phân vị và mốt mẫu ghép nhóm',
      },
      {
        chapterId: 4,
        chapterName:
          'Chương 4A: Đại cương mặt phẳng & Hai đường thẳng song song',
        topicTag:
          'Giao tuyến mặt phẳng và hai đường thẳng song song không gian',
        defaultTitle:
          'Xác định giao tuyến, giao điểm và hai đường thẳng chéo nhau/song song',
      },
      {
        chapterId: 10,
        chapterName: 'Chương 4B: Đường thẳng, mặt phẳng song song & Phép chiếu',
        topicTag: 'Đường thẳng song song mặt phẳng và hai mặt phẳng song song',
        defaultTitle: 'Thiết diện song song, hình lăng trụ và hình hộp',
      },
      {
        chapterId: 5,
        chapterName: 'Chương 5: Giới hạn. Hàm số liên tục',
        topicTag: 'Giới hạn dãy số, hàm số và hàm số liên tục',
        defaultTitle: 'Khử dạng vô định và xét tính liên tục hàm số',
      },
      {
        chapterId: 6,
        chapterName: 'Chương 6: Hàm số mũ và hàm số lôgarit',
        topicTag: 'Hàm số, phương trình và bất phương trình mũ – lôgarit',
        defaultTitle: 'Biến đổi lũy thừa, lôgarit và giải PT/BPT mũ – lôgarit',
      },
      {
        chapterId: 7,
        chapterName: 'Chương 7A: Quan hệ vuông góc & Góc trong không gian',
        topicTag: 'Đường thẳng vuông góc mặt phẳng và góc trong không gian',
        defaultTitle: 'Chứng minh vuông góc, góc đường – mặt và góc nhị diện',
      },
      {
        chapterId: 11,
        chapterName: 'Chương 7B: Khoảng cách & Thể tích khối đa diện',
        topicTag:
          'Khoảng cách trong không gian và thể tích khối chóp, lăng trụ',
        defaultTitle: 'Tính khoảng cách và thể tích khối đa diện',
      },
      {
        chapterId: 8,
        chapterName: 'Chương 8: Các quy tắc tính xác suất',
        topicTag: 'Biến cố độc lập, xung khắc và quy tắc cộng – nhân xác suất',
        defaultTitle: 'Công thức cộng và nhân xác suất thực tế',
      },
      {
        chapterId: 9,
        chapterName: 'Chương 9: Đạo hàm',
        topicTag: 'Quy tắc tính đạo hàm và phương trình tiếp tuyến',
        defaultTitle: 'Đạo hàm hàm hợp, tiếp tuyến đồ thị và đạo hàm cấp hai',
      },
    ],
    10: [
      {
        chapterId: 1,
        chapterName: 'Chương 1: Mệnh đề và Tập hợp',
        topicTag: 'Mệnh đề toán học và các phép toán trên tập hợp',
        defaultTitle: 'Phép giao, hợp, hiệu của các tập hợp số thực',
      },
      {
        chapterId: 2,
        chapterName: 'Chương 2: Bất phương trình và hệ BPT bậc nhất hai ẩn',
        topicTag: 'Miền nghiệm hệ bất phương trình bậc nhất hai ẩn',
        defaultTitle: 'Biểu diễn miền nghiệm và bài toán tối ưu thực tế',
      },
      {
        chapterId: 3,
        chapterName: 'Chương 3: Hệ thức lượng trong tam giác',
        topicTag: 'Định lý Côsin, Định lý Sin và diện tích tam giác',
        defaultTitle: 'Giải tam giác và ứng dụng đo đạc thực tế',
      },
      {
        chapterId: 4,
        chapterName: 'Chương 4: Vectơ trong mặt phẳng',
        topicTag: 'Các phép toán vectơ và tích vô hướng trong mặt phẳng',
        defaultTitle: 'Tổng hiệu vectơ, phân tích vectơ và tích vô hướng',
      },
      {
        chapterId: 5,
        chapterName:
          'Chương 5: Các số đặc trưng của mẫu số liệu không ghép nhóm',
        topicTag: 'Số gần đúng, trung vị, tứ phân vị và độ lệch chuẩn',
        defaultTitle: 'Phân tích mẫu số liệu không ghép nhóm',
      },
      {
        chapterId: 6,
        chapterName: 'Chương 6: Hàm số, đồ thị và ứng dụng',
        topicTag: 'Hàm số bậc hai và dấu của tam thức bậc hai',
        defaultTitle:
          'Đỉnh Parabol, bảng biến thiên và bất phương trình bậc hai',
      },
      {
        chapterId: 7,
        chapterName: 'Chương 7A: Đường thẳng và Đường tròn trong mặt phẳng Oxy',
        topicTag: 'Phương trình đường thẳng và đường tròn trong Oxy',
        defaultTitle:
          'Phương trình đường thẳng, góc – khoảng cách và tiếp tuyến đường tròn',
      },
      {
        chapterId: 10,
        chapterName: 'Chương 7B: Ba đường Conic trong mặt phẳng Oxy',
        topicTag: 'Phương trình chính tắc Elip, Hypebol và Parabol',
        defaultTitle: 'Tiêu điểm, tiêu cự và ứng dụng ba đường Conic',
      },
      {
        chapterId: 8,
        chapterName: 'Chương 8: Đại số tổ hợp',
        topicTag: 'Quy tắc đếm, hoán vị, chỉnh hợp, tổ hợp và Nhị thức Newton',
        defaultTitle: 'Bài toán đếm tổ hợp và khai triển Nhị thức Newton',
      },
      {
        chapterId: 9,
        chapterName: 'Chương 9: Tính xác suất theo định nghĩa cổ điển',
        topicTag: 'Không gian mẫu, biến cố đối và xác suất cổ điển',
        defaultTitle: 'Tính xác suất biến cố theo định nghĩa cổ điển',
      },
    ],
  },
  'tin-hoc': {
    12: [
      {
        chapterId: 1,
        chapterName:
          'Chương 1: Trí tuệ nhân tạo (AI) trong khoa học và đời sống',
        topicTag: 'Trí tuệ nhân tạo (AI) và ứng dụng đời sống',
        defaultTitle: 'Khái niệm AI, Học máy và đạo đức AI',
      },
      {
        chapterId: 2,
        chapterName:
          'Chương 2: Thiết bị mạng, Giao thức TCP/IP & Chia sẻ tài nguyên',
        topicTag: 'Thiết bị mạng và giao thức mạng TCP/IP',
        defaultTitle: 'Switch, Router, Access Point, IP/DNS và mạng LAN',
      },
      {
        chapterId: 3,
        chapterName: 'Chương 3: Giữ gìn tính nhân văn trong thế giới ảo',
        topicTag: 'Ứng xử nhân văn và đạo đức trong không gian mạng',
        defaultTitle: 'Giao tiếp văn minh và nhân văn trên môi trường số',
      },
      {
        chapterId: 4,
        chapterName: 'Chương 4: Tạo trang web với ngôn ngữ đánh dấu HTML',
        topicTag: 'Ngôn ngữ đánh dấu siêu văn bản HTML và Biểu mẫu web',
        defaultTitle: 'Cấu trúc thẻ HTML, bảng, đa phương tiện và Form',
      },
      {
        chapterId: 5,
        chapterName: 'Chương 5: Định dạng và bố cục trang web với CSS',
        topicTag: 'Bộ chọn CSS, mô hình hộp Box Model và độ ưu tiên CSS',
        defaultTitle: 'Selector CSS, kế thừa, thứ tự ưu tiên và Box Model',
      },
      {
        chapterId: 6,
        chapterName:
          'Chương 6: Hướng nghiệp CNTT, CSDL SQL & Giải thuật nâng cao',
        topicTag: 'Hướng nghiệp CNTT, quản trị mạng, SQL và giải thuật',
        defaultTitle: 'Nhóm nghề CNTT, truy vấn SQL và tư duy giải thuật',
      },
    ],
    11: [
      {
        chapterId: 1,
        chapterName:
          'Chương 1: Hệ điều hành, Phần mềm nguồn mở & Kiến trúc máy tính',
        topicTag: 'Hệ điều hành, phần mềm nguồn mở và mạch logic máy tính',
        defaultTitle:
          'Hệ điều hành, giấy phép nguồn mở, CPU/RAM và phép cộng nhị phân',
      },
      {
        chapterId: 2,
        chapterName:
          'Chương 2: Lưu trữ trực tuyến, Tìm kiếm & Giao tiếp an toàn số',
        topicTag: 'Lưu trữ đám mây và phòng chống lừa đảo trực tuyến',
        defaultTitle:
          'Chia sẻ đám mây, tìm kiếm nâng cao và nhận diện Phishing',
      },
      {
        chapterId: 3,
        chapterName: 'Chương 3: Cơ sở dữ liệu & Mô hình dữ liệu quan hệ',
        topicTag: 'Mô hình dữ liệu quan hệ, khóa chính và khóa ngoại',
        defaultTitle: 'Bảng, bản ghi, khóa chính (PK) và khóa ngoại (FK)',
      },
      {
        chapterId: 4,
        chapterName: 'Chương 4: Ngôn ngữ truy vấn SQL, Bảo mật & Quản trị CSDL',
        topicTag: 'Truy vấn SQL SELECT - WHERE - JOIN và bảo mật CSDL',
        defaultTitle: 'Viết câu lệnh truy vấn SQL liên kết nhiều bảng',
      },
      {
        chapterId: 5,
        chapterName: 'Chương 5: Mảng 1D/2D & Thuật toán Tìm kiếm – Sắp xếp',
        topicTag:
          'Mảng 1 chiều/2 chiều, Tìm kiếm nhị phân và Thuật toán sắp xếp',
        defaultTitle:
          'Tìm kiếm tuần tự/nhị phân và sắp xếp chọn, chèn, nổi bọt',
      },
      {
        chapterId: 6,
        chapterName:
          'Chương 6: Độ phức tạp thuật toán O(n) & Thiết kế chương trình mô đun',
        topicTag: 'Đánh giá độ phức tạp thời gian Big-O và thiết kế mô đun',
        defaultTitle: 'Phân tích O(1), O(log n), O(n), O(n²) và làm mịn dần',
      },
    ],
    10: [
      {
        chapterId: 1,
        chapterName: 'Chương 1: Máy tính và xã hội tri thức',
        topicTag: 'Thông tin, dữ liệu, hệ nhị phân và phép toán lôgic',
        defaultTitle:
          'Đơn vị dữ liệu số, đổi cơ số nhị phân và bảng chân trị AND/OR/NOT',
      },
      {
        chapterId: 2,
        chapterName: 'Chương 2: Mạng máy tính và Internet',
        topicTag: 'Mạng LAN/Internet, Điện toán đám mây, IoT và An toàn mạng',
        defaultTitle: 'Cloud Computing, IoT và phòng chống phần mềm độc hại',
      },
      {
        chapterId: 3,
        chapterName:
          'Chương 3: Đạo đức, pháp luật và văn hóa trong môi trường số',
        topicTag: 'Bản quyền số, Luật An ninh mạng và bảo vệ dữ liệu cá nhân',
        defaultTitle: 'Quyền tác giả số và tuân thủ pháp luật trên Internet',
      },
      {
        chapterId: 4,
        chapterName: 'Chương 4: Ứng dụng tin học – Thiết kế đồ họa vectơ',
        topicTag: 'Đồ họa vectơ, phép toán hình khối và đường cong Bézier',
        defaultTitle: 'So sánh Bitmap vs Vector và kỹ thuật thiết kế Inkscape',
      },
      {
        chapterId: 5,
        chapterName: 'Chương 5: Lập trình Python cơ bản & Cấu trúc điều khiển',
        topicTag: 'Biến, rẽ nhánh if-elif-else và vòng lặp for/while Python',
        defaultTitle: 'Kiểu dữ liệu, toán tử và cấu trúc lặp trong Python',
      },
      {
        chapterId: 6,
        chapterName:
          'Chương 6: Danh sách (List), Xâu ký tự, Hàm & Kiểm thử Python',
        topicTag: 'Danh sách list, xâu ký tự str, hàm def và gỡ lỗi Python',
        defaultTitle: 'Thao tác List/String, phạm vi biến trong hàm và Debug',
      },
      {
        chapterId: 7,
        chapterName: 'Chương 7: Hướng nghiệp với Tin học',
        topicTag: 'Nghề Thiết kế đồ họa máy tính và Phát triển phần mềm',
        defaultTitle:
          'Định hướng nghề nghiệp Thiết kế đồ họa & Kỹ thuật phần mềm',
      },
    ],
  },
};

@Injectable()
export class KnowledgeRoadmapService {
  constructor(private readonly prisma: PrismaService) {}

  normalizeBloomLevel(
    raw?: string | null,
  ): 'NHAN_BIET' | 'THONG_HIEU' | 'VAN_DUNG' | 'VAN_DUNG_CAO' {
    const val = String(raw || '')
      .trim()
      .toUpperCase();
    if (val === 'NHAN_BIET' || val === 'EASY' || val.includes('NHẬN BIẾT')) {
      return 'NHAN_BIET';
    }
    if (
      val === 'VAN_DUNG_CAO' ||
      val === 'VERY_HARD' ||
      val.includes('VẬN DỤNG CAO')
    ) {
      return 'VAN_DUNG_CAO';
    }
    if (val === 'VAN_DUNG' || val === 'HARD' || val.includes('VẬN DỤNG')) {
      return 'VAN_DUNG';
    }
    return 'THONG_HIEU';
  }

  normalizeSubjectSlug(raw?: string | null): string {
    const val = String(raw || 'toan-hoc')
      .trim()
      .toLowerCase();
    if (val.includes('tin')) return 'tin-hoc';
    if (val.includes('ly') || val.includes('lý')) return 'vat-ly';
    if (val.includes('hoa') || val.includes('hóa')) return 'hoa-hoc';
    if (val.includes('anh')) return 'tieng-anh';
    if (val.includes('sinh')) return 'sinh-hoc';
    if (val.includes('van') || val.includes('văn')) return 'ngu-van';
    return 'toan-hoc';
  }

  getCurriculumSeeds(
    subjectSlug: string,
    grade: number,
  ): CurriculumTopicSeed[] {
    const normSubj = this.normalizeSubjectSlug(subjectSlug);
    const subjMap =
      CURRICULUM_TOPICS[normSubj] || CURRICULUM_TOPICS['toan-hoc'];
    return subjMap[grade] || subjMap[12] || [];
  }

  /**
   * Tính điểm thành thạo (Mastery Score 0..100) và trạng thái chuyên đề (WEAK | REVIEW | MASTERED | UNTESTED)
   * dựa trên:
   * 1. Độ chính xác có trọng số theo cấp độ tư duy Bloom (60%)
   * 2. Phong độ 10 câu gần nhất - Recency EMA (30%)
   * 3. Điểm thưởng phục hồi khi làm bài Luyện bù - Remediation Recovery (10%)
   */
  computeMasteryScoreAndStatus(params: {
    nhanBietAttempted: number;
    nhanBietCorrect: number;
    thongHieuAttempted: number;
    thongHieuCorrect: number;
    vanDungAttempted: number;
    vanDungCorrect: number;
    vanDungCaoAttempted: number;
    vanDungCaoCorrect: number;
    remediationAttempted: number;
    remediationCorrect: number;
    recentHistory: Array<{
      isCorrect: boolean;
      bloomLevel: string;
      at: string;
    }>;
  }): { score: number; status: 'WEAK' | 'REVIEW' | 'MASTERED' | 'UNTESTED' } {
    const totalAttempted =
      params.nhanBietAttempted +
      params.thongHieuAttempted +
      params.vanDungAttempted +
      params.vanDungCaoAttempted;

    if (totalAttempted <= 0) {
      return { score: 0, status: 'UNTESTED' };
    }

    // 1. Trọng số theo cấp độ Bloom
    const weights = {
      NHAN_BIET: 1.0,
      THONG_HIEU: 1.25,
      VAN_DUNG: 1.5,
      VAN_DUNG_CAO: 1.8,
    };

    const weightedMax =
      params.nhanBietAttempted * weights.NHAN_BIET +
      params.thongHieuAttempted * weights.THONG_HIEU +
      params.vanDungAttempted * weights.VAN_DUNG +
      params.vanDungCaoAttempted * weights.VAN_DUNG_CAO;

    const weightedEarned =
      params.nhanBietCorrect * weights.NHAN_BIET +
      params.thongHieuCorrect * weights.THONG_HIEU +
      params.vanDungCorrect * weights.VAN_DUNG +
      params.vanDungCaoCorrect * weights.VAN_DUNG_CAO;

    const weightedBloomAcc =
      weightedMax > 0 ? (weightedEarned / weightedMax) * 100 : 0;

    // 2. Phong độ gần đây (Recency EMA trên tối đa 10 câu gần nhất)
    let recentAcc = weightedBloomAcc;
    if (
      Array.isArray(params.recentHistory) &&
      params.recentHistory.length > 0
    ) {
      let recWeightSum = 0;
      let recCorrectSum = 0;
      params.recentHistory.slice(-10).forEach((entry, idx) => {
        const w = 1 + idx * 0.18; // Câu càng mới trọng số càng cao
        recWeightSum += w;
        if (entry.isCorrect) recCorrectSum += w;
      });
      if (recWeightSum > 0) {
        recentAcc = (recCorrectSum / recWeightSum) * 100;
      }
    }

    // 3. Điểm phục hồi từ bài Luyện bù (Remediation)
    let remediationBonus = 0;
    if (params.remediationAttempted > 0) {
      const remRate = params.remediationCorrect / params.remediationAttempted;
      remediationBonus = Math.min(12, Math.round(remRate * 12));
    }

    let rawScore =
      0.65 * weightedBloomAcc + 0.35 * recentAcc + remediationBonus;

    // Điều tiết độ tin cậy khi số câu mới làm quá ít (1-2 câu) để tránh nhảy vọt ảo
    if (totalAttempted === 1) {
      rawScore = rawScore * 0.72 + 15;
    } else if (totalAttempted === 2) {
      rawScore = rawScore * 0.88 + 6;
    }

    const finalScore = Math.max(0, Math.min(100, Math.round(rawScore)));

    // Kiểm tra nếu mất gốc Nhận biết (làm >= 2 câu Nhận biết mà đúng dưới 40%)
    const basicBroken =
      params.nhanBietAttempted >= 2 &&
      params.nhanBietCorrect / params.nhanBietAttempted < 0.4;

    if (finalScore < 50 || basicBroken) {
      return {
        score: basicBroken ? Math.min(finalScore, 48) : finalScore,
        status: 'WEAK',
      };
    }
    if (finalScore < 75) {
      return { score: finalScore, status: 'REVIEW' };
    }
    return { score: finalScore, status: 'MASTERED' };
  }

  /**
   * Bóc tách kết quả từng câu hỏi từ dữ liệu bài nộp (ExamSubmission / Snapshot)
   */
  extractOutcomesFromSubmission(params: {
    subjectSlug?: string;
    grade?: number;
    chapterId?: number;
    timeSpentSeconds?: number;
    details?: any[];
    snapshotData?: any;
    submittedAt?: string;
  }): QuestionAttemptOutcome[] {
    const subject = this.normalizeSubjectSlug(
      params.subjectSlug || params.snapshotData?.subjectSlug || 'toan-hoc',
    );
    const grade = Number(params.grade || params.snapshotData?.grade || 12);
    const defaultChapterId = Number(
      params.chapterId || params.snapshotData?.chapterId || 1,
    );
    const defaultChapterName =
      params.snapshotData?.chapterName || `Chương ${defaultChapterId}`;
    const attemptedAt = params.submittedAt || new Date().toISOString();

    const outcomes: QuestionAttemptOutcome[] = [];
    const snapOrig =
      params.snapshotData?.originalExam || params.snapshotData || {};
    const snapQuestions: any[] = Array.isArray(snapOrig.questions)
      ? snapOrig.questions
      : Array.isArray(params.snapshotData?.questions)
        ? params.snapshotData.questions
        : [];
    const wrongIdsSet = new Set<string>(
      Array.isArray(snapOrig.wrongQuestionIds)
        ? snapOrig.wrongQuestionIds.map((id: any) => String(id))
        : [],
    );
    const detailsMap = new Map<string, any>();
    if (Array.isArray(params.details)) {
      for (const d of params.details) {
        if (d?.questionId) detailsMap.set(String(d.questionId), d);
      }
    }

    const studentAnswers =
      snapOrig.studentAnswers || params.snapshotData?.answers || {};
    const mcMap = studentAnswers.multipleChoices || {};
    const tfMap = studentAnswers.trueFalseAnswers || {};
    const saMap = studentAnswers.shortAnswers || {};

    if (snapQuestions.length > 0) {
      const avgTimePerQ = Math.max(
        5,
        Math.round(
          Number(params.timeSpentSeconds || 60) / snapQuestions.length,
        ),
      );

      for (const q of snapQuestions) {
        const qId = String(q.id || '');
        const detail = detailsMap.get(qId);

        let isCorrect = false;
        if (detail && typeof detail.isCorrect === 'boolean') {
          isCorrect = detail.isCorrect;
        } else if (Array.isArray(snapOrig.wrongQuestionIds)) {
          isCorrect = !wrongIdsSet.has(qId);
        } else if (q.type === 'TRUE_FALSE' && Array.isArray(q.subQuestions)) {
          const userTf = tfMap[qId] || {};
          isCorrect = q.subQuestions.every(
            (sq: any) => Boolean(userTf[sq.id]) === Boolean(sq.isTrue),
          );
        } else if (q.type === 'SHORT_ANSWER') {
          const userSa = String(saMap[qId] ?? '')
            .trim()
            .replace(',', '.');
          const targetSa = String(q.shortAnswerValue ?? '')
            .trim()
            .replace(',', '.');
          isCorrect = userSa.length > 0 && userSa === targetSa;
        } else {
          const userChoice = mcMap[qId];
          isCorrect = Boolean(
            userChoice && q.correctChoice && userChoice === q.correctChoice,
          );
        }

        const bloomLevel = this.normalizeBloomLevel(
          q.bloomLevel || q.difficulty || q.cognitiveTag,
        );
        const chapterId = Number(q.chapterId || defaultChapterId || 1);
        const seeds = this.getCurriculumSeeds(subject, grade);
        const fallbackTopic =
          seeds.find((s) => s.chapterId === chapterId)?.topicTag ||
          seeds[0]?.topicTag ||
          `Chuyên đề Chương ${chapterId}`;

        const topicTag = String(q.topicTag || fallbackTopic).trim();
        const trapTag = q.trapTag ? String(q.trapTag).trim() : undefined;

        outcomes.push({
          questionId: qId || undefined,
          subject,
          grade,
          chapterId,
          chapterName: q.chapterName || defaultChapterName,
          topicTag,
          trapTag,
          bloomLevel,
          isCorrect,
          isRemediation: false,
          timeSpentSeconds: avgTimePerQ,
          attemptedAt,
        });
      }
    } else if (Array.isArray(params.details) && params.details.length > 0) {
      const avgTimePerQ = Math.max(
        5,
        Math.round(
          Number(params.timeSpentSeconds || 60) / params.details.length,
        ),
      );
      const seeds = this.getCurriculumSeeds(subject, grade);
      const fallbackTopic =
        seeds.find((s) => s.chapterId === defaultChapterId)?.topicTag ||
        seeds[0]?.topicTag ||
        `Chuyên đề Chương ${defaultChapterId}`;

      for (const d of params.details) {
        outcomes.push({
          questionId: d.questionId,
          subject,
          grade,
          chapterId: Number(d.chapterId || defaultChapterId),
          chapterName: defaultChapterName,
          topicTag: String(d.topicTag || fallbackTopic).trim(),
          trapTag: d.trapTag ? String(d.trapTag).trim() : undefined,
          bloomLevel: this.normalizeBloomLevel(d.bloomLevel || d.difficulty),
          isCorrect: Boolean(d.isCorrect),
          isRemediation: false,
          timeSpentSeconds: avgTimePerQ,
          attemptedAt,
        });
      }
    }

    // Nếu snapshot có sẵn dữ liệu bài luyện bù (khi backfill từ lịch sử)
    const rem = params.snapshotData?.remediation;
    if (
      rem &&
      rem.attempted &&
      Array.isArray(rem.questions) &&
      rem.questions.length > 0
    ) {
      const remMc = rem.studentAnswers?.multipleChoices || {};
      const remTf = rem.studentAnswers?.trueFalseAnswers || {};
      const remSa = rem.studentAnswers?.shortAnswers || {};

      for (const rq of rem.questions) {
        const rqId = String(rq.id || '');
        let isCorrect = false;
        if (rq.type === 'TRUE_FALSE' && Array.isArray(rq.subQuestions)) {
          const uTf = remTf[rqId] || {};
          isCorrect = rq.subQuestions.every(
            (sq: any) => Boolean(uTf[sq.id]) === Boolean(sq.isTrue),
          );
        } else if (rq.type === 'SHORT_ANSWER') {
          const uSa = String(remSa[rqId] ?? '')
            .trim()
            .replace(',', '.');
          const tSa = String(rq.shortAnswerValue ?? '')
            .trim()
            .replace(',', '.');
          isCorrect = uSa.length > 0 && uSa === tSa;
        } else {
          const uMc = remMc[rqId];
          isCorrect = Boolean(
            uMc && rq.correctChoice && uMc === rq.correctChoice,
          );
        }

        const chapterId = Number(rq.chapterId || defaultChapterId || 1);
        const seeds = this.getCurriculumSeeds(subject, grade);
        const fallbackTopic =
          seeds.find((s) => s.chapterId === chapterId)?.topicTag ||
          seeds[0]?.topicTag ||
          `Chuyên đề Chương ${chapterId}`;

        outcomes.push({
          questionId: rqId || undefined,
          subject,
          grade,
          chapterId,
          chapterName: defaultChapterName,
          topicTag: String(rq.topicTag || fallbackTopic).trim(),
          trapTag: rq.trapTag ? String(rq.trapTag).trim() : undefined,
          bloomLevel: this.normalizeBloomLevel(rq.bloomLevel || rq.difficulty),
          isCorrect,
          isRemediation: true,
          timeSpentSeconds: 30,
          attemptedAt: rem.attemptedAt || attemptedAt,
        });
      }
    }

    return outcomes;
  }

  /**
   * Ghi nhận danh sách kết quả từng câu hỏi vào bảng `student_topic_masteries` trong PostgreSQL
   * và tự động tái tổng hợp lộ trình cá nhân hóa `student_roadmap_steps`.
   */
  async recordQuestionOutcomes(
    studentProfileId: string,
    outcomes: QuestionAttemptOutcome[],
    rebuildRoadmap = true,
  ): Promise<{
    topicDeltas: TopicDeltaItem[];
    nextRecommendedStep: any | null;
  }> {
    if (!studentProfileId || outcomes.length === 0) {
      return { topicDeltas: [], nextRecommendedStep: null };
    }

    // Gom nhóm outcomes theo (subject, grade, topicTag)
    const grouped = new Map<string, QuestionAttemptOutcome[]>();
    for (const item of outcomes) {
      const key = `${item.subject}__${item.grade}__${item.topicTag}`;
      const list = grouped.get(key) || [];
      list.push(item);
      grouped.set(key, list);
    }

    const topicDeltas: TopicDeltaItem[] = [];
    const touchedSubjectGrades = new Set<string>();

    for (const [, groupItems] of grouped.entries()) {
      const sample = groupItems[0];
      const subject = this.normalizeSubjectSlug(sample.subject);
      const grade = Number(sample.grade || 12);
      const topicTag = sample.topicTag;
      touchedSubjectGrades.add(`${subject}__${grade}`);

      const existing = await this.prisma.studentTopicMastery.findUnique({
        where: {
          student_id_subject_grade_topic_tag: {
            student_id: studentProfileId,
            subject,
            grade,
            topic_tag: topicTag,
          },
        },
      });

      const prevScore = existing ? Number(existing.mastery_score || 0) : 0;
      const prevStatus = existing ? existing.mastery_status : 'UNTESTED';

      let totalAttempted = existing?.total_attempted || 0;
      let totalCorrect = existing?.total_correct || 0;
      let totalWrong = existing?.total_wrong || 0;
      let nbAttempted = existing?.nhan_biet_attempted || 0;
      let nbCorrect = existing?.nhan_biet_correct || 0;
      let thAttempted = existing?.thong_hieu_attempted || 0;
      let thCorrect = existing?.thong_hieu_correct || 0;
      let vdAttempted = existing?.van_dung_attempted || 0;
      let vdCorrect = existing?.van_dung_correct || 0;
      let vdcAttempted = existing?.van_dung_cao_attempted || 0;
      let vdcCorrect = existing?.van_dung_cao_correct || 0;
      let remAttempted = existing?.remediation_attempted || 0;
      let remCorrect = existing?.remediation_correct || 0;
      let totalTimeSeconds = existing?.total_time_seconds || 0;

      const trapCounts: Record<string, number> =
        existing?.trap_counts && typeof existing.trap_counts === 'object'
          ? { ...(existing.trap_counts as Record<string, number>) }
          : {};

      const recentHistory: Array<{
        isCorrect: boolean;
        bloomLevel: string;
        at: string;
      }> = Array.isArray(existing?.recent_history)
        ? [...(existing.recent_history as any[])]
        : [];

      let attemptedInExam = 0;
      let correctInExam = 0;

      for (const outcome of groupItems) {
        attemptedInExam++;
        if (outcome.isCorrect) {
          correctInExam++;
        }

        if (outcome.isRemediation) {
          remAttempted++;
          if (outcome.isCorrect) remCorrect++;
        } else {
          totalAttempted++;
          if (outcome.isCorrect) totalCorrect++;
          else totalWrong++;

          if (outcome.bloomLevel === 'NHAN_BIET') {
            nbAttempted++;
            if (outcome.isCorrect) nbCorrect++;
          } else if (outcome.bloomLevel === 'THONG_HIEU') {
            thAttempted++;
            if (outcome.isCorrect) thCorrect++;
          } else if (outcome.bloomLevel === 'VAN_DUNG') {
            vdAttempted++;
            if (outcome.isCorrect) vdCorrect++;
          } else if (outcome.bloomLevel === 'VAN_DUNG_CAO') {
            vdcAttempted++;
            if (outcome.isCorrect) vdcCorrect++;
          }
        }

        totalTimeSeconds += Math.max(1, Number(outcome.timeSpentSeconds || 30));

        if (!outcome.isCorrect && outcome.trapTag) {
          trapCounts[outcome.trapTag] = (trapCounts[outcome.trapTag] || 0) + 1;
        }

        recentHistory.push({
          isCorrect: outcome.isCorrect,
          bloomLevel: outcome.bloomLevel,
          at: outcome.attemptedAt || new Date().toISOString(),
        });
      }

      const trimmedRecent = recentHistory.slice(-15);

      const { score: newScore, status: newStatus } =
        this.computeMasteryScoreAndStatus({
          nhanBietAttempted: nbAttempted,
          nhanBietCorrect: nbCorrect,
          thongHieuAttempted: thAttempted,
          thongHieuCorrect: thCorrect,
          vanDungAttempted: vdAttempted,
          vanDungCorrect: vdCorrect,
          vanDungCaoAttempted: vdcAttempted,
          vanDungCaoCorrect: vdcCorrect,
          remediationAttempted: remAttempted,
          remediationCorrect: remCorrect,
          recentHistory: trimmedRecent,
        });

      await this.prisma.studentTopicMastery.upsert({
        where: {
          student_id_subject_grade_topic_tag: {
            student_id: studentProfileId,
            subject,
            grade,
            topic_tag: topicTag,
          },
        },
        create: {
          student_id: studentProfileId,
          subject,
          grade,
          chapter_id: sample.chapterId || 1,
          chapter_name: sample.chapterName || `Chương ${sample.chapterId || 1}`,
          topic_tag: topicTag,
          total_attempted: totalAttempted,
          total_correct: totalCorrect,
          total_wrong: totalWrong,
          nhan_biet_attempted: nbAttempted,
          nhan_biet_correct: nbCorrect,
          thong_hieu_attempted: thAttempted,
          thong_hieu_correct: thCorrect,
          van_dung_attempted: vdAttempted,
          van_dung_correct: vdCorrect,
          van_dung_cao_attempted: vdcAttempted,
          van_dung_cao_correct: vdcCorrect,
          remediation_attempted: remAttempted,
          remediation_correct: remCorrect,
          total_time_seconds: totalTimeSeconds,
          mastery_score: newScore,
          mastery_status: newStatus,
          trap_counts: trapCounts,
          recent_history: trimmedRecent,
          last_practiced_at: new Date(),
        },
        update: {
          chapter_id: sample.chapterId || existing?.chapter_id || 1,
          chapter_name:
            sample.chapterName ||
            existing?.chapter_name ||
            `Chương ${sample.chapterId || 1}`,
          total_attempted: totalAttempted,
          total_correct: totalCorrect,
          total_wrong: totalWrong,
          nhan_biet_attempted: nbAttempted,
          nhan_biet_correct: nbCorrect,
          thong_hieu_attempted: thAttempted,
          thong_hieu_correct: thCorrect,
          van_dung_attempted: vdAttempted,
          van_dung_correct: vdCorrect,
          van_dung_cao_attempted: vdcAttempted,
          van_dung_cao_correct: vdcCorrect,
          remediation_attempted: remAttempted,
          remediation_correct: remCorrect,
          total_time_seconds: totalTimeSeconds,
          mastery_score: newScore,
          mastery_status: newStatus,
          trap_counts: trapCounts,
          recent_history: trimmedRecent,
          last_practiced_at: new Date(),
        },
      });

      const topTrapEntry = Object.entries(trapCounts).sort(
        (a, b) => b[1] - a[1],
      )[0];

      topicDeltas.push({
        topicTag,
        chapterId: sample.chapterId || 1,
        previousScore: prevScore,
        currentScore: newScore,
        deltaScore: newScore - prevScore,
        previousStatus: prevStatus,
        currentStatus: newStatus,
        attemptedInExam,
        correctInExam,
        topTrapTag: topTrapEntry ? topTrapEntry[0] : null,
      });
    }

    let nextRecommendedStep: any = null;
    if (rebuildRoadmap) {
      for (const sg of touchedSubjectGrades) {
        const [subj, grStr] = sg.split('__');
        const steps = await this.rebuildPersonalizedRoadmap(
          studentProfileId,
          subj,
          Number(grStr || 12),
        );
        if (!nextRecommendedStep && steps.length > 0) {
          nextRecommendedStep =
            steps.find(
              (s) => s.status === 'RECOMMENDED' || s.status === 'IN_PROGRESS',
            ) || steps[0];
        }
      }
    }

    return {
      topicDeltas: topicDeltas.sort((a, b) => a.currentScore - b.currentScore),
      nextRecommendedStep,
    };
  }

  /**
   * Tự động backfill dữ liệu từ các bản ghi `exam_submissions` đã có trong PostgreSQL
   * nếu học sinh đã từng thi nhưng bảng `student_topic_masteries` chưa có dữ liệu.
   */
  async ensureBackfilledFromSubmissions(
    studentProfileId: string,
    subjectSlug?: string,
    grade?: number,
  ): Promise<void> {
    const existingCount = await this.prisma.studentTopicMastery.count({
      where: { student_id: studentProfileId },
    });

    if (existingCount > 0) {
      return;
    }

    const submissions = await this.prisma.examSubmission.findMany({
      where: { student_id: studentProfileId },
      orderBy: { submitted_at: 'asc' },
      take: 50,
    });

    if (submissions.length === 0) {
      return;
    }

    const allOutcomes: QuestionAttemptOutcome[] = [];
    for (const sub of submissions) {
      const snap = (sub.snapshot_data || {}) as Record<string, any>;
      const extracted = this.extractOutcomesFromSubmission({
        subjectSlug: snap.subjectSlug || subjectSlug || 'toan-hoc',
        grade: Number(snap.grade || grade || 12),
        chapterId: Number(snap.chapterId || 1),
        timeSpentSeconds: Number(
          sub.time_spent_seconds || snap.timeSpentSeconds || 600,
        ),
        details: snap.details || [],
        snapshotData: snap,
        submittedAt: sub.submitted_at
          ? sub.submitted_at.toISOString()
          : undefined,
      });
      allOutcomes.push(...extracted);
    }

    if (allOutcomes.length > 0) {
      await this.recordQuestionOutcomes(studentProfileId, allOutcomes, true);
    }
  }

  /**
   * Sinh & cập nhật Lộ trình Học tập Cá nhân hóa 3 Chặng (`student_roadmap_steps`) trong PostgreSQL
   * dựa trên dữ liệu thực tế từ `student_topic_masteries` + Khung chương trình chuẩn.
   */
  async rebuildPersonalizedRoadmap(
    studentProfileId: string,
    subjectSlug: string,
    grade: number,
  ) {
    const subject = this.normalizeSubjectSlug(subjectSlug);
    const targetGrade = Number(grade || 12);

    const [masteries, behaviorLogs] = await Promise.all([
      this.prisma.studentTopicMastery.findMany({
        where: {
          student_id: studentProfileId,
          subject,
          grade: targetGrade,
        },
        orderBy: [{ mastery_score: 'asc' }, { updated_at: 'desc' }],
      }),
      this.prisma.studentBehaviorHistory.findMany({
        where: {
          student_id: studentProfileId,
          subject,
          grade: targetGrade,
        },
        orderBy: { created_at: 'desc' },
        take: 50,
      }),
    ]);

    const latestBehaviorByTopic = new Map<string, (typeof behaviorLogs)[0]>();
    for (const b of behaviorLogs) {
      if (!latestBehaviorByTopic.has(b.topic_tag)) {
        latestBehaviorByTopic.set(b.topic_tag, b);
      }
    }

    const masteryMap = new Map<string, (typeof masteries)[0]>();
    for (const m of masteries) {
      masteryMap.set(m.topic_tag, m);
    }

    const curriculumSeeds = this.getCurriculumSeeds(subject, targetGrade);
    const mergedTopics: Array<{
      chapterId: number;
      chapterName: string;
      topicTag: string;
      defaultTitle: string;
      mastery?: (typeof masteries)[0];
    }> = [];

    const seenTags = new Set<string>();

    // 1. Đưa toàn bộ các topic học sinh đã thực sự làm bài vào trước
    for (const m of masteries) {
      seenTags.add(m.topic_tag);
      const matchedSeed = curriculumSeeds.find(
        (s) => s.topicTag === m.topic_tag,
      );
      mergedTopics.push({
        chapterId: m.chapter_id || matchedSeed?.chapterId || 1,
        chapterName:
          m.chapter_name ||
          matchedSeed?.chapterName ||
          `Chương ${m.chapter_id || 1}`,
        topicTag: m.topic_tag,
        defaultTitle: matchedSeed?.defaultTitle || `Chuyên đề: ${m.topic_tag}`,
        mastery: m,
      });
    }

    // 2. Bổ sung các chuyên đề trong khung chương trình mà học sinh chưa chạm tới (UNTESTED)
    for (const seed of curriculumSeeds) {
      if (!seenTags.has(seed.topicTag)) {
        seenTags.add(seed.topicTag);
        mergedTopics.push({
          chapterId: seed.chapterId,
          chapterName: seed.chapterName,
          topicTag: seed.topicTag,
          defaultTitle: seed.defaultTitle,
          mastery: undefined,
        });
      }
    }

    // Phân loại vào 3 Chặng (Phases):
    // - Phase 1: Lỗ hổng khẩn cấp (WEAK < 50%) -> Vá gốc & Gỡ bẫy
    // - Phase 2: Cần củng cố (REVIEW 50% - 74%) -> Chuẩn hóa kỹ năng Giải đề
    // - Phase 3: Vững vàng (MASTERED >= 75%) & Chưa khảo sát (UNTESTED) -> Bứt phá Vận dụng cao / Mở khóa chương mới
    const phase1Items = mergedTopics
      .filter((t) => t.mastery && t.mastery.mastery_status === 'WEAK')
      .sort(
        (a, b) =>
          (a.mastery?.mastery_score ?? 0) - (b.mastery?.mastery_score ?? 0),
      );

    const phase2Items = mergedTopics
      .filter((t) => t.mastery && t.mastery.mastery_status === 'REVIEW')
      .sort(
        (a, b) =>
          (a.mastery?.mastery_score ?? 0) - (b.mastery?.mastery_score ?? 0),
      );

    const phase3Mastered = mergedTopics
      .filter((t) => t.mastery && t.mastery.mastery_status === 'MASTERED')
      .sort(
        (a, b) =>
          (a.mastery?.mastery_score ?? 0) - (b.mastery?.mastery_score ?? 0),
      );

    const phase3Untested = mergedTopics
      .filter((t) => !t.mastery || t.mastery.mastery_status === 'UNTESTED')
      .sort((a, b) => a.chapterId - b.chapterId);

    const orderedPlan = [
      ...phase1Items.map((item) => ({ ...item, phase: 1 })),
      ...phase2Items.map((item) => ({ ...item, phase: 2 })),
      ...phase3Untested.map((item) => ({ ...item, phase: 2 })),
      ...phase3Mastered.map((item) => ({ ...item, phase: 3 })),
    ];

    const upsertedSteps: any[] = [];
    let activeRecommendedAssigned = false;

    for (let idx = 0; idx < orderedPlan.length; idx++) {
      const entry = orderedPlan[idx];
      const m = entry.mastery;
      const latestBehavior = latestBehaviorByTopic.get(entry.topicTag);
      const stepOrder = idx + 1;

      const attemptedCount = m ? m.total_attempted : 0;
      const correctCount = m ? m.total_correct : 0;
      const currentMastery = m ? Math.round(m.mastery_score) : 0;
      const statusMastery = m ? m.mastery_status : 'UNTESTED';

      const trapCounts: Record<string, number> =
        m?.trap_counts && typeof m.trap_counts === 'object'
          ? (m.trap_counts as Record<string, number>)
          : {};
      const topTrapEntry = Object.entries(trapCounts).sort(
        (a, b) => b[1] - a[1],
      )[0];
      const topTrapTag = topTrapEntry ? topTrapEntry[0] : null;

      let phase = entry.phase;
      let title = entry.defaultTitle;
      let diagnosticReason = '';
      let recommendedLevel: 'BASIC' | 'MEDIUM' | 'ADVANCED' = 'BASIC';
      let recommendedBloom = 'THONG_HIEU';
      let questionCount = 10;
      let durationMinutes = 15;
      let targetMastery = 75;
      let stepStatus: 'RECOMMENDED' | 'IN_PROGRESS' | 'COMPLETED' | 'LOCKED' =
        'RECOMMENDED';

      if (statusMastery === 'WEAK') {
        phase = 1;
        title = `Vá lỗ hổng: ${entry.topicTag}`;
        recommendedLevel = 'BASIC';
        recommendedBloom =
          m &&
          m.nhan_biet_attempted > 0 &&
          m.nhan_biet_correct < m.nhan_biet_attempted
            ? 'NHAN_BIET'
            : 'THONG_HIEU';
        questionCount = 5;
        durationMinutes = 10;
        targetMastery = 65;

        const accPct =
          attemptedCount > 0
            ? Math.round((correctCount / attemptedCount) * 100)
            : 0;
        diagnosticReason = `Đang đạt ${accPct}% (${correctCount}/${attemptedCount} câu đúng, điểm thành thạo ${currentMastery}%).${
          topTrapTag
            ? ` Hay mắc bẫy: "${topTrapTag}".`
            : ' Cần ôn lại phương pháp giải cốt lõi.'
        }`;

        if (!activeRecommendedAssigned) {
          stepStatus = 'RECOMMENDED';
          activeRecommendedAssigned = true;
        } else {
          stepStatus = 'IN_PROGRESS';
        }
      } else if (statusMastery === 'REVIEW') {
        phase = 2;
        title = `Củng cố & Tăng tốc: ${entry.topicTag}`;
        recommendedLevel = 'MEDIUM';
        recommendedBloom = 'VAN_DUNG';
        questionCount = 10;
        durationMinutes = 20;
        targetMastery = 80;

        const accPct =
          attemptedCount > 0
            ? Math.round((correctCount / attemptedCount) * 100)
            : 0;
        diagnosticReason = `Đã nắm nền tảng (${correctCount}/${attemptedCount} câu đúng - ${accPct}%). Cần luyện thêm câu mức Thông hiểu & Vận dụng để đạt ngưỡng Vững vàng ≥ 75%.${
          topTrapTag ? ` Lưu ý tránh bẫy: "${topTrapTag}".` : ''
        }`;

        if (!activeRecommendedAssigned) {
          stepStatus = 'RECOMMENDED';
          activeRecommendedAssigned = true;
        } else {
          stepStatus = 'IN_PROGRESS';
        }
      } else if (statusMastery === 'MASTERED') {
        phase = 3;
        title = `Bứt phá Vận dụng cao (9+): ${entry.topicTag}`;
        recommendedLevel = 'ADVANCED';
        recommendedBloom = 'VAN_DUNG_CAO';
        questionCount = 10;
        durationMinutes = 25;
        targetMastery = 90;

        const accPct =
          attemptedCount > 0
            ? Math.round((correctCount / attemptedCount) * 100)
            : 100;
        diagnosticReason = `Đã vững vàng (${correctCount}/${attemptedCount} câu đúng - ${accPct}%, thành thạo ${currentMastery}%). Sẵn sàng chinh phục câu hỏi phân hóa Vận dụng cao.`;
        stepStatus = currentMastery >= 85 ? 'COMPLETED' : 'IN_PROGRESS';
      } else {
        // UNTESTED
        phase = phase1Items.length === 0 && phase2Items.length === 0 ? 1 : 2;
        title = `Khảo sát năng lực: ${entry.topicTag}`;
        recommendedLevel = 'BASIC';
        recommendedBloom = 'THONG_HIEU';
        questionCount = 10;
        durationMinutes = 15;
        targetMastery = 75;
        diagnosticReason = `Chuyên đề thuộc ${entry.chapterName} chưa có dữ liệu làm bài. Hãy làm 1 đề khảo sát ngắn để hệ thống đo điểm thành thạo của bạn.`;

        if (!activeRecommendedAssigned) {
          stepStatus = 'RECOMMENDED';
          activeRecommendedAssigned = true;
        } else {
          stepStatus = idx > 3 ? 'LOCKED' : 'IN_PROGRESS';
        }
      }

      // =========================================================================
      // CÁ NHÂN HÓA LỘ TRÌNH DỰA TRÊN HÀNH VI LUYỆN LẠI 3 LẦN (TINH THẦN HỌC TẬP & TRÍ THÔNG MINH)
      // =========================================================================
      const specialBehaviorTag = latestBehavior?.special_tag || null;
      const learningSpiritTag =
        latestBehavior?.learning_spirit_tag || m?.learning_spirit_tag || null;
      const learningSpiritLabel = latestBehavior?.learning_spirit_label || null;
      const learningSpiritScore =
        latestBehavior?.learning_spirit_score ??
        (m?.quick_drill_sessions ? m.learning_spirit_score : null);
      const intelligenceTag =
        latestBehavior?.intelligence_tag || m?.intelligence_tag || null;
      const intelligenceLabel = latestBehavior?.intelligence_label || null;
      const intelligenceScore =
        latestBehavior?.intelligence_score ??
        (m?.quick_drill_sessions ? m.intelligence_score : null);
      const behaviorAdaptationNote =
        latestBehavior?.roadmap_adaptation_note || null;

      if (latestBehavior) {
        if (
          intelligenceTag === 'FAST_ISOMORPHIC_TRANSFER' &&
          learningSpiritTag === 'HIGH_GRIT_PERSISTENT'
        ) {
          // Rất thông minh + Kiên trì 3/3 -> Đẩy thẳng lên Vận dụng / Vận dụng cao, giảm câu cơ bản lặp lại
          recommendedBloom =
            recommendedBloom === 'NHAN_BIET'
              ? 'VAN_DUNG'
              : recommendedBloom === 'THONG_HIEU'
                ? 'VAN_DUNG'
                : 'VAN_DUNG_CAO';
          recommendedLevel =
            recommendedLevel === 'BASIC' ? 'MEDIUM' : 'ADVANCED';
          questionCount = 8;
          durationMinutes = 15;
          title = `Tăng tốc phân hóa: ${entry.topicTag}`;
        } else if (
          intelligenceTag === 'FAST_ISOMORPHIC_TRANSFER' &&
          (learningSpiritTag === 'LOW_PATIENCE_PARTIAL_SKIP' ||
            learningSpiritTag === 'MODERATE_INITIATIVE')
        ) {
          // Thông minh nắm quy luật nhanh nhưng hay skip câu lặp lại -> Thiết kế gói Micro-Sprint 5 câu ngắn gọn
          recommendedBloom = 'VAN_DUNG';
          recommendedLevel = 'MEDIUM';
          questionCount = 5;
          durationMinutes = 8;
          title = `Micro-Sprint 5 câu biến thể: ${entry.topicTag}`;
        } else if (intelligenceTag === 'RAPID_SELF_CORRECTION') {
          // Tự sửa sai nhanh sau lần 1 -> 8 câu mức Thông hiểu - Vận dụng
          recommendedBloom =
            recommendedBloom === 'NHAN_BIET' ? 'THONG_HIEU' : 'VAN_DUNG';
          questionCount = 8;
          durationMinutes = 12;
        } else if (
          learningSpiritTag === 'HIGH_GRIT_PERSISTENT' &&
          (intelligenceTag === 'NEEDS_STEP_BY_STEP_SCAFFOLDING' ||
            intelligenceTag === 'DEVELOPING_PATTERN_LOGIC')
        ) {
          // Chăm chỉ làm đủ 3/3 nhưng còn yếu gốc công thức -> Chia nhỏ bước giải từ Nhận biết
          recommendedBloom = 'NHAN_BIET';
          recommendedLevel = 'BASIC';
          questionCount = 6;
          durationMinutes = 12;
          title = `Bẻ nhỏ bước giải từ gốc: ${entry.topicTag}`;
        } else if (learningSpiritTag === 'AVOIDANCE_SKIPPED') {
          // Hay skip cả 3 câu -> Khởi động nhẹ 5 câu tạo đà tâm lý
          recommendedBloom = 'NHAN_BIET';
          recommendedLevel = 'BASIC';
          questionCount = 5;
          durationMinutes = 6;
          title = `Khởi động nhẹ 5 câu: ${entry.topicTag}`;
        }
      }

      const savedStep = await this.prisma.studentRoadmapStep.upsert({
        where: {
          student_id_subject_grade_topic_tag: {
            student_id: studentProfileId,
            subject,
            grade: targetGrade,
            topic_tag: entry.topicTag,
          },
        },
        create: {
          student_id: studentProfileId,
          subject,
          grade: targetGrade,
          phase,
          step_order: stepOrder,
          chapter_id: entry.chapterId,
          chapter_name: entry.chapterName,
          topic_tag: entry.topicTag,
          title,
          diagnostic_reason: diagnosticReason,
          recommended_level: recommendedLevel,
          recommended_bloom: recommendedBloom,
          question_count: questionCount,
          duration_minutes: durationMinutes,
          current_mastery: currentMastery,
          target_mastery: targetMastery,
          attempted_count: attemptedCount,
          correct_count: correctCount,
          top_trap_tag: topTrapTag,
          special_behavior_tag: specialBehaviorTag,
          learning_spirit_tag: learningSpiritTag,
          learning_spirit_label: learningSpiritLabel,
          learning_spirit_score: learningSpiritScore,
          intelligence_tag: intelligenceTag,
          intelligence_label: intelligenceLabel,
          intelligence_score: intelligenceScore,
          behavior_adaptation_note: behaviorAdaptationNote,
          status: stepStatus,
          completed_at: stepStatus === 'COMPLETED' ? new Date() : null,
        },
        update: {
          phase,
          step_order: stepOrder,
          chapter_id: entry.chapterId,
          chapter_name: entry.chapterName,
          title,
          diagnostic_reason: diagnosticReason,
          recommended_level: recommendedLevel,
          recommended_bloom: recommendedBloom,
          question_count: questionCount,
          duration_minutes: durationMinutes,
          current_mastery: currentMastery,
          target_mastery: targetMastery,
          attempted_count: attemptedCount,
          correct_count: correctCount,
          top_trap_tag: topTrapTag,
          special_behavior_tag: specialBehaviorTag,
          learning_spirit_tag: learningSpiritTag,
          learning_spirit_label: learningSpiritLabel,
          learning_spirit_score: learningSpiritScore,
          intelligence_tag: intelligenceTag,
          intelligence_label: intelligenceLabel,
          intelligence_score: intelligenceScore,
          behavior_adaptation_note: behaviorAdaptationNote,
          status: stepStatus,
          completed_at: stepStatus === 'COMPLETED' ? new Date() : null,
        },
      });

      upsertedSteps.push(savedStep);
    }

    return upsertedSteps;
  }

  /**
   * API 1: Lấy toàn bộ Hồ sơ Kiến thức, Hành vi & Bản đồ Lỗ hổng của học sinh từ PostgreSQL
   */
  async getKnowledgeProfile(params: {
    studentProfileId: string;
    userId: string;
    subjectSlug?: string;
    grade?: number;
  }) {
    const subject = this.normalizeSubjectSlug(params.subjectSlug || 'toan-hoc');
    const grade = Number(params.grade || 12);

    await this.ensureBackfilledFromSubmissions(
      params.studentProfileId,
      subject,
      grade,
    );

    const [masteries, totalSubmissionsCount, behaviorLogs] = await Promise.all([
      this.prisma.studentTopicMastery.findMany({
        where: {
          student_id: params.studentProfileId,
          subject,
          grade,
        },
        orderBy: [{ mastery_score: 'asc' }, { updated_at: 'desc' }],
      }),
      this.prisma.examSubmission.count({
        where: { student_id: params.studentProfileId },
      }),
      this.prisma.studentBehaviorHistory.findMany({
        where: {
          student_id: params.studentProfileId,
          subject,
          grade,
        },
        orderBy: { created_at: 'desc' },
        take: 25,
      }),
    ]);

    let totalAttempted = 0;
    let totalCorrect = 0;
    let totalWrong = 0;
    let totalTimeSeconds = 0;
    let remediationAttempted = 0;
    let remediationCorrect = 0;

    const bloomStats = {
      NHAN_BIET: { label: 'Nhận biết', attempted: 0, correct: 0, accuracy: 0 },
      THONG_HIEU: {
        label: 'Thông hiểu',
        attempted: 0,
        correct: 0,
        accuracy: 0,
      },
      VAN_DUNG: { label: 'Vận dụng', attempted: 0, correct: 0, accuracy: 0 },
      VAN_DUNG_CAO: {
        label: 'Vận dụng cao',
        attempted: 0,
        correct: 0,
        accuracy: 0,
      },
    };

    const globalTraps: Record<
      string,
      { trapTag: string; count: number; topicTag: string }
    > = {};

    for (const m of masteries) {
      totalAttempted += m.total_attempted;
      totalCorrect += m.total_correct;
      totalWrong += m.total_wrong;
      totalTimeSeconds += m.total_time_seconds;
      remediationAttempted += m.remediation_attempted;
      remediationCorrect += m.remediation_correct;

      bloomStats.NHAN_BIET.attempted += m.nhan_biet_attempted;
      bloomStats.NHAN_BIET.correct += m.nhan_biet_correct;
      bloomStats.THONG_HIEU.attempted += m.thong_hieu_attempted;
      bloomStats.THONG_HIEU.correct += m.thong_hieu_correct;
      bloomStats.VAN_DUNG.attempted += m.van_dung_attempted;
      bloomStats.VAN_DUNG.correct += m.van_dung_correct;
      bloomStats.VAN_DUNG_CAO.attempted += m.van_dung_cao_attempted;
      bloomStats.VAN_DUNG_CAO.correct += m.van_dung_cao_correct;

      if (m.trap_counts && typeof m.trap_counts === 'object') {
        for (const [trap, cnt] of Object.entries(
          m.trap_counts as Record<string, number>,
        )) {
          const num = Number(cnt || 0);
          if (num <= 0) continue;
          if (!globalTraps[trap]) {
            globalTraps[trap] = {
              trapTag: trap,
              count: num,
              topicTag: m.topic_tag,
            };
          } else {
            globalTraps[trap].count += num;
          }
        }
      }
    }

    for (const key of Object.keys(bloomStats) as Array<
      keyof typeof bloomStats
    >) {
      const b = bloomStats[key];
      b.accuracy =
        b.attempted > 0 ? Math.round((b.correct / b.attempted) * 100) : 0;
    }

    const overallAccuracy =
      totalAttempted > 0
        ? Math.round((totalCorrect / totalAttempted) * 100)
        : 0;
    const overallMasteryScore =
      masteries.length > 0
        ? Math.round(
            masteries.reduce(
              (acc, m) => acc + Number(m.mastery_score || 0),
              0,
            ) / masteries.length,
          )
        : 0;

    // Tổng hợp hồ sơ Hành vi (Tinh thần học tập & Trí thông minh nhận diện dạng bài)
    const totalQuickDrillSessions = behaviorLogs.length;
    const totalTurnsCompleted = behaviorLogs.reduce(
      (s, b) => s + b.completed_turns,
      0,
    );
    const totalTurnsSkipped = behaviorLogs.reduce(
      (s, b) => s + b.skipped_turns,
      0,
    );
    const totalTurnsCorrect = behaviorLogs.reduce(
      (s, b) => s + b.correct_turns,
      0,
    );
    const avgLearningSpiritScore =
      totalQuickDrillSessions > 0
        ? Math.round(
            behaviorLogs.reduce(
              (s, b) => s + Number(b.learning_spirit_score || 70),
              0,
            ) / totalQuickDrillSessions,
          )
        : 75;
    const avgIntelligenceScore =
      totalQuickDrillSessions > 0
        ? Math.round(
            behaviorLogs.reduce(
              (s, b) => s + Number(b.intelligence_score || 70),
              0,
            ) / totalQuickDrillSessions,
          )
        : 75;

    const latestBehavior = behaviorLogs[0] || null;
    const behaviorSummary = {
      specialTag: '#LUYEN_LAI_3_LAN_CUNG_DANG',
      totalQuickDrillSessions,
      totalTurnsCompleted,
      totalTurnsSkipped,
      totalTurnsCorrect,
      avgLearningSpiritScore,
      learningSpiritTag:
        latestBehavior?.learning_spirit_tag ||
        (avgLearningSpiritScore >= 85
          ? 'HIGH_GRIT_PERSISTENT'
          : avgLearningSpiritScore >= 65
            ? 'MODERATE_INITIATIVE'
            : 'LOW_PATIENCE_PARTIAL_SKIP'),
      learningSpiritLabel:
        latestBehavior?.learning_spirit_label ||
        (avgLearningSpiritScore >= 85
          ? '🔥 Tinh thần Cầu tiến Cao (Kiên trì rèn luyện)'
          : avgLearningSpiritScore >= 65
            ? '⚡ Chủ động Khắc phục lỗi sai'
            : 'Chưa có dữ liệu luyện lại 3 lần'),
      avgIntelligenceScore,
      intelligenceTag:
        latestBehavior?.intelligence_tag ||
        (avgIntelligenceScore >= 85
          ? 'FAST_ISOMORPHIC_TRANSFER'
          : avgIntelligenceScore >= 70
            ? 'RAPID_SELF_CORRECTION'
            : 'DEVELOPING_PATTERN_LOGIC'),
      intelligenceLabel:
        latestBehavior?.intelligence_label ||
        (avgIntelligenceScore >= 85
          ? '🧠 Tư duy Đẳng cấu Nhạy bén'
          : avgIntelligenceScore >= 70
            ? '📈 Tự thích nghi & Sửa sai Nhanh'
            : '🔍 Tư duy Đang định hình'),
      latestAdaptationNote: latestBehavior?.roadmap_adaptation_note || null,
    };

    const formattedBehaviorHistory = behaviorLogs.slice(0, 10).map((b) => ({
      id: b.id,
      subject: b.subject,
      grade: b.grade,
      chapterId: b.chapter_id,
      chapterName: b.chapter_name,
      topicTag: b.topic_tag,
      sourceQuestionId: b.source_question_id,
      sourceQuestionTitle: b.source_question_title,
      bloomLevel: b.bloom_level,
      trapTag: b.trap_tag,
      specialTag: b.special_tag,
      isScored: b.is_scored,
      totalTurns: b.total_turns,
      completedTurns: b.completed_turns,
      skippedTurns: b.skipped_turns,
      correctTurns: b.correct_turns,
      wrongTurns: b.wrong_turns,
      usedAiExample: b.used_ai_example,
      totalTimeSeconds: b.total_time_seconds,
      turnOutcomes: b.turn_outcomes,
      learningSpiritTag: b.learning_spirit_tag,
      learningSpiritLabel: b.learning_spirit_label,
      learningSpiritScore: Math.round(b.learning_spirit_score),
      intelligenceTag: b.intelligence_tag,
      intelligenceLabel: b.intelligence_label,
      intelligenceScore: Math.round(b.intelligence_score),
      roadmapStrategyTag: b.roadmap_strategy_tag,
      roadmapAdaptationNote: b.roadmap_adaptation_note,
      createdAt: b.created_at,
    }));

    // Kết hợp với danh mục khung chương trình để biết cả các chuyên đề UNTESTED
    const curriculumSeeds = this.getCurriculumSeeds(subject, grade);
    const masteryByTag = new Map(masteries.map((m) => [m.topic_tag, m]));

    const allTopicItems = [
      ...masteries.map((m) => {
        const trapsObj =
          m.trap_counts && typeof m.trap_counts === 'object'
            ? (m.trap_counts as Record<string, number>)
            : {};
        const topTraps = Object.entries(trapsObj)
          .sort((a, b) => b[1] - a[1])
          .map(([trapTag, count]) => ({ trapTag, count }));

        return {
          id: m.id,
          subject: m.subject,
          grade: m.grade,
          chapterId: m.chapter_id,
          chapterName: m.chapter_name || `Chương ${m.chapter_id}`,
          topicTag: m.topic_tag,
          totalAttempted: m.total_attempted,
          totalCorrect: m.total_correct,
          totalWrong: m.total_wrong,
          accuracyPercent:
            m.total_attempted > 0
              ? Math.round((m.total_correct / m.total_attempted) * 100)
              : 0,
          masteryScore: Math.round(m.mastery_score),
          masteryStatus: m.mastery_status as
            'WEAK' | 'REVIEW' | 'MASTERED' | 'UNTESTED',
          bloomBreakdown: {
            NHAN_BIET: {
              attempted: m.nhan_biet_attempted,
              correct: m.nhan_biet_correct,
            },
            THONG_HIEU: {
              attempted: m.thong_hieu_attempted,
              correct: m.thong_hieu_correct,
            },
            VAN_DUNG: {
              attempted: m.van_dung_attempted,
              correct: m.van_dung_correct,
            },
            VAN_DUNG_CAO: {
              attempted: m.van_dung_cao_attempted,
              correct: m.van_dung_cao_correct,
            },
          },
          remediationAttempted: m.remediation_attempted,
          remediationCorrect: m.remediation_correct,
          quickDrillSessions: m.quick_drill_sessions,
          quickDrillCompletedTurns: m.quick_drill_completed_turns,
          quickDrillSkippedTurns: m.quick_drill_skipped_turns,
          quickDrillCorrectTurns: m.quick_drill_correct_turns,
          learningSpiritScore: Math.round(m.learning_spirit_score || 70),
          learningSpiritTag: m.learning_spirit_tag,
          intelligenceScore: Math.round(m.intelligence_score || 70),
          intelligenceTag: m.intelligence_tag,
          avgSecondsPerQuestion:
            m.total_attempted > 0
              ? Math.round(m.total_time_seconds / m.total_attempted)
              : 0,
          topTraps,
          lastPracticedAt: m.last_practiced_at,
        };
      }),
      ...curriculumSeeds
        .filter((s) => !masteryByTag.has(s.topicTag))
        .map((s) => ({
          id: `untested-${subject}-${grade}-${s.chapterId}-${s.topicTag}`,
          subject,
          grade,
          chapterId: s.chapterId,
          chapterName: s.chapterName,
          topicTag: s.topicTag,
          totalAttempted: 0,
          totalCorrect: 0,
          totalWrong: 0,
          accuracyPercent: 0,
          masteryScore: 0,
          masteryStatus: 'UNTESTED' as const,
          bloomBreakdown: {
            NHAN_BIET: { attempted: 0, correct: 0 },
            THONG_HIEU: { attempted: 0, correct: 0 },
            VAN_DUNG: { attempted: 0, correct: 0 },
            VAN_DUNG_CAO: { attempted: 0, correct: 0 },
          },
          remediationAttempted: 0,
          remediationCorrect: 0,
          quickDrillSessions: 0,
          quickDrillCompletedTurns: 0,
          quickDrillSkippedTurns: 0,
          quickDrillCorrectTurns: 0,
          learningSpiritScore: 70,
          learningSpiritTag: null,
          intelligenceScore: 70,
          intelligenceTag: null,
          avgSecondsPerQuestion: 0,
          topTraps: [],
          lastPracticedAt: null,
        })),
    ];

    const weakTopics = allTopicItems.filter((t) => t.masteryStatus === 'WEAK');
    const reviewTopics = allTopicItems.filter(
      (t) => t.masteryStatus === 'REVIEW',
    );
    const masteredTopics = allTopicItems.filter(
      (t) => t.masteryStatus === 'MASTERED',
    );
    const untestedTopics = allTopicItems.filter(
      (t) => t.masteryStatus === 'UNTESTED',
    );

    return {
      studentProfileId: params.studentProfileId,
      userId: params.userId,
      subject,
      grade,
      summary: {
        totalExamsSubmitted: totalSubmissionsCount,
        totalQuestionsAttempted: totalAttempted,
        totalCorrect,
        totalWrong,
        overallAccuracyPercent: overallAccuracy,
        overallMasteryScore,
        avgSecondsPerQuestion:
          totalAttempted > 0
            ? Math.round(totalTimeSeconds / totalAttempted)
            : 0,
        remediationAttempted,
        remediationCorrect,
        countsByStatus: {
          weak: weakTopics.length,
          review: reviewTopics.length,
          mastered: masteredTopics.length,
          untested: untestedTopics.length,
          totalCurriculumTopics: allTopicItems.length,
        },
      },
      behaviorSummary,
      recentBehaviorHistory: formattedBehaviorHistory,
      bloomStats,
      frequentTraps: Object.values(globalTraps)
        .sort((a, b) => b.count - a.count)
        .slice(0, 6),
      topics: allTopicItems,
      groupedTopics: {
        weak: weakTopics,
        review: reviewTopics,
        mastered: masteredTopics,
        untested: untestedTopics,
      },
    };
  }

  /**
   * API 2: Lấy Lộ trình Học tập Cá nhân hóa 3 Chặng từ PostgreSQL
   */
  async getPersonalizedRoadmap(params: {
    studentProfileId: string;
    userId: string;
    subjectSlug?: string;
    grade?: number;
  }) {
    const subject = this.normalizeSubjectSlug(params.subjectSlug || 'toan-hoc');
    const grade = Number(params.grade || 12);

    await this.ensureBackfilledFromSubmissions(
      params.studentProfileId,
      subject,
      grade,
    );

    let steps = await this.prisma.studentRoadmapStep.findMany({
      where: {
        student_id: params.studentProfileId,
        subject,
        grade,
      },
      orderBy: [{ phase: 'asc' }, { step_order: 'asc' }],
    });

    if (steps.length === 0) {
      steps = await this.rebuildPersonalizedRoadmap(
        params.studentProfileId,
        subject,
        grade,
      );
    }

    const profileData = await this.getKnowledgeProfile(params);

    const formattedSteps = steps.map((s) => {
      const levelSlug =
        s.recommended_level === 'ADVANCED'
          ? 'advanced'
          : s.recommended_level === 'MEDIUM'
            ? 'medium'
            : 'basic';
      const difficultyParam =
        s.recommended_bloom === 'NHAN_BIET'
          ? 'EASY'
          : s.recommended_bloom === 'VAN_DUNG'
            ? 'HARD'
            : s.recommended_bloom === 'VAN_DUNG_CAO'
              ? 'VERY_HARD'
              : 'MEDIUM';

      const practiceUrl = `/student/practice/exam-room?subject=${encodeURIComponent(
        s.subject,
      )}&grade=${s.grade}&chapter=${s.chapter_id}&level=${levelSlug}&mode=TOPIC&topic=${encodeURIComponent(
        s.topic_tag,
      )}&difficulty=${difficultyParam}&qCount=${s.question_count}`;

      return {
        id: s.id,
        phase: s.phase,
        phaseLabel:
          s.phase === 1
            ? 'Chặng 1: Vá lỗ hổng & Gỡ bẫy sai lầm'
            : s.phase === 2
              ? 'Chặng 2: Củng cố & Chuẩn hóa theo Chương'
              : 'Chặng 3: Bứt phá Vận dụng cao (8.5+ / 9+)',
        stepOrder: s.step_order,
        subject: s.subject,
        grade: s.grade,
        chapterId: s.chapter_id,
        chapterName: s.chapter_name || `Chương ${s.chapter_id}`,
        topicTag: s.topic_tag,
        title: s.title,
        diagnosticReason: s.diagnostic_reason,
        recommendedLevel: s.recommended_level,
        recommendedBloom: s.recommended_bloom,
        questionCount: s.question_count,
        durationMinutes: s.duration_minutes,
        currentMastery: Math.round(s.current_mastery),
        targetMastery: Math.round(s.target_mastery),
        attemptedCount: s.attempted_count,
        correctCount: s.correct_count,
        topTrapTag: s.top_trap_tag,
        specialBehaviorTag: s.special_behavior_tag,
        learningSpiritTag: s.learning_spirit_tag,
        learningSpiritLabel: s.learning_spirit_label,
        learningSpiritScore:
          s.learning_spirit_score !== null &&
          s.learning_spirit_score !== undefined
            ? Math.round(s.learning_spirit_score)
            : null,
        intelligenceTag: s.intelligence_tag,
        intelligenceLabel: s.intelligence_label,
        intelligenceScore:
          s.intelligence_score !== null && s.intelligence_score !== undefined
            ? Math.round(s.intelligence_score)
            : null,
        behaviorAdaptationNote: s.behavior_adaptation_note,
        status: s.status as
          'RECOMMENDED' | 'IN_PROGRESS' | 'COMPLETED' | 'LOCKED',
        practiceUrl,
        updatedAt: s.updated_at,
      };
    });

    const phases = [
      {
        phase: 1,
        title: 'Chặng 1: Vá lỗ hổng & Gỡ bẫy sai lầm',
        subtitle:
          'Ưu tiên khắc phục ngay các chuyên đề có độ thành thạo < 50% hoặc hay sập bẫy đề thi.',
        badge: 'Ưu tiên số 1',
        steps: formattedSteps.filter((s) => s.phase === 1),
      },
      {
        phase: 2,
        title: 'Chặng 2: Củng cố & Chuẩn hóa theo Chương',
        subtitle:
          'Nâng các chuyên đề đang ở mức 50–74% lên ngưỡng Vững vàng và khảo sát các chương mới.',
        badge: 'Tăng tốc',
        steps: formattedSteps.filter((s) => s.phase === 2),
      },
      {
        phase: 3,
        title: 'Chặng 3: Bứt phá Vận dụng cao (8.5+ / 9+)',
        subtitle:
          'Thử thách các câu hỏi phân hóa Vận dụng cao trên những chuyên đề bạn đã nắm vững ≥ 75%.',
        badge: 'Mục tiêu 9+',
        steps: formattedSteps.filter((s) => s.phase === 3),
      },
    ].filter((p) => p.steps.length > 0);

    const primaryRecommendation =
      formattedSteps.find((s) => s.status === 'RECOMMENDED') ||
      formattedSteps.find((s) => s.status === 'IN_PROGRESS') ||
      formattedSteps[0] ||
      null;

    return {
      studentProfileId: params.studentProfileId,
      userId: params.userId,
      subject,
      grade,
      knowledgeSummary: profileData.summary,
      behaviorSummary: profileData.behaviorSummary,
      recentBehaviorHistory: profileData.recentBehaviorHistory,
      bloomStats: profileData.bloomStats,
      frequentTraps: profileData.frequentTraps,
      primaryRecommendation,
      phases,
      steps: formattedSteps,
    };
  }

  /**
   * API 3: Nộp kết quả bài Luyện bù biến thể (Remediation) lên PostgreSQL
   * - Cập nhật `snapshot_data.remediation` trong `exam_submissions`
   * - Cộng điểm phục hồi `remediation_attempted` & `remediation_correct` vào `student_topic_masteries`
   * - Tự động cập nhật lại Lộ trình Cá nhân hóa
   */
  async submitRemediationResult(
    studentProfileId: string,
    userId: string,
    dto: SubmitRemediationDto,
  ) {
    const subject = this.normalizeSubjectSlug(dto.subjectSlug || 'toan-hoc');
    const grade = Number(dto.grade || 12);
    const defaultChapterId = Number(dto.chapterId || 1);

    // 1. Cập nhật snapshot_data trong bảng exam_submissions nếu tìm thấy bài thi gốc
    const lookupKey = dto.attemptToken || dto.snapshotId;
    if (lookupKey) {
      const existingSub = await this.prisma.examSubmission.findFirst({
        where: {
          OR: [
            { attempt_token: lookupKey },
            ...(/^[0-9a-f-]{36}$/i.test(lookupKey) ? [{ id: lookupKey }] : []),
          ],
        },
      });

      if (existingSub) {
        const snap = (existingSub.snapshot_data || {}) as Record<string, any>;
        const updatedSnap = {
          ...snap,
          remediation: {
            attempted: true,
            attemptedAt: new Date().toISOString(),
            finalScore: Number(dto.finalScore ?? 0),
            totalQuestions: Number(dto.totalQuestions ?? 0),
            correctCount: Number(dto.correctCount ?? 0),
            questions: dto.questions || [],
            studentAnswers: dto.studentAnswers || {},
          },
        };

        await this.prisma.examSubmission.update({
          where: { id: existingSub.id },
          data: { snapshot_data: updatedSnap },
        });
      }
    }

    // 2. Bóc tách kết quả từng câu trong bài Luyện bù để cập nhật Mastery Score
    const outcomes: QuestionAttemptOutcome[] = [];
    if (
      Array.isArray(dto.questionOutcomes) &&
      dto.questionOutcomes.length > 0
    ) {
      for (const qo of dto.questionOutcomes) {
        const chapterId = Number(qo.chapterId || defaultChapterId);
        const seeds = this.getCurriculumSeeds(subject, grade);
        const fallbackTopic =
          seeds.find((s) => s.chapterId === chapterId)?.topicTag ||
          seeds[0]?.topicTag ||
          `Chuyên đề Chương ${chapterId}`;

        outcomes.push({
          questionId: qo.questionId,
          subject,
          grade,
          chapterId,
          topicTag: String(qo.topicTag || fallbackTopic).trim(),
          trapTag: qo.trapTag ? String(qo.trapTag).trim() : undefined,
          bloomLevel: this.normalizeBloomLevel(qo.bloomLevel || qo.difficulty),
          isCorrect: Boolean(qo.isCorrect),
          isRemediation: true,
          timeSpentSeconds: Number(qo.timeSpentSeconds || 30),
          attemptedAt: new Date().toISOString(),
        });
      }
    } else if (Array.isArray(dto.questions) && dto.questions.length > 0) {
      const remMc = dto.studentAnswers?.multipleChoices || {};
      const remTf = dto.studentAnswers?.trueFalseAnswers || {};
      const remSa = dto.studentAnswers?.shortAnswers || {};

      for (const rq of dto.questions) {
        const rqId = String(rq.id || '');
        let isCorrect = false;
        if (rq.type === 'TRUE_FALSE' && Array.isArray(rq.subQuestions)) {
          const uTf = remTf[rqId] || {};
          isCorrect = rq.subQuestions.every(
            (sq: any) => Boolean(uTf[sq.id]) === Boolean(sq.isTrue),
          );
        } else if (rq.type === 'SHORT_ANSWER') {
          const uSa = String(remSa[rqId] ?? '')
            .trim()
            .replace(',', '.');
          const tSa = String(rq.shortAnswerValue ?? '')
            .trim()
            .replace(',', '.');
          isCorrect = uSa.length > 0 && uSa === tSa;
        } else {
          const uMc = remMc[rqId];
          isCorrect = Boolean(
            uMc && rq.correctChoice && uMc === rq.correctChoice,
          );
        }

        const chapterId = Number(rq.chapterId || defaultChapterId);
        const seeds = this.getCurriculumSeeds(subject, grade);
        const fallbackTopic =
          seeds.find((s) => s.chapterId === chapterId)?.topicTag ||
          seeds[0]?.topicTag ||
          `Chuyên đề Chương ${chapterId}`;

        outcomes.push({
          questionId: rqId || undefined,
          subject,
          grade,
          chapterId,
          topicTag: String(rq.topicTag || fallbackTopic).trim(),
          trapTag: rq.trapTag ? String(rq.trapTag).trim() : undefined,
          bloomLevel: this.normalizeBloomLevel(rq.bloomLevel || rq.difficulty),
          isCorrect,
          isRemediation: true,
          timeSpentSeconds: 30,
          attemptedAt: new Date().toISOString(),
        });
      }
    }

    const knowledgeUpdate = await this.recordQuestionOutcomes(
      studentProfileId,
      outcomes,
      true,
    );

    const roadmap = await this.getPersonalizedRoadmap({
      studentProfileId,
      userId,
      subjectSlug: subject,
      grade,
    });

    return {
      remediationSaved: true,
      knowledgeUpdate,
      roadmap,
    };
  }

  /**
   * API 4: Lưu Lịch sử Hành vi khi học sinh Luyện lại nhanh 3 câu cùng dạng (Không tính điểm học vụ)
   * vào bảng PostgreSQL `student_behavior_histories`, gắn Tag đặc biệt `#LUYEN_LAI_3_LAN_CUNG_DANG`,
   * đánh giá Tinh thần học tập (Grit) & Trí thông minh nhận diện quy luật (Intelligence),
   * và tự động thiết kế lại Lộ trình Cá nhân hóa (`student_roadmap_steps`).
   */
  async recordQuickDrillBehavior(
    studentProfileId: string,
    userId: string,
    dto: RecordQuickDrillBehaviorDto,
  ) {
    const subject = this.normalizeSubjectSlug(dto.subjectSlug || 'toan-hoc');
    const grade = Number(dto.grade || 12);
    const chapterId = Number(dto.chapterId || 1);
    const seeds = this.getCurriculumSeeds(subject, grade);
    const matchedSeed =
      seeds.find((s) => s.chapterId === chapterId) || seeds[0];
    const chapterName =
      dto.chapterName || matchedSeed?.chapterName || `Chương ${chapterId}`;
    const topicTag = String(
      dto.topicTag || matchedSeed?.topicTag || `Chuyên đề Chương ${chapterId}`,
    ).trim();
    const bloomLevel = this.normalizeBloomLevel(dto.bloomLevel);
    const specialTag = dto.specialTag || '#LUYEN_LAI_3_LAN_CUNG_DANG';

    const rawTurns = Array.isArray(dto.turnOutcomes) ? dto.turnOutcomes : [];
    const normalizedTurns: Array<{
      turn: number;
      questionId?: string;
      status: 'CORRECT' | 'WRONG' | 'SKIPPED';
      selectedAnswer?: string;
      correctAnswer?: string;
      timeSpentSeconds: number;
    }> = [1, 2, 3].map((turnNo) => {
      const found = rawTurns.find(
        (t: any) => Number(t.turn ?? t.turnIndex) === turnNo,
      );
      const status =
        found?.status === 'CORRECT' || found?.status === 'WRONG'
          ? found.status
          : 'SKIPPED';
      return {
        turn: turnNo,
        questionId: found?.questionId,
        status,
        selectedAnswer: found?.selectedAnswer || (found as any)?.selectedKey,
        correctAnswer: found?.correctAnswer,
        timeSpentSeconds: Math.max(0, Number(found?.timeSpentSeconds || 0)),
      };
    });

    const completedTurns = normalizedTurns.filter(
      (t) => t.status !== 'SKIPPED',
    ).length;
    const skippedTurns = normalizedTurns.filter(
      (t) => t.status === 'SKIPPED',
    ).length;
    const correctTurns = normalizedTurns.filter(
      (t) => t.status === 'CORRECT',
    ).length;
    const wrongTurns = normalizedTurns.filter(
      (t) => t.status === 'WRONG',
    ).length;
    const totalTimeSeconds =
      Number(dto.totalTimeSeconds || 0) ||
      normalizedTurns.reduce((s, t) => s + t.timeSpentSeconds, 0);

    // 1. Đánh giá Tinh thần học tập (Learning Spirit / Grit)
    let learningSpiritTag = 'HIGH_GRIT_PERSISTENT';
    let learningSpiritLabel =
      '🔥 Tinh thần Cầu tiến Cao (Kiên trì làm đủ 3/3 lần)';
    let learningSpiritScore = 92;

    if (completedTurns === 3) {
      learningSpiritTag = 'HIGH_GRIT_PERSISTENT';
      learningSpiritLabel =
        '🔥 Tinh thần Cầu tiến Cao (Kiên trì làm đủ 3/3 lần)';
      learningSpiritScore =
        correctTurns === 3 ? 98 : correctTurns === 2 ? 94 : 90;
    } else if (completedTurns === 2) {
      learningSpiritTag = 'MODERATE_INITIATIVE';
      learningSpiritLabel =
        '⚡ Chủ động Rèn luyện (Hoàn thành 2/3 lần, Skip 1 lần)';
      learningSpiritScore = correctTurns === 2 ? 78 : 70;
    } else if (completedTurns === 1) {
      learningSpiritTag = 'LOW_PATIENCE_PARTIAL_SKIP';
      learningSpiritLabel = '⏳ Kiên trì Ngắn hạn (Làm 1/3 lần rồi Skip)';
      learningSpiritScore = correctTurns === 1 ? 54 : 42;
    } else {
      learningSpiritTag = 'AVOIDANCE_SKIPPED';
      learningSpiritLabel = '⚠️ Tâm lý Ngại khó (Skip cả 3/3 lần luyện lại)';
      learningSpiritScore = 22;
    }

    // 2. Đánh giá Trí thông minh & Nhạy bén tư duy (Cognitive Pattern Transfer)
    const t1 = normalizedTurns[0]?.status;
    const t2 = normalizedTurns[1]?.status;
    const t3 = normalizedTurns[2]?.status;

    let intelligenceTag = 'DEVELOPING_PATTERN_LOGIC';
    let intelligenceLabel =
      '🔍 Tư duy Đang định hình (Cần rèn thêm bước biến đổi số học)';
    let intelligenceScore = 65;

    if (
      correctTurns === 3 ||
      (completedTurns === 2 && correctTurns === 2) ||
      (completedTurns === 1 && correctTurns === 1)
    ) {
      intelligenceTag = 'FAST_ISOMORPHIC_TRANSFER';
      intelligenceLabel =
        '🧠 Tư duy Đẳng cấu Nhạy bén (Nhận diện quy luật ngay từ 1 gợi ý chung)';
      intelligenceScore =
        correctTurns === 3 ? 96 : correctTurns === 2 ? 90 : 84;
    } else if (t1 === 'WRONG' && (t2 === 'CORRECT' || t3 === 'CORRECT')) {
      intelligenceTag = 'RAPID_SELF_CORRECTION';
      intelligenceLabel =
        '📈 Tự thích nghi & Sửa sai Nhanh (Rút kinh nghiệm ngay sau lần làm đầu)';
      intelligenceScore = correctTurns === 2 ? 86 : 78;
    } else if (correctTurns >= 1) {
      intelligenceTag = 'DEVELOPING_PATTERN_LOGIC';
      intelligenceLabel =
        '🔍 Tư duy Đang định hình (Nắm được hướng giải nhưng còn nhầm bước tính toán)';
      intelligenceScore = 64;
    } else if (completedTurns === 0) {
      intelligenceTag = 'UNMEASURED_DUE_TO_SKIP';
      intelligenceLabel = '⏸ Chưa đo lường sâu (Do bỏ qua cả 3 lần luyện)';
      intelligenceScore = 50;
    } else {
      intelligenceTag = 'NEEDS_STEP_BY_STEP_SCAFFOLDING';
      intelligenceLabel =
        '🧩 Cần Bẻ nhỏ Bước giải (Chưa nắm vững bản chất công thức cốt lõi)';
      intelligenceScore = 40;
    }

    // 3. Thiết kế chiến lược điều chỉnh Lộ trình Cá nhân hóa hợp lý hơn
    let roadmapStrategyTag = 'CONSOLIDATE_VARIATIONS';
    let roadmapAdaptationNote = '';

    if (
      intelligenceTag === 'FAST_ISOMORPHIC_TRANSFER' &&
      learningSpiritTag === 'HIGH_GRIT_PERSISTENT'
    ) {
      roadmapStrategyTag = 'ACCELERATE_ADVANCED';
      roadmapAdaptationNote =
        'Học sinh vừa nhạy bén nắm quy luật ngay từ gợi ý đầu, vừa kiên trì hoàn thành 3/3 lần. Hệ thống rút ngắn câu cơ bản lặp lại và nâng thẳng lộ trình chuyên đề này lên mức Vận dụng / Vận dụng cao (8 câu phân hóa).';
    } else if (
      intelligenceTag === 'FAST_ISOMORPHIC_TRANSFER' &&
      (learningSpiritTag === 'LOW_PATIENCE_PARTIAL_SKIP' ||
        learningSpiritTag === 'MODERATE_INITIATIVE')
    ) {
      roadmapStrategyTag = 'MICRO_SPRINT_ANTI_BOREDOM';
      roadmapAdaptationNote =
        'Tư duy nhạy bén (làm đúng ngay nhưng Skip các câu lặp lại). Để tránh nhàm chán, hệ thống thiết kế lại lộ trình dạng Micro-Sprint: 5 câu ngắn gọn (8 phút) nâng độ khó lên Vận dụng thay vì bắt làm đề dài.';
    } else if (intelligenceTag === 'RAPID_SELF_CORRECTION') {
      roadmapStrategyTag = 'CONSOLIDATE_VARIATIONS';
      roadmapAdaptationNote =
        'Có khả năng tự sửa sai nhanh sau lần thử đầu tiên. Hệ thống thiết kế lộ trình 8 câu biến thể mức Thông hiểu → Vận dụng (12 phút) để khóa chặt phản xạ.';
    } else if (
      learningSpiritTag === 'HIGH_GRIT_PERSISTENT' &&
      (intelligenceTag === 'NEEDS_STEP_BY_STEP_SCAFFOLDING' ||
        intelligenceTag === 'DEVELOPING_PATTERN_LOGIC')
    ) {
      roadmapStrategyTag = 'SCAFFOLD_STEP_BY_STEP';
      roadmapAdaptationNote =
        'Tinh thần tự giác rất tốt (kiên trì làm đủ 3/3 lần không bỏ cuộc), nhưng còn vướng công thức gốc. Hệ thống điều chỉnh lộ trình về gói 6 câu Nhận biết → Thông hiểu có gợi ý dẫn dắt từng bước.';
    } else {
      roadmapStrategyTag = 'WARMUP_LOW_FRICTION';
      roadmapAdaptationNote =
        'Học sinh có xu hướng Skip khi gặp dạng bài sai. Hệ thống thiết kế lại chặng này thành gói Khởi động nhẹ 5 câu Dễ (6 phút) để tạo đà tâm lý tự tin trước khi nâng cấp.';
    }

    // 4. Lưu vào bảng thật PostgreSQL `student_behavior_histories`
    const savedHistory = await this.prisma.studentBehaviorHistory.create({
      data: {
        student_id: studentProfileId,
        submission_id: dto.snapshotId || null,
        attempt_token: dto.attemptToken || null,
        subject,
        grade,
        chapter_id: chapterId,
        chapter_name: chapterName,
        topic_tag: topicTag,
        source_question_id: dto.sourceQuestionId || null,
        source_question_title: dto.sourceQuestionTitle || null,
        bloom_level: bloomLevel,
        trap_tag: dto.trapTag || null,
        special_tag: specialTag,
        is_scored: false, // Không tính điểm học vụ
        total_turns: 3,
        completed_turns: completedTurns,
        skipped_turns: skippedTurns,
        correct_turns: correctTurns,
        wrong_turns: wrongTurns,
        used_ai_example: Boolean(dto.usedAiExample),
        total_time_seconds: totalTimeSeconds,
        turn_outcomes: normalizedTurns,
        learning_spirit_tag: learningSpiritTag,
        learning_spirit_label: learningSpiritLabel,
        learning_spirit_score: learningSpiritScore,
        intelligence_tag: intelligenceTag,
        intelligence_label: intelligenceLabel,
        intelligence_score: intelligenceScore,
        roadmap_strategy_tag: roadmapStrategyTag,
        roadmap_adaptation_note: roadmapAdaptationNote,
      },
    });

    // 5. Cập nhật chỉ số hành vi & phục hồi vào `student_topic_masteries` (KHÔNG cộng vào total_attempted/total_correct của điểm thi)
    const existingMastery = await this.prisma.studentTopicMastery.findUnique({
      where: {
        student_id_subject_grade_topic_tag: {
          student_id: studentProfileId,
          subject,
          grade,
          topic_tag: topicTag,
        },
      },
    });

    const prevSpirit = existingMastery?.learning_spirit_score ?? 70;
    const prevIntel = existingMastery?.intelligence_score ?? 70;
    const nextSpirit = Math.round(prevSpirit * 0.4 + learningSpiritScore * 0.6);
    const nextIntel = Math.round(prevIntel * 0.4 + intelligenceScore * 0.6);

    const nextRemAttempted =
      (existingMastery?.remediation_attempted || 0) + completedTurns;
    const nextRemCorrect =
      (existingMastery?.remediation_correct || 0) + correctTurns;

    const { score: updatedMasteryScore, status: updatedMasteryStatus } =
      this.computeMasteryScoreAndStatus({
        nhanBietAttempted: existingMastery?.nhan_biet_attempted || 0,
        nhanBietCorrect: existingMastery?.nhan_biet_correct || 0,
        thongHieuAttempted: existingMastery?.thong_hieu_attempted || 0,
        thongHieuCorrect: existingMastery?.thong_hieu_correct || 0,
        vanDungAttempted: existingMastery?.van_dung_attempted || 0,
        vanDungCorrect: existingMastery?.van_dung_correct || 0,
        vanDungCaoAttempted: existingMastery?.van_dung_cao_attempted || 0,
        vanDungCaoCorrect: existingMastery?.van_dung_cao_correct || 0,
        remediationAttempted: nextRemAttempted,
        remediationCorrect: nextRemCorrect,
        recentHistory: Array.isArray(existingMastery?.recent_history)
          ? (existingMastery.recent_history as any[])
          : [],
      });

    await this.prisma.studentTopicMastery.upsert({
      where: {
        student_id_subject_grade_topic_tag: {
          student_id: studentProfileId,
          subject,
          grade,
          topic_tag: topicTag,
        },
      },
      create: {
        student_id: studentProfileId,
        subject,
        grade,
        chapter_id: chapterId,
        chapter_name: chapterName,
        topic_tag: topicTag,
        remediation_attempted: completedTurns,
        remediation_correct: correctTurns,
        quick_drill_sessions: 1,
        quick_drill_completed_turns: completedTurns,
        quick_drill_skipped_turns: skippedTurns,
        quick_drill_correct_turns: correctTurns,
        learning_spirit_score: learningSpiritScore,
        learning_spirit_tag: learningSpiritTag,
        intelligence_score: intelligenceScore,
        intelligence_tag: intelligenceTag,
        mastery_score: updatedMasteryScore,
        mastery_status: updatedMasteryStatus,
        last_practiced_at: new Date(),
      },
      update: {
        remediation_attempted: nextRemAttempted,
        remediation_correct: nextRemCorrect,
        quick_drill_sessions: (existingMastery?.quick_drill_sessions || 0) + 1,
        quick_drill_completed_turns:
          (existingMastery?.quick_drill_completed_turns || 0) + completedTurns,
        quick_drill_skipped_turns:
          (existingMastery?.quick_drill_skipped_turns || 0) + skippedTurns,
        quick_drill_correct_turns:
          (existingMastery?.quick_drill_correct_turns || 0) + correctTurns,
        learning_spirit_score: nextSpirit,
        learning_spirit_tag: learningSpiritTag,
        intelligence_score: nextIntel,
        intelligence_tag: intelligenceTag,
        mastery_score: updatedMasteryScore,
        mastery_status: updatedMasteryStatus,
        last_practiced_at: new Date(),
      },
    });

    // 6. Tái thiết kế Lộ trình Cá nhân hóa dựa trên dữ liệu hành vi vừa lưu
    await this.rebuildPersonalizedRoadmap(studentProfileId, subject, grade);

    const roadmap = await this.getPersonalizedRoadmap({
      studentProfileId,
      userId,
      subjectSlug: subject,
      grade,
    });

    return {
      behaviorSaved: true,
      behaviorRecord: {
        id: savedHistory.id,
        specialTag: savedHistory.special_tag,
        isScored: savedHistory.is_scored,
        topicTag: savedHistory.topic_tag,
        completedTurns: savedHistory.completed_turns,
        skippedTurns: savedHistory.skipped_turns,
        correctTurns: savedHistory.correct_turns,
        wrongTurns: savedHistory.wrong_turns,
        turnOutcomes: savedHistory.turn_outcomes,
        learningSpiritTag: savedHistory.learning_spirit_tag,
        learningSpiritLabel: savedHistory.learning_spirit_label,
        learningSpiritScore: Math.round(savedHistory.learning_spirit_score),
        intelligenceTag: savedHistory.intelligence_tag,
        intelligenceLabel: savedHistory.intelligence_label,
        intelligenceScore: Math.round(savedHistory.intelligence_score),
        roadmapStrategyTag: savedHistory.roadmap_strategy_tag,
        roadmapAdaptationNote: savedHistory.roadmap_adaptation_note,
        createdAt: savedHistory.created_at,
      },
      roadmap,
    };
  }

  /**
   * API 5: Lấy danh sách lịch sử hành vi luyện tập từ bảng PostgreSQL `student_behavior_histories`
   */
  async getBehaviorHistory(params: {
    studentProfileId: string;
    subjectSlug?: string;
    grade?: number;
    limit?: number;
  }) {
    const subject = params.subjectSlug
      ? this.normalizeSubjectSlug(params.subjectSlug)
      : undefined;
    const grade = params.grade ? Number(params.grade) : undefined;
    const take = Math.min(50, Math.max(1, Number(params.limit || 20)));

    const items = await this.prisma.studentBehaviorHistory.findMany({
      where: {
        student_id: params.studentProfileId,
        ...(subject ? { subject } : {}),
        ...(grade ? { grade } : {}),
      },
      orderBy: { created_at: 'desc' },
      take,
    });

    return items.map((b) => ({
      id: b.id,
      subject: b.subject,
      grade: b.grade,
      chapterId: b.chapter_id,
      chapterName: b.chapter_name,
      topicTag: b.topic_tag,
      sourceQuestionId: b.source_question_id,
      sourceQuestionTitle: b.source_question_title,
      bloomLevel: b.bloom_level,
      trapTag: b.trap_tag,
      specialTag: b.special_tag,
      isScored: b.is_scored,
      totalTurns: b.total_turns,
      completedTurns: b.completed_turns,
      skippedTurns: b.skipped_turns,
      correctTurns: b.correct_turns,
      wrongTurns: b.wrong_turns,
      usedAiExample: b.used_ai_example,
      totalTimeSeconds: b.total_time_seconds,
      turnOutcomes: b.turn_outcomes,
      learningSpiritTag: b.learning_spirit_tag,
      learningSpiritLabel: b.learning_spirit_label,
      learningSpiritScore: Math.round(b.learning_spirit_score),
      intelligenceTag: b.intelligence_tag,
      intelligenceLabel: b.intelligence_label,
      intelligenceScore: Math.round(b.intelligence_score),
      roadmapStrategyTag: b.roadmap_strategy_tag,
      roadmapAdaptationNote: b.roadmap_adaptation_note,
      createdAt: b.created_at,
    }));
  }
}
