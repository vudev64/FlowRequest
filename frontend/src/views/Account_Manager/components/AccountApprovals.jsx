import { useCallback, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { money, requestTypeLabel, displayName, canDecide, pendingForAccountant, isAccountingRequest } from '../AccountData';
import { useAccountLanguage } from '../AccountLanguage';
import AccountDialog from './AccountDialog';
import AccountStatus from './AccountStatus';

export default function AccountApprovals({ requests, onView, onDecide, submitting, user }) {
  const { text, lang } = useAccountLanguage();
  const [filter, setFilter] = useState('pending'), [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null), [action, setAction] = useState('APPROVED'), [comment, setComment] = useState(''), [error, setError] = useState('');
  const lock = useRef(false);
  const rows = requests.filter(row => isAccountingRequest(row) && (filter === 'all' || (filter === 'pending' ? pendingForAccountant(row) : row.status === 'APPROVED')));
  const totalPages = Math.max(1, Math.ceil(rows.length / 5)), currentPage = Math.min(page, totalPages);
  const visible = rows.slice((currentPage - 1) * 5, currentPage * 5);
  const close = useCallback(() => setSelected(null), []);
  async function submit(event) {
    event.preventDefault();
    if (submitting || lock.current) return;
    if (!canDecide(selected, user)) { setError(text('Đơn không thuộc quyền xử lý của bạn.', 'You cannot review this request.')); return; }
    if (action === 'REJECTED' && !comment.trim()) { setError(text('Cần nhập lý do từ chối.', 'A rejection reason is required.')); return; }
    lock.current = true; setError('');
    try { await onDecide(selected._id, action, comment.trim()); close(); setComment(''); }
    catch (err) { setError(err.message || text('Thao tác thất bại.', 'The action failed.')); }
    finally { lock.current = false; }
  }
  return <section className="acc-card">
    <div className="acc-section-title"><div><h2>{text('Xét duyệt đề xuất', 'Request approvals')}</h2><p className="acc-muted">{text('Tiếp nhận mua sắm, công tác và đào tạo có chi phí theo quy trình. Chỉ xử lý khi đơn đã chuyển đến bước Kế toán.', 'Receive purchase, business trip and training requests with costs according to the workflow. Review is available only at the accounting stage.')}</p></div>
      <label className="acc-filter"><span>{text('Trạng thái', 'Status')}</span><select aria-label={text('Lọc trạng thái', 'Filter by status')} value={filter} onChange={event => { setFilter(event.target.value); setPage(1); }}><option value="pending">{text('Chờ Kế toán duyệt', 'Pending accountant')}</option><option value="approved">{text('Đã duyệt', 'Approved')}</option><option value="all">{text('Tất cả đề xuất được cấp quyền', 'All accessible requests')}</option></select></label>
    </div>
    <div className="acc-table-wrap" tabIndex={0} role="region" aria-label={text('Danh sách đề xuất', 'Request list')}><table className="acc-table"><thead><tr>{[text('Mã đơn / Tiêu đề', 'ID / Title'), text('Loại', 'Category'), text('Người tạo', 'Requester'), text('Số tiền', 'Amount'), text('Trạng thái', 'Status'), text('Thao tác', 'Actions')].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>
      {visible.map(row => <tr key={row._id}><td><strong>{row.title}</strong><small>{row._id}</small></td><td>{requestTypeLabel(row, lang)}</td><td>{displayName(row.author)}</td><td className="acc-amount">{money(row.amount, lang)}</td><td><AccountStatus status={row.status} /></td><td><div className="acc-actions"><button type="button" onClick={() => onView(row)}>{text('Chi tiết', 'Details')}</button>{canDecide(row, user) && <button type="button" className="acc-review-button" onClick={() => { setSelected(row); setAction('APPROVED'); setComment(''); setError(''); }}>{text('Xử lý', 'Review')}</button>}</div></td></tr>)}
    </tbody></table>{!visible.length && <p className="acc-empty">{text('Không có đề xuất phù hợp.', 'No matching requests.')}</p>}</div>
    <div className="acc-pagebar"><span>{rows.length ? (currentPage - 1) * 5 + 1 : 0}–{Math.min(currentPage * 5, rows.length)} / {rows.length} {text('đơn', 'requests')}</span><div><button type="button" aria-label={text('Trang trước', 'Previous page')} disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={17} aria-hidden="true" /></button><span>{text('Trang', 'Page')} {currentPage}/{totalPages}</span><button type="button" aria-label={text('Trang sau', 'Next page')} disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}><ChevronRight size={17} aria-hidden="true" /></button></div></div>
    {selected && <AccountDialog labelledBy="acc-approve-title" onClose={close} busy={submitting}><div className="acc-section-title"><div><h2 id="acc-approve-title">{text('Xử lý đề xuất', 'Review request')}</h2><p className="acc-muted">{selected.title} · {money(selected.amount, lang)}</p></div><button type="button" className="acc-iconbtn" disabled={submitting} onClick={close} aria-label={text('Đóng', 'Close')}><X size={18} /></button></div>
      <form onSubmit={submit}><fieldset disabled={submitting}><label>{text('Quyết định', 'Decision')}<select value={action} onChange={event => setAction(event.target.value)}><option value="APPROVED">{text('Phê duyệt', 'Approve')}</option><option value="REJECTED">{text('Từ chối', 'Reject')}</option></select></label><label>{text('Ghi chú', 'Comment')} {action === 'REJECTED' ? text('(bắt buộc)', '(required)') : text('(tùy chọn)', '(optional)')}<textarea rows={4} value={comment} onChange={event => setComment(event.target.value)} required={action === 'REJECTED'} /></label></fieldset>
        {error && <p role="alert" className="acc-error">{error}</p>}<div className="acc-modal-actions"><button type="button" disabled={submitting} onClick={close}>{text('Hủy', 'Cancel')}</button><button className="acc-primary" type="submit" disabled={submitting}>{submitting ? text('Đang xử lý…', 'Saving…') : text('Xác nhận', 'Confirm')}</button></div>
      </form>
    </AccountDialog>}
  </section>;
}
