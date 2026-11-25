import './LandingPage.css';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { BrandLogo } from '../auth/BrandLogo.jsx';
import { SystemBrandName } from '../../views/SystemConfiguration';
import { ApprovalFlow } from '../../components/landing/ApprovalFlow.jsx';
import { Hero } from '../../components/landing/Hero.jsx';
import { RequestTypes } from '../../components/landing/RequestTypes.jsx';
import { RoleCards } from '../../components/landing/RoleCards.jsx';
import { SafetyPoints } from '../../components/landing/SafetyPoints.jsx';
import { Stats } from '../../components/landing/Stats.jsx';
import { TryInThreeSteps } from '../../components/landing/TryInThreeSteps.jsx';
import { DEMO_LOGIN_URL, IS_DEMO } from '../../lib/environment';

const navigation = [
  ['#tinh-nang', 'Tổng quan'],
  ['#luong-duyet', 'Quy trình'],
  ['#vai-tro', 'Vai trò'],
  ['#an-toan', 'An toàn'],
];

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef(null);
  function handleEscape(event) {
    if (event.key === 'Escape' && menuOpen) {
      setMenuOpen(false);
      menuButton.current?.focus();
    }
  }

  return (
    <div className="public-landing" lang="vi">
      <a className="public-skip-link" href="#public-main">Đến nội dung chính</a>
      <header className="public-nav" onKeyDown={handleEscape}>
        <div className="landing-container public-nav__inner">
          <Link className="public-nav__brand" to="/" aria-label="Trang chủ" onClick={() => setMenuOpen(false)}>
            <BrandLogo tone="light" compact />
          </Link>
          <nav id="public-navigation" className="public-nav__links" data-open={menuOpen} aria-label="Điều hướng trang">
            {navigation.map(([href, label]) => <a key={href} href={href} onClick={() => setMenuOpen(false)}>{label}</a>)}
            <a className="public-nav__mobile-demo" href="#tai-lieu" onClick={() => setMenuOpen(false)}>{IS_DEMO ? 'Hướng dẫn dùng thử' : 'Hướng dẫn sử dụng'}</a>
          </nav>
          <div className="public-nav__actions">
            <Link className="public-nav__login" to="/login">Đăng nhập</Link>
            <a className="public-nav__demo" href={DEMO_LOGIN_URL}>Trải nghiệm Demo</a>
            <button ref={menuButton} className="public-nav__toggle" type="button" aria-controls="public-navigation" aria-expanded={menuOpen}
              aria-label={menuOpen ? 'Đóng điều hướng' : 'Mở điều hướng'} onClick={() => setMenuOpen(open => !open)}>
              {menuOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </header>
      <main id="public-main" tabIndex={-1}>
        <Hero />
        <Stats />
        <RequestTypes />
        <ApprovalFlow />
        <RoleCards />
        <SafetyPoints />
        <TryInThreeSteps />
      </main>
      <footer className="public-footer">
        <div className="landing-container public-footer__inner">
          <div><Link className="public-footer__brand" to="/" aria-label="Trang chủ"><BrandLogo tone="light" compact /></Link><p>Quản lý đề xuất và phê duyệt nội bộ.</p></div>
          <nav aria-label="Liên kết cuối trang">
            <a href="#luong-duyet">Quy trình phê duyệt</a>
            <a href="#tai-lieu">{IS_DEMO ? 'Hướng dẫn dùng thử' : 'Hướng dẫn sử dụng'}</a>
            <a href="https://github.com" target="_blank" rel="noreferrer">GitHub</a>
          </nav>
        </div>
        <div className="landing-container public-footer__bottom"><span><SystemBrandName /> · Hệ thống nội bộ doanh nghiệp</span><Link to="/login">Truy cập hệ thống</Link></div>
      </footer>
    </div>
  );
}
