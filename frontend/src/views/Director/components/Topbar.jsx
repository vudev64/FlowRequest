import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, RefreshCcw } from 'lucide-react';
import { AdminPreferenceControls } from '../../AdminPreferences';
import { SystemBrandName } from '../../SystemConfiguration';
import { DIRECTOR_TABS, initials, roleLabel, textOf } from '../DirectorData';
import { useDirectorLanguage } from '../DirectorLanguage';

const DEFAULT_TITLE = 'Tổng quan';

export default function Topbar({ user, activeTab, onRefresh, loading }) {
  const { lang, t } = useDirectorLanguage();
  const [profileOpen, setProfileOpen] = useState(false);
  const profile = useRef(null);
  const title = DIRECTOR_TABS.find((tab) => tab.id === activeTab)?.label || DEFAULT_TITLE;
  const heading = title === DEFAULT_TITLE ? t('Tổng quan điều hành') : t(title);
  useEffect(() => {
    if (!profileOpen) return;
    const closeOutside = event => { if (!profile.current?.contains(event.target)) setProfileOpen(false); };
    const closeOnEscape = event => {
      if (event.key === 'Escape') { setProfileOpen(false); profile.current?.querySelector('button')?.focus(); }
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

  return (
    <header className="dir-topbar">
      {/* Đường dẫn & tiêu đề */}
      <div>
        <div className="dir-breadcrumb">
          <SystemBrandName/> <span>/</span> {t('Ban Giám đốc')} <span>/</span> {t(title)}
        </div>
        <strong>{heading}</strong>
      </div>

      {/* Làm mới, tùy chọn giao diện và hồ sơ */}
      <div className="dir-topbar-actions">
        <button
          type="button"
          className="dir-icon-btn"
          title={t('Tải lại dữ liệu')}
          onClick={onRefresh}
          disabled={loading}
          aria-label={t('Tải lại dữ liệu')}
        >
          <RefreshCcw size={18} aria-hidden="true"/>
        </button>

        <AdminPreferenceControls/>
        <div className="dir-profile-menu" ref={profile}>
          <button type="button" className="dir-profile" aria-label={t('Thông tin tài khoản')} aria-expanded={profileOpen} aria-controls="dir-profile-details" onClick={() => setProfileOpen(open => !open)}>
            <span className="dir-avatar">{initials(user?.name)}</span>
            <span className="dir-profile-name">
              <strong>{textOf(user, t('Giám đốc'))}</strong>
              <small>{roleLabel(user?.role, lang)}</small>
            </span>
            <ChevronDown size={15} aria-hidden="true"/>
          </button>
          {profileOpen && <section id="dir-profile-details" className="dir-profile-dropdown" aria-label={t('Thông tin tài khoản')}>
            <h2>{t('Thông tin tài khoản')}</h2>
            <dl><dt>{t('Họ tên')}</dt><dd>{textOf(user)}</dd><dt>{t('Vai trò')}</dt><dd>{roleLabel(user?.role, lang)}</dd><dt>Email</dt><dd>{user?.email || '—'}</dd><dt>{t('Phòng ban')}</dt><dd>{textOf(user?.department)}</dd></dl>
          </section>}
        </div>

      </div>
    </header>
  );
}
