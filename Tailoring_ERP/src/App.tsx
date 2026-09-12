import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { DefaultProviders } from "./components/providers/default.tsx";
import AuthCallback from "./pages/auth/Callback.tsx";
import Login from "./pages/auth/Login.tsx";
import Signup from "./pages/auth/Signup.tsx";
import ForgotPassword from "./pages/auth/ForgotPassword.tsx";
import ResetPassword from "./pages/auth/ResetPassword.tsx";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Onboarding from "./pages/onboarding/page.tsx";
import AppLayout from "./pages/app/layout.tsx";
import Dashboard from "./pages/app/dashboard/page.tsx";
import CustomersPage from "./pages/app/customers/page.tsx";
import CustomerDetailPage from "./pages/app/customers/[id]/page.tsx";
import OrdersPage from "./pages/app/orders/page.tsx";
import OrderDetailPage from "./pages/app/orders/[id]/page.tsx";
import WorkersPage from "./pages/app/workers/page.tsx";
import TasksPage from "./pages/app/tasks/page.tsx";
import PaymentsPage from "./pages/app/payments/page.tsx";
import ReportsPage from "./pages/app/reports/page.tsx";
import SettingsPage from "./pages/app/settings/page.tsx";
import PatternsPage from "./pages/app/patterns/page.tsx";
import BillingPage from "./pages/app/billing/page.tsx";
import { AdminAuthProvider } from "./components/providers/admin-auth.tsx";
import AdminLogin from "./pages/admin/login.tsx";
import AdminLayout from "./pages/admin/layout.tsx";
import AdminDashboard from "./pages/admin/dashboard/page.tsx";
import AdminOrdersPage from "./pages/admin/orders/page.tsx";
import AdminClientsPage from "./pages/admin/clients/page.tsx";
import AdminSchedulePage from "./pages/admin/schedule/page.tsx";
import AdminInventoryPage from "./pages/admin/inventory/page.tsx";
import AdminStaffPage from "./pages/admin/staff/page.tsx";
import AdminShopsPage from "./pages/admin/shops/page.tsx";

export default function App() {
  return (
    <DefaultProviders>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/auth/forgot-password" element={<ForgotPassword />} />
          <Route path="/auth/reset-password" element={<ResetPassword />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/customers/:id" element={<CustomerDetailPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/orders/:id" element={<OrderDetailPage />} />
            <Route path="/workers" element={<WorkersPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/payments" element={<PaymentsPage />} />
            <Route path="/patterns" element={<PatternsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/billing" element={<BillingPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          {/* Platform admin area — own auth context (AdminAuthProvider),
              fully separate from tenant auth above. Shared across both the
              login route and the authenticated shell so there is exactly
              one is_platform_admin() check per session, not one per page. */}
          <Route element={<AdminAuthProvider><Outlet /></AdminAuthProvider>}>
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="orders" element={<AdminOrdersPage />} />
              <Route path="clients" element={<AdminClientsPage />} />
              <Route path="schedule" element={<AdminSchedulePage />} />
              <Route path="inventory" element={<AdminInventoryPage />} />
              <Route path="staff" element={<AdminStaffPage />} />
              <Route path="shops" element={<AdminShopsPage />} />
            </Route>
          </Route>
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </DefaultProviders>
  );
}
