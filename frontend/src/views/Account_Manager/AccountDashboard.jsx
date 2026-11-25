import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import AccountSidebar from './components/AccountSidebar';
import AccountTopbar from './components/AccountTopbar';
import AccountOverview from './components/AccountOverview';
import AccountApprovals from './components/AccountApprovals';
import AccountPayments from './components/AccoutnPayments';
import AccountDialog from './components/AccountDialog';
import AccountStatus from './components/AccountStatus';
import { API_BASE_URL } from '../../lib/api';
import { readApiResponse } from '../../lib/apiResponse';
import { assertApiEnvironment } from '../../lib/environment';
import { AdminPreferencesProvider, useAdminPreferences } from '../AdminPreferences';
import { useAccountLanguage } from './AccountLanguage';
import { money, dateTime, displayName, requestTypeLabel, roleLabel, canDecide } from './AccountData';
import './Account.css';

const extractRequests = body => Array.isArray(body) ? body : [body?.data, body?.requests, body?.data?.requests].find(Array.isArray);
const departmentLabel = department => typeof department === 'object' ? department?.name || '—' : department || '—';
const attachmentUrl = (value, apiBase) => {
  if (typeof value !== 'string' || !value) return null;
  try { const url = new URL(value, new URL(apiBase, window.location.origin).origin); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; } catch { return null; }
};

function RequestDetailModal({ detail, onClose, apiBase, onDownload }) {
  const { text, lang } = useAccountLanguage();
  const file = attachmentUrl(detail.attachment, apiBase);
  const fields = [
    [text('Mã đơn', 'Request ID'), detail._id], [text('Loại', 'Category'), requestTypeLabel(detail, lang)],
    [text('Người tạo', 'Requester'), displayName(detail.author)], [text('Phòng ban', 'Department'), departmentLabel(detail.department)],
    [text('Giá trị', 'Amount'), money(detail.amount, lang)], [text('Trạng thái', 'Status'), <AccountStatus key="status" status={detail.status} />],
    [text('Ngày tạo', 'Created at'), dateTime(detail.createdAt, lang)], [text('Nội dung', 'Content'), detail.content || '—'],
  ];
  const extraFields = detail.type === 'BUNSINESS_TRIP' ? [['destination', 'Điểm đến', 'Destination'], ['purpose', 'Mục đích', 'Purpose'], ['fromDate', 'Từ ngày', 'From date'], ['toDate', 'Đến ngày', 'To date']] : detail.type === 'TRAINING' ? [['courseName', 'Khóa đào tạo', 'Course'], ['provider', 'Đơn vị đào tạo', 'Provider'], ['fromDate', 'Từ ngày', 'From date'], ['toDate', 'Đến ngày', 'To date']] : [];
  for (const [key, vi, en] of extraFields) {
    const value = detail.extraDetails?.[key];
    if (value != null && value !== '') fields.push([text(vi, en), key.endsWith('Date') ? String(value).slice(0, 10) : String(value)]);
  }
  const history = detail.approvalHistory || [];
  return <AccountDialog wide labelledBy="acc-detail-title" onClose={onClose}><div className="acc-section-title"><div><p className="acc-breadcrumb">{text('Chi tiết đề xuất', 'Request details')}</p><h2 id="acc-detail-title">{detail.title}</h2></div><button type="button" className="acc-iconbtn" onClick={onClose} aria-label={text('Đóng chi tiết', 'Close details')}><X size={18} /></button></div>
    <dl className="acc-detail-grid">{fields.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}<div><dt>{text('Chứng từ', 'Attachment')}</dt><dd>{file ? <a href={file} className="acc-text-link" onClick={event => { event.preventDefault(); onDownload(detail); }}>{text('Xem tệp đính kèm', 'Open attachment')}</a> : text('Không có tệp đính kèm.', 'No attachment.')}</dd></div></dl>
    <h3 className="acc-history-title">{text('Lịch sử phê duyệt', 'Approval history')}</h3>
    {history.length ? <ol className="acc-history">{history.map((entry, index) => <li key={entry._id || index}><div><strong>{displayName(entry.approverId)}</strong><span>{roleLabel(entry.role, lang)}</span><time dateTime={entry.timestamp}>{dateTime(entry.timestamp, lang)}</time></div><p><AccountStatus status={entry.action} />{entry.fromStatus && entry.toStatus && <span>{text('Từ', 'From')} <AccountStatus status={entry.fromStatus} /> {text('đến', 'to')} <AccountStatus status={entry.toStatus} /></span>}</p>{entry.comment && <blockquote>{entry.comment}</blockquote>}</li>)}</ol> : <p className="acc-empty">{text('Chưa có lịch sử phê duyệt.', 'No approval history yet.')}</p>}
    <div className="acc-modal-actions"><button type="button" onClick={onClose}>{text('Đóng', 'Close')}</button></div>
  </AccountDialog>;
}

function AccountWorkspace({ token, user, onLogout, apiBase = `${API_BASE_URL.replace(/\/$/, '')}/request` }) {
  const { theme, lang } = useAdminPreferences();
  const { text } = useAccountLanguage();
  const location = useLocation();
  const active = location.pathname.toLowerCase().endsWith('/approvals') ? 'approvals' : location.pathname.toLowerCase().endsWith('/payments') ? 'payments' : 'overview';
  const [requests, setRequests] = useState([]), [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false), [loaded, setLoaded] = useState(false), [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false), [lastUpdated, setLastUpdated] = useState(null);
  const [finance, setFinance] = useState(null), [financeError, setFinanceError] = useState(null);
  const [detail, setDetail] = useState(null), [detailLoading, setDetailLoading] = useState(false);
  const sequence = useRef(0), detailSequence = useRef(0), writeLock = useRef(false);
  const request = useCallback(async (suffix = '', options = {}) => {
    if (!token) throw Object.assign(new Error(), { status: 401 });
    const response = await fetch(`${apiBase}${suffix}`, { ...options, headers: { Authorization: `Bearer ${token}`, ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) } });
    assertApiEnvironment(response);
    if (options.binary && response.ok) {
      if (/application\/json|text\/html/.test(response.headers.get('content-type') || '')) throw Object.assign(new Error('Phản hồi chứng từ không hợp lệ.'), { kind: 'format' });
      return response.blob();
    }
    return readApiResponse(response, `${apiBase}${suffix}`);
  }, [apiBase, token]);
  const load = useCallback(async ({ silent = false, signal } = {}) => {
    const current = ++sequence.current;
    if (!silent) setLoading(true);
    try {
      const [list, financial] = await Promise.allSettled([request('', { signal }), request('/finance/summary', { signal })]);
      if (current !== sequence.current) return;
      if (financial.status === 'fulfilled' && financial.value?.data && Array.isArray(financial.value.data.requests) && Array.isArray(financial.value.data.budgets)) { setFinance(financial.value.data); setFinanceError(null); }
      else if (financial.status !== 'rejected' || financial.reason.name !== 'AbortError') setFinanceError(financial.reason || new Error('Dữ liệu tài chính không hợp lệ.'));
      if (list.status === 'rejected') throw list.reason;
      const rows = extractRequests(list.value);
      if (!rows) throw Object.assign(new Error(), { kind: 'format' });
      if (current === sequence.current) { setRequests(rows); setLoaded(true); setLastUpdated(new Date()); setError(null); }
    } catch (err) { if (current === sequence.current && err.name !== 'AbortError') setError(err); }
    finally { if (current === sequence.current) setLoading(false); }
  }, [request]);
  useEffect(() => {
    const controller = new AbortController();
    load({ signal: controller.signal });
    const refresh = () => { if (document.visibilityState !== 'hidden') load({ silent: true, signal: controller.signal }); };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { sequence.current++; detailSequence.current++; controller.abort(); window.clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [load]);
  const closeDetail = useCallback(() => { detailSequence.current++; setDetail(null); setDetailLoading(false); }, []);
  const downloadAttachment = async row => {
    try {
      const blob = await request(`/${encodeURIComponent(row._id)}/attachment`, { binary: true });
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = String(row.attachment).split('/').at(-1); document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { setError(err); }
  };
  const openDetail = async row => {
    const current = ++detailSequence.current;
    setDetail(null); setDetailLoading(true);
    try { const body = await request(`/${encodeURIComponent(row._id)}`); if (current === detailSequence.current) setDetail(body.data || body.request || body); }
    catch (err) { if (current === detailSequence.current) setError(err); }
    finally { if (current === detailSequence.current) setDetailLoading(false); }
  };
  const decide = async (id, action, comment) => {
    if (writeLock.current) throw new Error(text('Đang xử lý yêu cầu trước.', 'A request is already being processed.'));
    const row = requests.find(item => String(item._id) === String(id));
    if (!row || !canDecide(row, user)) throw new Error(text('Đơn không thuộc quyền xử lý của bạn.', 'You cannot review this request.'));
    writeLock.current = true; setSubmitting(true);
    try { await request(`/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ action, comment }) }); await load(); }
    finally { writeLock.current = false; setSubmitting(false); }
  };
  const errorText = !error ? '' : error.status === 401 ? text('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'Your session has expired. Please sign in again.') : error.kind === 'format' ? text('Dữ liệu danh sách đơn không hợp lệ.', 'The request list response is invalid.') : error instanceof TypeError ? text('Không thể kết nối máy chủ. Vui lòng thử lại.', 'Cannot connect to the server. Please retry.') : error.message || text('Không thể tải dữ liệu.', 'Unable to load data.');
  const matching = requests.filter(row => `${row.title || ''} ${row._id || ''}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  return <div className="acc-shell" data-theme={theme} data-role="Accountant" lang={lang}>
    <AccountSidebar user={user} onLogout={onLogout} />
    <main className="acc-main"><AccountTopbar active={active} user={user} search={search} onSearch={setSearch} onRefresh={() => load()} loading={loading} />
      <div className="acc-content"><div className="acc-data-note"><span>{text('Dữ liệu từ hệ thống · tự cập nhật mỗi 30 giây', 'System data · refreshes every 30 seconds')}</span>{lastUpdated && <span>{text('Đồng bộ', 'Synced')}: {dateTime(lastUpdated, lang)}</span>}</div>
        {error && <div className="acc-error-banner" role="alert"><span>{errorText}</span><button type="button" onClick={error.status === 401 && onLogout ? onLogout : () => load()}>{error.status === 401 ? text('Đăng nhập lại', 'Sign in again') : text('Thử lại', 'Retry')}</button></div>}
        {loading && <p className="acc-muted" role="status">{text('Đang tải dữ liệu…', 'Loading data…')}</p>}
        {financeError && <div className="acc-error-banner" role="alert"><span>{text('Không thể đồng bộ số liệu tài chính. Số liệu trước đó có thể chưa cập nhật.', 'Financial figures could not be synchronized. Previously loaded figures may be out of date.')}</span><button type="button" onClick={() => load()}>{text('Thử lại', 'Retry')}</button></div>}
        {loaded && <Routes><Route index element={<AccountOverview requests={requests} finance={finance} onView={openDetail} request={request} onFinanceChanged={() => load()} />} /><Route path="overview" element={<Navigate to="/account" replace />} /><Route path="approvals" element={<AccountApprovals requests={matching} user={user} onView={openDetail} onDecide={decide} submitting={submitting} />} /><Route path="payments" element={<AccountPayments finance={finance} request={request} onRecorded={() => load()} refreshKey={lastUpdated?.getTime()} onView={openDetail} />} /><Route path="*" element={<Navigate to="/account" replace />} /></Routes>}
        {!loaded && !loading && !error && <p role="status" className="acc-muted">{text('Đang tải dữ liệu…', 'Loading data…')}</p>}
        {detailLoading && <p role="status" className="acc-muted">{text('Đang tải chi tiết đơn…', 'Loading request details…')}</p>}
        {detail && <RequestDetailModal detail={detail} onClose={closeDetail} apiBase={apiBase} onDownload={downloadAttachment} />}
      </div>
    </main>
  </div>;
}
export default function AccountDashboard(props) {
  return <AdminPreferencesProvider><AccountWorkspace key={props.user?.id || props.user?._id || 'anonymous'} {...props} /></AdminPreferencesProvider>;
}
