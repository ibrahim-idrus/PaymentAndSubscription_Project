import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { PlansPage } from "@/pages/PlansPage";
import { CheckoutPage } from "@/pages/CheckoutPage";
import { StatusPage } from "@/pages/StatusPage";
import { SubscriptionPage } from "@/pages/SubscriptionPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/plans" replace />} />
        <Route path="/plans" element={<PlansPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/status" element={<StatusPage />} />
        <Route path="/subscription" element={<SubscriptionPage />} />
      </Routes>
    </BrowserRouter>
  );
}

