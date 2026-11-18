/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import {
  PrismaClient,
  BloomLevel,
  QuestionFormat,
  QuestionType,
  SystemRole,
  ForumPostStatus,
  ForumCommentStatus,
  ForumTargetType,
  ForumReactionType,
  ForumReportReason,
  ForumReportStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const DIFFICULTY_MAP: Record<string, BloomLevel> = {
  EASY: BloomLevel.NHAN_BIET,
  MEDIUM: BloomLevel.THONG_HIEU,
  HARD: BloomLevel.VAN_DUNG,
  VERY_HARD: BloomLevel.VAN_DUNG_CAO,
};

interface SeedForumPostDef {
  slug: string;
  title: string;
  content: string;
  content_plain: string;
  has_math: boolean;
  subject: string;
  grade: number;
  chapter_id: number;
  chapter_name: string;
  tags: string[];
  is_pinned?: boolean;
  is_solved?: boolean;
  views_count: number;
  likes_count: number;
  author_type: 'ADMIN' | 'TEACHER' | 'STUDENT';
  root_comment?: {
    author_type: 'ADMIN' | 'TEACHER' | 'STUDENT';
    content: string;
    is_accepted?: boolean;
    likes_count: number;
    nested_reply?: {
      author_type: 'ADMIN' | 'TEACHER' | 'STUDENT';
      content: string;
      likes_count: number;
    };
  };
  extra_comment?: {
    author_type: 'ADMIN' | 'TEACHER' | 'STUDENT';
    content: string;
    likes_count: number;
  };
}

const FORUM_SEED_TOPICS: SeedForumPostDef[] = [
  // 1. NỘI QUY GHIM ĐẦU TRANG (HỆ THỐNG)
  {
    slug: 'noi-quy-dien-dan-huong-dan-dang-cau-hoi-va-go-cong-thuc-latex',
    title:
      '[Nội Quy Diễn Đàn] Hướng dẫn đăng câu hỏi chuẩn GDPT 2018 và cách gõ công thức Toán/Lý/Hóa bằng KaTeX',
    content:
      'Chào mừng các bạn học sinh đến với **Diễn Đàn Học Tập Schoolify**! Để câu hỏi được thầy cô và cộng đồng hỗ trợ nhanh nhất, vui lòng chọn đúng **Môn / Khối / Chương** và gõ công thức toán học trong cặp dấu `$...$` (inline) hoặc `$$...$$` (block).\n\nVí dụ công thức nghiệm phương trình bậc hai: $x = \\frac{-b \\pm \\sqrt{\\Delta}}{2a}$ với $\\Delta = b^2 - 4ac \\ge 0$, hoặc hệ phương trình:\n$$\\begin{cases} x + y = 2 \\\\ x - y = 0 \\end{cases}$$',
    content_plain:
      'Chào mừng các bạn học sinh đến với Diễn Đàn Học Tập Schoolify! Để câu hỏi được thầy cô và cộng đồng hỗ trợ nhanh nhất, vui lòng chọn đúng Môn / Khối / Chương và gõ công thức toán học trong cặp dấu LaTeX.',
    has_math: true,
    subject: 'Hệ Thống',
    grade: 12,
    chapter_id: 1,
    chapter_name: 'Hướng dẫn chung & Nội quy Diễn Đàn',
    tags: ['Nội quy', 'Hướng dẫn', 'LaTeX', 'GDPT 2018'],
    is_pinned: true,
    is_solved: true,
    views_count: 1540,
    likes_count: 230,
    author_type: 'ADMIN',
    root_comment: {
      author_type: 'STUDENT',
      content:
        'Cảm ơn Admin! Cho em hỏi gõ hệ phương trình nhiều dòng hoặc tích phân $\\int_0^{\\pi} \\sin x \\,dx = 2$ trong bình luận có tự động render KaTeX không ạ?',
      is_accepted: false,
      likes_count: 18,
      nested_reply: {
        author_type: 'ADMIN',
        content:
          'Hoàn toàn tự động nhé em! Cả bài đăng (`ForumPost`) lẫn bình luận 2 cấp (`ForumComment`) đều hỗ trợ đầy đủ cú pháp KaTeX `$...$` và `$$...$$`.',
        likes_count: 25,
      },
    },
  },

  // 2. TOÁN HỌC 12 - CHƯƠNG 1 (KHẢO SÁT HÀM SỐ)
  {
    slug: 'hoi-bai-toan-12-tim-m-de-ham-so-bac-ba-dong-bien',
    title:
      'Hỏi bài Toán 12: Tìm m để hàm số bậc ba đồng biến trên khoảng $(0; +\\infty)$',
    content:
      "Em đang làm bài tập khảo sát hàm số Chương 1: $y = x^3 - 3mx^2 + 3(2m-1)x + 1$. Thầy cô và các bạn cho em hỏi bài này dùng phương pháp cô lập tham số $m$ từ điều kiện $y' \\ge 0, \\forall x \\in (0; +\\infty)$ hay xét $\\Delta'$ của tam thức bậc hai thì nhanh hơn ạ?",
    content_plain:
      'Em đang làm bài tập khảo sát hàm số Chương 1: y = x^3 - 3mx^2 + 3(2m-1)x + 1. Thầy cô và các bạn cho em hỏi bài này dùng phương pháp cô lập tham số m hay xét tam thức bậc hai thì nhanh hơn ạ?',
    has_math: true,
    subject: 'Toán Học',
    grade: 12,
    chapter_id: 1,
    chapter_name: 'Chương 1: Ứng dụng đạo hàm để khảo sát và vẽ đồ thị hàm số',
    tags: ['Đạo hàm', 'Đơn điệu', 'Cô lập m', 'Lớp 12'],
    is_solved: true,
    views_count: 320,
    likes_count: 35,
    author_type: 'STUDENT',
    root_comment: {
      author_type: 'TEACHER',
      content:
        "Với bài này, hệ số của $m$ trong $y' = 3x^2 - 6mx + 3(2m-1)$ là bậc nhất theo $m$, đồng thời có nghiệm đẹp $x = 1$: $y' = 3(x-1)(x - 2m + 1) \\ge 0, \\forall x \\in (0; +\\infty)$. Để không đổi dấu qua $x = 1$ thì bắt buộc $x = 1$ là nghiệm kép, tức $2m - 1 = 1 \\iff m = 1$ nhé!",
      is_accepted: true,
      likes_count: 29,
      nested_reply: {
        author_type: 'STUDENT',
        content:
          'Dạ em hiểu rồi ạ! Phân tích thành nhân tử $3(x-1)(x - 2m + 1) \\ge 0$ giúp suy ra ngay $m = 1$ mà không cần chia 2 trường hợp cô lập. Em cảm ơn thầy nhiều ạ!',
        likes_count: 12,
      },
    },
  },

  // 3. TOÁN HỌC 12 - CHƯƠNG 4 (NGUYÊN HÀM & TÍCH PHÂN)
  {
    slug: 'toan-12-ung-dung-tich-phan-tinh-the-tich-khoi-tron-xoay-parabol',
    title:
      'Toán 12: Ứng dụng tích phân tính thể tích khối tròn xoay giới hạn bởi Parabol và đường thẳng',
    content:
      'Cho hình phẳng $(H)$ giới hạn bởi đồ thị hàm số $y = x^2 - 2x$ và trục hoành $Ox$. Khi quay $(H)$ quanh trục $Ox$ thì thể tích khối tròn xoay tính theo công thức:\n$$V = \\pi \\int_{0}^{2} (x^2 - 2x)^2 \\,dx$$\nhay có cần lấy trị tuyệt đối bên trong bình phương không ạ?',
    content_plain:
      'Cho hình phẳng (H) giới hạn bởi đồ thị hàm số y = x^2 - 2x và trục hoành Ox. Khi quay (H) quanh trục Ox thì thể tích khối tròn xoay tính theo công thức tích phân từ 0 đến 2 như thế nào?',
    has_math: true,
    subject: 'Toán Học',
    grade: 12,
    chapter_id: 4,
    chapter_name: 'Chương 4: Nguyên hàm và Tích phân',
    tags: ['Tích phân', 'Thể tích tròn xoay', 'Lớp 12'],
    is_solved: true,
    views_count: 275,
    likes_count: 28,
    author_type: 'STUDENT',
    root_comment: {
      author_type: 'TEACHER',
      content:
        'Vì $[f(x)]^2 = |f(x)|^2 \\ge 0$ nên em không cần dấu giá trị tuyệt đối nhé. Khai triển $(x^2 - 2x)^2 = x^4 - 4x^3 + 4x^2$ rồi lấy nguyên hàm ta được:\n$$V = \\pi \\left[ \\frac{x^5}{5} - x^4 + \\frac{4x^3}{3} \\right]_0^2 = \\pi \\left( \\frac{32}{5} - 16 + \\frac{32}{3} \\right) = \\frac{16\\pi}{15}$$',
      is_accepted: true,
      likes_count: 19,
      nested_reply: {
        author_type: 'STUDENT',
        content:
          'Dạ thầy ơi, nếu đề bài đổi thành tính diện tích hình phẳng $S = \\int_0^2 |x^2 - 2x| \\,dx$ thì trên đoạn $[0; 2]$ biểu thức $x^2 - 2x \\le 0$ nên phá trị tuyệt đối thành $\\int_0^2 (2x - x^2) \\,dx = \\frac{4}{3}$ đúng không ạ?',
        likes_count: 8,
      },
    },
    extra_comment: {
      author_type: 'ADMIN',
      content:
        'Mẹo kiểm tra nhanh bằng Casio: Nhập $\\int_0^2 (X^2 - 2X)^2 \\,dX$ ra $\\frac{16}{15} \\approx 1{,}0667$, sau đó nhân thêm $\\pi$ để tránh quên hằng số $\\pi$ ở đáp án trắc nghiệm nhé!',
      likes_count: 11,
    },
  },

  // 4. TOÁN HỌC 12 - CHƯƠNG 5 (HÌNH HỌC KHÔNG GIAN OXYZ)
  {
    slug: 'toan-12-phuong-trinh-mat-cau-tiep-xuc-voi-mat-phang-trong-khong-gian-oxyz',
    title:
      'Toán 12: Viết phương trình mặt cầu $(S)$ đi qua 3 điểm và có tâm thuộc mặt phẳng $(Oxy)$',
    content:
      'Trong không gian $Oxyz$, cho mặt cầu $(S)$ tâm $I(a; b; 0) \\in (Oxy)$ tiếp xúc với mặt phẳng $(P): 2x - y + 2z - 9 = 0$ tại điểm $H(1; -1; 3)$. Làm sao thiết lập nhanh hệ điều kiện $\\overrightarrow{IH} \\parallel \\vec{n}_P$ và tính bán kính $R = d(I, (P))$ ạ?',
    content_plain:
      'Trong không gian Oxyz, cho mặt cầu (S) tâm I(a; b; 0) thuộc (Oxy) tiếp xúc với mặt phẳng (P): 2x - y + 2z - 9 = 0 tại điểm H(1; -1; 3). Làm sao thiết lập nhanh hệ điều kiện và tính bán kính R?',
    has_math: true,
    subject: 'Toán Học',
    grade: 12,
    chapter_id: 5,
    chapter_name: 'Chương 5: Phương pháp tọa độ trong không gian Oxyz',
    tags: ['Hình học Oxyz', 'Mặt cầu', 'Mặt phẳng', 'Lớp 12'],
    is_solved: true,
    views_count: 210,
    likes_count: 22,
    author_type: 'STUDENT',
    root_comment: {
      author_type: 'TEACHER',
      content:
        'Đường thẳng $IH$ đi qua $H(1; -1; 3)$ và nhận $\\vec{n}_P = (2; -1; 2)$ làm vectơ chỉ phương nên có phương trình tham số:\n$$I(1 + 2t;\\; -1 - t;\\; 3 + 2t)$$\nDo $I \\in (Oxy) \\implies z_I = 0 \\iff 3 + 2t = 0 \\iff t = -\\frac{3}{2}$, suy ra ngay $I\\left(-2; \\frac{1}{2}; 0\\right)$ và $R = IH = |t| \\cdot |\\vec{n}_P| = \\frac{3}{2} \\cdot 3 = \\frac{9}{2}$ nhé!',
      is_accepted: true,
      likes_count: 16,
      nested_reply: {
        author_type: 'STUDENT',
        content:
          'Công thức $R = |t| \\cdot |\\vec{n}_P| = \\frac{3}{2} \\cdot \\sqrt{2^2 + (-1)^2 + 2^2} = \\frac{9}{2}$ quá nhanh luôn ạ, đỡ phải tính lại khoảng cách từ $I$ đến $H$!',
        likes_count: 7,
      },
    },
  },

  // 5. TOÁN HỌC 12 - CHƯƠNG 6 (XÁC SUẤT CÓ ĐIỀU KIỆN & CÔNG THỨC BAYES - GDPT 2018 MỚI)
  {
    slug: 'toan-12-cong-thuc-xac-suat-toan-phan-va-dinh-ly-bayes-trong-de-thi-thpt',
    title:
      'Toán 12 (GDPT 2018): Phân biệt Công thức xác suất toàn phần và Công thức Bayes $P(A|B) = \\frac{P(A)P(B|A)}{P(B)}$',
    content:
      'Trong chương trình Toán 12 mới có chuyên đề Xác suất có điều kiện. Một xét nghiệm y tế có độ nhạy $P(D^+ | B) = 0{,}98$ (tỷ lệ dương tính thật khi mắc bệnh $B$), tỷ lệ dương tính giả $P(D^+ | \\overline{B}) = 0{,}03$ và tỷ lệ mắc bệnh trong cộng đồng là $P(B) = 0{,}01$. Làm sao tính xác suất một người thực sự mắc bệnh khi có kết quả dương tính $P(B | D^+)$ ạ?',
    content_plain:
      'Trong chương trình Toán 12 mới có chuyên đề Xác suất có điều kiện. Làm sao áp dụng công thức xác suất toàn phần và công thức Bayes để tính P(B | D+)?',
    has_math: true,
    subject: 'Toán Học',
    grade: 12,
    chapter_id: 6,
    chapter_name: 'Chương 6: Xác suất có điều kiện và Công thức Bayes',
    tags: ['Xác suất điều kiện', 'Công thức Bayes', 'GDPT 2018', 'Lớp 12'],
    is_solved: true,
    views_count: 305,
    likes_count: 36,
    author_type: 'STUDENT',
    root_comment: {
      author_type: 'TEACHER',
      content:
        'Bài toán kinh điển của Chương 6 Toán 12! Em giải qua 2 bước:\n1. **Công thức xác suất toàn phần** tính $P(D^+)$:\n$$P(D^+) = P(B)P(D^+|B) + P(\\overline{B})P(D^+|\\overline{B}) = 0{,}01 \\cdot 0{,}98 + 0{,}99 \\cdot 0{,}03 = 0{,}0395$$\n2. **Công thức Bayes** tính xác suất hậu nghiệm $P(B|D^+)$:\n$$P(B|D^+) = \\frac{P(B)P(D^+|B)}{P(D^+)} = \\frac{0{,}0098}{0{,}0395} = \\frac{98}{395} \\approx 24{,}81\\%$$',
      is_accepted: true,
      likes_count: 28,
      nested_reply: {
        author_type: 'STUDENT',
        content:
          'Vẽ sơ đồ hình cây (Tree Diagram) ra 2 nhánh $B$ ($0{,}01$) và $\\overline{B}$ ($0{,}99$) rồi nhân dọc cộng ngang theo hướng dẫn của thầy là không bao giờ nhầm công thức Bayes luôn ạ!',
        likes_count: 11,
      },
    },
  },

  // 6. TOÁN HỌC 11 - CHƯƠNG 1 (PHƯƠNG TRÌNH LƯỢNG GIÁC)
  {
    slug: 'toan-11-tim-so-nghiem-phuong-trinh-luong-giac-tren-doan',
    title:
      'Toán 11: Tìm số nghiệm của phương trình $\\sin 2x - \\sqrt{3}\\cos 2x = 1$ trên khoảng $(0; 2\\pi)$',
    content:
      'Khi giải phương trình $\\sin 2x - \\sqrt{3}\\cos 2x = 1$, em chia hai vế cho $2$ để đưa về dạng $\\sin\\left(2x - \\frac{\\pi}{3}\\right) = \\frac{1}{2}$. Khi chặn miền $0 < x < 2\\pi$ để đếm giá trị nguyên $k \\in \\mathbb{Z}$ thì làm sao tránh sót nghiệm ở biên ạ?',
    content_plain:
      'Khi giải phương trình sin 2x - căn 3 cos 2x = 1, em chia hai vế cho 2 để đưa về dạng sin(2x - pi/3) = 1/2. Khi chặn miền 0 < x < 2pi để đếm giá trị nguyên k thì làm sao tránh sót nghiệm ở biên ạ?',
    has_math: true,
    subject: 'Toán Học',
    grade: 11,
    chapter_id: 1,
    chapter_name: 'Chương 1: Hàm số lượng giác và phương trình lượng giác',
    tags: ['Lượng giác', 'Phương trình', 'Lớp 11'],
    is_solved: true,
    views_count: 195,
    likes_count: 19,
    author_type: 'STUDENT',
    root_comment: {
      author_type: 'TEACHER',
      content:
        'Em viết rõ 2 họ nghiệm:\n$$\\begin{bmatrix} 2x - \\frac{\\pi}{3} = \\frac{\\pi}{6} + k2\\pi \\\\ 2x - \\frac{\\pi}{3} = \\frac{5\\pi}{6} + k2\\pi \\end{bmatrix} \\iff \\begin{bmatrix} x = \\frac{\\pi}{4} + k\\pi \\\\ x = \\frac{7\\pi}{12} + k\\pi \\end{bmatrix} \\quad (k \\in \\mathbb{Z})$$\nVì $0 < x < 2\\pi$, mỗi họ nghiệm có chu kỳ $\\pi$ sẽ cho đúng $2$ nghiệm ứng với $k \\in \\{0, 1\\}$, tổng cộng có $4$ nghiệm phân biệt.',
      is_accepted: true,
      likes_count: 14,
      nested_reply: {
        author_type: 'STUDENT',
        content:
          'Dạ vậy tổng các nghiệm trên $(0; 2\\pi)$ sẽ là $\\left(\\frac{\\pi}{4} + \\frac{5\\pi}{4}\\right) + \\left(\\frac{7\\pi}{12} + \\frac{19\\pi}{12}\\right) = \\frac{11\\pi}{3}$. Em cảm ơn thầy!',
        likes_count: 6,
      },
    },
  },

  // 7. TOÁN HỌC 11 - CHƯƠNG 6 (MŨ & LOGARIT - GDPT 2018 ĐƯA VỀ LỚP 11)
  {
    slug: 'toan-11-bat-phuong-trinh-logarit-chua-tham-so-va-dieu-kien-xac-dinh',
    title:
      'Toán 11: Giải bất phương trình $\\log_2(x^2 - 3x + 2) + \\log_{\\frac{1}{2}}(x - 1) \\le 1$ và điều kiện xác định',
    content:
      'Khi giải bất phương trình logarit có cơ số $0 < a = \\frac{1}{2} < 1$, em đưa $\\log_{\\frac{1}{2}}(x - 1) = -\\log_2(x - 1)$ rồi gộp thành:\n$$\\log_2\\left(\\frac{x^2 - 3x + 2}{x - 1}\\right) \\le 1$$\nCho em hỏi mình có được rút gọn $\\frac{(x-1)(x-2)}{x-1} = x - 2$ ngay không hay phải đặt điều kiện $x > 2$ trước ạ?',
    content_plain:
      'Khi giải bất phương trình logarit log2(x^2 - 3x + 2) + log1/2(x - 1) <= 1, cho em hỏi điều kiện xác định trước khi rút gọn phân thức bên trong logarit như thế nào?',
    has_math: true,
    subject: 'Toán Học',
    grade: 11,
    chapter_id: 6,
    chapter_name: 'Chương 6: Hàm số mũ và hàm số lôgarit',
    tags: ['Logarit', 'Bất phương trình', 'Lớp 11'],
    is_solved: true,
    views_count: 235,
    likes_count: 27,
    author_type: 'STUDENT',
    root_comment: {
      author_type: 'TEACHER',
      content:
        'Bắt buộc phải đặt **điều kiện xác định của từng biểu thức logarit ban đầu** trước khi rút gọn nhé:\n$$\\begin{cases} x^2 - 3x + 2 > 0 \\\\ x - 1 > 0 \\end{cases} \\iff \\begin{cases} x < 1 \\text{ hoặc } x > 2 \\\\ x > 1 \\end{cases} \\iff x > 2$$\nVới $x > 2$, bất phương trình tương đương $\\log_2(x - 2) \\le 1 \\iff x - 2 \\le 2^1 \\iff x \\le 4$. Kết hợp điều kiện ta được tập nghiệm $S = (2; 4]$.',
      is_accepted: true,
      likes_count: 20,
      nested_reply: {
        author_type: 'STUDENT',
        content:
          'Nếu rút gọn trước mà chỉ đặt $x - 2 > 0$ thì vẫn may mắn trùng $x > 2$, nhưng gặp bài $\\log_2(x^2 - 1)$ mà tách ra là dễ bị mở rộng miền xác định sai ngay. Em nhớ kỹ quy tắc đặt ĐKXĐ đầu tiên rồi ạ!',
        likes_count: 8,
      },
    },
  },

  // 8. TOÁN HỌC 10 - CHƯƠNG 3 (TAM THỨC BẬC HAI)
  {
    slug: 'toan-10-tim-tham-so-m-de-bat-phuong-trinh-bac-hai-nghiem-dung-voi-moi-x',
    title:
      'Toán 10: Tìm tham số $m$ để tam thức bậc hai $f(x) = (m-1)x^2 - 2(m-1)x + m + 3 > 0, \\forall x \\in \\mathbb{R}$',
    content:
      "Trong bài định lý về dấu của tam thức bậc hai Chương 3 Toán 10, khi hệ số $a = m - 1$ chứa tham số thì em phải xét riêng trường hợp $a = 0$ trước khi áp dụng hệ điều kiện $\\begin{cases} a > 0 \\\\ \\Delta' < 0 \\end{cases}$ đúng không ạ?",
    content_plain:
      'Trong bài định lý về dấu của tam thức bậc hai Chương 3 Toán 10, khi hệ số a = m - 1 chứa tham số thì em phải xét riêng trường hợp a = 0 trước khi áp dụng hệ điều kiện a > 0 và Delta < 0 đúng không ạ?',
    has_math: true,
    subject: 'Toán Học',
    grade: 10,
    chapter_id: 3,
    chapter_name: 'Chương 3: Hàm số bậc hai và đồ thị',
    tags: ['Tam thức bậc hai', 'Tham số m', 'Lớp 10'],
    is_solved: true,
    views_count: 240,
    likes_count: 26,
    author_type: 'STUDENT',
    root_comment: {
      author_type: 'TEACHER',
      content:
        "Chính xác! Với $m = 1$, ta có $f(x) = 4 > 0, \\forall x \\in \\mathbb{R}$ (thỏa mãn). Với $m \\ne 1$, điều kiện là:\n$$\\begin{cases} m - 1 > 0 \\\\ \\Delta' = (m-1)^2 - (m-1)(m+3) = -4(m-1) < 0 \\end{cases} \\iff m > 1$$\nGộp cả hai trường hợp lại ta được đáp án chuẩn là $m \\ge 1$ (rất nhiều bạn quên lấy dấu bằng tại $m=1$).",
      is_accepted: true,
      likes_count: 21,
      nested_reply: {
        author_type: 'STUDENT',
        content:
          'Đúng cái bẫy $m = 1$ em vừa bị sai trong bài kiểm tra 15 phút luôn ạ! Nhớ quy tắc hễ hệ số $a$ có tham số là phải xét $a = 0$ đầu tiên.',
        likes_count: 9,
      },
    },
  },

  // 9. TIN HỌC 12 - ĐỘ PHỨC TẠP THUẬT TOÁN TÌM KIẾM & SẮP XẾP
  {
    slug: 'tin-hoc-12-so-sanh-do-phuc-tap-thuat-toan-tim-kiem-nhi-phan-va-sap-xep',
    title:
      'Tin Học 12: Đánh giá độ phức tạp thời gian $\\mathcal{O}(\\log_2 n)$ của Tìm kiếm nhị phân và $\\mathcal{O}(n \\log_2 n)$ của Merge Sort',
    content:
      'Với dãy số đã sắp xếp gồm $n = 10^6$ phần tử, thuật toán tìm kiếm nhị phân (Binary Search) chỉ cần tối đa $\\lceil \\log_2(10^6) \\rceil = 20$ phép so sánh thay vì $T(n) = \\mathcal{O}(n)$ của tìm kiếm tuần tự. Làm sao chứng minh công thức truy hồi:\n$$T(n) = T\\left(\\frac{n}{2}\\right) + \\mathcal{O}(1) \\implies T(n) = \\mathcal{O}(\\log_2 n)$$\nđể trình bày tự luận ngắn gọn ạ?',
    content_plain:
      'Với dãy số đã sắp xếp gồm n = 10^6 phần tử, thuật toán tìm kiếm nhị phân chỉ cần tối đa 20 phép so sánh. Làm sao chứng minh công thức truy hồi T(n) = O(log2 n)?',
    has_math: true,
    subject: 'Tin Học',
    grade: 12,
    chapter_id: 2,
    chapter_name: 'Chủ đề F: Giải quyết vấn đề với sự trợ giúp của máy tính',
    tags: ['Độ phức tạp Big-O', 'Binary Search', 'Thuật toán', 'Lớp 12'],
    is_solved: true,
    views_count: 265,
    likes_count: 30,
    author_type: 'STUDENT',
    root_comment: {
      author_type: 'TEACHER',
      content:
        'Giả sử $n = 2^k \\implies k = \\log_2 n$. Sau mỗi bước chia đôi, kích thước miền tìm kiếm giảm từ $2^k \\to 2^{k-1} \\to \\dots \\to 2^0 = 1$ sau đúng $k$ bước. Mỗi bước tốn $\\mathcal{O}(1)$ phép so sánh nên tổng thời gian là:\n$$T(n) = T(1) + \\sum_{i=1}^{k} c = c_0 + c \\log_2 n = \\mathcal{O}(\\log_2 n)$$',
      is_accepted: true,
      likes_count: 22,
      nested_reply: {
        author_type: 'STUDENT',
        content:
          'Còn với Merge Sort thì mỗi tầng đệ quy tốn $\\mathcal{O}(n)$ để trộn và có $\\log_2 n$ tầng nên $T(n) = 2T(n/2) + \\mathcal{O}(n) = \\mathcal{O}(n \\log_2 n)$ đúng không thầy?',
        likes_count: 9,
      },
    },
  },

  // 10. TIN HỌC 12 - ĐỒ THỊ & THUẬT TOÁN DIJKSTRA / BFS-DFS
  {
    slug: 'tin-hoc-12-thuat-toan-dijkstra-tim-duong-di-ngan-nhat-tren-do-thi-trong-so',
    title:
      'Tin Học 12: Công thức cập nhật nhãn $d[v] = \\min(d[v],\\; d[u] + w(u, v))$ trong thuật toán Dijkstra và cấu trúc hàng đợi ưu tiên',
    content:
      'Khi cài đặt thuật toán Dijkstra tìm đường đi ngắn nhất từ đỉnh nguồn $s$ trên đồ thị có $V$ đỉnh và $E$ cạnh với trọng số không âm $w(u, v) \\ge 0$, nếu dùng mảng thường thì độ phức tạp là $\\mathcal{O}(V^2)$. Khi dùng `priority_queue` (Min-Heap) thì vì sao độ phức tạp giảm xuống còn:\n$$T(V, E) = \\mathcal{O}((V + E)\\log_2 V)$$\nvà tại sao Dijkstra không chạy đúng khi có cạnh trọng số âm $w(u, v) < 0$ ạ?',
    content_plain:
      'Khi cài đặt thuật toán Dijkstra tìm đường đi ngắn nhất từ đỉnh nguồn s trên đồ thị có V đỉnh và E cạnh, khi dùng priority_queue Min-Heap thì vì sao độ phức tạp giảm xuống O((V + E) log2 V)?',
    has_math: true,
    subject: 'Tin Học',
    grade: 12,
    chapter_id: 4,
    chapter_name:
      'Chủ đề CS: Cấu trúc dữ liệu Đồ thị và Thuật toán tìm đường đi',
    tags: ['Đồ thị - Graph', 'Dijkstra', 'Min-Heap', 'Lớp 12'],
    is_solved: true,
    views_count: 250,
    likes_count: 29,
    author_type: 'STUDENT',
    root_comment: {
      author_type: 'TEACHER',
      content:
        'Với Min-Heap (`priority_queue`), thao tác lấy đỉnh $u$ có $d[u]$ nhỏ nhất tốn $\\mathcal{O}(\\log_2 V)$ cho $V$ đỉnh, và mỗi cạnh $(u, v) \\in E$ thực hiện tối đa $1$ lần nới lỏng (relaxation) đẩy vào Heap tốn $\\mathcal{O}(\\log_2 V)$, nên tổng thời gian là $\\mathcal{O}((V + E)\\log_2 V)$. Khi có cạnh âm $w(u, v) < 0$, tính chất tham lam ($d[u]$ đã cố định không thể nhỏ hơn nữa) bị phá vỡ nên phải dùng **Bellman-Ford** $\\mathcal{O}(V \\cdot E)$ nhé!',
      is_accepted: true,
      likes_count: 21,
      nested_reply: {
        author_type: 'STUDENT',
        content:
          'Giải thích về tính chất tham lam $w(u, v) \\ge 0 \\implies d[u] + w(u, v) \\ge d[u]$ quá dễ hiểu luôn ạ! Em cảm ơn thầy!',
        likes_count: 8,
      },
    },
  },

  // 11. TIN HỌC 11 - QUY HOẠCH ĐỘNG DÃY CON TĂNG DÀI NHẤT (LIS)
  {
    slug: 'tin-hoc-11-cong-thuc-truy-hoi-quy-hoach-dong-day-con-tang-dai-nhat-lis',
    title:
      'Tin Học 11: Công thức truy hồi Quy hoạch động $dp[i] = \\max_{j < i,\\, a_j < a_i}(dp[j] + 1)$ cho bài toán Dãy con tăng dài nhất (LIS)',
    content:
      'Em đang ôn chuyên đề Quy hoạch động Tin học 11. Với công thức cơ bản:\n$$dp[i] = 1 + \\max(\\{dp[j] \\mid 1 \\le j < i,\\; a_j < a_i\\} \\cup \\{0\\})$$\nthì độ phức tạp là $\\mathcal{O}(n^2)$. Khi $n \\le 10^5$, làm sao kết hợp mảng phụ và chặt nhị phân `lower_bound` để tối ưu xuống $\\mathcal{O}(n \\log_2 n)$ ạ?',
    content_plain:
      'Em đang ôn chuyên đề Quy hoạch động Tin học 11 bài toán Dãy con tăng dài nhất (LIS). Khi n <= 10^5, làm sao kết hợp chặt nhị phân để tối ưu từ O(n^2) xuống O(n log n)?',
    has_math: true,
    subject: 'Tin Học',
    grade: 11,
    chapter_id: 3,
    chapter_name: 'Chủ đề F: Thuật toán và Cấu trúc dữ liệu',
    tags: ['Quy hoạch động', 'Thuật toán', 'Big-O', 'Lớp 11'],
    is_solved: true,
    views_count: 220,
    likes_count: 25,
    author_type: 'STUDENT',
    root_comment: {
      author_type: 'TEACHER',
      content:
        'Em duy trì mảng `tail[len]` lưu giá trị kết thúc **nhỏ nhất** của một dãy con tăng độ dài `len`. Vì mảng `tail` luôn đơn điệu tăng nghiêm ngặt ($tail[1] < tail[2] < \\dots < tail[L]$), với mỗi $a_i$ ta chỉ tốn $\\mathcal{O}(\\log_2 L)$ để tìm vị trí đầu tiên $tail[pos] \\ge a_i$ bằng chặt nhị phân, tổng thời gian là $\\sum_{i=1}^n \\mathcal{O}(\\log_2 i) = \\mathcal{O}(n \\log_2 n)$.',
      is_accepted: true,
      likes_count: 19,
      nested_reply: {
        author_type: 'STUDENT',
        content:
          'Nếu đề yêu cầu dãy con không giảm ($a_j \\le a_i$) thì mình chỉ cần đổi `lower_bound` ($\\ge a_i$) thành `upper_bound` ($> a_i$) là xong đúng không thầy?',
        likes_count: 8,
      },
    },
  },

  // 12. TIN HỌC 11 - ĐỆ QUY CHIA ĐỂ TRỊ & LŨY THỪA NHỊ PHÂN MODULO
  {
    slug: 'tin-hoc-11-thuat-toan-luy-thua-nhi-phan-chia-de-tri-va-so-hoc-modulo',
    title:
      'Tin Học 11: Thuật toán Lũy thừa nhị phân (Binary Exponentiation) tính $a^n \\bmod M$ trong thời gian $\\mathcal{O}(\\log_2 n)$',
    content:
      'Khi tính $a^n \\bmod M$ với $n \\le 10^{18}$ và $M = 10^9 + 7$, nếu nhân lặp tuần tự sẽ bị quá thời gian (TLE). Công thức đệ quy Chia để trị:\n$$a^n = \\begin{cases} (a^{n/2})^2 & \\text{nếu } n \\text{ chẵn} \\\\ a \\cdot (a^{(n-1)/2})^2 & \\text{nếu } n \\text{ lẻ} \\end{cases}$$\nkhi chuyển sang vòng lặp `while (n > 0)` dùng phép dịch bit `n >>= 1` và `n & 1` viết như thế nào để tránh tràn số nguyên $64\\text{-bit}$ ạ?',
    content_plain:
      'Khi tính a^n mod M với n <= 10^18 và M = 10^9 + 7, làm sao áp dụng công thức lũy thừa nhị phân Chia để trị trong thời gian O(log2 n) mà không bị tràn số?',
    has_math: true,
    subject: 'Tin Học',
    grade: 11,
    chapter_id: 2,
    chapter_name: 'Chủ đề F: Kỹ thuật Thiết kế Thuật toán Chia để trị',
    tags: ['Chia để trị', 'Lũy thừa nhị phân', 'Modulo', 'Lớp 11'],
    is_solved: true,
    views_count: 205,
    likes_count: 23,
    author_type: 'STUDENT',
    root_comment: {
      author_type: 'TEACHER',
      content:
        'Bản chất là khai triển $n$ theo hệ nhị phân $n = \\sum b_k 2^k$. Ở mỗi bước lặp: nếu bit cuối `(n & 1) == 1` thì cập nhật `res = (res * a) % M`, sau đó luôn bình phương cơ số `a = (a * a) % M` và dịch phải `n >>= 1`. Vì $M = 10^9 + 7 < 2^{30}$ nên tích `(a * a)` tối đa $\\approx 10^{18} < 2^{63} - 1$, vừa khít kiểu `long long` ($64\\text{-bit}$) không lo tràn số!',
      is_accepted: true,
      likes_count: 17,
      nested_reply: {
        author_type: 'STUDENT',
        content:
          'Áp dụng kèm Định lý Fermat nhỏ $a^{-1} \\equiv a^{M-2} \\pmod M$ (khi $M$ nguyên tố) để tính nghịch đảo modulo cho tổ hợp $C_n^k \\bmod (10^9+7)$ cực kỳ tiện luôn ạ!',
        likes_count: 7,
      },
    },
  },

  // 13. TIN HỌC 10 - HỆ ĐẾM NHỊ PHÂN & BIỂU DIỄN DỮ LIỆU MÃ BÙ 2
  {
    slug: 'tin-hoc-10-chuyen-doi-he-nhi-phan-va-thap-luc-phan-theo-luy-thua-co-so-2',
    title:
      'Tin Học 10: Công thức chuyển đổi số nhị phân $N_{(2)} = \\sum_{i=0}^{k-1} b_i \\cdot 2^i$ sang hệ thập phân và bù 2 (Two’s Complement)',
    content:
      'Trong bài Biểu diễn dữ liệu trong máy tính (Tin 10 GDPT 2018), một số nguyên không dấu $8\\text{ bit}$ có giá trị từ $0$ đến $2^8 - 1 = 255$. Khi biểu diễn số nguyên có dấu bằng mã bù $2$ trên $n = 8\\text{ bit}$, vì sao dải giá trị lại là $[-2^{n-1},\\; 2^{n-1} - 1] = [-128,\\; 127]$ mà phần âm nhiều hơn phần dương $1$ số ạ?',
    content_plain:
      'Trong bài Biểu diễn dữ liệu trong máy tính Tin 10, khi biểu diễn số nguyên có dấu bằng mã bù 2 trên 8 bit, vì sao dải giá trị lại từ -128 đến 127?',
    has_math: true,
    subject: 'Tin Học',
    grade: 10,
    chapter_id: 1,
    chapter_name: 'Chủ đề A: Máy tính và xã hội tri thức - Biểu diễn thông tin',
    tags: ['Hệ nhị phân', 'Mã bù 2', 'Biểu diễn số', 'Lớp 10'],
    is_solved: true,
    views_count: 175,
    likes_count: 15,
    author_type: 'STUDENT',
    root_comment: {
      author_type: 'TEACHER',
      content:
        'Trên $n = 8\\text{ bit}$ có tổng cộng $2^8 = 256$ tổ hợp bit, được chia đôi: $128$ tổ hợp có bit dấu $b_7 = 0$ (gồm số $0$ và các số dương $1 \\dots 127$) và $128$ tổ hợp có bit dấu $b_7 = 1$ (biểu diễn từ $-1$ đến $-128$). Công thức trọng số tổng quát của mã bù $2$ là:\n$$V = -b_{n-1} \\cdot 2^{n-1} + \\sum_{i=0}^{n-2} b_i \\cdot 2^i$$\nVì số $0$ (`00000000`) đã chiếm mất $1$ vị trí bên nhánh không âm nên nhánh dương chỉ tới $2^{n-1} - 1 = 127$, còn `10000000` ứng với $-1 \\cdot 2^7 + 0 = -128$.',
      is_accepted: true,
      likes_count: 14,
      nested_reply: {
        author_type: 'STUDENT',
        content:
          'Công thức trọng số $V = -b_7 \\cdot 2^7 + \\sum_{i=0}^6 b_i \\cdot 2^i$ giải thích quá rõ ràng vì sao `11111111` bằng $-128 + 127 = -1$ luôn ạ!',
        likes_count: 6,
      },
    },
  },

  // 14. VẬT LÝ 12 - NHIỆT HỌC (GDPT 2018)
  {
    slug: 'vat-ly-12-phuong-trinh-trang-thai-khi-ly-tuong-va-noi-nang',
    title:
      'Vật Lý 12 (GDPT 2018): Áp dụng phương trình Clapeiron $pV = nRT$ và nguyên lý I Nhiệt động lực học',
    content:
      'Một khối khí lý tưởng gồm $n = 2\\text{ mol}$ thực hiện quá trình đẳng áp từ nhiệt độ $T_1 = 300\\text{ K}$ đến $T_2 = 450\\text{ K}$. Biết nhiệt dung mol đẳng áp là $C_p = \\frac{5}{2}R$. Tính công $A$, nhiệt lượng $Q$ và độ biến thiên nội năng $\\Delta U = Q + A$ theo quy ước dấu chuẩn GDPT 2018 ạ!',
    content_plain:
      'Một khối khí lý tưởng gồm n = 2 mol thực hiện quá trình đẳng áp từ nhiệt độ T1 = 300 K đến T2 = 450 K. Tính công A, nhiệt lượng Q và độ biến thiên nội năng theo quy ước dấu chuẩn GDPT 2018.',
    has_math: true,
    subject: 'Vật Lý',
    grade: 12,
    chapter_id: 2,
    chapter_name: 'Chương 2: Khí lý tưởng',
    tags: ['Khí lý tưởng', 'Nhiệt động lực học', 'Lớp 12'],
    is_solved: true,
    views_count: 290,
    likes_count: 31,
    author_type: 'STUDENT',
    root_comment: {
      author_type: 'TEACHER',
      content:
        'Khi dãn đẳng áp, khí thực hiện công lên môi trường nên:\n$$A = -p\\Delta V = -nR\\Delta T = -2 \\cdot 8{,}31 \\cdot (450 - 300) = -2493\\text{ J}$$\nNhiệt lượng khí nhận vào là $Q = nC_p\\Delta T = \\frac{5}{2}nR\\Delta T = 6232{,}5\\text{ J}$, suy ra độ biến thiên nội năng $\\Delta U = Q + A = \\frac{3}{2}nR\\Delta T = 3739{,}5\\text{ J}$.',
      is_accepted: true,
      likes_count: 24,
      nested_reply: {
        author_type: 'STUDENT',
        content:
          'Dạ vậy tỉ số giữa công mà chất khí thực hiện và nhiệt lượng nhận vào trong quá trình đẳng áp của khí lưỡng nguyên tử luôn là $\\frac{|A|}{Q} = \\frac{nR\\Delta T}{\\frac{5}{2}nR\\Delta T} = \\frac{2}{5} = 40\\%$ phải không thầy?',
        likes_count: 10,
      },
    },
  },

  // 15. VẬT LÝ 11 - DAO ĐỘNG ĐIỀU HÒA (GDPT 2018 ĐƯA DAO ĐỘNG VỀ LỚP 11)
  {
    slug: 'vat-ly-11-chu-ky-con-lac-lo-xo-va-he-thuc-doc-lap-thoi-gian',
    title:
      'Vật Lý 11: Áp dụng hệ thức độc lập thời gian $A^2 = x^2 + \\frac{v^2}{\\omega^2}$ trong dao động điều hòa',
    content:
      'Một con lắc lò xo có độ cứng $k = 100\\text{ N/m}$, vật nặng $m = 250\\text{ g}$ dao động điều hòa. Khi vật ở li độ $x = 3\\text{ cm}$ thì vận tốc có độ lớn $|v| = 80\\text{ cm/s}$. Làm sao tìm nhanh tần số góc $\\omega = \\sqrt{\\frac{k}{m}}$ và biên độ $A$ ạ?',
    content_plain:
      'Một con lắc lò xo có độ cứng k = 100 N/m, vật nặng m = 250 g dao động điều hòa. Khi vật ở li độ x = 3 cm thì vận tốc có độ lớn 80 cm/s. Làm sao tìm nhanh tần số góc và biên độ A?',
    has_math: true,
    subject: 'Vật Lý',
    grade: 11,
    chapter_id: 1,
    chapter_name: 'Chương 1: Dao động',
    tags: ['Dao động điều hòa', 'Con lắc lò xo', 'Lớp 11'],
    is_solved: true,
    views_count: 260,
    likes_count: 25,
    author_type: 'STUDENT',
    root_comment: {
      author_type: 'TEACHER',
      content:
        'Đổi $m = 0{,}25\\text{ kg}$, ta có $\\omega = \\sqrt{\\frac{k}{m}} = \\sqrt{\\frac{100}{0{,}25}} = 20\\text{ rad/s}$. Thay vào hệ thức độc lập thời gian:\n$$A = \\sqrt{x^2 + \\left(\\frac{v}{\\omega}\\right)^2} = \\sqrt{3^2 + \\left(\\frac{80}{20}\\right)^2} = \\sqrt{9 + 16} = 5\\text{ cm}$$',
      is_accepted: true,
      likes_count: 18,
      nested_reply: {
        author_type: 'STUDENT',
        content:
          'Từ $A = 5\\text{ cm} = 0{,}05\\text{ m}$ em tính luôn được cơ năng $W = \\frac{1}{2}kA^2 = \\frac{1}{2} \\cdot 100 \\cdot 0{,}05^2 = 0{,}125\\text{ J}$. Em cảm ơn thầy ạ!',
        likes_count: 7,
      },
    },
  },

  // 16. HÓA HỌC 12 - ESTE & LIPIT
  {
    slug: 'hoa-hoc-12-phuong-phap-dong-dang-hoa-va-quy-doi-este-da-chuc',
    title:
      'Hóa Học 12: Phương pháp đồng đẳng hóa kết hợp bảo toàn e cho hỗn hợp Ester đa chức',
    content:
      'Khi đốt cháy hoàn toàn hỗn hợp $E$ gồm các ester hai chức mạch hở tạo bởi carboxylic acid no và alcohol no, ta áp dụng công thức liên hệ số mol:\n$$n_{\\text{CO}_2} - n_{\\text{H}_2\\text{O}} = (k - 1)n_E$$\nVới ester hai chức no ($k = 2$) thì $n_E = n_{\\text{CO}_2} - n_{\\text{H}_2\\text{O}}$ luôn đúng phải không thầy cô?',
    content_plain:
      'Khi đốt cháy hoàn toàn hỗn hợp E gồm các ester hai chức mạch hở tạo bởi carboxylic acid no và alcohol no, ta áp dụng công thức liên hệ số mol CO2 và H2O như thế nào?',
    has_math: true,
    subject: 'Hóa Học',
    grade: 12,
    chapter_id: 1,
    chapter_name: 'Chương 1: Ester - Lipid',
    tags: ['Ester - Lipid', 'Đồng đẳng hóa', 'Bảo toàn mol', 'Lớp 12'],
    is_solved: true,
    views_count: 340,
    likes_count: 38,
    author_type: 'STUDENT',
    root_comment: {
      author_type: 'TEACHER',
      content:
        'Đúng rồi em! Ester hai chức no, mạch hở có công thức chung $\\text{C}_n\\text{H}_{2n-2}\\text{O}_4$ (độ bất bão hòa $k = 2$ do có $2$ nhóm $-\\text{COO}-$), nên khi đốt cháy luôn có:\n$$n_{\\text{CO}_2} - n_{\\text{H}_2\\text{O}} = n_E \\quad \\text{và} \\quad n_{\\text{NaOH phản ứng}} = 2n_E$$',
      is_accepted: true,
      likes_count: 27,
      nested_reply: {
        author_type: 'STUDENT',
        content:
          'Nếu quy đổi hỗn hợp $E$ về chất đầu dãy $(\\text{COOCH}_3)_2$ và các nhóm $\\text{CH}_2$ thì $n_{(\\text{COOCH}_3)_2} = n_E$ luôn đúng phải không thầy?',
        likes_count: 11,
      },
    },
    extra_comment: {
      author_type: 'ADMIN',
      content:
        'Bổ sung bảo toàn nguyên tố Oxi khi đốt cháy ester $2$ chức: $4n_E + 2n_{\\text{O}_2} = 2n_{\\text{CO}_2} + n_{\\text{H}_2\\text{O}}$ giúp lập phương trình thứ hai cực nhanh!',
      likes_count: 13,
    },
  },

  // 17. HÓA HỌC 11 - CÂN BẰNG HÓA HỌC & pH
  {
    slug: 'hoa-hoc-11-hang-so-can-bang-kc-va-tinh-ph-dung-dich-axit-yeu',
    title:
      'Hóa Học 11: Tính hằng số cân bằng $K_C$ của phản ứng tổng hợp $\\text{NH}_3$ và độ $\\text{pH} = -\\log[\\text{H}^+]$',
    content:
      'Cho phản ứng thuận nghịch ở trạng thái cân bằng:\n$$\\text{N}_2(g) + 3\\text{H}_2(g) \\rightleftharpoons 2\\text{NH}_3(g) \\quad (\\Delta_r H^\\circ_{298} < 0)$$\nBiểu thức $K_C = \\frac{[\\text{NH}_3]^2}{[\\text{N}_2][\\text{H}_2]^3}$ có thay đổi khi ta tăng áp suất chung của hệ không, hay chỉ phụ thuộc vào nhiệt độ $T$ ạ?',
    content_plain:
      'Cho phản ứng thuận nghịch tổng hợp NH3 ở trạng thái cân bằng. Biểu thức hằng số cân bằng KC có thay đổi khi tăng áp suất chung của hệ không hay chỉ phụ thuộc vào nhiệt độ T?',
    has_math: true,
    subject: 'Hóa Học',
    grade: 11,
    chapter_id: 1,
    chapter_name: 'Chương 1: Cân bằng hóa học',
    tags: ['Cân bằng hóa học', 'Nguyên lý Le Chatelier', 'pH', 'Lớp 11'],
    is_solved: true,
    views_count: 205,
    likes_count: 21,
    author_type: 'STUDENT',
    root_comment: {
      author_type: 'TEACHER',
      content:
        'Hằng số cân bằng $K_C$ **chỉ phụ thuộc vào bản chất phản ứng và nhiệt độ $T$**, không phụ thuộc vào áp suất hay nồng độ ban đầu nhé! Khi tăng áp suất, cân bằng chuyển dịch theo chiều thuận (giảm số mol khí từ $4$ xuống $2$), nhưng tỉ số $K_C = \\frac{[\\text{NH}_3]^2}{[\\text{N}_2][\\text{H}_2]^3}$ ở trạng thái cân bằng mới vẫn giữ nguyên.',
      is_accepted: true,
      likes_count: 16,
      nested_reply: {
        author_type: 'STUDENT',
        content:
          'Còn vì phản ứng tỏa nhiệt ($\\Delta_r H^\\circ_{298} < 0$) nên nếu tăng nhiệt độ $T$ thì cân bằng dịch chuyển theo chiều nghịch và $K_C$ giảm xuống ạ!',
        likes_count: 7,
      },
    },
  },

  // 18. TIẾNG ANH 12 - CẤU TRÚC ĐẢO NGỮ (INVERSION FORMULAS)
  {
    slug: 'tieng-anh-12-cong-thuc-dao-ngu-voi-not-only-hardly-when-va-no-sooner-than',
    title:
      'Tiếng Anh 12: Hệ thống công thức Đảo ngữ (Inversion) với Hardly... when và No sooner... than trong đề tốt nghiệp THPT',
    content:
      'Khi ôn phần viết lại câu tương đương (Sentence Transformation), em thường tóm tắt công thức cấu trúc đảo ngữ dưới dạng biểu thức:\n$$\\text{Hardly / Scarcely} + \\text{had} + S + V_{\\text{p.p}} + \\text{when} + S + V_{\\text{ed/2}}$$\n$$\\text{No sooner} + \\text{had} + S + V_{\\text{p.p}} + \\text{than} + S + V_{\\text{ed/2}}$$\nCho em hỏi nếu vế đầu bắt đầu bằng `Not until + [Time/Clause]` thì phần đảo ngữ $\\text{Aux} + S + V_{\\text{inf}}$ nằm ở mệnh đề chính phía sau đúng không ạ?',
    content_plain:
      'Khi ôn phần viết lại câu tương đương Sentence Transformation, cho em hỏi công thức đảo ngữ với Hardly when, No sooner than và Not until đặt trợ động từ ở mệnh đề nào?',
    has_math: true,
    subject: 'Tiếng Anh',
    grade: 12,
    chapter_id: 2,
    chapter_name: 'Grammar Focus: Inversion & Cleft Sentences (Lớp 12)',
    tags: ['Ngữ pháp', 'Đảo ngữ - Inversion', 'Ôn thi THPT', 'Lớp 12'],
    is_solved: true,
    views_count: 310,
    likes_count: 34,
    author_type: 'STUDENT',
    root_comment: {
      author_type: 'TEACHER',
      content:
        'Đúng rồi em! Với `Not until` và `Only when / Only after`, ta không đảo ở mệnh đề phụ ngay sau đó mà đảo ở mệnh đề chính phía sau theo công thức:\n$$\\text{Not until / Only when} + (S_1 + V_1) + \\mathbf{\\text{Aux} + S_2 + V_{\\text{bare-inf}}}$$\nVí dụ: *"Not until he graduated did he realize the value of time."*',
      is_accepted: true,
      likes_count: 23,
      nested_reply: {
        author_type: 'STUDENT',
        content:
          'Dạ em nhớ rồi ạ: nhóm `Not until / Only when / Only by` luôn đảo ngữ ở vế thứ hai ($\\text{Aux} + S_2 + V_{\\text{bare-inf}}$)!',
        likes_count: 9,
      },
    },
  },

  // 19. SINH HỌC 12 - QUY LUẬT DI TRUYỀN QUẦN THỂ HARDY-WEINBERG & ADN
  {
    slug: 'sinh-hoc-12-dinh-luat-can-bang-di-truyen-hardy-weinberg-va-tan-so-alen',
    title:
      'Sinh Học 12: Áp dụng định luật cân bằng Hardy-Weinberg $p^2\\text{AA} + 2pq\\text{Aa} + q^2\\text{aa} = 1$ tính tần số kiểu gen dị hợp',
    content:
      'Một quần thể thực vật giao phấn ngẫu nhiên đang ở trạng thái cân bằng di truyền Hardy-Weinberg có hai alen $A$ (hoa đỏ, trội hoàn toàn) và $a$ (hoa trắng, lặn). Biết tỷ lệ cây hoa trắng $(aa)$ trong quần thể chiếm $q^2 = 16\\%$. Làm sao tính nhanh tần số alen $p(A),\\; q(a)$ và tỷ lệ cây hoa đỏ dị hợp tử $Aa$ trong số các cây hoa đỏ $\\frac{2pq}{p^2 + 2pq}$ ạ?',
    content_plain:
      'Một quần thể thực vật giao phấn ngẫu nhiên đang ở trạng thái cân bằng di truyền Hardy-Weinberg có tỷ lệ cây hoa trắng aa chiếm 16%. Làm sao tính tần số alen p(A), q(a) và tỷ lệ cây hoa đỏ dị hợp tử Aa?',
    has_math: true,
    subject: 'Sinh Học',
    grade: 12,
    chapter_id: 2,
    chapter_name: 'Chương 2: Di truyền học quần thể và Quy luật Hardy-Weinberg',
    tags: ['Di truyền quần thể', 'Hardy-Weinberg', 'Tần số alen', 'Lớp 12'],
    is_solved: true,
    views_count: 245,
    likes_count: 28,
    author_type: 'STUDENT',
    root_comment: {
      author_type: 'TEACHER',
      content:
        'Vì quần thể cân bằng di truyền nên từ $q^2 = 0{,}16 \\implies q(a) = \\sqrt{0{,}16} = 0{,}4$ và $p(A) = 1 - q = 0{,}6$. Cấu trúc di truyền của quần thể là:\n$$0{,}36\\text{AA} : 0{,}48\\text{Aa} : 0{,}16\\text{aa}$$\nTrong tổng số cây hoa đỏ ($1 - q^2 = 0{,}84$), tỷ lệ cây hoa đỏ dị hợp tử $Aa$ là $\\frac{2pq}{1 - q^2} = \\frac{2q}{1 + q} = \\frac{0{,}48}{0{,}84} = \\frac{4}{7} \\approx 57{,}14\\%$ nhé!',
      is_accepted: true,
      likes_count: 21,
      nested_reply: {
        author_type: 'STUDENT',
        content:
          'Công thức rút gọn $\\frac{2pq}{p^2 + 2pq} = \\frac{2pq}{p(p + 2q)} = \\frac{2q}{1 + q}$ của cô bấm máy tính siêu nhanh luôn ạ!',
        likes_count: 9,
      },
    },
  },

  // 20. NGỮ VĂN 12 - CẤU TRÚC ĐOẠN VĂN NGHỊ LUẬN XÃ HỘI 200 CHỮ & ĐỌC HIỂU
  {
    slug: 'ngu-van-12-cong-thuc-phan-bo-dung-luong-doan-van-nghi-luan-xa-hoi-200-chu',
    title:
      'Ngữ Văn 12 (GDPT 2018): Công thức phân bổ dung lượng đoạn văn Nghị luận xã hội $200$ chữ và ma trận điểm Đọc hiểu $4{,}0$ điểm',
    content:
      'Trong cấu trúc đề thi tốt nghiệp THPT môn Ngữ Văn theo chương trình GDPT 2018 ($100\\%$ ngữ liệu ngoài SGK), phần Viết gồm đoạn văn Nghị luận xã hội khoảng $200$ chữ ($2{,}0\\text{ điểm}$) và bài văn Nghị luận văn học khoảng $600$ chữ ($4{,}0\\text{ điểm}$). Thầy cô cho em hỏi tỷ lệ phân bổ số câu trong đoạn văn $200$ chữ theo mô hình:\n$$\\text{Mở đoạn } (10\\%) + \\text{Giải thích } (15\\%) + \\text{Bàn luận & Dẫn chứng } (55\\%) + \\text{Phản đề & Bài học } (20\\%)$$\ntương ứng khoảng bao nhiêu dòng tờ giấy thi là chuẩn barem nhất ạ?',
    content_plain:
      'Trong cấu trúc đề thi tốt nghiệp THPT môn Ngữ Văn chương trình GDPT 2018, phần viết đoạn văn Nghị luận xã hội 200 chữ nên phân bổ dung lượng Mở đoạn, Giải thích, Bàn luận, Dẫn chứng và Bài học như thế nào?',
    has_math: true,
    subject: 'Ngữ Văn',
    grade: 12,
    chapter_id: 1,
    chapter_name:
      'Chuyên đề Kỹ năng Viết đoạn văn Nghị luận xã hội 200 chữ (GDPT 2018)',
    tags: ['Nghị luận xã hội', 'Đoạn văn 200 chữ', 'GDPT 2018', 'Lớp 12'],
    is_solved: true,
    views_count: 280,
    likes_count: 33,
    author_type: 'STUDENT',
    root_comment: {
      author_type: 'TEACHER',
      content:
        'Đoạn văn $200$ chữ (cho phép dao động $200 \\pm 50$ chữ, tức khoảng $22 - 25$ dòng giấy thi, tuyệt đối **không xuống dòng tách đoạn**) nên chia theo công thức $12 - 15$ câu:\n- **Mở đoạn ($1 - 2$ câu):** Dẫn dắt trực tiếp vào vấn đề nghị luận ($0{,}25\\text{đ}$).\n- **Giải thích ($1 - 2$ câu):** Giải thích từ khóa trọng tâm ($0{,}25\\text{đ}$).\n- **Phân tích - Chứng minh ($6 - 8$ câu):** Nêu $2 - 3$ luận điểm + $1$ dẫn chứng thực tế ngắn gọn, tiêu biểu ($1{,}0\\text{đ}$).\n- **Bàn luận mở rộng & Bài học nhận thức/hành động ($2 - 3$ câu):** Phản đề và rút ra thông điệp cá nhân ($0{,}5\\text{đ}$).',
      is_accepted: true,
      likes_count: 25,
      nested_reply: {
        author_type: 'STUDENT',
        content:
          'Barem điểm $0{,}25 + 0{,}25 + 1{,}0 + 0{,}5 = 2{,}0\\text{ điểm}$ rõ ràng từng ý thế này giúp em canh đúng $2/3$ trang giấy thi mà không sợ lan man quá giờ cho câu $600$ chữ!',
        likes_count: 10,
      },
    },
  },
];

const FORUM_AUTHOR_PERSONAS = [
  // 0: Admin (cho bài Nội quy #1)
  {
    email: 'admin@schoolify.top',
    fullname: 'Ban Quản Trị Schoolify',
    avatar_url:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80',
    grade_level: 'Hệ Thống',
    is_admin: true,
  },
  // 1..19: 19 học sinh riêng biệt cho 19 câu hỏi chuyên đề
  {
    email: 'student.minhanh@schoolify.edu.vn',
    fullname: 'Nguyễn Minh Anh',
    avatar_url:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=160&auto=format&fit=crop&q=80',
    grade_level: 'Lớp 12A1 - THPT Chuyên KHTN',
  },
  {
    email: 'student.minh@schoolify.edu.vn',
    fullname: 'Nguyễn Hoàng Minh',
    avatar_url:
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=160&auto=format&fit=crop&q=80',
    grade_level: 'Lớp 12 Toán 1 - THPT Chuyên Hà Nội - Amsterdam',
  },
  {
    email: 'student.khanhlinh@schoolify.edu.vn',
    fullname: 'Trần Khánh Linh',
    avatar_url:
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=160&auto=format&fit=crop&q=80',
    grade_level: 'Lớp 12A2 - THPT Chu Văn An',
  },
  {
    email: 'student.ducduy@schoolify.edu.vn',
    fullname: 'Lê Đức Duy',
    avatar_url:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=160&auto=format&fit=crop&q=80',
    grade_level: 'Lớp 12 Toán - THPT Chuyên Lê Hồng Phong',
  },
  {
    email: 'student.phuongthao@schoolify.edu.vn',
    fullname: 'Phạm Phương Thảo',
    avatar_url:
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=160&auto=format&fit=crop&q=80',
    grade_level: 'Lớp 11A1 - THPT Chuyên Sư Phạm',
  },
  {
    email: 'student.quochuy@schoolify.edu.vn',
    fullname: 'Võ Quốc Huy',
    avatar_url:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=160&auto=format&fit=crop&q=80',
    grade_level: 'Lớp 11 Toán 2 - THPT Chuyên Phan Bội Châu',
  },
  {
    email: 'student.baotran@schoolify.edu.vn',
    fullname: 'Đặng Bảo Trân',
    avatar_url:
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=160&auto=format&fit=crop&q=80',
    grade_level: 'Lớp 10 Toán 1 - THPT Chuyên Trần Phú',
  },
  {
    email: 'student.tuananh@schoolify.edu.vn',
    fullname: 'Hoàng Tuấn Anh',
    avatar_url:
      'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=160&auto=format&fit=crop&q=80',
    grade_level: 'Lớp 12 Tin - THPT Chuyên KHTN',
  },
  {
    email: 'student.quanghien@schoolify.edu.vn',
    fullname: 'Bùi Quang Hiển',
    avatar_url:
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=160&auto=format&fit=crop&q=80',
    grade_level: 'Lớp 12 chuyên Tin - THPT Chuyên Lam Sơn',
  },
  {
    email: 'student.nhatminh@schoolify.edu.vn',
    fullname: 'Đỗ Nhật Minh',
    avatar_url:
      'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=160&auto=format&fit=crop&q=80',
    grade_level: 'Lớp 11 Tin - THPT Chuyên Quốc Học Huế',
  },
  {
    email: 'student.thanhha@schoolify.edu.vn',
    fullname: 'Ngô Thanh Hà',
    avatar_url:
      'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=160&auto=format&fit=crop&q=80',
    grade_level: 'Lớp 11 chuyên Tin - THPT Năng Khiếu ĐHQG',
  },
  {
    email: 'student.giakiet@schoolify.edu.vn',
    fullname: 'Trương Gia Kiệt',
    avatar_url:
      'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=160&auto=format&fit=crop&q=80',
    grade_level: 'Lớp 10 Tin - THPT Chuyên Lê Quý Đôn',
  },
  {
    email: 'student.giabao@schoolify.edu.vn',
    fullname: 'Trần Gia Bảo',
    avatar_url:
      'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=160&auto=format&fit=crop&q=80',
    grade_level: 'Lớp 12 Lý - THPT Chuyên Nguyễn Huệ',
  },
  {
    email: 'student.haidang@schoolify.edu.vn',
    fullname: 'Phan Hải Đăng',
    avatar_url:
      'https://images.unsplash.com/photo-1463453091185-61582044d556?w=160&auto=format&fit=crop&q=80',
    grade_level: 'Lớp 11 Lý - THPT Kim Liên',
  },
  {
    email: 'student.thutrang@schoolify.edu.vn',
    fullname: 'Lê Thu Trang',
    avatar_url:
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=160&auto=format&fit=crop&q=80',
    grade_level: 'Lớp 12 Hóa - THPT Chuyên Hà Nội - Amsterdam',
  },
  {
    email: 'student.myduyen@schoolify.edu.vn',
    fullname: 'Huỳnh Mỹ Duyên',
    avatar_url:
      'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=160&auto=format&fit=crop&q=80',
    grade_level: 'Lớp 11 Hóa - THPT Nguyễn Thị Minh Khai',
  },
  {
    email: 'student.tuankiet@schoolify.edu.vn',
    fullname: 'Đặng Tuấn Kiệt',
    avatar_url:
      'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=160&auto=format&fit=crop&q=80',
    grade_level: 'Lớp 12 Anh 1 - THPT Chuyên Ngoại Ngữ',
  },
  {
    email: 'student.ngocmai@schoolify.edu.vn',
    fullname: 'Lý Ngọc Mai',
    avatar_url:
      'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=160&auto=format&fit=crop&q=80',
    grade_level: 'Lớp 12 Sinh - THPT Chuyên Trần Đại Nghĩa',
  },
  {
    email: 'student.quynhhuong@schoolify.edu.vn',
    fullname: 'Vũ Quỳnh Hương',
    avatar_url:
      'https://images.unsplash.com/photo-1514315384763-ba401779410f?w=160&auto=format&fit=crop&q=80',
    grade_level: 'Lớp 12 Văn - THPT Chuyên Khoa Học Xã Hội & Nhân Văn',
  },
];

const FORUM_TEACHER_PERSONAS: Record<
  string,
  { email: string; fullname: string; avatar_url: string; expertise: string }
> = {
  'Toán Học': {
    email: 'teacher.nguyen@schoolify.edu.vn',
    fullname: 'ThS. Nguyễn Văn Hùng',
    avatar_url:
      'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=160&auto=format&fit=crop&q=80',
    expertise: 'Giảng viên Toán THPT & ĐGNL',
  },
  'Tin Học': {
    email: 'teacher.tinhoc@schoolify.edu.vn',
    fullname: 'ThS. Lê Minh Quân',
    avatar_url:
      'https://images.unsplash.com/photo-1556157382-97eda2d62296?w=160&auto=format&fit=crop&q=80',
    expertise: 'Huấn luyện viên Đội tuyển HSG Tin học & Thuật toán',
  },
  'Vật Lý': {
    email: 'teacher.vatly@schoolify.edu.vn',
    fullname: 'TS. Trần Quốc Bảo',
    avatar_url:
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=160&auto=format&fit=crop&q=80',
    expertise: 'Giảng viên Vật lý THPT',
  },
  'Hóa Học': {
    email: 'teacher.hoahoc@schoolify.edu.vn',
    fullname: 'ThS. Phạm Thu Thủy',
    avatar_url:
      'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=160&auto=format&fit=crop&q=80',
    expertise: 'Giảng viên Hóa học THPT',
  },
  'Tiếng Anh': {
    email: 'teacher.tienganh@schoolify.edu.vn',
    fullname: 'Cô Đặng Lan Phương (IELTS 8.5)',
    avatar_url:
      'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=160&auto=format&fit=crop&q=80',
    expertise: 'Giảng viên Tiếng Anh THPT & IELTS',
  },
  'Sinh Học': {
    email: 'teacher.sinhhoc@schoolify.edu.vn',
    fullname: 'ThS. Hoàng Diệu Linh',
    avatar_url:
      'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=160&auto=format&fit=crop&q=80',
    expertise: 'Giảng viên Sinh học & Di truyền học',
  },
  'Ngữ Văn': {
    email: 'teacher.nguvan@schoolify.edu.vn',
    fullname: 'TS. Vũ Thanh Tâm',
    avatar_url:
      'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=160&auto=format&fit=crop&q=80',
    expertise: 'Giảng viên Ngữ văn & Lý luận văn học',
  },
};

async function seedDefaultUsers() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const bcrypt = require('bcrypt');
  console.log(
    '👤 Đang khởi tạo các tài khoản chuẩn & 20 tác giả Diễn Đàn có tên và ảnh đại diện riêng biệt...',
  );
  const passwordHash = await bcrypt.hash('123456', 10);

  let adminUser: any = null;
  for (const adminInfo of [
    {
      email: 'admin@schoolify.top',
      fullname: 'Ban Quản Trị Schoolify',
      phone: '0901000001',
      avatar_url: FORUM_AUTHOR_PERSONAS[0].avatar_url,
    },
    {
      email: 'thinh@schoolify.edu.vn',
      fullname: 'Kim Thịnh',
      phone: '0901000002',
      avatar_url:
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=160&auto=format&fit=crop&q=80',
    },
  ]) {
    const u = await prisma.user.upsert({
      where: { email: adminInfo.email },
      update: {
        role: SystemRole.SUPER_ADMIN,
        fullname: adminInfo.fullname,
        avatar_url: adminInfo.avatar_url,
        status: true,
      },
      create: {
        email: adminInfo.email,
        fullname: adminInfo.fullname,
        phone: adminInfo.phone,
        avatar_url: adminInfo.avatar_url,
        password_hash: passwordHash,
        role: SystemRole.SUPER_ADMIN,
        status: true,
      },
    });
    if (!adminUser) adminUser = u;
  }

  // Khởi tạo đội ngũ giáo viên theo từng bộ môn (Toán, Tin, Lý, Hóa, Anh, Sinh, Văn)
  const teacherBySubject: Record<string, string> = {};
  let teacherUser: any = null;
  for (const [subj, tInfo] of Object.entries(FORUM_TEACHER_PERSONAS)) {
    const tUser = await prisma.user.upsert({
      where: { email: tInfo.email },
      update: {
        fullname: tInfo.fullname,
        avatar_url: tInfo.avatar_url,
        status: true,
      },
      create: {
        email: tInfo.email,
        fullname: tInfo.fullname,
        avatar_url: tInfo.avatar_url,
        password_hash: passwordHash,
        role: SystemRole.USER,
        status: true,
      },
    });
    await prisma.teacherProfile.upsert({
      where: { user_id: tUser.id },
      update: { expertise: tInfo.expertise },
      create: {
        user_id: tUser.id,
        bio: `${tInfo.expertise} - Hệ thống Giáo dục Schoolify.`,
        expertise: tInfo.expertise,
        experience_years: 10,
      },
    });
    teacherBySubject[subj] = tUser.id;
    if (tInfo.email === 'teacher.nguyen@schoolify.edu.vn') {
      teacherUser = tUser;
    }
  }

  // Khởi tạo 19 tài khoản học sinh riêng biệt (mỗi câu hỏi 1 học sinh + 1 avatar khác nhau)
  const postAuthorUserIds: string[] = [adminUser.id];
  let studentUser: any = null;

  for (let i = 1; i < FORUM_AUTHOR_PERSONAS.length; i++) {
    const p = FORUM_AUTHOR_PERSONAS[i];
    const sUser = await prisma.user.upsert({
      where: { email: p.email },
      update: {
        fullname: p.fullname,
        avatar_url: p.avatar_url,
        status: true,
      },
      create: {
        email: p.email,
        fullname: p.fullname,
        avatar_url: p.avatar_url,
        password_hash: passwordHash,
        role: SystemRole.USER,
        status: true,
      },
    });
    await prisma.studentProfile.upsert({
      where: { user_id: sUser.id },
      update: { grade_level: p.grade_level },
      create: {
        user_id: sUser.id,
        grade_level: p.grade_level,
        points: 250,
        exam_points: 9,
      },
    });
    postAuthorUserIds.push(sUser.id);
    if (p.email === 'student.minh@schoolify.edu.vn') {
      studentUser = sUser;
    }
  }

  console.log(
    `✅ Đã khởi tạo xong ${postAuthorUserIds.length} tác giả bài đăng & ${Object.keys(teacherBySubject).length} giảng viên bộ môn (Mật khẩu: 123456)`,
  );
  return {
    adminUser,
    teacherUser,
    studentUser,
    postAuthorUserIds,
    teacherBySubject,
  };
}

async function seedForumData(
  adminUserId: string,
  teacherUserId: string,
  studentUserId: string,
  postAuthorUserIds: string[],
  teacherBySubject: Record<string, string>,
) {
  console.log(
    `💬 Đang khởi tạo bộ ${FORUM_SEED_TOPICS.length} chủ đề thảo luận Diễn Đàn chuẩn GDPT 2018 (ưu tiên Toán & Tin, đầy đủ 7 môn, mỗi bài 1 tác giả riêng)...`,
  );

  let createdOrUpdatedPosts = 0;
  let totalCommentsSeeded = 0;
  let totalReactionsSeeded = 0;
  let totalReportsSeeded = 0;

  const validSeedSlugs = FORUM_SEED_TOPICS.map((t) => t.slug);
  await prisma.forumPost.deleteMany({
    where: {
      slug: { notIn: validSeedSlugs },
    },
  });

  for (let idx = 0; idx < FORUM_SEED_TOPICS.length; idx++) {
    const topic = FORUM_SEED_TOPICS[idx];
    const authorId =
      topic.author_type === 'ADMIN'
        ? adminUserId
        : postAuthorUserIds[idx] || studentUserId;
    const subjectTeacherId = teacherBySubject[topic.subject] || teacherUserId;

    const resolveCommentAuthorId = (type: 'ADMIN' | 'TEACHER' | 'STUDENT') => {
      if (type === 'ADMIN') return adminUserId;
      if (type === 'TEACHER') return subjectTeacherId;
      return authorId === adminUserId ? studentUserId : authorId;
    };

    const hasRoot = Boolean(topic.root_comment);
    const hasNested = Boolean(topic.root_comment?.nested_reply);
    const hasExtra = Boolean(topic.extra_comment);
    const commentsCount =
      (hasRoot ? 1 : 0) + (hasNested ? 1 : 0) + (hasExtra ? 1 : 0);

    const postData = {
      author_id: authorId,
      title: topic.title,
      content: topic.content,
      content_format: 'MARKDOWN_LATEX' as const,
      content_plain: topic.content_plain,
      has_math: topic.has_math,
      subject: topic.subject,
      grade: topic.grade,
      chapter_id: topic.chapter_id,
      chapter_name: topic.chapter_name,
      tags: topic.tags,
      is_pinned: Boolean(topic.is_pinned),
      is_solved: Boolean(topic.is_solved),
      views_count: topic.views_count,
      likes_count: topic.likes_count,
      comments_count: commentsCount,
      bookmarks_count: idx < 5 ? 1 : 0,
      status: ForumPostStatus.PUBLISHED,
    };

    const post = await prisma.forumPost.upsert({
      where: { slug: topic.slug },
      update: postData,
      create: {
        ...postData,
        slug: topic.slug,
      },
    });

    createdOrUpdatedPosts++;

    // Làm mới bình luận để cập nhật đúng giảng viên bộ môn và học sinh của từng bài
    if (topic.root_comment) {
      await prisma.forumReport.deleteMany({
        where: { post_id: post.id },
      });
      await prisma.forumReaction.deleteMany({
        where: { post_id: post.id },
      });
      await prisma.forumComment.deleteMany({
        where: { post_id: post.id },
      });

      const rootAuthorId = resolveCommentAuthorId(
        topic.root_comment.author_type,
      );
      const rootComment = await prisma.forumComment.create({
        data: {
          post_id: post.id,
          author_id: rootAuthorId,
          parent_id: null,
          depth: 1,
          content: topic.root_comment.content,
          likes_count: topic.root_comment.likes_count,
          replies_count: topic.root_comment.nested_reply ? 1 : 0,
          is_accepted: Boolean(topic.root_comment.is_accepted),
          status: ForumCommentStatus.ACTIVE,
        },
      });
      totalCommentsSeeded++;

      let nestedReplyId: string | null = null;
      if (topic.root_comment.nested_reply) {
        const nestedAuthorId = resolveCommentAuthorId(
          topic.root_comment.nested_reply.author_type,
        );
        const nestedReply = await prisma.forumComment.create({
          data: {
            post_id: post.id,
            author_id: nestedAuthorId,
            parent_id: rootComment.id,
            reply_to_user_id: rootAuthorId,
            depth: 2,
            content: topic.root_comment.nested_reply.content,
            likes_count: topic.root_comment.nested_reply.likes_count,
            replies_count: 0,
            status: ForumCommentStatus.ACTIVE,
          },
        });
        nestedReplyId = nestedReply.id;
        totalCommentsSeeded++;
      }

      if (topic.extra_comment) {
        const extraAuthorId = resolveCommentAuthorId(
          topic.extra_comment.author_type,
        );
        await prisma.forumComment.create({
          data: {
            post_id: post.id,
            author_id: extraAuthorId,
            parent_id: null,
            depth: 1,
            content: topic.extra_comment.content,
            likes_count: topic.extra_comment.likes_count,
            replies_count: 0,
            is_accepted: false,
            status: ForumCommentStatus.ACTIVE,
          },
        });
        totalCommentsSeeded++;
      }

      if (topic.root_comment.is_accepted) {
        await prisma.forumPost.update({
          where: { id: post.id },
          data: { accepted_comment_id: rootComment.id },
        });
      }

      // Tạo lượt vote / cảm xúc mẫu (ForumReaction) cho cả bài đăng và lời giải của 20 câu hỏi
      const reactionRows: {
        user_id: string;
        target_type: ForumTargetType;
        post_id?: string;
        comment_id?: string;
        reaction_type: ForumReactionType;
      }[] = [
        {
          user_id: teacherUserId,
          target_type: ForumTargetType.POST,
          post_id: post.id,
          reaction_type: ForumReactionType.LIKE,
        },
        {
          user_id: adminUserId,
          target_type: ForumTargetType.POST,
          post_id: post.id,
          reaction_type:
            idx % 2 === 0 ? ForumReactionType.HELPFUL : ForumReactionType.LOVE,
        },
        {
          user_id: studentUserId,
          target_type: ForumTargetType.COMMENT,
          comment_id: rootComment.id,
          reaction_type: ForumReactionType.HELPFUL,
        },
        {
          user_id: adminUserId,
          target_type: ForumTargetType.COMMENT,
          comment_id: rootComment.id,
          reaction_type: ForumReactionType.LIKE,
        },
      ];

      if (nestedReplyId) {
        reactionRows.push({
          user_id: teacherUserId,
          target_type: ForumTargetType.COMMENT,
          comment_id: nestedReplyId,
          reaction_type: ForumReactionType.LOVE,
        });
      }

      const reactionRes = await prisma.forumReaction.createMany({
        data: reactionRows,
        skipDuplicates: true,
      });
      totalReactionsSeeded += reactionRes.count;

      // Tạo dữ liệu báo cáo kiểm duyệt mẫu (ForumReport) đa dạng trạng thái
      if (idx === 1 && nestedReplyId) {
        await prisma.forumReport.create({
          data: {
            reporter_id: studentUserId,
            target_type: ForumTargetType.COMMENT,
            post_id: post.id,
            comment_id: nestedReplyId,
            reason: ForumReportReason.OTHER,
            description:
              'Báo cáo thử nghiệm luồng kiểm duyệt bình luận diễn đàn (Toán 12 - Khảo sát hàm số).',
            status: ForumReportStatus.RESOLVED,
            resolved_by_id: teacherUserId,
            admin_note: 'Nội dung thảo luận hợp lệ, đóng báo cáo thử nghiệm.',
            moderation_action: 'NONE',
            resolved_at: new Date(),
          },
        });
        totalReportsSeeded++;
      } else if (idx === 5) {
        await prisma.forumReport.create({
          data: {
            reporter_id: studentUserId,
            target_type: ForumTargetType.COMMENT,
            post_id: post.id,
            comment_id: rootComment.id,
            reason: ForumReportReason.MISINFORMATION,
            description:
              'Nhờ thầy cô kiểm tra lại trường hợp biên m = 1 của bất phương trình bậc hai.',
            status: ForumReportStatus.REJECTED,
            resolved_by_id: adminUserId,
            admin_note:
              'Lời giải của giáo viên đã xét đầy đủ trường hợp m = 1 (f(x) = 4 > 0), báo cáo được bác bỏ.',
            moderation_action: 'NONE',
            resolved_at: new Date(),
          },
        });
        totalReportsSeeded++;
      } else if (idx === 9) {
        await prisma.forumReport.create({
          data: {
            reporter_id: teacherUserId,
            target_type: ForumTargetType.POST,
            post_id: post.id,
            reason: ForumReportReason.SPAM,
            description:
              'Kiểm tra tính năng báo cáo bài viết trùng lặp chuyên đề Động lực học Vật Lý 10.',
            status: ForumReportStatus.REVIEWING,
          },
        });
        totalReportsSeeded++;
      } else if (idx === 14 && nestedReplyId) {
        await prisma.forumReport.create({
          data: {
            reporter_id: studentUserId,
            target_type: ForumTargetType.COMMENT,
            post_id: post.id,
            comment_id: nestedReplyId,
            reason: ForumReportReason.INAPPROPRIATE,
            description:
              'Báo cáo mẫu đang chờ quản trị viên kiểm duyệt trên chuyên đề Tin Học 12.',
            status: ForumReportStatus.PENDING,
          },
        });
        totalReportsSeeded++;
      }
    }

    // Lưu Bookmark mẫu cho 5 bài đầu tiên
    if (idx < 5) {
      const bookmarkDelegate = (
        prisma as unknown as {
          forumBookmark?: {
            upsert: (args: Record<string, unknown>) => Promise<unknown>;
          };
        }
      ).forumBookmark;
      if (bookmarkDelegate) {
        await bookmarkDelegate.upsert({
          where: {
            user_id_post_id: {
              user_id: studentUserId,
              post_id: post.id,
            },
          },
          update: {},
          create: {
            user_id: studentUserId,
            post_id: post.id,
            note: `Ôn tập chuyên đề ${topic.subject} Lớp ${topic.grade} (${topic.chapter_name})`,
          },
        });
      }
    }
  }

  console.log(
    `✅ Đã khởi tạo xong ${createdOrUpdatedPosts} chủ đề Diễn Đàn chuẩn GDPT 2018 (${totalCommentsSeeded} lời giải/thảo luận KaTeX, ${totalReactionsSeeded} lượt vote & ${totalReportsSeeded} báo cáo mẫu)!`,
  );
}

async function main() {
  const {
    adminUser,
    teacherUser,
    studentUser,
    postAuthorUserIds,
    teacherBySubject,
  } = await seedDefaultUsers();
  await seedForumData(
    adminUser.id,
    teacherUser.id,
    studentUser.id,
    postAuthorUserIds,
    teacherBySubject,
  );
  const existingQCount = await prisma.question.count();
  if (existingQCount >= 580) {
    console.log(`✅ Ngân hàng đề đã có sẵn ${existingQCount} câu hỏi.`);
    return;
  }
  console.log('🌱 Bắt đầu nạp dữ liệu câu hỏi GDPT 2025 vào PostgreSQL...');

  const candidatePaths = [
    path.resolve(__dirname, '../../schoolify_FE/src/data/questions-db.json'),
    path.resolve(__dirname, '../../FE/src/data/questions-db.json'),
  ];
  const dataPath =
    candidatePaths.find((p) => fs.existsSync(p)) || candidatePaths[0];
  if (!fs.existsSync(dataPath)) {
    console.error(`❌ Không tìm thấy file dữ liệu câu hỏi tại: ${dataPath}`);
    return;
  }

  const rawData = fs.readFileSync(dataPath, 'utf-8');
  const questions: any[] = JSON.parse(rawData);
  console.log(`📦 Tìm thấy ${questions.length} câu hỏi từ questions-db.json`);

  let count = 0;
  for (const q of questions) {
    if (q.type === 'ESSAY') continue;

    const bloom = DIFFICULTY_MAP[q.difficulty] || BloomLevel.THONG_HIEU;

    let qFormat: QuestionFormat = QuestionFormat.SINGLE_CHOICE;
    let qType: QuestionType = QuestionType.MULTIPLE_CHOICE;

    if (q.type === 'TRUE_FALSE') {
      qFormat = QuestionFormat.TRUE_FALSE;
      qType = QuestionType.TRUE_FALSE;
    } else if (q.type === 'SHORT_ANSWER' || q.type === 'FILL_BLANK') {
      qFormat = QuestionFormat.SHORT_ANSWER;
      qType = QuestionType.SINGLE_CHOICE;
    }

    const shortAns =
      q.shortAnswerCorrect !== undefined && q.shortAnswerCorrect !== null
        ? String(q.shortAnswerCorrect)
        : null;

    // Upsert Question
    await prisma.question.upsert({
      where: { id: q.id },
      update: {
        chapter_id: q.chapterId || 1,
        subject: q.subjectSlug || 'toan-hoc',
        grade: q.grade || 12,
        bloom_level: bloom,
        question_format: qFormat,
        type: qType,
        title: q.title || '',
        question: q.content || '',
        default_points: q.score || 0.25,
        explanation: q.explanation || null,
        answer: shortAns,
      },
      create: {
        id: q.id,
        chapter_id: q.chapterId || 1,
        subject: q.subjectSlug || 'toan-hoc',
        grade: q.grade || 12,
        bloom_level: bloom,
        question_format: qFormat,
        type: qType,
        title: q.title || '',
        question: q.content || '',
        default_points: q.score || 0.25,
        explanation: q.explanation || null,
        answer: shortAns,
      },
    });

    // Reset old answers if any
    await prisma.answer.deleteMany({
      where: { question_id: q.id },
    });

    // Handle Multiple Choice choices
    if (q.type === 'MULTIPLE_CHOICE' && Array.isArray(q.choices)) {
      for (const choice of q.choices) {
        await prisma.answer.create({
          data: {
            question_id: q.id,
            content: choice.content || '',
            sub_label: choice.key || '',
            is_answer: choice.key === q.correctChoice,
          },
        });
      }
    }

    // Handle True / False statements
    if (q.type === 'TRUE_FALSE' && Array.isArray(q.statements)) {
      for (const st of q.statements) {
        await prisma.answer.create({
          data: {
            question_id: q.id,
            content: st.statement || '',
            sub_label: st.subId || '',
            is_answer: Boolean(st.isCorrect),
            explain: st.explanation || null,
          },
        });
      }
    }

    count++;
    if (count % 100 === 0) {
      console.log(`  -> Đã nạp ${count}/${questions.length} câu hỏi...`);
    }
  }

  console.log(`✅ Hoàn thành nạp ${count} câu hỏi vào PostgreSQL!`);
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi seed câu hỏi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
