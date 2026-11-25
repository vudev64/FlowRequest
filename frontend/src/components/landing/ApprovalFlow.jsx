import { ShieldCheck } from 'lucide-react';

const flows = [
  { title: 'Đơn của nhân viên', description: 'Quản lý trực tiếp là người xem xét đầu tiên.', steps: [
    ['Nhân viên', 'Tạo và gửi đề xuất.'],
    ['Quản lý trực tiếp', 'Xem xét, phê duyệt hoặc từ chối.'],
    ['Bộ phận phụ trách', 'HR hoặc Kế toán tiếp nhận theo loại đơn.'],
  ] },
  { title: 'Đơn của quản lý', description: 'Giám đốc xem xét để tránh việc tự phê duyệt.', steps: [
    ['Quản lý', 'Tạo và gửi đề xuất của mình.'],
    ['Giám đốc', 'Xem xét đề xuất trước khi chuyển tiếp.'],
    ['Bộ phận phụ trách', 'Ghi nhận và xử lý theo nghiệp vụ.'],
  ] },
];

export function ApprovalFlow() {
  return <section id="luong-duyet" className="landing-approval" aria-labelledby="approval-title"><div className="landing-container landing-section">
    <div className="landing-section__heading landing-section__heading--wide"><div><p className="landing-eyebrow">QUY TRÌNH LÀM VIỆC</p><h2 id="approval-title" className="landing-section__title">Rõ từng bước.<br />Rõ người chịu trách nhiệm.</h2></div><p className="landing-section__description">Đề xuất được chuyển theo vai trò, loại đơn và điều kiện nghiệp vụ. Người gửi có thể theo dõi trạng thái và lịch sử xử lý.</p></div>
    <div className="landing-approval__panels">{flows.map(flow => <article key={flow.title} className="landing-approval__panel">
      <h3>{flow.title}</h3><p>{flow.description}</p><ol className="landing-approval__steps">{flow.steps.map(([title, description]) => <li key={title}><span className="landing-approval__marker" aria-hidden="true" /><div><h4>{title}</h4><p>{description}</p></div></li>)}</ol>
    </article>)}</div>
    <div className="landing-approval__note"><ShieldCheck size={20} aria-hidden="true" /><p>Người tạo không duyệt đơn của chính mình. Tuyến xử lý cụ thể phụ thuộc loại đề xuất; đơn mua sắm có thể cần thêm cấp duyệt theo hạn mức.</p></div>
  </div></section>;
}
