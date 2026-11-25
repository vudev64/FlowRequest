# HR Admin

Đăng nhập với tài khoản HR_ADMIN, truy cập `/hr`.

Thanh trên cùng của HR_ADMIN và System Admin có nút VI/EN và biểu tượng mặt trời/mặt trăng. Hai khu vực dùng chung lựa chọn ngôn ngữ và sáng/tối, lưu trong trình duyệt tại `flowrequest_admin_preferences`. Chỉ dịch nhãn giao diện; tên, phòng ban và nội dung đơn được giữ nguyên.

- `/hr/users`: đọc nhân sự từ MongoDB; tạo/sửa tài khoản EMPLOYEE, MANAGER, ACCOUNTANT; gán quản lý; khóa/mở tài khoản thường.
- `/hr/approvals`: tìm kiếm, lọc, phân trang, xem chi tiết/lịch sử và duyệt hoặc từ chối đơn đang chờ HR. Chặn tự duyệt; đào tạo có chi phí chuyển kế toán theo workflow hiện hành.
- `/hr/history`: các đơn đã có quyết định của HR, kể cả đơn đang chuyển sang kế toán.
- `/hr/permissions`: mô tả quyền thật, không chạy mô phỏng lỗi API.

API nhân sự: `GET/POST /api/hr/users`, `PATCH /api/hr/users/:id`; yêu cầu Bearer JWT của HR_ADMIN. Không trả mật khẩu. Các thay đổi được ghi audit. Không sửa vai trò bảo vệ, khóa quản lý còn cấp dưới hoặc người còn đơn chờ xử lý. Trạng thái INACTIVE chặn cả đăng nhập mới và sử dụng token đã cấp. Tài liệu đính kèm tải qua `GET /api/hr/requests/:id/attachment`, kiểm tra vai trò, loại đơn, bản nháp và đường dẫn file trước khi trả dữ liệu.

Import hỗ trợ `.xlsx` và `.csv`, tối đa 5 MB/500 dòng, sheet đầu tiên. Cột bắt buộc: `Fullname`, `Email`, `Password`, `Role`, `Department`. Cột tùy chọn: `Title`, `ManagerEmail`. Mật khẩu ít nhất 8 ký tự; quản lý phải có sẵn trong hệ thống. Kiểm tra trước khi nhập; từng dòng được lưu độc lập và hiển thị kết quả. Dòng thành công được loại khỏi danh sách thử lại. Mật khẩu không hiển thị trong kết quả import.

Cấu hình backend như hiện tại: MONGO_URI, JWT_SECRET, PORT, RESEND_API_KEY cho email. Frontend dùng VITE_API_URL (mặc định http://localhost:5000/api). Khởi động lại backend sau cập nhật schema/router. Luồng duyệt hiện có sử dụng MongoDB transaction, cần replica set hoặc MongoDB Atlas.

Kiểm tra: `npm run test:hr` trong backend; `npm run build` và `npm run lint` trong frontend. Bộ test HR dùng HTTP cục bộ với model giả lập, không thay đổi database thực tế.
