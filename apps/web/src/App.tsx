import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { PlansPage } from "@/pages/PlansPage";
import { PaymentStatusPage } from "@/pages/PaymentStatusPage";
import { CustomersPage } from "@/pages/CustomersPage";
import { AddCustomerPage } from "@/pages/AddCustomerPage";
import { AddInvoicePage } from "@/pages/AddInvoicePage";
import { DashboardPage } from "@/pages/DashboardPage";
import { MySubscriptionPage } from "@/pages/MySubscriptionPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/my-subscription" element={<MySubscriptionPage />} />
        <Route path="/plans" element={<PlansPage />} />
        <Route path="/payment/status/:orderId" element={<PaymentStatusPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/customers/new" element={<AddCustomerPage />} />
        <Route path="/invoices/new" element={<AddInvoicePage />} />
      </Routes>
    </BrowserRouter>
  );
}

