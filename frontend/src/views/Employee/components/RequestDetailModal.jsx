import { systemTimeZone } from "../../../lib/systemConfiguration";
import { ArrowUpRight, Check, CircleAlert, Clock3, ShieldCheck, X } from "lucide-react";
import { cn } from "../../../lib/utils";
import RequestSpecificDetails from "./RequestSpecificDetails";
import { statusClass, statusLabel, getRequestTypeLabel } from "../EmployeeData";
const STATUS_ROLE = {
  PENDING_MANAGER: "MANAGER",
  PENDING_HRADMIN: "HR_ADMIN",
  PENDING_ACCOUNTANT: "ACCOUNTANT",
  PENDING_DIRECTOR: "DIRECTOR"
};
const DISPLAY_ROLE = {
  EMPLOYEE: "Employee",
  MANAGER: "Manager",
  HR_ADMIN: "HR_ADMIN",
  ACCOUNTANT: "Accountant",
  DIRECTOR: "Director"
};
const STATUS_VI = {
  DRAFT: "Bản nháp",
  PENDING_MANAGER: "Đang xử lý",
  PENDING_HRADMIN: "Đang xử lý",
  PENDING_ACCOUNTANT: "Đang xử lý",
  PENDING_DIRECTOR: "Đang xử lý",
  APPROVED: "Đã duyệt",
  REJECTED: "Đã từ chối",
  CANCELLED: "Đã hủy"
};
const LABEL_TO_TYPE = {
  "Nghỉ phép": "LEAVE",
  "Đăng ký OT dự án": "OVERTIME",
  "Mua sắm Thiết bị/MacBook": "PURCHASE",
  "Bản quyền Tool/IDE": "PURCHASE",
  "Tài nguyên Cloud Server": "PURCHASE"
};
const TYPE_LABELS = {
  LEAVE: "Nghỉ phép",
  OVERTIME: "Đăng ký OT dự án",
  PURCHASE: "Mua sắm"
};
function asName(value) {
  if (value && typeof value === "object") return value.name || "";
  return ""; // Không dùng ID làm tên người
}
function formatTime(value, lang) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: systemTimeZone()
  }).format(date);
}
function formatDate(value, lang) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: systemTimeZone()
  }).format(date);
}
function formatAmount(amount) {
  if (amount == null || amount === "") return "—";
  const number = Number(amount);
  if (!Number.isFinite(number)) return "—";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
  }).format(number);
}

// Trạng thái hiện tại từ backend quyết định bước nào đang chờ.
// Lịch sử duyệt mới là căn cứ đánh dấu "Đã duyệt".
function getWorkflowRoles(request) {
  const type = request.typeCode || request.type;
  const history = Array.isArray(request.approvalHistory) ? request.approvalHistory : [];
  const firstRole = history[0]?.role || STATUS_ROLE[request.status];
  const managerCreated = firstRole === "DIRECTOR";
  if (type === "LEAVE" || type === "OVERTIME") {
    return managerCreated ? ["EMPLOYEE", "DIRECTOR", "HR_ADMIN"] : ["EMPLOYEE", "MANAGER", "HR_ADMIN"];
  }
  if (type === "PURCHASE") {
    const directorNeeded = Boolean(request.requiresDirector) || managerCreated;
    return directorNeeded ? managerCreated ? ["EMPLOYEE", "DIRECTOR", "ACCOUNTANT"] : ["EMPLOYEE", "MANAGER", "DIRECTOR", "ACCOUNTANT"] : ["EMPLOYEE", "MANAGER", "ACCOUNTANT"];
  }
  // Chưa rõ loại đơn: chỉ hiển thị các bước có bằng chứng.
  return ["EMPLOYEE", ...new Set([...history.map(entry => entry.role), STATUS_ROLE[request.status]].filter(Boolean))];
}
function DetailField({
  label,
  value,
  mono
}) {
  return <div className="detail-field">
      <span className="detail-label">{label}</span>
      <strong className={mono ? "mono" : ""}>{value || "—"}</strong>
    </div>;
}
function TimelineStep({
  variant,
  role,
  status,
  person,
  detail,
  last
}) {
  return <div className={cn("timeline-step", `timeline-${variant}`, last && "timeline-last")}>
      <div className="timeline-rail">
        <div className="timeline-node">
          {variant === "done" ? <Check size={12} strokeWidth={3} /> : variant === "current" ? <span /> : <span className="waiting-node" />}
        </div>
      </div>
      <div className="timeline-content">
        <div className="timeline-role">
          <strong>{role}</strong>
          <span className={cn("timeline-status", `timeline-status-${variant}`)}>{status}</span>
        </div>
        {person && <div className="timeline-person">{person}</div>}
        {detail && <div className="timeline-detail">
          {variant === "current" && <span className="current-pulse" />}
          {detail}
        </div>}
      </div>
    </div>;
}
export default function RequestDetailModal({
  item,
  lang = "vi",
  onClose,
  t,
  loading = false,
  error = '',
  onRetry,
  footerActions = null
}) {
  // item cần là dữ liệu chi tiết được lấy từ GET /api/request/:id,
  // hoặc object được map có giữ nguyên các trường tương đương.
  if (!item) return null;
  const history = Array.isArray(item.approvalHistory) ? item.approvalHistory : [];
  const typeCode = item.typeCode || LABEL_TO_TYPE[item.type] || item.type;
  const statusCode = item.statusCode || (STATUS_VI[item.status] ? item.status : null);
  const statusText = statusCode ? STATUS_VI[statusCode] || statusCode : item.status || "—";
  const currentRole = STATUS_ROLE[statusCode] || null;
  const roles = getWorkflowRoles({
    ...item,
    type: typeCode,
    status: statusCode
  });
  const isDraft = statusCode === "DRAFT" || statusText === "Bản nháp";
  const isCancelled = statusCode === "CANCELLED" || statusText === "Đã hủy";
  const isRejected = statusCode === "REJECTED" || statusText === "Đã từ chối";
  const isApproved = statusCode === "APPROVED" || statusText === "Đã duyệt";
  const isFinal = isCancelled || isRejected || isApproved;
  const steps = roles.map((role, index) => {
    if (role === "EMPLOYEE") {
      return {
        key: role,
        variant: isDraft ? "current" : "done",
        status: isDraft ? lang === "vi" ? "Bản nháp" : "Draft" : t.sent,
        person: asName(item.author) || item.authorName || "",
        detail: formatTime(item.createdAtRaw || item.createdAt, lang)
      };
    }

    // Một role có thể có nhiều hành động; dùng hành động duyệt gần nhất.
    const approvedEntry = [...history].reverse().find(entry => entry.role === role && entry.action === "APPROVED");
    const rejectedEntry = [...history].reverse().find(entry => entry.role === role && entry.action === "REJECTED");
    const entry = rejectedEntry || approvedEntry;
    const isCurrent = !isFinal && !isDraft && currentRole === role;
    const variant = rejectedEntry ? "rejected" : approvedEntry ? "done" : isCurrent ? "current" : "waiting";
    const person = entry ? asName(entry.approverId) || entry.approverName || "" : isCurrent && item.currentApprover?.role === role ? asName(item.currentApprover) : "";
    return {
      key: `${role}-${index}`,
      variant,
      status: rejectedEntry ? lang === "vi" ? "Đã từ chối" : "Rejected" : approvedEntry ? t.approved : isCurrent ? t.processing : t.waiting,
      person,
      detail: entry ? [formatTime(entry.timestamp, lang), entry.comment].filter(Boolean).join(" · ") : isCurrent ? lang === "vi" ? "Đang chờ phê duyệt" : "Awaiting approval" : ""
    };
  });
  const completedSteps = steps.filter(step => step.variant === "done").length;
  const department = item.author?.department?.name || item.author?.department || item.department?.name || item.departmentName || "";
  const needsInfo = statusText === "Cần bổ sung";
  const latestComment = [...history].reverse().find(entry => entry.comment)?.comment || item.comment;
  return <div className="drawer-layer">
      <button className="drawer-backdrop" onClick={onClose} aria-label={t.close} />
      <aside className="request-drawer">
        <div className="drawer-header">
          <div>
            <div className="drawer-overline">REQUEST DETAIL <span>•</span> {item.id || item._id}</div>
            <h2>{item.title}</h2>
          </div>
          <button className="icon-button bordered" onClick={onClose} aria-label={t.close}><X size={17} /></button>
        </div>

        <div className="drawer-scroll">
          {loading && <p className="detail-label" role="status">{lang === 'vi' ? 'Đang tải chi tiết và lịch sử phê duyệt…' : 'Loading details and approval history…'}</p>}
          {error && <div role="alert"><p>{error}</p>{onRetry && <button type="button" className="ghost-button" onClick={onRetry}>{lang === 'vi' ? 'Thử lại' : 'Retry'}</button>}</div>}
          <div className="drawer-status-row">
            <span className={cn("status-badge", statusClass(statusText))}>
              <span className="status-dot" />{statusLabel(statusText, lang)}
            </span>
            <span className="drawer-updated"><Clock3 size={13} />{formatDate(item.updatedAtRaw || item.updatedAt, lang)}</span>
          </div>

          <div className="detail-grid">
            <DetailField label={t.code} value={item.id || item._id} mono />
            <DetailField label={t.requestType} value={item.typeLabel || getRequestTypeLabel({
            type: typeCode,
            category: item.category
          }) || TYPE_LABELS[typeCode] || item.type} />
            <DetailField label={t.createdBy} value={asName(item.author) || item.authorName} />
            <DetailField label={t.created} value={formatDate(item.createdAtRaw || item.createdAt, lang)} />
            <DetailField label={t.value} value={typeCode === "PURCHASE" ? formatAmount(item.amount) : item.durationText || item.value || "—"} />
            <DetailField label="Department" value={typeof department === "string" ? department : ""} />
          </div>

          <RequestSpecificDetails item={item} lang={lang} />

          <div className="description-block">
            <div className="detail-label">{t.reason}</div>
            <p>{item.content || item.description || "—"}</p>
          </div>

          {needsInfo && <div className="feedback-card">
            <div className="feedback-heading"><div className="feedback-icon"><CircleAlert size={15} /></div>
              <div><strong>{t.requestMore}</strong></div>
            </div>
            <p>{latestComment || "—"}</p>
          </div>}

          <div className="timeline-section">
            <div className="timeline-heading">
              <div><div className="detail-label">APPROVAL FLOW</div><h3>{t.process}</h3></div>
              <span className="timeline-count">{completedSteps} / {steps.length} steps</span>
            </div>
            <div className="timeline">
              {steps.map((step, index) => <TimelineStep key={step.key} variant={step.variant} role={DISPLAY_ROLE[roles[index]] || roles[index]} status={step.status} person={step.person} detail={step.detail} last={index === steps.length - 1} />)}
            </div>
          </div>
          <div className="drawer-note"><ShieldCheck size={10.5} /><span>
            {lang === "vi" ? "Lịch sử phê duyệt được hiển thị từ dữ liệu hệ thống." : "Approval history is shown from system data."}
          </span></div>
        </div>

        <div className="drawer-footer">
          {footerActions}
          <button className="ghost-button wide" onClick={onClose}>{t.close}</button>
          {/* Chỉ thêm nút thao tác khi đã có API và kiểm tra quyền từ backend. */}
        </div>
      </aside>
    </div>;
}
