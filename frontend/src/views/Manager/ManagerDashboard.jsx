
import { useMemo, useState, useEffect, useCallback } from "react";
import {
  ChevronRight,
  CheckCircle2,
  CircleAlert,
  FileCheck2,
  X,
} from "lucide-react";
import {
  Routes,
  Route,
  useLocation,
  useNavigate,
} from "react-router-dom";

import "../Employee/Emloyee.css";
import "./Manager.css";

import { ApprovalModal } from "./components/ApprovalModal";
import { FilterChips } from "./components/FilterChips";
import { HistoryTable } from "./components/HistoryTable";
import { RequestCard } from "./components/RequestCard";
import { SecurityPanel } from "./components/SecurityPanel";
import { Sidebar } from "./components/Sidebar";
import { StatsCards } from "./components/StatsCards";
import { Topbar } from "./components/Topbar";

import { apiRequest } from "../../lib/api";
import {
  calculateStats,
  getInitials,
  mapApiRequestToManager,
  mapApiRequestToManagerHistory,
} from "./ManagerData";

export function ManagerDashboard({
  user,
  onLogout,
}) {
  const location = useLocation();
  const navigateTo = useNavigate();

  // Dynamic Manager information
  const manager = useMemo(
    () => ({
      id: user?.id,
      name: user?.name || user?.full_name || "Manager",
      email: user?.email || "",
      role: user?.position || user?.roleName || user?.role || "Manager",
      initials: getInitials(
        user?.name || user?.full_name || "Manager"
      ),
    }),
    [user]
  );

  // Request and history data
  const [requests, setRequests] = useState([]);
  const [history, setHistory] = useState([]);

  // UI states
  const [activeModal, setActiveModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [apiMessage, setApiMessage] = useState(null);
  const [isDark, setIsDark] = useState(false);

  const loadRequests = useCallback(async () => {
    const result = await apiRequest("/request");
    return result.data || [];
  }, []);

  useEffect(() => {
    let active = true;

    const refresh = async () => {
      try {
        const allRequests = await loadRequests();

        if (!active) {
          return;
        }

        setRequests(
          allRequests
            .filter(
              (request) =>
                request.status === "PENDING_MANAGER" &&
                String(
                  request.currentApprover?._id ||
                    request.currentApprover ||
                    ""
                ) === String(manager.id)
            )
            .map(mapApiRequestToManager)
        );
        setHistory(
          allRequests.flatMap((request) =>
            mapApiRequestToManagerHistory(request, manager.id)
          )
        );
        setApiMessage(null);
      } catch (error) {
        if (active) {
          setApiMessage(error.message);
        }
      }
    };

    refresh();
    const intervalId = window.setInterval(refresh, 15000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [loadRequests, manager.id]);

  // Current page
  const currentPath =
    location.pathname === "/manager/history"
      ? "history"
      : location.pathname === "/manager/security"
        ? "security"
        : "approvals";

  // Navigation
  const navigate = (path) => {
    navigateTo(path);
    setMobileNavOpen(false);
  };

  // Toast notification
  const showToast = (next) => {
    setToast(next);

    window.setTimeout(() => {
      setToast(null);
    }, 3600);
  };

  // Check manager permission
  const checkManagerPermission = (request) => {
    if (!manager.id || request.managerId !== manager.id) {
      showToast({
        tone: "danger",
        title: "403 · Không có quyền",
        detail: "Đơn này không thuộc team của bạn.",
      });

      return false;
    }

    return true;
  };

  // Approve request
  const handleApprove = async (request, note) => {
    if (!checkManagerPermission(request)) {
      return;
    }

    try {
      const result = await apiRequest(
        `/request/${encodeURIComponent(request.id)}/status`,
        {
          method: "PATCH",
          body: { action: "APPROVED", comment: note || "" },
        }
      );

      setRequests((items) =>
        items.filter((item) => item.id !== request.id)
      );
      setHistory((items) => [
        {
          ...request,
          processedAt: "Vừa xong",
          outcome: "APPROVED",
          note: note || "Đã duyệt ở cấp Manager.",
        },
        ...items,
      ]);
      setActiveModal(null);
      showToast({
        tone: "success",
        title: "Đã duyệt đơn",
        detail: result.message || `Đơn chuyển tới ${request.nextRole}.`,
      });
    } catch (error) {
      showToast({
        tone: "danger",
        title: "Không thể duyệt đơn",
        detail: error.message,
      });
    }
  };

  // Reject request
  const handleReject = async (request, note) => {
    if (!note || note.trim().length < 10) {
      return;
    }

    if (!checkManagerPermission(request)) {
      return;
    }

    try {
      const result = await apiRequest(
        `/request/${encodeURIComponent(request.id)}/status`,
        {
          method: "PATCH",
          body: { action: "REJECTED", comment: note },
        }
      );

      setRequests((items) =>
        items.filter((item) => item.id !== request.id)
      );
      setHistory((items) => [
        {
          ...request,
          processedAt: "Vừa xong",
          outcome: "REJECTED",
          note,
        },
        ...items,
      ]);
      setActiveModal(null);
      showToast({
        tone: "success",
        title: "Đã từ chối đơn",
        detail: result.message || "Luồng phê duyệt đã kết thúc.",
      });
    } catch (error) {
      showToast({
        tone: "danger",
        title: "Không thể từ chối đơn",
        detail: error.message,
      });
    }
  };

  // Calculate statistics
  const stats = useMemo(
    () => calculateStats(requests, history),
    [requests, history]
  );

  // Approval page props
  const approvalPageProps = {
    requests,
    stats,

    onApprove: (request) =>
      setActiveModal({
        kind: "approve",
        request,
      }),

    onReject: (request) =>
      setActiveModal({
        kind: "reject",
        request,
      }),
  };

  return (
    <div
      className={[
        "app-shell",
        "manager-shell",
        isDark && "dark-mode",
        mobileNavOpen && "mobile-nav-open",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Sidebar */}
      <Sidebar
        currentPath={currentPath}
        stats={stats}
        mobileOpen={mobileNavOpen}
        onNavigate={navigate}
        onClose={() => setMobileNavOpen(false)}
        manager={manager}
        onLogout={onLogout}
      />

      <main className="main-area">
        {/* Topbar */}
        <Topbar
          isDark={isDark}
          onToggleDark={() => setIsDark((prev) => !prev)}
          onOpenMenu={() => setMobileNavOpen(true)}
        />

        <div className="content-wrap">
          {apiMessage && (
            <div className="toast toast-danger" role="alert">
              <CircleAlert size={18} />
              <span>{apiMessage}</span>
            </div>
          )}

          <Routes>
            {/* Approval History */}
            <Route
              path="history"
              element={<HistoryTable history={history} />}
            />

            {/* Security Settings */}
            <Route
              path="security"
              element={
                <SecurityPanel
                  apiMessage={apiMessage}
                  setApiMessage={setApiMessage}
                />
              }
            />

            {/* Approval Queue */}
            <Route
              path="approvals"
              element={<ApprovalsPage {...approvalPageProps} />}
            />

            {/* Manager Default Route */}
            <Route
              index
              element={<ApprovalsPage {...approvalPageProps} />}
            />

            {/* Fallback Route */}
            <Route
              path="*"
              element={<ApprovalsPage {...approvalPageProps} />}
            />
          </Routes>
        </div>
      </main>

      {/* Approval Modal */}
      {activeModal && (
        <ApprovalModal
          kind={activeModal.kind}
          request={activeModal.request}
          onClose={() => setActiveModal(null)}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          className={`toast toast-${toast.tone}`}
          role="status"
        >
          <div className="toast-icon">
            {toast.tone === "success" ? (
              <CheckCircle2 size={18} />
            ) : (
              <CircleAlert size={18} />
            )}
          </div>

          <div>
            <strong>{toast.title}</strong>
            {toast.detail && <span>{toast.detail}</span>}
          </div>

          <button
            type="button"
            className="toast-close"
            onClick={() => setToast(null)}
            aria-label="Đóng thông báo"
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

// Approval Queue Page
function ApprovalsPage({
  requests,
  stats,
  onApprove,
  onReject,
}) {
  const [filter, setFilter] = useState("ALL");
  const [query, setQuery] = useState("");

  // Filter requests
  const filtered = requests.filter((request) => {
    const matchesFilter =
      filter === "ALL" || request.type === filter;

    const searchText = `
      ${request.requester}
      ${request.department}
      ${request.id}
    `;

    const matchesQuery = searchText
      .toLowerCase()
      .includes(query.toLowerCase());

    return matchesFilter && matchesQuery;
  });

  return (
    <>
      <PageIntro
        eyebrow="MANAGER QUEUE"
        title="Chờ duyệt Team"
        desc="Xử lý nhanh các đề xuất từ thành viên trong team của bạn."
        actions={
          <button type="button" className="outline-button">
            <FileCheck2 size={16} />
            Quy tắc phê duyệt
            <ChevronRight size={15} />
          </button>
        }
      />

      <StatsCards stats={stats} />

      <FilterChips
        filter={filter}
        query={query}
        requests={requests}
        onFilterChange={setFilter}
        onQueryChange={setQuery}
      />

      <div className="queue-heading">
        <div>
          <h2>
            Danh sách cần xử lý <span>{filtered.length}</span>
          </h2>

          <p>
            Đơn cũ nhất được đưa lên trước để không bỏ sót.
          </p>
        </div>

        <div className="queue-status">
          <span className="status-dot" />
          Cập nhật theo thời gian thực
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="request-list">
          {filtered.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              onApprove={() => onApprove(request)}
              onReject={() => onReject(request)}
            />
          ))}
        </div>
      ) : (
        <EmptyState filter={filter} query={query} />
      )}
    </>
  );
}

// Empty State
function EmptyState({ filter, query }) {
  const title = query
    ? "Không tìm thấy đơn phù hợp"
    : filter !== "ALL"
      ? "Không có đơn thuộc bộ lọc này"
      : "Không còn đơn nào chờ duyệt";

  const description = query
    ? "Thử tìm bằng tên nhân viên, phòng ban hoặc mã đơn khác."
    : "Team của bạn đã được xử lý hết. Bạn có thể xem lại các quyết định trong Lịch sử phê duyệt.";

  return (
    <div className="empty-state">
      <div className="empty-icon">
        <CheckCircle2 size={30} />
      </div>

      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

// Page Introduction
function PageIntro({
  eyebrow,
  title,
  desc,
  actions,
}) {
  return (
    <div className="page-intro">
      <div>
        <div className="eyebrow">
          <span className="eyebrow-line" />
          {eyebrow}
        </div>

        <h1>{title}</h1>
        <p>{desc}</p>
      </div>

      {actions && (
        <div className="intro-actions">
          {actions}
        </div>
      )}
    </div>
  );
}
