# Ghi chú về Git cho dự án Schoolify

## Vấn đề hiện tại
- Phần mềm Git trên máy tính này (`~/.local/bin/git`) **không hỗ trợ giao thức HTTPS** (bị lỗi `git-remote-https`).
- Do đó, mọi lệnh như `git clone https://...`, `git push` hay `git pull` qua các đường dẫn `https://` đều sẽ **thất bại** dù có gắn Personal Access Token (PAT) hợp lệ.

## Giải pháp: Luôn sử dụng SSH
Để push/pull code trên máy này, ta bắt buộc phải sử dụng giao thức **SSH**.
Thư mục `FE` hiện tại đã được cấu hình sẵn remote URL để trỏ tới `git@github.com:Kimthinh175/schoolify_FE.git`.

### Hướng dẫn thiết lập SSH cho GitHub (Dành cho User)
Máy tính này **đã có sẵn** khóa SSH ở mục `~/.ssh/id_ed25519`. Bạn chỉ cần làm theo các bước sau 1 lần duy nhất:

1. Copy toàn bộ nội dung của khóa Public Key dưới đây:
   ```text
   ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICPTDTQpDZzgX986fPuQzPX+WsyMD31wWFZOI5k+LBJ3 thinh@thinh-Default-string
   ```
2. Truy cập vào trang cài đặt SSH của GitHub: https://github.com/settings/ssh/new
3. Ở ô **Title**, bạn nhập tên tùy ý (ví dụ: `Ubuntu Work Machine`).
4. Dán nội dung vừa copy vào ô **Key** và bấm **Add SSH key**.

Sau khi add xong, bạn vào Terminal và chạy lệnh sau để kiểm tra:
```bash
ssh -T git@github.com
```
(Nếu nó hỏi `Are you sure you want to continue connecting (yes/no/[fingerprint])?`, hãy gõ `yes` và Enter).
Khi hiện thông báo `Hi Kimthinh175! You've successfully authenticated...` là bạn đã có thể `git push` hay `git pull` bình thường!

---

**@antigravity (Ghi chú cho Agent):** 
- KHÔNG sử dụng HTTPS cho Git trên máy này. 
- Mặc định sử dụng URL dạng `git@github.com:username/repo.git`.
- Nếu có tác vụ clone, phải dùng SSH. Nếu user chưa kết nối SSH, hãy báo lỗi và hướng dẫn user copy khóa pub key vào tài khoản Github.
