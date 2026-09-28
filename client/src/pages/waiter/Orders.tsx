import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CheckCircle,
  Clock,
  ChefHat,
  AlertCircle,
  Bell,
  Receipt,
  X,
  BellRing,
  Plus,
  Minus,
  ShoppingBag,
  ChevronRight,
  Trophy,
  Star,
  TrendingUp,
  MapPin,
  LogOut,
} from "lucide-react";
import { useWebSocket } from "../../hooks/useWebSocket";
import { usePushNotifications } from "../../hooks/usePushNotifications";
import { WsEvent } from "@tabpro/shared";
import VenueLogo from "../../components/VenueLogo";
import NotificationBell, {
  NotificationItem,
} from "../../components/NotificationBell";
import { apiFetch } from "../../lib/apiFetch";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrderItemData {
  name: string;
  quantity: number;
  unitPriceRwf: number;
}

interface LiveOrder {
  orderId: string;
  tabId: string;
  tableLabel: string;
  source: "customer" | "staff";
  status: "pending" | "preparing" | "delivered";
  placedAt: string;
  items: OrderItemData[];
  total: number;
}

interface NudgeAlert {
  id: string;
  tableLabel: string;
  tabId: string;
  timestamp: string;
}

interface BillRequest {
  tabId: string;
  tableLabel: string;
  timestamp: string;
}

interface TableOption {
  id: string;
  label: string;
  isActive: boolean;
}

interface MenuItemOption {
  id: string;
  name: string;
  category: string;
  priceRwf: number;
  isAvailable: boolean;
}

interface CartEntry {
  item: MenuItemOption;
  quantity: number;
}

interface PointsHistory {
  id: string;
  points: number;
  reason: string;
  createdAt: string;
}

interface MyPoints {
  name: string;
  totalPoints: number;
  weeklyPoints: number;
  avgRating: number | null;
  ratingCount: number;
  history: PointsHistory[];
}

function formatRwf(amount: number) {
  return `${amount.toLocaleString()} RWF`;
}

function timeAgo(dateStr: string) {
  const diff = Math.max(
    0,
    Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000),
  );
  if (diff < 60) return `${diff}s ago`;
  return `${Math.floor(diff / 60)}m ago`;
}

const STATUS_CONFIG = {
  pending: {
    label: "New",
    color:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    icon: Clock,
  },
  preparing: {
    label: "Preparing",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    icon: ChefHat,
  },
  delivered: {
    label: "Delivered",
    color:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    icon: CheckCircle,
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function WaiterOrders() {
  const [searchParams] = useSearchParams();
  const venueId = searchParams.get("venueId") ?? "";
  // Needed to tag this device's push subscription as belonging to THIS staff
  // member (not the owner). Previously never read from the URL, so every
  // waiter's subscription was saved with staffId=null and the server treated
  // it as an owner subscription — meaning sendPushToStaff() could never find
  // it, and waiters silently never received new-order/nudge pushes at all.
  const staffId =
    searchParams.get("staffId") || localStorage.getItem("tabpro_staff_id") || "";
  const [venueName, setVenueName] = useState("");
  const [venueLogoUrl, setVenueLogoUrl] = useState<string | null>(null);

  const [orders, setOrders] = useState<LiveOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [closingTabId, setClosingTabId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const [nudges, setNudges] = useState<NudgeAlert[]>([]);
  const [billRequests, setBillRequests] = useState<BillRequest[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const pushNotification = (
    kind: NotificationItem["kind"],
    message: string,
  ) => {
    setNotifications((prev) => [
      ...prev,
      {
        id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        kind,
        message,
        timestamp: new Date().toISOString(),
        read: false,
      },
    ]);
  };

  const { isSupported, permission, subscribe } = usePushNotifications();
  const [pushDismissed, setPushDismissed] = useState(false);
  const [pushError, setPushError] = useState(false);
  const showPushBanner =
    isSupported && !pushDismissed && (permission === "default" || pushError);

  // ── PIN lock ──────────────────────────────────────────────────────────────
  const [pinUnlocked, setPinUnlocked] = useState(() => {
    // Stay unlocked for this browser session only
    return sessionStorage.getItem("tabpro_pin_unlocked") === "1";
  });
  const [pinDigits, setPinDigits] = useState(["", "", "", ""]);
  const [pinError, setPinError] = useState("");
  const [pinLoading, setPinLoading] = useState(false);
  const pinRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ── Manual order entry state ──────────────────────────────────────────────
  type ManualStep = "table" | "menu" | "confirm";
  const [manualOpen, setManualOpen] = useState(false);
  const [manualStep, setManualStep] = useState<ManualStep>("table");
  const [tableOptions, setTableOptions] = useState<TableOption[]>([]);
  const [menuOptions, setMenuOptions] = useState<
    Record<string, MenuItemOption[]>
  >({});
  const [selectedTable, setSelectedTable] = useState<TableOption | null>(null);
  const [manualCart, setManualCart] = useState<CartEntry[]>([]);
  const [manualTabId, setManualTabId] = useState<string | null>(null);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState("");
  const [manualSuccess, setManualSuccess] = useState(false);

  // ── Tab bar + points ──────────────────────────────────────────────────────
  type ActiveTab = "orders" | "tables" | "points";
  const [activeTab, setActiveTab] = useState<ActiveTab>("orders");
  const staffToken =
    searchParams.get("token") ||
    localStorage.getItem("tabpro_staff_token") ||
    "";
  const [myPoints, setMyPoints] = useState<MyPoints | null>(null);
  const [pointsLoading, setPointsLoading] = useState(false);
  const [pointsError, setPointsError] = useState("");

  // ── My Tables state ───────────────────────────────────────────────────────
  interface AssignedTable {
    tableId: string;
    label: string;
    isActive: boolean;
  }
  const [myTables, setMyTables] = useState<AssignedTable[]>([]);
  const [tablesLoading, setTablesLoading] = useState(false);

  const handleEnablePush = async () => {
    if (!venueId) return;
    const ok = await subscribe({ venueId, staffId: staffId || undefined, token: staffToken });
    if (ok) {
      setPushDismissed(true);
      setPushError(false);
    } else {
      // Don't silently dismiss on failure — permission may already be
      // "granted" at this point, which would otherwise hide the banner
      // and give no indication anything went wrong.
      setPushError(true);
    }
  };

  // ── Fetch open orders on mount ─────────────────────────────────────────────

  const fetchOrders = useCallback(async () => {
    if (!venueId) return;
    try {
      const res = await apiFetch(`/orders/venue/${venueId}`, {
        headers: { Authorization: `Bearer ${staffToken}` },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      const flat: LiveOrder[] = [];
      for (const tab of data.data) {
        for (const order of tab.orders) {
          if (order.status === "delivered") continue;
          flat.push({
            orderId: order.id,
            tabId: tab.id,
            tableLabel: tab.table.label,
            source: order.source,
            status: order.status,
            placedAt: order.placedAt,
            items: order.items.map((i: any) => ({
              name: i.menuItem.name,
              quantity: i.quantity,
              unitPriceRwf: i.unitPriceRwf,
            })),
            total: order.items.reduce(
              (s: number, i: any) => s + i.unitPriceRwf * i.quantity,
              0,
            ),
          });
        }

        // Restore bill requests for open tabs that are bill_requested
        if (tab.status === "bill_requested") {
          setBillRequests((prev) => {
            const exists = prev.find((b) => b.tabId === tab.id);
            if (exists) return prev;
            return [
              ...prev,
              {
                tabId: tab.id,
                tableLabel: tab.table.label,
                timestamp: new Date().toISOString(),
              },
            ];
          });
        }
      }

      setOrders(flat);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    if (!venueId) return;
    apiFetch(`/venues/public/${venueId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setVenueName(d.data.name);
          setVenueLogoUrl(d.data.logoUrl ?? null);
        }
      })
      .catch(() => {});
  }, [venueId]);

  // ── WebSocket ─────────────────────────────────────────────────────────────

  useWebSocket({
    venueId,
    token: staffToken || undefined,
    enabled: !!venueId,
    onEvent: (event: WsEvent) => {
      if (event.type === "new_order") {
        const p = event.payload as any;
        setOrders((prev) => [
          {
            orderId: p.orderId,
            tabId: p.tabId,
            tableLabel: p.tableLabel,
            source: p.source,
            status: "pending",
            placedAt: p.placedAt,
            items: p.items.map((i: any) => ({
              name: i.name,
              quantity: i.quantity,
              unitPriceRwf: i.unitPriceRwf,
            })),
            total: p.total,
          },
          ...prev,
        ]);
        pushNotification("new_order", `New order from ${p.tableLabel}`);
      }

      if (event.type === "order_status_update") {
        const { orderId, status } = event.payload as {
          orderId: string;
          status: string;
        };
        setOrders((prev) =>
          prev.map((o) =>
            o.orderId === orderId
              ? { ...o, status: status as LiveOrder["status"] }
              : o,
          ),
        );
      }

      if (event.type === "new_nudge") {
        const p = event.payload as any;
        const id = `${p.tabId}-${Date.now()}`;
        setNudges((prev) => [
          ...prev,
          {
            id,
            tableLabel: p.tableLabel,
            tabId: p.tabId,
            timestamp: new Date().toISOString(),
          },
        ]);
        // Auto-dismiss after 30s
        setTimeout(
          () => setNudges((prev) => prev.filter((n) => n.id !== id)),
          30000,
        );
        pushNotification("nudge", `${p.tableLabel} nudged you`);
      }

      if (event.type === "bill_requested") {
        const p = event.payload as any;
        setBillRequests((prev) => {
          const exists = prev.find((b) => b.tabId === p.tabId);
          if (exists) return prev;
          return [
            ...prev,
            {
              tabId: p.tabId,
              tableLabel: p.tableLabel,
              timestamp: new Date().toISOString(),
            },
          ];
        });
        pushNotification("bill_requested", `${p.tableLabel} requested the bill`);
      }

      if (event.type === "customer_away") {
        const p = event.payload as any;
        const id = `away-${p.tabId}-${Date.now()}`;
        setNudges((prev) => [
          ...prev,
          { id, tableLabel: `${p.tableLabel} — customer may have stepped away`, tabId: p.tabId, timestamp: new Date().toISOString() },
        ]);
        // Auto-dismiss after 2 minutes
        setTimeout(
          () => setNudges((prev) => prev.filter((n) => n.id !== id)),
          120_000,
        );
        pushNotification(
          "customer_away",
          `${p.tableLabel} — customer may have stepped away`,
        );
      }

      if (event.type === "tab_closed") {
        const p = event.payload as any;
        setBillRequests((prev) => prev.filter((b) => b.tabId !== p.tabId));
        setOrders((prev) => prev.filter((o) => o.tabId !== p.tabId));
        // Previously this cleared orders with zero visible trace of why —
        // record it in the notification bell's history so the waiter can
        // still see the tab was closed even after it disappears from the list.
        pushNotification(
          "tab_closed",
          `${p.tableLabel ?? "A table"}'s tab was closed`,
        );
      }
    },
  });

  // ── Update order status ────────────────────────────────────────────────────

  const updateStatus = async (
    orderId: string,
    status: "preparing" | "delivered",
  ) => {
    setUpdatingId(orderId);
    try {
      const res = await apiFetch(`/orders/${orderId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${staffToken}`,
        },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  // ── Close tab ─────────────────────────────────────────────────────────────

  const handleCloseTab = async (tabId: string) => {
    setClosingTabId(tabId);
    try {
      const res = await apiFetch(`/tabs/${tabId}/close`, {
        method: "POST",
        headers: { Authorization: `Bearer ${staffToken}` },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      // WebSocket tab_closed event will clean up state
    } catch (err: any) {
      setError(err.message);
    } finally {
      setClosingTabId(null);
    }
  };

  // ── Manual order: open sheet & load tables ────────────────────────────────

  const openManualOrder = async () => {
    setManualOpen(true);
    setManualStep("table");
    setSelectedTable(null);
    setManualCart([]);
    setManualTabId(null);
    setManualError("");
    setManualSuccess(false);
    if (tableOptions.length === 0) {
      try {
        const res = await apiFetch(`/tables/public/${venueId}`);
        const data = await res.json();
        if (data.success)
          setTableOptions(data.data.filter((t: TableOption) => t.isActive));
      } catch {
        /* silent */
      }
    }
  };

  const handleSelectTable = async (table: TableOption) => {
    setSelectedTable(table);
    setManualError("");
    setManualLoading(true);
    try {
      // Load menu if not yet loaded
      if (Object.keys(menuOptions).length === 0) {
        const menuRes = await apiFetch(`/menu/${venueId}`);
        const menuData = await menuRes.json();
        if (menuData.success) {
          const grouped: Record<string, MenuItemOption[]> = {};
          for (const item of menuData.data.items) {
            if (!item.isAvailable) continue;
            if (!grouped[item.category]) grouped[item.category] = [];
            grouped[item.category].push(item);
          }
          setMenuOptions(grouped);
        }
      }
      // Open or get existing tab for this table
      const tabRes = await apiFetch("/tabs/staff-open", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${staffToken}`,
        },
        body: JSON.stringify({ tableId: table.id }),
      });
      const tabData = await tabRes.json();
      if (!tabData.success) throw new Error(tabData.error);
      setManualTabId(tabData.data.tab.id);
      setManualStep("menu");
    } catch (err: any) {
      setManualError(err.message || "Failed to open tab.");
    } finally {
      setManualLoading(false);
    }
  };

  const manualAddItem = (item: MenuItemOption) => {
    setManualCart((prev) => {
      const existing = prev.find((e) => e.item.id === item.id);
      if (existing)
        return prev.map((e) =>
          e.item.id === item.id ? { ...e, quantity: e.quantity + 1 } : e,
        );
      return [...prev, { item, quantity: 1 }];
    });
  };

  const manualRemoveItem = (itemId: string) => {
    setManualCart((prev) => {
      const existing = prev.find((e) => e.item.id === itemId);
      if (!existing) return prev;
      if (existing.quantity === 1)
        return prev.filter((e) => e.item.id !== itemId);
      return prev.map((e) =>
        e.item.id === itemId ? { ...e, quantity: e.quantity - 1 } : e,
      );
    });
  };

  const manualGetQty = (itemId: string) =>
    manualCart.find((e) => e.item.id === itemId)?.quantity ?? 0;

  const manualCartTotal = manualCart.reduce(
    (s, e) => s + e.item.priceRwf * e.quantity,
    0,
  );

  const handlePlaceManualOrder = async () => {
    if (!manualTabId || manualCart.length === 0) return;
    setManualLoading(true);
    setManualError("");
    try {
      const res = await apiFetch("/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tabId: manualTabId,
          source: "staff",
          items: manualCart.map((e) => ({
            menuItemId: e.item.id,
            quantity: e.quantity,
          })),
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setManualSuccess(true);
      setTimeout(() => {
        setManualOpen(false);
        setManualSuccess(false);
        setManualCart([]);
        setManualTabId(null);
        setSelectedTable(null);
        setManualStep("table");
      }, 1800);
    } catch (err: any) {
      setManualError(err.message || "Failed to place order.");
    } finally {
      setManualLoading(false);
    }
  };

  // ── Fetch my points ───────────────────────────────────────────────────────

  const fetchMyPoints = useCallback(async () => {
    if (!staffToken) return;
    setPointsLoading(true);
    setPointsError("");
    try {
      const res = await apiFetch("/staff/me/points", {
        headers: { Authorization: `Bearer ${staffToken}` },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setMyPoints(data.data);
    } catch (err: any) {
      setPointsError(err.message || "Could not load points.");
    } finally {
      setPointsLoading(false);
    }
  }, [staffToken]);

  const fetchMyTables = useCallback(async () => {
    if (!staffToken) return;
    setTablesLoading(true);
    try {
      const res = await apiFetch("/tables/my-tables", {
        headers: { Authorization: `Bearer ${staffToken}` },
      });
      const data = await res.json();
      if (data.success) setMyTables(data.data);
    } catch {
      /* silent */
    } finally {
      setTablesLoading(false);
    }
  }, [staffToken]);

  useEffect(() => {
    if (activeTab === "points") fetchMyPoints();
    if (activeTab === "tables") fetchMyTables();
  }, [activeTab, fetchMyPoints, fetchMyTables]);

  const handlePinInput = (val: string, idx: number) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...pinDigits];
    next[idx] = val;
    setPinDigits(next);
    setPinError("");
    if (val && idx < 3) pinRefs.current[idx + 1]?.focus();
  };

  const handlePinKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (
      e.key === "Backspace" &&
      idx > 0 &&
      !(e.target as HTMLInputElement).value
    ) {
      pinRefs.current[idx - 1]?.focus();
    }
  };

  const handlePinSubmit = async () => {
    const pin = pinDigits.join("");
    if (pin.length < 4) return;
    if (!staffToken) {
      setPinError("No account linked. Use your invite link.");
      return;
    }
    setPinLoading(true);
    setPinError("");
    try {
      const res = await apiFetch("/staff/me/verify-pin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${staffToken}`,
        },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      sessionStorage.setItem("tabpro_pin_unlocked", "1");
      setPinUnlocked(true);
    } catch (err: any) {
      setPinError("Incorrect PIN. Try again.");
      setPinDigits(["", "", "", ""]);
      setTimeout(() => pinRefs.current[0]?.focus(), 50);
    } finally {
      setPinLoading(false);
    }
  };

  // Auto-submit when all 4 digits entered
  useEffect(() => {
    if (pinDigits.join("").length === 4 && !pinUnlocked) handlePinSubmit();
  }, [pinDigits]);

  // ── No venueId ────────────────────────────────────────────────────────────

  if (!venueId) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0D1117] flex items-center justify-center px-4">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            No venue ID provided
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Open this page via the link your owner shared.
          </p>
        </div>
      </div>
    );
  }

  // ── PIN lock screen ────────────────────────────────────────────────────────
  if (staffToken && !pinUnlocked) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0D1117] flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-xs text-center">
          <div className="text-4xl mb-4">🔐</div>
          <h1 className="text-xl font-black text-gray-900 dark:text-white mb-1">
            Enter your PIN
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            Enter your 4-digit PIN to access your orders
          </p>

          <div className="flex gap-3 justify-center my-6">
            {pinDigits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => {
                  pinRefs.current[i] = el;
                }}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                autoFocus={i === 0}
                onChange={(e) => handlePinInput(e.target.value, i)}
                onKeyDown={(e) => handlePinKeyDown(e, i)}
                className={`w-14 h-14 text-center text-2xl font-black rounded-2xl border-2 outline-none transition-all bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                  digit
                    ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20"
                    : "border-gray-200 dark:border-gray-700 focus:border-brand-400"
                }`}
              />
            ))}
          </div>

          {pinError && <p className="text-sm text-red-500 mb-3">{pinError}</p>}

          {pinLoading && (
            <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
          )}
        </div>
      </div>
    );
  }

  const activeOrders = orders.filter((o) => o.status !== "delivered");
  const deliveredOrders = orders.filter((o) => o.status === "delivered");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0D1117] md:ml-60">
      {/* ── Side nav (desktop md+) — mirrors the owner dashboard's sidebar ──── */}
      <aside className="hidden md:flex flex-col fixed top-0 left-0 h-full w-60 bg-white dark:bg-[#161B22] border-r border-gray-200 dark:border-gray-800 z-20">
        <div className="px-5 py-5 flex items-center gap-3 border-b border-gray-100 dark:border-gray-800">
          <VenueLogo logoUrl={venueLogoUrl} venueName={venueName} size={34} />
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight truncate">
              {venueName || "Waiter"}
            </p>
            <p className="text-xs text-gray-400">Live · updates automatically</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {(
            [
              { key: "orders", label: "Orders", icon: Receipt },
              { key: "tables", label: "My Tables", icon: MapPin },
              { key: "points", label: "My Points", icon: Trophy },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                activeTab === key
                  ? "bg-brand-500 text-white"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              <Icon size={17} />
              <span className="flex-1 text-left">{label}</span>
            </button>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={() => {
              localStorage.removeItem("tabpro_staff_session");
              localStorage.removeItem("tabpro_staff_token");
              localStorage.removeItem("tabpro_staff_id");
              localStorage.removeItem("tabpro_staff_venue");
              window.location.href = "/waiter";
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Header — full on mobile (no sidebar); trimmed to just live controls on desktop, since the sidebar already shows venue branding + sign out */}
      <div className="bg-white dark:bg-[#161B22] border-b border-gray-200 dark:border-gray-800 px-4 py-4 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-3 md:hidden">
          <VenueLogo logoUrl={venueLogoUrl} venueName={venueName} size={36} />
          <div>
            <h1 className="font-bold text-gray-900 dark:text-white">
              {venueName || "Orders"}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Live · updates automatically
            </p>
          </div>
        </div>
        <h2 className="hidden md:block font-bold text-gray-900 dark:text-white capitalize">
          {activeTab === "orders"
            ? "Orders"
            : activeTab === "tables"
              ? "My Tables"
              : "My Points"}
        </h2>
        <div className="flex items-center gap-2">
          {activeOrders.length > 0 && (
            <span className="bg-brand-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
              {activeOrders.length}
            </span>
          )}
          <NotificationBell
            notifications={notifications}
            onMarkAllRead={() =>
              setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
            }
          />
          <button
            onClick={() => {
              localStorage.removeItem("tabpro_staff_session");
              localStorage.removeItem("tabpro_staff_token");
              localStorage.removeItem("tabpro_staff_id");
              localStorage.removeItem("tabpro_staff_venue");
              window.location.href = "/waiter";
            }}
            className="md:hidden text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 font-medium px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Sign out"
          >
            Sign out
          </button>
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        </div>
      </div>
      {/* Push notification banner */}
      {showPushBanner && (
        <div
          className={`mx-4 mt-3 border rounded-xl px-4 py-3 flex items-center justify-between ${
            pushError
              ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
              : "bg-brand-50 dark:bg-brand-900/20 border-brand-200 dark:border-brand-800"
          }`}
        >
          <div className="flex items-center gap-2">
            <BellRing
              size={16}
              className={pushError ? "text-red-500" : "text-brand-500"}
            />
            <p
              className={`text-xs font-medium ${
                pushError
                  ? "text-red-700 dark:text-red-300"
                  : "text-brand-700 dark:text-brand-300"
              }`}
            >
              {pushError
                ? "Couldn't enable notifications — check your connection and try again"
                : "Enable notifications to get alerts when screen is off"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleEnablePush}
              className={`text-xs px-3 py-1.5 text-white rounded-lg font-medium transition-colors ${
                pushError
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-brand-500 hover:bg-brand-600"
              }`}
            >
              {pushError ? "Retry" : "Enable"}
            </button>
            <button
              onClick={() => setPushDismissed(true)}
              className={
                pushError
                  ? "text-red-400 hover:text-red-600"
                  : "text-brand-400 hover:text-brand-600"
              }
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
      {activeTab === "orders" && (
        <div className="px-4 pt-4 max-w-lg mx-auto space-y-3 pb-28 md:pb-6">
          {/* Nudge alerts */}
          {nudges.map((nudge) => (
            <div
              key={nudge.id}
              className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-2xl px-4 py-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                  <Bell
                    size={16}
                    className="text-amber-600 dark:text-amber-400"
                  />
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                    {nudge.tableLabel} needs you
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-500">
                    {timeAgo(nudge.timestamp)}
                  </p>
                </div>
              </div>
              <button
                onClick={() =>
                  setNudges((prev) => prev.filter((n) => n.id !== nudge.id))
                }
                className="text-amber-500 hover:text-amber-700"
              >
                <X size={16} />
              </button>
            </div>
          ))}

          {/* Bill requests */}
          {billRequests.map((bill) => (
            <div
              key={bill.tabId}
              className="bg-white dark:bg-[#161B22] border-2 border-brand-500 rounded-2xl px-4 py-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand-500/10 flex items-center justify-center">
                    <Receipt size={16} className="text-brand-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {bill.tableLabel} wants to pay
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {timeAgo(bill.timestamp)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleCloseTab(bill.tabId)}
                  disabled={closingTabId === bill.tabId}
                  className="text-xs px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium disabled:opacity-50 transition-colors"
                >
                  {closingTabId === bill.tabId ? "..." : "Close tab"}
                </button>
              </div>
            </div>
          ))}

          {/* Empty state */}
          {!loading &&
            activeOrders.length === 0 &&
            nudges.length === 0 &&
            billRequests.length === 0 && (
              <div className="text-center py-16">
                <CheckCircle className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  All clear — no active orders
                </p>
              </div>
            )}

          {/* Active orders */}
          {activeOrders.map((order) => {
            const cfg = STATUS_CONFIG[order.status];
            const Icon = cfg.icon;
            const isUpdating = updatingId === order.orderId;

            return (
              <div
                key={order.orderId}
                className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-gray-800 rounded-2xl p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900 dark:text-white">
                      {order.tableLabel}
                    </span>
                    {order.source === "staff" && (
                      <span className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 px-2 py-0.5 rounded-full">
                        Staff-entered
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${cfg.color}`}
                  >
                    <Icon size={11} />
                    {cfg.label}
                  </span>
                </div>

                <div className="space-y-1 mb-3">
                  {order.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-300">
                        {item.name}{" "}
                        <span className="text-gray-400">×{item.quantity}</span>
                      </span>
                      <span className="text-gray-500 dark:text-gray-400 text-xs">
                        {formatRwf(item.unitPriceRwf * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    {timeAgo(order.placedAt)}
                  </span>
                  <div className="flex gap-2">
                    {order.status === "pending" && (
                      <button
                        onClick={() => updateStatus(order.orderId, "preparing")}
                        disabled={isUpdating}
                        className="text-xs px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium disabled:opacity-50 transition-colors"
                      >
                        {isUpdating ? "..." : "Start preparing"}
                      </button>
                    )}
                    {order.status === "preparing" && (
                      <button
                        onClick={() => updateStatus(order.orderId, "delivered")}
                        disabled={isUpdating}
                        className="text-xs px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium disabled:opacity-50 transition-colors"
                      >
                        {isUpdating ? "..." : "Mark delivered ✓"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Delivered orders */}
          {deliveredOrders.length > 0 && (
            <div className="pt-2 pb-24 md:pb-6">
              <p className="text-xs text-gray-400 dark:text-gray-600 text-center mb-3">
                {deliveredOrders.length} delivered this session
              </p>
              <div className="space-y-2 opacity-50">
                {deliveredOrders.map((order) => (
                  <div
                    key={order.orderId}
                    className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-2.5 flex items-center justify-between"
                  >
                    <span className="text-xs text-gray-500">
                      {order.tableLabel} —{" "}
                      {order.items
                        .map((i) => `${i.name} ×${i.quantity}`)
                        .join(", ")}
                    </span>
                    <CheckCircle
                      size={14}
                      className="text-green-500 flex-shrink-0"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}{" "}
      {/* end activeTab === 'orders' */}
      {/* ── FAB: Add manual order (orders tab only) ───────────────────────── */}
      {activeTab === "orders" && (
        <button
          onClick={openManualOrder}
          className="fixed bottom-20 right-4 flex items-center gap-2 px-4 py-3 rounded-2xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm shadow-xl shadow-brand-500/40 active:scale-95 transition-all z-30"
        >
          <Plus size={18} strokeWidth={3} />
          Add order
        </button>
      )}
      {/* ── My Tables tab ─────────────────────────────────────────────────── */}
      {activeTab === "tables" && (
        <div className="px-4 pt-4 pb-28 md:pb-6 min-h-screen">
          {!staffToken ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <MapPin
                size={40}
                className="text-gray-300 dark:text-gray-700 mb-4"
              />
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                No account linked
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
                Ask your owner to send you an invite link to see your table
                assignments.
              </p>
            </div>
          ) : tablesLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : myTables.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <MapPin
                size={40}
                className="text-gray-300 dark:text-gray-700 mb-4"
              />
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                No tables assigned today
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
                Your owner hasn't assigned tables to you for today's shift yet.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <h2 className="text-lg font-black text-gray-900 dark:text-white">
                  My Tables
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date().toLocaleDateString("en-GB", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {myTables.map((table) => (
                  <div
                    key={table.tableId}
                    className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-gray-800 rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-2"
                  >
                    <div className="w-10 h-10 rounded-2xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center">
                      <MapPin size={18} className="text-brand-500" />
                    </div>
                    <p className="text-sm font-black text-gray-900 dark:text-white">
                      {table.label}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      {/* ── My Points tab ─────────────────────────────────────────────────── */}
      {activeTab === "points" && (
        <div className="px-4 pt-4 pb-28 md:pb-6 min-h-screen">
          {!staffToken ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <Trophy
                size={40}
                className="text-gray-300 dark:text-gray-700 mb-4"
              />
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                No account linked
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
                Ask your owner to send you an invite link to track your points.
              </p>
            </div>
          ) : pointsLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : pointsError ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <p className="text-sm text-red-500 mb-3">{pointsError}</p>
              <button
                onClick={fetchMyPoints}
                className="text-xs text-brand-500 font-semibold"
              >
                Try again
              </button>
            </div>
          ) : myPoints ? (
            <>
              {/* Header card */}
              <div className="bg-gradient-to-br from-brand-500 to-brand-600 rounded-3xl p-5 mb-5 text-white">
                <p className="text-xs font-bold opacity-70 uppercase tracking-widest mb-1">
                  Welcome back
                </p>
                <h2 className="text-lg font-black mb-4">{myPoints.name}</h2>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-5xl font-black leading-none">
                    {myPoints.totalPoints}
                  </span>
                  <span className="text-sm font-bold opacity-70 mb-1">
                    pts total
                  </span>
                </div>
                <p className="text-xs opacity-70">
                  +{myPoints.weeklyPoints} pts this week
                </p>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="bg-white dark:bg-[#161B22] border border-gray-100 dark:border-gray-800 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Star size={14} className="text-amber-400 fill-amber-400" />
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                      Avg rating
                    </span>
                  </div>
                  <p className="text-2xl font-black text-gray-900 dark:text-white">
                    {myPoints.avgRating !== null
                      ? myPoints.avgRating.toFixed(1)
                      : "—"}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {myPoints.ratingCount} reviews
                  </p>
                </div>
                <div className="bg-white dark:bg-[#161B22] border border-gray-100 dark:border-gray-800 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp size={14} className="text-green-500" />
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                      This week
                    </span>
                  </div>
                  <p className="text-2xl font-black text-gray-900 dark:text-white">
                    +{myPoints.weeklyPoints}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">points earned</p>
                </div>
              </div>

              {/* Points history */}
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">
                History
              </p>
              {myPoints.history.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-sm text-gray-400">
                    No points yet — start taking orders!
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {myPoints.history.map((entry) => (
                    <div
                      key={entry.id}
                      className="bg-white dark:bg-[#161B22] border border-gray-100 dark:border-gray-800 rounded-2xl px-4 py-3 flex items-center justify-between"
                    >
                      <div className="flex-1 min-w-0 mr-3">
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
                          {entry.reason}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(entry.createdAt).toLocaleDateString(
                            "en-GB",
                            { day: "numeric", month: "short", year: "numeric" },
                          )}
                        </p>
                      </div>
                      <span
                        className={`text-sm font-black flex-shrink-0 ${entry.points >= 0 ? "text-green-500" : "text-red-500"}`}
                      >
                        {entry.points >= 0 ? "+" : ""}
                        {entry.points} pts
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </div>
      )}
      {/* ── Bottom tab bar (mobile only — desktop uses the sidebar) ────────── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-[#161B22] border-t border-gray-200 dark:border-gray-800 flex">
        <button
          onClick={() => setActiveTab("orders")}
          className={`flex-1 flex flex-col items-center justify-center py-3 gap-0.5 transition-colors ${activeTab === "orders" ? "text-brand-500" : "text-gray-400 dark:text-gray-600"}`}
        >
          <Receipt size={20} />
          <span className="text-[10px] font-bold">Orders</span>
        </button>
        <button
          onClick={() => setActiveTab("tables")}
          className={`flex-1 flex flex-col items-center justify-center py-3 gap-0.5 transition-colors ${activeTab === "tables" ? "text-brand-500" : "text-gray-400 dark:text-gray-600"}`}
        >
          <MapPin size={20} />
          <span className="text-[10px] font-bold">My Tables</span>
        </button>
        <button
          onClick={() => setActiveTab("points")}
          className={`flex-1 flex flex-col items-center justify-center py-3 gap-0.5 transition-colors ${activeTab === "points" ? "text-brand-500" : "text-gray-400 dark:text-gray-600"}`}
        >
          <Trophy size={20} />
          <span className="text-[10px] font-bold">My Points</span>
        </button>
      </div>
      {/* ── Manual order bottom sheet ─────────────────────────────────────── */}
      {manualOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setManualOpen(false)}
          />
          <div className="relative bg-white dark:bg-[#161B22] rounded-t-3xl flex flex-col max-h-[90vh]">
            {/* Sheet header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
              <div>
                <h2 className="text-base font-black text-gray-900 dark:text-white">
                  {manualStep === "table" && "Select table"}
                  {manualStep === "menu" && `Order for ${selectedTable?.label}`}
                  {manualStep === "confirm" && "Review order"}
                </h2>
                {manualStep === "menu" && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {manualCart.reduce((s, e) => s + e.quantity, 0)} items ·{" "}
                    {manualCart
                      .reduce((s, e) => s + e.item.priceRwf * e.quantity, 0)
                      .toLocaleString()}{" "}
                    RWF
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {manualStep === "menu" && manualCart.length > 0 && (
                  <button
                    onClick={() => setManualStep("confirm")}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-xl bg-brand-500 text-white font-bold"
                  >
                    Review <ChevronRight size={13} />
                  </button>
                )}
                <button
                  onClick={() => setManualOpen(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Step: table selection */}
            {manualStep === "table" && (
              <div className="overflow-y-auto px-5 py-4">
                {manualError && (
                  <p className="text-sm text-red-500 mb-3">{manualError}</p>
                )}
                {tableOptions.length === 0 ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-2 pb-6">
                    {tableOptions.map((table) => (
                      <button
                        key={table.id}
                        onClick={() => handleSelectTable(table)}
                        disabled={manualLoading}
                        className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800 hover:bg-brand-50 dark:hover:bg-brand-900/20 border border-gray-200 dark:border-gray-700 hover:border-brand-300 dark:hover:border-brand-700 transition-all disabled:opacity-50"
                      >
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          {table.label}
                        </span>
                        {manualLoading && selectedTable?.id === table.id ? (
                          <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <ChevronRight size={16} className="text-gray-400" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step: menu browsing */}
            {manualStep === "menu" && (
              <div className="overflow-y-auto flex-1 px-5 py-4">
                {Object.keys(menuOptions).length === 0 ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-6 pb-6">
                    {Object.entries(menuOptions).map(([category, items]) => (
                      <div key={category}>
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">
                          {category}
                        </p>
                        <div className="space-y-2">
                          {items.map((item) => {
                            const qty = manualGetQty(item.id);
                            return (
                              <div
                                key={item.id}
                                className={`flex items-center justify-between px-4 py-3 rounded-2xl border transition-all ${qty > 0 ? "bg-brand-50 dark:bg-brand-900/20 border-brand-300 dark:border-brand-700" : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"}`}
                              >
                                <div className="flex-1 min-w-0 mr-3">
                                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                    {item.name}
                                  </p>
                                  <p className="text-xs text-brand-500 font-bold mt-0.5">
                                    {item.priceRwf.toLocaleString()} RWF
                                  </p>
                                </div>
                                {qty === 0 ? (
                                  <button
                                    onClick={() => manualAddItem(item)}
                                    className="w-8 h-8 rounded-xl bg-brand-500 text-white flex items-center justify-center active:scale-90 transition-all flex-shrink-0"
                                  >
                                    <Plus size={15} strokeWidth={3} />
                                  </button>
                                ) : (
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <button
                                      onClick={() => manualRemoveItem(item.id)}
                                      className="w-7 h-7 rounded-xl bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center active:scale-90"
                                    >
                                      <Minus
                                        size={12}
                                        strokeWidth={3}
                                        className="text-gray-600 dark:text-gray-300"
                                      />
                                    </button>
                                    <span className="text-sm font-black text-gray-900 dark:text-white w-5 text-center">
                                      {qty}
                                    </span>
                                    <button
                                      onClick={() => manualAddItem(item)}
                                      className="w-7 h-7 rounded-xl bg-brand-500 flex items-center justify-center text-white active:scale-90"
                                    >
                                      <Plus size={12} strokeWidth={3} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step: confirm */}
            {manualStep === "confirm" && (
              <div className="overflow-y-auto px-5 py-4 flex-1">
                <div className="space-y-2 mb-5">
                  {manualCart.map((entry) => (
                    <div
                      key={entry.item.id}
                      className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0"
                    >
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          {entry.item.name}
                        </p>
                        <p className="text-xs text-gray-400">
                          ×{entry.quantity} ·{" "}
                          {entry.item.priceRwf.toLocaleString()} RWF each
                        </p>
                      </div>
                      <p className="text-sm font-black text-gray-900 dark:text-white">
                        {(
                          entry.item.priceRwf * entry.quantity
                        ).toLocaleString()}{" "}
                        RWF
                      </p>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center py-3 border-t-2 border-gray-200 dark:border-gray-700 mb-5">
                  <span className="text-sm font-bold text-gray-500">Total</span>
                  <span className="text-xl font-black text-brand-500">
                    {manualCartTotal.toLocaleString()} RWF
                  </span>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-3 mb-5">
                  <p className="text-xs text-amber-800 dark:text-amber-300 font-medium">
                    This order will be logged as <strong>staff-entered</strong>{" "}
                    for {selectedTable?.label}.
                  </p>
                </div>
                {manualError && (
                  <p className="text-sm text-red-500 mb-3">{manualError}</p>
                )}
              </div>
            )}

            {/* Sheet footer actions */}
            <div className="px-5 pb-8 pt-3 border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
              {manualSuccess ? (
                <div className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-green-500 text-white font-bold text-sm">
                  <CheckCircle size={18} /> Order placed!
                </div>
              ) : manualStep === "menu" ? (
                <button
                  onClick={() => setManualStep("confirm")}
                  disabled={manualCart.length === 0}
                  className="w-full py-3.5 rounded-2xl bg-brand-500 text-white font-black text-sm disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  <ShoppingBag size={16} />
                  Review order ({manualCart.reduce(
                    (s, e) => s + e.quantity,
                    0,
                  )}{" "}
                  items)
                </button>
              ) : manualStep === "confirm" ? (
                <div className="flex gap-3">
                  <button
                    onClick={() => setManualStep("menu")}
                    className="flex-1 py-3.5 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold text-sm"
                  >
                    ← Edit
                  </button>
                  <button
                    onClick={handlePlaceManualOrder}
                    disabled={manualLoading}
                    className="flex-2 flex-1 py-3.5 rounded-2xl bg-brand-500 text-white font-black text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {manualLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      "Place order"
                    )}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
