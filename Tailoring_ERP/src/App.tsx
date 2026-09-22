import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
} from "react-router-dom";
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
import AppNotFound from "./pages/app/not-found.tsx";
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
import AdminNotFound from "./pages/admin/not-found.tsx";
import AdminActivityPage from "./pages/admin/activity/page.tsx";
import AdminAuditPage from "./pages/admin/audit/page.tsx";
import AdminRevenuePage from "./pages/admin/revenue/page.tsx";

// Platform admin area — own auth context (AdminAuthProvider), fully
// separate from tenant auth. Shared across both the login route and the
// authenticated shell so there is exactly one is_platform_admin() check per
// session, not one per page.
//
// Pulled into a function (not a <Route>-tree constant) so the exact same
// element tree can be mounted twice: under /admin on the combined
// deployment below, and again — unchanged — on the dedicated admin
// subdomain build. Every internal link inside the admin pages is an
// absolute "/admin/..." path, so reusing the identical tree (rather than
// re-rooting it) means none of those links need to know which deployment
// they're running on.
function AdminRoutes() {
  return (
    <Route
      element={
        <AdminAuthProvider>
          <Outlet />
        </AdminAuthProvider>
      }
    >
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
        <Route path="activity" element={<AdminActivityPage />} />
        <Route path="audit" element={<AdminAuditPage />} />
        <Route path="revenue" element={<AdminRevenuePage />} />
        <Route path="*" element={<AdminNotFound />} />
      </Route>
    </Route>
  );
}

// Set only on the dedicated admin.<domain> Vercel project (see
// .env.local.example) — every other deployment, including local dev,
// leaves this unset and gets the normal combined tenant + admin app.
const isAdminOnly = import.meta.env.VITE_ADMIN_ONLY === "true";

export default function App() {
  return (
    <DefaultProviders>
      <BrowserRouter>
        <Routes>
          {isAdminOnly ? (
            <>
              {AdminRoutes()}
              {/* Bare "/", stray tenant links, typos — anything outside
                  /admin on this deployment lands on the admin login or
                  dashboard rather than a dead end. */}
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </>
          ) : (
            <>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route
                path="/auth/forgot-password"
                element={<ForgotPassword />}
              />
              <Route
                path="/auth/reset-password"
                element={<ResetPassword />}
              />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/customers" element={<CustomersPage />} />
                <Route
                  path="/customers/:id"
                  element={<CustomerDetailPage />}
                />
                <Route path="/orders" element={<OrdersPage />} />
                <Route path="/orders/:id" element={<OrderDetailPage />} />
                <Route path="/workers" element={<WorkersPage />} />
                <Route path="/tasks" element={<TasksPage />} />
                <Route path="/payments" element={<PaymentsPage />} />
                <Route path="/patterns" element={<PatternsPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/billing" element={<BillingPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<AppNotFound />} />
              </Route>

              {AdminRoutes()}
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </>
          )}
        </Routes>
      </BrowserRouter>
    </DefaultProviders>
  );
}
