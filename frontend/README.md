# FlowRequest — Demo và Production

Hai môi trường dùng chung code, 6 role và workflow. Chúng chạy bằng hai tiến trình Backend và cấu hình độc lập. Không có thao tác reset, xóa, sao chép database hoặc seed tài khoản mẫu khi khởi động Production.

## Trạng thái hiện tại: chỉ sử dụng Demo

Production đang tạm dừng: `backend/.env.production` có `PRODUCTION_ENABLED=false`, `frontend/.env.local` có `VITE_ENABLE_PRODUCTION=false` và `VITE_APP_ENV=demo`. Các URI, JWT, storage, thông tin bootstrap đã cấu hình được giữ lại. Không xóa database, tài khoản, dữ liệu hoặc file mật khẩu.

- Backend: `npm start` hoặc `npm run dev` khởi chạy Demo; Production start/bootstrap bị chặn trước khi kết nối MongoDB.
- Frontend: `npm run dev`, `npm run build`, `npm run preview` mặc định dùng Demo. `/login` và các workspace dùng API, token Demo; `/dang-nhap-demo` vẫn có đủ 6 tài khoản. Không có nút đăng nhập thực tế hoặc proxy sang Production.
- Các file `.env.production.example` được giữ làm mẫu. Chỉ khi chủ động triển khai lại mới đổi `PRODUCTION_ENABLED=true`, `VITE_ENABLE_PRODUCTION=true`, bỏ override `VITE_APP_ENV=demo` trong `.env.local`, rồi chạy các lệnh Production riêng sau khi kiểm tra cấu hình.

Các mục dưới mô tả khả năng triển khai hai môi trường khi Production được bật lại.

## 1. Giữ Demo hiện tại

Trong `backend`, `npm run start:demo` vẫn đọc `.env` hiện tại nếu chưa có `.env.demo`. Sáu tài khoản mẫu, mật khẩu, database và đường dẫn `uploads`/`private-vouchers` cũ được giữ nguyên. Không chép mẫu `.env.demo.example` rỗng đè lên cấu hình đang hoạt động.

Trong `frontend`:

```sh
npm run dev:demo
npm run build:demo
```

`npm run build` và `npm run build:demo` xuất Demo vào `frontend/dist`. Khi Production được bật lại, `npm run build:production` xuất vào `frontend/dist-production`.

Trang `/login` mặc định đăng nhập thực tế. Nút **Trải nghiệm Demo** mở `/demo/dang-nhap-demo`, nơi duy nhất hiển thị 6 tài khoản mẫu. Toàn bộ workspace Demo nằm dưới `/demo/*`; nút **Quay lại đăng nhập thực tế** tải lại `/login`. Mỗi lần chuyển tải lại ứng dụng để chọn lại API và phiên đăng nhập, không dùng token của môi trường còn lại.

## 2. Chuẩn bị Production

1. Cấp một database user MongoDB riêng, chỉ có quyền đọc/ghi database Production; không dùng `readWriteAnyDatabase` hoặc tài khoản quản trị cluster. Nếu dùng chung cluster, user Production phải khác user Demo. Cấu hình quyền phải được xác nhận tại Atlas hoặc máy chủ MongoDB; code không thay thế được quyền hạ tầng.
2. Dùng một database Production mới, rỗng, trên MongoDB replica set/Atlas có hỗ trợ transaction. Không clone database Demo. Production từ chối bootstrap vào database đã có dữ liệu chưa được định danh Production.
3. Sao chép `backend/.env.production.example` thành `backend/.env.production` và điền các giá trị thật. File này bị Git bỏ qua. Backend Production không đọc dự phòng từ `.env` Demo.
4. Chọn khóa `PRODUCTION_JWT_SECRET` ngẫu nhiên ít nhất 32 byte, khác Demo. Có thể tạo một khóa mới bằng `node -e "process.stdout.write(require('node:crypto').randomBytes(48).toString('base64url'))"`; chuyển đầu ra vào secret manager, không commit hoặc gửi qua chat.
5. `PRODUCTION_STORAGE_ROOT` là đường dẫn tuyệt đối trên ổ lưu bền vững, tách khỏi cả hai thư mục tệp Demo. Ví dụ đường dẫn: `D:/FlowRequestData/production` hoặc `/var/lib/flowrequest/production`. Backend tạo `uploads` và `private-vouchers` bên trong. Không mount các thư mục này vào public webroot.
6. `PRODUCTION_ALLOWED_ORIGINS` là danh sách origin website Production, phân cách dấu phẩy, không có đường dẫn hay dấu `/` cuối. Khóa email Production dùng biến `PRODUCTION_RESEND_API_KEY` riêng; không tự dùng khóa Demo.

Không đặt URI MongoDB, mật khẩu, JWT hoặc khóa email vào biến `VITE_*`: chúng sẽ xuất hiện trong bản build trình duyệt.

## 3. Khởi tạo SYSTEM_ADMIN đầu tiên qua Backend

Điền `PRODUCTION_BOOTSTRAP_NAME`, `PRODUCTION_BOOTSTRAP_EMAIL` và `PRODUCTION_BOOTSTRAP_DEPARTMENT` bằng thông tin thật. Phòng ban ban đầu cũng giúp danh sách cấp tài khoản có dữ liệu thực khi doanh nghiệp chưa có nhân sự khác.

Lưu mật khẩu đầu tiên trong một file bí mật một dòng nằm ngoài repository, thư mục tệp nghiệp vụ và public webroot. File chỉ cấp quyền đọc cho tài khoản vận hành; trên Linux dùng quyền `600`/`400`, trên Windows đặt ACL tương ứng hoặc dùng secret mount của nền tảng. Khai báo đường dẫn tuyệt đối trong `PRODUCTION_BOOTSTRAP_PASSWORD_FILE`. Mật khẩu phải có ít nhất 12 ký tự, chữ hoa, chữ thường, số, ký tự đặc biệt, tối đa 72 byte.

Chạy trong `backend`:

```sh
npm run bootstrap:production
npm run start:production
```

Bootstrap không có endpoint HTTP công khai, không nhận mật khẩu từ tham số dòng lệnh và không in mật khẩu. Một transaction tạo SYSTEM_ADMIN đầu tiên, khóa bootstrap, định danh môi trường và audit. Chạy lại hoặc hai lần đồng thời không được tạo thêm SYSTEM_ADMIN. Nếu audit thất bại, transaction rollback. Không tạo HR, Director, nhân viên, đơn từ hoặc ngân sách mẫu.

Sau khi thành công, bỏ các biến bootstrap và secret mount bootstrap khỏi dịch vụ Backend chạy thường trực. Giữ mật khẩu admin trong nơi lưu bí mật được kiểm soát. Không chạy lại bootstrap để reset mật khẩu hoặc khôi phục tài khoản.

Hai môi trường cùng áp dụng quyền cấp tài khoản:

| Người cấp | Role được tạo |
| --- | --- |
| Bootstrap Production | SYSTEM_ADMIN đầu tiên |
| SYSTEM_ADMIN | HR_ADMIN, DIRECTOR |
| HR_ADMIN | EMPLOYEE, MANAGER, ACCOUNTANT |

SYSTEM_ADMIN hiện có vẫn được xem và quản lý theo các chốt bảo vệ cũ. API thông thường không tạo thêm SYSTEM_ADMIN. Các ngưỡng và thứ tự duyệt đơn không thay đổi. Trong Production, sáu địa chỉ tài khoản Demo được dành riêng và bị từ chối ở đăng nhập/cấp tài khoản.

Sau khi đăng nhập Production, cấp HR_ADMIN và DIRECTOR trước; HR cấp MANAGER, ACCOUNTANT và nhân viên, chỉ định quản lý trực tiếp. Nhập cấu hình doanh nghiệp, email và ngân sách thực tế trước khi đưa quy trình vào vận hành; hệ thống không tự tạo các dữ liệu này từ Demo.

## 4. Build Frontend Production

Sao chép `frontend/.env.production.example` thành `frontend/.env.production`. Đặt `VITE_APP_ENV=production`, `VITE_PRODUCTION_API_URL` trỏ tới API Production và `VITE_DEMO_API_URL` trỏ tới API Demo. Mặc định hai đường dẫn lần lượt là `/api` và `/demo-api`; chúng phải khác nhau. Chỉ đặt địa chỉ API công khai trong các biến này, không đặt URI MongoDB hoặc khóa bí mật.

```sh
npm run build:production
```

Kết quả ở `frontend/dist-production`, không ghi đè bản Demo. Cấu hình web server phục vụ thư mục này, hỗ trợ SPA fallback cho cả `/demo/*` về `index.html`, proxy `/api` sang Backend Production và `/demo-api` sang `/api` của Backend Demo. Giữ header `X-FlowRequest-Environment`; Frontend Production từ chối phản hồi không được định danh Production và không thử lại bằng API Demo nếu Production lỗi. Không dùng `vite dev`/`vite preview` làm web server Production.

Khi chạy cục bộ bằng `npm run dev` (cổng 3000) hoặc `npm run dev:production` (cổng 3001), Vite đã có proxy `/api` đến Backend Production cổng 5001 và `/demo-api` đến Backend Demo cổng 5000. Nếu Backend dùng địa chỉ khác, đặt hai biến API bằng địa chỉ tương ứng và cấu hình CORS cho origin giao diện. Proxy Vite chỉ phục vụ phát triển/kiểm tra; web server triển khai thật cần cấu hình tương tự.

Production không hiển thị bảng tài khoản Demo trong trang đăng nhập thực tế. Bấm Trải nghiệm Demo mới mở khu vực `/demo` với API, token và dữ liệu Demo. Phiên trình duyệt Production dùng key riêng, không lấy token/user đã lưu bởi Demo; URL `/demo-api` chỉ là đường dẫn proxy API, không phải workspace Demo. Test không có đường dẫn truy cập trong giao diện này và vẫn yêu cầu user/database/thư mục test độc lập.

## 5. Kiểm tra trước khi vận hành

- `GET /health/ready` của từng Backend phải trả `200`, `ready: true` và đúng môi trường sau khi kết nối MongoDB.
- Đăng nhập Demo chỉ đọc được dữ liệu Demo; gửi JWT Demo sang Production phải bị `401`, kể cả khi trùng ID người dùng. Kiểm tra tương tự chiều ngược lại.
- Xác nhận database user Demo không có quyền đọc/ghi database Production ở MongoDB, và ngược lại.
- Kiểm tra quyền cấp tài khoản qua cả giao diện lẫn API trực tiếp.
- Thử upload/tải chứng từ trên môi trường kiểm thử riêng; tệp Production không xuất hiện trong thư mục Demo.
- Sao lưu và diễn tập khôi phục cả MongoDB lẫn storage, cấu hình HTTPS/CORS, logging và giám sát. Không đóng gói `.env`, `.backups`, token hoặc chứng từ vào bản phát hành.
- Chạy từ root dự án: `node --test backend/test/*.test.js frontend/test/*.test.js`. Bài tích hợp MongoDB chỉ chạy khi có đầy đủ cấu hình `backend/.env.test` riêng; xem `backend/test/README.md`. Không dùng URI Production/Demo cho kiểm thử ghi/xóa.

Phần này chuẩn bị mã nguồn và cấu hình. Khi chưa có `.env.production` thật, bootstrap/start Production phải thất bại an toàn và không được tự chuyển sang Demo. Cần hoàn tất kiểm thử tích hợp trên hạ tầng mới trước khi công bố Production vận hành.

---

# Thông tin công cụ Frontend

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.
You can also try [the experimental native React Compiler support in plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md#rust-react-compiler) by using `compiler: true` in the plugin options instead of using the Babel plugin.

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
