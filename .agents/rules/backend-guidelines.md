# Backend Development Rules

Khi phát triển các tính năng Backend (NestJS) cho project này, Agent BẮT BUỘC phải tuân thủ các nguyên tắc sau:

1. **Quy Tắc Push Git (Git Repository Restriction):**
   - **CHỈ ĐƯỢC PHÉP push code lên duy nhất 1 repository:** `https://github.com/Kimthinh175/schoolify_BE`.
   - Tuyệt đối KHÔNG tự ý push lên bất kỳ repository nào khác (kể cả repo FE).

2. **Unit Testing (Spec Files):**
   - Luôn luôn tạo file test (`.spec.ts`) tương ứng cho bất kỳ module nào mới được tạo ra.
   - Bắt buộc phải chạy test (run spec) sau khi chỉnh sửa code hoặc tạo mới một chức năng nào đó để đảm bảo không làm gãy hệ thống (Zero Regression).
   - Mỗi module chỉ được phép có duy nhất **một file spec** (giống như nguyên tắc mỗi module chỉ có một controller duy nhất) để giữ cho cấu trúc test tập trung và dễ bảo trì.

3. **Authentication & Token Management (Cookies-based):**
   - **Bắt buộc truyền Token qua HTTP-Only Cookies** (cho cả Access Token và Refresh Token) giữa Client (Next.js FE) và Server (NestJS BE) để chống lỗ hổng XSS.
   - Không trả token thô về body để client lưu vào LocalStorage/SessionStorage trừ khi có yêu cầu đặc thù.
   - Ở Backend: Cấu hình `cookie-parser` trong `main.ts`, Passport JWT Strategy trích xuất token từ request cookies (`req.cookies['access_token']`).
   - Cấu hình Cookie Options: `httpOnly: true`, `secure: process.env.NODE_ENV === 'production'`, `sameSite: 'lax'`, `path: '/'`.

4. **Phân Quyền & Multi-Tenant (RBAC + Scope Check):**
   - Áp dụng mô hình 3 lớp phân quyền:
     1. `JwtAuthGuard`: Xác thực token từ Cookie.
     2. `SchoolMemberGuard`: Xác định quyền của User theo từng Trường học (`SchoolRole`).
     3. `Resource Ownership Check`: Kiểm tra quyền sở hữu tài nguyên (Ví dụ: `owner_id === user.id`) ở tầng Service/Guard.
