import { useCallback, useEffect, useRef, useState } from 'react';
import { useAdminPreferences } from './AdminPreferences';
import AccountDialog from './Account_Manager/components/AccountDialog';
import { useDialogFocus } from './Director/components/useDialogFocus';
import { money, dateTime } from './Account_Manager/AccountData';
import './BudgetIncreasePanel.css';

const endpoint = '/finance/budget-increases';
const labels = { PENDING: ['Chờ Giám đốc', 'Pending Director'], APPROVED: ['Đã duyệt', 'Approved'], REJECTED: ['Đã từ chối', 'Rejected'] };
function DirectorDialog({ children, onClose, busy }) {
  const panel = useRef(null);
  useDialogFocus(panel, true, onClose, busy);
  return <div className="dir-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}><section className="dir-modal" ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="budget-increase-title" aria-busy={busy}><div className="dir-modal-body">{children}</div></section></div>;
}
function BudgetDialog({ director, ...props }) {
  return director ? <DirectorDialog {...props}/> : <AccountDialog labelledBy="budget-increase-title" {...props}/>;
}
function errorMessage(error, lang) {
  if (lang !== 'en') return error.message || 'Không thể xử lý yêu cầu. Hãy thử lại.';
  if (error.status === 401) return 'Your session has expired. Please sign in again.';
  if (error.status === 403) return 'You do not have permission to perform this action.';
  if (error.status === 404) return 'The request or department budget is no longer available.';
  if (error.status === 409) return 'The request has changed or this submission key was already used. Refresh and check the history.';
  if (error.status === 400) return 'Check the amount and reason. Rejections require a reason.';
  return 'Unable to confirm the operation. Check the request list before retrying.';
}
function IncreaseForm({ budgets, request, onClose, onSaved }) {
  const { lang } = useAdminPreferences(), text = (vi, en) => lang === 'en' ? en : vi;
  const [departmentId, setDepartmentId] = useState(budgets[0]?.id || ''), [amount, setAmount] = useState(''), [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const submission = useRef(null), lock = useRef(false);
  const department = budgets.find(row => row.id === departmentId);
  async function submit(event) {
    event.preventDefault(); if (lock.current) return;
    const value = Number(amount);
    if (!department || !Number.isSafeInteger(value) || value <= 0 || !reason.trim()) { setError(text('Cần chọn ngân sách, nhập số tiền nguyên dương và lý do.', 'Choose a budget, a positive whole VND amount, and a reason.')); return; }
    const body = JSON.stringify({ departmentId, amount: value, reason: reason.trim() });
    if (submission.current?.body !== body) submission.current = { body, key: crypto.randomUUID() };
    lock.current = true; setBusy(true); setError('');
    try {
      const result = await request(endpoint, { method: 'POST', headers: { 'Idempotency-Key': submission.current.key }, body });
      onSaved(result.data);
    } catch (err) { setError(errorMessage(err, lang)); }
    finally { lock.current = false; setBusy(false); }
  }
  return <BudgetDialog busy={busy} onClose={onClose}><div className="budget-increases"><h2 id="budget-increase-title">{text('Yêu cầu bổ sung ngân sách', 'Request a budget increase')}</h2><p className="budget-increases__muted">{text('Hạn mức chỉ tăng sau khi Giám đốc phê duyệt.', 'The limit increases only after Director approval.')}</p><form className="budget-increases__form" onSubmit={submit}><fieldset disabled={busy}>
    <label>{text('Phòng ban', 'Department')}<select required value={departmentId} onChange={event => setDepartmentId(event.target.value)}>{budgets.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
    {department && <p className="budget-increases__muted">{text('Hạn mức hiện tại', 'Current limit')}: {money(department.allocatedAmount, lang)}</p>}
    <label>{text('Số tiền bổ sung (VNĐ)', 'Additional amount (VND)')}<input type="number" min="1" step="1" required value={amount} onChange={event => setAmount(event.target.value)}/></label>
    <label>{text('Lý do', 'Reason')}<textarea required maxLength={2000} rows={4} value={reason} onChange={event => setReason(event.target.value)}/></label>
    </fieldset>{error && <p className="budget-increases__error" role="alert">{error}</p>}<div className="acc-modal-actions"><button type="button" disabled={busy} onClick={onClose}>{text('Hủy', 'Cancel')}</button><button className="acc-primary" disabled={busy}>{busy ? text('Đang gửi…', 'Submitting…') : text('Gửi yêu cầu', 'Submit request')}</button></div></form></div></BudgetDialog>;
}
function IncreaseDetail({ row, director, request, onClose, onChanged }) {
  const { lang } = useAdminPreferences(), text = (vi, en) => lang === 'en' ? en : vi;
  const [reason, setReason] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [current, setCurrent] = useState(row);
  const lock = useRef(false);
  const actionClass = director ? 'dir-btn dir-btn-primary' : 'acc-primary';
  async function decide(action) {
    if (lock.current) return;
    if (action === 'REJECTED' && !reason.trim()) { setError(text('Vui lòng nhập lý do từ chối.', 'Please enter a rejection reason.')); return; }
    lock.current = true; setBusy(true); setError('');
    try {
      const result = await request(`${endpoint}/${current.id}/decision`, { method: 'PATCH', body: JSON.stringify({ action, reason: reason.trim() }) });
      onChanged(result.data); onClose();
    } catch (err) {
      setError(errorMessage(err, lang)); onChanged();
      if (err.status === 409) {
        try { const latest = await request(`${endpoint}/${current.id}`); setCurrent(latest.data); } catch { /* Keep the error and original record for review. */ }
      }
    } finally { lock.current = false; setBusy(false); }
  }
  const status = labels[current.status] || ['', ''];
  return <BudgetDialog director={director} busy={busy} onClose={onClose}><div className="budget-increases"><h2 id="budget-increase-title">{text('Chi tiết bổ sung ngân sách', 'Budget increase details')}</h2><dl className="budget-increases__details">
    {[[text('Phòng ban', 'Department'), current.department.name], [text('Người gửi', 'Requested by'), current.createdBy.name], [text('Ngày gửi', 'Submitted'), dateTime(current.createdAt, lang)], [text('Trạng thái', 'Status'), status[lang === 'en' ? 1 : 0]], [text('Số tiền bổ sung', 'Additional amount'), money(current.amount, lang)], [text('Hạn mức hiện tại', 'Current limit'), current.department.allocatedAmount == null ? '—' : money(current.department.allocatedAmount, lang)]].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl><h3>{text('Lý do yêu cầu', 'Request reason')}</h3><p className="budget-increases__reason">{current.reason}</p>
    {current.status !== 'PENDING' && <div className="budget-increases__decision"><h3>{text('Kết quả xử lý', 'Decision')}</h3><p>{current.decidedBy?.name || '—'} · {dateTime(current.decidedAt, lang)}</p><p>{text('Hạn mức trước / sau', 'Limit before / after')}: {current.budgetBefore == null ? '—' : money(current.budgetBefore, lang)} / {current.budgetAfter == null ? '—' : money(current.budgetAfter, lang)}</p>{current.decisionReason && <p className="budget-increases__reason">{current.decisionReason}</p>}</div>}
    {director && current.status === 'PENDING' && <label className="budget-increases__form">{text('Ghi chú — bắt buộc khi từ chối', 'Comment — required for rejection')}<textarea rows={3} maxLength={2000} value={reason} disabled={busy} onChange={event => setReason(event.target.value)}/></label>}
    {error && <p className="budget-increases__error" role="alert">{error}</p>}
    <div className={director ? 'dir-modal-actions' : 'acc-modal-actions'}><button className={director ? 'dir-btn dir-btn-ghost' : undefined} type="button" disabled={busy} onClick={onClose}>{text('Đóng', 'Close')}</button>{director && current.status === 'PENDING' && <><button className="dir-btn dir-btn-danger" type="button" disabled={busy} onClick={() => decide('REJECTED')}>{text('Từ chối', 'Reject')}</button><button className={actionClass} type="button" disabled={busy} onClick={() => decide('APPROVED')}>{busy ? text('Đang xử lý…', 'Processing…') : text('Duyệt bổ sung', 'Approve increase')}</button></>}</div>
    </div></BudgetDialog>;
}
export default function BudgetIncreasePanel({ role, budgets = [], request, onBudgetChanged, refreshKey }) {
  const director = role === 'DIRECTOR';
  const { lang } = useAdminPreferences(), text = (vi, en) => lang === 'en' ? en : vi;
  const [status, setStatus] = useState(director ? 'PENDING' : ''), [page, setPage] = useState(1), [revision, setRevision] = useState(0);
  const [data, setData] = useState(null), [error, setError] = useState(null), [loading, setLoading] = useState(false), [selected, setSelected] = useState(null), [creating, setCreating] = useState(false);
  const [detailError, setDetailError] = useState(null), [detailLoading, setDetailLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const detailSequence = useRef(0);
  useEffect(() => {
    const controller = new AbortController(); let latest = 0;
    const load = async () => {
      const ticket = ++latest; setLoading(true);
      try { const result = await request(`${endpoint}?page=${page}&status=${status}`, { signal: controller.signal }); if (!Array.isArray(result.data?.items) || !Number.isSafeInteger(result.data.totalPages) || result.data.totalPages < 1) throw new Error('Dữ liệu yêu cầu không hợp lệ.'); if (!controller.signal.aborted && ticket === latest) { setData(result.data); setError(null); if (page > result.data.totalPages) setPage(result.data.totalPages); } }
      catch (err) { if (!controller.signal.aborted && ticket === latest) setError(err); }
      finally { if (!controller.signal.aborted && ticket === latest) setLoading(false); }
    };
    void load();
    const update = () => { if (document.visibilityState !== 'hidden') void load(); };
    const timer = window.setInterval(update, 30000); window.addEventListener('focus', update);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener('focus', update); };
  }, [request, page, status, revision, refreshKey]);
  useEffect(() => () => { detailSequence.current++; }, []);
  const changed = useCallback(result => {
    setRevision(value => value + 1);
    if (result?.status === 'APPROVED') setNotice(lang === 'en' ? `Approved. The new limit is ${money(result.budgetAfter, lang)}.` : `Đã duyệt. Hạn mức mới là ${money(result.budgetAfter, lang)}.`);
    else if (result?.status === 'REJECTED') setNotice(lang === 'en' ? 'Rejected. The budget is unchanged.' : 'Đã từ chối. Ngân sách giữ nguyên.');
    void onBudgetChanged?.();
  }, [onBudgetChanged, lang]);
  async function view(row) {
    const ticket = ++detailSequence.current; setDetailLoading(true); setDetailError(null);
    try { const result = await request(`${endpoint}/${row.id}`); if (ticket === detailSequence.current) setSelected(result.data); }
    catch (err) { if (ticket === detailSequence.current) setDetailError(err); }
    finally { if (ticket === detailSequence.current) setDetailLoading(false); }
  }
  const close = () => { detailSequence.current++; setSelected(null); };
  return <section className={`budget-increases ${director ? 'dir-panel' : 'budget-increases--embedded'}`} aria-label={text('Bổ sung ngân sách', 'Budget increases')}>
    <div className={director ? 'dir-panel-head' : 'acc-section-title'}><div><h2>{text('Bổ sung ngân sách', 'Budget increases')}</h2><p className="budget-increases__muted">{director ? text('Xét duyệt yêu cầu từ Kế toán. Duyệt mới tăng hạn mức, không thay đổi tiền đã cam kết hoặc đã trả.', 'Review accounting requests. Approval increases the limit without changing commitments or payments.') : text('Theo dõi yêu cầu của bạn. Chỉ yêu cầu được Giám đốc duyệt mới tăng hạn mức.', 'Track your requests. Only Director-approved requests increase the limit.')}</p></div>{!director && <button className="acc-primary" type="button" disabled={!budgets.length} onClick={() => setCreating(true)}>{text('Yêu cầu bổ sung', 'Request increase')}</button>}</div>
    {!director && !budgets.length && <p className="budget-increases__muted">{text('Cần thiết lập ngân sách phòng ban trước khi gửi yêu cầu bổ sung.', 'Set up a department budget before requesting an increase.')}</p>}
    {notice && <p role="status">{notice}</p>}
    <label className="budget-increases__filter">{text('Trạng thái', 'Status')}<select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">{text('Tất cả', 'All')}</option>{Object.entries(labels).map(([value,pair]) => <option key={value} value={value}>{pair[lang === 'en' ? 1 : 0]}</option>)}</select></label>
    {loading && <p role="status" className="budget-increases__muted">{text('Đang tải yêu cầu…', 'Loading requests…')}</p>}
    {error && <p className="budget-increases__error" role="alert">{errorMessage(error, lang)} <button type="button" onClick={() => setRevision(value => value + 1)}>{text('Thử lại', 'Retry')}</button></p>}
    {detailLoading && <p role="status">{text('Đang tải chi tiết…', 'Loading details…')}</p>}{detailError && <p role="alert" className="budget-increases__error">{errorMessage(detailError, lang)}</p>}
    {data && <><div className={director ? 'dir-table-wrap' : 'acc-table-wrap'}><table className={director ? 'dir-table' : 'acc-table'}><thead><tr>{[text('Phòng ban', 'Department'),text('Số tiền bổ sung', 'Additional amount'),text('Ngày gửi', 'Submitted'),text('Trạng thái', 'Status'),text('Thao tác', 'Actions')].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{data.items.map(row => <tr key={row.id}><td><strong>{row.department.name}</strong><small>{row.createdBy.name}</small></td><td>{money(row.amount, lang)}</td><td>{dateTime(row.createdAt, lang)}</td><td>{labels[row.status]?.[lang === 'en' ? 1 : 0] || row.status}</td><td><button className={director ? 'dir-btn dir-btn-ghost' : 'acc-text-link'} type="button" onClick={() => view(row)}>{director && row.status === 'PENDING' ? text('Xét duyệt', 'Review') : text('Chi tiết', 'Details')}</button></td></tr>)}{!data.items.length && <tr><td colSpan={5}>{text('Chưa có yêu cầu phù hợp.', 'No matching requests.')}</td></tr>}</tbody></table></div><div className="budget-increases__pagination"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage(value => value - 1)}>{text('Trước', 'Previous')}</button><span>{text('Trang', 'Page')} {page} / {data.totalPages}</span><button type="button" disabled={page >= data.totalPages || loading} onClick={() => setPage(value => value + 1)}>{text('Sau', 'Next')}</button></div></>}
    {creating && <IncreaseForm budgets={budgets} request={request} onClose={() => setCreating(false)} onSaved={result => {
      setCreating(false); setStatus(''); setPage(1); changed();
      setNotice(result.replayed ? text('Yêu cầu đã tồn tại. Danh sách được tải lại để xem kết quả hiện tại.', 'The request already exists. Refreshing its current result.') : text('Đã gửi Giám đốc xét duyệt. Ngân sách giữ nguyên.', 'Submitted for Director approval. The budget is unchanged.'));
    }}/>}
    {selected && <IncreaseDetail key={selected.id} row={selected} director={director} request={request} onClose={close} onChanged={changed}/>}
  </section>;
}
