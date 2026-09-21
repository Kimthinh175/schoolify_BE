# PHẦN 2: KHẢO SÁT NHU CẦU & ĐẶC TẢ YÊU CẦU HỆ THỐNG SCHOOLIFY
## (NỀN TẢNG BÁN KHÓA HỌC & LUYỆN TẬP KIẾN THỨC K-12)

---

## 2.1 YÊU CẦU KHÁCH HÀNG (NGHIỆP VỤ HỆ THỐNG)

### 1. Quản lý người dùng & Phân quyền truy cập
- **Đăng ký tài khoản:**
  - Học sinh, phụ huynh và giáo viên có thể đăng ký tài khoản nhanh chóng thông qua các phương thức: Tài khoản Google (OAuth 2.0), Số điện thoại hoặc Email cá nhân.
  - Hệ thống gửi mã xác minh (OTP) qua tin nhắn SMS hoặc Email để kích hoạt tài khoản trong vòng 120 giây nhằm bảo đảm tính xác thực.
- **Đăng nhập & Đăng xuất:**
  - Người dùng có thể đăng nhập bằng Email/Số điện thoại kèm mật khẩu hoặc Đăng nhập 1-chạm bằng Google.
  - Cơ chế xác thực bảo mật hiện đại bằng JSON Web Token (JWT) lưu trữ an toàn trong HttpOnly Cookie, bảo vệ người dùng khỏi các cuộc tấn công XSS và CSRF.
- **Quản lý hồ sơ cá nhân:**
  - Học sinh có thể cập nhật ảnh đại diện, họ và tên, trường đang học, tỉnh/thành phố và đặc biệt là **Khối lớp đang học (từ Lớp 1 đến Lớp 12)** để hệ thống tự động gợi ý đúng các khóa học và bài tập ôn luyện phù hợp.
  - Cho phép thay đổi mật khẩu và cập nhật số điện thoại kèm xác thực mã OTP.

---

### 2. Khám phá, Tìm kiếm và Mua khóa học (E-Commerce)
- **Danh mục khóa học chuẩn K-12:**
  - Phân loại rõ ràng theo: Khối lớp (Lớp 1 - 12), Môn học (Toán, Ngữ văn, Tiếng Anh, Vật lý, Hóa học, Sinh học, Lịch sử, Địa lý...), Bộ sách giáo khoa (*Kết nối tri thức, Cánh Diều, Chân trời sáng tạo*) và Mục tiêu chuyên biệt (Ôn thi vào Lớp 10, Luyện thi Tốt nghiệp THPT Quốc gia, Bồi dưỡng học sinh giỏi).
- **Bộ lọc & Tìm kiếm thông minh:**
  - Tìm kiếm khóa học theo từ khóa, tên giáo viên giảng dạy, mức giá, môn học và số lượt đánh giá sao.
- **Trang chi tiết khóa học:**
  - Cho phép học sinh và phụ huynh xem video bài giảng học thử miễn phí (Trial Lesson), đề cương chi tiết từng chương, thông tin giới thiệu và thành tích của giáo viên đứng lớp, cùng các đánh giá thực tế từ học viên trước đó.
- **Mua và Thanh toán trực tuyến:**
  - **Khóa học miễn phí:** Học sinh chỉ cần nhấn "Đăng ký học ngay" là hệ thống tự động thêm khóa học vào tủ học tập cá nhân.
  - **Khóa học có phí:** Tích hợp các cổng thanh toán phổ biến hàng đầu Việt Nam: Quét mã VietQR (Napas 24/7 tự động gạch nợ trong 3 giây), Ví điện tử MoMo và Cổng VNPay.
  - Sau khi giao dịch thanh toán thành công, hệ thống gửi email xác nhận biên lai và tự động mở khóa toàn bộ nội dung khóa học cho học sinh.

---

### 3. Không gian học tập trực tuyến (Learning Management System - LMS)
- **Học tập theo lộ trình tuần tự:**
  - Học sinh phải hoàn thành bài học trước mới được mở khóa bài học tiếp theo, tránh tình trạng nhảy cóc kiến thức.
- **Trình phát video bài giảng thông minh:**
  - Hỗ trợ tính năng chống tua nhanh vượt quá thời lượng chưa xem để đảm bảo học sinh thực sự theo dõi bài giảng (cho phép tua lùi để nghe lại phần kiến thức chưa hiểu).
  - Tự động lưu lại mốc thời gian xem dở (Resume watching) để học sinh tiếp tục học trên các thiết bị khác mà không bị gián đoạn.
- **Ghi chú bài học thông minh (Timestamped Notes):**
  - Cho phép học sinh tạo ghi chú ngay trong lúc xem video. Ghi chú được gắn liền với mốc phút:giây của video bài giảng, bấm vào ghi chú video sẽ tự động nhảy đến đúng thời điểm đó.
- **Hỏi đáp & Thảo luận dưới bài học (Q&A):**
  - Học sinh có thể đặt câu hỏi trực tiếp dưới từng bài giảng nếu chưa hiểu bài.
  - Giáo viên bộ môn và các học viên khác có thể vào giải đáp, tạo môi trường học tập tương tác cao.
- **Theo dõi tiến độ học tập (Progress Tracking):**
  - Hiển thị trực quan thanh tiến độ hoàn thành (% Course Completion) của từng chương và toàn bộ khóa học.

---

### 4. Hệ thống Luyện tập & Đánh giá kiến thức K-12 (Practice & Quiz Engine)
- **Bài tập củng cố sau bài học:**
  - Sau mỗi video bài giảng là phần bài tập bắt buộc để kiểm tra mức độ hiểu bài.
  - Học sinh phải đạt điều kiện tối thiểu (ví dụ: đúng từ 80% trở lên) mới được tính là hoàn thành bài học.
- **Các dạng câu hỏi trắc nghiệm phổ biến trong trường học:**
  - *Trắc nghiệm 4 lựa chọn (Multiple Choice - A, B, C, D).*
  - *Câu hỏi Đúng / Sai (True / False).*
  - *Câu hỏi điền khuyết từ / số (Fill in the blank) dành cho công thức toán hoặc từ vựng tiếng Anh.*
- **Phòng Luyện đề thi thử có tính giờ (Mock Exam):**
  - Hỗ trợ các bộ đề thi thử bám sát cấu trúc đề thi chính thức (Đề kiểm tra 15 phút, 1 tiết 45 phút, Đề thi học kỳ, Đề thi thử THPT Quốc gia 50 câu - 90 phút).
  - Đồng hồ đếm ngược thời gian thực, tự động nộp bài khi hết giờ.
  - Hiển thị ngay điểm số, bảng đáp án đúng/sai kèm **Lời giải thích chi tiết từng câu** để học sinh tự rút kinh nghiệm.
- **Đánh giá khóa học & Nhận chứng nhận:**
  - Sau khi hoàn thành 100% video và bài tập của khóa học, học sinh được quyền đánh giá sao (1 - 5 sao), viết nhận xét và tải về Giấy chứng nhận hoàn thành khóa học (Certificate PDF).

---

### 5. Nghiệp vụ dành cho Giảng viên / Giáo viên (Instructor Studio)
- **Khởi tạo và Quản lý khóa học:**
  - Nhập thông tin tổng quan khóa học: Tên khóa học, môn học, khối lớp, bộ sách giáo khoa, mô tả chi tiết, ảnh thumbnail và giá bán.
  - Xây dựng cấu trúc khóa học phân cấp: Tạo các Chương (Sections) và các Bài học (Lessons).
  - Tải lên video bài giảng, đính kèm tài liệu tóm tắt lý thuyết (PDF, slide).
  - Dễ dàng kéo thả để sắp xếp lại thứ tự bài giảng.
- **Tạo và Quản lý Ngân hàng bài tập:**
  - Tạo bộ câu hỏi trắc nghiệm cho từng bài học hoặc tạo đề thi tổng hợp.
  - Soạn thảo câu hỏi có hỗ trợ công thức Toán/Lý/Hóa bằng ký hiệu LaTeX chuẩn mực.
  - Cung cấp đáp án đúng và lời giải thích chi tiết cho từng phương án.
- **Tương tác và Giải đáp thắc mắc:**
  - Nhận thông báo khi có học sinh đặt câu hỏi trong bài giảng và trả lời trực tiếp cho học sinh.

---

### 6. Phân quyền Quản trị hệ thống (Admin & Các bộ phận nghiệp vụ)
- **Bộ phận Quản lý Hệ thống (Super Admin):**
  - Quản lý toàn bộ danh sách người dùng, kích hoạt hoặc khóa tài khoản vi phạm.
  - Phân quyền cho các vai trò quản trị viên cấp dưới.
  - Cấu hình chung cho hệ thống (cổng thanh toán, tham số gửi mail/SMS, danh mục môn học, khối lớp).
- **Bộ phận Kiểm duyệt Nội dung (Content & Course Reviewer):**
  - Xem xét, thẩm định chất lượng video bài giảng và nội dung bài tập của giáo viên trước khi phê duyệt công khai lên sàn khóa học.
  - Gửi phản hồi yêu cầu giáo viên chỉnh sửa nếu phát hiện sai sót chuyên môn hoặc vi phạm tiêu chuẩn cộng đồng.
- **Bộ phận Kế toán & Tài chính (Finance & Accounting):**
  - Báo cáo và thống kê doanh thu bán khóa học theo thời gian thực (ngày, tuần, tháng, năm).
  - Quản lý lịch sử giao dịch thanh toán trực tuyến của học viên.
  - Tính toán tỷ lệ chia sẻ doanh thu (hoa hồng) và lập lệnh đối soát chi trả cho giáo viên đứng lớp.

---

## 2.2 ĐẶC TẢ CHI TIẾT CÁC TÍNH NĂNG CỦA HỆ THỐNG SCHOOLIFY

### MODULE 1: XÁC THỰC VÀ BẢO MẬT (AUTHENTICATION)

#### 1. Chức năng Đăng nhập bằng Google (Google OAuth 2.0)
- **Giao diện:** Hiển thị nút bấm "Đăng nhập bằng Google" nổi bật kèm logo chính hãng của Google trên trang đăng nhập.
- **Luồng xử lý:**
  1. Người dùng nhấn nút "Đăng nhập bằng Google".
  2. Hệ thống chuyển hướng người dùng đến trang cấp quyền bảo mật của Google Identity Service.
  3. Người dùng chọn tài khoản Gmail cá nhân và cấp quyền truy cập cơ bản (email, họ tên, avatar).
  4. Google trả về mã xác thực `OAuth Authorization Code` cho Schoolify Backend.
  5. Máy chủ Schoolify kiểm tra tính hợp lệ của Token với Google Server:
     - Nếu người dùng đã có tài khoản: Tạo phiên đăng nhập, tạo cặp JWT (`access_token` và `refresh_token`), lưu vào HttpOnly Cookie và chuyển hướng người dùng về trang chủ.
     - Nếu là người dùng mới: Tự động khởi tạo bản ghi học viên mới với thông tin từ Google, sau đó mở form nhanh để học viên chọn "Khối lớp đang học" nhằm cá nhân hóa trải nghiệm.

#### 2. Chức năng Đăng nhập bằng Tài khoản (Email / Số điện thoại & Mật khẩu)
- **Giao diện:** Form đăng nhập gồm các trường:
  - *Email hoặc Số điện thoại.*
  - *Mật khẩu* (kèm icon ẩn/hiện mật khẩu).
  - Checkbox *"Ghi nhớ đăng nhập"*.
  - Nút bấm *"Đăng nhập"* và liên kết *"Quên mật khẩu?"*.
- **Luồng xử lý:**
  1. Người dùng điền thông tin và nhấn "Đăng nhập".
  2. Frontend kiểm tra định dạng email/số điện thoại cơ bản trước khi gửi yêu cầu.
  3. Gửi yêu cầu HTTPS `POST /api/v1/auth/login` đến máy chủ.
  4. Máy chủ tìm kiếm tài khoản theo email hoặc số điện thoại:
     - Dùng thuật toán `bcrypt` so khớp chuỗi băm mật khẩu người dùng nhập với mật khẩu lưu trong cơ sở dữ liệu.
     - Nếu thông tin chính xác: Cấp JWT Token và chuyển hướng người dùng về trang đích trước đó.
     - Nếu thông tin sai: Trả về thông báo lỗi thân thiện: *"Email/Số điện thoại hoặc mật khẩu không chính xác"*.
- **Yêu cầu bảo mật:**
  - Cơ chế chống tấn công Brute-force: Khóa tài khoản tạm thời 15 phút nếu nhập sai mật khẩu quá 5 lần liên tiếp.

#### 3. Chức năng Đăng ký Tài khoản mới
- **Giao diện:** Form đăng ký gồm các trường:
  - *Họ và tên học sinh.*
  - *Email hoặc Số điện thoại.*
  - *Khối lớp (Dropdown chọn từ Lớp 1 đến Lớp 12).*
  - *Mật khẩu* (yêu cầu tối thiểu 8 ký tự, có chữ và số).
  - *Xác nhận mật khẩu.*
  - Nút bấm *"Đăng ký ngay"*.
- **Luồng xử lý:**
  1. Người dùng điền thông tin và nhấn "Đăng ký".
  2. Hệ thống kiểm tra: Email/Số điện thoại đã tồn tại trong hệ thống hay chưa; Mật khẩu và Xác nhận mật khẩu có khớp nhau không.
  3. Hệ thống tạo mã OTP gồm 6 chữ số ngẫu nhiên (có hiệu lực trong 120 giây) và gửi qua Email hoặc SMS của người dùng.
  4. Hiển thị màn hình đếm ngược nhập mã xác thực OTP.
  5. Người dùng nhập đúng mã OTP: Hệ thống thực hiện băm mật khẩu bằng `bcrypt`, tạo bản ghi người dùng mới với trạng thái kích hoạt `ACTIVE` và tự động đăng nhập.

#### 4. Chức năng Lấy lại Mật khẩu (Quên mật khẩu)
- **Giao diện:** Màn hình nhập Email hoặc Số điện thoại đã đăng ký tài khoản.
- **Luồng xử lý qua Email:**
  1. Người dùng nhập email và nhấn *"Gửi liên kết khôi phục"*.
  2. Máy chủ kiểm tra email có tồn tại, tạo ra một mã Token bảo mật có thời hạn 15 phút và lưu tạm vào Redis.
  3. Hệ thống gửi email chứa liên kết: `https://schoolify.vn/auth/reset-password?token=...`
  4. Người dùng nhấp vào link từ email, mở ra trang đặt lại mật khẩu mới.
  5. Người dùng nhập mật khẩu mới 2 lần và nhấn *"Cập nhật mật khẩu"*.
  6. Máy chủ mã hóa mật khẩu mới và hủy bỏ token cũ, hiển thị thông báo thành công.

---

### MODULE 2: QUẢN LÝ THÔNG TIN CÁ NHÂN & HỒ SƠ HỌC SINH (USER PROFILE)

#### 1. Cập nhật Hồ sơ cá nhân
- Người dùng truy cập trang *"Cài đặt tài khoản"*.
- Có thể chỉnh sửa các trường: Họ và tên, Ngày sinh, Giới tính, Tỉnh/Thành phố, Trường học đang theo học, và Khối lớp.
- Cho phép tải lên ảnh đại diện cá nhân (hệ thống tự động nén ảnh dưới 2MB và chuyển đổi sang định dạng WebP tối ưu).
- Bấm nút *"Lưu thay đổi"* để cập nhật dữ liệu lên hệ thống.

#### 2. Đổi mật khẩu trong cài đặt
- Người dùng nhập: *Mật khẩu hiện tại*, *Mật khẩu mới*, và *Xác nhận mật khẩu mới*.
- Hệ thống kiểm tra mật khẩu hiện tại có đúng không. Mật khẩu mới không được trùng với mật khẩu cũ.
- Cập nhật mật khẩu thành công và gửi email thông báo bảo mật đến người dùng.

---

### MODULE 3: KHÁM PHÁ, MUA & THANH TOÁN KHÓA HỌC (E-COMMERCE & CHECKOUT)

#### 1. Tìm kiếm và Lọc khóa học
- Thanh tìm kiếm trên Header cho phép gõ từ khóa tên khóa học, môn học hoặc tên giáo viên.
- Bộ lọc đa tiêu chí bên thanh Sidebar:
  - *Theo Khối lớp:* Lớp 1 -> Lớp 12.
  - *Theo Bộ sách:* Kết nối tri thức, Cánh Diều, Chân trời sáng tạo.
  - *Theo Mức giá:* Miễn phí, Dưới 200k, 200k - 500k, Trên 500k.
  - *Sắp xếp:* Mới nhất, Đánh giá cao nhất, Bán chạy nhất.

#### 2. Chi tiết khóa học (Course Detail Page)
- Hiển thị:
  - Video giới thiệu ngắn (Trailer khóa học) và 1-2 bài giảng học thử miễn phí.
  - Thông tin giảng viên: Tên, học vị, kinh nghiệm giảng dạy, trường công tác.
  - Danh sách toàn bộ các chương và bài học trong khóa (cho xem trước thời lượng video của từng bài).
  - Bảng đánh giá và phản hồi của học sinh đã học.
  - Giá gốc, giá khuyến mãi và Nút *"Mua ngay"* hoặc *"Học ngay"* (đối với khóa miễn phí).

#### 3. Quy trình Thanh toán Khóa học (Checkout Flow)
- **Bước 1: Tạo đơn hàng:** Học sinh nhấn *"Mua ngay"*, hệ thống tạo đơn hàng với trạng thái `PENDING` và hiển thị trang thanh toán.
- **Bước 2: Chọn phương thức thanh toán:**
  - **Phương thức 1: Chuyển khoản VietQR (Khuyên dùng):**
    - Hệ thống tạo động mã VietQR chuẩn Napas 24/7 chứa chính xác: *Số tài khoản ngân hàng trường, Số tiền chính xác, và Cú pháp chuyển khoản duy nhất (VD: SCH12345)*.
    - Học sinh chỉ cần mở bất kỳ app ngân hàng nào quét mã và bấm chuyển khoản.
    - Hệ thống bắt Webhook từ cổng thanh toán/ngân hàng trong vòng 3 giây, tự động đối soát nội dung và chuyển trạng thái đơn hàng sang `PAID`.
  - **Phương thức 2: Ví MoMo & Cổng VNPay:**
    - Chuyển hướng học sinh sang cổng thanh toán tương ứng để thực hiện thanh toán qua thẻ ATM nội địa, thẻ quốc tế hoặc ví điện tử.
- **Bước 3: Kích hoạt khóa học tức thì:**
  - Ngay khi đơn hàng được ghi nhận thanh toán thành công, hệ thống tự động thêm khóa học vào kho học tập cá nhân của học sinh và gửi email biên lai giao dịch.
  - Trang web tự động chuyển hướng học sinh vào phòng học bài giảng đầu tiên.

---

### MODULE 4: HỌC TẬP TRỰC TUYẾN (LEARNING PLAYER & LMS)

#### 1. Cơ chế học tập tuần tự & Chống tua lén
- Học sinh bắt buộc phải học lần lượt từng bài. Không thể bấm vào bài học số 3 nếu chưa hoàn thành bài học số 1 và số 2.
- **Cơ chế chống tua trên trình phát video:**
  - Không cho phép người dùng kéo thanh trượt video vượt quá mốc thời gian lớn nhất đã xem.
  - Được phép tua ngược về trước để nghe lại kiến thức.
  - Video chỉ được đánh dấu là "Đã xem xong" khi học sinh xem tối thiểu 90% thời lượng của video.

#### 2. Chức năng Ghi chú bài giảng (Timestamped Notes)
- Bên cạnh video có nút *"Tạo ghi chú tại [mm:ss]"*.
- Học sinh bấm nút, video tự động tạm dừng, mở ô nhập văn bản để học sinh gõ ý chính cần nhớ.
- Danh sách ghi chú được lưu trữ theo tài khoản học sinh, hiển thị thứ tự theo thời gian video.
- Khi bấm vào bất kỳ dòng ghi chú nào, video sẽ tự động nhảy đến đúng giây đó và phát tiếp.

#### 3. Chức năng Hỏi đáp trong bài học (Discussion & Q&A)
- Dưới mỗi bài học có khu vực thảo luận.
- Học sinh có thể đặt câu hỏi về bài giảng, đính kèm hình ảnh câu hỏi hoặc bài tập chưa hiểu.
- Giáo viên đứng lớp nhận được thông báo chuông trên hệ thống và có thể trả lời trực tiếp câu hỏi của học sinh.

---

### MODULE 5: LUYỆN TẬP & ĐÁNH GIÁ KIẾN THỨC K-12 (PRACTICE & QUIZ ENGINE)

#### 1. Bài tập củng cố sau bài học (Lesson Quiz)
- Sau khi xem xong video bài giảng, học sinh chuyển sang tab *"Làm bài tập củng cố"*.
- Bộ câu hỏi gồm 5 - 10 câu trắc nghiệm bám sát nội dung vừa học.
- Học sinh bấm chọn đáp án và nhấn *"Nộp bài"*.
- Hệ thống chấm điểm tức thì:
  - Nếu điểm số >= 80%: Hệ thống mở khóa bài học tiếp theo và cộng điểm tích lũy học tập.
  - Nếu điểm số < 80%: Hệ thống yêu cầu học sinh xem lại bài giảng và làm lại bài tập.

#### 2. Phòng Luyện đề thi thử có tính giờ (Timed Exam)
- Dành cho các bài kiểm tra 15 phút, kiểm tra 1 tiết hoặc đề thi thử vào Lớp 10 / Tốt nghiệp THPT.
- **Giao diện làm bài thi chuyên nghiệp:**
  - Bảng danh sách câu hỏi bên tay phải giúp học sinh dễ dàng theo dõi câu đã làm, câu chưa làm và câu cần xem lại.
  - Đồng hồ đếm ngược thời gian làm bài hiển thị rõ ràng trên thanh tiêu đề.
  - Hỗ trợ công thức Toán, Lý, Hóa hiển thị sắc nét bằng MathJax / KaTeX.
- **Thu bài và Phân tích kết quả:**
  - Khi hết giờ làm bài, hệ thống tự động khóa bài và gửi dữ liệu về máy chủ chấm điểm.
  - Trả về màn hình tổng kết: Điểm số, số câu đúng/sai, thời gian hoàn thành.
  - Hiển thị chi tiết từng câu hỏi kèm đáp án đúng của hệ thống và **Lời giải thích chi tiết từng bước** để học sinh tự củng cố kiến thức.

#### 3. Nhận Chứng chỉ hoàn thành khóa học (Certificate)
- Khi học sinh hoàn thành 100% video bài học và tất cả các bài kiểm tra trong khóa:
- Hệ thống hiển thị nút *"Nhận chứng chỉ hoàn thành"*.
- Học sinh xác nhận lại họ tên in trên chứng chỉ.
- Hệ thống tự động tạo mã chứng chỉ độc bản và sinh file PDF Giấy chứng nhận có thể tải về máy hoặc chia sẻ lên mạng xã hội.

---

### MODULE 6: DÀNH CHO GIẢNG VIÊN (INSTRUCTOR STUDIO)

#### 1. Quản lý Khóa học & Bài giảng
- Giảng viên tạo khóa học mới, nhập thông tin mô tả, ảnh bìa, chọn môn học và khối lớp.
- Tạo các Chương (Sections) và các Bài học (Lessons).
- Tải lên video bài giảng (hỗ trợ liên kết video bảo mật hoặc video lưu trữ trên đám mây CDN).
- Đính kèm file tài liệu tóm tắt lý thuyết dạng PDF.
- Kéo thả để sắp xếp lại thứ tự bài giảng trực quan.

#### 2. Soạn thảo Ngân hàng câu hỏi trắc nghiệm
- Giảng viên thêm mới câu hỏi trắc nghiệm cho bài học:
  - Nhập nội dung câu hỏi (hỗ trợ gõ chữ đậm, nghiêng, chèn ảnh minh họa và công thức toán học).
  - Nhập các phương án lựa chọn A, B, C, D và tích chọn phương án đúng.
  - Nhập nội dung lời giải thích chi tiết cho câu hỏi.
- Cấu hình điểm số và thời gian làm bài cho đề thi.

#### 3. Theo dõi Học viên & Trả lời Hỏi đáp
- Giảng viên xem danh sách học viên đã đăng ký khóa học và tiến độ học tập trung bình của cả lớp.
- Khu vực quản lý câu hỏi của học sinh: Lọc các câu hỏi chưa được giải đáp để trả lời kịp thời.

---

### MODULE 7: QUẢN TRỊ VIÊN HỆ THỐNG (ADMIN DASHBOARD)

#### 1. Super Admin (Tổng quản)
- Quản lý danh sách tài khoản toàn hệ thống (tìm kiếm, kích hoạt, tạm khóa người dùng).
- Phân quyền quản trị viên: Phân bổ nhân sự vào các vai trò Quản lý khóa học, Kế toán, Chăm sóc khách hàng.
- Cấu hình danh mục hệ thống: Khối lớp, Môn học, Bộ sách giáo khoa, Cấu hình cổng thanh toán.

#### 2. Quản lý Nội dung (Course Ops / Content Moderator)
- Xem danh sách các khóa học giáo viên gửi duyệt (Pending Approval).
- Kiểm tra chất lượng video bài giảng và ngân hàng câu hỏi bài tập.
- Bấm *"Phê duyệt"* để khóa học chính thức xuất hiện trên sàn bán khóa học, hoặc *"Yêu cầu chỉnh sửa"* kèm lý do chi tiết cho giáo viên.

#### 3. Kế toán & Báo cáo Doanh thu (Finance)
- Dashboard biểu đồ thống kê trực quan: Doanh thu theo ngày, tuần, tháng, quý.
- Thống kê các khóa học bán chạy nhất, số lượng học viên mới đăng ký.
- Quản lý lịch sử các giao dịch thanh toán thành công và hoàn tiền (nếu có).
- Báo cáo số liệu đối soát doanh thu để thực hiện chi trả nhuận bút cho giảng viên.

---

## 2.3 BẢNG KẾ HOẠCH TIẾN ĐỘ THỰC HIỆN DỰ ÁN (WBS - TIMELINE)

| TT | Hạng Mục Công Việc | Ngày Bắt Đầu | Ngày Kết Thúc | Phụ Trách | Kết Quả Đầu Ra |
|:---|:---|:---:|:---:|:---:|:---:|
| **1** | **Khảo Sát & Phân Tích Yêu Cầu** | **01/10/2024** | **07/10/2024** | **Cả nhóm** | **Hoàn thành** |
| 1.1 | Khảo sát nhu cầu học sinh K-12 & mô hình bán khóa học | 01/10/2024 | 03/10/2024 | Cả nhóm | Báo cáo khảo sát nhu cầu |
| 1.2 | Xây dựng tài liệu đặc tả yêu cầu hệ thống (SRS) | 03/10/2024 | 05/10/2024 | Cả nhóm | Tài liệu SRS hoàn chỉnh |
| 1.3 | Thiết kế sơ đồ Use Case tổng quan và phân rã các Actor | 05/10/2024 | 06/10/2024 | Cả nhóm | Bộ sơ đồ Use Case Diagrams |
| 1.4 | Mô tả chi tiết các kịch bản nghiệp vụ (Use Case Specs) | 06/10/2024 | 07/10/2024 | Cả nhóm | Bảng đặc tả kịch bản Use Case |
| **2** | **Thiết Kế Hệ Thống** | **08/10/2024** | **17/10/2024** | **Cả nhóm** | **Hoàn thành** |
| 2.1 | Phác thảo kiến trúc công nghệ (NestJS, Next.js, PostgreSQL) | 08/10/2024 | 09/10/2024 | Backend Team | Sơ đồ System Architecture |
| 2.2 | Thiết kế Sơ đồ quan hệ thực thể (ERD) & Cơ sở dữ liệu | 09/10/2024 | 12/10/2024 | Backend Team | Sơ đồ ERD & Database Schema |
| 2.3 | Thiết kế SiteMap & Luồng người dùng (User Flow) | 10/10/2024 | 12/10/2024 | Frontend Team | Sơ đồ SiteMap & User Flow |
| 2.4 | Thiết kế Giao diện UI/UX trên Figma (Client Web) | 12/10/2024 | 16/10/2024 | Frontend Team | Bản thiết kế Figma Client UI |
| 2.5 | Thiết kế Giao diện UI/UX trên Figma (Admin & Instructor) | 14/10/2024 | 17/10/2024 | Frontend Team | Bản thiết kế Figma Admin UI |
| **3** | **Lập Trình Phát Triển Backend (NestJS)** | **18/10/2024** | **15/11/2024** | **Backend Team** | **Hoàn thành** |
| 3.1 | Khởi tạo dự án, kết nối PostgreSQL, viết Migration & Entities | 18/10/2024 | 22/10/2024 | Backend Team | DB Tables & TypeORM Setup |
| 3.2 | Xây dựng Module Auth (JWT, Cookie, Google OAuth, OTP) | 23/10/2024 | 27/10/2024 | Backend Team | Bộ API Xác thực & Bảo mật |
| 3.3 | Xây dựng Module Khóa học & Bài giảng (CRUD, Upload CDN) | 28/10/2024 | 03/11/2024 | Backend Team | API Khóa học & Bài học |
| 3.4 | Xây dựng Module Luyện tập & Đề thi trắc nghiệm (Quiz Engine) | 04/11/2024 | 09/11/2024 | Backend Team | API Làm bài & Chấm điểm tự động |
| 3.5 | Xây dựng Module Đơn hàng & Cổng thanh toán (VietQR, MoMo) | 10/11/2024 | 13/11/2024 | Backend Team | API Thanh toán & Webhook gạch nợ |
| 3.6 | Xây dựng Module Báo cáo Thống kê cho Admin | 14/11/2024 | 15/11/2024 | Backend Team | API Thống kê doanh thu & tiến độ |
| **4** | **Lập Trình Phát Triển Frontend (Next.js)** | **25/10/2024** | **25/11/2024** | **Frontend Team** | **Hoàn thành** |
| 4.1 | Xây dựng Design System, Layout Header, Footer, Navigation | 25/10/2024 | 29/10/2024 | Frontend Team | Base Components & Typography |
| 4.2 | Lập trình Màn hình Đăng nhập, Đăng ký, Cài đặt cá nhân | 30/10/2024 | 03/11/2024 | Frontend Team | Trang Auth & Profile UI |
| 4.3 | Lập trình Trang chủ, Danh mục & Trang chi tiết khóa học | 04/11/2024 | 09/11/2024 | Frontend Team | Trang Marketplace & Checkout |
| 4.4 | Lập trình Trình phát học tập (Video Player, Ghi chú, Q&A) | 10/11/2024 | 16/11/2024 | Frontend Team | Phòng học LMS tương tác |
| 4.5 | Lập trình Giao diện Luyện đề trắc nghiệm & Xem lời giải | 17/11/2024 | 21/11/2024 | Frontend Team | Giao diện làm Quiz & Luyện thi |
| 4.6 | Lập trình Giao diện Quản trị Admin & Giảng viên | 21/11/2024 | 25/11/2024 | Frontend Team | Trang Admin Dashboard & Studio |
| **5** | **Kiểm Thử & Đảm Bảo Chất Lượng (QA/QC)** | **26/11/2024** | **05/12/2024** | **Cả nhóm** | **Hoàn thành** |
| 5.1 | Kiểm thử chức năng toàn hệ thống (Functional Testing) | 26/11/2024 | 29/11/2024 | Tester | Bảng Test Cases & Kết quả test |
| 5.2 | Kiểm thử luồng thanh toán VietQR & bảo mật dữ liệu | 30/11/2024 | 02/12/2024 | Backend + Tester | Báo cáo kiểm thử thanh toán |
| 5.3 | Lập trình khắc phục lỗi phát sinh (Bug Fixing) | 03/12/2024 | 05/12/2024 | Cả nhóm | Bản Fix lỗi hoàn chỉnh |
| **6** | **Đóng Gói, Triển Khai & Báo Cáo** | **06/12/2024** | **15/12/2024** | **Cả nhóm** | **Hoàn thành** |
| 6.1 | Đóng gói Docker Container & Triển khai lên máy chủ Cloud | 06/12/2024 | 08/12/2024 | DevOps/Lead | Hệ thống chạy Production trên Domain |
| 6.2 | Viết Tài liệu Hướng dẫn sử dụng cho Học sinh, GV và Admin | 09/12/2024 | 12/12/2024 | Cả nhóm | Bộ User Manual Docs |
| 6.3 | Hoàn thiện Báo cáo Đồ án tốt nghiệp & Chuẩn bị Slide bảo vệ | 13/12/2024 | 15/12/2024 | Cả nhóm | Báo cáo đồ án & Slide hoàn chỉnh |
