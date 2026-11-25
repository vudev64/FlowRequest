import { Routes, Route } from "react-router-dom";
import { LoginPage } from "../features/pages/LoginPage";
import EmployeeDashboard from "../views/Employee/EmployeeDashboard";
import ProtectedRoute from "./ProtectRoutes";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/employee"
        element={
          <ProtectedRoute allowedRoles={["employee"]}>
            <EmployeeDashboard />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
