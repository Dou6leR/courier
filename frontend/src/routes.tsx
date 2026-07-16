import { Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "@/features/auth/LoginPage";
import { AdminLoginPage } from "@/features/auth/AdminLoginPage";
import { RegisterPage } from "@/features/auth/RegisterPage";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { useAuth } from "@/features/auth/AuthContext";

import ClientLayout from "@/components/layout/ClientLayout";
import CourierLayout from "@/components/layout/CourierLayout";
import AdminLayout from "@/components/layout/AdminLayout";

import MyDeliveries from "@/features/client/pages/MyDeliveries";
import Archive from "@/features/client/pages/Archive";
import PendingConfirmations from "@/features/client/pages/PendingConfirmations";
import Profile from "@/features/client/pages/Profile";
import CreateDelivery from "@/features/client/pages/CreateDelivery";
import OrderDetails from "@/features/client/pages/OrderDetails";
import ReceiptPage from "@/features/client/pages/Receipt";
import ConfirmDelivery from "@/features/recipient/pages/ConfirmDelivery";

import CourierDashboard from "@/features/courier/pages/CourierDashboard";
import OrderManagement from "@/features/courier/pages/OrderManagement";
import OrderExecution from "@/features/courier/pages/OrderExecution";
import DeliveryHistory from "@/features/courier/pages/DeliveryHistory";
import CourierProfile from "@/features/courier/pages/CourierProfile";

import AdminDashboard from "@/features/admin/pages/AdminDashboard";
import AdminUsers from "@/features/admin/pages/Users";
import Reports from "@/features/admin/pages/Reports";

function HomeRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="p-6 text-center">Завантаження…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.roles.includes("admin")) return <Navigate to="/admin" replace />;
  if (user.roles.includes("courier")) return <Navigate to="/courier" replace />;
  if (user.roles.includes("client")) return <Navigate to="/client" replace />;
  return <Navigate to="/login" replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Client */}
      <Route
        path="/client"
        element={
          <ProtectedRoute role="client">
            <ClientLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<MyDeliveries />} />
        <Route path="pending" element={<PendingConfirmations />} />
        <Route path="archive" element={<Archive />} />
        <Route path="profile" element={<Profile />} />
        <Route path="create" element={<CreateDelivery />} />
        <Route path="orders/:id" element={<OrderDetails />} />
        <Route path="orders/:id/receipt" element={<ReceiptPage />} />
        <Route path="confirm/:id" element={<ConfirmDelivery />} />
      </Route>

      {/* Courier */}
      <Route
        path="/courier"
        element={
          <ProtectedRoute role="courier">
            <CourierLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<CourierDashboard />} />
        <Route path="orders/:id" element={<OrderManagement />} />
        <Route path="execution/:id" element={<OrderExecution />} />
        <Route path="history" element={<DeliveryHistory />} />
        <Route path="orders/:id/receipt" element={<ReceiptPage />} />
        <Route path="profile" element={<CourierProfile />} />
      </Route>

      {/* Admin */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute role="admin">
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="reports" element={<Reports />} />
      </Route>

      <Route path="/" element={<HomeRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
