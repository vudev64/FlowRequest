import { Check, CircleAlert, X } from "lucide-react";

/**
 * @typedef {import("./HRAdminData").HRRole} HRRole
 */

/** @type {Record<HRRole, string>} */
export const HR_ROLE_CLASS = {
  DIRECTOR: "role-director",
  SYSTEM_ADMIN: "role-system",
  HR_ADMIN: "role-hr",
  MANAGER: "role-manager",
  ACCOUNTANT: "role-accountant",
  EMPLOYEE: "role-employee",
};

/** @param {{ role: HRRole }} props */
export function HRRoleBadge({ role }) {
  return <span className={`role-badge ${HR_ROLE_CLASS[role]}`}>{role}</span>;
}

/**
 * @param {{ eyebrow?: import("react").ReactNode, title: string, description?: string,
 *           action?: import("react").ReactNode }} props
 */
export function HRPageHeader({ eyebrow, title, description, action }) {
  return (
    <div className="page-intro">
      <div>
        {eyebrow && (
          <div className="eyebrow">
            <span className="eyebrow-line" /> {eyebrow}
          </div>
        )}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="intro-actions">{action}</div>}
    </div>
  );
}

/**
 * @param {{ label: string, value: string | number, meta: string,
 *           icon: import("react").ReactNode, tone?: 'green' | 'orange' | 'red' | 'teal' }} props
 */
export function HRStatCard({ label, value, meta, icon, tone = 'green' }) {
  return (
    <div className={`stat-card stat-${tone}`}>
      <div className="stat-icon">{icon}</div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{meta}</span>
      </div>
    </div>
  );
}

/** @param {{ active: boolean, onChange: () => void }} props */
export function HRStatusToggle({ active, onChange }) {
  return (
    <button
      className={`status-toggle ${active ? "on" : "off"}`}
      onClick={onChange}
      aria-pressed={active}
    >
      <span />
      {active ? "Hoạt động" : "Đã khóa"}
    </button>
  );
}

/**
 * @param {{ title: string, children?: import("react").ReactNode, onClose: () => void }} props
 */
export function HRModalShell({ title, children, onClose }) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Đóng">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** @param {{ children?: import("react").ReactNode }} props */
export function HRValidationMessage({ children }) {
  return (
    <div className="inline-error">
      <CircleAlert size={16} />
      {children}
    </div>
  );
}

/** @param {{ approved: boolean }} props */
export function HRResult({ approved }) {
  return (
    <span className={approved ? "result-approved" : "result-rejected"}>
      {approved ? <Check size={13} /> : <X size={13} />}
      {approved ? "Đã ghi nhận" : "Từ chối"}
    </span>
  );
}