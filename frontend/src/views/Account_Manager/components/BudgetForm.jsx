import { useState } from 'react';
import AccountDialog from './AccountDialog';
import { useAccountLanguage } from '../AccountLanguage';
import { money } from '../AccountData';
import { paymentError } from '../PaymentData';

export default function BudgetForm({ budget, departmentOptions, request, onClose, onSaved }) {
  const { text, lang } = useAccountLanguage();
  const [name, setName] = useState(''), [code, setCode] = useState(''), [amount, setAmount] = useState(budget ? String(budget.allocatedAmount) : ''), [opening, setOpening] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try {
      await request('/finance/budgets' + (budget ? '/' + budget.id : ''), { method: budget ? 'PATCH' : 'POST', body: JSON.stringify(budget ? { allocatedAmount: Number(amount), revision: budget.revision } : { name, code, allocatedAmount: Number(amount), openingCommittedAmount: Number(opening) }) });
      await onSaved();
    } catch (err) { setError(paymentError(err, lang)); }
    finally { setBusy(false); }
  }
  return <AccountDialog labelledBy="acc-budget-title" onClose={onClose} busy={busy}><div className="acc-section-title"><div><h2 id="acc-budget-title">{budget ? text('Điều chỉnh ngân sách', 'Adjust budget') : text('Thiết lập ngân sách phòng ban', 'Set up a department budget')}</h2><p className="acc-muted">{budget?.name || text('Chọn phòng ban đang có trong hệ thống.', 'Choose an existing department.')}</p></div></div><form onSubmit={submit}><fieldset disabled={busy}>
    {!budget && <><label>{text('Phòng ban', 'Department')}<select required value={name} onChange={event => setName(event.target.value)}><option value="">{text('Chọn phòng ban', 'Choose department')}</option>{departmentOptions.map(value => <option key={value} value={value}>{value}</option>)}</select></label><label>{text('Mã phòng ban', 'Department code')}<input className="acc-payment-input" required pattern="[A-Za-z0-9_-]{2,30}" maxLength={30} value={code} onChange={event => setCode(event.target.value)}/></label></>}
    <label>{text('Ngân sách được cấp (VNĐ)', 'Allocated budget (VND)')}<input className="acc-payment-input" type="number" min={budget?.committedAmount || 0} max={budget?.allocatedAmount} step="1" required value={amount} onChange={event => setAmount(event.target.value)}/></label>
    {budget && <p className="acc-muted">{text('Để tăng hạn mức, dùng Yêu cầu bổ sung và chờ Giám đốc phê duyệt.', 'To increase the limit, submit a budget increase request for Director approval.')}</p>}
    {!budget ? <label>{text('Số đã cam kết ban đầu (VNĐ)', 'Opening committed amount (VND)')}<input className="acc-payment-input" type="number" min="0" max={amount || undefined} step="1" required value={opening} onChange={event => setOpening(event.target.value)}/><small className="acc-muted">{text('Nhập theo đối soát thực tế; nhập 0 nếu chưa có cam kết. Không tự gán các đơn cũ chưa xác định phòng ban.', 'Enter a reconciled opening balance, or 0 if none. Historical requests with no department are not assigned automatically.')}</small></label> : <p className="acc-muted">{text('Đã cam kết, không thể giảm thấp hơn', 'Committed amount; the budget cannot be reduced below')}: {money(budget.committedAmount, lang)}</p>}
    </fieldset>{error && <p className="acc-error" role="alert">{error}</p>}<div className="acc-modal-actions"><button type="button" disabled={busy} onClick={onClose}>{text('Hủy', 'Cancel')}</button><button className="acc-primary" type="submit" disabled={busy}>{text('Lưu ngân sách', 'Save budget')}</button></div></form></AccountDialog>;
}
