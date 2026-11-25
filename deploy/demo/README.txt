FLOWREQUEST DEMO — HƯỚNG DẪN HOÀN THÀNH ĐIỀU KIỆN DEPLOY
Cập nhật: 24/11/2026. Chỉ dành cho Demo; không bật Production.

Trạng thái hiện tại
- Code Employee đã được nối API chi tiết/lịch sử và tải tệp có token.
- MongoDB Test flowrequest_test đã có user riêng; integration thực tế đạt và
  cleanup đã được xác minh. User Demo giới hạn quyền đang chờ người dùng tạo.
- Chưa chọn domain/hosting và chưa xác nhận khoản 52 triệu thuộc phòng ban IT.
  Chưa đủ điều kiện deploy công khai. Các bước mới: PUBLIC_DEPLOY_STEPS.txt.
- Không sử dụng kết nối Demo để chạy test ghi dữ liệu. Không thay đổi khoản 52 triệu.
- Các file .example chỉ là mẫu, không được coi là cấu hình đã hoạt động.

1. Chuẩn bị MongoDB test riêng (cần quyền quản trị Atlas/hạ tầng)
Tạo database user riêng bằng công cụ quản trị Atlas, không dùng tài khoản đăng
nhập Atlas làm user kết nối ứng dụng. Giới hạn privileges vào một database mới
chính xác flowrequest_test hoặc dạng frft_..., ví dụ frft_demo_checks.
Dùng Specific Privileges/custom role theo
database; không cấp readWriteAnyDatabase/Atlas admin. Harness kiểm tra quyền
hiệu lực trước khi ghi. Hướng dẫn chính thức:
https://www.mongodb.com/docs/atlas/security-add-mongodb-users/

Database test phải trống, dùng replica set/sharded cluster hỗ trợ transaction.
Không dùng lại database chứa fixture cũ hoặc database Demo hiện tại tên test.
Không xóa dữ liệu cũ để làm cho harness chạy được.

Copy backend/.env.test.example thành backend/.env.test rồi tự điền trên máy:
  FINANCE_TEST_URI=<URI riêng, database trong URI phải khớp tên phía dưới>
  FINANCE_TEST_DB_NAME=frft_demo_checks
  FINANCE_TEST_STORAGE_ROOT=<đường dẫn tuyệt đối riêng cho test>
Không gửi URI/mật khẩu vào chat. URL-encode mật khẩu; authSource phải đúng nơi
database user được xác thực. Giữ TLS và xác minh chứng chỉ. Tài liệu tham khảo:
https://www.mongodb.com/docs/manual/reference/connection-string-options/

Từ thư mục backend:
  npm run test:mongo:safety
  npm run test:mongo
Lệnh thứ hai bắt buộc có cấu hình hợp lệ và trả lỗi nếu thiếu. Bộ npm test tổng
quát vẫn có thể skip bài MongoDB khi chưa có hạ tầng; không dùng kết quả đó
để xác nhận deploy. Phải xem báo cáo test:mongo riêng có thật sự chạy và đạt.
Harness không drop database/collection, chỉ dọn bản ghi/tệp mang mã lượt chạy
của chính nó. Khi không xác minh được cleanup, giữ bằng chứng để kiểm tra.

2. Giới hạn quyền kết nối Demo (cần quyền quản trị Atlas)
Giữ nguyên database và dữ liệu Demo đang có. Tạo user chỉ có quyền readWrite
trong database Demo hiện tại; không cấp quyền trên Production/Test hoặc DB khác.
Không thay user/role ứng dụng để làm bước này. Không tạo lại 6 tài khoản mẫu.

Dùng backend/.env.demo.example làm danh sách trường cần thiết. Không copy mẫu
đè file .env đang dùng. Trước khi chuyển sang .env.demo, phải chuyển đủ các giá
trị Demo đang sử dụng, đặc biệt URI, tên DB, JWT và storage để tránh vô tình đổi
đích dữ liệu. Nếu tiếp tục dùng backend/.env thì cập nhật các trường Demo tại đó.

Điền các giá trị thật:
  DEMO_MONGO_URI=<URI user riêng, vẫn trỏ cùng DB Demo hiện tại>
  DEMO_DB_NAME=<DB Demo hiện tại, không tự tạo DB mới>
  DEMO_ALLOWED_ORIGINS=https://<domain-demo-thật>
  DEMO_TRUSTED_PROXIES=<IP chính xác của reverse proxy, nếu có>
  DEMO_STORAGE_ROOT=<thư mục tuyệt đối bền vững riêng của Demo>
Không tự xoay JWT hoặc đổi storage chứa chứng từ đang có khi chưa có phương án
bảo toàn. Nếu đổi root storage, phải được duyệt và xác minh tệp trước/sau.

Tạo/cấp quyền uploads và private-vouchers bên trong root đã chọn. Các thư mục
chứng từ không nằm trong static web root và không dùng chung Production/Test.
Không để web server phục vụ trực tiếp uploads/private-vouchers.

Tùy chọn GridFS cho Demo dùng Atlas Free/M0
- Backend chọn GridFS khi DEMO_STORAGE_DRIVER=gridfs. Local mặc định ghi ra đĩa.
  Cả hai chế độ đọc tệp theo nguồn lưu trong tham chiếu. Tệp local cũ vẫn cần
  thư mục ban đầu trên máy phục vụ. Nếu thiếu tệp tại máy, chế độ GridFS đọc
  bản đã liên kết theo đúng đường dẫn cũ (nếu có sau một đợt sao chép được duyệt).
- DEMO_STORAGE_ROOT phải cho phép tạo thư mục tạm .gridfs-staging. Giới hạn
  hiệu lực là mức nhỏ hơn giữa 2 MiB và chính sách hệ thống. Bộ đếm dùng chung
  trong cùng DB giới hạn 4 lượt ghi đang xử lý, ngân sách 100 MiB tính cả
  phần dự phòng. Khi chạm ngưỡng, API từ chối tệp mới, vẫn cho tải tệp đã lưu.
- Một lượt ghi bị ngắt vẫn chiếm quota. Lượt upload kế tiếp đối soát các lượt
  quá 5 phút và chỉ dọn dữ liệu chưa liên kết. Bản ghi đã liên kết được bảo vệ
  trong cùng transaction với đơn/thanh toán. Không xóa thủ công collection quota.

Tùy chọn lưu tệp mới trên R2 cho Demo
- DEMO_STORAGE_DRIVER mặc định là local. Chỉ đặt thành r2 khi bucket đã được duyệt.
- Backend đọc DEMO_R2_ACCOUNT_ID, DEMO_R2_BUCKET, DEMO_R2_ACCESS_KEY_ID và
  DEMO_R2_SECRET_ACCESS_KEY từ môi trường máy chủ. Dùng bucket riêng tư và khóa
  giới hạn quyền đọc/ghi đối tượng trong đúng bucket Demo.
- Backend dùng .r2-staging trong DEMO_STORAGE_ROOT khi nhận tệp mới. Các đường
  dẫn chứng từ local cũ vẫn cần thư mục uploads và private-vouchers ban đầu.
  Chuyển máy chủ cần phương án riêng cho những tệp cũ. Bật R2 chỉ đổi nơi ghi tệp mới.
- Chứng từ có tên r2- do Backend tạo được tải từ bucket qua API có xác thực.
  Tắt R2 sau khi đã có tệp trên đó sẽ tạm ngừng truy cập các tệp đó.
- npm run test:mongo dùng kho HTTP mô phỏng trên loopback cho phần R2.

Từ backend:
  npm run check:demo -- --offline
  npm run check:demo
Offline không thể đánh giá quyền MongoDB là đạt. Lệnh đầy đủ chỉ đọc cấu hình,
quyền DB, topology và quyền truy cập storage; không seed, sửa hoặc xóa dữ liệu.
Kết quả PASS của preflight chỉ áp dụng các kiểm tra Backend được ghi trong
scope, không thay thế test MongoDB, kiểm tra hosting hoặc đối soát ngân sách.

3. Đối soát ngân sách — chỉ thực hiện thay đổi sau khi người dùng chấp thuận
Từ backend:
  npm run report:demo-budget
Lệnh chỉ đọc, xuất các quyết định cần xác nhận. Nếu chưa sẵn sàng sẽ trả exit 1.

Dữ liệu kiểm tra ngày 24/11: 3 đơn mua sắm chờ Accountant thuộc phòng ban IT
chưa có ngân sách; 52 triệu đã duyệt/đã trả chưa gắn phòng ban. Không lệch ledger.
Cần xác nhận trước khi thao tác:
- Phòng ban thực tế, mã phòng ban và ngân sách được cấp.
- Số cam kết ban đầu theo đối soát, không suy đoán hoặc tự nhập 52 triệu.
- Phòng ban lịch sử của khoản 52 triệu. Phòng ban hiện tại của người tạo chỉ
  là bằng chứng tham khảo, không phải quyền tự gán lại khoản cũ.
- Nếu cần liên kết dữ liệu lịch sử: lập migration riêng có backup/audit,
  đối soát request + payment + budget trong transaction, trình duyệt trước.

Sau khi được chấp thuận, tạo ngân sách bằng chức năng Accountant hiện có,
không chỉnh usedBudget trực tiếp trong Compass. Không duyệt lại đơn đã duyệt,
không tạo lại payment cũ, không cộng/trừ ngân sách thêm ở bước thanh toán.
Giữ nguyên ngưỡng 50 triệu và thứ tự phê duyệt hiện tại.

4. Build và kiểm tra local
Từ thư mục gốc:
  node --test backend/test/*.test.js frontend/test/*.test.js
Từ frontend:
  npm run lint
  npm run build
  npm audit
Từ backend:
  npm audit
  npm run test:mongo

Backend local hiện tại đã được khởi động lại sau các thay đổi runtime trước
đây. Chỉ restart đúng tiến trình Demo khi thật sự cần nạp code/cấu hình mới;
kiểm tra /health/ready có environment=demo và ready=true. Không dừng tiến trình
khác chỉ vì PID cũ không còn khớp. Không khởi chạy Production bootstrap.

5. Hosting thật (chưa được tạo hoặc kiểm chứng)
Chọn domain/hosting, cài HTTPS và đưa frontend/dist lên static web root riêng.
Nginx mẫu: deploy/demo/nginx.conf.example. Điền mọi placeholder, kiểm tra bằng
nginx -t rồi mới xin duyệt/kích hoạt. Mẫu chưa được chạy trên Nginx thật.
/demo-api/* phải chuyển tới Backend Demo /api/*; /api không trỏ Production.
Giới hạn port Backend vào local/private network bằng firewall của hosting;
chỉ mở 80/443 công khai. Xem cách ánh xạ URI proxy_pass của Nginx tại:
https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass

Trên hosting, đặt NODE_ENV=production trong môi trường tiến trình và chạy rõ:
  npm run start:demo
Đây vẫn là dữ liệu Demo. Không đặt FLOWREQUEST_ENV=production. Chốt Backend
sẽ từ chối public startup khi thiếu origins hoặc user DB có quyền ngoài Demo.
Không chạy dev server Vite hoặc cấu hình development để lách chốt này.

Từ backend, sau khi có domain thật:
  npm run check:demo-hosting -- --url=https://<domain-demo-thật>
Lệnh chỉ GET, kiểm tra HTML, health Demo, public settings và API trả 401 khi
không token. Chưa có domain thì trả lỗi, không giả lập kết quả hosting đạt.

Các bước vẫn phải xác minh ngoài lệnh smoke:
- Đủ 6 role, route, lựa chọn ngôn ngữ/theme và responsive trên domain thật.
- Storage còn nguyên sau restart/redeploy; không có public URL đọc chứng từ.
- Request/ngân sách/thanh toán qua hạ tầng test riêng, gồm thao tác đồng thời.
- Chứng chỉ TLS, proxy trust/IP, giới hạn request/disk, log rotation và tải dự kiến.
- Không có dữ liệu/tài khoản Demo truy cập Production, Production tiếp tục dừng.

Chỉ kết luận deploy đạt khi bài MongoDB quan trọng thực sự chạy và đạt, quyền
DB/CORS đã xác minh, ngân sách đã được duyệt/đối soát và hosting thật vượt qua
các kiểm tra bắt buộc. Hiện vẫn CHƯA SẴN SÀNG DEPLOY CÔNG KHAI.

6. Bổ sung cho lần chuẩn bị public Demo ngày 24/11
File đề xuất số liệu: deploy/demo/budget-proposal.json (CHƯA ĐƯỢC ÁP DỤNG).
Phòng ban IT hiện có 3 đơn chờ kế toán, tổng 100 triệu. Đề xuất hạn mức Demo
1 tỷ đồng để đủ các kịch bản hiện có và thử ngưỡng 49/50 triệu. Số cam kết ban
đầu chưa chốt: 52 triệu chỉ khi được xác nhận thuộc IT; 0 chỉ khi người dùng
xác nhận hạn mức mới tách khoản lịch sử. Không tự gán lại request/payment cũ.
Nếu dùng cam kết 52 triệu, còn 948 triệu trước các đơn chờ, 848 triệu sau khi
duyệt đủ 100 triệu. Đây là phép tính đề xuất, không phải số dư đã ghi Database.
Các phòng ban khác chỉ được lập ngân sách từ tên phòng ban có thật và số tiền
được người dùng duyệt; không tạo phòng ban dựa vào tên role.

Báo cáo ngân sách chỉ đọc nay kiểm tra tổng các đơn chờ dùng chung một hạn mức,
không báo đủ chỉ vì từng đơn riêng lẻ nhỏ hơn số còn lại. Thay đổi này không
thay việc duyệt/giữ chỗ ngân sách trong workflow; bước duyệt cuối vẫn dùng
transaction hiện tại. Backend Demo cũng từ chối DB mang marker integration
test để tránh khởi động nhầm môi trường. Không sửa dữ liệu để qua kiểm tra.

Checklist online cần ghi bằng chứng thực tế: deploy/demo/ONLINE_CHECKLIST.txt.
Không đánh dấu checklist hoàn tất chỉ vì file mẫu hoặc unit test đã tồn tại.

Khi điền .env.test, giữ URI riêng tại đó; không thay MONGO_URI trong .env Demo.
DB Test không cần collection hoặc document tạo tay trong Compass: sau khi
xác minh quyền và database trống, bộ test tự tạo fixture/collection cần thiết.
Không sử dụng hoặc xóa database fixture cũ để thay cho một DB test trống.
