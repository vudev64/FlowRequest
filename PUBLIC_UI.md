# Giao diện Public — FlowRequest

Thiết kế lại ngày 19/11/2026 trong repository hiện có, chỉ thay đổi trang giới thiệu tại `/` và `/landing`. Không xuất bản lên dịch vụ hosting khác.

## Thay đổi

- Nền trắng, chữ navy và màu indigo `#5865d8` theo hệ thống; giữ font Inter. Giảm màu trang trí, bóng đổ và hiệu ứng chuyển động.
- Header gọn với đăng nhập/demo, menu cho tablet và điện thoại. Có hỗ trợ bàn phím, Escape đóng menu và liên kết bỏ qua điều hướng.
- Phần đầu giải thích mục đích hệ thống, kèm sơ đồ được ghi rõ là minh họa quy trình nghỉ phép; không dùng số liệu hay danh sách đơn giả.
- Các loại đơn trình bày dạng danh sách; vai trò trình bày theo hàng; nội dung quy trình, kiểm soát truy cập và hướng dẫn trải nghiệm có bố cục riêng, hạn chế lặp thẻ.
- Logo và tên hệ thống tiếp tục lấy từ SystemConfiguration. Giữ các đường dẫn `/login`, `/dang-nhap-demo`, các mục neo và liên kết GitHub hiện có (chuyển xuống footer).
- Chỉnh nội dung giới thiệu chưa đúng với code: bỏ mô tả Supabase/RLS, kích hoạt bằng thư mời và tự reset demo hằng ngày. Không sửa chức năng demo hoặc đăng nhập.
- Gom CSS Public vào một bộ quy tắc thay cho các lớp sáng/tối chồng lặp. Gỡ giới hạn chiều rộng tối thiểu cho riêng trang Public để màn hình 320 px không bị cuộn ngang; các trang nghiệp vụ giữ cách hiển thị hiện tại.

Chỉ sửa 9 file giao diện: `features/pages/LandingPage.jsx`, `LandingPage.css` và 7 component trong `components/landing`. Không sửa backend, API, database, authService, App/routes, phân quyền, workflow, cấu hình môi trường hoặc thêm dependency.

## Sao lưu

`.backups/public-redesign-20261119-080635` chứa 9 file gốc và `manifest.json` SHA-256. Khôi phục bằng cách chép các file trong backup về đúng đường dẫn tương ứng; không cần khôi phục database.

## Kiểm tra

- Build frontend thành công. Vẫn có cảnh báo bundle lớn hơn 500 kB đã tồn tại trước thay đổi này.
- 7 nhóm test frontend hiện có đều qua, gồm render admin, phản hồi API, phân quyền HR, cấu hình và múi giờ.
- Lint exit 0; còn cảnh báo trong các file hiện có ngoài phạm vi Public, không có cảnh báo tại các file Public đã sửa.
- Chrome headless thực: kiểm tra 13 chiều rộng 320, 360, 375, 390, 600, 601, 768, 850, 851, 900, 1024, 1280, 1440 px; không tràn ngang kể cả phần chiều rộng bị scrollbar chiếm chỗ.
- Kiểm tra menu mở/đóng, Escape và trả focus, neo điều hướng và vị trí dưới sticky header; `/login`, `/dang-nhap-demo`, chuyển thông tin tài khoản demo sang form đăng nhập; `/landing` vẫn hoạt động.
- API cấu hình thực trả 200 trong lượt kiểm tra; chặn API ở lượt riêng vẫn hiển thị trang Public. Không gửi API ghi dữ liệu hoặc thực hiện đăng nhập trong quá trình thử giao diện. Không phát hiện JavaScript runtime exception.
- Đã xem ảnh desktop/mobile. Ảnh và kết quả máy đọc được ở thư mục backup: `desktop.png`, `desktop-full.png`, `mobile.png`, `mobile-full.png`, `browser-verification.json`, `viewport-results.json`.

Giới hạn kiểm thử: kiểm tra trình duyệt tự động bằng Chrome, chưa thử trực tiếp Safari/iOS hoặc Firefox. Luồng nghiệp vụ đăng nhập, duyệt đơn và trang demo hiện có được giữ nguyên; các hạn chế sẵn có của chúng không được mở rộng xử lý trong thay đổi UI này.
