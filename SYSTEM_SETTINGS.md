# Cấu hình hệ thống — SYSTEM_ADMIN

## Sao lưu trước khi sửa

Mã nguồn backend/frontend, test, package/lock và Vite config được sao lưu tại `.backups/system-settings-20261118-224318` (106 file, có `manifest.json` SHA-256). Không sao chép hay đưa nội dung `.env` vào báo cáo.

## Phạm vi

- Chung: tên công ty, tên hệ thống, URL logo HTTP/HTTPS, ngôn ngữ mặc định VI/EN, múi giờ IANA.
- Bảo mật: thời hạn phiên đăng nhập, số lần đăng nhập sai và thời gian khóa, chính sách mật khẩu mới.
- Đính kèm đề xuất: dung lượng và định dạng đã được backend hỗ trợ. Form nhân viên gửi multipart khi có tệp; yêu cầu JSON hiện tại vẫn được hỗ trợ. Đây không phải cấu hình import Excel nhân sự.
- Thông báo: bật/tắt hiển thị thông báo hiện có và gửi email; tên/địa chỉ gửi dùng thật trong EmailService. API key Resend vẫn ở môi trường backend.
- Workflow, role và ngưỡng tài chính: chỉ đọc từ các định nghĩa hiện hành; không có API sửa.

## API và database

- `GET /api/admin/settings`, `PUT /api/admin/settings`: chỉ SYSTEM_ADMIN đang hoạt động. Không chấp nhận trường ngoài danh sách cho phép. PUT yêu cầu revision mới nhất; trả 409 khi cấu hình đã được phiên khác sửa.
- `GET /api/system/settings`: dữ liệu hiển thị công khai có chủ đích gồm tên/logo, ngôn ngữ, múi giờ, chính sách tệp, hướng dẫn mật khẩu và cờ bật thông báo. Không trả khóa, token, giới hạn đăng nhập sai hoặc cấu hình email.
- Collection `systemsettings`: một bản ghi có key duy nhất `system`, revision, người cập nhật và thời gian cập nhật. Khi chưa lưu, GET dùng các giá trị tương thích lấy từ hành vi cũ, không chèn dữ liệu mẫu vào database.
- Lưu cấu hình và `UPDATE_SYSTEM_SETTINGS` audit log trong cùng MongoDB transaction. Nếu ghi audit thất bại, cấu hình cũng rollback. Cần replica set/Atlas như workflow đang có.
- Collection `loginattempts`: chỉ lưu hash định danh email, số lần sai, cửa sổ kiểm tra/khóa và thời điểm tự xóa TTL; không lưu mật khẩu hay email dạng rõ.

## Hành vi tương thích

Trước khi quản trị viên lưu thay đổi, giữ phiên 7 ngày, chưa giới hạn số lần đăng nhập sai, mật khẩu tối thiểu 6 ký tự tại API đăng ký hiện hành, HR vẫn tối thiểu 8 ký tự, tệp tối đa 5 MB với JPG/JPEG/PNG/PDF/DOC/DOCX, thông báo/email bật và địa chỉ gửi cũ. Có thể dùng EMAIL_FROM_NAME/EMAIL_FROM_ADDRESS từ môi trường để cấp giá trị gửi ban đầu.

Mật khẩu cũ vẫn đăng nhập được khi nâng chính sách; chỉ tạo/reset mật khẩu phải theo chính sách mới. Giảm thời hạn phiên có thể khiến token đã cấp cần đăng nhập lại. 0 lần đăng nhập sai nghĩa là chưa giới hạn; khi bật giới hạn, khóa tạm theo email, không đổi role hoặc trạng thái tài khoản. Chính sách không thay thế tường lửa/rate limiting ở hạ tầng.

Backend đọc cấu hình thực khi xác thực, tải tệp hoặc gửi email. Các giao diện lấy cấu hình công khai khi mở trang, khi quay lại tab và mỗi 60 giây. Lựa chọn ngôn ngữ cá nhân được ưu tiên hơn mặc định hệ thống. Cấu hình múi giờ áp dụng cho thời điểm hiển thị và bộ lọc ngày audit; không đổi các ngày nghỉ phép/chấm công dạng ngày lịch đã lưu.

## Giới hạn được nêu rõ

- Logo được nhập bằng URL; chưa có API tải logo riêng. Backend không tự tải URL để tránh SSRF; trình duyệt hiển thị và báo lỗi xem trước nếu ảnh không truy cập được.
- Ngôn ngữ mặc định áp dụng cho các khu vực đã hỗ trợ VI/EN (Employee, HR, System Admin). Manager vẫn có nội dung tiếng Việt hiện hành; không thay toàn bộ màn hình Manager trong thay đổi này.
- Chưa bổ sung kho thông báo trong database. Công tắc điều khiển phần thông báo hiện có và EmailService, không tạo bản ghi thông báo giả.
- Không gửi email thử đến người thật. Domain/địa chỉ gửi phải được Resend xác minh; có API key không đồng nghĩa đã xác minh domain hoặc bảo đảm gửi thành công. Lỗi nhà cung cấp được EmailService báo là thất bại.
- Kiểm tra tệp gồm kích thước, extension, MIME và chữ ký đầu tệp. Không có dịch vụ quét virus toàn bộ nội dung.
- Không đổi phân quyền, workflow, ngưỡng tiền, tài khoản/mật khẩu hoặc dữ liệu đơn hiện tại trong quá trình kiểm thử chức năng cấu hình.

## Kiểm thử

`node --test backend/test/*.test.js frontend/test/*.test.js` kiểm tra các API cũ và mới, quyền các role, validation, lưu/audit/rollback, revision, session JWT, khóa đăng nhập sai, mật khẩu, tệp, tắt email và phản hồi lỗi nhà cung cấp; render cấu hình bằng dữ liệu có cấu trúc đầy đủ cho VI/EN và giao diện tối. Các fixture chỉ nằm trong test, không được dùng làm dữ liệu ứng dụng.

Chạy thêm `npm run build` và `npm run lint` trong frontend; `node --check` cho source backend. Các file workflow, constants/role, route request/auth và model User được so SHA-256 với bản sao lưu để xác nhận không đổi.

Kết quả ngày 18/11/2026: 14 nhóm test đều qua, frontend build thành công; lint không có lỗi nhưng còn cảnh báo hook/Fast Refresh/biến chưa dùng, build cảnh báo bundle lớn. Chưa kiểm thử thao tác trực tiếp bằng trình duyệt; đã render form đầy đủ bằng React server renderer.

## Chọn hoặc thêm múi giờ (19/11/2026)

1. Vào **SYSTEM_ADMIN → Cấu hình hệ thống → Cấu hình chung**.
2. Ở mục **Múi giờ IANA**, mở danh sách để xem các múi giờ. Ô tìm kiếm phía trên lọc theo thành phố/mã, ví dụ `Tokyo`, `New York`, `Europe/`.
3. Nếu mã hợp lệ chưa xuất hiện trong danh sách, nhập đầy đủ vào ô tìm kiếm, ví dụ `Asia/Ho_Chi_Minh`. Mã được trình duyệt xác thực sẽ xuất hiện để chọn trong danh sách bên dưới. Chọn mã đó, bấm **Lưu cấu hình**, rồi xác nhận.
4. Mở lại trang để kiểm tra giá trị đã lưu. API lưu vào `general.timeZone` trong bản cấu hình database hiện có và ghi Audit Log. Không cần sửa `.env` hay chèn thêm bản ghi múi giờ vào database.

Danh sách lấy từ dữ liệu IANA của `Intl.supportedValuesOf('timeZone')`, không phải dữ liệu mẫu. Giữ lại mã đã lưu, múi giờ máy và UTC. Một số bí danh hợp lệ (như `Asia/Ho_Chi_Minh`) không có trong danh sách mà runtime liệt kê nhưng vẫn được chấp nhận khi nhập đầy đủ. Trình duyệt cũ thiếu API liệt kê vẫn chọn được mã đã lưu/UTC và nhập mã IANA khác. Nếu cả trình duyệt hoặc backend từ chối một mã mới, cần cập nhật trình duyệt/Node.js cùng dữ liệu ICU; không bỏ kiểm tra tính hợp lệ.

Bản sao lưu trước thay đổi ô múi giờ: `.backups/timezone-picker-20261119-072608` (có manifest SHA-256). Không đổi API, database, phân quyền hoặc workflow trong thay đổi giao diện này.

Kiểm tra với database thật: GET cấu hình thành công; lưu nguyên các giá trị hiện hành tạo revision 1, đọc lại khớp và có 1 Audit Log `UPDATE_SYSTEM_SETTINGS`. Không thay đổi chính sách đang dùng. Không đăng nhập trả 401, HR trả 403; API danh sách tài khoản quản trị (2 tài khoản) và danh sách đơn vẫn trả 200. Kết quả ở `.backups/system-settings-20261118-224318/live-verification.json`; snapshot cấu hình trước lưu ở cùng thư mục, không chứa token/API key. Việc lưu này tạo bản cấu hình chính thức từ thiết lập cũ, không tạo dữ liệu mẫu.
