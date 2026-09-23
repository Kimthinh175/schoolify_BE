# PHẦN 2: KHẢO SÁT NHU CẦU & ĐẶC TẢ YÊU CẦU HỆ THỐNG SCHOOLIFY
## (NỀN TẢNG BÁN KHÓA HỌC & LUYỆN TẬP KIẾN THỨC K-12)

---

## 2.1 YÊU CẦU KHÁCH HÀNG

### Các yêu cầu của khách hàng

#### Quản lý người dùng:
- **Đăng ký:**
  - Học viên có thể đăng ký tài khoản bằng các phương thức đăng ký khác nhau (Email, Số điện thoại, Google).
- **Đăng nhập/Đăng xuất:**
  - Học viên có thể đăng nhập bằng thông tin tài khoản của mình.
  - Hỗ trợ cơ chế xác thực an toàn (NextAuth, JWT, Token, Cookie).
- **Quản lý hồ sơ cá nhân:**
  - Học viên có thể cập nhật thông tin cá nhân như tên, email, ảnh đại diện, khối lớp đang học (Lớp 1 đến Lớp 12), trường học, giới thiệu.

#### Mua khóa học và học tập:
- **Lộ trình và Khóa học:**
  - **Khóa học có phí:**
    - Hiển thị danh sách các khóa học có phí cho học viên chọn mua theo từng khối lớp và môn học.
    - Cho phép tìm kiếm khóa học theo tên, theo khối lớp, môn học, bộ sách giáo khoa (Kết nối tri thức, Cánh Diều, Chân trời sáng tạo).
  - **Xác nhận thanh toán:**
    - Sau khi chọn được khóa học, học viên thanh toán qua chuyển khoản ngân hàng (VietQR Napas 24/7), MoMo, VNPay.
    - Sau khi học viên thanh toán thành công, khóa học sẽ được thêm vào danh sách khóa học của họ.
  - **Khóa học miễn phí:**
    - Học viên đăng ký tài khoản, bấm đăng ký khóa học là có thể học ngay.
- **Học tập:**
  - **Học theo tuần tự:**
    - Học viên cần hoàn thành bài học theo thứ tự, không được bỏ qua bài học.
  - **Không tua khi học:**
    - Hỗ trợ chức năng ngăn tua tiến độ video vượt quá thời gian đã xem, được phép tua ngược để nghe lại.
  - **Hỗ trợ các chức năng: ghi chú, hỏi đáp:**
    - **Ghi chú:** theo thời gian học video (hỗ trợ cho các bài học dạng Video). Lưu theo tiêu đề nội dung và cả thời gian khi dừng video để tạo ghi chú.
    - **Hỏi đáp:** các hỏi đáp phân loại theo từng chương từng bài học, xem được các câu hỏi thường gặp, đặt câu hỏi trực tiếp với người tạo ra khóa học (thêm, sửa, xóa câu hỏi của chính bạn).
- **Bài tập và Luyện thi K-12:**
  - Đến với Schoolify bài tập cũng là một dạng bài học, học viên bắt buộc phải hoàn thành bài tập đạt yêu cầu (từ 80% trở lên) mới có thể mở khóa qua được bài tiếp theo.
  - Bài tập có 3 dạng:
    - Bài tập trắc nghiệm nhiều lựa chọn (`multiple_choice` - 4 phương án A, B, C, D).
    - Bài tập đúng/sai (`true_false`).
    - Bài tập điền từ / điền số khuyết (`fill`).
    - Các bài tập đều có đáp án, xem giải thích chi tiết từng bước sau khi nộp bài.

#### Đánh giá và chứng chỉ:
- **Đánh giá khóa học:**
  - Sau khi hoàn thành khóa học, học viên có thể đánh giá khóa học (từ 1 đến 5 sao) và để lại nhận xét.
- **Chứng chỉ:**
  - Học viên hoàn thành khóa học (100% video và bài tập) sẽ nhận được chứng chỉ hoàn thành khóa học (tải về file PDF).

#### Nhắc nhở học tập tự động:
- **Thêm, sửa, xóa, bật tắt:**
  - Học viên thêm, sửa, xóa, bật/tắt được nhắc nhở học tập tự động theo thời gian biểu cá nhân.

#### Xem bài viết và bình luận:
- **Bài viết:**
  - Học viên có thể truy cập mục bài viết trên website để đọc các bài viết liên quan đến phương pháp học tập K-12, mẹo giải nhanh, kinh nghiệm thi cử, v.v.
  - Bài viết có thể được phân loại theo các chuyên mục môn học để dễ tìm kiếm.
  - Mỗi bài viết hiển thị các thông tin: tiêu đề, hình ảnh, nội dung, tác giả, ngày đăng và số lượt xem.
- **Bình luận:**
  - Học viên có thể để lại bình luận dưới mỗi bài viết sau khi đăng nhập.
  - Hỗ trợ bình luận lồng nhau (trả lời trực tiếp một bình luận cụ thể).

---

### Chức năng của giảng viên

#### Tạo khóa học:
- Giảng viên có thể tạo khóa học mới, nhập thông tin khóa học (tên khóa học, mô tả, môn học, khối lớp, bộ sách giáo khoa, ảnh bìa, giá bán).
- Tạo chương, bài học, bài tập theo nhiều dạng, thêm URL video bài giảng.
- Thêm thứ tự bài học.

#### Quản lý bài học:
- Giảng viên có thể thêm, sửa, ẩn, xóa từng chương, bài học, bài tập trong khóa học.
- Upload/nhúng video cho mỗi bài học để học sinh theo dõi.
- Có thể sắp xếp lại thứ tự bài học hoặc chỉnh sửa bài học sau khi tạo.

#### Tạo bài tập:
- Giảng viên có thể tùy chọn tạo các dạng bài tập khác nhau cho học viên sau mỗi bài học:
  - **Bài tập trắc nghiệm:** Nhập câu hỏi trắc nghiệm (hỗ trợ công thức Toán/Lý/Hóa LaTeX), nhập 4 đáp án A, B, C, D, chọn đáp án đúng và nhập lời giải thích.
  - **Bài tập đúng/sai:** Nhập câu hỏi và chọn đáp án đúng (Đúng hoặc Sai).
  - **Bài tập điền từ / điền số:** Nhập câu hỏi dạng điền khuyết và nhập từ khóa/kết quả cần điền.

#### Trả lời câu hỏi của học viên giải đáp thắc mắc:
- Giảng viên trả lời câu hỏi của từng học sinh dưới bài giảng của mình.

---

### Phân quyền Admin cho các bộ phận

#### Bộ phận Quản lý Hệ thống (Admin tổng quản):
- **Quản lý phân quyền:** Có quyền thêm, sửa, xóa các bộ phận quản trị khác. Phân quyền cho các bộ phận khác như Quản lý khóa học, Marketing, Kế toán, Giảng viên.
- **Thêm/xóa bộ phận:** Có quyền thêm mới hoặc gỡ bỏ các bộ phận trong hệ thống quản trị.
- **Kiểm duyệt khóa học:** Xem xét và phê duyệt các khóa học trước khi được công khai.
- **Kiểm duyệt bài viết:** Kiểm tra và phê duyệt bài viết từ bộ phận Marketing trước khi công bố.
- Xem được lịch sử truy cập, thao tác của các admin khác.

#### Bộ phận Quản lý khóa học:
- **Kiểm tra nội dung khóa học:** Có quyền xem xét, kiểm duyệt nội dung từ giảng viên, bao gồm các bài học và bài tập.
- **Kiểm duyệt video:** Quản lý và kiểm duyệt các video bài giảng từ giảng viên trước khi đăng tải cho học viên.
- **Phản hồi các thông tin cần sửa đổi:** Có quyền yêu cầu giảng viên chỉnh sửa (tên khóa học, mô tả, bài học, bài tập, v.v.).

#### Bộ phận Marketing:
- **Đăng bài viết:** Có quyền đăng bài viết quảng bá, giới thiệu khóa học, hoặc các bài viết liên quan đến giáo dục và nội dung khác. Có thể quản lý bài viết (thêm, sửa, ẩn).
- **Phản hồi bình luận:** Theo dõi và trả lời các bình luận từ học viên liên quan đến bài viết hoặc nội dung khóa học. Được phép quản lý và xử lý các bình luận tiêu cực hoặc không phù hợp.

#### Bộ phận Kế toán:
- **Thống kê doanh thu:** Quản lý và tạo báo cáo doanh thu từ khóa học, theo dõi doanh thu hàng tuần, tháng, năm.
- **Thống kê lợi nhuận:** Phân tích chi tiết và báo cáo lợi nhuận từ doanh thu khóa học, các chiến dịch khuyến mãi và tỷ lệ chi trả nhuận bút cho giảng viên.
- Quyền xem báo cáo chi tiết về doanh thu và lợi nhuận từ việc bán khóa học.

---

## 2.2 CÁC TÍNH NĂNG CỦA SCHOOLIFY

### Auth

#### Chức năng đăng nhập: Đăng nhập bằng tài khoản Google, Tài khoản (Email, Số điện thoại và mật khẩu)

##### Chi tiết của đăng nhập Google:
- **Hiển thị nút “Đăng nhập bằng Google”:**
  - Trên giao diện đăng nhập, hiển thị nút “Đăng nhập bằng Google”.
  - Nút này có thể sử dụng icon của Google để người dùng nhận biết.
- **Người dùng nhấn nút “Đăng nhập bằng Google”:**
  - Khi người dùng nhấn vào nút này, hệ thống sẽ chuyển hướng tới trang đăng nhập của Google.
- **Người dùng nhập thông tin tài khoản Google:**
  - Người dùng nhập địa chỉ email và mật khẩu tài khoản Google của họ.
- **Xác thực Google:**
  - Google sẽ xác thực thông tin tài khoản.
  - Nếu thông tin chính xác, Google sẽ gửi mã xác thực (OAuth token) về cho hệ thống của bạn.
- **Xử lý mã xác thực:**
  - Hệ thống của bạn sẽ nhận mã xác thực từ Google và kiểm tra tính hợp lệ.
  - Nếu mã hợp lệ, hệ thống sẽ cho phép người dùng đăng nhập vào tài khoản của họ trên ứng dụng của bạn.

##### Đăng nhập bằng Tài khoản (Email, Số điện thoại và mật khẩu):
- **Hiển thị form đăng nhập:**
  - Trên giao diện đăng nhập, hiển thị form để người dùng nhập email hoặc số điện thoại và mật khẩu.
  - Form này nên bao gồm các trường:
    - Email hoặc Số điện thoại.
    - Mật khẩu.
    - Nút "Đăng nhập".
- **Người dùng nhập thông tin tài khoản:**
  - Người dùng nhập email hoặc số điện thoại và mật khẩu vào form đăng nhập.
- **Gửi yêu cầu xác thực:**
  - Khi người dùng nhấn nút "Đăng nhập", hệ thống sẽ gửi yêu cầu xác thực thông tin tài khoản tới máy chủ.
- **Xác thực thông tin tài khoản:**
  - Máy chủ sẽ kiểm tra thông tin email hoặc số điện thoại và mật khẩu mà người dùng đã nhập.
  - Nếu thông tin chính xác, máy chủ sẽ tạo một phiên đăng nhập cho người dùng.
- **Xử lý kết quả:**
  - Nếu thông tin đăng nhập chính xác, người dùng sẽ được chuyển hướng tới trang chủ.
  - Nếu thông tin không chính xác, hiển thị thông báo lỗi và yêu cầu người dùng nhập lại thông tin.
- **Các yêu cầu bổ sung:**
  - **Mã hóa mật khẩu:** Mật khẩu người dùng cần được mã hóa trước khi lưu trữ trong cơ sở dữ liệu.
  - **Bảo mật thông tin:** Sử dụng các phương thức bảo mật như HTTPS để bảo vệ thông tin đăng nhập.
  - **Xử lý lỗi:** Hiển thị các thông báo lỗi thân thiện và rõ ràng khi người dùng nhập sai thông tin.

---

#### Chức năng đăng ký: Đăng ký bằng tài khoản Google, Tài khoản (Email, Số điện thoại và mật khẩu)

##### Chi tiết:
- **Hiển thị giao diện đăng ký:**
  - Trên giao diện đăng ký, hiển thị các tùy chọn đăng ký bằng tài khoản Google và Email/Số điện thoại.

##### Đăng ký bằng tài khoản Google:
- **Hiển thị nút "Đăng ký bằng Google":**
  - Sử dụng icon Google để dễ nhận biết.
- **Người dùng nhấn nút "Đăng ký bằng Google":**
  - Chuyển hướng tới trang đăng nhập của Google.
- **Người dùng nhập thông tin tài khoản Google:**
  - Nhập địa chỉ email và mật khẩu tài khoản Google.
- **Xác thực với Google:**
  - Google xác thực thông tin tài khoản và gửi mã xác thực (OAuth token) về cho hệ thống của bạn.
- **Xử lý mã xác thực:**
  - Nhận mã xác thực từ Google và kiểm tra tính hợp lệ.
  - Nếu mã hợp lệ, tạo tài khoản mới cho người dùng trên ứng dụng của bạn.

##### Đăng ký bằng Tài khoản (Email, Số điện thoại và mật khẩu):
- **Hiển thị form đăng ký:**
  - Hiển thị form để người dùng nhập thông tin email hoặc số điện thoại và mật khẩu.
  - Các trường thông tin bao gồm:
    - Họ và tên học sinh.
    - Khối lớp (Lớp 1 đến Lớp 12).
    - Email hoặc Số điện thoại.
    - Mật khẩu.
    - Xác nhận mật khẩu.
- **Người dùng nhập thông tin tài khoản:**
  - Nhập đầy đủ thông tin vào form đăng ký.
- **Gửi yêu cầu tạo tài khoản:**
  - Khi người dùng nhấn nút "Đăng ký", hệ thống sẽ gửi yêu cầu tạo tài khoản tới máy chủ.
- **Xác thực thông tin tài khoản:**
  - Kiểm tra tính hợp lệ của email hoặc số điện thoại.
  - Kiểm tra xem email hoặc số điện thoại đã được đăng ký trước đó chưa.
- **Tạo tài khoản mới:**
  - Nếu thông tin hợp lệ, tạo tài khoản mới cho người dùng.
  - Mã hóa mật khẩu trước khi lưu trữ trong cơ sở dữ liệu.
- **Các yêu cầu bổ sung:**
  - **Xác minh email/số điện thoại:** Gửi email hoặc tin nhắn xác minh (OTP) để đảm bảo tính chính xác của thông tin người dùng trong vòng 120s.
  - **Mã hóa mật khẩu:** Mật khẩu người dùng cần được mã hóa trước khi lưu trữ trong cơ sở dữ liệu.
  - **Bảo mật thông tin:** Sử dụng các phương thức bảo mật như HTTPS để bảo vệ thông tin đăng ký.
  - **Xử lý lỗi:** Hiển thị các thông báo lỗi thân thiện và rõ ràng khi người dùng nhập sai thông tin.

---

#### Chức năng thay đổi mật khẩu: Xác minh bằng số điện thoại | Email và mật khẩu cũ

##### Chi tiết:
- **Xác minh bằng Số điện thoại:**
  - **Hiển thị form xác minh số điện thoại:**
    - Trên giao diện thay đổi mật khẩu, hiển thị form để người dùng nhập số điện thoại.
    - Các trường thông tin bao gồm:
      - Số điện thoại.
      - Nút "Gửi mã xác minh".
  - **Người dùng nhập số điện thoại:**
    - Người dùng nhập số điện thoại vào form và nhấn nút "Gửi mã xác minh".
  - **Gửi mã xác minh:**
    - Hệ thống gửi mã xác minh (OTP) đến số điện thoại của người dùng qua tin nhắn SMS.
  - **Hiển thị form nhập mã xác minh và mật khẩu mới:**
    - Sau khi gửi mã xác minh, hiển thị form để người dùng nhập mã xác minh và mật khẩu mới.
    - Các trường thông tin bao gồm:
      - Mã xác minh.
      - Mật khẩu mới.
      - Xác nhận mật khẩu mới.
      - Nút "Xác nhận".
  - **Người dùng nhập mã xác minh và mật khẩu mới:**
    - Người dùng nhập mã xác minh và mật khẩu mới vào form.
  - **Xác minh mã xác minh:**
    - Hệ thống kiểm tra tính hợp lệ của mã xác minh.
    - Nếu mã xác minh hợp lệ, chuyển sang bước tiếp theo.
  - **Cập nhật mật khẩu mới:**
    - Mã hóa mật khẩu mới trước khi lưu trữ trong cơ sở dữ liệu.
    - Cập nhật mật khẩu mới cho tài khoản của người dùng trong cơ sở dữ liệu.
  - **Thông báo kết quả:**
    - Nếu thay đổi mật khẩu thành công, hiển thị thông báo xác nhận cho người dùng.
    - Nếu mã xác minh không hợp lệ hoặc có lỗi xảy ra, hiển thị thông báo lỗi.

---

#### Chức năng lấy lại mật khẩu: Xác minh bằng số điện thoại | Email

##### Xác minh bằng số điện thoại:
- **Hiển thị form nhập số điện thoại:**
  - Trên giao diện lấy lại mật khẩu, hiển thị form để người dùng nhập số điện thoại.
  - Các trường thông tin bao gồm:
    - Số điện thoại.
    - Nút "Gửi mã xác minh".
- **Người dùng nhập số điện thoại:**
  - Người dùng nhập số điện thoại vào form và nhấn nút "Gửi mã xác minh".
- **Gửi mã xác minh:**
  - Hệ thống gửi mã xác minh (OTP) đến số điện thoại của người dùng qua tin nhắn SMS.
- **Hiển thị form nhập mã xác minh và mật khẩu mới:**
  - Sau khi gửi mã xác minh, hiển thị form để người dùng nhập mã xác minh và mật khẩu mới.
  - Các trường thông tin bao gồm:
    - Mã xác minh.
    - Mật khẩu mới.
    - Xác nhận mật khẩu mới.
    - Nút "Xác nhận".
- **Người dùng nhập mã xác minh và mật khẩu mới:**
  - Người dùng nhập mã xác minh và mật khẩu mới vào form.
- **Xác minh mã xác minh:**
  - Hệ thống kiểm tra tính hợp lệ của mã xác minh.
  - Nếu mã xác minh hợp lệ, chuyển sang bước tiếp theo.
- **Cập nhật mật khẩu mới:**
  - Mã hóa mật khẩu mới trước khi lưu trữ trong cơ sở dữ liệu.
  - Cập nhật mật khẩu mới cho tài khoản của người dùng trong cơ sở dữ liệu.
- **Thông báo kết quả:**
  - Nếu lấy lại mật khẩu thành công, hiển thị thông báo xác nhận cho người dùng.
  - Nếu mã xác minh không hợp lệ hoặc có lỗi xảy ra, hiển thị thông báo lỗi.

##### Xác minh bằng Email:
- **Hiển thị form nhập email:**
  - Trên giao diện lấy lại mật khẩu, hiển thị form để người dùng nhập email.
  - Các trường thông tin bao gồm:
    - Email.
    - Nút “Gửi email xác minh”.
- **Người dùng nhập email:**
  - Người dùng nhập email vào form và nhấn nút "Gửi email xác minh".
- **Gửi email xác minh:**
  - Hệ thống gửi email chứa liên kết xác minh đến địa chỉ email của người dùng.
- **Người dùng nhận và nhấp vào liên kết xác minh trong email:**
  - Người dùng mở email và nhấp vào liên kết xác minh để mở trang thay đổi mật khẩu.
- **Hiển thị form nhập mật khẩu mới:**
  - Sau khi nhấp vào liên kết xác minh, hiển thị form để người dùng nhập mật khẩu mới.
  - Các trường thông tin bao gồm:
    - Mật khẩu mới.
    - Xác nhận mật khẩu mới.
    - Nút “Xác nhận”.
- **Người dùng nhập mật khẩu mới:**
  - Người dùng nhập mật khẩu mới và xác nhận mật khẩu mới vào form.
- **Cập nhật mật khẩu mới:**
  - Mã hóa mật khẩu mới trước khi lưu trữ trong cơ sở dữ liệu.
  - Cập nhật mật khẩu mới cho tài khoản của người dùng trong cơ sở dữ liệu.
- **Thông báo kết quả:**
  - Nếu lấy lại mật khẩu thành công, hiển thị thông báo xác nhận cho người dùng.
  - Nếu có lỗi xảy ra, hiển thị thông báo lỗi.
- **Các yêu cầu bổ sung:**
  - **Bảo mật thông tin:** Sử dụng các phương thức bảo mật như HTTPS để bảo vệ thông tin xác minh và mật khẩu.
  - **Mã hóa mật khẩu:** Mật khẩu cần được mã hóa trước khi lưu trữ trong cơ sở dữ liệu.
  - **Xử lý lỗi:** Hiển thị các thông báo lỗi thân thiện và rõ ràng khi người dùng nhập sai thông tin hoặc có lỗi xảy ra.

---

### Chức năng quản lý thông tin cá nhân

#### Chức năng thay đổi thông tin cá nhân: Thay đổi tên, khối lớp và các thông tin cá nhân khác
- **Truy cập trang cài đặt cá nhân:**
  - Người dùng đăng nhập vào tài khoản của họ và điều hướng đến trang cài đặt tài khoản.
- **Cập nhật thông tin:**
  - Người dùng sẽ thấy các trường thông tin cá nhân của họ (tên, email, khối lớp, trường học, ảnh đại diện...) và người dùng có thể nhập thông tin mới vào các trường đã cho.
- **Xác nhận thay đổi:**
  - Sau khi nhập thông tin mới, người dùng nhấn nút “Cập nhật”.

#### Thay đổi số điện thoại: Xác minh số điện thoại chỉ thay đổi số điện thoại khi đã có Email (bắt buộc)
- **Truy cập trang thay đổi SĐT:**
  - Người dùng truy cập vào phần cài đặt số điện thoại trong trang cài đặt tài khoản.
- **Nhập số điện thoại mới:**
  - Người dùng nhập số điện thoại mới vào trường tương ứng và nhấn nút "Xác nhận".
- **Xác minh qua email:**
  - Một email chứa mã xác minh sẽ được gửi đến địa chỉ email của người dùng.
  - Người dùng nhập mã xác minh vào trường trên trang web để xác nhận thay đổi số điện thoại.
- **Hoàn tất thay đổi:**
  - Sau khi mã xác minh được xác nhận, số điện thoại mới của người dùng sẽ được cập nhật.
  - Người dùng nhận được thông báo trên website xác nhận rằng số điện thoại của họ đã được thay đổi thành công.

#### Mật khẩu: Người dùng có thể thay đổi mật khẩu thông qua một phần cài đặt bảo mật, thường yêu cầu nhập mật khẩu hiện tại trước khi đổi sang mật khẩu mới
- **Truy cập trang đổi mật khẩu:**
  - Người dùng truy cập vào phần đổi mật khẩu trong trang cài đặt tài khoản.
- **Nhập mật khẩu hiện tại và mật khẩu mới:**
  - Người dùng nhập mật khẩu hiện tại, mật khẩu mới và xác nhận mật khẩu mới vào các trường tương ứng.
- **Xác nhận thay đổi:**
  - Người dùng nhấn nút "Đổi mật khẩu" để xác nhận thay đổi.
  - Hệ thống kiểm tra mật khẩu hiện tại và tính bảo mật của mật khẩu mới.
- **Hoàn tất thay đổi:**
  - Nếu mọi thứ đều hợp lệ, mật khẩu mới sẽ được cập nhật.
  - Người dùng nhận được thông báo rằng mật khẩu của họ đã được thay đổi thành công.

---

### Tìm kiếm khóa học và bài viết

#### Người dùng nhập vào thanh tìm kiếm để tìm khóa học | bài viết và hiển thị lại nội dung liên quan với nội dung nhập vào
- **Chi tiết:**
  - Trên header có thanh tìm kiếm, người dùng nhập vào các ký tự hoặc từ khóa liên quan tới bài viết hay khóa học (theo môn học, khối lớp, tên giáo viên). Sau khi nhập xong có thể Enter hoặc Click vào nút button có icon kính lúp ở bên cạnh thanh tìm kiếm.
  - Sau khi nhấn tìm kiếm sẽ hiển thị những khóa học và bài viết liên quan.

#### Xem nội dung khóa học
- Người dùng có thể xem nội dung tóm tắt ngay cả khi chưa đăng nhập, người tạo ra khóa học, lược sử, thành tựu, danh sách các bài học được học, các phản hồi và có thể để lại thông tin để tư vấn.

#### Học các khóa học miễn phí:
- **Khóa học miễn phí:**
- **Chi tiết:**
  - Người dùng sau khi đăng nhập có thể vào phần danh mục trên thanh menu hoặc tìm kiếm trên thanh tìm kiếm khóa học miễn phí và xem được các khóa học miễn phí trên trang.
  - Sẽ chuyển tới trang chứa các môn học miễn phí, nhấn vào môn học sẽ có nút button học ngay ở bên dưới. Cứ mỗi bài học đã xong và hoàn thành bài tập, các câu hỏi trắc nghiệm sẽ giúp tăng số tiến độ hoàn thành % của môn học.
  - Sau khi hoàn thành tất cả video bài học, bài tập và câu hỏi trắc nghiệm đủ 100% tiến độ bài học sẽ đến phần nhận chứng chỉ.
  - Sau khi hoàn thành khóa học vẫn có thể xem lại các video, làm lại các bài tập và các câu hỏi trắc nghiệm.

#### Khóa học có phí:
- **Chi tiết:**
  - Học viên chọn khóa học muốn học. Bấm nút thanh toán sẽ đến trang thanh toán. Có 3 phương thức thanh toán là chuyển khoản ngân hàng VietQR Napas 24/7, MoMo và VNPay.
  - Sau khi thanh toán thành công bạn sẽ nhận được email thông báo thanh toán thành công.
  - Sẽ chuyển tới trang chứa các khóa học của bạn. Nhấn vào môn học sẽ có nút button học ngay ở bên dưới. Nhấn vào nút học ngay để tới trang chứa các bài học có video bài giảng ở mỗi phần và phần bài tập cuối bài học, bộ câu hỏi trắc nghiệm sau mỗi bài học. Cứ mỗi bài học đã xong và hoàn thành bài tập, các câu hỏi trắc nghiệm sẽ giúp tăng số tiến độ hoàn thành % của môn học.
  - Sau khi hoàn thành tất cả video bài học, bài tập và câu hỏi trắc nghiệm đủ 100% tiến độ bài học sẽ hiện nút nhận chứng chỉ ở ngay bên dưới. Sau khi hoàn thành khóa học vẫn có thể xem lại các video, làm lại các bài tập và các câu hỏi trắc nghiệm.

---

### Mua và thanh toán khóa học

#### Danh sách khóa học
- Hiển thị danh sách các khóa học cho học viên chọn mua.
- Cho phép tìm kiếm khóa học theo tên, theo khối lớp, môn học, giá, hoặc giảng viên.
- Tích hợp các phương thức thanh toán trực tuyến (VietQR Napas 24/7, MoMo, VNPay).

#### Xác nhận thanh toán
- Sau khi học viên thanh toán thành công, khóa học sẽ được thêm vào danh sách khóa học của họ.

---

### Chức năng quản lý học trực tuyến trên Schoolify (Learning Management System)
Học viên đăng ký khóa học có phí hoặc miễn phí đều được sử dụng chức năng LMS.
Bao gồm:

#### Học tập
- **Học theo tuần tự:**
  - Học viên cần hoàn thành bài học theo thứ tự được giảng viên sắp xếp.
- **Không tua khi học:**
  - Học viên không thể bỏ qua các bài học, bắt buộc học lần lượt. Không cho tua vượt quá thời gian video đã xem.
- **Làm bài tập:**
  - Nếu bài học có bài tập, học viên cần làm bài tập đạt chuẩn (>=80%) trước khi qua bài tiếp theo.
- **Hỏi đáp trong bài học:**
  - Tích hợp chức năng hỏi đáp trực tiếp trong mỗi bài học để học viên có thể đặt câu hỏi cho giảng viên.

#### Đánh giá và chứng chỉ
- **Đánh giá khóa học:**
  - Sau khi hoàn thành khóa học, học viên có thể đánh giá khóa học (từ 1 đến 5 sao) và để lại nhận xét.
- **Chứng chỉ:**
  - Học viên hoàn thành khóa học sẽ nhận được chứng chỉ nếu có.

#### Lên lịch học và nhắc nhở
- **Tạo thời khóa biểu:**
- **Nhắc nhở học:**
  - Cho phép học viên bật/tắt thông báo nhắc nhở học theo thời gian đã lên lịch.

#### Xem bài viết và bình luận
- **Bài viết:**
  - Học viên có thể truy cập mục bài viết trên website để đọc các bài viết liên quan đến các chủ đề giáo dục, kinh nghiệm học tập K-12, hướng dẫn kỹ năng, v.v.
  - Bài viết có thể được phân loại theo các chuyên mục khác nhau để dễ tìm kiếm.
  - Mỗi bài viết sẽ hiển thị các thông tin: tiêu đề, nội dung, tác giả, ngày đăng, và số lượt xem.
- **Bình luận:**
  - Học viên có thể để lại bình luận dưới mỗi bài viết sau khi đăng nhập.
  - Hỗ trợ bình luận lồng nhau (trả lời trực tiếp một bình luận cụ thể).

---

### Chức năng của giảng viên

#### Tạo khóa học
- Giảng viên có thể tạo khóa học mới, nhập thông tin khóa học bao gồm tên khóa học, mô tả, môn học, khối lớp và số lượng bài học dự kiến.

#### Quản lý bài học:
- Giảng viên có thể tạo từng bài học trong khóa học.
- Thêm URL video bài giảng.
- Có thể sắp xếp lại thứ tự bài học hoặc chỉnh sửa bài học sau khi tạo.
- Trả lời câu hỏi của học viên giải đáp thắc mắc.

#### Tạo bài tập
- Giảng viên có thể tùy chọn tạo các dạng bài tập khác nhau cho học viên sau mỗi bài học:
  - **Bài tập trắc nghiệm:**
    - Nhập câu hỏi trắc nghiệm (hỗ trợ công thức Toán/Lý/Hóa LaTeX).
    - Nhập đáp án đúng và 2 hoặc 3 câu trả lời sai.
    - Nhập lời giải thích chi tiết.
  - **Bài tập đúng/sai:**
    - Nhập câu hỏi và đáp án đúng (đúng hoặc sai).
  - **Bài tập điền từ / điền số:**
    - Nhập câu hỏi dạng điền từ hoặc điền số khuyết.
    - Nhập từ khóa hoặc số cần điền vào câu trả lời của học viên.

---

### Feedback
Người dùng được đánh giá khóa học khi đã hoàn thành khóa học.
Người dùng được quyền phản hồi khóa học khi đã hoàn thành.

#### Chi tiết:
- Người dùng hoàn thành một khóa học.
- Hệ thống kiểm tra và xác nhận rằng người dùng đã hoàn thành khóa học.
- Người dùng nhìn thấy nút "Đánh giá khóa học" và "Viết đánh giá".
- Người dùng nhấn vào nút để truy cập form đánh giá hoặc bình luận.
- Người dùng nhập đánh giá hoặc bình luận và nhấn "Gửi".
- Đánh giá hoặc bình luận của người dùng được gửi đến server và lưu trữ.
- Đánh giá hoặc phản hồi sẽ được hiển thị trên trang chi tiết của khóa học.

---

### Chứng chỉ
Học viên hoàn thành một khóa học 100% sẽ được chuyển đến trang chứng chỉ.

#### Chi tiết:
- Hệ thống kiểm tra và xác nhận rằng học viên đã hoàn thành khóa học.
- Học viên nhìn thấy nút “Nhận Chứng chỉ” và kiểm tra thông tin học viên.
- Sau khi điền thông tin học viên và bấm xác nhận bên dưới.
- Hệ thống sẽ tạo chứng chỉ và gửi chứng chỉ thông qua Email hoặc trong trang thông tin của học viên.
- Học viên có thể tải về chứng chỉ dưới dạng PDF.

---

### Xem bài viết (Không cần đăng nhập)
- Người dùng truy cập vào trang web.
- Người dùng nhìn thấy danh sách các bài viết trên trang chủ, trang danh sách bài viết hoặc phần tìm kiếm.
- Người dùng nhấn vào tiêu đề hoặc nút "Xem chi tiết" của một bài viết mà họ quan tâm.
- Người dùng được chuyển hướng đến trang chi tiết bài viết và có thể đọc toàn bộ nội dung bài viết mà không cần đăng nhập.

---

### Timeline Course
#### Hiển Thị Tiến Độ Học Tập:
- **Tiến Độ Bài Học:** Mỗi bài học hoặc phần của khóa học sẽ được đánh dấu là đã hoàn thành hoặc chưa, giúp người dùng dễ dàng theo dõi những gì họ đã học và những gì còn lại.
- **Thanh Tiến Độ Tổng Quan:** Một thanh tiến độ tổng hợp thể hiện tỷ lệ hoàn thành của toàn bộ khóa học.

---

### Chức Năng Bài Tập Khóa Học
#### Các Loại Bài Tập
- **Bài Tập Trắc Nghiệm (Multiple Choice):** Học viên chọn đáp án đúng từ các lựa chọn có sẵn (A, B, C, D).
- **Bài Tập Điền Từ / Điền Số (Fill in the blank):** Học viên điền từ, cụm từ hoặc con số kết quả vào chỗ trống trong câu.
- **Bài Tập Đúng / Sai (True / False):** Học viên xác định tính đúng hoặc sai của một mệnh đề.
- **Hiển Thị Kết Quả & Giải Thích Chi Tiết:** Sau khi nộp bài, hệ thống hiển thị điểm số, các câu làm đúng/sai kèm theo lời giải chi tiết từng bước cho từng câu hỏi.

---

### Chức Năng Nhận Chứng Chỉ Khóa Học
- Người dùng được nhận chứng chỉ sau khi học xong 100% khóa học.
- Xác nhận thông tin (cho chỉnh sửa tên trước khi in chứng chỉ).

---

### Phân quyền Admin cho các bộ phận

#### Bộ phận Quản lý Hệ thống (Admin tổng quản):
- **Quản lý phân quyền:**
  - Có quyền thêm, sửa, xóa các bộ phận quản trị khác.
  - Phân quyền cho các bộ phận khác như Quản lý khóa học, Marketing, Kiểm toán.
- **Thêm/xóa bộ phận:**
  - Có quyền thêm mới hoặc gỡ bỏ các bộ phận trong hệ thống quản trị.
- **Kiểm duyệt khóa học:**
  - Xem xét và phê duyệt các khóa học trước khi được công khai.
- **Kiểm duyệt bài viết:**
  - Kiểm tra và phê duyệt bài viết từ bộ phận Marketing trước khi công bố.

#### Bộ phận Quản lý khóa học:
- **Kiểm tra nội dung khóa học:**
  - Có quyền xem xét, kiểm duyệt nội dung từ giảng viên, bao gồm các bài học và bài tập.
- **Kiểm duyệt video:**
  - Quản lý và kiểm duyệt các video bài giảng từ giảng viên trước khi đăng tải cho học viên.
- **Phản hồi các thông tin cần sửa đổi:**
  - Có quyền yêu cầu giảng viên chỉnh sửa (tên khóa học, mô tả, bài học, bài tập, v.v.).

#### Bộ phận Marketing:
- **Đăng bài viết:**
  - Có quyền đăng bài viết quảng bá, giới thiệu khóa học, hoặc các bài viết liên quan đến giáo dục và nội dung khác.
  - Có thể quản lý bài viết (thêm, sửa, xóa).
- **Phản hồi bình luận:**
  - Theo dõi và trả lời các bình luận từ học viên liên quan đến bài viết hoặc nội dung khóa học.
  - Được phép quản lý và xử lý các bình luận tiêu cực hoặc không phù hợp.

#### Bộ phận Kiểm toán (Kế toán):
- **Thống kê doanh thu:**
  - Quản lý và tạo báo cáo doanh thu từ khóa học, theo dõi lợi nhuận hàng tuần, tháng, năm.
- **Thống kê lợi nhuận:**
  - Phân tích chi tiết và báo cáo lợi nhuận từ doanh thu khóa học, các chiến dịch marketing, và hoạt động khác.
  - Quyền xem báo cáo chi tiết về doanh thu và lợi nhuận từ việc bán khóa học.

---

## 2.3 KẾ HOẠCH DỰ ÁN

| TT | Công việc | Bắt đầu | Kết thúc | Thành viên | Kết quả |
|:---|:---|:---:|:---:|:---:|:---:|
| **1** | **Phân tích yêu cầu khách hàng** | **08/09/2024** | **15/09/2024** | **Cả nhóm** | **Done** |
| 1.1 | Vẽ sơ đồ tổng quan hệ thống | 08/09/2024 | 10/09/2024 | Cả nhóm | Done |
| 1.2 | Xây dựng đặc tả yêu cầu hệ thống | 10/09/2024 | 11/09/2024 | Cả nhóm | Done |
| 1.3 | Vẽ UseCase | 11/09/2024 | 12/09/2024 | Cả nhóm | Done |
| 1.4 | Mô tả quy trình nghiệp vụ | 12/09/2024 | 13/09/2024 | Cả nhóm | Done |
| **2** | **Thiết kế hệ thống** | **13/09/2024** | **20/09/2024** | **Cả nhóm** | **Done** |
| 2.1 | Phác thảo mô hình công nghệ ứng dụng | 13/09/2024 | 14/09/2024 | Tuấn, Tâm | Done |
| 2.2 | Thiết kế SiteMap | 14/09/2024 | 18/09/2024 | Thảo, Thành | Done |
| 2.3 | Design UI/UX Website | 14/09/2024 | 28/09/2024 | Tuấn, Tâm | Done |
| 2.3.1 | Local Variable (Color, Typography, Box-shadow...) | 14/09/2024 | 16/09/2024 | Tuấn | Done |
| 2.3.2 | Thiết kế các component dùng cho Admin | 16/09/2024 | 18/09/2024 | Tâm | Done |
| 2.3.3 | Thiết kế các component dùng cho Client | 16/09/2024 | 18/09/2024 | Tuấn | Done |
| 2.4.1 | Thiết kế sơ đồ tổ chức Website | 14/09/2024 | 16/09/2024 | Lam, Thuận | Done |
| 2.4.2 | Thiết kế sơ đồ quan hệ thực thể (ERD) | 16/09/2024 | 17/09/2024 | Lam, Tâm, Tuấn, Thuận | Done |
| 2.4.3 | Thiết kế chi tiết sơ đồ thực thể (ERD) | 18/09/2024 | 20/09/2024 | Lam, Tâm | Done |
| 2.5 | Thiết kế User Flow | 14/09/2024 | 16/09/2024 | Thành | Done |
| 2.6 | Lên kịch bản Test | 16/09/2024 | 24/09/2024 | Thành | Done |
| **3** | **Thực hiện dự án** | **24/09/2024** | **10/11/2024** | **Cả nhóm** | **Done** |
| | **Back-end** | **24/09/2024** | **30/10/2024** | | |
| 3.1 | Thiết kế cơ sở dữ liệu | 24/09/2024 | 27/09/2024 | Tâm, Lam | Done |
| 3.2 | Migration | 27/09/2024 | 29/09/2024 | Tâm, Lam | Done |
| 3.3 | Model | 30/09/2024 | 30/09/2024 | Lam | Done |
| 3.4 | Factory / Seeder | 31/09/2024 | 01/10/2024 | Tâm, Lam | Done |
| 3.5 | Viết API, xây dựng controller, resource | 02/10/2024 | 30/10/2024 | Tâm, Lam | Done |
| 3.6 | Deploy Backend, PostgreSQL, Cloud Hosting | 02/10/2024 | 30/10/2024 | Tâm, Lam | Done |
| | **Front-end** | **24/09/2024** | **10/11/2024** | | |
| 4.1 | Thiết kế giao diện Client | 24/09/2024 | 08/10/2024 | Thuận, Tuấn | Done |
| 4.2 | Thiết kế giao diện Admin | 24/09/2024 | 08/10/2024 | Thảo | Done |
| 4.3 | Lập trình Client | 28/09/2024 | 20/10/2024 | Thuận, Tuấn | Done |
| 4.4 | Lập trình Admin | 28/09/2024 | 20/10/2024 | Thuận, Thảo, Thành | Done |
| 4.5 | Lập trình tổng hợp - Admin | 01/11/2024 | 10/11/2024 | Tuấn, Thuận | Done |
| **5** | **Kiểm thử** | **20/10/2024** | **15/11/2024** | **Cả nhóm** | **Done** |
| 5.1 | Thực hiện kiểm thử Client | 20/10/2024 | 10/11/2024 | Thành | Done |
| 5.2 | Thực hiện kiểm thử Admin | 10/11/2024 | 15/11/2024 | Thành | Done |
| 5.3 | Lập trình sửa lỗi | 20/10/2024 | 15/11/2024 | Cả nhóm | Done |
| **6** | **Đóng gói triển khai** | **15/11/2024** | **16/11/2024** | **Tuấn, Tâm** | **Done** |
| 6.1 | Deploy Domain hosting | 15/11/2024 | 16/11/2024 | Tuấn, Tâm | Done |
| 6.2 | Viết tài liệu hướng dẫn sử dụng | 10/11/2024 | 16/11/2024 | Thảo, Tuấn | Done |
