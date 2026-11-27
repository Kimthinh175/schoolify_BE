export type CurriculumTrackCode = 'TOAN_SO' | 'TOAN_HINH' | 'DEFAULT';

export interface CurriculumChapterDef {
  id: number;
  slug: string;
  name: string;
  shortName: string;
  sgkLabel: string;
  description: string;
  semester: 1 | 2;
  track: CurriculumTrackCode;
  trackLabel: string;
  trackOrder: number;
}

export interface RealTimeSemesterInfo {
  semester: 1 | 2;
  isSummerReview: boolean;
  label: string;
  shortLabel: string;
  schoolYear: string;
  description: string;
}

/**
 * Tính Học kỳ thực tế theo đồng hồ năm học THPT Việt Nam (UTC+7):
 * - Học kỳ 1: 01/09 -> 15/01
 * - Học kỳ 2: 16/01 -> 31/05
 * - Ôn tập Hè: 01/06 -> 31/08 (mặc định mở cả lộ trình để ôn tập / chuẩn bị năm mới)
 */
export function getCurrentRealTimeSemester(
  now: Date = new Date(),
): RealTimeSemesterInfo {
  const vnTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const year = vnTime.getUTCFullYear();
  const month = vnTime.getUTCMonth() + 1;
  const day = vnTime.getUTCDate();

  if (month >= 9 && month <= 12) {
    const schoolYear = `${year} – ${year + 1}`;
    return {
      semester: 1,
      isSummerReview: false,
      label: `Học kỳ 1 · Năm học ${schoolYear}`,
      shortLabel: 'Học kỳ 1',
      schoolYear,
      description:
        'Đang trong Học kỳ 1 trên trường — ưu tiên chinh phục các chương Tập 1.',
    };
  }

  if (month === 1 && day <= 15) {
    const schoolYear = `${year - 1} – ${year}`;
    return {
      semester: 1,
      isSummerReview: false,
      label: `Học kỳ 1 (Ôn thi cuối kỳ) · Năm học ${schoolYear}`,
      shortLabel: 'Học kỳ 1',
      schoolYear,
      description:
        'Giai đoạn nước rút cuối Học kỳ 1 — tổng ôn các chương Tập 1.',
    };
  }

  if ((month === 1 && day >= 16) || (month >= 2 && month <= 5)) {
    const schoolYear = `${year - 1} – ${year}`;
    return {
      semester: 2,
      isSummerReview: false,
      label: `Học kỳ 2 · Năm học ${schoolYear}`,
      shortLabel: 'Học kỳ 2',
      schoolYear,
      description:
        'Đang trong Học kỳ 2 trên trường — mở khóa sẵn chương đầu Học kỳ 2 ở mỗi nhánh.',
    };
  }

  const schoolYear = `${year} – ${year + 1}`;
  return {
    semester: 1,
    isSummerReview: true,
    label: `Học kỳ Hè (Khởi động sớm HK1) · Năm học ${schoolYear}`,
    shortLabel: 'Ôn hè / Sớm HK1',
    schoolYear,
    description:
      'Giai đoạn hè — xuất phát sớm các chương Học kỳ 1 năm học mới.',
  };
}

export function parseStudentGradeNumber(
  raw?: string | number | null,
): 10 | 11 | 12 | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') {
    if (raw === 10 || raw === 11 || raw === 12) return raw;
    return null;
  }
  const match = String(raw).match(/\b(10|11|12)\b/);
  if (!match) return null;
  const parsed = Number(match[1]);
  if (parsed === 10 || parsed === 11 || parsed === 12) return parsed;
  return null;
}

export const MATH_GRADE_10_CURRICULUM: CurriculumChapterDef[] = [
  // 🧮 TOÁN SỐ LỚP 10 (6 CHƯƠNG)
  {
    id: 1,
    slug: 'toan10-ch1-menh-de-va-tap-hop',
    name: 'Chương 1: Mệnh đề và Tập hợp',
    shortName: 'Mệnh đề & Tập hợp',
    sgkLabel: 'SGK Tập 1 · Chương I',
    description:
      'Mệnh đề toán học, mệnh đề phủ định/kéo theo và các phép toán giao, hợp, hiệu trên tập hợp số.',
    semester: 1,
    track: 'TOAN_SO',
    trackLabel: 'Toán Số',
    trackOrder: 1,
  },
  {
    id: 2,
    slug: 'toan10-ch2-bat-phuong-trinh-bac-nhat-hai-an',
    name: 'Chương 2: Bất phương trình và hệ BPT bậc nhất hai ẩn',
    shortName: 'Hệ BPT bậc nhất hai ẩn',
    sgkLabel: 'SGK Tập 1 · Chương II',
    description:
      'Biểu diễn miền nghiệm trên mặt phẳng tọa độ Oxy và bài toán tối ưu thực tế (quy hoạch tuyến tính).',
    semester: 1,
    track: 'TOAN_SO',
    trackLabel: 'Toán Số',
    trackOrder: 2,
  },
  {
    id: 5,
    slug: 'toan10-ch5-cac-so-dac-trung-mau-so-lieu',
    name: 'Chương 5: Các số đặc trưng của mẫu số liệu không ghép nhóm',
    shortName: 'Thống kê mẫu không ghép nhóm',
    sgkLabel: 'SGK Tập 1 · Chương V',
    description:
      'Số gần đúng và sai số; số trung bình, trung vị, tứ phân vị, mốt; phương sai và độ lệch chuẩn.',
    semester: 1,
    track: 'TOAN_SO',
    trackLabel: 'Toán Số',
    trackOrder: 3,
  },
  {
    id: 6,
    slug: 'toan10-ch6-ham-so-do-thi-va-ung-dung',
    name: 'Chương 6: Hàm số, đồ thị và ứng dụng',
    shortName: 'Hàm số bậc hai & Tam thức',
    sgkLabel: 'SGK Tập 2 · Chương VI',
    description:
      'Tập xác định, khảo sát hàm số bậc hai (Parabol), xét dấu tam thức bậc hai và phương trình quy về bậc hai.',
    semester: 2,
    track: 'TOAN_SO',
    trackLabel: 'Toán Số',
    trackOrder: 4,
  },
  {
    id: 8,
    slug: 'toan10-ch8-dai-so-to-hop',
    name: 'Chương 8: Đại số tổ hợp',
    shortName: 'Quy tắc đếm & Tổ hợp',
    sgkLabel: 'SGK Tập 2 · Chương VIII',
    description:
      'Quy tắc cộng – quy tắc nhân, hoán vị, chỉnh hợp, tổ hợp và khai triển Nhị thức Newton.',
    semester: 2,
    track: 'TOAN_SO',
    trackLabel: 'Toán Số',
    trackOrder: 5,
  },
  {
    id: 9,
    slug: 'toan10-ch9-xac-suat-co-dien',
    name: 'Chương 9: Tính xác suất theo định nghĩa cổ điển',
    shortName: 'Xác suất cổ điển',
    sgkLabel: 'SGK Tập 2 · Chương IX',
    description:
      'Không gian mẫu, biến cố đối và thực hành tính xác suất theo định nghĩa cổ điển kết hợp tổ hợp.',
    semester: 2,
    track: 'TOAN_SO',
    trackLabel: 'Toán Số',
    trackOrder: 6,
  },

  // 📐 TOÁN HÌNH LỚP 10 (4 CHƯƠNG)
  {
    id: 3,
    slug: 'toan10-ch3-he-thuc-luong-trong-tam-giac',
    name: 'Chương 3: Hệ thức lượng trong tam giác',
    shortName: 'Hệ thức lượng tam giác',
    sgkLabel: 'SGK Tập 1 · Chương III',
    description:
      'Giá trị lượng giác góc từ 0° đến 180°, Định lý Côsin, Định lý Sin và các công thức diện tích tam giác.',
    semester: 1,
    track: 'TOAN_HINH',
    trackLabel: 'Toán Hình',
    trackOrder: 1,
  },
  {
    id: 4,
    slug: 'toan10-ch4-vecto',
    name: 'Chương 4: Vectơ trong mặt phẳng',
    shortName: 'Vectơ & Tích vô hướng',
    sgkLabel: 'SGK Tập 1 · Chương IV',
    description:
      'Tổng và hiệu hai vectơ, tích vectơ với một số, vectơ trong mặt phẳng tọa độ và tích vô hướng.',
    semester: 1,
    track: 'TOAN_HINH',
    trackLabel: 'Toán Hình',
    trackOrder: 2,
  },
  {
    id: 7,
    slug: 'toan10-ch7a-duong-thang-va-duong-tron-oxy',
    name: 'Chương 7A: Đường thẳng và Đường tròn trong mặt phẳng Oxy',
    shortName: 'Đường thẳng & Đường tròn Oxy',
    sgkLabel: 'SGK Tập 2 · Chương VII (P1)',
    description:
      'Phương trình tham số/tổng quát đường thẳng, góc – khoảng cách, phương trình đường tròn và tiếp tuyến.',
    semester: 2,
    track: 'TOAN_HINH',
    trackLabel: 'Toán Hình',
    trackOrder: 3,
  },
  {
    id: 10,
    slug: 'toan10-ch7b-ba-duong-conic-oxy',
    name: 'Chương 7B: Ba đường Conic trong mặt phẳng Oxy',
    shortName: 'Elip, Hypebol & Parabol',
    sgkLabel: 'SGK Tập 2 · Chương VII (P2)',
    description:
      'Phương trình chính tắc, tiêu điểm, tiêu cự và ứng dụng thực tế của Elip, Hypebol, Parabol.',
    semester: 2,
    track: 'TOAN_HINH',
    trackLabel: 'Toán Hình',
    trackOrder: 4,
  },
];

export const MATH_GRADE_11_CURRICULUM: CurriculumChapterDef[] = [
  // 🧮 TOÁN SỐ LỚP 11 (7 CHƯƠNG)
  {
    id: 1,
    slug: 'toan11-ch1-ham-so-va-phuong-trinh-luong-giac',
    name: 'Chương 1: Hàm số lượng giác và phương trình lượng giác',
    shortName: 'Hàm số & PT Lượng giác',
    sgkLabel: 'SGK Tập 1 · Chương I',
    description:
      'Góc lượng giác, công thức biến đổi lượng giác, tập giá trị hàm lượng giác và phương trình lượng giác.',
    semester: 1,
    track: 'TOAN_SO',
    trackLabel: 'Toán Số',
    trackOrder: 1,
  },
  {
    id: 2,
    slug: 'toan11-ch2-day-so-cap-so-cong-cap-so-nhan',
    name: 'Chương 2: Dãy số. Cấp số cộng và cấp số nhân',
    shortName: 'Dãy số, CSC & CSN',
    sgkLabel: 'SGK Tập 1 · Chương II',
    description:
      'Tính đơn điệu, bị chặn của dãy số; số hạng tổng quát và tổng n số hạng đầu của CSC, CSN.',
    semester: 1,
    track: 'TOAN_SO',
    trackLabel: 'Toán Số',
    trackOrder: 2,
  },
  {
    id: 3,
    slug: 'toan11-ch3-mau-so-lieu-ghep-nhom',
    name: 'Chương 3: Mẫu số liệu ghép nhóm (Xu thế trung tâm)',
    shortName: 'Mẫu số liệu ghép nhóm',
    sgkLabel: 'SGK Tập 1 · Chương III',
    description:
      'Bảng tần số ghép nhóm, ước lượng số trung bình, trung vị, tứ phân vị và mốt.',
    semester: 1,
    track: 'TOAN_SO',
    trackLabel: 'Toán Số',
    trackOrder: 3,
  },
  {
    id: 5,
    slug: 'toan11-ch5-gioi-han-ham-so-lien-tuc',
    name: 'Chương 5: Giới hạn. Hàm số liên tục',
    shortName: 'Giới hạn & Liên tục',
    sgkLabel: 'SGK Tập 1 · Chương V',
    description:
      'Giới hạn dãy số, giới hạn hàm số (khử dạng vô định 0/0, ∞/∞) và xét tính liên tục của hàm số.',
    semester: 1,
    track: 'TOAN_SO',
    trackLabel: 'Toán Số',
    trackOrder: 4,
  },
  {
    id: 6,
    slug: 'toan11-ch6-ham-so-mu-va-logarit',
    name: 'Chương 6: Hàm số mũ và hàm số lôgarit',
    shortName: 'Hàm số Mũ & Lôgarit',
    sgkLabel: 'SGK Tập 2 · Chương VI',
    description:
      'Phép tính lũy thừa – lôgarit, đồ thị hàm mũ – lôgarit, phương trình và bất phương trình mũ – lôgarit.',
    semester: 2,
    track: 'TOAN_SO',
    trackLabel: 'Toán Số',
    trackOrder: 5,
  },
  {
    id: 8,
    slug: 'toan11-ch8-cac-quy-tac-tinh-xac-suat',
    name: 'Chương 8: Các quy tắc tính xác suất',
    shortName: 'Quy tắc cộng & nhân Xác suất',
    sgkLabel: 'SGK Tập 2 · Chương VIII',
    description:
      'Biến cố hợp, giao, xung khắc, độc lập; công thức cộng xác suất và công thức nhân xác suất.',
    semester: 2,
    track: 'TOAN_SO',
    trackLabel: 'Toán Số',
    trackOrder: 6,
  },
  {
    id: 9,
    slug: 'toan11-ch9-dao-ham',
    name: 'Chương 9: Đạo hàm',
    shortName: 'Đạo hàm & Tiếp tuyến',
    sgkLabel: 'SGK Tập 2 · Chương IX',
    description:
      'Định nghĩa đạo hàm, phương trình tiếp tuyến đồ thị, quy tắc đạo hàm hàm hợp và đạo hàm cấp hai.',
    semester: 2,
    track: 'TOAN_SO',
    trackLabel: 'Toán Số',
    trackOrder: 7,
  },

  // 📐 TOÁN HÌNH LỚP 11 (4 CHƯƠNG HÌNH KHÔNG GIAN)
  {
    id: 4,
    slug: 'toan11-ch4a-duong-thang-mat-phang-hai-duong-song-song',
    name: 'Chương 4A: Đại cương mặt phẳng & Hai đường thẳng song song',
    shortName: 'Giao tuyến & Hai đường song song',
    sgkLabel: 'SGK Tập 1 · Chương IV (P1)',
    description:
      'Giao tuyến hai mặt phẳng, giao điểm đường – mặt, vị trí tương đối hai đường thẳng trong không gian.',
    semester: 1,
    track: 'TOAN_HINH',
    trackLabel: 'Toán Hình',
    trackOrder: 1,
  },
  {
    id: 10,
    slug: 'toan11-ch4b-song-song-khong-gian-phep-chieu',
    name: 'Chương 4B: Đường thẳng, mặt phẳng song song & Phép chiếu',
    shortName: 'Đường // Mặt & Hai mặt song song',
    sgkLabel: 'SGK Tập 1 · Chương IV (P2)',
    description:
      'Đường thẳng song song mặt phẳng, hai mặt phẳng song song, thiết diện, hình lăng trụ và hình hộp.',
    semester: 1,
    track: 'TOAN_HINH',
    trackLabel: 'Toán Hình',
    trackOrder: 2,
  },
  {
    id: 7,
    slug: 'toan11-ch7a-quan-he-vuong-goc-va-goc-khong-gian',
    name: 'Chương 7A: Quan hệ vuông góc & Góc trong không gian',
    shortName: 'Vuông góc & Góc không gian',
    sgkLabel: 'SGK Tập 2 · Chương VII (P1)',
    description:
      'Đường thẳng vuông góc mặt phẳng, hai mặt phẳng vuông góc, góc đường – mặt và góc nhị diện.',
    semester: 2,
    track: 'TOAN_HINH',
    trackLabel: 'Toán Hình',
    trackOrder: 3,
  },
  {
    id: 11,
    slug: 'toan11-ch7b-khoang-cach-va-the-tich-khoi-da-dien',
    name: 'Chương 7B: Khoảng cách & Thể tích khối đa diện',
    shortName: 'Khoảng cách & Thể tích chóp/lăng trụ',
    sgkLabel: 'SGK Tập 2 · Chương VII (P2)',
    description:
      'Khoảng cách từ điểm đến mặt phẳng, hai đường chéo nhau và tính thể tích khối chóp, khối lăng trụ.',
    semester: 2,
    track: 'TOAN_HINH',
    trackLabel: 'Toán Hình',
    trackOrder: 4,
  },
];

export const MATH_GRADE_12_CURRICULUM: CurriculumChapterDef[] = [
  // 🧮 TOÁN SỐ LỚP 12 (4 CHƯƠNG)
  {
    id: 1,
    slug: 'ung-dung-dao-ham-khao-sat-do-thi',
    name: 'Chương 1: Ứng dụng đạo hàm để khảo sát và vẽ đồ thị hàm số',
    shortName: 'Khảo sát hàm số & Đồ thị',
    sgkLabel: 'SGK Tập 1 · Chương I',
    description:
      'Tính đơn điệu, cực trị, GTLN-GTNN, đường tiệm cận (đứng, ngang, xiên), đồ thị hàm số và bài toán thực tế.',
    semester: 1,
    track: 'TOAN_SO',
    trackLabel: 'Toán Số',
    trackOrder: 1,
  },
  {
    id: 3,
    slug: 'cac-so-dac-trung-do-phan-tan-mau-so-lieu',
    name: 'Chương 3: Các số đặc trưng đo mức độ phân tán mẫu số liệu ghép nhóm',
    shortName: 'Độ phân tán mẫu ghép nhóm',
    sgkLabel: 'SGK Tập 1 · Chương III',
    description:
      'Khoảng biến thiên, khoảng tứ phân vị, phương sai và độ lệch chuẩn của mẫu số liệu ghép nhóm.',
    semester: 1,
    track: 'TOAN_SO',
    trackLabel: 'Toán Số',
    trackOrder: 2,
  },
  {
    id: 4,
    slug: 'nguyen-ham-va-tich-phan',
    name: 'Chương 4: Nguyên hàm và tích phân',
    shortName: 'Nguyên hàm & Tích phân',
    sgkLabel: 'SGK Tập 2 · Chương IV',
    description:
      'Định nghĩa nguyên hàm, bảng nguyên hàm cơ bản, phương pháp tính tích phân và tính diện tích, thể tích.',
    semester: 2,
    track: 'TOAN_SO',
    trackLabel: 'Toán Số',
    trackOrder: 3,
  },
  {
    id: 6,
    slug: 'xac-suat-co-dieu-kien',
    name: 'Chương 6: Xác suất có điều kiện & Công thức Bayes',
    shortName: 'Xác suất có điều kiện & Bayes',
    sgkLabel: 'SGK Tập 2 · Chương VI',
    description:
      'Khái niệm xác suất có điều kiện, sơ đồ hình cây, công thức xác suất toàn phần và công thức Bayes.',
    semester: 2,
    track: 'TOAN_SO',
    trackLabel: 'Toán Số',
    trackOrder: 4,
  },

  // 📐 TOÁN HÌNH LỚP 12 (4 CHƯƠNG HÌNH OXYZ)
  {
    id: 2,
    slug: 'vecto-va-he-toa-do-trong-khong-gian',
    name: 'Chương 2A: Vectơ và các phép toán vectơ trong không gian',
    shortName: 'Vectơ trong không gian',
    sgkLabel: 'SGK Tập 1 · Chương II (P1)',
    description:
      'Vectơ trong không gian, quy tắc hình hộp, trọng tâm tứ diện và tích vô hướng hai vectơ không gian.',
    semester: 1,
    track: 'TOAN_HINH',
    trackLabel: 'Toán Hình',
    trackOrder: 1,
  },
  {
    id: 7,
    slug: 'he-truc-toa-do-oxyz-bieu-thuc-toa-do',
    name: 'Chương 2B: Hệ trục tọa độ Oxyz & Biểu thức tọa độ vectơ',
    shortName: 'Tọa độ điểm & vectơ Oxyz',
    sgkLabel: 'SGK Tập 1 · Chương II (P2)',
    description:
      'Tọa độ của điểm và vectơ trên hệ trục Oxyz, biểu thức tọa độ tích vô hướng, tích có hướng và ứng dụng.',
    semester: 1,
    track: 'TOAN_HINH',
    trackLabel: 'Toán Hình',
    trackOrder: 2,
  },
  {
    id: 5,
    slug: 'phuong-phap-toa-do-trong-khong-gian',
    name: 'Chương 5A: Phương trình mặt phẳng và đường thẳng trong Oxyz',
    shortName: 'Mặt phẳng & Đường thẳng Oxyz',
    sgkLabel: 'SGK Tập 2 · Chương V (P1)',
    description:
      'Vectơ pháp tuyến, vectơ chỉ phương, phương trình mặt phẳng, phương trình đường thẳng và vị trí tương đối.',
    semester: 2,
    track: 'TOAN_HINH',
    trackLabel: 'Toán Hình',
    trackOrder: 3,
  },
  {
    id: 8,
    slug: 'phuong-trinh-mat-cau-goc-khoang-cach-oxyz',
    name: 'Chương 5B: Phương trình mặt cầu, Góc & Khoảng cách trong Oxyz',
    shortName: 'Mặt cầu & Góc – Khoảng cách Oxyz',
    sgkLabel: 'SGK Tập 2 · Chương V (P2)',
    description:
      'Phương trình mặt cầu, tiếp diện mặt cầu, công thức góc – khoảng cách và bài toán cực trị tọa độ Oxyz.',
    semester: 2,
    track: 'TOAN_HINH',
    trackLabel: 'Toán Hình',
    trackOrder: 4,
  },
];

export const INFORMATICS_GRADE_10_CURRICULUM: CurriculumChapterDef[] = [
  {
    id: 1,
    slug: 'tin10-ch1-may-tinh-va-xa-hoi-tri-thuc',
    name: 'Chương 1: Máy tính và xã hội tri thức',
    shortName: 'Thông tin, Hệ nhị phân & Lôgic',
    sgkLabel: 'SGK 10 · Chủ đề 1',
    description:
      'Thông tin và dữ liệu, đơn vị lưu trữ số, biểu diễn số nhị phân, phép toán lôgic mệnh đề (AND, OR, NOT).',
    semester: 1,
    track: 'DEFAULT',
    trackLabel: 'Tin học 10',
    trackOrder: 1,
  },
  {
    id: 2,
    slug: 'tin10-ch2-mang-may-tinh-va-internet',
    name: 'Chương 2: Mạng máy tính và Internet',
    shortName: 'Mạng LAN, Cloud, IoT & An toàn mạng',
    sgkLabel: 'SGK 10 · Chủ đề 2',
    description:
      'Mạng LAN và Internet, dịch vụ Điện toán đám mây, Internet vạn vật (IoT) và phòng chống phần mềm độc hại.',
    semester: 1,
    track: 'DEFAULT',
    trackLabel: 'Tin học 10',
    trackOrder: 2,
  },
  {
    id: 3,
    slug: 'tin10-ch3-dao-duc-phap-luat-moi-truong-so',
    name: 'Chương 3: Đạo đức, pháp luật và văn hóa trong môi trường số',
    shortName: 'Bản quyền & Luật An ninh mạng',
    sgkLabel: 'SGK 10 · Chủ đề 3',
    description:
      'Quyền tác giả đối với sản phẩm số, Luật An ninh mạng, ứng xử văn minh và bảo vệ dữ liệu cá nhân.',
    semester: 1,
    track: 'DEFAULT',
    trackLabel: 'Tin học 10',
    trackOrder: 3,
  },
  {
    id: 4,
    slug: 'tin10-ch4-ung-dung-thiet-ke-do-hoa-vecto',
    name: 'Chương 4: Ứng dụng tin học – Thiết kế đồ họa vectơ',
    shortName: 'Thiết kế đồ họa vectơ',
    sgkLabel: 'SGK 10 · Chủ đề 4',
    description:
      'Phân biệt đồ họa điểm ảnh (bitmap) và đồ họa vectơ (Inkscape), phép ghép hình khối và đường cong Bézier.',
    semester: 1,
    track: 'DEFAULT',
    trackLabel: 'Tin học 10',
    trackOrder: 4,
  },
  {
    id: 5,
    slug: 'tin10-ch5-lap-trinh-python-co-ban-cau-truc-dieu-khien',
    name: 'Chương 5: Lập trình Python cơ bản & Cấu trúc điều khiển',
    shortName: 'Python cơ bản, If-Else & Vòng lặp',
    sgkLabel: 'SGK 10 · Chủ đề 5 (P1)',
    description:
      'Biến, kiểu dữ liệu, lệnh input()/print(), rẽ nhánh if-elif-else, vòng lặp for/range() và while trong Python.',
    semester: 2,
    track: 'DEFAULT',
    trackLabel: 'Tin học 10',
    trackOrder: 5,
  },
  {
    id: 6,
    slug: 'tin10-ch6-danh-sach-xau-ky-tu-ham-python',
    name: 'Chương 6: Danh sách (List), Xâu ký tự, Hàm & Kiểm thử Python',
    shortName: 'List, String, Hàm def & Debug',
    sgkLabel: 'SGK 10 · Chủ đề 5 (P2)',
    description:
      'Thao tác trên kiểu list, xử lý xâu ký tự str, định nghĩa hàm def, phạm vi biến và kỹ thuật gỡ lỗi chương trình.',
    semester: 2,
    track: 'DEFAULT',
    trackLabel: 'Tin học 10',
    trackOrder: 6,
  },
  {
    id: 7,
    slug: 'tin10-ch7-huong-nghiep-voi-tin-hoc',
    name: 'Chương 7: Hướng nghiệp với Tin học',
    shortName: 'Hướng nghiệp Thiết kế & Phần mềm',
    sgkLabel: 'SGK 10 · Chủ đề 6',
    description:
      'Đặc điểm công việc, yêu cầu năng lực và triển vọng nghề Thiết kế đồ họa máy tính & Phát triển phần mềm.',
    semester: 2,
    track: 'DEFAULT',
    trackLabel: 'Tin học 10',
    trackOrder: 7,
  },
];

export const INFORMATICS_GRADE_11_CURRICULUM: CurriculumChapterDef[] = [
  {
    id: 1,
    slug: 'tin11-ch1-he-dieu-hanh-kien-truc-may-tinh',
    name: 'Chương 1: Hệ điều hành, Phần mềm nguồn mở & Kiến trúc máy tính',
    shortName: 'Hệ điều hành & Bên trong máy tính',
    sgkLabel: 'SGK 11 · Chủ đề 1',
    description:
      'Hệ điều hành PC/Mobile, giấy phép phần mềm nguồn mở, CPU – RAM – ROM, mạch logic cộng nhị phân.',
    semester: 1,
    track: 'DEFAULT',
    trackLabel: 'Tin học 11',
    trackOrder: 1,
  },
  {
    id: 2,
    slug: 'tin11-ch2-luu-tru-tim-kiem-giao-tiep-an-toan',
    name: 'Chương 2: Lưu trữ trực tuyến, Tìm kiếm & Giao tiếp an toàn số',
    shortName: 'Lưu trữ đám mây & An toàn số',
    sgkLabel: 'SGK 11 · Chủ đề 2 & 3',
    description:
      'Lưu trữ và chia sẻ tệp trên đám mây, tìm kiếm nâng cao và nhận diện lừa đảo trực tuyến (Phishing).',
    semester: 1,
    track: 'DEFAULT',
    trackLabel: 'Tin học 11',
    trackOrder: 2,
  },
  {
    id: 3,
    slug: 'tin11-ch3-co-so-du-lieu-va-mo-hinh-quan-he',
    name: 'Chương 3: Cơ sở dữ liệu & Mô hình dữ liệu quan hệ',
    shortName: 'Cơ sở dữ liệu & Khóa quan hệ',
    sgkLabel: 'SGK 11 · Chủ đề 4 (P1)',
    description:
      'Hệ quản trị CSDL, bảng – bản ghi – trường, khóa chính (Primary Key), khóa ngoại (Foreign Key) và liên kết bảng.',
    semester: 1,
    track: 'DEFAULT',
    trackLabel: 'Tin học 11',
    trackOrder: 3,
  },
  {
    id: 4,
    slug: 'tin11-ch4-ngon-ngu-truy-van-sql-va-bao-mat',
    name: 'Chương 4: Ngôn ngữ truy vấn SQL, Bảo mật & Quản trị CSDL',
    shortName: 'Truy vấn SQL & Quản trị CSDL',
    sgkLabel: 'SGK 11 · Chủ đề 4 (P2) & CĐ 5',
    description:
      'Câu lệnh SELECT, WHERE, INNER JOIN, ORDER BY, phân quyền bảo mật CSDL và định hướng nghề Quản trị CSDL.',
    semester: 2,
    track: 'DEFAULT',
    trackLabel: 'Tin học 11',
    trackOrder: 4,
  },
  {
    id: 5,
    slug: 'tin11-ch5-mang-va-thuat-toan-tim-kiem-sap-xep',
    name: 'Chương 5: Mảng 1D/2D & Thuật toán Tìm kiếm – Sắp xếp',
    shortName: 'Mảng, Tìm kiếm nhị phân & Sắp xếp',
    sgkLabel: 'SGK 11 · Chủ đề 6 (P1)',
    description:
      'Cấu trúc mảng 1 chiều, 2 chiều, Tìm kiếm tuần tự/nhị phân, Sắp xếp chọn, Sắp xếp chèn và Sắp xếp nổi bọt.',
    semester: 2,
    track: 'DEFAULT',
    trackLabel: 'Tin học 11',
    trackOrder: 5,
  },
  {
    id: 6,
    slug: 'tin11-ch6-do-phuc-tap-thuat-toan-va-thiet-ke-mo-dun',
    name: 'Chương 6: Độ phức tạp thuật toán O(n) & Thiết kế chương trình mô đun',
    shortName: 'Độ phức tạp Big-O & Thiết kế mô đun',
    sgkLabel: 'SGK 11 · Chủ đề 6 (P2)',
    description:
      'Kiểm thử chương trình, đánh giá độ phức tạp thời gian O(1), O(log n), O(n), O(n²), làm mịn dần và thư viện.',
    semester: 2,
    track: 'DEFAULT',
    trackLabel: 'Tin học 11',
    trackOrder: 6,
  },
];

export const INFORMATICS_GRADE_12_CURRICULUM: CurriculumChapterDef[] = [
  {
    id: 1,
    slug: 'tin12-ch1-tri-tue-nhan-tao-ai',
    name: 'Chương 1: Trí tuệ nhân tạo (AI) trong khoa học và đời sống',
    shortName: 'Trí tuệ nhân tạo (AI)',
    sgkLabel: 'SGK 12 · Chủ đề 1',
    description:
      'Khái niệm AI hẹp/AI tổng quát, Học máy (Machine Learning), NLP, Thị giác máy tính và đạo đức AI.',
    semester: 1,
    track: 'DEFAULT',
    trackLabel: 'Tin học 12',
    trackOrder: 1,
  },
  {
    id: 2,
    slug: 'tin12-ch2-mang-may-tinh-va-giao-thuc',
    name: 'Chương 2: Thiết bị mạng, Giao thức TCP/IP & Chia sẻ tài nguyên',
    shortName: 'Thiết bị mạng & Giao thức TCP/IP',
    sgkLabel: 'SGK 12 · Chủ đề 2',
    description:
      'Access Point, Switch, Router, Modem; giao thức IPv4/IPv6, TCP, DNS và chia sẻ tài nguyên mạng LAN.',
    semester: 1,
    track: 'DEFAULT',
    trackLabel: 'Tin học 12',
    trackOrder: 2,
  },
  {
    id: 3,
    slug: 'tin12-ch3-dao-duc-ung-xu-khong-gian-mang',
    name: 'Chương 3: Giữ gìn tính nhân văn trong thế giới ảo',
    shortName: 'Ứng xử nhân văn không gian mạng',
    sgkLabel: 'SGK 12 · Chủ đề 3',
    description:
      'Ưu – nhược điểm giao tiếp trực tuyến, tính nhân văn, thấu cảm và tuân thủ pháp luật môi trường số.',
    semester: 1,
    track: 'DEFAULT',
    trackLabel: 'Tin học 12',
    trackOrder: 3,
  },
  {
    id: 4,
    slug: 'tin12-ch4-ngon-ngu-danh-dau-html',
    name: 'Chương 4: Tạo trang web với ngôn ngữ đánh dấu HTML',
    shortName: 'Ngôn ngữ đánh dấu HTML',
    sgkLabel: 'SGK 12 · Chủ đề 4 (P1)',
    description:
      'Cấu trúc DOM trang web, văn bản, danh sách, bảng, liên kết, đa phương tiện và biểu mẫu <form>.',
    semester: 2,
    track: 'DEFAULT',
    trackLabel: 'Tin học 12',
    trackOrder: 4,
  },
  {
    id: 5,
    slug: 'tin12-ch5-dinh-dang-trang-web-css',
    name: 'Chương 5: Định dạng và bố cục trang web với CSS',
    shortName: 'Định dạng trang web CSS',
    sgkLabel: 'SGK 12 · Chủ đề 4 (P2)',
    description:
      'Bộ chọn CSS (tag, .class, #id), quy tắc kế thừa – độ ưu tiên và mô hình hộp Box Model.',
    semester: 2,
    track: 'DEFAULT',
    trackLabel: 'Tin học 12',
    trackOrder: 5,
  },
  {
    id: 6,
    slug: 'tin12-ch6-huong-nghiep-sql-giai-thuat',
    name: 'Chương 6: Hướng nghiệp CNTT, CSDL SQL & Giải thuật nâng cao',
    shortName: 'Hướng nghiệp, SQL & Giải thuật',
    sgkLabel: 'SGK 12 · Chủ đề 5 & Định hướng CS/ICT',
    description:
      'Nhóm nghề Quản trị mạng/Bảo mật hệ thống, kết hợp ôn luyện SQL quan hệ và Giải thuật Python THPT.',
    semester: 2,
    track: 'DEFAULT',
    trackLabel: 'Tin học 12',
    trackOrder: 6,
  },
];

export const CURRICULUM_CHAPTERS_BY_SUBJECT_AND_GRADE: Record<
  string,
  Record<number, CurriculumChapterDef[]>
> = {
  'toan-hoc': {
    10: MATH_GRADE_10_CURRICULUM,
    11: MATH_GRADE_11_CURRICULUM,
    12: MATH_GRADE_12_CURRICULUM,
  },
  'tin-hoc': {
    10: INFORMATICS_GRADE_10_CURRICULUM,
    11: INFORMATICS_GRADE_11_CURRICULUM,
    12: INFORMATICS_GRADE_12_CURRICULUM,
  },
};

export function getCurriculumChapters(
  subjectSlug: string,
  grade: number,
): CurriculumChapterDef[] {
  const normalizedSubject = (subjectSlug || 'toan-hoc').trim().toLowerCase();
  const safeGrade = grade === 10 || grade === 11 || grade === 12 ? grade : 12;
  const byGrade = CURRICULUM_CHAPTERS_BY_SUBJECT_AND_GRADE[normalizedSubject];
  if (byGrade && byGrade[safeGrade]) {
    return byGrade[safeGrade];
  }
  if (byGrade && byGrade[12]) {
    return byGrade[12];
  }
  return MATH_GRADE_12_CURRICULUM;
}

export function getNextCurriculumChapterInTrack(
  subjectSlug: string,
  grade: number,
  currentChapterId: number,
): CurriculumChapterDef | null {
  const allChapters = getCurriculumChapters(subjectSlug, grade);
  const current = allChapters.find((c) => c.id === currentChapterId);
  if (!current) return null;

  const trackChapters = allChapters
    .filter((c) => c.track === current.track)
    .sort((a, b) => a.trackOrder - b.trackOrder);
  const idx = trackChapters.findIndex((c) => c.id === currentChapterId);
  if (idx === -1 || idx + 1 >= trackChapters.length) return null;
  return trackChapters[idx + 1];
}
