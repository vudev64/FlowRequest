
import './DemoLoginPage.css';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  FlaskConical,
  LogIn,
  ServerCog,
} from 'lucide-react';

import { BrandLogo } from '../auth/BrandLogo.jsx';
import { ROLES } from '../../lib/domain.js';
import { DEMO_ACCOUNTS } from '../../lib/demoAccounts.js';
import { PRODUCTION_ENABLED, PRODUCTION_LOGIN_URL } from '../../lib/environment.js';
import { apiRequest } from '../../lib/api.js';

/**
 * Trang demo mô phỏng đăng nhập nhanh bằng các tài khoản test.
 */

export function DemoLoginPage() {
  const navigate = useNavigate();
  const [state, setState] = useState('idle');
  const [serverWarming, setServerWarming] = useState(true);

  useEffect(() => {
    let active = true;
    apiRequest('/system/settings').catch(() => { if (active) setState('error'); })
      .finally(() => { if (active) setServerWarming(false); });
    return () => { active = false; };
  }, []);

  const quickLogin = (roleId) => {
    const credentials = DEMO_ACCOUNTS[roleId];
    if (!credentials) {
      setState('error');
      return;
    }

    navigate('/login', { state: { demoCredentials: credentials } });
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 demo-login">
      <div className="border-b border-slate-200 bg-white demo-login__header">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 demo-login__header-inner">
          <a
            href="#/"
            onClick={(e) => {
              e.preventDefault();
              navigate('/');
            }}
          >
            <BrandLogo tone="light" />
          </a>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-300 demo-login__live-tag">
            <FlaskConical className="h-3.5 w-3.5" />
            Live Demo
          </span>
        </div>
      </div>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:px-6 demo-login__main">
        <div className="text-center demo-login__intro">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl demo-login__title">
            Chọn một vai trò để bắt đầu
          </h1>

          <p className="mx-auto mt-3 max-w-2xl text-slate-600 demo-login__lead">
            Mỗi dòng là một tài khoản test cho bản demo. Bấm "Đăng nhập nhanh" để đi thẳng vào
            ứng dụng với vai trò đó — không cần gõ gì.
          </p>

          <p className="mx-auto mt-4 max-w-2xl rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800 demo-login__hint">
            Gợi ý kịch bản: thử tạo đơn nghỉ phép bằng <strong>Nhân viên</strong>, duyệt bằng{' '}
            <strong>Quản lý</strong>, ghi nhận bằng <strong>Nhân sự</strong>.
          </p>
        </div>

        {serverWarming && (
          <div className="mx-auto mt-8 flex max-w-2xl items-center justify-center gap-2.5 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800 demo-login__status demo-login__status--warming">
            <ServerCog className="h-4 w-4 animate-pulse" />
            Đang kiểm tra kết nối máy chủ Demo...
          </div>
        )}

        {state === 'error' && (
          <div
            className="mx-auto mt-8 max-w-2xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-700 demo-login__status demo-login__status--error"
            role="alert"
          >
            Không đăng nhập được lúc này. Vui lòng thử lại sau ít giây.
          </div>
        )}

        <div className="mt-10 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm demo-login__table-panel">
          <div className="overflow-x-auto demo-login__table-scroll">
            <table className="w-full min-w-[720px] text-left text-sm demo-login__table">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500 demo-login__table-head">
                  <th className="px-5 py-3.5 font-semibold">Vai trò</th>
                  <th className="px-5 py-3.5 font-semibold">Mô tả</th>
                  <th className="px-5 py-3.5 font-semibold">Email</th>
                  <th className="px-5 py-3.5 font-semibold">Mật khẩu demo</th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>

              <tbody>
                {ROLES.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70 demo-login__table-row"
                  >
                    <td className="px-5 py-4">
                      <div className="font-bold text-slate-900 demo-login__role-name">{r.name}</div>
                      <div className="text-xs text-slate-500 demo-login__role-id">{r.id}</div>
                    </td>

                    <td className="max-w-[16rem] px-5 py-4 text-slate-600">
                      {r.tagline}
                    </td>

                    <td className="px-5 py-4 font-mono text-xs text-slate-700">
                      {DEMO_ACCOUNTS[r.id].email}
                    </td>

                    <td className="px-5 py-4 font-mono text-xs text-slate-700">
                      {DEMO_ACCOUNTS[r.id].password}
                    </td>

                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => quickLogin(r.id)}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60 demo-login__quick-login"
                      >
                        <LogIn className="h-3.5 w-3.5" />
                        Đăng nhập nhanh
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-4 sm:flex-row demo-login__footer">
          <p className="text-xs text-slate-500 demo-login__footnote">
            Mật khẩu demo chỉ dùng cho bản demo và không liên quan gì đến hệ thống chính.
          </p>

          <div className="flex items-center gap-3">
            {PRODUCTION_ENABLED && <a href={PRODUCTION_LOGIN_URL} className="demo-login__back public-back-button">
              <ArrowLeft className="h-4 w-4" />
              Quay lại đăng nhập thực tế
            </a>}
          </div>
        </div>

        <p className="mt-10 text-center demo-login__back-wrap">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-700 demo-login__back"
          >
            <ArrowLeft className="h-4 w-4" />
            Về trang giới thiệu
          </button>
        </p>
      </main>
    </div>
  );
}
