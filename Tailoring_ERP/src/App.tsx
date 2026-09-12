import { BrowserRouter, Route, Routes } from "react-router-dom";
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
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </DefaultProviders>
  );
}
