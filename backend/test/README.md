# Kiểm thử MongoDB độc lập của FlowRequest

Phần này chỉ dành cho kiểm thử tích hợp. Không thay đổi tài khoản, database, tệp, phân quyền hoặc workflow đang vận hành của Demo/Production.

## Chuẩn bị hạ tầng test

1. Dùng MongoDB replica set/Atlas hỗ trợ transaction. Chọn database test riêng: `flowrequest_test` hoặc tên dạng `frft_...`, ban đầu chưa có dữ liệu. Không dùng database Demo `test`, Production hoặc database kiểm thử cũ còn dữ liệu.
2. Quản trị viên MongoDB cấp **database user riêng** cho test, khác user Demo/Production. Chỉ gán `readWrite` trên đúng database test hoặc custom role có quyền CRUD, tạo collection/index và đọc metadata cần thiết trong database đó. Không cấp `readWriteAnyDatabase`, `dbOwner`, `root` hoặc quyền trên database khác. Database user này là tài khoản hạ tầng, khác các tài khoản ứng dụng thuộc 6 role.
3. Bài test kiểm tra quyền hiệu lực bằng `connectionStatus` trước khi ghi. Nếu máy chủ không cung cấp thông tin quyền hoặc user có quyền ngoài database test, bài test dừng. Không bỏ chốt này để dùng lại URI đang vận hành.
4. Chuẩn bị thư mục tệp test riêng, ví dụ `D:/FlowRequestData/test` hoặc `/var/lib/flowrequest-test`. Không đặt trong thư mục uploads/private-vouchers Demo hoặc thư mục dữ liệu Production. Tài khoản chạy test phải có quyền đọc/ghi thư mục này.

Không có lệnh nào trong bộ kiểm thử tự tạo database user hay thay đổi quyền MongoDB hiện có. Cần hoàn tất bước cấp user bằng tài khoản quản trị hạ tầng trước khi chạy tích hợp.

## Cấu hình và chạy

Sao chép `backend/.env.test.example` thành `backend/.env.test`, điền:

```dotenv
FINANCE_TEST_URI=mongodb+srv://<TEST_DB_USER>:<URL_ENCODED_PASSWORD>@<TEST_CLUSTER>/frft_integration
FINANCE_TEST_DB_NAME=frft_integration
FINANCE_TEST_STORAGE_ROOT=D:/FlowRequestData/test
```

Đây là chỗ điền cấu hình, không phải thông tin kết nối có thể dùng ngay. Tên database trong URI phải trùng `FINANCE_TEST_DB_NAME`; chỉ chấp nhận chính xác `flowrequest_test` hoặc tên có tiền tố `frft_` theo quy tắc hiện có. Whitelist này không tự chọn kết nối, không cho phép các tên gần giống và không thay thế kiểm tra DB/user riêng, quyền hiệu lực, marker hoặc dữ liệu trống. Có thể thêm `authSource` theo cấu hình MongoDB. File `.env.test` đã được Git bỏ qua; không đưa URI/mật khẩu vào báo cáo hoặc commit.

Chạy từ thư mục `backend`:

```sh
npm run test:mongo:safety
npm run test:mongo
```

`test:mongo:safety` kiểm tra hash mật khẩu, cấu hình, quyền, khóa lượt chạy, dọn đúng bản ghi và cô lập thư mục bằng dữ liệu kiểm thử trong bộ nhớ/tệp tạm; không kết nối MongoDB.

Hai bộ unit test có ghi/tải tệp (`settings.test.js`, `account-handoff.test.js`) cũng dùng thư mục riêng theo lượt chạy trong `backend/test-artifacts`, được Git bỏ qua và dọn sau test. Chúng không ghi fixture vào `backend/uploads` đang vận hành.

`test:mongo` chạy API tài chính với MongoDB test thật và trả lỗi nếu thiếu cấu hình bắt buộc. Chỉ bộ test tổng quát mới có thể **skip** bài MongoDB khi chưa cấu hình; không coi đó là integration đã đạt. Nếu cấu hình thiếu/sai, bài test thất bại trước khi kết nối. Không lấy URI dự phòng từ `.env`, `.env.demo`, `.env.production` hoặc tự gán `FINANCE_TEST_URI=MONGO_URI`.

Các file cấu hình đang vận hành chỉ được đọc để đối chiếu tên database, username và đường dẫn, không dùng làm cấu hình test. Không chạy MongoDB integration test trong tiến trình đang đặt `FLOWREQUEST_ENV=production` hoặc `NODE_ENV=production`.

## Cô lập trong mỗi lượt chạy

- Chỉ nhận database test rỗng hoặc database do harness này đánh dấu và đã hoàn tất dọn ở lượt trước. Dữ liệu tồn dư, marker môi trường ứng dụng, collection lạ hoặc khóa đang hoạt động đều khiến test dừng.
- Marker `flowrequest_test_control` khóa database theo mã lượt chạy, ngăn hai lượt sử dụng đồng thời. Không tự chiếm lại khóa cũ sau thời gian chờ.
- Mỗi lượt tạo mật khẩu ngẫu nhiên cho đủ 6 role rồi hash bcrypt trước khi lưu. Mật khẩu thô chỉ tồn tại trong bộ nhớ kiểm thử.
- Chỉ trong tiến trình test, schema được bổ sung `_testRunId` để đánh dấu bản ghi của lượt chạy. Không sửa schema/model trong `src`.
- Tạo thư mục `run-...` mới dưới `FINANCE_TEST_STORAGE_ROOT`, có marker sở hữu; `uploads` và `private-vouchers` đều nằm trong đó. Đặt môi trường test **trước** khi import router/middleware để không ghi nhầm thư mục Demo.
- JWT dùng khóa ngẫu nhiên riêng cho lượt chạy. API được tái sử dụng trong tiến trình kiểm thử riêng; không chạy server Demo/Production hoặc kế thừa khóa email của chúng. Thông báo của fixture bị tắt.

## Dọn sau kiểm thử

Teardown không gọi `dropDatabase`, `dropCollection` hay `collection.drop()`.

1. Đóng HTTP server của lượt test.
2. Đối chiếu tên database, marker sở hữu và `_testRunId` trên toàn bộ collection được phép. Nếu có bản ghi không thuộc lượt này, dừng trước khi xóa bất kỳ bản ghi nào.
3. Chỉ gọi `deleteMany({ _testRunId: <CURRENT_RUN> })` trên các collection ứng dụng của test. Giữ nguyên database, collection và index. Không quét/xóa dữ liệu theo email `.test` hoặc chỉ theo tiền tố tên database.
4. Xác nhận không còn bản ghi của lượt này rồi giải phóng khóa; giữ marker môi trường để lần chạy tiếp theo nhận diện database test.
5. Ngắt các kết nối. Khi xác nhận teardown thành công, kiểm tra đường dẫn thật và marker thư mục rồi dọn toàn bộ thư mục `run-...` vừa tạo, kể cả tệp upload không có bản ghi chứng từ. Không quét thư mục tệp của Demo/Production.

Nếu dọn database hoặc ngắt kết nối thất bại, test báo lỗi và giữ tệp để đối soát. Nếu tiến trình bị dừng đột ngột, dữ liệu/khóa có thể còn lại; lần chạy tiếp theo sẽ từ chối tiếp tục, không tự xóa hoặc nhận làm dữ liệu của mình.

Database cũ `frft_f4fc4f109bda4d9fa461049f1158b685`, các tài khoản plaintext và tệp cũ được giữ nguyên. Việc xử lý dữ liệu tồn dư đó cần được duyệt riêng; bộ kiểm thử mới không tự dọn chúng.
