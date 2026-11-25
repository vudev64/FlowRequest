import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, FileClock, LogOut, Settings2, UserCog } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { ROLE_LABELS } from '../SystemAdminData.js';
import { cx, initials } from './AdminShared.jsx';
import '../SystemAdmin.css';
import { SystemBrandName, SystemLogo } from '../../SystemConfiguration';
import { AdminPreferencesProvider, AdminPreferenceControls, useAdminPreferences } from '../../AdminPreferences';
const ADMIN_MENU_ITEMS = [{
  href: '/admin/settings',
  label: 'Cấu hình hệ thống',
  icon: Settings2
}, {
  href: '/admin/logs',
  label: 'Nhật ký hệ thống',
  icon: FileClock
}, {
  href: '/admin/accounts',
  label: 'Tài khoản quản trị',
  icon: UserCog
}];

// Sidebar
function AdminSidebar({
  currentUser,
  onLogout
}) {
  const {
    t: translate
  } = useAdminPreferences();
  const {
    pathname: location
  } = useLocation();
  return <aside className="sidebar">
      {/* Brand */}
      <div className="brand">
        <div className="brand-mark"><SystemLogo fallback="F" /></div>
        <div>
          <div className="brand-name"><SystemBrandName /></div>
          <div className="brand-role">SYSTEM ADMIN</div>
        </div>
      </div>

      {/* Navigation */}
      <div className="sidebar-label">{translate("Khu v\u1EF1c k\u1EF9 thu\u1EADt")}</div>

      <nav className="nav-list" aria-label={translate("Điều hướng quản trị")}>
        {ADMIN_MENU_ITEMS.map(({
        href,
        label,
        icon: Icon
      }) => {
        const active = location === href;
        return <Link key={href} to={href} className={cx('nav-item', active && 'nav-item-active')} aria-current={active ? 'page' : undefined}>
              <Icon size={18} />
              <span>{translate(label)}</span>
              {active && <span className="nav-active-line" />}
            </Link>;
      })}
      </nav>

      <div className="sidebar-spacer" />

      {/* User Profile */}
      <div className="sidebar-user">
        <div className="avatar avatar-teal">
          {initials(currentUser?.name)}
        </div>

        <div>
          <strong>{currentUser?.name || translate('Đang tải...')}</strong>
          <span>
            {translate(ROLE_LABELS[currentUser?.role] || 'System Admin')}
          </span>
        </div>

        <button className="icon-button" type="button" aria-label={translate("Đăng xuất")} onClick={onLogout}>
          <LogOut size={16} />
        </button>
      </div>
    </aside>;
}

// Topbar
function AdminTopbar({
  currentUser
}) {
  const {
    t: translate
  } = useAdminPreferences();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const role = String(currentUser?.role || 'SYSTEM_ADMIN').toUpperCase();
  useEffect(() => {
    if (!profileOpen) return;
    const closeOutside = event => {
      if (!profileRef.current?.contains(event.target)) setProfileOpen(false);
    };
    const closeOnEscape = event => {
      if (event.key === 'Escape') {
        setProfileOpen(false);
        profileRef.current?.querySelector('button')?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('focusin', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('focusin', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [profileOpen]);
  return <header className="topbar">
      {/* Mobile Brand */}
      <div className="mobile-brand">
        <div className="brand-mark small"><SystemLogo fallback="F" /></div>
        <strong><SystemBrandName /></strong>
      </div>

      {/* System Status */}
      <div className="topbar-context">
        <span className="status-pulse" />{translate("H\u1EC7 th\u1ED1ng \u0111ang v\u1EADn h\xE0nh \u1ED5n \u0111\u1ECBnh")}</div>

      {/* Actions */}
      <div className="topbar-actions">
        <AdminPreferenceControls />

        <div className="topbar-divider" />

        {/* User Profile */}
        <div className="system-profile-menu" ref={profileRef}>
          <button type="button" className="topbar-profile system-profile-trigger" aria-expanded={profileOpen} aria-controls="system-profile-details" onClick={() => setProfileOpen(open => !open)}>
            <span className="avatar avatar-teal">{initials(currentUser?.name)}</span>
            <span>{currentUser?.name || translate('Đang tải...')}</span>
            <ChevronDown size={15} className={profileOpen ? 'is-open' : ''} />
          </button>
          {profileOpen && <section id="system-profile-details" className="system-profile-dropdown" aria-label={translate('Thông tin tài khoản')}>
            <h2>{translate('Thông tin tài khoản')}</h2>
            <dl>
              <div><dt>{translate('Họ tên')}</dt><dd>{currentUser?.name || '—'}</dd></div>
              <div><dt>{translate('Vai trò')}</dt><dd>{translate(ROLE_LABELS[role] || role)}<small>{role}</small></dd></div>
            </dl>
          </section>}
        </div>
      </div>
    </header>;
}

// Main Layout
function AdminLayoutWorkspace({
  children,
  currentUser,
  onLogout
}) {
  const {
    theme,
    lang
  } = useAdminPreferences();
  return <div className="app-shell system-admin-shell" data-role="System_Admin" data-theme={theme} lang={lang}>
      <AdminSidebar currentUser={currentUser} onLogout={onLogout} />

      <div className="main-area">
        <AdminTopbar currentUser={currentUser} />

        <main className="content-wrap">
          {children}
        </main>
      </div>
    </div>;
}
export function AdminLayout(props) {
  return <AdminPreferencesProvider><AdminLayoutWorkspace {...props} /></AdminPreferencesProvider>;
}
