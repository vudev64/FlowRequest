import { ClipboardCheck, FileText, ShieldCheck, UserRoundCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SystemBrandName } from '../../views/SystemConfiguration';
import { DEMO_LOGIN_URL } from '../../lib/environment';

const exampleSteps = [
  { icon: FileText, title: 'Nhân viên gửi đề xuất', description: 'Thông tin nghỉ phép được ghi nhận trong đơn.' },
  { icon: UserRoundCheck, title: 'Quản lý trực tiếp phê duyệt', description: 'Xem nội dung và đưa ra quyết định.' },
  { icon: ClipboardCheck, title: 'HR ghi nhận và hoàn tất', description: 'Kết quả và lịch sử được lưu cùng đề xuất.' },
];

export function Hero() {
  return (
    <section className="landing-hero" aria-labelledby="public-title">
      <div className="landing-container landing-hero__content">
        <div className="landing-hero__copy">
          <p className="landing-eyebrow">QUẢN LÝ ĐỀ XUẤT DOANH NGHIỆP</p>
          <h1 id="public-title">Đề xuất rõ ràng.<br /><span>Phê duyệt liền mạch.</span></h1>
          <p className="landing-hero__description"><SystemBrandName /> giúp tập trung đơn từ nội bộ, chuyển đến đúng người xử lý và theo dõi tiến trình trong một hệ thống.</p>
          <div className="landing-hero__actions">
            <a href={DEMO_LOGIN_URL} className="landing-button landing-button--primary">Trải nghiệm Demo</a>
            <Link to="/login" className="landing-button landing-button--secondary">Đăng nhập hệ thống</Link>
          </div>
          <p className="landing-hero__note">Đã được cấp tài khoản? Đăng nhập để vào không gian làm việc của bạn.</p>
        </div>
        <figure className="landing-flow-preview">
          <figcaption><span>QUY TRÌNH PHÊ DUYỆT</span><strong>Từ đề xuất đến hoàn tất</strong><p>Minh họa luồng duyệt đơn nghỉ phép</p></figcaption>
          <ol>{exampleSteps.map(({ icon: Icon, title, description }) => <li key={title}>
            <span className="landing-flow-preview__icon"><Icon size={20} aria-hidden="true" /></span>
            <div><h2>{title}</h2><p>{description}</p></div>
          </li>)}</ol>
          <div className="landing-flow-preview__note"><ShieldCheck size={18} aria-hidden="true" /><span>Người tạo đơn không tự phê duyệt.</span></div>
        </figure>
      </div>
    </section>
  );
}
