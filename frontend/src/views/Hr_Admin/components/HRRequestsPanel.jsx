import { systemTimeZone } from "../../../lib/systemConfiguration";
import { useAdminPreferences } from "../../AdminPreferences";
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { apiRequest } from '../../../lib/api';
import RequestDetailModal from '../../Employee/components/RequestDetailModal';
import { copy, mapApiRequestToEmployee } from '../../Employee/EmployeeData';
import { HR_TYPES, canHrProcess } from '../HRRequestData';
import { API_BASE_URL } from '../../../lib/api';
import { TOKEN_KEY, assertApiEnvironment } from '../../../lib/environment';
const statusLabels = {
  PENDING_MANAGER: 'Chờ quản lý',
  PENDING_DIRECTOR: 'Chờ giám đốc',
  PENDING_HRADMIN: 'Chờ HR',
  PENDING_ACCOUNTANT: 'Chờ kế toán',
  APPROVED: 'Hoàn tất',
  REJECTED: 'Từ chối',
  CANCELLED: 'Đã hủy'
};
export default function HRRequestsPanel({
  requests,
  user,
  reload,
  history = false
}) {
  const {
    t: translate
  } = useAdminPreferences();
  const {
    lang
  } = useAdminPreferences();
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [scope, setScope] = useState('pending');
  const [detail, setDetail] = useState(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [decision, setDecision] = useState(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const lock = useRef(false);
  const detailSequence = useRef(0);
  const filtered = useMemo(() => requests.filter(r => {
    const inScope = history ? r.approvalHistory?.some(e => e.role === 'HR_ADMIN' || String(e.approverId?._id || e.approverId) === String(user?.id || user?._id)) : scope === 'all' || r.status === 'PENDING_HRADMIN';
    return inScope && (!type || r.type === type) && `${r.title} ${r.author?.name || ''} ${r._id}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  }), [requests, history, scope, type, query, user]);
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * 10, currentPage * 10);
  async function openDetail(id) {
    const sequence = ++detailSequence.current;
    setDetailBusy(true);
    try {
      const result = await apiRequest(`/request/${id}`);
      if (sequence === detailSequence.current) setDetail(mapApiRequestToEmployee(result.data, lang));
    } catch (error) {
      toast.error(error.message);
    } finally {
      if (sequence === detailSequence.current) setDetailBusy(false);
    }
  }
  async function downloadAttachment(request) {
    try {
      const base = API_BASE_URL;
      const response = await fetch(`${base}/hr/requests/${request._id}/attachment`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY)}`
        }
      });
      assertApiEnvironment(response);
      if (!response.ok) throw new Error('Không thể tải tài liệu hoặc bạn không có quyền truy cập.');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = request.attachment.split('/').at(-1);
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      toast.error(error.message);
    }
  }
  async function submit(event) {
    event.preventDefault();
    if (lock.current) return;
    if (!canHrProcess(decision.request, user)) return toast.error('Đơn không thuộc quyền xử lý của bạn.');
    if (decision.action === 'REJECTED' && comment.trim().length < 10) return toast.error('Lý do từ chối cần ít nhất 10 ký tự.');
    lock.current = true;
    setBusy(true);
    try {
      const result = await apiRequest(`/request/${decision.request._id}/status`, {
        method: 'PATCH',
        body: {
          action: decision.action,
          comment: comment.trim()
        }
      });
      setDecision(null);
      toast.success(result.message);
      await reload();
    } catch (error) {
      toast.error(error.message);
      await reload();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return <section className="hr-requests-panel">
    {detailBusy && <p role="status">{translate("\u0110ang t\u1EA3i chi ti\u1EBFt v\xE0 l\u1ECBch s\u1EED ph\xEA duy\u1EC7t\u2026")}</p>}
    <div className="page-heading"><div><div className="eyebrow">{history ? translate('Tra cứu & theo dõi') : translate('Không gian xét duyệt')}</div><h2>{history ? translate('Lịch sử phê duyệt') : translate('Xét duyệt đơn nhân sự')}</h2><p>{history ? translate('Tra cứu các đơn đã được HR xử lý và theo dõi kết quả phê duyệt.') : translate('Xét duyệt nghỉ phép, tăng ca, chấm công, đào tạo và tuyển dụng.')}</p></div><span className="hr-result-count">{filtered.length}{' '}{translate("\u0111\u01A1n")}</span></div>
    <div className="toolbar hr-request-filters"><input aria-label={translate("Tìm đơn")} placeholder={translate("Tìm tiêu đề, nhân viên hoặc mã đơn…")} value={query} onChange={e => {
        setQuery(e.target.value);
        setPage(1);
      }} /><select aria-label={translate("Loại đơn")} value={type} onChange={e => {
        setType(e.target.value);
        setPage(1);
      }}><option value="">{translate("T\u1EA5t c\u1EA3 lo\u1EA1i \u0111\u01A1n")}</option>{Object.entries(HR_TYPES).map(([key, label]) => <option key={key} value={key}>{translate(label)}</option>)}</select>{!history && <select aria-label={translate("Phạm vi đơn")} value={scope} onChange={e => {
        setScope(e.target.value);
        setPage(1);
      }}><option value="pending">{translate("\u0110ang ch\u1EDD HR")}</option><option value="all">{translate("T\u1EA5t c\u1EA3 \u0111\u01A1n thu\u1ED9c ph\u1EA1m vi HR")}</option></select>}</div>
    <div className="hr-request-table"><table><thead><tr><th>{translate("\u0110\u1EC1 xu\u1EA5t / nh\xE2n vi\xEAn")}</th><th>{translate("Lo\u1EA1i \u0111\u01A1n")}</th><th>{translate("Tr\u1EA1ng th\xE1i")}</th><th>{translate("C\u1EADp nh\u1EADt")}</th><th>{translate("Thao t\xE1c")}</th></tr></thead><tbody>{visible.map(r => <tr key={r._id}><td><button className="text-button hr-request-title" onClick={() => openDetail(r._id)}>{r.title}</button><small>{r.author?.name || '—'} · {r.author?.department || r.department?.name || '—'}</small></td><td>{translate(HR_TYPES[r.type] || r.type)}</td><td><span className={`hr-status-tag hr-status-tag--${r.status.toLowerCase()}`}>{translate(statusLabels[r.status] || r.status)}</span></td><td><span className="hr-update-date">{new Date(r.updatedAt).toLocaleDateString(lang === 'en' ? 'en-GB' : 'vi-VN', {
                  timeZone: systemTimeZone()
                })}</span><small>{new Date(r.updatedAt).toLocaleTimeString(lang === 'en' ? 'en-GB' : 'vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: systemTimeZone()
                })}</small></td><td><div className="hr-row-actions"><button className="secondary-button" onClick={() => openDetail(r._id)}>{translate("Xem chi ti\u1EBFt")}</button>{!history && canHrProcess(r, user) && <><button className="primary-button" disabled={busy} onClick={() => {
                    setComment('');
                    setDecision({
                      request: r,
                      action: 'APPROVED'
                    });
                  }}>{translate("Duy\u1EC7t")}</button><button className="reject-button" disabled={busy} onClick={() => {
                    setComment('');
                    setDecision({
                      request: r,
                      action: 'REJECTED'
                    });
                  }}>{translate("T\u1EEB ch\u1ED1i")}</button></>}</div></td></tr>)}</tbody></table>{!filtered.length && <div className="empty-state"><h3>{translate("Kh\xF4ng c\xF3 \u0111\u01A1n ph\xF9 h\u1EE3p")}</h3><p>{translate("Thay \u0111\u1ED5i b\u1ED9 l\u1ECDc ho\u1EB7c ch\u1EDD \u0111\u1EC1 xu\u1EA5t \u0111\u01B0\u1EE3c chuy\u1EC3n \u0111\u1EBFn HR.")}</p></div>}</div>
    <div className="hr-pagination"><button className="secondary-button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>{translate("Tr\u01B0\u1EDBc")}</button><span>{translate("Trang")}{' '}{currentPage} / {pages}</span><button className="secondary-button" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>{translate("Sau")}</button></div>
    {detail && <RequestDetailModal item={detail} lang={lang} t={copy[lang]} footerActions={detail.attachment ? <button className="secondary-button" onClick={() => downloadAttachment({
      _id: detail.id,
      attachment: detail.attachment
    })}>{translate("T\u1EA3i t\xE0i li\u1EC7u \u0111\xEDnh k\xE8m")}</button> : null} onClose={() => {
      detailSequence.current++;
      setDetail(null);
    }} />}
    {decision && <div className="modal-backdrop"><form className="modal" role="dialog" aria-modal="true" aria-labelledby="hr-decision-title" onSubmit={submit}><div className="modal-header"><h2 id="hr-decision-title">{decision.action === 'APPROVED' ? translate('Xác nhận phê duyệt') : translate('Từ chối đề xuất')}</h2></div><div className="hr-decision-body"><b>{decision.request.title}</b><p>{decision.request.type === 'TRAINING' && decision.request.amount > 0 ? translate('Sau khi HR duyệt, đơn sẽ chuyển sang kế toán.') : translate('Thao tác sẽ được lưu vào lịch sử phê duyệt.')}</p><label>{translate("Ghi ch\xFA")}{decision.action === 'REJECTED' && translate('(bắt buộc, tối thiểu 10 ký tự)')}<textarea autoFocus value={comment} maxLength={2000} onChange={e => setComment(e.target.value)} required={decision.action === 'REJECTED'} /></label></div><div className="modal-actions"><button type="button" className="secondary-button" disabled={busy} onClick={() => setDecision(null)}>{translate("H\u1EE7y")}</button><button className="primary-button" disabled={busy}>{busy ? translate('Đang lưu…') : translate('Xác nhận')}</button></div></form></div>}
  </section>;
}
