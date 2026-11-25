import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { money, requestTypeLabel } from '../AccountData';
import { dateTime } from '../AccountData';
import { useAccountLanguage } from '../AccountLanguage';
import { paymentDate, paymentError } from '../PaymentData';
import AccountFinanceSummary from './AccountFinanceSummary';
import PaymentForm from './PaymentForm';

export default function AccountPayments({ finance, request, onRecorded, refreshKey, onView }) {
  const { text, lang } = useAccountLanguage();
  const [selected, setSelected] = useState(null), [search, setSearch] = useState(''), [requestId, setRequestId] = useState(''), [page, setPage] = useState(1);
  const [history, setHistory] = useState(null), [loading, setLoading] = useState(false), [error, setError] = useState(null), [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);
  const sequence = useRef(0);
  useEffect(() => {
    if (!request) return;
    const controller = new AbortController(), current = ++sequence.current;
    setLoading(true);
    const query = new URLSearchParams({ page: String(page), ...(requestId ? { requestId } : {}) });
    request('/finance/payments?' + query, { signal: controller.signal }).then(body => {
      if (!Array.isArray(body.data?.items)) throw new Error('Dữ liệu lịch sử không hợp lệ.');
      if (current === sequence.current) { setHistory(body.data); setError(null); }
    }).catch(err => { if (current === sequence.current && err.name !== 'AbortError') setError(err); }).finally(() => { if (current === sequence.current) setLoading(false); });
    return () => { sequence.current++; controller.abort(); };
  }, [request, requestId, page, refreshKey, reload]);
  async function download(payment) {
    try {
      const response = await fetchPaymentVoucher(payment);
      const url = URL.createObjectURL(response), link = document.createElement('a');
      link.href = url; link.download = payment.voucherName; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { setError(err); }
  }
  async function fetchPaymentVoucher(payment) {
    // The dashboard supplies an authenticated binary downloader.
    return request('/finance/payments/' + encodeURIComponent(payment.id) + '/voucher', { binary: true });
  }
  const rows = (finance?.requests || []).filter(row => (row.title + ' ' + row.id + ' ' + row.author.name).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  return <section className="acc-stack acc-payment-workspace">
    <AccountFinanceSummary finance={finance} request={request} onChanged={onRecorded}/>
    <section className="acc-card"><div className="acc-section-title"><div><h2>{text('Đơn đã duyệt và chi phí cần thanh toán', 'Approved requests and outstanding expenses')}</h2><p className="acc-muted">{text('Tiền đã duyệt và thực trả được theo dõi riêng. Có thể ghi nhận nhiều lần trong giới hạn còn được chi.', 'Approval and payment are tracked separately. Partial payments are allowed up to the remaining approved amount.')}</p></div><Link className="acc-text-link" to="/account/approvals">{text('Xem đề xuất mua sắm', 'View purchase requests')}</Link></div>
      {notice && <p className="acc-payment-success" role="status">{notice}</p>}
      <label className="acc-filter">{text('Tìm đề xuất', 'Search requests')}<input className="acc-payment-input" value={search} onChange={event => setSearch(event.target.value)} placeholder={text('Tên, mã đơn hoặc người tạo', 'Title, ID or requester')}/></label>
      <div className="acc-table-wrap"><table className="acc-table"><thead><tr><th>{text('Đề xuất', 'Request')}</th><th>{text('Người tạo', 'Requester')}</th><th>{text('Đã duyệt', 'Approved')}</th><th>{text('Thực trả', 'Paid')}</th><th>{text('Còn phải trả', 'Outstanding')}</th><th>{text('Thao tác', 'Actions')}</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td><strong>{row.title}</strong><small>{requestTypeLabel(row, lang)} · {row.id}</small></td><td>{row.author.name}</td><td className="acc-amount">{money(row.approvedAmount, lang)}</td><td className="acc-amount">{money(row.paidAmount, lang)}</td><td className="acc-amount">{money(row.remainingAmount, lang)}</td><td><div className="acc-actions">
        {row.paymentAllowed && <button type="button" className="acc-review-button" onClick={() => { setSelected(row); setNotice(''); }}>{text('Ghi nhận chi', 'Record payment')}</button>}
        <button type="button" onClick={() => { setRequestId(row.id); setPage(1); }}>{text('Lịch sử', 'History')}</button>
        <button type="button" onClick={() => onView?.({ _id: row.id })}>{text('Chi tiết', 'Details')}</button>
      </div>{row.needsApprovalReview && <small className="acc-error">{text('Cần kiểm tra lịch sử duyệt trước khi chi.', 'Review approval history before payment.')}</small>}{row.needsPaymentReview && <small className="acc-error">{text('Số liệu thanh toán cần đối soát.', 'Payment figures require reconciliation.')}</small>}{row.isOwnRequest && row.remainingAmount > 0 && <small>{text('Cần Kế toán khác xác nhận chi.', 'Another accountant must confirm payment.')}</small>}{!row.remainingAmount && <small>{text('Đã thanh toán đủ', 'Fully paid')}</small>}</td></tr>)}
      {!rows.length && <tr><td colSpan={6} className="acc-empty">{finance ? text('Chưa có đơn đã duyệt phù hợp.', 'No matching approved requests.') : text('Chưa tải được số liệu tài chính.', 'Financial figures are not available yet.')}</td></tr>}</tbody></table></div>
    </section>
    <section className="acc-card"><div className="acc-section-title"><div><h2>{text('Lịch sử thanh toán', 'Payment history')}</h2><p className="acc-muted">{text('Mỗi bản ghi lưu số tiền, ngày thực trả, người ghi nhận và chứng từ.', 'Each entry records amount, payment date, recorder and voucher.')}</p></div>{requestId && <button type="button" className="acc-primary" onClick={() => { setRequestId(''); setPage(1); }}>{text('Xem tất cả', 'View all')}</button>}</div>
      {error && <div className="acc-error-banner" role="alert"><span>{paymentError(error, lang)}</span><button type="button" onClick={() => setReload(value => value + 1)}>{text('Thử lại', 'Retry')}</button></div>}
      {loading && <p className="acc-muted" role="status">{text('Đang tải lịch sử…', 'Loading history…')}</p>}
      <div className="acc-table-wrap"><table className="acc-table"><thead><tr><th>{text('Đề xuất', 'Request')}</th><th>{text('Số tiền', 'Amount')}</th><th>{text('Ngày thanh toán', 'Payment date')}</th><th>{text('Người ghi nhận', 'Recorded by')}</th><th>{text('Chứng từ / Ghi chú', 'Voucher / Note')}</th></tr></thead><tbody>{history?.items.map(item => <tr key={item.id}><td><strong>{item.requestTitle}</strong><small>{item.requestId}</small></td><td className="acc-amount">{money(item.amount, lang)}</td><td>{paymentDate(item.paidOn, lang)}</td><td>{item.performedBy.name}<small>{dateTime(item.createdAt, lang)}</small></td><td><button className="acc-payment-voucher" type="button" onClick={() => download(item)}><Download size={14} aria-hidden="true"/>{item.voucherName}</button>{item.note && <p className="acc-payment-note">{item.note}</p>}</td></tr>)}{history && !history.items.length && <tr><td colSpan={5} className="acc-empty">{text('Chưa có khoản thanh toán được ghi nhận.', 'No payments have been recorded.')}</td></tr>}</tbody></table></div>
      {history && <div className="acc-pagebar"><span>{text('Trang', 'Page')} {history.page}/{history.totalPages} · {history.total}</span><div><button disabled={page <= 1 || loading} onClick={() => setPage(value => value - 1)}>{text('Trước', 'Previous')}</button><button disabled={page >= history.totalPages || loading} onClick={() => setPage(value => value + 1)}>{text('Sau', 'Next')}</button></div></div>}
    </section>
    {selected && <PaymentForm row={selected} request={request} onClose={() => setSelected(null)} onRecorded={async () => { setSelected(null); setNotice(text('Đã ghi nhận thanh toán. Ngân sách không bị trừ lần nữa.', 'Payment recorded. The budget was not charged again.')); setReload(value => value + 1); await onRecorded?.(); }}/>}
  </section>;
}
