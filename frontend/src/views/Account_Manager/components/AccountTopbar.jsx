import { useEffect, useRef, useState } from 'react';
import { ChevronDown, RefreshCcw, Search } from 'lucide-react';
import { AdminPreferenceControls } from '../../AdminPreferences';
import { useAccountLanguage } from '../AccountLanguage';
import { initials, roleLabel } from '../AccountData';

export default function AccountTopbar({ active, user, search, onSearch, onRefresh, loading }) {
  const { text, lang } = useAccountLanguage();
  const titles = { overview: text('Tổng quan tài chính', 'Financial overview'), approvals: text('Xét duyệt đề xuất', 'Request approvals'), payments: text('Quản lý thanh toán', 'Payments') };
  const [profileOpen, setProfileOpen] = useState(false);
  const profile = useRef(null);
  useEffect(() => {
    if (!profileOpen) return;
    const closeOutside = event => { if (!profile.current?.contains(event.target)) setProfileOpen(false); };
    const closeOnEscape = event => { if (event.key === 'Escape') { setProfileOpen(false); profile.current?.querySelector('button')?.focus(); } };
    document.addEventListener('pointerdown', closeOutside); document.addEventListener('focusin', closeOutside); document.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('focusin', closeOutside); document.removeEventListener('keydown', closeOnEscape); };
  }, [profileOpen]);
  return <header className="acc-topbar"><div className="acc-heading"><span className="acc-breadcrumb">{text('Kế toán', 'Accountant')} / {titles[active]}</span><h1>{titles[active]}</h1></div>
    <div className="acc-top-actions">
      {active === 'approvals' && <label className="acc-search"><Search size={17} aria-hidden="true" /><input aria-label={text('Tìm đơn', 'Search requests')} placeholder={text('Tìm mã, tên đơn…', 'Search ID or title…')} value={search} onChange={event => onSearch(event.target.value)} /></label>}
      <button type="button" className="acc-iconbtn" onClick={onRefresh} disabled={loading} aria-label={text('Làm mới dữ liệu', 'Refresh data')} title={text('Làm mới dữ liệu', 'Refresh data')}><RefreshCcw size={18} aria-hidden="true" /></button>
      <AdminPreferenceControls />
      <div className="acc-profile-menu" ref={profile}>
        <button type="button" className="acc-profile" aria-expanded={profileOpen} aria-controls="acc-profile-details" onClick={() => setProfileOpen(open => !open)}><span className="acc-avatar">{initials(user?.name)}</span><span className="acc-profile-name">{user?.name || '—'}</span><ChevronDown size={15} aria-hidden="true" /></button>
        {profileOpen && <section id="acc-profile-details" className="acc-profile-dropdown" aria-label={text('Thông tin tài khoản', 'Account information')}><h2>{text('Thông tin tài khoản', 'Account information')}</h2><dl><dt>{text('Họ tên', 'Name')}</dt><dd>{user?.name || '—'}</dd><dt>{text('Vai trò', 'Role')}</dt><dd>{roleLabel(user?.role, lang)}</dd><dt>Email</dt><dd>{user?.email || '—'}</dd><dt>{text('Phòng ban', 'Department')}</dt><dd>{typeof user?.department === 'object' ? user.department?.name || '—' : user?.department || '—'}</dd></dl></section>}
      </div>
    </div>
  </header>;
}
