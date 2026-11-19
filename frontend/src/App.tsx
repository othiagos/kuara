import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth, User } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ToastProvider } from "./contexts/ToastContext";
import { Navbar } from "./components/Navbar";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { ClientDashboard } from "./pages/ClientDashboard";
import { ProviderDashboard } from "./pages/ProviderDashboard";
import { AdminDashboard } from "./pages/AdminDashboard";
import { ServiceDetails } from "./pages/ServiceDetails";
import { Loader2 } from "lucide-react";

const getDashboardPathByRole = (role: User["role"]) => {
  if (role === "CLIENT") return "/dashboard/client";
  if (role === "PROVIDER") return "/dashboard/provider";
  return "/dashboard/admin";
};

const ProtectedRoute: React.FC<{
  children: React.ReactElement;
  allowedRole?: User["role"];
}> = ({ children, allowedRole }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--kuara-bg)] flex items-center justify-center p-6">
        <div className="flex items-center gap-2.5 text-xs text-[var(--kuara-fg-muted)]">
          <Loader2 className="w-4 h-4 animate-spin text-[var(--kuara-primary)]" />
          <span>Carregando sessão...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRole && user.role !== allowedRole) {
    return <Navigate to={getDashboardPathByRole(user.role)} replace />;
  }

  return children;
};

const PublicLayout: React.FC<{ children: React.ReactElement }> = ({ children }) => (
  <div className="min-h-screen flex flex-col bg-[var(--kuara-bg)] text-[var(--kuara-fg)] antialiased">
    <Navbar />
    <main className="flex-1">{children}</main>
  </div>
);

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Routes with Navbar */}
              <Route path="/" element={<PublicLayout><Home /></PublicLayout>} />
              <Route path="/login" element={<PublicLayout><Login /></PublicLayout>} />
              <Route path="/register" element={<PublicLayout><Register /></PublicLayout>} />

              {/* Authenticated Routes with Sidebar + Topbar (No double Navbar) */}
              <Route
                path="/dashboard/client"
                element={
                  <ProtectedRoute allowedRole="CLIENT">
                    <ClientDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/provider"
                element={
                  <ProtectedRoute allowedRole="PROVIDER">
                    <ProviderDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/admin"
                element={
                  <ProtectedRoute allowedRole="ADMIN">
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/services/:id"
                element={
                  <ProtectedRoute>
                    <ServiceDetails />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
};

export default App;
