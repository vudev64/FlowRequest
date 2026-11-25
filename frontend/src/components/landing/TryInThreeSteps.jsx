import { Link } from 'react-router-dom';
import { DEMO_LOGIN_URL, IS_DEMO } from '../../lib/environment';

const steps = IS_DEMO ? [
  ['Mở trang demo', 'Xem các tài khoản và vai trò có sẵn để trải nghiệm.'],
  ['Chọn tài khoản', 'Thông tin demo được chuyển sang trang đăng nhập.'],
  ['Khám phá không gian làm việc', 'Tạo, theo dõi hoặc xét duyệt đơn theo vai trò được hỗ trợ.'],
] : [
  ['Nhận tài khoản', 'Tài khoản được cấp theo vai trò tại doanh nghiệp.'],
  ['Đăng nhập hệ thống', 'Sử dụng thông tin đăng nhập được cấp qua kênh riêng.'],
  ['Làm việc theo vai trò', 'Tạo, theo dõi hoặc xét duyệt đơn trong phạm vi được phân quyền.'],
];

export function TryInThreeSteps() {
  return <section id="tai-lieu" className="landing-section landing-container landing-try" aria-labelledby="try-title">
    <div className="landing-section__heading"><p className="landing-eyebrow">BẮT ĐẦU SỬ DỤNG</p><h2 id="try-title" className="landing-section__title">Tìm hiểu qua trải nghiệm thực tế.</h2><p className="landing-section__description">{IS_DEMO ? 'Đi từ trang giới thiệu đến không gian làm việc với tài khoản demo có sẵn.' : 'Đăng nhập bằng tài khoản doanh nghiệp để vào không gian làm việc của bạn.'}</p></div>
    <ol className="landing-try__steps">{steps.map(([title, description]) => <li key={title}><h3>{title}</h3><p>{description}</p></li>)}</ol>
    <div className="landing-cta"><div><h3>Sẵn sàng bắt đầu?</h3><p>Khám phá quy trình hoặc đăng nhập để tiếp tục công việc.</p></div><div className="landing-cta__actions"><a href={DEMO_LOGIN_URL} className="landing-button landing-button--white">Trải nghiệm Demo</a><Link to="/login" className="landing-cta__login">Đăng nhập hệ thống</Link></div></div>
  </section>;
}
