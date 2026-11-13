/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import {
  PrismaClient,
  Prisma,
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
  // 1. NỘI QUY GHIM ĐẦU TRANG
  {
    slug: 'noi-quy-dien-dan-huong-dan-dang-cau-hoi-va-go-cong-thuc-latex',
    title:
      '[Nội Quy Diễn Đàn] Hướng dẫn đăng câu hỏi chuẩn GDPT 2018 và cách gõ công thức Toán/Lý/Hóa bằng KaTeX',
    content:
      'Chào mừng các bạn học sinh đến với **Diễn Đàn Học Tập Schoolify**! Để câu hỏi được thầy cô và cộng đồng hỗ trợ nhanh nhất, vui lòng chọn đúng **Môn / Khối / Chương** và gõ công thức toán học trong cặp dấu `$...$` (inline) hoặc `$$...$$` (block).\n\nVí dụ công thức nghiệm phương trình bậc hai: $x = \\frac{-b \\pm \\sqrt{\\Delta}}{2a}$ với $\\Delta = b^2 - 4ac \\ge 0$, hoặc hệ phương trình:\n$$\\begin{cases} x + y = 2 \\\\ x - y = 0 \\end{cases}$$',
    content_plain:
      'Chào mừng các bạn học sinh đến với Diễn Đàn Học Tập Schoolify! Để câu hỏi được thầy cô và cộng đồng hỗ trợ nhanh nhất, vui lòng chọn đúng Môn / Khối / Chương và gõ công thức toán học trong cặp dấu LaTeX.',
    has_math: true,
    subject: 'Toán Học',
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

  // 2. TOÁN 12 - CHƯƠNG 1
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

  // 3. TOÁN 12 - CHƯƠNG 4 (TÍCH PHÂN)
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

  // 4. TOÁN 12 - CHƯƠNG 5 (OXYZ)
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

  // 5. TOÁN 11 - LƯỢNG GIÁC & CẤP SỐ CỘNG
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

  // 6. TOÁN 10 - HÀM SỐ BẬC HAI & BẤT ĐẲNG THỨC
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

  // 7. VẬT LÝ 12 - NHIỆT HỌC (GDPT 2018)
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

  // 8. VẬT LÝ 12 - TỪ TRƯỜNG & CẢM ỨNG ĐIỆN TỪ
  {
    slug: 'vat-ly-12-suat-dien-dong-cam-ung-faraday-va-luc-tu-lorentz',
    title:
      'Vật Lý 12: Tính suất điện động cảm ứng $e_c = -\\frac{\\Delta \\Phi}{\\Delta t}$ khi khung dây quay trong từ trường đều',
    content:
      'Một khung dây phẳng gồm $N = 100$ vòng, diện tích $S = 20\\text{ cm}^2$ đặt trong từ trường đều $B = 0{,}2\\text{ T}$. Ban đầu pháp tuyến $\\vec{n}$ hợp với $\\vec{B}$ góc $\\alpha = 60^\\circ$. Nếu cho $B$ giảm đều về $0$ trong $\\Delta t = 0{,}05\\text{ s}$ thì độ lớn $|e_c|$ tính như thế nào ạ?',
    content_plain:
      'Một khung dây phẳng gồm N = 100 vòng, diện tích S = 20 cm2 đặt trong từ trường đều B = 0,2 T. Ban đầu pháp tuyến hợp với B góc 60 độ. Nếu cho B giảm đều về 0 trong 0,05 s thì độ lớn suất điện động cảm ứng tính như thế nào?',
    has_math: true,
    subject: 'Vật Lý',
    grade: 12,
    chapter_id: 3,
    chapter_name: 'Chương 3: Từ trường',
    tags: ['Cảm ứng điện từ', 'Từ thông', 'Lớp 12'],
    is_solved: true,
    views_count: 215,
    likes_count: 20,
    author_type: 'STUDENT',
    root_comment: {
      author_type: 'TEACHER',
      content:
        'Ta đổi đơn vị diện tích $S = 20 \\times 10^{-4}\\text{ m}^2$. Từ thông ban đầu qua khung dây là:\n$$\\Phi_1 = NBS\\cos 60^\\circ = 100 \\cdot 0{,}2 \\cdot (20 \\times 10^{-4}) \\cdot 0{,}5 = 0{,}02\\text{ Wb}$$\nKhi $B$ giảm về $0$ thì $\\Phi_2 = 0$, suy ra $|e_c| = \\left|\\frac{\\Phi_2 - \\Phi_1}{\\Delta t}\\right| = \\frac{0{,}02}{0{,}05} = 0{,}4\\text{ V}$ nhé!',
      is_accepted: true,
      likes_count: 15,
      nested_reply: {
        author_type: 'STUDENT',
        content:
          'Nếu đề cho góc giữa mặt phẳng khung dây và $\\vec{B}$ là $30^\\circ$ thì góc hợp bởi pháp tuyến $\\vec{n}$ và $\\vec{B}$ vẫn là $\\alpha = 90^\\circ - 30^\\circ = 60^\\circ$ đúng không thầy?',
        likes_count: 6,
      },
    },
  },

  // 9. VẬT LÝ 11 - DAO ĐỘNG ĐIỀU HÒA (GDPT 2018 ĐƯA DAO ĐỘNG VỀ LỚP 11)
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

  // 10. VẬT LÝ 10 - ĐỊNH LUẬT II NEWTON & ĐỘNG LỰC HỌC
  {
    slug: 'vat-ly-10-bai-toan-vat-truot-tren-mat-phang-nghieng-co-ma-sat',
    title:
      'Vật Lý 10: Phân tích lực và tính gia tốc vật trượt trên mặt phẳng nghiêng góc $\\alpha$ có ma sát',
    content:
      'Một vật khối lượng $m = 2\\text{ kg}$ trượt không vận tốc đầu từ đỉnh mặt phẳng nghiêng góc $\\alpha = 30^\\circ$ so với phương ngang, hệ số ma sát trượt $\\mu_t = \\frac{\\sqrt{3}}{6}$. Công thức gia tốc $a = g(\\sin\\alpha - \\mu_t\\cos\\alpha)$ được suy ra từ định luật II Newton $\\vec{P} + \\vec{N} + \\vec{F}_{mst} = m\\vec{a}$ như thế nào ạ?',
    content_plain:
      'Một vật khối lượng m = 2 kg trượt không vận tốc đầu từ đỉnh mặt phẳng nghiêng góc 30 độ, hệ số ma sát trượt. Công thức gia tốc suy ra từ định luật II Newton như thế nào?',
    has_math: true,
    subject: 'Vật Lý',
    grade: 10,
    chapter_id: 3,
    chapter_name: 'Chương 3: Động lực học',
    tags: ['Định luật Newton', 'Mặt phẳng nghiêng', 'Ma sát', 'Lớp 10'],
    is_solved: true,
    views_count: 180,
    likes_count: 16,
    author_type: 'STUDENT',
    root_comment: {
      author_type: 'TEACHER',
      content:
        'Chiếu phương trình $\\vec{P} + \\vec{N} + \\vec{F}_{mst} = m\\vec{a}$ lên trục $Oy$ vuông góc mặt nghiêng ta được $N = mg\\cos\\alpha \\implies F_{mst} = \\mu_t mg\\cos\\alpha$. Chiếu lên trục $Ox$ dọc theo mặt nghiêng:\n$$mg\\sin\\alpha - \\mu_t mg\\cos\\alpha = ma \\implies a = g(\\sin 30^\\circ - \\frac{\\sqrt{3}}{6}\\cos 30^\\circ) = 9{,}8 \\cdot \\left(\\frac{1}{2} - \\frac{1}{4}\\right) = 2{,}45\\text{ m/s}^2$$',
      is_accepted: true,
      likes_count: 14,
      nested_reply: {
        author_type: 'STUDENT',
        content:
          'Hay quá thầy ơi, khối lượng $m = 2\\text{ kg}$ tự triệt tiêu ở cả hai vế nên gia tốc trượt $a$ không phụ thuộc vào khối lượng vật!',
        likes_count: 5,
      },
    },
  },

  // 11. HÓA HỌC 12 - ESTE & LIPIT
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

  // 12. HÓA HỌC 12 - PIN ĐIỆN & ĐIỆN PHÂN
  {
    slug: 'hoa-hoc-12-tinh-suc-dien-dong-chuan-cua-pin-galvani-va-dinh-luat-faraday',
    title:
      'Hóa Học 12: Tính sức điện động chuẩn $E^\\circ_{\\text{pin}}$ của pin Galvani $\\text{Zn}-\\text{Cu}$ và khối lượng kim loại điện phân',
    content:
      'Cho thế điện cực chuẩn $E^\\circ_{\\text{Zn}^{2+}/\\text{Zn}} = -0{,}76\\text{ V}$ và $E^\\circ_{\\text{Cu}^{2+}/\\text{Cu}} = +0{,}34\\text{ V}$. Khi ghép thành pin Galvani thì sức điện động chuẩn tính theo:\n$$E^\\circ_{\\text{pin}} = E^\\circ_{\\text{cathode}} - E^\\circ_{\\text{anode}}$$\nvà khi điện phân dung dịch $\\text{CuSO}_4$ với dòng $I = 1{,}93\\text{ A}$ trong $t = 1000\\text{ s}$ thì $m_{\\text{Cu}} = \\frac{AIt}{nF}$ bằng bao nhiêu ạ?',
    content_plain:
      'Cho thế điện cực chuẩn của Zn2+/Zn và Cu2+/Cu. Khi ghép thành pin Galvani thì sức điện động chuẩn và khối lượng kim loại Cu thu được khi điện phân tính như thế nào?',
    has_math: true,
    subject: 'Hóa Học',
    grade: 12,
    chapter_id: 5,
    chapter_name: 'Chương 5: Pin điện và Điện phân',
    tags: ['Pin Galvani', 'Điện phân', 'Faraday', 'Lớp 12'],
    is_solved: true,
    views_count: 230,
    likes_count: 24,
    author_type: 'STUDENT',
    root_comment: {
      author_type: 'TEACHER',
      content:
        'Ta có $E^\\circ_{\\text{pin}} = 0{,}34 - (-0{,}76) = 1{,}10\\text{ V}$. Ở bài điện phân, số mol electron trao đổi tính theo định luật Faraday:\n$$n_e = \\frac{It}{F} = \\frac{1{,}93 \\times 1000}{96500} = 0{,}02\\text{ mol} \\implies n_{\\text{Cu}} = \\frac{1}{2}n_e = 0{,}01\\text{ mol} \\implies m_{\\text{Cu}} = 0{,}64\\text{ g}$$',
      is_accepted: true,
      likes_count: 17,
      nested_reply: {
        author_type: 'STUDENT',
        content:
          'Dạ ở anode (cực dương) có phản ứng $2\\text{H}_2\\text{O} \\to \\text{O}_2 + 4\\text{H}^+ + 4e$ nên số mol khí $\\text{O}_2$ thoát ra là $n_{\\text{O}_2} = \\frac{n_e}{4} = 0{,}005\\text{ mol}$ đúng không thầy?',
        likes_count: 8,
      },
    },
  },

  // 13. HÓA HỌC 11 - CÂN BẰNG HÓA HỌC & pH
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

  // 14. HÓA HỌC 10 - NHIỆT HÓA HỌC (ENTHALPY)
  {
    slug: 'hoa-hoc-10-tinh-bien-thien-enthalpy-chuan-cua-phan-ung-tu-nhiet-tao-thanh',
    title:
      'Hóa Học 10: Cách tính biến thiên enthalpy chuẩn $\\Delta_r H^\\circ_{298}$ theo nhiệt tạo thành $\\Delta_f H^\\circ_{298}$ và năng lượng liên kết $E_b$',
    content:
      'Em hay bị nhầm dấu giữa 2 công thức tính biến thiên enthalpy chuẩn của phản ứng:\n1. Tính theo nhiệt tạo thành: $\\Delta_r H^\\circ_{298} = \\sum \\Delta_f H^\\circ_{298}(\\text{sản phẩm}) - \\sum \\Delta_f H^\\circ_{298}(\\text{chất đầu})$\n2. Tính theo năng lượng liên kết: $\\Delta_r H^\\circ_{298} = \\sum E_b(\\text{chất đầu}) - \\sum E_b(\\text{sản phẩm})$\nThầy cô có mẹo nào để nhớ không bị ngược thứ tự trừ không ạ?',
    content_plain:
      'Em hay bị nhầm dấu giữa 2 công thức tính biến thiên enthalpy chuẩn của phản ứng theo nhiệt tạo thành và theo năng lượng liên kết Eb. Thầy cô có mẹo nào để nhớ không ạ?',
    has_math: true,
    subject: 'Hóa Học',
    grade: 10,
    chapter_id: 5,
    chapter_name: 'Chương 5: Năng lượng hóa học',
    tags: ['Enthalpy', 'Nhiệt hóa học', 'GDPT 2018', 'Lớp 10'],
    is_solved: true,
    views_count: 190,
    likes_count: 18,
    author_type: 'STUDENT',
    root_comment: {
      author_type: 'TEACHER',
      content:
        'Mẹo cực dễ nhớ nhé em:\n- Với **nhiệt tạo thành ($\\Delta_f H^\\circ_{298}$)**: Đúng định nghĩa độ biến thiên $\\Delta = \\text{Sau} - \\text{Đầu} = \\sum \\Delta_f H^\\circ_{298}(\\text{sản phẩm}) - \\sum \\Delta_f H^\\circ_{298}(\\text{chất đầu})$.\n- Với **năng lượng liên kết ($E_b$)**: Phá vỡ liên kết chất đầu cần **thu nhiệt** ($+E_b$), hình thành liên kết sản phẩm **tỏa nhiệt** ($-E_b$), nên $\\Delta_r H^\\circ_{298} = \\sum E_b(\\text{đầu}) - \\sum E_b(\\text{sau})$. Lưu ý công thức $E_b$ chỉ áp dụng cho các chất ở thể khí $(g)$!',
      is_accepted: true,
      likes_count: 15,
      nested_reply: {
        author_type: 'STUDENT',
        content:
          'Hiểu bản chất phá liên kết thu nhiệt ($+$) và tạo liên kết tỏa nhiệt ($-$) là không bao giờ nhầm thứ tự $\\sum E_b(\\text{đầu}) - \\sum E_b(\\text{sau})$ nữa. Em cảm ơn thầy!',
        likes_count: 6,
      },
    },
  },

  // 15. TIN HỌC 12 - ĐỘ PHỨC TẠP THUẬT TOÁN & AI/MẠNG
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

  // 16. TIN HỌC 11 - QUY HOẠCH ĐỘNG & CƠ SỞ DỮ LIỆU QUAN HỆ
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

  // 17. TIN HỌC 10 - HỆ ĐẾM NHỊ PHÂN & BIỂU DIỄN DỮ LIỆU
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

  // 19. TIẾNG ANH 11 - MỆNH ĐỀ QUAN HỆ RÚT GỌN & PHÂN TỪ HOÀN THÀNH
  {
    slug: 'tieng-anh-11-phan-biet-rut-gon-menh-de-quan-he-bang-v-ing-v-ed-va-to-v',
    title:
      'Tiếng Anh 11 (Global Success): Phân biệt rút gọn mệnh đề quan hệ bằng $V_{\\text{-ing}}$, $V_{\\text{p.p}}$ và $\\text{to } V_{\\text{inf}}$',
    content:
      'Trong đề kiểm tra Unit 6 - Preserving Our Heritage có câu: *"The Citadel of the Ho Dynasty is the only stone citadel in Southeast Asia (remaining / remained / to remain) mostly intact."* Khi có từ chỉ số thứ tự hoặc duy nhất (`the first`, `the last`, `the only`) đứng trước danh từ thì công thức rút gọn bắt buộc là:\n$$\\text{the first / only / last} + N + \\text{to } V_{\\text{inf}} \\;(\\text{chủ động}) \\quad \\text{hoặc} \\quad \\text{to be } V_{\\text{p.p}} \\;(\\text{bị động})$$\nphải không ạ?',
    content_plain:
      'Trong đề kiểm tra Unit 6 Preserving Our Heritage, khi có từ the first, the last, the only đứng trước danh từ thì công thức rút gọn mệnh đề quan hệ bắt buộc dùng to V phải không ạ?',
    has_math: true,
    subject: 'Tiếng Anh',
    grade: 11,
    chapter_id: 6,
    chapter_name: 'Unit 6: Preserving Our Heritage - Reduced Relative Clauses',
    tags: ['Ngữ pháp', 'Rút gọn mệnh đề', 'Global Success 11'],
    is_solved: true,
    views_count: 225,
    likes_count: 21,
    author_type: 'STUDENT',
    root_comment: {
      author_type: 'TEACHER',
      content:
        'Hoàn toàn chính xác! Do phía trước có cụm `"the only stone citadel"` và động từ `remain` là nội động từ mang nghĩa chủ động, nên đáp án chuẩn là **`to remain`**. Nếu dùng cho câu bị động (ví dụ *"the first heritage site to be recognized by UNESCO"*) thì ta dùng $\\text{to be } + V_{\\text{p.p}}$ nhé!',
      is_accepted: true,
      likes_count: 15,
      nested_reply: {
        author_type: 'STUDENT',
        content:
          'Dạ ngoài `the first/last/only` thì khi danh từ đứng sau so sánh nhất ($\\text{the} + \\text{ Adj}_{\\text{est}} / \\text{most Adj} + N$) mình cũng rút gọn bằng $\\text{to } V_{\\text{inf}}$ luôn đúng không ạ?',
        likes_count: 7,
      },
    },
  },

  // 20. TIẾNG ANH 10 - CÂU ĐIỀU KIỆN HỖN HỢP & XÁC SUẤT ĐIỂM SỐ
  {
    slug: 'tieng-anh-10-cong-thuc-cau-dieu-kien-loai-1-2-3-va-mixed-conditionals',
    title:
      'Tiếng Anh 10: Hệ thống hóa công thức Câu điều kiện (Conditionals Type 1, 2, 3 & Mixed) dễ nhớ nhất',
    content:
      'Em tổng hợp bảng công thức chia thì của $4$ loại câu điều kiện dưới dạng ký hiệu toán học để ôn thi học kỳ:\n- **Type 1:** $\\text{If} + S + V_{(s/es)},\\; S + \\text{will/can} + V_{\\text{inf}}$\n- **Type 2 (trái hiện tại):** $\\text{If} + S + V_{\\text{ed/were}},\\; S + \\text{would/could} + V_{\\text{inf}}$\n- **Type 3 (trái quá khứ):** $\\text{If} + S + \\text{had } V_{\\text{p.p}},\\; S + \\text{would have } V_{\\text{p.p}}$\n- **Mixed ($3 \\to 2$):** $\\text{If} + S + \\text{had } V_{\\text{p.p}} \\;(\\text{yesterday}),\\; S + \\text{would } V_{\\text{inf}} \\;(\\text{now})$\nKhi nào thì mình dùng dạng đảo ngữ `Were I you` hoặc `Had it not been for + N` vậy ạ?',
    content_plain:
      'Em tổng hợp bảng công thức chia thì của 4 loại câu điều kiện Type 1, 2, 3 và Mixed Conditionals. Khi nào thì dùng dạng đảo ngữ Were I you hoặc Had it not been for?',
    has_math: true,
    subject: 'Tiếng Anh',
    grade: 10,
    chapter_id: 8,
    chapter_name: 'Unit 8: New Ways to Learn - Conditional Sentences',
    tags: ['Câu điều kiện', 'Mixed Conditionals', 'Lớp 10'],
    is_solved: true,
    views_count: 195,
    likes_count: 19,
    author_type: 'STUDENT',
    root_comment: {
      author_type: 'TEACHER',
      content:
        'Bảng tổng hợp của em rất chuẩn! Công thức đảo ngữ $3$ loại câu điều kiện (bỏ `If`, đưa trợ động từ lên đầu câu) như sau:\n- **Đảo ngữ loại 1:** $\\text{Should} + S + V_{\\text{bare-inf}},\\; S + \\text{will/can} + V_{\\text{inf}}$\n- **Đảo ngữ loại 2:** $\\text{Were} + S + (\\text{to } V_{\\text{inf}} / \\text{Adj / N}),\\; S + \\text{would} + V_{\\text{inf}}$\n- **Đảo ngữ loại 3:** $\\text{Had} + S + V_{\\text{p.p}},\\; S + \\text{would have } V_{\\text{p.p}}$ (Cụm $\\text{Had it not been for} + N = \\text{Without / But for} + N$: *"Nếu không nhờ có..."*).',
      is_accepted: true,
      likes_count: 16,
      nested_reply: {
        author_type: 'STUDENT',
        content:
          'Bộ 3 từ khóa đầu câu $\\text{Should}$ (loại 1) – $\\text{Were}$ (loại 2) – $\\text{Had}$ (loại 3) cực kỳ dễ nhận diện trong bài trắc nghiệm luôn ạ!',
        likes_count: 6,
      },
    },
  },
];

async function seedDefaultUsers() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const bcrypt = require('bcrypt');
  console.log(
    '👤 Đang khởi tạo các tài khoản chuẩn (Admin, Giảng viên, Học sinh)...',
  );
  const passwordHash = await bcrypt.hash('123456', 10);

  let adminUser: any = null;
  for (const adminInfo of [
    {
      email: 'admin@schoolify.top',
      fullname: 'Kim Thịnh (Super Admin)',
      phone: '0901000001',
    },
    {
      email: 'thinh@schoolify.edu.vn',
      fullname: 'Kim Thịnh',
      phone: '0901000002',
    },
  ]) {
    const u = await prisma.user.upsert({
      where: { email: adminInfo.email },
      update: { role: SystemRole.SUPER_ADMIN, status: true },
      create: {
        email: adminInfo.email,
        fullname: adminInfo.fullname,
        phone: adminInfo.phone,
        password_hash: passwordHash,
        role: SystemRole.SUPER_ADMIN,
        status: true,
      },
    });
    if (!adminUser) adminUser = u;
  }

  const teacherUser = await prisma.user.upsert({
    where: { email: 'teacher.nguyen@schoolify.edu.vn' },
    update: { status: true },
    create: {
      email: 'teacher.nguyen@schoolify.edu.vn',
      fullname: 'ThS. Nguyễn Văn Hùng',
      phone: '0902000001',
      password_hash: passwordHash,
      role: SystemRole.USER,
      status: true,
    },
  });
  await prisma.teacherProfile.upsert({
    where: { user_id: teacherUser.id },
    update: {},
    create: {
      user_id: teacherUser.id,
      bio: 'Giảng viên Toán & Luyện thi THPT Quốc gia 10 năm kinh nghiệm.',
      expertise: 'Toán học THPT & ĐGNL',
      experience_years: 10,
    },
  });

  const studentUser = await prisma.user.upsert({
    where: { email: 'student.minh@schoolify.edu.vn' },
    update: { status: true },
    create: {
      email: 'student.minh@schoolify.edu.vn',
      fullname: 'Nguyễn Hoàng Minh',
      phone: '0987654321',
      password_hash: passwordHash,
      role: SystemRole.USER,
      status: true,
    },
  });
  await prisma.studentProfile.upsert({
    where: { user_id: studentUser.id },
    update: {},
    create: {
      user_id: studentUser.id,
      grade_level: 'Lớp 12',
      points: 250,
      exam_points: 9,
    },
  });

  console.log('✅ Đã khởi tạo xong tài khoản chuẩn (Mật khẩu: 123456)');
  return { adminUser, teacherUser, studentUser };
}

async function seedForumData(
  adminUserId: string,
  teacherUserId: string,
  studentUserId: string,
) {
  console.log(
    `💬 Đang khởi tạo bộ ${FORUM_SEED_TOPICS.length} chủ đề thảo luận Diễn Đàn chuẩn GDPT 2018 (Toán, Lý, Hóa, Tin, Anh) hỗ trợ KaTeX...`,
  );

  const resolveAuthorId = (type: 'ADMIN' | 'TEACHER' | 'STUDENT') => {
    if (type === 'ADMIN') return adminUserId;
    if (type === 'TEACHER') return teacherUserId;
    return studentUserId;
  };

  let createdOrUpdatedPosts = 0;
  let totalCommentsSeeded = 0;
  let totalReactionsSeeded = 0;
  let totalReportsSeeded = 0;

  for (let idx = 0; idx < FORUM_SEED_TOPICS.length; idx++) {
    const topic = FORUM_SEED_TOPICS[idx];
    const authorId = resolveAuthorId(topic.author_type);
    const hasRoot = Boolean(topic.root_comment);
    const hasNested = Boolean(topic.root_comment?.nested_reply);
    const hasExtra = Boolean(topic.extra_comment);
    const commentsCount =
      (hasRoot ? 1 : 0) + (hasNested ? 1 : 0) + (hasExtra ? 1 : 0);

    const post = await prisma.forumPost.upsert({
      where: { slug: topic.slug },
      update: {
        title: topic.title,
        content: topic.content,
        content_format: 'MARKDOWN_LATEX',
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
      } as unknown as Prisma.ForumPostUncheckedUpdateInput,
      create: {
        author_id: authorId,
        title: topic.title,
        slug: topic.slug,
        content: topic.content,
        content_format: 'MARKDOWN_LATEX',
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
      } as unknown as Prisma.ForumPostUncheckedCreateInput,
    });

    createdOrUpdatedPosts++;

    // Nếu bài viết chưa đủ số lượng bình luận mẫu thì làm mới & tạo đầy đủ bình luận 2 cấp + thảo luận phụ
    const existingCommentCount = await prisma.forumComment.count({
      where: { post_id: post.id },
    });

    if (existingCommentCount < commentsCount && topic.root_comment) {
      if (existingCommentCount > 0) {
        await prisma.forumComment.deleteMany({
          where: { post_id: post.id },
        });
      }

      const rootAuthorId = resolveAuthorId(topic.root_comment.author_type);
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
        const nestedAuthorId = resolveAuthorId(
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
        const extraAuthorId = resolveAuthorId(topic.extra_comment.author_type);
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
  const { adminUser, teacherUser, studentUser } = await seedDefaultUsers();
  await seedForumData(adminUser.id, teacherUser.id, studentUser.id);
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
    const bloom = DIFFICULTY_MAP[q.difficulty] || BloomLevel.THONG_HIEU;

    let qFormat: QuestionFormat = QuestionFormat.SINGLE_CHOICE;
    let qType: QuestionType = QuestionType.MULTIPLE_CHOICE;

    if (q.type === 'TRUE_FALSE') {
      qFormat = QuestionFormat.TRUE_FALSE;
      qType = QuestionType.TRUE_FALSE;
    } else if (q.type === 'SHORT_ANSWER') {
      qFormat = QuestionFormat.SHORT_ANSWER;
      qType = QuestionType.SINGLE_CHOICE;
    } else if (q.type === 'ESSAY') {
      qFormat = QuestionFormat.ESSAY;
      qType = QuestionType.ESSAY;
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
