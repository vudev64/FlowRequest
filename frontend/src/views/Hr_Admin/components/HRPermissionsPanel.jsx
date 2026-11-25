import { useAdminPreferences } from "../../AdminPreferences";
import { Eye, ShieldCheck, Users, ClipboardCheck, ArrowRight, History } from 'lucide-react';
const permissions = [{
  icon: Users,
  title: 'Quản lý nhân sự',
  description: 'Xem danh sách, tạo và chỉnh sửa thông tin nhân viên, quản lý và kế toán. Khóa hoặc mở lại tài khoản trong phạm vi được giao.',
  label: 'Được phép',
  tone: 'allowed'
}, {
  icon: Eye,
  title: 'Tài khoản quản trị',
  description: 'Xem thông tin giám đốc, quản trị nhân sự và quản trị hệ thống. Việc thay đổi các tài khoản này thuộc quyền quản trị hệ thống.',
  label: 'Chỉ xem',
  tone: 'readonly'
}, {
  icon: ClipboardCheck,
  title: 'Xét duyệt đơn nhân sự',
  description: 'Xử lý đơn nghỉ phép, tăng ca, điều chỉnh chấm công, đào tạo và tuyển dụng sau khi được chuyển đến bước HR.',
  label: 'Được phép',
  tone: 'allowed'
}, {
  icon: ArrowRight,
  title: 'Chuyển bước xử lý',
  description: 'Đơn đào tạo có chi phí được chuyển đến kế toán. Các đơn nhân sự còn lại hoàn tất sau khi HR phê duyệt.',
  label: 'Theo quy trình',
  tone: 'workflow'
}, {
  icon: History,
  title: 'Tra cứu lịch sử',
  description: 'Xem chi tiết, tài liệu đính kèm và lịch sử phê duyệt của các đơn thuộc phạm vi HR. Quyết định đã lưu chỉ được xem lại.',
  label: 'Chỉ xem',
  tone: 'readonly'
}];
export default function HRPermissionsPanel() {
  const {
    t: translate
  } = useAdminPreferences();
  return <section className="hr-permissions-panel">
      <div className="hr-panel-heading">
        <div><span className="hr-section-label">{translate("Quy\u1EC1n truy c\u1EADp")}</span><h2>{translate("Ph\xE2n quy\u1EC1n & li\xEAn k\u1EBFt")}</h2><p>{translate("Ph\u1EA1m vi c\xF4ng vi\u1EC7c v\xE0 tr\xE1ch nhi\u1EC7m c\u1EE7a qu\u1EA3n tr\u1ECB nh\xE2n s\u1EF1.")}</p></div>
        <span className="hr-role-tag"><ShieldCheck size={16} aria-hidden="true" />{translate("Qu\u1EA3n tr\u1ECB nh\xE2n s\u1EF1")}</span>
      </div>
      <div className="hr-permission-list">
        {permissions.map(({
        icon: Icon,
        title,
        description,
        label,
        tone
      }) => <article className="hr-permission-item" key={translate(title)}>
            <span className="hr-permission-icon"><Icon size={20} aria-hidden="true" /></span>
            <div><h3>{translate(title)}</h3><p>{translate(description)}</p></div>
            <span className={`hr-permission-tag hr-permission-tag--${tone}`}>{translate(label)}</span>
          </article>)}
      </div>
      <aside className="hr-permission-note"><ShieldCheck size={20} aria-hidden="true" /><div><strong>{translate("Nguy\xEAn t\u1EAFc ph\xEA duy\u1EC7t")}</strong><p>{translate("Ch\u1EC9 x\u1EED l\xFD \u0111\u01A1n \u0111ang ch\u1EDD HR. B\u1EA1n kh\xF4ng th\u1EC3 t\u1EF1 duy\u1EC7t \u0111\u01A1n c\u1EE7a m\xECnh ho\u1EB7c thay \u0111\u1ED5i quy\u1EBFt \u0111\u1ECBnh \u0111\xE3 ho\xE0n t\u1EA5t.")}</p></div></aside>
    </section>;
}
