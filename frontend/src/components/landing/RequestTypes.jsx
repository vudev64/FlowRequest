import { CalendarDays, Clock3, ShoppingBag } from 'lucide-react';
import { REQUEST_TYPES } from '../../lib/domain.js';

const icons = { leave: CalendarDays, overtime: Clock3, purchase: ShoppingBag };

export function RequestTypes() {
  return <section id="tinh-nang" className="landing-section landing-container landing-requests" aria-labelledby="requests-title">
    <div className="landing-section__heading">
      <p className="landing-eyebrow">CÔNG VIỆC HẰNG NGÀY</p>
      <h2 id="requests-title" className="landing-section__title">Một nơi cho các<br />đề xuất nội bộ.</h2>
      <p className="landing-section__description">Tạo đơn, theo dõi trạng thái và xem lại nội dung khi cần. Các loại đơn phổ biến được sắp xếp trong cùng một không gian làm việc.</p>
      <a className="landing-text-link" href="#luong-duyet">Tìm hiểu quy trình phê duyệt</a>
    </div>
    <div className="landing-request-list">{REQUEST_TYPES.map(type => {
      const Icon = icons[type.id];
      return <article key={type.id} className="landing-request-row"><span className="landing-icon"><Icon size={23} aria-hidden="true" /></span><div><h3>{type.name}</h3><p>{type.description}</p></div></article>;
    })}<p className="landing-request-list__note">Mỗi loại đề xuất có thông tin và tuyến xử lý phù hợp.</p></div>
  </section>;
}
