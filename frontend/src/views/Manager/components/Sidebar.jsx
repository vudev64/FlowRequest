// Menu Manager,góc quản lý và profile
import { useState } from "react";
import { SystemBrandName, SystemLogo, useSystemConfiguration } from '../../SystemConfiguration';
import {
  BarChart3,
  History,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  ShieldCheck,
  X,
} from "lucide-react";

export function Sidebar({
  currentPath,
  stats,
  mobileOpen,
  onNavigate,
  onClose,
  manager,
  onLogout,
}) {
  const { settings } = useSystemConfiguration();
  const [profileOpen, setProfileOpen] = useState(false);
  const managerName = manager?.name || "Manager";
  const managerRole = manager?.role || "Manager";
  const managerInitials =
    manager?.initials ||
    managerName
      .trim()
      .split(/\s+/)
      .map((word) => word[0])
      .slice(-2)
      .join("")
      .toUpperCase();

  return (
    <aside className={mobileOpen ? "sidebar mobile-open" : "sidebar"}>
      {/* Brand */}
      <div className="brand-lockup">
        <div className="brand-mark">
          <SystemLogo fallback={<><span>F</span><span className="brand-mark-dot" /></>} />
        </div>

        <div>
          <div className="brand-name"><SystemBrandName /></div>
          <div className="brand-subtitle">MANAGER WORKSPACE</div>
        </div>

        <button
          type="button"
          className="icon-button mobile-close"
          onClick={onClose}
          aria-label="Đóng điều hướng"
        >
          <X size={18} />
        </button>
      </div>

      {/* Workspace */}
      <div className="workspace-label">{settings?.general?.companyName || 'MANAGER'}</div>

      {/* Navigation */}
      <nav className="side-nav" aria-label="Điều hướng Manager">
        <div className="nav-group-label">PHÊ DUYỆT</div>

        <SideNavItem
          active={currentPath === "approvals"}
          icon={<LayoutDashboard size={18} />}
          label="Chờ duyệt Team"
          count={stats?.pending ?? 0}
          onClick={() => onNavigate("/manager/approvals")}
        />

        <SideNavItem
          active={currentPath === "history"}
          icon={<History size={18} />}
          label="Lịch sử phê duyệt"
          onClick={() => onNavigate("/manager/history")}
        />

        <div className="nav-group-label nav-group-spaced">
          CÔNG CỤ QUẢN TRỊ
        </div>

        <SideNavItem
          active={currentPath === "security"}
          icon={<ShieldCheck size={18} />}
          label="API & bảo mật"
          onClick={() => onNavigate("/manager/security")}
        />
      </nav>

      {/* Sidebar Bottom */}
      <div className="sidebar-bottom">
        <div className="sidebar-tip">
          <div className="tip-icon">
            <BarChart3 size={16} />
          </div>

          <div>
            <strong>Góc quản lý</strong>
            <span>Đơn cũ nhất được ưu tiên</span>
          </div>
        </div>

        {/* Manager Profile */}
        <div
          className="profile-card"
          role="button"
          tabIndex={0}
          onClick={() => setProfileOpen((current) => !current)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setProfileOpen((current) => !current);
            }
          }}
        >
          <div className="avatar avatar-lg">{managerInitials}</div>

          <div className="profile-info">
            <strong>{managerName}</strong>
            <span>{managerRole}</span>
          </div>

          <button
            type="button"
            className="icon-button"
            aria-label="Tùy chọn tài khoản"
            aria-expanded={profileOpen}
            onClick={(event) => {
              event.stopPropagation();
              setProfileOpen((current) => !current);
            }}
          >
            <MoreHorizontal size={18} />
          </button>
        </div>

        {profileOpen && (
          <div className="profile-popover">
            <div className="profile-popover-head">
              <div className="avatar large">{managerInitials}</div>

              <div>
                <strong>{managerName}</strong>
                <span>{manager.email || "Chưa có email"}</span>
              </div>

              <button
                type="button"
                className="profile-close"
                onClick={() => setProfileOpen(false)}
                aria-label="Đóng thông tin tài khoản"
              >
                <X size={13} />
              </button>
            </div>

            <div className="profile-info-row">
              <span>Vai trò</span>
              <strong>{managerRole}</strong>
            </div>
          </div>
        )}

        <button
          type="button"
          className="logout-button"
          onClick={onLogout}
        >
          <LogOut size={16} />
          Đăng xuất
        </button>
      </div>
    </aside>
  );
}

function SideNavItem({ active, icon, label, count, onClick }) {
  return (
    <button
      type="button"
      className={active ? "side-nav-item active" : "side-nav-item"}
      onClick={onClick}
    >
      {icon}

      <span>{label}</span>

      {count !== undefined && count > 0 && <b>{count}</b>}
    </button>
  );
}
