import {
  ArrowUpRight,
  Bell,
  ChevronRight,
  Languages,
  Moon,
  Search,
  Sun,
} from "lucide-react";
import { useSystemConfiguration } from '../../SystemConfiguration';

export default function Topbar({
  activeNav,
  lang,
  setLang,
  dark,
  onToggleTheme,
  search,
  setSearch,
  t,
  notificationOpen,
  setNotificationOpen,
  onOpenRequest,
  requestItems,
}) {
  const { settings } = useSystemConfiguration();
  return (
    <header className="topbar">
      <div className="breadcrumb">
        <span>
          {activeNav === "Lịch sử đề xuất"
            ? t.history
            : activeNav === "Tài khoản"
              ? t.account
              : t.overview}
        </span>

        <ChevronRight size={13} />

        <strong>{t.workspace}</strong>
      </div>

      <div className="topbar-actions">
        <div className="search-box">
          <Search size={16} />

          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder={t.search}
          />

          <kbd>⌘ K</kbd>
        </div>

        <div className="topbar-divider" />

        {settings?.notificationsEnabled !== false && <div className="notification-wrap">
          <button
            className="icon-button"
            aria-label="Notifications"
            onClick={() =>
              setNotificationOpen(!notificationOpen)
            }
          >
            <Bell size={18} />
            <span className="notification-dot" />
          </button>

          {notificationOpen && (
            <div className="notification-popover">
              <div className="popover-title">
                <span>{t.notificationTitle}</span>
                <span className="unread-label">
                  1 unread
                </span>
              </div>

              <p>{t.notificationBody}</p>

              <button
                onClick={() => {
                  setNotificationOpen(false);
                  onOpenRequest(
                    requestItems[1] || requestItems[0]
                  );
                }}
              >
                {t.detail}
                <ArrowUpRight size={13} />
              </button>
            </div>
          )}
        </div>}

        <button
          className="language-toggle"
          onClick={() =>
            setLang(lang === "vi" ? "en" : "vi")
          }
        >
          <Languages size={15} />

          <span
            className={
              lang === "vi" ? "selected" : ""
            }
          >
            VI
          </span>

          <span>/</span>

          <span
            className={
              lang === "en" ? "selected" : ""
            }
          >
            EN
          </span>
        </button>

        <button
          className="icon-button"
          aria-label="Toggle theme"
          onClick={onToggleTheme}
        >
          {dark ? (
            <Sun size={17} />
          ) : (
            <Moon size={17} />
          )}
        </button>
      </div>
    </header>
  );
}
