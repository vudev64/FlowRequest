import { money } from '../AccountData';
import { useAccountLanguage } from '../AccountLanguage';
import { useState } from 'react';
import BudgetForm from './BudgetForm';
import BudgetIncreasePanel from '../../BudgetIncreasePanel';

export default function AccountFinanceSummary({ finance, request, onChanged }) {
  const { text, lang } = useAccountLanguage();
  const [editor, setEditor] = useState(null);
  const availableDepartments = (finance?.departmentOptions || []).filter(name => !finance.budgets.some(row => row.name === name));
  return <section className="acc-card acc-budget-note">
    <div className="acc-section-title"><div><h2>{text('Ngân sách và thanh toán', 'Budgets and payments')}</h2><p className="acc-muted">{text('Ngân sách mua sắm được cam kết khi duyệt cuối. Ghi nhận thanh toán không trừ ngân sách lần nữa. Công tác và đào tạo giữ nguyên quy tắc ngân sách hiện hành.', 'Purchase budgets are committed at final approval. Recording payment does not charge the budget again. Existing budget rules for trips and training remain unchanged.')}</p></div>{request && availableDepartments.length > 0 && <button type="button" className="acc-primary" onClick={() => setEditor({})}>{text('Thiết lập ngân sách', 'Set up budget')}</button>}</div>
    <dl className="acc-finance-totals">{[
      [text('Tiền đã duyệt', 'Approved amount'), finance?.approvedAmount],
      [text('Thực trả đã ghi nhận', 'Recorded payments'), finance?.paidAmount],
      [text('Còn phải thanh toán', 'Outstanding amount'), finance?.outstandingAmount],
    ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value == null ? '—' : money(value, lang)}</dd></div>)}</dl>
    {finance?.budgets?.length ? <div className="acc-table-wrap"><table className="acc-table"><thead><tr><th>{text('Phòng ban', 'Department')}</th><th>{text('Ngân sách được cấp', 'Allocated budget')}</th><th>{text('Đã cam kết', 'Committed')}</th><th>{text('Còn khả dụng', 'Available')}</th><th>{text('Thực trả mua sắm', 'Purchase payments')}</th>{request && <th>{text('Thao tác', 'Actions')}</th>}</tr></thead><tbody>{finance.budgets.map(row => <tr key={row.id}><td>{row.name}</td><td className="acc-amount">{money(row.allocatedAmount, lang)}</td><td className="acc-amount">{money(row.committedAmount, lang)}</td><td className="acc-amount">{money(row.availableAmount, lang)}</td><td className="acc-amount">{money(row.paidAmount, lang)}</td>{request && <td><div className="acc-actions"><button type="button" onClick={() => setEditor({ budget: row })}>{text('Điều chỉnh', 'Adjust')}</button></div></td>}</tr>)}</tbody></table></div> : <p className="acc-muted">{finance ? text('Chưa có ngân sách phòng ban được cấu hình.', 'No department budgets have been configured.') : text('Đang chờ số liệu tài chính từ máy chủ.', 'Waiting for financial figures from the server.')}</p>}
    {finance?.unassignedApprovedAmount > 0 && <p className="acc-muted">{text('Đơn mua sắm đã duyệt chưa gắn phòng ban, cần đối soát riêng', 'Approved purchases without a department require separate reconciliation')}: {money(finance.unassignedApprovedAmount, lang)}</p>}
    {finance?.unassignedPaidAmount > 0 && <p className="acc-muted">{text('Thực trả mua sắm chưa gắn phòng ban', 'Purchase payments without a department')}: {money(finance.unassignedPaidAmount, lang)}</p>}
    {request && <BudgetIncreasePanel role="ACCOUNTANT" budgets={finance?.budgets || []} request={request} onBudgetChanged={onChanged} refreshKey={finance}/>}
    {editor && <BudgetForm budget={editor.budget} departmentOptions={availableDepartments} request={request} onClose={() => setEditor(null)} onSaved={async () => { setEditor(null); await onChanged?.(); }}/>}
  </section>;
}
