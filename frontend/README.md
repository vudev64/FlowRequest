# FlowRequest

FlowRequest giúp nhân viên gửi đề xuất và theo dõi đơn từ lúc tạo đến khi có quyết định. Người duyệt thấy các đơn thuộc thẩm quyền của mình. Với đơn mua sắm, kế toán còn có thể theo dõi ngân sách, ghi nhận số tiền thực trả và tra lại chứng từ.

Bản Demo có trang đăng nhập nhanh tại `/dang-nhap-demo`. Để thử một quy trình, hãy dùng tài khoản Nhân viên tạo đơn, chuyển sang Quản lý để duyệt rồi quay lại tài khoản Nhân viên để xem trạng thái và lịch sử. Các thao tác trên Demo được lưu vào database của Demo.

## Sáu vai trò

| Vai trò | Công việc trong FlowRequest |
| --- | --- |
| Nhân viên (`EMPLOYEE`) | Lưu nháp, gửi đơn, đính kèm tài liệu và xem kết quả xử lý đơn của mình. |
| Quản lý (`MANAGER`) | Xem chi tiết, duyệt hoặc từ chối đơn được giao. Quản lý cũng có thể gửi đề xuất của mình lên Giám đốc. |
| Nhân sự (`HR_ADMIN`) | Xử lý đơn nghiệp vụ nhân sự, xem lịch sử duyệt, quản lý nhân viên và cấp tài khoản Nhân viên, Quản lý, Kế toán. |
| Kế toán (`ACCOUNTANT`) | Duyệt bước tài chính, quản lý ngân sách phòng ban, gửi yêu cầu bổ sung ngân sách và ghi nhận thanh toán kèm chứng từ. |
| Giám đốc (`DIRECTOR`) | Duyệt đơn ở bước Giám đốc, quyết định yêu cầu tăng ngân sách, xem báo cáo và so sánh giá trị mua sắm theo tháng. |
| Quản trị hệ thống (`SYSTEM_ADMIN`) | Cấp tài khoản Nhân sự và Giám đốc, quản lý cấu hình hệ thống, chính sách đăng nhập, tệp đính kèm và xem nhật ký thao tác. |

## Đơn đi qua những ai?

Bảng dưới mô tả luồng thông thường khi Nhân viên gửi đơn và từng người duyệt đồng ý. Nếu đơn bị từ chối, quy trình dừng tại bước đó. Với đơn do Quản lý tạo, Giám đốc duyệt bước đầu.

| Loại đơn | Thứ tự duyệt |
| --- | --- |
| Nghỉ phép, tăng ca, điều chỉnh chấm công, tuyển dụng | Quản lý → Nhân sự |
| Làm việc từ xa | Quản lý |
| Công tác | Quản lý. Nếu có chi phí, đơn chuyển tiếp sang Kế toán. |
| Đào tạo | Quản lý → Nhân sự. Nếu có chi phí, đơn chuyển tiếp sang Kế toán. |
| Mua sắm dưới 50 triệu đồng | Quản lý → Kế toán |
| Mua sắm từ 50 triệu đồng trở lên | Quản lý → Giám đốc → Kế toán |

**Duyệt mua sắm và thanh toán là hai thời điểm riêng.** Khi một đơn mua sắm có chi phí được duyệt ở bước cuối, hệ thống kiểm tra phần ngân sách còn lại và ghi nhận khoản cam kết của phòng ban. Khi thực trả, Kế toán nhập số tiền, ngày trả và chứng từ. Một đơn có thể được trả nhiều lần trong phạm vi số tiền đã duyệt. Ví dụ, đơn đã duyệt 60 triệu và đã trả 20 triệu sẽ còn phải trả 40 triệu. Việc ghi nhận 20 triệu này không trừ ngân sách lần thứ hai.

Khi cần tăng hạn mức phòng ban, Kế toán gửi yêu cầu bổ sung. Ngân sách chỉ tăng sau khi Giám đốc duyệt. [Quy tắc duyệt trong Backend](../backend/src/config/workflow.js)

## Kiến trúc và công nghệ

Trình duyệt chạy giao diện **React** và dùng **React Router** để chuyển giữa các trang. **Vite** phục vụ giao diện khi phát triển và tạo bản build. Giao diện gọi API của **Node.js/Express**. Backend kiểm tra người dùng, xử lý nghiệp vụ và dùng **Mongoose** để làm việc với **MongoDB**. Phần GridFS dùng driver MongoDB để đọc và ghi tệp.

| Thư mục | Nội dung |
| --- | --- |
| [frontend/src](./src) | Trang giới thiệu, đăng nhập, sáu khu vực làm việc và mã gọi API. |
| [backend/src](../backend/src) | Route API, phân quyền, xử lý đơn, ngân sách, thanh toán và mô hình dữ liệu. |
| [frontend/test](./test) và [backend/test](../backend/test) | Kiểm thử giao diện, API, phân quyền và giao dịch MongoDB. |
| [deploy/demo](../deploy/demo) | Hướng dẫn triển khai, cấu hình tham khảo và danh sách kiểm tra sau khi đưa Demo lên mạng. |

### Bảo mật và chứng từ

- Backend băm mật khẩu bằng bcrypt, xác thực phiên bằng JWT và kiểm tra quyền trên từng API. Khi tải chứng từ, Backend cũng kiểm tra người dùng có quyền xem đơn liên quan. Các thao tác như duyệt đơn, ghi nhận thanh toán và đổi cấu hình được ghi vào nhật ký.
- Backend nhận tệp bằng Multer, kiểm tra dung lượng, đuôi tệp, kiểu MIME và phần đầu nội dung. Ở chế độ mặc định `local`, tệp đính kèm nằm trong `uploads/`, chứng từ thanh toán nằm trong `private-vouchers/` dưới thư mục lưu trữ của Backend.
- Với `DEMO_STORAGE_DRIVER=gridfs`, Backend lưu tệp mới thành các phần nhỏ trong MongoDB. Mỗi tệp chịu mức thấp hơn giữa chính sách hệ thống và **2 MiB**. Kho Demo có ngân sách **100 MiB** tính cả phần dự phòng và cho phép tối đa **4 lượt ghi đang xử lý** trong cùng database.
- Chứng từ thanh toán có mã kiểm tra **SHA-256**. Backend dùng khóa chống ghi trùng khi gửi lại yêu cầu và dùng transaction để cập nhật khoản đã trả, sổ thanh toán và audit cùng nhau. Khi bật GridFS, tệp Local cũ vẫn cần bản gốc hoặc bản sao GridFS đã được đối chiếu và liên kết theo đường dẫn cũ. Đổi cấu hình không tự di chuyển dữ liệu. [Cơ chế lưu tệp](../backend/src/services/DocumentStorage.js)

## Chạy Demo trên máy

Chuẩn bị **Node.js 22.21**, npm và một database MongoDB Demo có hỗ trợ transaction (Atlas hoặc replica set). Đăng nhập nhanh sử dụng sáu tài khoản đã có trong database Demo. Khởi động với một database trống sẽ không tự tạo sáu tài khoản này.

**1. Cấu hình Backend.** Dùng `backend/.env.demo`, hoặc `backend/.env` nếu chưa có `.env.demo`. Nếu máy đã chạy được Demo, giữ cấu hình đang dùng.

| Biến | Giá trị cần chuẩn bị |
| --- | --- |
| `DEMO_MONGO_URI`, `DEMO_DB_NAME` | Chuỗi kết nối và tên database Demo. Dùng tài khoản MongoDB có quyền giới hạn trong database này. |
| `DEMO_JWT_SECRET` | Khóa ngẫu nhiên riêng cho Demo, tối thiểu 32 byte. |
| `DEMO_STORAGE_DRIVER`, `DEMO_STORAGE_ROOT` | Trên máy có thể dùng mặc định `local`. Khai báo thư mục gốc nếu tệp hiện được lưu ở vị trí riêng. |

**2. Mở terminal ở thư mục gốc** và chạy Backend.

```sh
cd backend
npm ci
npm run dev
```

**3. Mở terminal thứ hai ở thư mục gốc.** Nếu chưa có `frontend/.env.local`, dùng [mẫu cấu hình frontend Demo](./.env.demo.example). Mẫu chọn chế độ Demo, tắt giao diện Production và chuyển các yêu cầu `/demo-api` tới Backend local.

```sh
cd frontend
npm ci
npm run dev:demo
```

Mở [FlowRequest trên máy](http://localhost:3000) hoặc [trang đăng nhập nhanh](http://localhost:3000/dang-nhap-demo). Backend mặc định dùng cổng 5000. Đường dẫn [kiểm tra kết nối database](http://localhost:5000/health/ready) trả HTTP 200 khi MongoDB đã kết nối.

**Demo, Test và Production dùng cấu hình riêng.** Nếu sau này vận hành Production, cần chuẩn bị database, tài khoản MongoDB, khóa JWT và thư mục lưu trữ riêng. Backend có lệnh `npm run bootstrap:production` để khởi tạo System Admin đầu tiên bằng thông tin quản trị và file mật khẩu riêng. Khi chạy Demo, chỉ cần các bước trên. Giữ URI, khóa ký và mật khẩu ở phía Backend. Các biến `VITE_*` được đưa vào bản build và trình duyệt có thể đọc được.

## Kiểm thử

| Chạy trong | Lệnh | Mục đích |
| --- | --- | --- |
| `frontend/` | `npm run lint`, `node --test test/*.test.js`, `npm run build:demo` | Kiểm tra mã giao diện, hành vi các trang và khả năng tạo bản build trong `dist/`. |
| `backend/` | `npm test` | Chạy các bài kiểm thử Backend. Bài tích hợp MongoDB có thể được bỏ qua khi chưa có cấu hình Test. |
| `backend/` | `npm run test:mongo:safety` rồi `npm run test:mongo` | Kiểm tra điều kiện an toàn, sau đó chạy API với MongoDB thật để kiểm tra duyệt đơn, ngân sách, thanh toán, quyền tải tệp và rollback. |

Trước khi chạy bài có ghi MongoDB, chuẩn bị `backend/.env.test` với `FINANCE_TEST_URI`, `FINANCE_TEST_DB_NAME` và `FINANCE_TEST_STORAGE_ROOT`. Dùng database `flowrequest_test` để chạy cả nhóm GridFS, với user và thư mục tệp dành riêng cho Test. Bộ kiểm thử xác minh quyền, đánh dấu dữ liệu theo lượt chạy và chỉ dọn dữ liệu của lượt đó. [Hướng dẫn kiểm thử MongoDB](../backend/test/README.md)

## Triển khai bản Demo

1. **Render — Backend.** Chọn Web Service Free, thư mục `backend`, lệnh build `npm ci --omit=dev` và lệnh chạy `npm run start:demo`. Đặt `FLOWREQUEST_ENV=demo`, `NODE_ENV=production`, cấu hình MongoDB và JWT trong phần biến môi trường của dịch vụ. Cấu hình này chạy **bản Demo** với các kiểm tra dành cho hosting công khai.
2. **Atlas và tệp.** Cho phép kết nối từ các IP đi ra của dịch vụ Render đến Atlas. Chọn `DEMO_STORAGE_DRIVER=gridfs` và dùng `DEMO_STORAGE_ROOT` mà Backend có quyền ghi tệp tạm. Ổ đĩa của Render Free có thể mất tệp sau khi dịch vụ ngủ hoặc khởi động lại. Mẫu Render trong `deploy/demo` sử dụng gói Starter kèm ổ đĩa riêng. [Giới hạn Render Free](https://render.com/docs/free)
3. **Vercel — Frontend.** Chọn thư mục `frontend`, lệnh build `npm run build:demo` và thư mục kết quả `dist`. Đặt `VITE_APP_ENV=demo`, `VITE_ENABLE_PRODUCTION=false` và `VITE_DEMO_API_URL` bằng địa chỉ HTTPS của Backend, kết thúc bằng `/api`. Quy tắc trong [vercel.json](./vercel.json) cho phép mở trực tiếp hoặc tải lại trang của từng vai trò.
4. **Kiểm tra hai dịch vụ.** Đặt `DEMO_ALLOWED_ORIGINS` trên Render bằng đúng origin HTTPS của frontend Vercel. Kiểm tra `/health/ready` trên Backend, đăng nhập trên giao diện, mở lại một trang con và thử tải chứng từ bằng tài khoản có quyền. Nếu cần xác minh thao tác ghi, dùng dữ liệu kiểm thử đã được cho phép.
