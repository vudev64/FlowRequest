import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CircleAlert,
  CircleCheck,
  Clock3,
} from "lucide-react";

import "./Emloyee.css";
import { cn, getInitials } from "../../lib/utils";
import { apiRequest } from "../../lib/api";
import { loadEmployeeRequest, loadEmployeeAttachment } from './EmployeeRequestService';
import { useSystemConfiguration } from '../SystemConfiguration';
import Sidebar from "../Employee/components/Sidebar";
import Topbar from "../Employee/components/Topbar";
import RequestTable, { StatCard } from "../Employee/components/RequestTable";
import CreateModal from "../Employee/components/CreateModal";
import RequestDetailModal from "../Employee/components/RequestDetailModal";
import {
  copy,
  formatDate,
  formatMonthYear,
  mapApiRequestToEmployee,
  mapEmployeeDraftToApi,
  requestTypeOptions,
  statusOptions,
} from "./EmployeeData";

function HistoryPage({ items, lang, onOpen, t, user, userInitials }) {
  return (
    <div className="subpage-stack">
      <div className="subpage-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" /> AUDIT LOG{" "}
            <span className="eyebrow-meta">
              / EMPLOYEE REQUESTS
            </span>
          </div>

          <h1>
            {lang === "vi"
              ? "Lịch sử đề xuất"
              : "Request history"}
          </h1>

          <p>
            {lang === "vi"
              ? `Bảng ghi nhận các đề xuất do ${user.name} đã tạo và gửi.`
              : `A record of requests created and submitted by ${user.name}.`}
          </p>
        </div>

        <button className="ghost-button">
          {formatMonthYear(new Date(), lang)}
        </button>
      </div>

      <div className="history-summary">
        <div className="history-summary-item">
          <span>◫</span>

          <div>
            <strong>{items.length}</strong>

            <span>
              {lang === "vi"
                ? "Tổng đề xuất đã tạo"
                : "Total created"}
            </span>
          </div>
        </div>

        <div className="history-summary-item">
          <span>◷</span>

          <div>
            <strong>
              {
                items.filter(
                  (item) =>
                    item.status === "Đang xử lý"
                ).length
              }
            </strong>

            <span>
              {lang === "vi"
                ? "Đang trong quy trình"
                : "In workflow"}
            </span>
          </div>
        </div>

        <div className="history-summary-item">
          <span>✓</span>

          <div>
            <strong>
              {
                items.filter(
                  (item) =>
                    item.status === "Đã duyệt"
                ).length
              }
            </strong>

            <span>
              {lang === "vi"
                ? "Đã hoàn tất"
                : "Completed"}
            </span>
          </div>
        </div>
      </div>

      <div className="history-card">
        <div className="subpage-card-header">
          <div>
            <div className="table-kicker">
              <span className="live-pulse" />
              REQUEST HISTORY
            </div>

            <h2>
              {lang === "vi"
                ? "Các đề xuất đã từng tạo"
                : "Previously created requests"}
            </h2>
          </div>

          <span className="history-owner">
            <div className="avatar">NA</div>
            Chủ tài khoản:{" "}
            <strong>{user.name}</strong>
          </span>
        </div>

        <div className="history-table-wrap">
          <table className="history-table">
            <thead>
              <tr>
                <th>{t.code}</th>
                <th>
                  {lang === "vi"
                    ? "Tên đề xuất"
                    : "Proposal"}
                </th>
                <th>{t.requestType}</th>
                <th>{t.created}</th>
                <th>
                  {lang === "vi"
                    ? "Người tạo"
                    : "Created by"}
                </th>
                <th>{t.state}</th>
                <th>{t.lastUpdate}</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <button
                      className="request-id"
                      onClick={() => onOpen(item)}
                    >
                      {item.id}
                    </button>
                  </td>

                  <td>
                    <strong className="history-title">
                      {item.title}
                    </strong>

                    <span className="history-description">
                      {item.description}
                    </span>
                  </td>

                  <td>
                    <span className="history-type">
                      {item.type}
                    </span>
                  </td>

                  <td>
                    <span className="date-cell">
                      {item.createdAt}
                    </span>
                  </td>

                  <td>
                    <div className="history-creator">
                      <span className="mini-avatar">{userInitials}</span>

                      <span>
                        {user.name}
                      </span>
                    </div>
                  </td>

                  <td>
                    <span
                      className={cn(
                        "status-badge",
                        item.status === "Đã duyệt"
                          ? "status-approved"
                          : item.status === "Đã từ chối"
                            ? "status-rejected"
                            : item.status === "Cần bổ sung"
                              ? "status-needs-info"
                              : "status-progress"
                      )}
                    >
                      <span className="status-dot" />
                      {item.status}
                    </span>
                  </td>

                  <td>
                    <span className="updated-cell">
                      {item.updatedAt}
                    </span>
                  </td>

                  <td>
                    <button
                      className="row-action"
                      onClick={() => onOpen(item)}
                    >
                      {t.detail}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AccountPage({
  lang,
  setLang,
  dark,
  onToggleTheme,
  t,
  user,
  userInitials,
}) {
  return (
    <div className="subpage-stack">
      <div className="subpage-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" /> ACCOUNT CENTER{" "}
            <span className="eyebrow-meta">
              / EMPLOYEE PROFILE
            </span>
          </div>

          <h1>{t.account}</h1>

          <p>
            {lang === "vi"
              ? "Thông tin chủ tài khoản và tùy chọn cá nhân của nhân viên."
              : "Account owner details and personal employee preferences."}
          </p>
        </div>

        <div className="account-status">
          <span className="sync-dot" />
          Account verified
        </div>
      </div>

      <div className="account-layout">
        <div className="account-profile-card">
          <div className="account-profile-top">
            <div className="avatar profile-avatar">{userInitials}</div>

            <div>
              <h2>{user.name}</h2>
              <p>{user.department}</p>

              <span className="account-badge">
                Employee account
              </span>
            </div>
          </div>

          <div className="account-fields">
            <DetailField
              label={
                lang === "vi"
                  ? "Chức danh"
                  : "Job title"
              }
              value={lang === "vi" ? "Nhân viên" : "Employee"}
            />

            <DetailField
              label={
                lang === "vi"
                  ? "Vai trò hệ thống"
                  : "System role"
              }
              value="Employee"
            />

            <DetailField
              label={
                lang === "vi"
                  ? "Phòng ban"
                  : "Department"
              }
              value={user.department}
            />

            <DetailField
              label={
                lang === "vi"
                  ? "Mã nhân viên"
                  : "Employee ID"
              }
              value={user.id}
              mono
            />

            <DetailField
              label="Email"
              value={user.email}
            />

            <DetailField
              label={
                lang === "vi"
                  ? "Trạng thái"
                  : "Status"
              }
              value={
                lang === "vi"
                  ? "Đang hoạt động"
                  : "Active"
              }
            />
          </div>

          <div className="account-owner-note">
            ✓{" "}
            <span>
              {lang === "vi"
                ? "Đây là tài khoản chủ sở hữu của các đề xuất trong lịch sử."
                : "This is the owner account for requests in your history."}
            </span>
          </div>
        </div>

        <div className="account-settings-card">
          <div className="table-kicker">
            PERSONAL SETTINGS
          </div>

          <h2>
            {lang === "vi"
              ? "Tùy chọn cá nhân"
              : "Personal preferences"}
          </h2>

          <div className="setting-row">
            <div>
              <strong>{t.language}</strong>

              <span>
                {lang === "vi"
                  ? "Ngôn ngữ hiển thị của hệ thống"
                  : "System display language"}
              </span>
            </div>

            <div className="setting-toggle">
              <button
                className={
                  lang === "vi"
                    ? "selected"
                    : ""
                }
                onClick={() =>
                  setLang("vi")
                }
              >
                VI
              </button>

              <button
                className={
                  lang === "en"
                    ? "selected"
                    : ""
                }
                onClick={() =>
                  setLang("en")
                }
              >
                EN
              </button>
            </div>
          </div>

          <div className="setting-row">
            <div>
              <strong>
                {lang === "vi"
                  ? "Giao diện"
                  : "Appearance"}
              </strong>

              <span>
                {lang === "vi"
                  ? "Chế độ sáng hoặc tối"
                  : "Light or dark appearance"}
              </span>
            </div>

            <button
              className="appearance-toggle"
              onClick={onToggleTheme}
            >
              {dark ? "Dark" : "Light"}
            </button>
          </div>

          <div className="setting-row">
            <div>
              <strong>
                {lang === "vi"
                  ? "Thông báo quy trình"
                  : "Workflow notifications"}
              </strong>

              <span>
                {lang === "vi"
                  ? "Nhận cập nhật khi request thay đổi"
                  : "Get updates when requests change"}
              </span>
            </div>

            <span className="setting-on">
              <span />
              ON
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailField({
  label,
  value,
  mono,
}) {
  return (
    <div className="detail-field">
      <span className="detail-label">
        {label}
      </span>

      <strong
        className={mono ? "mono" : ""}
      >
        {value}
      </strong>
    </div>
  );
}

export default function EmployeeDashboard({ user, onLogout }) {
  const { settings } = useSystemConfiguration();
  const employee = user ?? {
    id: "",
    name: "Employee",
    email: "",
    role: "employee",
    department: "—",
  };
  const userInitials = getInitials(employee.name);
  const [preferredLang, setPreferredLang] = useState(() => { try { const value = localStorage.getItem('flowrequest_employee_language'); return ['vi','en'].includes(value) ? value : null; } catch { return null; } });
  const lang = preferredLang || settings?.general?.language || 'vi';
  const setLang = value => { setPreferredLang(value); try { localStorage.setItem('flowrequest_employee_language', value); } catch { /* Storage disabled. */ } };
  const [dark, setDark] = useState(false);
  const [requestItems, setRequestItems] =
    useState([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] =
    useState("Tất cả");
  const [statusFilter, setStatusFilter] =
    useState("Tất cả");
  const [selectedRequest, setSelectedRequest] =
    useState(null);
  const [drawerOpen, setDrawerOpen] =
    useState(false);
  const detailController = useRef(null);
  const detailRequests = useRef(new Set());
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [downloading, setDownloading] = useState(false);
  useEffect(() => {
    const requests = detailRequests.current;
    return () => requests.forEach(controller => controller.abort());
  }, []);
  const [createOpen, setCreateOpen] =
    useState(false);
  const [notificationOpen, setNotificationOpen] =
    useState(false);
  const [profileOpen, setProfileOpen] =
    useState(false);
  const [activeNav, setActiveNav] =
    useState("Đơn của tôi");
  const [toast, setToast] = useState(null);

  const t = { ...copy[lang], workspace: settings?.general?.companyName || settings?.general?.systemName || copy[lang].workspace };
  const requestStats = useMemo(
    () => ({
      inProgress: requestItems.filter((item) =>
        ["Đang xử lý", "Cần bổ sung"].includes(item.status)
      ).length,
      completed: requestItems.filter(
        (item) => item.status === "Đã duyệt"
      ).length,
      rejected: requestItems.filter(
        (item) => item.status === "Đã từ chối"
      ).length,
    }),
    [requestItems]
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);

    return () => {
      document.documentElement.classList.remove("dark");
    };
  }, [dark]);

  const showToast = useCallback((message, tone = "success") => {
    setToast({ message, tone });

    window.setTimeout(
      () => setToast(null),
      2800
    );
  }, []);

  useEffect(() => {
    let active = true;

    const loadRequests = async () => {
      try {
        const result = await apiRequest("/request");

        if (active) {
          setRequestItems(
            (result.data || []).map((request) =>
              mapApiRequestToEmployee(request, lang)
            )
          );
        }
      } catch (error) {
        if (active) {
          showToast(error.message, "error");
        }
      }
    };

    loadRequests();
    const intervalId = window.setInterval(loadRequests, 15000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [lang, showToast]);

  const toggleTheme = () => {
    setDark((current) => !current);
  };

  const openRequest = async (item) => {
    detailController.current?.abort();
    const controller = new AbortController();
    detailController.current = controller;
    detailRequests.current.add(controller);
    setSelectedRequest(item);
    setDrawerOpen(true);
    setDetailLoading(true); setDetailError('');
    try {
      const detail = await loadEmployeeRequest(item, lang, controller.signal);
      if (!controller.signal.aborted) setSelectedRequest(detail);
    } catch (error) {
      if (!controller.signal.aborted) setDetailError(error.message);
    } finally {
      detailRequests.current.delete(controller);
      if (!controller.signal.aborted) setDetailLoading(false);
    }
  };

  const closeRequest = () => {
    detailController.current?.abort();
    setDrawerOpen(false); setDetailLoading(false);
  };

  const downloadAttachment = async () => {
    if (downloading || !selectedRequest) return;
    setDownloading(true);
    try {
      const blob = await loadEmployeeAttachment(selectedRequest);
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = selectedRequest.attachment.split('/').at(-1) || 'attachment';
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { showToast(error.message, 'error'); }
    finally { setDownloading(false); }
  };

  const saveRequest = async (draft, submit) => {
    try {
      let body = mapEmployeeDraftToApi(draft, !submit);
      if (draft.attachmentFile) {
        const form = new FormData();
        for (const [key, value] of Object.entries(body)) if (value != null) form.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
        form.append('attachment', draft.attachmentFile);
        body = form;
      }
      const result = await apiRequest("/request", {
        method: "POST",
        body,
      });
      const nextRequest = mapApiRequestToEmployee(result.data, lang);

      setRequestItems((current) => [
        nextRequest,
        ...current.filter((item) => item.id !== nextRequest.id),
      ]);
      setActiveNav("Đơn của tôi");
      setCreateOpen(false);

      showToast(
        result.message ||
          (lang === "vi"
            ? "Đề xuất đã được gửi."
            : "Request submitted.")
      );
    } catch (error) {
      showToast(error.message, "error");
    }
  };

  const dashboard =
    activeNav === "Tài khoản" ? (
      <AccountPage
        lang={lang}
        setLang={setLang}
        dark={dark}
        onToggleTheme={toggleTheme}
        t={t}
        user={employee}
        userInitials={userInitials}
      />
    ) : activeNav === "Lịch sử đề xuất" ? (
      <HistoryPage
        items={requestItems}
        lang={lang}
        onOpen={openRequest}
        t={t}
        user={employee}
        userInitials={userInitials}
      />
    ) : (
      <>
        <div className="page-heading-row">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-line" /> EMPLOYEE PORTAL{" "}
              <span className="eyebrow-meta">
                / {formatDate(new Date(), lang)}
              </span>
            </div>

            <h1>
              {lang === "vi" ? "Xin chào" : "Hello"},{" "}
              {employee.name}
            </h1>
            <p>{t.subtitle}</p>
          </div>

          <div className="heading-meta">
            <div className="sync-status">
              <span className="sync-dot" />
              Synced just now
            </div>

            <div className="quarter-chip">
              Q4 <span>2026</span>
            </div>
          </div>
        </div>

        <div className="stats-grid">
          <StatCard
            icon={<Clock3 size={17} />}
            label={t.inProgress}
            value={String(requestStats.inProgress).padStart(2, "0")}
            hint={t.pendingHint}
            tone="orange"
          />

          <StatCard
            icon={<CircleCheck size={17} />}
            label={t.completed}
            value={String(requestStats.completed).padStart(2, "0")}
            hint={t.approvedHint}
            tone="green"
          />

          <StatCard
            icon={<CircleAlert size={17} />}
            label={t.rejected}
            value={String(requestStats.rejected).padStart(2, "0")}
            hint={t.rejectedHint}
            tone="red"
          />
        </div>

        <div className="section-divider" />

        <RequestTable
          requests={requestItems}
          lang={lang}
          t={t}
          onOpen={openRequest}
          search={search}
          setSearch={setSearch}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          requestTypeOptions={requestTypeOptions}
          statusOptions={statusOptions}
          onCreate={() =>
            setCreateOpen(true)
          }
        />
      </>
    );

  return (
    <div className="app-shell" data-role="Employee">
      <Sidebar
        activeNav={activeNav}
        setActiveNav={(nav) => {
          setActiveNav(nav);

          if (
            nav === "Tạo đề xuất mới"
          ) {
            setCreateOpen(true);
          }
        }}
        lang={lang}
        setLang={setLang}
        t={t}
        setProfileOpen={setProfileOpen}
        profileOpen={profileOpen}
        user={employee}
        onLogout={onLogout}
      />

      <main className="main-area">
        <Topbar
          activeNav={activeNav}
          lang={lang}
          setLang={setLang}
          dark={dark}
          onToggleTheme={toggleTheme}
          search={search}
          setSearch={setSearch}
          t={t}
          notificationOpen={notificationOpen}
          setNotificationOpen={
            setNotificationOpen
          }
          onOpenRequest={openRequest}
          requestItems={requestItems}
        />

        <section className="content-wrap">
          {dashboard}
        </section>
      </main>

      {drawerOpen &&
        selectedRequest && (
          <RequestDetailModal
            item={selectedRequest}
            lang={lang}
            t={t}
            loading={detailLoading}
            error={detailError}
            onRetry={() => openRequest(selectedRequest)}
            onClose={closeRequest}
            footerActions={selectedRequest.attachment && !detailLoading && !detailError ? <button className="ghost-button wide" type="button" disabled={downloading} onClick={downloadAttachment}>{downloading ? (lang === 'vi' ? 'Đang tải…' : 'Downloading…') : (lang === 'vi' ? 'Tải tệp đính kèm' : 'Download attachment')}</button> : null}
          />
        )}

      {createOpen && (
        <CreateModal
          lang={lang}
          t={t}
          onClose={() =>
            setCreateOpen(false)
          }
          onSubmit={saveRequest}
        />
      )}

      {toast && (
        <div
          className={`toast${toast.tone === "error" ? " toast-error" : ""}`}
          role={toast.tone === "error" ? "alert" : "status"}
        >
          {toast.tone === "error" ? (
            <CircleAlert size={16} />
          ) : (
            <CircleCheck size={16} />
          )}
          {toast.message}
        </div>
      )}
    </div>
  );
}
