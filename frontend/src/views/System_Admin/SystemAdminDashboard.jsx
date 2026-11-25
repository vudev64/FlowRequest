import { useAdminPreferences } from "../AdminPreferences";
import React from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { LogsPage } from './components/LogsPage.jsx';
import { AccountsPage } from './components/AccountPage.jsx';
import { SystemSettingsPage } from './components/SystemSettingsPage.jsx';

// ==========================================
// 1. NOT FOUND PAGE
// ==========================================

function NotFound() {
  const {
    t: translate
  } = useAdminPreferences();
  return <div className="not-found">
      <div className="brand-mark">F</div>

      <h1>{translate("Kh\xF4ng t\xECm th\u1EA5y trang")}</h1>

      <p>{translate("Khu v\u1EF1c n\xE0y kh\xF4ng thu\u1ED9c ph\u1EA1m vi qu\u1EA3n tr\u1ECB SYSTEM_ADMIN.")}</p>

      <Link to="/admin/settings" className="button button-primary">{translate("V\u1EC1 c\u1EA5u h\xECnh h\u1EC7 th\u1ED1ng")}</Link>
    </div>;
}

// ==========================================
// 2. SYSTEM ADMIN DASHBOARD
// ==========================================

export function SystemAdminDashboard({
  notify
}) {
  return <Routes>
      <Route path="settings" element={<SystemSettingsPage />} />
      <Route path="logs" element={<LogsPage notify={notify} />} />
      <Route path="accounts" element={<AccountsPage notify={notify} />} />
      <Route path="*" element={<NotFound />} />
    </Routes>;
}
