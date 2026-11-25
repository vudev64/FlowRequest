import { useRef, useState } from 'react';
import { X } from 'lucide-react';
import AccountDialog from './AccountDialog';
import { money } from '../AccountData';
import { useAccountLanguage } from '../AccountLanguage';
import { useSystemConfiguration } from '../../SystemConfiguration';
import { paymentDay, paymentError } from '../PaymentData';

export default function PaymentForm({ row, request, onClose, onRecorded }) {
  const { text, lang } = useAccountLanguage();
  const { settings } = useSystemConfiguration();
  const [key] = useState(() => crypto.randomUUID());
  const [amount, setAmount] = useState(String(row.remainingAmount)), [paidOn, setPaidOn] = useState(paymentDay), [note, setNote] = useState(''), [voucher, setVoucher] = useState(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const lock = useRef(false);
  async function submit(event) {
    event.preventDefault();
    if (lock.current) return;
    const value = Number(amount);
    if (!Number.isSafeInteger(value) || value <= 0 || value > row.remainingAmount || !voucher) { setError(text('Kiểm tra số tiền và chứng từ bắt buộc.', 'Check the payment amount and required voucher.')); return; }
    if (settings?.attachments && voucher.size > settings.attachments.maxSizeMB * 1024 * 1024) { setError(text('Chứng từ vượt dung lượng cho phép.', 'Voucher exceeds the configured size limit.')); return; }
    const body = new FormData(); body.set('amount', amount); body.set('paidOn', paidOn); body.set('note', note); body.set('voucher', voucher);
    lock.current = true; setBusy(true); setError('');
    try { await request(`/${encodeURIComponent(row.id)}/payments`, { method: 'POST', headers: { 'Idempotency-Key': key }, body }); await onRecorded(); }
    catch (err) { setError(paymentError(err, lang)); }
    finally { lock.current = false; setBusy(false); }
  }
  return <AccountDialog labelledBy="acc-payment-title" onClose={onClose} busy={busy}>
    <div className="acc-section-title"><div><h2 id="acc-payment-title">{text('Ghi nhận thanh toán thực tế', 'Record an actual payment')}</h2><p className="acc-muted">{row.title}</p></div><button className="acc-iconbtn" type="button" onClick={onClose} disabled={busy} aria-label={text('Đóng', 'Close')}><X size={17}/></button></div>
    <p className="acc-muted">{text('Còn được thanh toán', 'Remaining approved amount')}: <strong>{money(row.remainingAmount, lang)}</strong></p>
    <form onSubmit={submit}><fieldset disabled={busy}>
      <label>{text('Số tiền thực trả (VNĐ)', 'Actual payment (VND)')}<input className="acc-payment-input" type="number" min="1" max={row.remainingAmount} step="1" required value={amount} onChange={event => setAmount(event.target.value)}/></label>
      <label>{text('Ngày thanh toán', 'Payment date')}<input className="acc-payment-input" type="date" required min={row.approvedAt ? paymentDay(row.approvedAt) : undefined} max={paymentDay()} value={paidOn} onChange={event => setPaidOn(event.target.value)}/></label>
      <label>{text('Chứng từ thanh toán', 'Payment voucher')}<input className="acc-payment-input" type="file" required accept={settings?.attachments?.extensions?.join(',')} onChange={event => setVoucher(event.target.files?.[0] || null)}/>{settings?.attachments && <small className="acc-muted">{settings.attachments.extensions.join(', ')} · {settings.attachments.maxSizeMB} MB</small>}</label>
      <label>{text('Ghi chú', 'Note')}<textarea rows={3} maxLength={2000} value={note} onChange={event => setNote(event.target.value)}/></label>
    </fieldset>{error && <p className="acc-error" role="alert">{error}</p>}<p className="acc-muted">{text('Chỉ xác nhận khoản đã thực trả và có chứng từ. Thao tác này không chuyển tiền qua ngân hàng.', 'Confirm only a completed payment with evidence. This action does not initiate a bank transfer.')}</p><div className="acc-modal-actions"><button type="button" onClick={onClose} disabled={busy}>{text('Hủy', 'Cancel')}</button><button className="acc-primary" type="submit" disabled={busy}>{busy ? text('Đang ghi nhận…', 'Recording…') : text('Xác nhận đã thanh toán', 'Confirm payment made')}</button></div></form>
  </AccountDialog>;
}
