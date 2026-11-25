# System Admin

Danh sách tài khoản và nhật ký lấy từ MongoDB qua API chỉ dành cho `SYSTEM_ADMIN`:

- `GET /api/admin/accounts`: tài khoản DIRECTOR, HR_ADMIN, SYSTEM_ADMIN; trạng thái, dấu tài khoản hiện tại và phòng ban thực tế. Tài khoản cũ chưa có status được xem là ACTIVE.
- `POST /api/admin/accounts`: tạo tài khoản quản trị; mật khẩu ngẫu nhiên chỉ trả trong phản hồi tạo thành công, chỉ lưu bản băm trong DB.
- `POST /api/admin/accounts/:id/reset-password`: thay mật khẩu, tăng tokenVersion để thu hồi các token cũ. Không ghi mật khẩu vào audit.
- `PATCH /api/admin/accounts/:id/status`: khóa/mở; không tự khóa, không để mất System Admin cuối cùng, không khóa người còn cấp dưới hoặc đơn đang chờ. Dùng MongoDB transaction như workflow hiện tại; cần replica set/Atlas.
- `GET /api/admin/logs`: lọc hành động, kết quả, ngày và từ khóa; phân trang 20 dòng; thông tin trước/sau được lọc bỏ password/token/secret. Nhật ký cũ không có result được tính là thao tác thành công; không tạo bản ghi thất bại giả. Bộ lọc ngày dùng múi giờ +07:00.

Phòng ban gồm bản ghi Department và tên phòng ban đang dùng trên User để tương thích dữ liệu cũ. Không tạo phòng ban mẫu. Chỉ số tài khoản bị khóa thay cho thông báo 2FA chưa được triển khai.

Kiểm thử: `npm run test:admin` trong backend. Test dùng HTTP cục bộ và model giả lập, không thay đổi tài khoản hay mật khẩu thật.
