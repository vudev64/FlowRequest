import { ClipboardCheck, Wallet, CheckCircle2, Clock3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { money, pendingForAccountant, isAccountingRequest, requestTypeLabel } from '../AccountData';
import { useAccountLanguage } from '../AccountLanguage';
import AccountStatus from './AccountStatus';
import AccountFinanceSummary from './AccountFinanceSummary';

const sum = rows => rows.reduce((total, row) => total + Number(row.amount || 0), 0);
export default function AccountOverview({ requests, finance, onView, request, onFinanceChanged }) {
  const { text, lang } = useAccountLanguage();
  const pending = requests.filter(pendingForAccountant);
  const approved = requests.filter(row => isAccountingRequest(row) && row.status === 'APPROVED');
  const cards = [
    [text('Đơn chờ Kế toán', 'Pending accountant'), pending.length, Clock3],
    [text('Giá trị đang chờ', 'Pending value'), money(sum(pending), lang), Wallet],
    [text('Đơn đã hoàn tất', 'Completed requests'), approved.length, CheckCircle2],
    [text('Giá trị đã duyệt', 'Approved value'), finance ? money(finance.approvedAmount, lang) : '—', ClipboardCheck],
  ];
  return <section className="acc-stack">
    <div className="acc-stats">{cards.map(([name, value, Icon]) => <article className="acc-card acc-stat" key={name}><span className="acc-stat-icon"><Icon size={20} aria-hidden="true" /></span><span>{name}</span><strong>{value}</strong></article>)}</div>
    <section className="acc-card"><div className="acc-section-title"><div><h2>{text('Đề xuất cần Kế toán phê duyệt', 'Requests awaiting accounting approval')}</h2><p className="acc-muted">{text('Các đề xuất đã được chuyển đến bước xử lý của Kế toán theo quy trình hiện hành.', 'Requests that have reached the accounting stage under the current workflow.')}</p></div><Link className="acc-text-link" to="/account/approvals">{text('Xem tất cả', 'View all')}</Link></div>
      {pending.length ? <div className="acc-summary-list">{pending.slice(0, 5).map(row => <button type="button" className="acc-summary-row" key={row._id} onClick={() => onView(row)}><span><strong>{row.title}</strong><small>{requestTypeLabel(row, lang)} · {row._id}</small></span><AccountStatus status={row.status} /><strong>{money(row.amount, lang)}</strong></button>)}</div> : <p className="acc-empty">{text('Hiện chưa có đơn chờ xử lý.', 'There are no requests awaiting review.')}</p>}
      <Link className="acc-primary" to="/account/approvals">{text('Xem danh sách chờ duyệt', 'Open approval queue')}</Link>
    </section>
    <AccountFinanceSummary finance={finance} request={request} onChanged={onFinanceChanged}/>
  </section>;
}
