import { StockPanel } from "../owner/Stock";
import { ThemeCycleButton } from "../../components/ThemeSwitch";
import { useState, useEffect, useCallback, useRef } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import {
  CheckCircle,
  Clock,
  ChefHat,
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
  Package,
} from "lucide-react";
import { useWebSocket } from "../../hooks/useWebSocket";
import { usePushNotifications, useKeepPushSubscribed } from "../../hooks/usePushNotifications";
import NotificationNotice from "../../components/NotificationNotice";
import { WsEvent } from "@tabpro/shared";
import VenueLogo from "../../components/VenueLogo";
import { WavingHand } from "../../components/Logo";
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
  // The guest came with a campaign offer, e.g. "Free shot when you pay with Skuzi".
  offer?: string | null;
  // Bar+ kitchen screen: where the food in this order is.
  kitchen?: "new" | "preparing" | "ready" | null;
}

interface FoodReady {
  orderId: string;
  tabId: string;
  tableLabel: string;
  food: string;
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
  // The guest says they paid the venue's MoMo Pay code: check MoMo, tap Paid.
  paidMomo?: boolean;
  total?: number;
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
  weekRank: number | null;
  tipsWeekRwf: number;
  avgRating: number | null;
  ratingCount: number;
  history: PointsHistory[];
}

// Tips go from the guest's MoMo straight to this number. Off until the waiter
// turns them on, so their number is only ever shown by their choice.
function TipsSetup({ token, phone, current, onSaved, onDismiss }: {
  token: string;
  phone: string;
  current: string | null;
  onSaved: (tipMomo: string | null) => void;
  onDismiss?: () => void;
}) {
  const [number, setNumber] = useState(current ?? phone);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const save = async (value: string | null) => {
    setSaving(true);
    setError("");
    try {
      const r = await apiFetch("/staff/me/tips", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tipMomo: value }),
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      onSaved(d.data.tipMomo);
    } catch (e: any) {
      setError(e?.message || "Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="rounded-[22px] bg-white dark:bg-gray-800 p-4 ring-1 ring-green-500/30">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[17px] font-bold text-gray-900 dark:text-white">💸 Get tips on your MoMo</p>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Guests see a <b>Tip</b> button with your name on their bill. The money goes straight to you.
          </p>
        </div>
        {onDismiss && (
          <button onClick={onDismiss} aria-label="Not now" className="text-gray-400 text-sm font-bold">✕</button>
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          inputMode="tel"
          aria-label="MoMo number for tips"
          className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-base font-semibold text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        />
        <button
          onClick={() => save(number)}
          disabled={saving}
          className="rounded-xl bg-green-600 px-4 text-sm font-extrabold text-white disabled:opacity-60"
        >
          {saving ? "…" : current ? "Save" : "Turn on"}
        </button>
      </div>
      {current && (
        <button onClick={() => save(null)} disabled={saving} className="mt-2 text-xs font-semibold text-gray-500 underline">
          Turn tips off
        </button>
      )}
      {error && <p role="alert" className="mt-2 text-sm font-semibold text-red-600">{error}</p>}
    </div>
  );
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
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const STATUS_CONFIG = {
  pending: {
    label: "New",
    color: "bg-[#F2B33A] text-[#231A2C]",
    icon: Clock,
  },
  preparing: {
    label: "Preparing",
    color: "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900",
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
  const navigate = useNavigate();
  // Opening a notification lands on /waiter/orders with no ?venueId, so fall
  // back to the venue saved at sign-in on this device.
  const venueId = searchParams.get("venueId") || localStorage.getItem("tabpro_staff_venue") || "";
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
  // The kitchen tapped Ready: pick the food up.
  const [foodReady, setFoodReady] = useState<FoodReady[]>([]);
  // The kitchen took an item off: a short note for the waiter.
  const [kitchenNote, setKitchenNote] = useState("");
  // Tips: the waiter's MoMo for tips (null = off), and tips that just came in.
  const [tipMomo, setTipMomo] = useState<string | null>(null);
  const [myPhone, setMyPhone] = useState("");
  const [tipsLoaded, setTipsLoaded] = useState(false);
  const [tipsDismissed, setTipsDismissed] = useState(() => sessionStorage.getItem("skuzi_tips_later") === "1");
  const [tipCards, setTipCards] = useState<{ id: string; tableLabel: string; amountRwf: number }[]>([]);
  // The owner hasn't paid the Skuzi package: waiters hear it from guests first.
  const [planNotice, setPlanNotice] = useState<{ orderingPaused: boolean; pausesAt: string } | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  // Tabs whose guest closed Skuzi on their phone (cleared when they come back).
  const [phoneClosed, setPhoneClosed] = useState<Set<string>>(new Set());

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
  type ActiveTab = "orders" | "tables" | "points" | "stock";
  const [activeTab, setActiveTab] = useState<ActiveTab>("orders");
  const staffToken =
    searchParams.get("token") ||
    localStorage.getItem("tabpro_staff_token") ||
    "";
  const [myPoints, setMyPoints] = useState<MyPoints | null>(null);
  const firstName = (() => {
    try {
      return (JSON.parse(localStorage.getItem("tabpro_staff_session") || "{}").name || "").split(" ")[0];
    } catch {
      return "";
    }
  })();
  const [pointsLoading, setPointsLoading] = useState(false);
  const [pointsError, setPointsError] = useState("");

  // ── My Tables state ───────────────────────────────────────────────────────
  interface AssignedTable {
    tableId: string;
    label: string;
    isActive: boolean;
    // Managers only: who serves the table
    waiterName?: string | null;
    waiterHasSmartphone?: boolean;
    mine?: boolean;
  }
  const [myTables, setMyTables] = useState<AssignedTable[]>([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [isManager, setIsManager] = useState(false);
  // Managers: tables whose waiter has no smartphone, by label → waiter name
  const coveredTables = new Map(
    myTables.filter((t) => t.waiterHasSmartphone === false && t.waiterName).map((t) => [t.label, t.waiterName as string]),
  );

  useKeepPushSubscribed(venueId && staffToken ? { venueId, staffId: staffId || undefined, token: staffToken } : null);

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
            offer: tab.offer ?? null,
            kitchen: order.kitchenStatus ?? null,
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
            offer: p.offer ?? null,
            kitchen: p.kitchen ?? null,
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

      if (event.type === "kitchen_update") {
        const p = event.payload as { orderId?: string; status?: "preparing" | "ready" };
        if (p.orderId) setOrders((prev) => prev.map((o) => (o.orderId === p.orderId ? { ...o, kitchen: p.status } : o)));
      }

      if (event.type === "food_ready") {
        const p = event.payload as FoodReady;
        // Waiters see their own tables' food; managers see it all.
        if (isManager || orders.some((o) => o.tabId === p.tabId)) {
          setFoodReady((prev) => [...prev.filter((f) => f.orderId !== p.orderId), p]);
          pushNotification("food_ready", `${p.tableLabel}: food is ready`);
        }
      }

      if (event.type === "item_unavailable") {
        const p = event.payload as { tabId: string; orderId: string; name: string; quantity: number };
        const mine = isManager || orders.some((o) => o.tabId === p.tabId);
        setOrders((prev) =>
          prev
            .map((o) => {
              if (o.orderId !== p.orderId) return o;
              const i = o.items.findIndex((it) => it.name === p.name && it.quantity === p.quantity);
              if (i < 0) return o;
              const items = o.items.filter((_, j) => j !== i);
              return { ...o, items, total: items.reduce((s, it) => s + it.unitPriceRwf * it.quantity, 0) };
            })
            .filter((o) => o.items.length > 0),
        );
        if (mine) {
          const label = orders.find((o) => o.tabId === p.tabId)?.tableLabel ?? "A table";
          setKitchenNote(`${label}: ${p.name} isn't available. The kitchen took it off the bill and told the guest.`);
          pushNotification("item_unavailable", `${label}: ${p.name} not available`);
        }
      }

      if (event.type === "tip_sent") {
        const p = event.payload as { staffId: string; tableLabel: string; amountRwf: number };
        if (p.staffId === staffId) {
          const id = `${Date.now()}`;
          setTipCards((prev) => [...prev, { id, tableLabel: p.tableLabel, amountRwf: p.amountRwf }]);
          pushNotification("tip", `${p.tableLabel} sent you a ${p.amountRwf.toLocaleString()} RWF tip`);
          if (activeTab === "points") fetchMyPoints();
        }
      }

      if (event.type === "payment_claimed") {
        const p = event.payload as any;
        setBillRequests((prev) => [
          { tabId: p.tabId, tableLabel: p.tableLabel, timestamp: new Date().toISOString(), paidMomo: true, total: p.total },
          ...prev.filter((b) => b.tabId !== p.tabId),
        ]);
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

      // A closed page isn't a guest who left: a quiet sign, never an alarm.
      if (event.type === "customer_away") {
        const p = event.payload as any;
        setPhoneClosed((prev) => new Set(prev).add(p.tabId));
        pushNotification("customer_away", `${p.tableLabel}: guest's phone closed · bill still open`);
      }
      if (event.type === "customer_back") {
        const p = event.payload as any;
        setPhoneClosed((prev) => { const next = new Set(prev); next.delete(p.tabId); return next; });
      }

      if (event.type === "tab_closed") {
        const p = event.payload as any;
        setPhoneClosed((prev) => { const next = new Set(prev); next.delete(p.tabId); return next; });
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

  const handleCloseTab = async (tabId: string, paidWith?: "cash" | "momo") => {
    setClosingTabId(tabId);
    try {
      const res = await apiFetch(`/tabs/${tabId}/close`, {
        method: "POST",
        headers: { Authorization: `Bearer ${staffToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ paidWith }),
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${staffToken}` },
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

  // Points show in the header on every tab.
  useEffect(() => {
    fetchMyPoints();
  }, [fetchMyPoints]);

  useEffect(() => {
    if (activeTab === "points") fetchMyPoints();
    if (activeTab === "tables") fetchMyTables();
  }, [activeTab, fetchMyPoints, fetchMyTables]);

  // Managers see the whole floor and cover waiters without a smartphone.
  useEffect(() => {
    if (!staffToken) return;
    apiFetch("/staff/me", { headers: { Authorization: `Bearer ${staffToken}` } })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setPlanNotice(d.data.planNotice ?? null);
          setTipMomo(d.data.tipMomo ?? null);
          setMyPhone(d.data.phone ?? "");
          setTipsLoaded(true);
        }
        // The chef uses the kitchen screen, not the waiter screen.
        if (d.success && d.data.role === "kitchen") {
          navigate(`/kitchen?venueId=${venueId}&token=${staffToken}`, { replace: true });
          return;
        }
        if (d.success && d.data.role === "manager") {
          setIsManager(true);
          fetchMyTables();
        }
      })
      .catch(() => {});
  }, [staffToken, fetchMyTables]);

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

  // Not signed in on this device: send the waiter to sign in instead of an error.
  if (!venueId) {
    return <Navigate to="/waiter" replace />;
  }

  // ── PIN lock screen ────────────────────────────────────────────────────────
  if (staffToken && !pinUnlocked) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#2B1838] flex flex-col items-center justify-center px-4">
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
    <div className="min-h-screen bg-gray-50 dark:bg-[#2B1838] md:ml-60">
      {/* ── Side nav (desktop md+) — mirrors the owner dashboard's sidebar ──── */}
      <aside className="hidden md:flex flex-col fixed top-0 left-0 h-full w-60 bg-white dark:bg-[#3B2149] border-r border-gray-200 dark:border-gray-800 z-20">
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
              { key: "tables", label: isManager ? "Floor" : "My Tables", icon: MapPin },
              { key: "points", label: "My Points", icon: Trophy },
              ...(isManager ? [{ key: "stock", label: "Stock", icon: Package }] : []),
            ] as { key: ActiveTab; label: string; icon: typeof Receipt }[]
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
      <div className="bg-gray-50/95 dark:bg-gray-950/95 backdrop-blur px-4 pt-5 pb-3 sticky top-0 z-10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 md:hidden min-w-0">
          <div className="min-w-0">
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{venueName || "Skuzi"} · on shift</p>
            <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2 leading-tight">
              {firstName ? `Hi ${firstName}` : "Orders"}
              {isManager && (
                <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                  Manager
                </span>
              )}
            </h1>
          </div>
        </div>
        <h2 className="hidden md:block font-bold text-gray-900 dark:text-white capitalize">
          {activeTab === "orders"
            ? "Orders"
            : activeTab === "tables"
              ? isManager ? "Floor" : "My Tables"
              : "My Points"}
        </h2>
        <div className="flex items-center gap-2">
          {myPoints && (
            <span className="bg-[#F2B33A] text-[#231A2C] text-xs font-extrabold px-3 py-1.5 rounded-full whitespace-nowrap">
              {myPoints.totalPoints} pts
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
            className="md:hidden whitespace-nowrap text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 font-medium px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Sign out"
          >
            Sign out
          </button>
          <ThemeCycleButton />
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        </div>
      </div>
      {/* Push notification banner */}
      <NotificationNotice className="px-4 pt-3" />

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
                : "Turn on notifications to hear about your tables, even when your screen is off"}
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
          {/* A guest is calling: the big rust card */}
          {nudges.map((nudge) => (
            <div key={nudge.id} className="bg-brand-500 text-white rounded-[26px] p-5 flex flex-col gap-3 shadow-lg shadow-brand-500/20">
              <div className="flex items-center gap-3">
                <svg width="40" height="40" viewBox="8 4 90 92" aria-hidden="true">
                  <WavingHand color="currentColor" strokeWidth={8} />
                </svg>
                <div>
                  <p className="font-display text-[26px] font-bold leading-none">Skuzi! {nudge.tableLabel}</p>
                  <p className="text-sm font-semibold mt-1 text-white/85">would love a hand · {timeAgo(nudge.timestamp)}</p>
                </div>
              </div>
              <button
                onClick={() => setNudges((prev) => prev.filter((n) => n.id !== nudge.id))}
                className="h-12 rounded-2xl bg-gray-900 text-white text-base font-extrabold active:scale-[0.98] transition-all"
              >
                On my way
              </button>
            </div>
          ))}

          {tipCards.map((t) => (
            <div key={t.id} className="bg-green-600 text-white rounded-[26px] p-5 flex flex-col gap-3 shadow-lg shadow-green-600/20">
              <div>
                <p className="font-display text-[24px] font-bold leading-tight">🎉 {t.tableLabel} sent you a {t.amountRwf.toLocaleString()} RWF tip</p>
                <p className="text-sm font-semibold mt-1.5 text-white/90">Straight to your MoMo. Check it, and thank them!</p>
              </div>
              <button
                onClick={() => setTipCards((prev) => prev.filter((x) => x.id !== t.id))}
                className="h-12 rounded-2xl bg-gray-900 text-white text-base font-extrabold active:scale-[0.98] transition-all"
              >
                Thanks!
              </button>
            </div>
          ))}

          {tipsLoaded && !tipMomo && !tipsDismissed && staffToken && (
            <TipsSetup
              token={staffToken}
              phone={myPhone}
              current={null}
              onSaved={setTipMomo}
              onDismiss={() => {
                sessionStorage.setItem("skuzi_tips_later", "1");
                setTipsDismissed(true);
              }}
            />
          )}

          {planNotice && (
            <div role="status" className="rounded-[22px] bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30">
              {planNotice.orderingPaused
                ? "🚫 Guests can't order from their phones: this venue's Skuzi package is unpaid. Take their orders with + Add order, and let your manager know."
                : `⚠️ This venue's Skuzi package is unpaid. From ${new Date(planNotice.pausesAt).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Kigali" })}, guests can't order from their phones. Let your manager know.`}
            </div>
          )}

          {kitchenNote && (
            <div role="status" className="rounded-[22px] bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-200 dark:bg-red-900/20 dark:text-red-300 dark:ring-red-900/40 flex items-start justify-between gap-3">
              <span>⚠️ {kitchenNote}</span>
              <button onClick={() => setKitchenNote("")} className="text-xs font-extrabold underline flex-none">OK</button>
            </div>
          )}

          {/* The kitchen tapped Ready */}
          {foodReady.map((f) => (
            <div key={f.orderId} className="bg-green-600 text-white rounded-[26px] p-5 flex flex-col gap-3 shadow-lg shadow-green-600/20">
              <div>
                <p className="font-display text-[24px] font-bold leading-none">🍽️ {f.tableLabel}: food is ready</p>
                <p className="text-sm font-semibold mt-1.5 text-white/90">{f.food}. Pick it up at the kitchen.</p>
              </div>
              <button
                onClick={() => setFoodReady((prev) => prev.filter((x) => x.orderId !== f.orderId))}
                className="h-12 rounded-2xl bg-gray-900 text-white text-base font-extrabold active:scale-[0.98] transition-all"
              >
                Got it
              </button>
            </div>
          ))}

          {/* Bill requests */}
          {billRequests.map((bill) => (
            <div
              key={bill.tabId}
              className="bg-white dark:bg-gray-800 rounded-[22px] px-4 py-4 ring-1 ring-green-500/30"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand-500/10 flex items-center justify-center">
                    <Receipt size={16} className="text-brand-500" />
                  </div>
                  <div>
                    <p className="text-[17px] font-bold text-gray-900 dark:text-white">
                      {bill.tableLabel}{" "}
                      <span className="ml-1 align-middle text-[11px] font-extrabold bg-green-500 text-white px-2 py-0.5 rounded-full">
                        {bill.paidMomo ? "Paid by MoMo?" : "Wants to pay"}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {bill.paidMomo
                        ? `${(bill.total ?? 0).toLocaleString("en-US")} RWF to your MoMo Pay · check MoMo, then tap Paid`
                        : timeAgo(bill.timestamp)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleCloseTab(bill.tabId, "momo")}
                  disabled={closingTabId === bill.tabId}
                  className="text-sm px-4 py-3 rounded-xl bg-green-600 text-white font-extrabold disabled:opacity-50 transition-colors"
                >
                  {closingTabId === bill.tabId ? "..." : "Paid ✓ MoMo"}
                </button>
                <button
                  onClick={() => handleCloseTab(bill.tabId, "cash")}
                  disabled={closingTabId === bill.tabId}
                  className="text-sm px-4 py-3 rounded-xl bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-bold disabled:opacity-50 transition-colors"
                >
                  {closingTabId === bill.tabId ? "..." : "Paid ✓ Cash"}
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
                className="bg-white dark:bg-gray-800 rounded-[22px] p-4 ring-1 ring-gray-200/70 dark:ring-0"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[17px] font-bold text-gray-900 dark:text-white">
                      {order.tableLabel}
                    </span>
                    {order.offer && (
                      <span title="This guest came with a campaign offer. Give it when they pay with Skuzi." className="text-[11px] font-bold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/20 px-2 py-0.5 rounded-full">
                        🎁 {order.offer.replace(/ when you pay with Skuzi$/, "")}
                      </span>
                    )}
                    {isManager && coveredTables.has(order.tableLabel) && (
                      <span title="This waiter has no smartphone: you're covering their table." className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
                        📵 Covering {coveredTables.get(order.tableLabel)}
                      </span>
                    )}
                    {phoneClosed.has(order.tabId) && (
                      <span title="The guest closed Skuzi on their phone. They may still be at the table." className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                        📵 Phone closed
                      </span>
                    )}
                    {order.kitchen && (
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${order.kitchen === "ready" ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300" : "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300"}`}>
                        {order.kitchen === "new" ? "🔥 Sent to kitchen" : order.kitchen === "preparing" ? "🔥 Cooking" : "🍽️ Food ready"}
                      </span>
                    )}
                    {order.source === "staff" && (
                      <span className="text-xs bg-[#FFEDB8] text-[#7A5A16] dark:bg-[#F2B33A]/15 dark:text-[#FFD15C] px-2 py-0.5 rounded-full">
                        Staff-entered
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-xs font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1 ${cfg.color}`}
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
                        className="text-sm px-4 py-2.5 rounded-xl bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-extrabold disabled:opacity-50 transition-colors"
                      >
                        {isUpdating ? "..." : "Start preparing"}
                      </button>
                    )}
                    {order.status === "preparing" && (
                      <button
                        onClick={() => updateStatus(order.orderId, "delivered")}
                        disabled={isUpdating}
                        className="text-sm px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-extrabold disabled:opacity-50 transition-colors"
                      >
                        {isUpdating ? "..." : "Served ✓"}
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
                    className="bg-white dark:bg-[#3B2149] border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-2.5 flex items-center justify-between"
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
                  {isManager ? "The floor" : "My Tables"}
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
                    className="bg-white dark:bg-[#3B2149] border border-gray-200 dark:border-gray-800 rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-2"
                  >
                    <div className="w-10 h-10 rounded-2xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center">
                      <MapPin size={18} className="text-brand-500" />
                    </div>
                    <p className="text-sm font-black text-gray-900 dark:text-white">
                      {table.label}
                    </p>
                    {isManager && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug">
                        {table.mine ? "You" : table.waiterName ?? "No waiter"}
                        {table.waiterHasSmartphone === false && (
                          <span className="block mt-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300">📵 You cover this table</span>
                        )}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      {/* ── Stock (managers only) ──────────────────────────────────────────── */}
      {activeTab === "stock" && isManager && staffToken && venueId && (
        <div className="px-4 pt-4 pb-28 md:pb-6 min-h-screen">
          <StockPanel venueId={venueId} token={staffToken} />
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
                  +{myPoints.weeklyPoints} pts this week{myPoints.weekRank === 1 ? " · 🏆 Top waiter this week" : myPoints.weekRank ? ` · #${myPoints.weekRank} this week` : ""}
                </p>
              </div>

              {/* Tips */}
              <div className="mb-5">
                {tipMomo ? (
                  <div className="rounded-2xl bg-white dark:bg-[#3B2149] border border-gray-100 dark:border-gray-800 p-4">
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400">💸 Tips this week (what guests told us)</p>
                    <p className="mt-1 text-2xl font-black text-gray-900 dark:text-white">{(myPoints.tipsWeekRwf ?? 0).toLocaleString()} RWF</p>
                    <div className="mt-3">
                      <TipsSetup token={staffToken} phone={myPhone} current={tipMomo} onSaved={setTipMomo} />
                    </div>
                  </div>
                ) : (
                  <TipsSetup token={staffToken} phone={myPhone} current={null} onSaved={setTipMomo} />
                )}
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="bg-white dark:bg-[#3B2149] border border-gray-100 dark:border-gray-800 rounded-2xl p-4">
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
                <div className="bg-white dark:bg-[#3B2149] border border-gray-100 dark:border-gray-800 rounded-2xl p-4">
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
                      className="bg-white dark:bg-[#3B2149] border border-gray-100 dark:border-gray-800 rounded-2xl px-4 py-3 flex items-center justify-between"
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
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 px-3 pb-3 pt-2 bg-gray-50 dark:bg-gray-950">
        <div className={`grid ${isManager ? "grid-cols-4" : "grid-cols-3"} gap-1.5 bg-white dark:bg-gray-800 rounded-[22px] p-1.5 ring-1 ring-gray-200/70 dark:ring-0`}>
          {(
            [
              { key: "orders", label: "Orders", icon: Receipt },
              { key: "tables", label: isManager ? "Floor" : "My tables", icon: MapPin },
              { key: "points", label: "Points", icon: Trophy },
              ...(isManager ? [{ key: "stock", label: "Stock", icon: Package }] : []),
            ] as { key: ActiveTab; label: string; icon: typeof Receipt }[]
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex flex-col items-center justify-center gap-0.5 py-2.5 rounded-2xl text-xs font-bold transition-colors ${
                activeTab === key ? "bg-brand-500 text-white" : "text-gray-500 dark:text-gray-400"
              }`}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </div>
      </div>
      {/* ── Manual order bottom sheet ─────────────────────────────────────── */}
      {manualOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setManualOpen(false)}
          />
          <div className="relative bg-white dark:bg-[#3B2149] rounded-t-3xl flex flex-col max-h-[90vh]">
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
