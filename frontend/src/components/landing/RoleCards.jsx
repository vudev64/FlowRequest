import { ROLES } from '../../lib/domain.js';

// Presentation copy follows the existing backend roles; shared role definitions stay unchanged.
const descriptions = {
  employee: ['Nhân viên', 'Tạo và theo dõi đề xuất cá nhân.', 'Xem trạng thái, chi tiết và kết quả xử lý.'],
  manager: ['Quản lý', 'Xem xét đề xuất được giao trong bộ phận.', 'Gửi đề xuất cá nhân đến cấp duyệt tiếp theo.'],
  hr_admin: ['Nhân sự', 'Quản lý nhân sự và xử lý các đơn thuộc HR.', 'Tra cứu chi tiết và lịch sử phê duyệt.'],
  accountant: ['Kế toán', 'Xử lý đề xuất có nghiệp vụ tài chính được giao.', 'Tiếp nhận theo loại đơn và bước duyệt hiện hành.'],
  director: ['Giám đốc', 'Xem xét đề xuất thuộc cấp duyệt giám đốc.', 'Phê duyệt theo tuyến xử lý và hạn mức nghiệp vụ.'],
  system_admin: ['Quản trị hệ thống', 'Quản lý tài khoản quản trị và cấu hình hệ thống.', 'Theo dõi nhật ký; không tham gia duyệt đơn nghiệp vụ.'],
};

export function RoleCards() {
  return <section id="vai-tro" className="landing-section landing-container landing-roles" aria-labelledby="roles-title">
    <div className="landing-section__heading landing-section__heading--wide"><div><p className="landing-eyebrow">PHÂN CÔNG RÕ RÀNG</p><h2 id="roles-title" className="landing-section__title">Mỗi vai trò,<br />một phạm vi công việc.</h2></div><p className="landing-section__description">Hệ thống phân tách việc gửi đề xuất, xét duyệt và quản trị. Người dùng làm việc trong phạm vi được cấp quyền.</p></div>
    <div className="landing-role-list">{ROLES.map(role => {
      const [name, responsibility, detail] = descriptions[role.id];
      return <article key={role.id} className="landing-role-row"><h3>{name}</h3><p>{responsibility}</p><p>{detail}</p></article>;
    })}</div>
  </section>;
}
