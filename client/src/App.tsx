import { CLOCK_IN_ENABLED } from "./lib/features";
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
import Stock from "./pages/owner/Stock";
import Campaigns, { CampaignNew, CampaignDetail } from "./pages/owner/Campaigns";
import Bookings from "./pages/owner/Bookings";
import Explore from "./pages/guest/Explore";
import VenuePage from "./pages/guest/VenuePage";
import BookTable from "./pages/guest/BookTable";
import BookingStatus from "./pages/guest/BookingStatus";
import Me from "./pages/guest/Me";
import MyBookings from "./pages/guest/MyBookings";
import { HomeScreenGuide, Join } from "./pages/guest/HomeScreen";
import CreatorJoin from "./pages/guest/CreatorJoin";
import { CreatorHome, CreatorLink } from "./pages/guest/CreatorHome";
import CreatorsAdmin from "./pages/owner/CreatorsAdmin";
import PlansAdmin from "./pages/owner/PlansAdmin";
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
import VenueTerms from "./pages/VenueTerms";
import Waitlist from "./pages/Waitlist";
import { WAITLIST_MODE } from "./lib/waitlistMode";

export default function App() {
  const { init } = useThemeStore();

  useEffect(() => {
    init();
  }, []);

  return (
    <BrowserRouter>
      {WAITLIST_MODE ? (
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/waitlist" element={<Waitlist />} />
          <Route path="/venue-terms" element={<VenueTerms />} />
          <Route path="/creators/join" element={<CreatorJoin />} />
          <Route path="/creator/:token" element={<CreatorHome />} />
          <Route path="/privacy.html" element={null} />
          <Route path="/terms.html" element={null} />
          <Route path="*" element={<Navigate to="/waitlist" replace />} />
        </Routes>
      ) : (
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/invite/:token" element={<InviteAccept />} />

        {/* Customer — public, accessed via QR scan */}
        <Route path="/t/:qrCode" element={<CustomerMenu />} />

        {/* Waiter */}
        <Route path="/waiter" element={<WaiterLogin />} />
        <Route path="/clock-in" element={CLOCK_IN_ENABLED ? <ClockIn /> : <ClockInOff />} />
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
          path="/history"
          element={
            <ProtectedRoute>
              <ActivityLog />
            </ProtectedRoute>
          }
        />
        <Route path="/activity" element={<Navigate to="/history" replace />} />
        <Route
          path="/subscription"
          element={
            <ProtectedRoute>
              <Subscription />
            </ProtectedRoute>
          }
        />
        <Route path="/stock" element={<ProtectedRoute><Stock /></ProtectedRoute>} />
        <Route path="/campaigns" element={<ProtectedRoute><Campaigns /></ProtectedRoute>} />
        <Route path="/campaigns/new" element={<ProtectedRoute><CampaignNew /></ProtectedRoute>} />
        <Route path="/campaigns/:campaignId" element={<ProtectedRoute><CampaignDetail /></ProtectedRoute>} />
        <Route path="/bookings" element={<ProtectedRoute><Bookings /></ProtectedRoute>} />

        {/* Guests' own Skuzi: Explore, venue pages, bookings, invites */}
        <Route path="/explore" element={<Explore />} />
        <Route path="/v/:slug" element={<VenuePage />} />
        <Route path="/v/:slug/book" element={<BookTable />} />
        <Route path="/booking/:id" element={<BookingStatus />} />
        <Route path="/me" element={<Me />} />
        <Route path="/my-bookings" element={<MyBookings />} />
        <Route path="/home-screen/:code" element={<HomeScreenGuide />} />
        <Route path="/join/:code" element={<Join />} />

        {/* Skuzi Creators */}
        <Route path="/creators/join" element={<CreatorJoin />} />
        <Route path="/creator/:token" element={<CreatorHome />} />
        <Route path="/c/:code" element={<CreatorLink />} />
        <Route path="/creators" element={<ProtectedRoute><CreatorsAdmin /></ProtectedRoute>} />
        <Route path="/plans" element={<ProtectedRoute><PlansAdmin /></ProtectedRoute>} />
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

        <Route path="/venue-terms" element={<VenueTerms />} />
        <Route path="/privacy.html" element={null} />
        <Route path="/terms.html" element={null} />

        {/* Public homepage + catch-all */}
        <Route path="/waitlist" element={<Waitlist />} />
        <Route path="/" element={<Landing />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      )}
    </BrowserRouter>
  );
}

// A printed staff sticker scanned while clock-in is switched off (lib/features.ts).
function ClockInOff() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center px-6 text-center">
      <p className="text-5xl" aria-hidden="true">🕒</p>
      <h1 className="mt-4 font-display text-2xl font-bold text-gray-900 dark:text-white">Clock-in isn't switched on yet</h1>
      <p className="mt-2 max-w-sm text-[15px] text-gray-500 dark:text-gray-400">Your orders are on the waiter screen. Ask your manager if you need to sign in.</p>
      <a href="/waiter" className="mt-6 inline-flex h-12 items-center rounded-full bg-action px-6 font-extrabold text-action-ink">Open the waiter screen</a>
    </div>
  );
}
