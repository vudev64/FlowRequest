import { Link } from "react-router-dom";
import { ArrowRight, CircleAlert, ClipboardCheck, LayoutDashboard, LogOut, ShieldCheck, Users } from "lucide-react";
import { HR_NAV_ITEMS } from "./HRAdminData";

const icons = {
  overview: LayoutDashboard,
  users: Users,
  approvals: ClipboardCheck,
  permissions: ShieldCheck,
};

/** @param {string} name */
function getUserInitials(name) {
  return name
    ?.split(" ")
    .map((w) => w[0])
    .slice(-2)
    .join("")
    .toUpperCase();
}

/** @param {{ initials: string, tone?: string }} props */
function Avatar({ initials, tone = "indigo" }) {
  return <div className={`avatar avatar-${tone}`}>{initials}</div>;
}

/**
 * @param {{ active: string, currentUser?: { name?: string; department?: string }, onLogout?: () => void, children?: import("react").ReactNode }} props
 */
export function HRAdminLayout({ active, currentUser, onLogout, children }) {
  return (
    <div className="hr-admin-component-layout">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark">
            <span />
            <span className="brand-mark-dot" />
          </div>
          <div>
            <b>
              Flow<span>Request</span>
            </b>
            <small className="brand-subtitle">HR WORKSPACE</small>
          </div>
        </div>

        <div className="nav-group-label">Không gian làm việc</div>
        <nav className="side-nav">
          {HR_NAV_ITEMS.map((item) => {
            const Icon = icons[item.key];
            return (
              <Link
                key={item.key}
                to={item.href}
                className={`side-nav-item ${active === item.key ? "active" : ""}`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
                {item.key === "approvals" && (
                  <b>
                    <span className="brand-mark-dot" />
                  </b>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <div className="tip-icon">
              <CircleAlert size={17} />
            </div>
            <div>
              <strong>Cần hỗ trợ?</strong>
              <span>Xem hướng dẫn sử dụng</span>
            </div>
            <ArrowRight size={15} />
          </div>
          <div className="profile">
            <Avatar initials={getUserInitials(currentUser?.name)} tone="purple" />
            <div>
              <b>{currentUser?.name || "HR Admin"}</b>
              <span>HR_ADMIN · {currentUser?.department || "Nhân sự"}</span>
            </div>
            <button
              className="icon-button"
              type="button"
              aria-label="Đăng xuất"
              onClick={onLogout}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      <main className="main-area">{children}</main>
    </div>
  );
}