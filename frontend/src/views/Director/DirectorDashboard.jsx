import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../lib/api';
import { readApiResponse } from '../../lib/apiResponse';
import { assertApiEnvironment } from '../../lib/environment';
import { AdminPreferencesProvider, useAdminPreferences } from '../AdminPreferences';
import { useDirectorLanguage } from './DirectorLanguage';
import DirectorSidebar from './components/Sidebar';
import DirectorTopbar from './components/Topbar';
import DirectorOverview from './components/Overview';
import DirectorApprovals from './components/Approvals';
import DirectorReports from './components/Reports';
import RequestDialog from './components/RequestDialog';
import BudgetIncreasePanel from '../BudgetIncreasePanel';
import { canDirectorDecide, extractRequest, extractRequests, getId, getReadableError } from './DirectorData';
import './Director.css';

/**
 * API contract to verify against your actual Express router:
 * GET   {apiBase}                 => array or wrapped list
 * GET   {apiBase}/{id}            => request or wrapped request
 * PATCH {apiBase}/{id}/status     => body {action: 'APPROVED'|'REJECTED', comment}
 *
 * Reuses the existing /api/request router and shared API host configuration.
 * Backend alone must check JWT, DIRECTOR role, ownership, step, transitions, duplicate operations.
 */
function DirectorWorkspace({
  user,
  token,
  onLogout,
  apiBase = `${API_BASE_URL.replace(/\/$/, '')}/request`,
  analyticsEndpoint = `${apiBase}/finance/summary`,
  initialTab = 'overview',
}) {
  const { theme } = useAdminPreferences();
  const { lang, t } = useDirectorLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const routeTab = location.pathname.replace(/\/$/, '').split('/')[2];
  const tab = ['overview', 'approvals', 'reports'].includes(routeTab) ? routeTab : initialTab;
  const setTab = next => navigate(next === 'overview' ? '/director' : `/director/${next}`);
  const [requests, setRequests] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [reportDetail, setReportDetail] = useState(null);
  const loadSequence = useRef(0);
  const detailSequence = useRef(0);
  const detailCache = useRef(new Map());
  const writeLock = useRef(false);

  const requestApi = useCallback(async (path, options = {}) => {
    if (!token) throw new Error('Chưa có JWT. Vui lòng đăng nhập lại.');
    const response = await fetch(path, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
    });
    return readApiResponse(response, path);
  }, [token]);

  const budgetRequest = useCallback((suffix, options) => requestApi(`${apiBase}${suffix}`, options), [apiBase, requestApi]);

  const refresh = useCallback(async ({ silent = false, signal } = {}) => {
    const sequence = ++loadSequence.current;
    if (!silent) setLoading(true);
    try {
      const body = await requestApi(apiBase, { signal });
      const rows = extractRequests(body);
      if (sequence !== loadSequence.current) return;
      setRequests(rows); setLoaded(true); setError('');
      if (analyticsEndpoint) {
        try {
          const result = await requestApi(analyticsEndpoint, { signal });
          if (sequence === loadSequence.current) setAnalytics(result?.data || result);
        } catch { if (sequence === loadSequence.current) setAnalytics(null); }
      } else setAnalytics(null);
    } catch (err) {
      if (sequence === loadSequence.current && err.name !== 'AbortError') setError(getReadableError(err));
    } finally { if (sequence === loadSequence.current) setLoading(false); }
  }, [apiBase, analyticsEndpoint, requestApi]);

  useEffect(() => {
    const controller = new AbortController();
    void refresh({ signal: controller.signal });
    const update = () => {
      if (document.visibilityState !== 'hidden') void refresh({ silent: true, signal: controller.signal });
    };
    const timer = window.setInterval(update, 30000);
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      loadSequence.current++; detailSequence.current++; controller.abort();
      window.clearInterval(timer);
      window.removeEventListener('focus', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, [refresh]);

  const fetchDetail = useCallback(async (id) => {
    const body = await requestApi(`${apiBase}/${encodeURIComponent(id)}`);
    const record = extractRequest(body);
    detailCache.current.set(id, record);
    return record;
  }, [apiBase, requestApi]);

  const decide = useCallback(async (id, action, comment) => {
    if (!['APPROVED', 'REJECTED'].includes(action)) throw new Error('Hành động không hợp lệ.');
    if (action === 'REJECTED' && !comment.trim()) throw new Error('Cần nhập lý do từ chối.');
    if (writeLock.current) throw new Error('Một thao tác khác đang được xử lý.');
    if (!canDirectorDecide(detailCache.current.get(id), user)) throw new Error('Đơn không thuộc quyền phê duyệt ở bước Giám đốc.');
    writeLock.current = true;
    setBusy(true); setError(''); setNotice('');
    try {
      const saved = extractRequest(await requestApi(`${apiBase}/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ action, comment }),
      }));
      detailCache.current.set(id, saved);
      setRequests(previous => previous.map(row => getId(row) === id
        ? { ...row, status: saved.status, currentApprover: saved.currentApprover, approvalHistory: saved.approvalHistory }
        : row));
      setNotice(action === 'APPROVED' ? 'Đã duyệt bước Director. Trạng thái tiếp theo do Backend quyết định.' : 'Đã từ chối đơn.');
      // Reload after successful operation; do not optimistically invent next status.
      await refresh({ silent: true });
      return saved;
    } catch (err) {
      setError(getReadableError(err));
      if ([400, 403, 409].includes(err.status)) {
        await refresh({ silent: true });
        try { await fetchDetail(id); } catch { detailCache.current.delete(id); }
      }
      throw err;
    } finally { writeLock.current = false; setBusy(false); }
  }, [apiBase, user, fetchDetail, refresh, requestApi]);

  const download = useCallback(async record => {
    const response = await fetch(`${apiBase}/${encodeURIComponent(getId(record))}/attachment`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assertApiEnvironment(response);
    if (!response.ok) return readApiResponse(response, 'request attachment');
    if ((response.headers.get('content-type') || '').includes('application/json')) throw new Error('Phản hồi tải tệp không hợp lệ.');
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url; link.download = String(record.attachment).split('/').at(-1);
    document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [apiBase, token]);

  const viewReport = async id => {
    const sequence = ++detailSequence.current;
    setReportDetail({ loading: true, id });
    try {
      const record = await fetchDetail(id);
      if (sequence === detailSequence.current) setReportDetail({ record, id });
    } catch (err) {
      if (sequence === detailSequence.current) setReportDetail({ error: getReadableError(err), id });
    }
  };
  const closeReport = () => { detailSequence.current++; setReportDetail(null); };

  return (
    <div className="dir-workspace" data-theme={theme} lang={lang}>
      <DirectorSidebar activeTab={tab} onNavigate={setTab} onLogout={onLogout}/>
      <div className="dir-main">
        <DirectorTopbar user={user} activeTab={tab} onRefresh={() => void refresh()} loading={loading}/>
        <main className="dir-content">
          {error && <div className="dir-alert dir-alert-error" role="alert">{t(error)}<button className="dir-btn dir-btn-ghost" onClick={refresh}>{t('Thử lại')}</button></div>}
          {notice && <div className="dir-alert dir-alert-success" role="status">{t(notice)}<button className="dir-icon-btn" onClick={() => setNotice('')} aria-label={t('Đóng thông báo')}>×</button></div>}
          {loading && <div className="dir-loading" role="status">{t('Đang tải dữ liệu...')}</div>}
          {loaded && tab === 'overview' && <DirectorOverview requests={requests} analytics={analytics} onNavigate={setTab}/>}
          {loaded && tab === 'approvals' && <><DirectorApprovals requests={requests} user={user} busy={busy} onFetchDetail={fetchDetail} onDecide={decide} onDownload={download}/><BudgetIncreasePanel role="DIRECTOR" request={budgetRequest} onBudgetChanged={refresh}/></>}
          {loaded && tab === 'reports' && <DirectorReports requests={requests} onView={viewReport}/>}
          {reportDetail && <RequestDialog detail={reportDetail} onClose={closeReport} onRetry={() => viewReport(reportDetail.id)} onDownload={download}/>}
        </main>
      </div>
    </div>
  );
}

export default function DirectorDashboard(props) {
  return <AdminPreferencesProvider><DirectorWorkspace {...props}/></AdminPreferencesProvider>;
}
