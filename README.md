# FlowRequest

FlowRequest giúp doanh nghiệp xử lý các đề xuất nội bộ. Nhân viên gửi đơn và theo dõi kết quả, người có thẩm quyền xét duyệt, còn kế toán theo dõi ngân sách và các khoản thực trả. Mỗi đơn có lịch sử xử lý để người dùng biết ai đã duyệt và đơn đang ở bước nào.

**Bản Demo trên máy** có trang đăng nhập nhanh cho sáu vai trò. Một cách trải nghiệm là dùng tài khoản Nhân viên gửi đơn nghỉ phép, lần lượt vào vai Quản lý và Nhân sự để duyệt, rồi quay lại tài khoản Nhân viên xem kết quả. **Bản Demo công khai** trên Vercel, Render và MongoDB Atlas đang ở bước chuẩn bị. Việc bảo toàn chứng từ cũ và kiểm tra trên tên miền thật là các bước cần hoàn tất trước khi công bố.

## Sáu vai trò và chức năng chính

| Vai trò | Có thể làm gì? |
| --- | --- |
| Nhân viên (`EMPLOYEE`) | Lưu nháp, gửi đơn, đính kèm tài liệu và xem trạng thái, lịch sử đơn của mình. |
| Quản lý (`MANAGER`) | Xét duyệt đơn được giao hoặc gửi đề xuất của mình lên Giám đốc. |
| Nhân sự (`HR_ADMIN`) | Xử lý các đơn nhân sự, quản lý hồ sơ và cấp tài khoản Nhân viên, Quản lý, Kế toán. |
| Kế toán (`ACCOUNTANT`) | Duyệt bước tài chính, theo dõi ngân sách phòng ban, yêu cầu tăng hạn mức và ghi nhận thanh toán kèm chứng từ. |
| Giám đốc (`DIRECTOR`) | Duyệt đơn thuộc thẩm quyền, quyết định yêu cầu tăng ngân sách và xem biểu đồ so sánh giá trị mua sắm theo tháng. |
| Quản trị hệ thống (`SYSTEM_ADMIN`) | Cấp tài khoản Nhân sự và Giám đốc, quản lý cấu hình hệ thống, chính sách bảo mật, tệp đính kèm và xem nhật ký. |

## Quy trình phê duyệt

Với đơn do Nhân viên gửi, loại đơn và chi phí quyết định các bước tiếp theo. Khi một người duyệt từ chối, đơn dừng ở bước đó. Với đề xuất do Quản lý tạo, Giám đốc xét duyệt bước đầu. [Quy tắc duyệt trong mã nguồn](backend/src/config/workflow.js)

| Loại đơn của Nhân viên | Thứ tự xét duyệt |
| --- | --- |
| Nghỉ phép, tăng ca, điều chỉnh chấm công, tuyển dụng | Quản lý → Nhân sự |
| Làm việc từ xa | Quản lý |
| Công tác | Quản lý → Kế toán nếu có chi phí |
| Đào tạo | Quản lý → Nhân sự → Kế toán nếu có chi phí |
| Mua sắm dưới 50 triệu đồng | Quản lý → Kế toán |
| Mua sắm từ 50 triệu đồng trở lên | Quản lý → Giám đốc → Kế toán |

**Ngân sách và thanh toán được theo dõi riêng.** Khi duyệt mua sắm ở bước cuối, hệ thống kiểm tra ngân sách còn lại và ghi nhận số tiền cam kết. Sau đó, Kế toán có thể ghi nhận một hoặc nhiều lần thanh toán. Mỗi lần lưu số tiền, ngày trả, người thực hiện và chứng từ. Tổng tiền trả được giới hạn trong số đã duyệt, và việc trả tiền không trừ ngân sách lần thứ hai. Nếu cần tăng hạn mức, Kế toán gửi yêu cầu và ngân sách chỉ tăng khi Giám đốc đồng ý.

## Kiến trúc và bảo mật

| Thành phần | Trách nhiệm |
| --- | --- |
| [Giao diện](frontend/src) | React và React Router hiển thị trang giới thiệu, đăng nhập và khu vực làm việc của từng vai trò. Vite chạy giao diện trên máy và tạo bản đóng gói để triển khai. |
| [Máy chủ](backend/src) | Node.js và Express cung cấp API. Máy chủ xác thực người dùng, kiểm tra quyền trên đơn, quyết định bước duyệt và xử lý ngân sách, thanh toán. |
| MongoDB | Mongoose quản lý tài khoản, đơn, ngân sách, thanh toán và lịch sử. Các thay đổi tài chính liên quan được ghi trong cùng một giao dịch để tránh cập nhật dở dang. |

Máy chủ băm mật khẩu bằng bcrypt và xác thực phiên bằng JWT. Người dùng phải có quyền xem đơn mới tải được tài liệu liên quan qua API. Cấu hình kết nối và khóa ký chỉ đặt ở máy chủ. Các biến bắt đầu bằng `VITE_` có thể đọc được từ trình duyệt.

### Lưu tệp và chứng từ bằng GridFS

Mặc định, bản chạy trên máy lưu tệp trên ổ đĩa. Khi chọn `DEMO_STORAGE_DRIVER=gridfs`, máy chủ chia tệp mới thành các phần nhỏ và lưu trong MongoDB. Giới hạn mỗi tệp là mức thấp hơn giữa chính sách hệ thống và **2 MiB**. Kho Demo giới hạn **100 MiB** tính cả dung lượng dự phòng và cho phép tối đa **4 lượt ghi đồng thời**. Chứng từ thanh toán có mã SHA-256 để đối chiếu nội dung, còn mỗi yêu cầu ghi thanh toán có khóa chống ghi trùng.

Bật GridFS chỉ đổi nơi lưu tệp mới. Với chứng từ cũ trên ổ đĩa, cần giữ bản gốc cho đến khi bản sao trong GridFS đã được đối chiếu SHA-256 và có thể tải qua đơn cũ. [Cơ chế lưu và đọc chứng từ](backend/src/services/DocumentStorage.js)

## Chạy bản Demo trên máy

Chuẩn bị Node.js 22.21, npm và MongoDB hỗ trợ giao dịch (Atlas hoặc cụm bản sao). Đăng nhập nhanh cần sáu tài khoản đã có trong cơ sở dữ liệu Demo. Khởi động máy chủ với cơ sở dữ liệu trống sẽ không tự tạo các tài khoản này.

1. **Cấu hình.** Máy chủ đọc `backend/.env.demo`, hoặc `backend/.env` nếu chưa có tệp riêng cho Demo. Khai báo kết nối, tên cơ sở dữ liệu và khóa ký riêng qua `DEMO_MONGO_URI`, `DEMO_DB_NAME` và `DEMO_JWT_SECRET` (ít nhất 32 byte ngẫu nhiên). Nếu chưa có cấu hình giao diện, sao chép [tệp mẫu Demo](frontend/.env.demo.example) thành `frontend/.env.local`.
2. **Chạy máy chủ.** Từ thư mục gốc, mở cửa sổ lệnh thứ nhất và chạy:

   ```sh
   cd backend
   npm ci
   npm run dev
   ```

3. **Chạy giao diện.** Mở cửa sổ lệnh thứ hai ở thư mục gốc và chạy:

   ```sh
   cd frontend
   npm ci
   npm run dev:demo
   ```

Mở [trang đăng nhập Demo](http://localhost:3000/dang-nhap-demo). Để kiểm tra kết nối cơ sở dữ liệu, mở [trang trạng thái máy chủ](http://localhost:5000/health/ready).

## Kiểm thử

| Thư mục | Lệnh | Phạm vi |
| --- | --- | --- |
| `frontend/` | `npm run lint`, `node --test test/*.test.js`, `npm run build:demo` | Kiểm tra mã giao diện, các hành vi có bài kiểm thử và khả năng đóng gói. |
| `backend/` | `npm test` | Kiểm tra API, phân quyền và quy tắc nghiệp vụ. Bài tích hợp MongoDB có thể được bỏ qua nếu thiếu cấu hình Test. |
| `backend/` | `npm run test:mongo:safety`, sau đó `npm run test:mongo` | Kiểm tra điều kiện an toàn và chạy các tình huống duyệt đơn, thanh toán, lưu tệp, hoàn tác khi có lỗi trên MongoDB riêng. |

Để chạy các bài có ghi dữ liệu, dùng `flowrequest_test` với tài khoản MongoDB và thư mục tệp riêng trong `backend/.env.test`. Bộ kiểm thử đánh dấu dữ liệu theo từng lượt chạy và dọn dữ liệu do lượt đó tạo. [Hướng dẫn chuẩn bị môi trường kiểm thử](backend/test/README.md)

## Triển khai bản Demo công khai

1. **MongoDB Atlas.** Dùng tài khoản cơ sở dữ liệu chỉ có quyền đọc và ghi trong cơ sở dữ liệu Demo. Cho phép máy chủ Render kết nối đến Atlas.
2. **Render cho máy chủ.** Chọn thư mục `backend`, cài bằng `npm ci --omit=dev` và chạy `npm run start:demo`. Đặt `FLOWREQUEST_ENV=demo`, `NODE_ENV=production`, cấu hình kết nối và khóa ký ở Render. Chọn GridFS cho tệp mới và dành thư mục có quyền ghi cho tệp tạm.
3. **Vercel cho giao diện.** Chọn thư mục `frontend`, lệnh `npm run build:demo` và thư mục kết quả `dist`. Đặt `VITE_APP_ENV=demo`, `VITE_ENABLE_PRODUCTION=false` và `VITE_DEMO_API_URL` là địa chỉ HTTPS của máy chủ, kết thúc bằng `/api`. Trên Render, đặt `DEMO_ALLOWED_ORIGINS` bằng địa chỉ HTTPS của giao diện, chỉ gồm giao thức và tên miền.
4. **Kiểm tra trước khi chia sẻ.** Xác nhận máy chủ kết nối MongoDB, đăng nhập được cả sáu vai trò, mở lại được đường dẫn con và tải được chứng từ bằng tài khoản có quyền sau khi máy chủ khởi động lại. [Danh sách kiểm tra trên môi trường công khai](deploy/demo/ONLINE_CHECKLIST.txt)
