import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "@/features/auth/LoginPage";
import { RegisterPage } from "@/features/auth/RegisterPage";
import { ForgotPasswordPage } from "@/features/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "@/features/auth/ResetPasswordPage";
import { VerifyEmailPage } from "@/features/auth/VerifyEmailPage";
import { ProfilePage } from "@/features/auth/ProfilePage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { BuildingListPage } from "@/features/buildings/BuildingListPage";
import { FloorListPage } from "@/features/floors/FloorListPage";
import { AllFloorsPage } from "@/features/floors/AllFloorsPage";
import { FlatListPage } from "@/features/flats/FlatListPage";
import { AllFlatsPage } from "@/features/flats/AllFlatsPage";
import { TenantListPage } from "@/features/tenants/TenantListPage";
import { AllTenantsPage } from "@/features/tenants/AllTenantsPage";
import { BillTypesPage } from "@/features/bill-types/BillTypesPage";
import { MonthlyBillingPage } from "@/features/billing/MonthlyBillingPage";
import InvoiceListPage from "@/features/invoices/InvoiceListPage";
import { InvoiceViewPage } from "@/features/invoices/InvoiceViewPage";
import { PublicInvoicePage } from "@/features/invoices/PublicInvoicePage";
import PaymentListPage from "@/features/payments/PaymentListPage";
import ExpenseListPage from "@/features/expenses/ExpenseListPage";
import ReportsPage from "@/features/reports/ReportsPage";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { ProtectedRoute, PublicRoute } from "./ProtectedRoute";

export const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
        <Route path="/reset-password" element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/i/:token" element={<PublicInvoicePage />} />

        <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/buildings" element={<BuildingListPage />} />
          <Route path="/floors" element={<AllFloorsPage />} />
          <Route path="/buildings/:buildingId/floors" element={<FloorListPage />} />
          <Route path="/flats" element={<AllFlatsPage />} />
          <Route path="/buildings/:buildingId/floors/:floorId/flats" element={<FlatListPage />} />
          <Route path="/tenants" element={<AllTenantsPage />} />
          <Route path="/buildings/:buildingId/floors/:floorId/flats/:flatId/tenants" element={<TenantListPage />} />
          <Route path="/billing" element={<MonthlyBillingPage />} />
          <Route path="/bill-types" element={<BillTypesPage />} />
          <Route path="/invoices" element={<InvoiceListPage />} />
          <Route path="/invoices/:id/print" element={<InvoiceViewPage />} />
          <Route path="/payments" element={<PaymentListPage />} />
          <Route path="/expenses" element={<ExpenseListPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/utility" element={<Navigate to="/bill-types" replace />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
};
