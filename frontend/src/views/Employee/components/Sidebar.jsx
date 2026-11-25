import {
  ArrowUpRight,
  FileCheck2,
  FilePlus2,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  Settings2,
  X,
  Zap,
} from "lucide-react";

import { cn, getInitials } from "../../../lib/utils";
import { SystemBrandName, SystemLogo, useSystemConfiguration } from '../../SystemConfiguration';

export default function Sidebar({
  activeNav,
  setActiveNav,
  lang,
  setLang,
  t,
  setProfileOpen,
  profileOpen,
  user,
  onLogout,
}) {
  const { settings } = useSystemConfiguration();
  const openCreate = () => {
    setActiveNav("Tạo đề xuất mới");
  };
  const userInitials = getInitials(user.name);

  return (
    <aside className="sidebar">
      <div className="brand-lockup">
        <div className="brand-mark">
          <SystemLogo fallback={<><span>&lt;</span><Zap size={14} strokeWidth={3} /><span>&gt;</span></>} />
        </div>

        <span className="brand-name">
          <SystemBrandName />
        </span>
      </div>

      <div className="workspace-chip">
        <span className="workspace-dot" />
        {settings?.general?.companyName || 'Employee workspace'}
      </div>

      <nav
        className="sidebar-nav"
        aria-label="Primary navigation"
      >
        <p className="nav-label">WORKSPACE</p>

        <button
          className={cn(
            "nav-item",
            activeNav === "Đơn của tôi" && "active"
          )}
          onClick={() => setActiveNav("Đơn của tôi")}
        >
          <LayoutDashboard size={17} />
          <span>{t.requests}</span>
        </button>

        <button
          className={cn(
            "nav-item",
            activeNav === "Tạo đề xuất mới" && "active"
          )}
          onClick={openCreate}
        >
          <FilePlus2 size={17} />
          <span>{t.newRequest}</span>
        </button>

        <button
          className={cn(
            "nav-item",
            activeNav === "Lịch sử đề xuất" && "active"
          )}
          onClick={() => setActiveNav("Lịch sử đề xuất")}
        >
          <FileCheck2 size={17} />
          <span>{t.history}</span>
        </button>

        <div className="nav-divider" />

        <p className="nav-label">PERSONAL</p>

        <button
          className={cn(
            "nav-item",
            activeNav === "Tài khoản" && "active"
          )}
          onClick={() => setActiveNav("Tài khoản")}
        >
          <Settings2 size={17} />
          <span>{t.account}</span>
        </button>
      </nav>

      <div className="sidebar-bottom">
        <div
          className="user-card"
          role="button"
          tabIndex={0}
          onClick={() =>
            setProfileOpen((current) => !current)
          }
          onKeyDown={(event) => {
            if (
              event.key === "Enter" ||
              event.key === " "
            ) {
              setProfileOpen((current) => !current);
            }
          }}
        >
          <div className="avatar">{userInitials}</div>

          <div className="user-copy">
            <strong>{user.name}</strong>
            <span>{user.department}</span>
          </div>

          <button
            className="icon-button subtle"
            aria-label="More user options"
            onClick={(event) => {
              event.stopPropagation();
              setProfileOpen((current) => !current);
            }}
          >
            <MoreHorizontal size={16} />
          </button>
        </div>

        {profileOpen && (
          <div className="profile-popover">
            <div className="profile-popover-head">
              <div className="avatar large">{userInitials}</div>

              <div>
                <strong>{user.name}</strong>
                <span>{user.email}</span>
              </div>

              <button
                className="profile-close"
                onClick={() => setProfileOpen(false)}
                aria-label={t.close}
              >
                <X size={13} />
              </button>
            </div>

            <div className="profile-info-row">
              <span>{t.role}</span>
              <strong>{user.role}</strong>
            </div>

            <div className="profile-info-row">
              <span>{t.language}</span>

              <div className="profile-language">
                <button
                  className={lang === "vi" ? "selected" : ""}
                  onClick={() => setLang("vi")}
                >
                  Tiếng Việt
                </button>

                <button
                  className={lang === "en" ? "selected" : ""}
                  onClick={() => setLang("en")}
                >
                  English
                </button>
              </div>
            </div>

            <button
              className="profile-account-link"
              onClick={() => {
                setProfileOpen(false);
                setActiveNav("Tài khoản");
              }}
            >
              {t.account}
              <ArrowUpRight size={13} />
            </button>
          </div>
        )}

        <button
          className="logout-button"
          onClick={onLogout}
        >
          <LogOut size={16} />
          {t.logout}
        </button>

        <div className="sidebar-footer">
          <span className="secure-dot" />
          FlowRequest v1.4.0
          <span>•</span>
          Secure workspace
        </div>
      </div>
    </aside>
  );
}
