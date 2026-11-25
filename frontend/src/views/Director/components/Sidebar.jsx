import React from 'react';
import { DIRECTOR_TABS } from '../DirectorData';
import { ChartNoAxesCombined, ClipboardCheck, LayoutDashboard, LogOut } from 'lucide-react';
import { useDirectorLanguage } from '../DirectorLanguage';
import { SystemBrandName, SystemLogo } from '../../SystemConfiguration';

const TAB_ICONS = { overview: LayoutDashboard, approvals: ClipboardCheck, reports: ChartNoAxesCombined };

export default function Sidebar({ activeTab, onNavigate, onLogout }) {
  const { t } = useDirectorLanguage();
  return (
    <aside className="dir-sidebar" aria-label={t('Điều hướng Ban Giám đốc')}>
      {/* Thương hiệu */}
      <div className="dir-brand">
        <span className="dir-brand-mark"><SystemLogo fallback="F"/></span>
        <span>
          <strong><SystemBrandName/></strong>
          <small>{t('Không gian Giám đốc')}</small>
        </span>
      </div>

      {/* Điều hướng */}
      <p className="dir-section-label">{t('ĐIỀU HÀNH')}</p>
      <nav className="dir-nav">
        {DIRECTOR_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = TAB_ICONS[tab.id];
          return (
            <button
              key={tab.id}
              type="button"
              className={`dir-nav-item ${isActive ? 'is-active' : ''}`}
              onClick={() => onNavigate(tab.id)}
              aria-current={isActive ? 'page' : undefined}
            >
              <span aria-hidden="true"><Icon size={19}/></span>
              {t(tab.label)}
            </button>
          );
        })}
      </nav>

      <div className="dir-sidebar-footer">
        <div className="dir-sidebar-note">
          {t('Phê duyệt theo workflow hiện hành · Ngưỡng 50 triệu VNĐ')}
        </div>
        {typeof onLogout === 'function' && (
          <button type="button" className="dir-nav-item dir-sidebar-signout" onClick={onLogout} aria-label={t('Đăng xuất')}>
            <LogOut size={18} aria-hidden="true"/><span>{t('Đăng xuất')}</span>
          </button>
        )}
      </div>
    </aside>
  );
}
