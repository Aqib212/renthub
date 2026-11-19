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
import { StaffPage } from "@/features/staff/StaffPage";
import { ReceiptViewPage } from "@/features/payments/ReceiptViewPage";
import { PublicReceiptPage } from "@/features/payments/PublicReceiptPage";
import { MessagesPage } from "@/features/notifications/MessagesPage";
import { CashHandoverPage } from "@/features/collections/CashHandoverPage";
import { AgreementListPage } from "@/features/agreements/AgreementListPage";
import { AgreementNewPage } from "@/features/agreements/AgreementNewPage";
import { AgreementDetailPage } from "@/features/agreements/AgreementDetailPage";
import { MoveOutPage } from "@/features/agreements/MoveOutPage";
import { UnitsBoardPage } from "@/features/units/UnitsBoardPage";
import { TenantProfilePage } from "@/features/tenants/TenantProfilePage";
import { SettingsPage } from "@/features/settings/SettingsPage";
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
        <Route path="/r/:token" element={<PublicReceiptPage />} />

        <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/buildings" element={<BuildingListPage />} />
          <Route path="/floors" element={<AllFloorsPage />} />
          <Route path="/buildings/:buildingId/floors" element={<FloorListPage />} />
          <Route path="/flats" element={<AllFlatsPage />} />
          <Route path="/buildings/:buildingId/floors/:floorId/flats" element={<FlatListPage />} />
          <Route path="/tenants" element={<AllTenantsPage />} />
          <Route path="/tenants/:id" element={<TenantProfilePage />} />
          <Route path="/units" element={<UnitsBoardPage />} />
          <Route path="/agreements" element={<AgreementListPage />} />
          <Route path="/agreements/new" element={<AgreementNewPage />} />
          <Route path="/agreements/:id" element={<AgreementDetailPage />} />
          <Route path="/agreements/:id/move-out" element={<MoveOutPage />} />
          <Route path="/buildings/:buildingId/floors/:floorId/flats/:flatId/tenants" element={<TenantListPage />} />
          <Route path="/billing" element={<MonthlyBillingPage />} />
          <Route path="/bill-types" element={<BillTypesPage />} />
          <Route path="/invoices" element={<InvoiceListPage />} />
          <Route path="/invoices/:id/print" element={<InvoiceViewPage />} />
          <Route path="/payments" element={<PaymentListPage />} />
          <Route path="/payments/:id/receipt" element={<ReceiptViewPage />} />
          <Route path="/cash-handover" element={<CashHandoverPage />} />
          <Route path="/messages" element={<ProtectedRoute orgRoles={["OWNER", "MANAGER", "ACCOUNTANT"]}><MessagesPage /></ProtectedRoute>} />
          <Route path="/expenses" element={<ExpenseListPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/utility" element={<Navigate to="/bill-types" replace />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/staff" element={<ProtectedRoute orgRoles={["OWNER"]}><StaffPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute orgRoles={["OWNER"]}><SettingsPage /></ProtectedRoute>} />
        </Route>

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
};
