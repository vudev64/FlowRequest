import { LockKeyhole, History, ShieldCheck } from 'lucide-react';

const points = [
  { icon: LockKeyhole, title: 'Truy cập bằng tài khoản được cấp', text: 'Không có đăng ký công khai. Người dùng đăng nhập bằng tài khoản do bộ phận có thẩm quyền tạo.' },
  { icon: ShieldCheck, title: 'Kiểm tra quyền khi xử lý', text: 'Hệ thống kiểm tra quyền truy cập và thao tác theo vai trò, phạm vi của từng đề xuất.' },
  { icon: History, title: 'Có lịch sử để đối chiếu', text: 'Chi tiết đề xuất lưu lại tiến trình phê duyệt. Quản trị viên có thể tra cứu nhật ký các thao tác được ghi nhận.' },
];

export function SafetyPoints() {
  return <section id="an-toan" className="landing-safety" aria-labelledby="safety-title"><div className="landing-container landing-section landing-safety__inner">
    <div className="landing-section__heading"><p className="landing-eyebrow">KIỂM SOÁT VÀ MINH BẠCH</p><h2 id="safety-title" className="landing-section__title">Dành cho môi trường<br />làm việc nội bộ.</h2><p className="landing-section__description">Tài khoản, quyền hạn và lịch sử xử lý giúp các bộ phận phối hợp trên cùng một nền tảng.</p></div>
    <div className="landing-safety__list">{points.map(({ icon: Icon, title, text }) => <article key={title}><Icon size={22} aria-hidden="true" /><div><h3>{title}</h3><p>{text}</p></div></article>)}</div>
  </div></section>;
}
