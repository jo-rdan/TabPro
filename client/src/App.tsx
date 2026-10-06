import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import ProtectedRoute from "./components/ProtectedRoute";
import { useThemeStore } from "./lib/theme";

// Owner pages
import Login from "./pages/owner/Login";
import AuthCallback from "./pages/owner/AuthCallback";
import Dashboard from "./pages/owner/Dashboard";
import Tables from "./pages/owner/Tables";
import Staff from "./pages/owner/Staff";
import ActivityLog from "./pages/owner/ActivityLog";
import InviteAccept from "./pages/owner/InviteAccept";
import VenueSetup from "./pages/owner/VenueSetup";
import MenuManagement from "./pages/owner/MenuManagement";
import Subscription from "./pages/owner/Subscription";
import Campaigns from "./pages/owner/Campaigns";
import Ratings from "./pages/owner/Ratings";
import BusyHours from "./pages/owner/BusyHours";
import Shifts from "./pages/owner/Shifts";
import ClaimSticker from "./pages/owner/ClaimSticker";

// Waiter pages
import WaiterOrders from "./pages/waiter/Orders";
import WaiterLogin from "./pages/waiter/WaiterLogin";
import ClockIn from "./pages/waiter/ClockIn";

// Customer pages
import CustomerMenu from "./pages/customer/Menu";

// Shared
import Receipt from "./pages/Receipt";
import Landing from "./pages/Landing";
import Waitlist from "./pages/Waitlist";

export default function App() {
  const { init } = useThemeStore();

  useEffect(() => {
    init();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/invite/:token" element={<InviteAccept />} />

        {/* Customer — public, accessed via QR scan */}
        <Route path="/t/:qrCode" element={<CustomerMenu />} />

        {/* Waiter */}
        <Route path="/waiter" element={<WaiterLogin />} />
        <Route path="/clock-in" element={<ClockIn />} />
        <Route path="/waiter/orders" element={<WaiterOrders />} />

        {/* Receipt — accessible by cashier/owner, no strict auth gate needed */}
        <Route path="/receipt/:tabId" element={<Receipt />} />

        {/* Owner — protected */}
        <Route
          path="/setup"
          element={
            <ProtectedRoute>
              <VenueSetup />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tables"
          element={
            <ProtectedRoute>
              <Tables />
            </ProtectedRoute>
          }
        />
        <Route
          path="/menu"
          element={
            <ProtectedRoute>
              <MenuManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff"
          element={
            <ProtectedRoute>
              <Staff />
            </ProtectedRoute>
          }
        />
        <Route
          path="/activity"
          element={
            <ProtectedRoute>
              <ActivityLog />
            </ProtectedRoute>
          }
        />
        <Route
          path="/subscription"
          element={
            <ProtectedRoute>
              <Subscription />
            </ProtectedRoute>
          }
        />
        <Route
          path="/campaigns"
          element={
            <ProtectedRoute>
              <Campaigns />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ratings"
          element={
            <ProtectedRoute>
              <Ratings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/busy-hours"
          element={
            <ProtectedRoute>
              <BusyHours />
            </ProtectedRoute>
          }
        />
        <Route
          path="/shifts"
          element={
            <ProtectedRoute>
              <Shifts />
            </ProtectedRoute>
          }
        />
        <Route
          path="/claim-sticker"
          element={
            <ProtectedRoute>
              <ClaimSticker />
            </ProtectedRoute>
          }
        />

        <Route path="/privacy.html" element={null} />
        <Route path="/terms.html" element={null} />

        {/* Public homepage + catch-all */}
        <Route path="/waitlist" element={<Waitlist />} />
        <Route path="/" element={<Landing />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
