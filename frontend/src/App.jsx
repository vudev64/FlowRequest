import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";

import EmployeeDashboard from "./views/Employee/EmployeeDashboard";
import { ManagerDashboard } from "./views/Manager/ManagerDashboard";
import { LoginPage } from "./features/pages/LoginPage";
import { LandingPage } from "./features/pages/LandingPage";
import { DemoLoginPage } from "./features/pages/DemoLoginPage";
import { SUPPORTED_LOGIN_ROLES } from "./features/auth/authService";
import { APP_BASE_PATH, DEMO_LOGIN_URL, IS_DEMO, TOKEN_KEY, USER_KEY } from './lib/environment';
import HRAdminDashboard from "./views/Hr_Admin/HRAdminDashboard";
import { SystemAdminDashboard } from "./views/System_Admin/SystemAdminDashboard";
import { AdminLayout } from "./views/System_Admin/components/AdminLayout";
import { Toast } from "./views/System_Admin/components/AdminShared";
import AccountDashboard from "./views/Account_Manager/AccountDashboard";
import DirectorDashboard from "./views/Director/DirectorDashboard";
// Lấy thông tin tài khoản đã đăng nhập
function getStoredUser() {
  try {
    const user = JSON.parse(
      localStorage.getItem(USER_KEY)
    );

    const role = user?.role?.toLowerCase();

    if (SUPPORTED_LOGIN_ROLES.includes(role)) {
      return { ...user, role };
    }

    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    return null;
  } catch {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    return null;
  }
}

// Xác định đường dẫn theo role
function getDashboardPath(user) {
  switch (user?.role) {
    case "manager":
      return "/manager";
    case "hr_admin":
      return "/hr";
    case "system_admin":
      return "/admin/settings";
    case "accountant":
      return "/account";
    case "director":
      return "/director";
    default:
      return "/dashboard";
  }
}

function SystemAdminWorkspace({ user, onLogout }) {
  const [toast, setToast] = useState(null);
  const notify = (type, title, message) => setToast({ type, title, message });

  return (
    <AdminLayout
      currentUser={{ ...user, role: user.role.toUpperCase() }}
      onLogout={onLogout}
    >
      <SystemAdminDashboard notify={notify} />
      <Toast toast={toast} onClose={() => setToast(null)} />
    </AdminLayout>
  );
}

function OpenDemo() {
  useEffect(() => { window.location.replace(DEMO_LOGIN_URL); }, []);
  return <a className="public-back-button" href={DEMO_LOGIN_URL}>Trải nghiệm Demo</a>;
}

export function AppContent() {
  const [user, setUser] = useState(getStoredUser);
  const navigate = useNavigate();
  const location = useLocation();
  const demoCredentials = IS_DEMO ? location.state?.demoCredentials : undefined;

  // Đăng nhập thành công
  const handleLoginSuccess = (loggedInUser) => {
    const normalizedUser = {
      ...loggedInUser,
      role: loggedInUser?.role?.toLowerCase(),
    };

    if (!SUPPORTED_LOGIN_ROLES.includes(normalizedUser.role)) {
      return;
    }

    localStorage.setItem(
      USER_KEY,
      JSON.stringify(normalizedUser)
    );

    setUser(normalizedUser);

    navigate(getDashboardPath(normalizedUser), {
      replace: true,
    });
  };

  // Đăng xuất
  const handleLogout = () => {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);

    navigate("/login", {
      replace: true,
    });
  };

  // Điều hướng theo tài khoản hiện tại
  const dashboardPath = getDashboardPath(user);

  return (
    <Routes>
      {/* Marketing page */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/landing" element={<LandingPage />} />

      {/* Trang đăng nhập */}
      <Route
        path="/login"
        element={
          user && !demoCredentials ? (
            <Navigate to={dashboardPath} replace />
          ) : (
            <LoginPage
              initialCredentials={demoCredentials}
              onLoginSuccess={handleLoginSuccess}
            />
          )
        }
      />
      <Route
        path="/dang-nhap"
        element={<Navigate to="/login" replace />}
      />
      <Route
        path="/dang-nhap-demo"
        element={IS_DEMO ? <DemoLoginPage /> : <OpenDemo />}
      />

      {/* Employee Dashboard */}
      <Route
        path="/dashboard"
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : user.role === "employee" ? (
            <EmployeeDashboard
              user={user}
              onLogout={handleLogout}
            />
          ) : (
            <Navigate to={dashboardPath} replace />
          )
        }
      />

      {/* Manager Dashboard */}
      <Route
        path="/manager/*"
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : user.role === "manager" ? (
            <ManagerDashboard
              user={user}
              onLogout={handleLogout}
            />
          ) : (
            <Navigate to={dashboardPath} replace />
          )
        }
      />

      {/* HR Admin Dashboard */}
      <Route
        path="/hr/*"
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : user.role === "hr_admin" ? (
            <HRAdminDashboard user={user} onLogout={handleLogout} />
          ) : (
            <Navigate to={dashboardPath} replace />
          )
        }
      />

      {/* Accountant Dashboard */}
      <Route
        path="/account/*"
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : user.role === "accountant" ? (
            <AccountDashboard token={localStorage.getItem(TOKEN_KEY)} user={user} onLogout={handleLogout} />
          ) : (
            <Navigate to={dashboardPath} replace />
          )
        }
      />

      {/* Director Dashboard */}
      <Route
        path="/director/*"
        element={
          !user ? <Navigate to="/login" replace /> : user.role === "director" ? (
            <DirectorDashboard token={localStorage.getItem(TOKEN_KEY)} user={user} onLogout={handleLogout} />
          ) : <Navigate to={dashboardPath} replace />
        }
      />

      {/* System Admin Dashboard */}
      <Route
        path="/admin/*"
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : user.role === "system_admin" ? (
            <SystemAdminWorkspace user={user} onLogout={handleLogout} />
          ) : (
            <Navigate to={dashboardPath} replace />
          )
        }
      />

      {/* Đường dẫn không tồn tại */}
      <Route
        path="*"
        element={
          <Navigate
            to={user ? dashboardPath : "/login"}
            replace
          />
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter basename={APP_BASE_PATH || '/'}>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
