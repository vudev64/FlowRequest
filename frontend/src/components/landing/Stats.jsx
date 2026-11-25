import { ClipboardList, History, UsersRound } from 'lucide-react';

const capabilities = [
  { icon: ClipboardList, title: 'Tập trung đề xuất', description: 'Nội dung, tệp đính kèm và trạng thái.' },
  { icon: UsersRound, title: 'Đúng người, đúng vai trò', description: 'Phân định trách nhiệm ở từng cấp duyệt.' },
  { icon: History, title: 'Theo dõi xuyên suốt', description: 'Xem lại kết quả và lịch sử phê duyệt.' },
];

export function Stats() {
  return <section className="landing-capabilities" aria-label="Giá trị sử dụng"><div className="landing-container landing-capabilities__inner">
    {capabilities.map(({ icon: Icon, title, description }) => <div className="landing-capability" key={title}><Icon size={22} aria-hidden="true" /><div><h2>{title}</h2><p>{description}</p></div></div>)}
  </div></section>;
}
