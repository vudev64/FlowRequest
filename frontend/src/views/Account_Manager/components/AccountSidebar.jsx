import { LayoutDashboard, ClipboardCheck, CreditCard, LogOut, Wallet } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { SystemBrandName, SystemLogo } from '../../SystemConfiguration';
import { ACCOUNT_TABS, initials } from '../AccountData';
import { useAccountLanguage } from '../AccountLanguage';

const icons = { overview: LayoutDashboard, approvals: ClipboardCheck, payments: CreditCard };
export default function AccountSidebar({ user, onLogout }) {
  const { text, lang } = useAccountLanguage();
  return <aside className="acc-sidebar">
    <div className="acc-brand"><span className="acc-brand-mark"><SystemLogo fallback={<Wallet size={21} aria-hidden="true" />} /></span><div><strong><SystemBrandName /></strong><small>{text('KHÔNG GIAN KẾ TOÁN', 'ACCOUNTANT WORKSPACE')}</small></div></div>
    <div className="acc-sidebar-label">{text('KHÔNG GIAN LÀM VIỆC', 'WORKSPACE')}</div>
    <nav aria-label={text('Điều hướng Kế toán', 'Accountant navigation')}>{ACCOUNT_TABS.map(tab => {
      const Icon = icons[tab.key];
      return <NavLink key={tab.key} to={tab.path} end={tab.key === 'overview'} className={({ isActive }) => `acc-nav${isActive ? ' active' : ''}`}><Icon size={18} aria-hidden="true" /><span>{lang === 'en' ? tab.en : tab.label}</span></NavLink>;
    })}</nav>
    <div className="acc-side-bottom"><span className="acc-avatar">{initials(user?.name)}</span><div><strong>{user?.name || '—'}</strong><small>{text('Kế toán', 'Accountant')}</small></div>{onLogout && <button type="button" className="acc-logout" onClick={onLogout} aria-label={text('Đăng xuất', 'Sign out')}><LogOut size={18} /></button>}</div>
  </aside>;
}
