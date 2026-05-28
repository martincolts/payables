import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { Dashboard } from "./pages/Dashboard";
import { Vendors } from "./pages/Vendors";
import { Bills } from "./pages/Bills";
import { BillDetail } from "./pages/BillDetail";
import { Team } from "./pages/Team";
import { Settings } from "./pages/Settings";
import { ActivityLog } from "./pages/ActivityLog";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { AcceptInvite } from "./pages/AcceptInvite";
import { AdminRoute } from "./auth/ProtectedRoute";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/invite/:token" element={<AcceptInvite />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppShell>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/bills" element={<Bills />} />
                <Route path="/bills/:id" element={<BillDetail />} />
                <Route path="/vendors" element={<Vendors />} />
                <Route
                  path="/team"
                  element={
                    <AdminRoute>
                      <Team />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <AdminRoute>
                      <Settings />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/activity"
                  element={
                    <AdminRoute>
                      <ActivityLog />
                    </AdminRoute>
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AppShell>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
