import { ThemeCycleButton } from "../../components/ThemeSwitch";
import { useState, useEffect, useRef } from "react";
import GuestAlerts from "../../components/GuestAlerts";
import { useParams } from "react-router-dom";
import api from "../../lib/api";
import {
  ShoppingBag,
  Receipt,
  CheckCircle,
  Loader,
  Users,
  X,
  Plus,
  Minus,
  Search,
  NotebookPen,
  Check,
} from "lucide-react";
import Logo, { WavingHand } from "../../components/Logo";
import VenueLogo from "../../components/VenueLogo";
import { useWebSocket } from "../../hooks/useWebSocket";
import { WsEvent } from "@tabpro/shared";
import { apiFetch, apiBeacon } from "../../lib/apiFetch";
import InviteOptIn from "../../components/guest/InviteOptIn";
import { guestApi, savedCreatorCode, saveCreatorCode } from "../../lib/guest";

// ─── Types ────────────────────────────────────────────────────────────────────
interface MenuItemData {
  id: string;
  name: string;
  description: string | null;
  category: string;
  priceRwf: number;
  isAvailable: boolean;
}
interface CartItem extends MenuItemData {
  quantity: number;
}
interface PlacedOrder {
  orderId: string;
  items: { name: string; quantity: number; unitPriceRwf: number }[];
  status: "pending" | "preparing" | "delivered";
  total: number;
}
interface BillLine {
  name: string;
  quantity: number;
  unitPriceRwf: number;
  subtotal: number;
}
type Step = "identify" | "menu" | "bill" | "rating" | "closed";
type TabStatus = "open" | "bill_requested" | "closed";

const SESSION_KEY = (qr: string) => `tabpro_tab_${qr}`;
const fmt = (n: number) => `${n.toLocaleString()} RWF`;

// ─── Foodish API category mapping ────────────────────────────────────────────

function getFoodishCategory(name: string, cat: string): string | null {
  const s = (name + " " + cat).toLowerCase();
  if (s.includes("burger") || s.includes("hamburger")) return "burger";
  if (s.includes("pizza")) return "pizza";
  if (s.includes("pasta") || s.includes("spaghetti") || s.includes("macaroni"))
    return "pasta";
  if (s.includes("rice") || s.includes("biryani") || s.includes("fried rice"))
    return "rice";
  if (s.includes("chicken") || s.includes("butter chicken"))
    return "butter-chicken";
  if (s.includes("dessert") || s.includes("cake") || s.includes("sweet"))
    return "dessert";
  if (s.includes("samosa") || s.includes("starter") || s.includes("snack"))
    return "samosa";
  if (s.includes("idly") || s.includes("dosa") || s.includes("indian"))
    return "idly";
  // No match: show the category icon rather than a photo of a different dish.
  return null;
}

// Cache images so we don't refetch on re-render
const imageCache: Record<string, string> = {};

async function fetchFoodImage(
  itemId: string,
  name: string,
  cat: string,
): Promise<string> {
  if (imageCache[itemId]) return imageCache[itemId];
  const foodCat = getFoodishCategory(name, cat);
  if (!foodCat) return "";
  try {
    const res = await fetch(`https://foodish-api.com/api/images/${foodCat}`);
    const data = await res.json();
    imageCache[itemId] = data.image;
    return data.image;
  } catch {
    imageCache[itemId] = "";
    return "";
  }
}

// ─── Category config (emoji for chips/fallback) ───────────────────────────────
const CAT_EMOJI: Record<string, string> = {
  drinks: "🍹",
  drink: "🍹",
  beer: "🍺",
  wine: "🍷",
  cocktail: "🍸",
  juice: "🧃",
  coffee: "☕",
  water: "💧",
  food: "🍽",
  chicken: "🍗",
  grill: "🔥",
  fish: "🐟",
  pizza: "🍕",
  pasta: "🍝",
  chips: "🍟",
  salad: "🥗",
  soup: "🍲",
  dessert: "🍰",
  brochette: "🍢",
  tilapia: "🐟",
};
function getCatEmoji(cat: string) {
  const key = cat.toLowerCase().replace(/\s+/g, "");
  for (const [k, v] of Object.entries(CAT_EMOJI)) {
    if (key.includes(k)) return v;
  }
  return "🍽";
}

// ─── Menu item card: photo on the left, name + price, add on the right ──────
function MenuCard({
  item,
  qty,
  onAdd,
  onRemove,
}: {
  item: MenuItemData;
  qty: number;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const [imgUrl, setImgUrl] = useState<string>(imageCache[item.id] || "");
  const [imgLoaded, setImgLoaded] = useState(false);
  const emoji = getCatEmoji(item.category);

  useEffect(() => {
    if (!imgUrl) {
      fetchFoodImage(item.id, item.name, item.category).then((url) => {
        if (url) setImgUrl(url);
      });
    }
  }, [item.id]);

  return (
    <div
      className={`flex items-center gap-3.5 p-3 rounded-[22px] bg-white dark:bg-[#3B2149] transition-all ${
        qty > 0 ? "ring-2 ring-brand-400/70" : "ring-1 ring-gray-200/70 dark:ring-gray-800"
      } ${!item.isAvailable ? "opacity-60" : ""}`}
    >
      <div className="relative w-[74px] h-[74px] rounded-2xl overflow-hidden flex-shrink-0 bg-[#F8D9C6] dark:bg-gray-800">
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-3xl opacity-50 select-none">{emoji}</span>
        </div>
        {imgUrl && (
          <img
            src={imgUrl}
            alt={item.name}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgUrl("")}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
          />
        )}
        {!item.isAvailable && (
          <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
            <span className="text-[10px] font-bold text-white">Sold out</span>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-bold text-gray-900 dark:text-white leading-snug line-clamp-1">{item.name}</p>
        {item.description && (
          <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug line-clamp-2">{item.description}</p>
        )}
        <p className="text-[15px] font-bold text-brand-600 dark:text-brand-300 mt-1.5">{fmt(item.priceRwf)}</p>
      </div>

      {item.isAvailable &&
        (qty === 0 ? (
          <button
            onClick={onAdd}
            aria-label={`Add ${item.name}`}
            className="w-11 h-11 rounded-full bg-action hover:bg-action-hover flex items-center justify-center text-white flex-shrink-0 active:scale-90 transition-all"
          >
            <Plus size={20} strokeWidth={3} />
          </button>
        ) : (
          <div className="flex items-center gap-1 bg-gray-900 dark:bg-gray-50 text-white dark:text-gray-900 rounded-full p-1 flex-shrink-0">
            <button
              onClick={onRemove}
              aria-label={`Remove one ${item.name}`}
              className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-all hover:bg-white/10 dark:hover:bg-black/10"
            >
              <Minus size={15} strokeWidth={3} />
            </button>
            <span className="text-sm font-black w-5 text-center">{qty}</span>
            <button
              onClick={onAdd}
              aria-label={`Add one more ${item.name}`}
              className="w-9 h-9 rounded-full bg-action text-white flex items-center justify-center active:scale-90 transition-all"
            >
              <Plus size={15} strokeWidth={3} />
            </button>
          </div>
        ))}
    </div>
  );
}

// The Skuzi hand, small, for the "Skuzi!" button (your waiter is one tap away).
function WaveIcon() {
  return (
    <svg width="22" height="22" viewBox="8 4 90 92" aria-hidden="true">
      <WavingHand color="currentColor" strokeWidth={8} />
    </svg>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: PlacedOrder["status"] }) {
  const m = {
    pending: [
      "Received",
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    ],
    preparing: [
      "🍳 Preparing",
      "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    ],
    delivered: [
      "✓ Delivered",
      "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    ],
  } as const;
  const [label, cls] = m[status];
  return (
    <span
      className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${cls}`}
    >
      {label}
    </span>
  );
}

// ─── Star row ─────────────────────────────────────────────────────────────────
function StarRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </span>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            onClick={() => onChange(s)}
            className={`text-2xl leading-none transition-all active:scale-125 select-none ${s <= value ? "text-amber-400" : "text-gray-200 dark:text-gray-700"}`}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function CustomerMenu() {
  const { qrCode } = useParams<{ qrCode: string }>();
  const [step, setStep] = useState<Step>("identify");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [phone, setPhone] = useState("");
  // Menu first: the number is asked only when the guest sends their first order.
  const [askPhone, setAskPhone] = useState(false);
  const [tabId, setTabId] = useState<string | null>(null);
  const [tabStatus, setTabStatus] = useState<TabStatus>("open");
  const [venueId, setVenueId] = useState<string | null>(null);
  const [venueName, setVenueName] = useState("");
  const [venueLogoUrl, setVenueLogoUrl] = useState<string | null>(null);
  const [tableLabel, setTableLabel] = useState("");
  const [waiterName, setWaiterName] = useState<string | null>(null);
  const [isGroupTab, setIsGroupTab] = useState(false);
  const [menuGrouped, setMenuGrouped] = useState<
    Record<string, MenuItemData[]>
  >({});
  const [allItems, setAllItems] = useState<MenuItemData[]>([]);
  const [activeCategory, setActiveCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const catRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const menuHeaderRef = useRef<HTMLDivElement>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [placedOrders, setPlacedOrders] = useState<PlacedOrder[]>([]);
  const [orderLoading, setOrderLoading] = useState(false);
  const [justOrdered, setJustOrdered] = useState(false);
  const [nudgeToast, setNudgeToast] = useState(false);
  const [nudgeLoading, setNudgeLoading] = useState(false);
  const [justNudged, setJustNudged] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [billLoading, setBillLoading] = useState(false);
  const [billLines, setBillLines] = useState<BillLine[]>([]);
  const [grandTotal, setGrandTotal] = useState(0);
  // A campaign brought this guest: their offer, and what they pay with Skuzi.
  const [skuziOffer, setSkuziOffer] = useState<{ title: string | null; offerType: string; text: string | null } | null>(null);
  const [payTotal, setPayTotal] = useState(0);
  // Skuzi money: what the guest has to spend (from a creator's welcome), what
  // this payment actually charged, and the welcome money this payment earned.
  const [walletRwf, setWalletRwf] = useState(0);
  const [chargedRwf, setChargedRwf] = useState<number | null>(null);
  const [welcomeRwf, setWelcomeRwf] = useState(0);
  // Skuzi Creators: the code of the creator who brought this guest (optional).
  const [creatorCode, setCreatorCode] = useState(() => savedCreatorCode()?.code ?? "");
  const [creatorName, setCreatorName] = useState<string | null>(() => savedCreatorCode()?.name ?? null);
  const [creatorCheck, setCreatorCheck] = useState<"idle" | "ok" | "unknown">(() => (savedCreatorCode() ? "ok" : "idle"));
  const checkCreatorCode = async (raw: string) => {
    const code = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!code) { setCreatorCheck("idle"); setCreatorName(null); return; }
    try {
      const r = await guestApi.get(`/creators/code/${code}`);
      setCreatorName(r.data.data.name); setCreatorCheck("ok"); saveCreatorCode(r.data.data.code, r.data.data.name);
    } catch { setCreatorName(null); setCreatorCheck("unknown"); }
  };

  // ─── Mobile Money payment state ───────────────────────────────────────────────────
  type PayStep = "idle" | "entering_phone" | "waiting" | "success" | "failed";
  const [payStep, setPayStep] = useState<PayStep>("idle");
  const [payPhone, setPayPhone] = useState("");
  const [payPhoneError, setPayPhoneError] = useState("");
  const [payFailReason, setPayFailReason] = useState("");
  // False when the venue has no payout number or payments aren't configured —
  // the customer is asked to pay the waiter instead.
  const [acceptsMobileMoney, setAcceptsMobileMoney] = useState(true);
  // Demo venue: everything works, but payments are simulated.
  const [isDemo, setIsDemo] = useState(false);
  const [payReferenceId, setPayReferenceId] = useState("");
  const [foodScore, setFoodScore] = useState(0);
  const [waiterScore, setWaiterScore] = useState(0);
  const [overallScore, setOverallScore] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingLoading, setRatingLoading] = useState(false);

  useEffect(() => {
    if (!qrCode) return;
    const saved = sessionStorage.getItem(SESSION_KEY(qrCode));
    if (!saved) {
      loadPreview();
      return;
    }
    const s = JSON.parse(saved);
    setTabId(s.tabId);
    setTabStatus(s.tabStatus ?? "open");
    setVenueId(s.venueId);
    setVenueName(s.venueName);
    setAcceptsMobileMoney(s.acceptsMobileMoney !== false);
    setIsDemo(!!s.isDemo);
    setTableLabel(s.tableLabel);
    setWaiterName(s.waiterName ?? null);
    setPhone(s.phone);
    setWelcomeRwf(s.welcomeRwf ?? 0);
    const mg = s.menuGrouped as Record<string, MenuItemData[]>;
    setMenuGrouped(mg);
    setAllItems(Object.values(mg).flat());
    setActiveCategory(Object.keys(mg)[0] ?? "");
    if (s.tabStatus === "bill_requested") {
      fetchBill(s.tabId);
      setStep("bill");
    } else if (s.tabStatus === "closed") {
      setStep(s.ratingSubmitted ? "closed" : "rating");
    } else {
      setStep("menu");
      loadOrders(s.tabId);
    }
  }, [qrCode]);

  const saveSession = (o: Record<string, unknown> = {}) => {
    if (!qrCode) return;
    const p = JSON.parse(sessionStorage.getItem(SESSION_KEY(qrCode)) || "{}");
    sessionStorage.setItem(SESSION_KEY(qrCode), JSON.stringify({ ...p, ...o }));
  };

  useWebSocket({
    venueId: venueId ?? "",
    tabId: tabId ?? undefined,
    enabled: !!venueId && !!tabId,
    onEvent: (event: WsEvent) => {
      if (event.type === "order_status_update") {
        const { orderId, status } = event.payload as any;
        setPlacedOrders((p) =>
          p.map((o) => (o.orderId === orderId ? { ...o, status } : o)),
        );
      }
      if (
        event.type === "bill_requested" &&
        (event.payload as any).tabId === tabId
      ) {
        setTabStatus("bill_requested");
        fetchBill(tabId!);
        setStep("bill");
        saveSession({ tabStatus: "bill_requested" });
      }
      if (
        event.type === "tab_closed" &&
        (event.payload as any).tabId === tabId
      ) {
        setTabStatus("closed");
        setStep("rating");
        saveSession({ tabStatus: "closed" });
      }
    },
  });

  // After a refresh the page only remembers the tab, not what was ordered on it,
  // so the Skuzi! / My bill buttons and the orders list vanished. Fetch them back.
  const loadOrders = async (id: string) => {
    try {
      const res = await apiFetch(`/tabs/${id}`);
      const data = await res.json();
      if (!data.success) return;
      const orders = [...(data.data.orders ?? [])].sort(
        (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      setPlacedOrders(
        orders.map((o: any) => {
          const items = (o.items ?? []).map((i: any) => ({
            name: i.menuItem?.name ?? "Item",
            quantity: i.quantity,
            unitPriceRwf: i.unitPriceRwf,
          }));
          return {
            orderId: o.id,
            items,
            status: o.status,
            total: items.reduce((n: number, i: { quantity: number; unitPriceRwf: number }) => n + i.quantity * i.unitPriceRwf, 0),
          };
        }),
      );
    } catch {
      /* the list comes back with the next order */
    }
  };

  // What the guest sees right after scanning: the venue and the menu. No tab yet.
  const loadPreview = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`/tabs/preview/${qrCode}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      const { venue, table, menuGrouped: mg, waiter } = data.data;
      setWaiterName(waiter?.name ?? null);
      setVenueId(venue.id);
      setVenueName(venue.name);
      if (venue.logoUrl) setVenueLogoUrl(venue.logoUrl);
      setAcceptsMobileMoney(venue.acceptsMobileMoney !== false);
      setIsDemo(!!venue.isDemo);
      setTableLabel(table.label);
      setMenuGrouped(mg);
      setAllItems(Object.values(mg).flat() as MenuItemData[]);
      setActiveCategory(Object.keys(mg)[0] ?? "");
      setStep("menu");
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please scan again.");
    } finally {
      setLoading(false);
    }
  };

  // The guest gave their number: open (or join) the table's tab. Returns the
  // tab id, or null if the bill is already being paid (they land on the bill).
  const openTabWithPhone = async (): Promise<string | null> => {
    const cleaned = phone.trim();
    if (cleaned.replace(/\D/g, "").length < 9) {
      setError("Enter your MTN MoMo or Airtel Money number, e.g. 078 123 4567");
      return null;
    }
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/tabs/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrCode, phone: cleaned }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      const { tab, venue, table, menuGrouped: mg, isExisting, waiter, offer } = data.data;
      setSkuziOffer(offer ?? null);
      setWaiterName(waiter?.name ?? null);
      setTabId(tab.id);
      setTabStatus(tab.status);
      setVenueId(venue.id);
      setVenueName(venue.name);
      setAcceptsMobileMoney(venue.acceptsMobileMoney !== false);
      setIsDemo(!!venue.isDemo);
      setTableLabel(table.label);
      setMenuGrouped(mg);
      setAllItems(Object.values(mg).flat() as MenuItemData[]);
      setIsGroupTab(isExisting);
      sessionStorage.setItem(
        SESSION_KEY(qrCode!),
        JSON.stringify({
          tabId: tab.id,
          tabStatus: tab.status,
          venueId: venue.id,
          venueName: venue.name,
          acceptsMobileMoney: venue.acceptsMobileMoney !== false,
          isDemo: !!venue.isDemo,
          tableLabel: table.label,
          waiterName: waiter?.name ?? null,
          phone: cleaned,
          menuGrouped: mg,
        }),
      );
      // Joining a table whose bill is already requested lands on the bill.
      if (tab.status === "bill_requested") {
        setAskPhone(false);
        fetchBill(tab.id);
        setStep("bill");
        return null;
      }
      return tab.id as string;
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
      return null;
    } finally {
      setLoading(false);
    }
  };

  // "Confirm order": the first time, ask for the number, then send.
  const confirmOrder = () => {
    if (tabId) {
      handlePlaceOrder(tabId);
      return;
    }
    setError("");
    setCartOpen(false);
    setAskPhone(true);
  };
  const sendFirstOrder = async () => {
    const id = await openTabWithPhone();
    if (!id) return;
    setAskPhone(false);
    await handlePlaceOrder(id);
  };

  const addToCart = (item: MenuItemData) =>
    setCart((p) => {
      const e = p.find((c) => c.id === item.id);
      return e
        ? p.map((c) =>
            c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c,
          )
        : [...p, { ...item, quantity: 1 }];
    });
  const removeFromCart = (id: string) =>
    setCart((p) => {
      const e = p.find((c) => c.id === id);
      if (!e) return p;
      return e.quantity === 1
        ? p.filter((c) => c.id !== id)
        : p.map((c) => (c.id === id ? { ...c, quantity: c.quantity - 1 } : c));
    });
  const cartTotal = cart.reduce((s, i) => s + i.priceRwf * i.quantity, 0);
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const getQty = (id: string) => cart.find((c) => c.id === id)?.quantity ?? 0;

  const handlePlaceOrder = async (id: string) => {
    if (!cart.length) return;
    setOrderLoading(true);
    try {
      const res = await apiFetch("/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tabId: id,
          source: "customer",
          items: cart.map((c) => ({ menuItemId: c.id, quantity: c.quantity })),
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      const { orderPayload } = data.data;
      setPlacedOrders((p) => [
        ...p,
        {
          orderId: orderPayload.orderId,
          items: orderPayload.items,
          status: "pending",
          total: orderPayload.total,
        },
      ]);
      setCart([]);
      setCartOpen(false);
      setJustOrdered(true);
      setTimeout(() => setJustOrdered(false), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to place order.");
    } finally {
      setOrderLoading(false);
    }
  };

  const handleNudge = async () => {
    if (nudgeLoading || justNudged) return;
    if (!tabId && !qrCode) return;
    setNudgeLoading(true);
    try {
      // Before the first order there's no tab yet: alert the table from its sticker.
      await apiFetch(tabId ? `/tabs/${tabId}/nudge` : `/tabs/preview/${qrCode}/nudge`, { method: "POST" });
      setJustNudged(true);
      setTimeout(() => setJustNudged(false), 10000);
      setNudgeToast(true);
      setTimeout(() => setNudgeToast(false), 3000);
    } catch {
    } finally {
      setNudgeLoading(false);
    }
  };

  const handleRequestBill = async () => {
    if (!tabId) return;
    setBillLoading(true);
    try {
      await apiFetch(`/tabs/${tabId}/request-bill`, { method: "POST" });
      await fetchBill(tabId);
      setTabStatus("bill_requested");
      setStep("bill");
      saveSession({ tabStatus: "bill_requested" });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBillLoading(false);
    }
  };

  // ─── Heartbeat — ping server every 30s so it knows customer is still here ───
  useEffect(() => {
    if (!tabId || tabStatus === "closed") return;
    const ping = () => api.post(`/tabs/${tabId}/heartbeat`).catch(() => {});
    ping(); // immediate first ping
    const interval = setInterval(ping, 30_000);
    // Back on the page (unlocked phone, returned to the tab): say so at once.
    const onVisible = () => { if (document.visibilityState === "visible") ping(); };
    // Page closing: tell staff right away; the server waits a few seconds in
    // case this is just a reload.
    const onLeave = () => apiBeacon(`/tabs/${tabId}/left`);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pagehide", onLeave);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pagehide", onLeave);
    };
  }, [tabId, tabStatus]);

  // Skuzi money is used when paying from the number it belongs to (the one the
  // guest started with); the server has the final word on the amount.
  const samePhone = (a: string, b: string) => a.replace(/\D/g, "").slice(-9) === b.replace(/\D/g, "").slice(-9);
  const useWallet = !isDemo && walletRwf > 0 && !!phone && samePhone(payPhone, phone) ? walletRwf : 0;
  const toPay = (payTotal || grandTotal) - useWallet;

  const handleMomoPay = async () => {
    setPayPhoneError("");
    const cleaned = payPhone.trim().replace(/\s/g, "");
    if (cleaned.length < 9) {
      setPayPhoneError("Enter a valid MTN MoMo or Airtel Money number");
      return;
    }
    try {
      setPayStep("waiting");
      setPayFailReason("");
      const res = await api.post(`/tabpayment/${tabId}/pay`, { phone: cleaned, creatorCode: !isDemo && creatorCode && creatorCheck !== "unknown" ? creatorCode : null });
      setPayReferenceId(res.data.data.depositId);
      setChargedRwf(res.data.data.grandTotal ?? null);
    } catch (err: any) {
      // e.g. "Not enough balance on your Mobile Money account."
      setPayFailReason(err?.response?.data?.error ?? "");
      setPayStep("failed");
    }
  };

  // Poll for payment confirmation
  useEffect(() => {
    if (payStep !== "waiting" || !payReferenceId || !tabId) return;

    let interval: ReturnType<typeof setInterval>;
    let attempts = 0;
    // The customer has to approve on their phone and enter their PIN — give
    // them ~3 minutes (36 × 5s) before giving up.
    const MAX_ATTEMPTS = 36;

    const timeout = setTimeout(() => {
      interval = setInterval(async () => {
        attempts += 1;
        try {
          const res = await api.get(`/tabpayment/${tabId}/pay/status/${payReferenceId}`);
          if (!res.data.success) return;

          const status = res.data.data.status;

          if (status === "successful") {
            clearInterval(interval);
            const welcome = res.data.data.welcomeRwf ?? 0;
            setWelcomeRwf(welcome);
            setPayStep("success");
            setTabStatus("closed");
            saveSession({ tabStatus: "closed", welcomeRwf: welcome });
            setTimeout(() => setStep("rating"), welcome > 0 ? 4500 : 2000);
            return;
          }

          // Never show success unless the provider confirmed it.
          if (status === "failed" || attempts >= MAX_ATTEMPTS) {
            clearInterval(interval);
            setPayFailReason(
              status === "failed"
                ? res.data.data.failureMessage ?? ""
                : "We haven't heard back from Mobile Money yet. If you approved it, don't pay again — ask your waiter.",
            );
            setPayStep("failed");
          }
        } catch {
          /* keep polling */
        }
      }, 5000);
    }, 3000);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [payStep, payReferenceId, tabId]);

  const fetchBill = async (id: string) => {
    try {
      const res = await apiFetch(`/tabs/${id}/bill`);
      const data = await res.json();
      if (!data.success) return;
      setBillLines(data.data.lineItems);
      setGrandTotal(data.data.grandTotal);
      setPayTotal(data.data.payWithSkuziTotal ?? data.data.grandTotal);
      setWalletRwf(data.data.walletRwf ?? 0);
      if (data.data.offer !== undefined) setSkuziOffer(data.data.offer);
      if (data.data.venueName) setVenueName(data.data.venueName);
      if (data.data.tableLabel) setTableLabel(data.data.tableLabel);
    } catch {}
  };

  const handleSubmitRating = async (skip = false) => {
    if (!skip && (!foodScore || !waiterScore || !overallScore)) {
      setError("Please rate all three.");
      return;
    }
    setRatingLoading(true);
    setError("");
    try {
      if (!skip)
        await apiFetch("/ratings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tabId,
            foodScore,
            waiterScore,
            overallScore,
            comment: ratingComment || undefined,
          }),
        });
      saveSession({ ratingSubmitted: true });
      setStep("closed");
    } catch {
      setError("Failed. You can skip.");
    } finally {
      setRatingLoading(false);
    }
  };

  // Scroll so the section's title lands just below the sticky header. A plain
  // scrollIntoView put it behind the header, so guests saw the next section.
  const scrollToCategory = (cat: string) => {
    setActiveCategory(cat);
    const el = catRefs.current[cat];
    if (!el) return;
    const headerHeight = menuHeaderRef.current?.getBoundingClientRect().height ?? 0;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - headerHeight - 12, behavior: "smooth" });
  };

  // ─── IDENTIFY ─────────────────────────────────────────────────────────────
  // Opening the table: the menu is on its way (or the sticker isn't set up).
  if (step === "identify") {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#2B1838] flex flex-col items-center justify-center px-6 py-10 text-center">
        <div className="w-20 h-20 rounded-3xl bg-action flex items-center justify-center mx-auto mb-5 shadow-xl shadow-action/30">
          <Logo size={44} />
        </div>
        {error ? (
          <>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white">Hmm, that didn't work</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-xs">{error}</p>
            <button
              onClick={loadPreview}
              disabled={loading}
              className="mt-6 px-6 py-3.5 rounded-2xl bg-action hover:bg-action-hover text-white font-black disabled:opacity-50"
            >
              {loading ? "Trying…" : "Try again"}
            </button>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white">Welcome!</h1>
            <p className="text-sm text-gray-400 mt-2 flex items-center gap-2"><Loader size={14} className="animate-spin" /> Opening the menu…</p>
          </>
        )}
      </div>
    );
  }

  // ─── BILL ─────────────────────────────────────────────────────────────────
  if (step === "bill") {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#2B1838]">
        <div className="bg-white dark:bg-[#3B2149] border-b border-gray-200 dark:border-gray-800 px-5 py-4 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <VenueLogo logoUrl={venueLogoUrl} venueName={venueName} size={36} />
            <div>
              <h1 className="font-black text-gray-900 dark:text-white text-lg">
                {venueName}
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">{tableLabel}{isDemo && <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">Demo · no real money</span>}</p>
            </div>
          </div>
        </div>
        <div className="px-4 pt-6 pb-10 max-w-lg mx-auto min-h-screen bg-transparent">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-widest font-semibold">
              Your receipt
            </p>
          </div>
          {/* ── Thermal receipt design ── */}
          <div
            className="mb-4 mx-auto w-full max-w-xs"
            style={{ fontFamily: "'Courier New', Courier, monospace" }}
          >
            {/* Torn top edge */}
            <div
              style={{
                height: 12,
                backgroundImage:
                  "radial-gradient(circle at 50% 0%, #FAF8FC 6px, transparent 6px)",
                backgroundSize: "12px 12px",
                backgroundRepeat: "repeat-x",
                backgroundColor: "#d1d5db",
              }}
            />

            <div style={{ background: "#FAF8FC", padding: "0 20px" }}>
              {/* Header */}
              <div style={{ textAlign: "center", padding: "12px 0 8px" }}>
                <p
                  style={{
                    fontSize: 10,
                    letterSpacing: 4,
                    color: "#9ca3af",
                    textTransform: "uppercase",
                  }}
                >
                  — Skuzi Receipt —
                </p>
                <p
                  style={{
                    fontSize: 16,
                    fontWeight: 900,
                    color: "#111827",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    marginTop: 4,
                  }}
                >
                  {venueName}
                </p>
                <p style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>
                  {tableLabel}
                </p>
              </div>

              <p
                style={{
                  textAlign: "center",
                  color: "#d1d5db",
                  fontSize: 10,
                  letterSpacing: 2,
                }}
              >
                {"- ".repeat(18)}
              </p>

              {/* Items */}
              <div style={{ padding: "10px 0" }}>
                {billLines.map((line, i) => (
                  <div key={i} style={{ marginBottom: 8 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 11,
                        color: "#1f2937",
                      }}
                    >
                      <span
                        style={{ fontWeight: 700, textTransform: "uppercase" }}
                      >
                        {line.name}
                      </span>
                      <span style={{ fontWeight: 900 }}>
                        {line.subtotal.toLocaleString()}
                      </span>
                    </div>
                    <p style={{ fontSize: 10, color: "#9ca3af" }}>
                      {line.quantity} × {line.unitPriceRwf.toLocaleString()} RWF
                    </p>
                  </div>
                ))}
              </div>

              <p
                style={{
                  textAlign: "center",
                  color: "#d1d5db",
                  fontSize: 10,
                  letterSpacing: 2,
                }}
              >
                {"- ".repeat(18)}
              </p>

              {/* Totals */}
              <div style={{ padding: "10px 0" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 10,
                    color: "#6b7280",
                    marginBottom: 4,
                  }}
                >
                  <span>SUBTOTAL (EXCL. VAT 18%)</span>
                  <span>{Math.round(grandTotal / 1.18).toLocaleString()}</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 10,
                    color: "#6b7280",
                    marginBottom: 8,
                  }}
                >
                  <span>VAT 18%</span>
                  <span>
                    {(
                      grandTotal - Math.round(grandTotal / 1.18)
                    ).toLocaleString()}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 15,
                    fontWeight: 900,
                    color: "#111827",
                    borderTop: "1px solid #e5e7eb",
                    paddingTop: 8,
                  }}
                >
                  <span>TOTAL</span>
                  <span>{grandTotal.toLocaleString()} RWF</span>
                </div>
              </div>

              <p
                style={{
                  textAlign: "center",
                  color: "#d1d5db",
                  fontSize: 10,
                  letterSpacing: 2,
                }}
              >
                {"= ".repeat(18)}
              </p>

              {/* EBM disclaimer */}
              <div style={{ padding: "10px 0", textAlign: "center" }}>
                <p
                  style={{
                    fontSize: 10,
                    fontWeight: 900,
                    color: "#374151",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    marginBottom: 4,
                  }}
                >
                  ⚠ Important
                </p>
                <p style={{ fontSize: 9.5, color: "#6b7280", lineHeight: 1.6 }}>
                  This is a{" "}
                  <strong style={{ color: "#374151" }}>
                    payment confirmation
                  </strong>{" "}
                  from Skuzi, not a fiscal invoice. Your venue must issue you
                  an official{" "}
                  <strong style={{ color: "#374151" }}>EBM receipt</strong> as
                  required by RRA law. Please collect it at the counter.
                </p>
              </div>

              <p
                style={{
                  textAlign: "center",
                  color: "#d1d5db",
                  fontSize: 10,
                  letterSpacing: 2,
                }}
              >
                {"- ".repeat(18)}
              </p>

              {/* Ref */}
              <div style={{ textAlign: "center", padding: "8px 0 12px" }}>
                <p style={{ fontSize: 9, color: "#9ca3af", letterSpacing: 3 }}>
                  {tabId?.replace(/-/g, "").slice(0, 16).toUpperCase()}
                </p>
                <p style={{ fontSize: 9, color: "#d1d5db", marginTop: 4 }}>
                  Powered by Skuzi
                </p>
              </div>
            </div>

            {/* Torn bottom edge */}
            <div
              style={{
                height: 12,
                backgroundImage:
                  "radial-gradient(circle at 50% 100%, #FAF8FC 6px, transparent 6px)",
                backgroundSize: "12px 12px",
                backgroundRepeat: "repeat-x",
                backgroundColor: "#d1d5db",
              }}
            />
          </div>
          {skuziOffer?.text && payStep === "idle" && (
            <div className="mb-3 rounded-2xl bg-[#231A2C] px-4 py-3 text-[#F4F0F7]">
              <p className="text-xs font-extrabold uppercase tracking-wider text-[#F2B33A]">{skuziOffer.title ?? "Your offer"}</p>
              <p className="mt-0.5 text-sm font-bold">
                {skuziOffer.offerType === "discount_10" && acceptsMobileMoney
                  ? <>10% off with Skuzi: pay {fmt(payTotal)} instead of {fmt(grandTotal)}</>
                  : <>{skuziOffer.text}. Show this to your waiter.</>}
              </p>
            </div>
          )}
          {/* Mobile Money payment flow (pawaPay) */}
          {payStep === "idle" && acceptsMobileMoney && (
            <button
              onClick={() => {
                setPayPhone(phone);
                setPayStep("entering_phone");
              }}
              className="w-full flex items-center justify-center gap-2 bg-action hover:bg-action-hover text-white font-bold py-4 rounded-2xl transition-colors shadow-lg shadow-action/30"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                <line x1="12" y1="18" x2="12.01" y2="18" />
              </svg>
              Pay with Mobile Money
            </button>
          )}

          {payStep === "idle" && !acceptsMobileMoney && (
            <div className="bg-gray-50 dark:bg-[#3B2149] border border-gray-200 dark:border-gray-800 rounded-2xl px-5 py-4 text-center">
              <p className="text-sm font-bold text-gray-800 dark:text-white">Please pay your waiter</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                In-app Mobile Money isn't available at this venue yet.
              </p>
            </div>
          )}

          {payStep === "entering_phone" && (
            <div className="bg-white dark:bg-[#3B2149] border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
              {/* Header */}
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                <p className="text-sm font-black text-gray-900 dark:text-white">
                  Confirm payment
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {isDemo
                    ? "Demo restaurant: no real Mobile Money request is sent and nothing is charged."
                    : "We'll send a Mobile Money request to this number"}
                </p>
              </div>
              {/* Skuzi money (from a creator's welcome) comes off the bill */}
              {useWallet > 0 && (
                <div className="px-5 py-3 flex items-center justify-between border-b border-gray-100 dark:border-gray-800 bg-[#FFF7E0] dark:bg-[#2A2035]">
                  <p className="text-sm font-bold text-gray-800 dark:text-[#F4F0F7]">💰 Your Skuzi money</p>
                  <p className="text-sm font-black text-green-700 dark:text-green-400">−{fmt(useWallet)}</p>
                </div>
              )}
              {/* Amount */}
              <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
                <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
                  Amount
                </p>
                <p className="text-xl font-black text-gray-900 dark:text-white">
                  {fmt(toPay)}
                </p>
              </div>
              {/* Phone */}
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-2">
                  MTN MoMo or Airtel Money number
                </p>
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-[#2B1838] border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-brand-500 flex-shrink-0"
                  >
                    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                    <line x1="12" y1="18" x2="12.01" y2="18" />
                  </svg>
                  <input
                    type="tel"
                    placeholder="e.g. 0781234567"
                    value={payPhone}
                    onChange={(e) => setPayPhone(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white focus:outline-none"
                  />
                </div>
                {payPhoneError && (
                  <p className="text-xs text-red-500 mt-2">{payPhoneError}</p>
                )}
                {phone && payPhone === phone && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-2 flex items-center gap-1">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Same number you registered with
                  </p>
                )}
              </div>
              {/* Skuzi Creators: who sent you? */}
              {!isDemo && (
                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                  <label htmlFor="creator-code" className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
                    Creator code <span className="normal-case tracking-normal font-medium">(optional)</span>
                  </label>
                  <input
                    id="creator-code"
                    value={creatorCode}
                    onChange={(e) => { setCreatorCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")); setCreatorCheck("idle"); }}
                    onBlur={() => checkCreatorCode(creatorCode)}
                    placeholder="e.g. ALINE"
                    maxLength={16}
                    className="mt-2 w-full bg-gray-50 dark:bg-[#2B1838] border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white focus:outline-none focus:border-brand-500"
                  />
                  {creatorCheck === "ok" && creatorName && <p className="text-xs text-green-600 dark:text-green-400 mt-2">✓ {creatorName}'s code. Thanks for coming!</p>}
                  {creatorCheck === "unknown" && <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">We don't know this code. You can still pay.</p>}
                </div>
              )}
              {/* Actions */}
              <div className="px-5 py-4 flex flex-col gap-2">
                <button
                  onClick={handleMomoPay}
                  className="w-full bg-action hover:bg-action-hover text-white font-bold py-3 rounded-xl transition-colors"
                >
                  Confirm & pay {fmt(toPay)}
                </button>
                <button
                  onClick={() => setPayStep("idle")}
                  className="w-full text-sm text-gray-400 hover:text-gray-600 py-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {payStep === "waiting" && (
            <div className="bg-gray-100 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-2xl px-5 py-6 text-center">
              <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm font-black text-gray-800 dark:text-white mb-1">
                Waiting for your approval
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                {isDemo ? (
                  <>Demo payment: this completes by itself in a few seconds. No real money is charged.</>
                ) : (
                  <>
                    Check{" "}
                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                      {payPhone}
                    </span>{" "}
                    and approve the Mobile Money request for {fmt(chargedRwf ?? toPay)}
                  </>
                )}
              </p>
            </div>
          )}

          {payStep === "success" && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-2xl px-5 py-6 text-center">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-800/40 flex items-center justify-center mx-auto mb-3">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-green-600"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="text-sm font-black text-gray-800 dark:text-white mb-1">
                Payment confirmed!
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {fmt(chargedRwf ?? toPay)} received. Your official RRA receipt will be
                issued at the counter.
              </p>
              {welcomeRwf > 0 && (
                <p className="mt-3 rounded-xl bg-[#FFF7E0] px-3 py-2 text-sm font-bold text-[#231A2C] dark:bg-[#2A2035] dark:text-[#F4F0F7]">
                  🎉 You got {fmt(welcomeRwf)} Skuzi money for your next Skuzi bill!
                </p>
              )}
            </div>
          )}

          {payStep === "failed" && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-2xl px-5 py-6 text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-800/40 flex items-center justify-center mx-auto mb-3">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-red-500"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </div>
              <p className="text-sm font-black text-gray-800 dark:text-white mb-1">
                Payment failed
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                {payFailReason || "The payment was not completed. Please try again."}
              </p>
              <button
                onClick={() => setPayStep("idle")}
                className="text-sm text-brand-500 font-bold hover:underline"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── RATING ───────────────────────────────────────────────────────────────
  if (step === "rating") {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#2B1838] flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">🌟</div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white">
              How was your visit?
            </h1>
            <p className="text-sm text-gray-400 mt-2">
              {venueName} · {tableLabel}
            </p>
          </div>
          <div className="bg-white dark:bg-[#3B2149] border border-gray-200 dark:border-gray-800 rounded-3xl px-6 py-2 mb-4 shadow-sm">
            <StarRow
              label="🍽 Food"
              value={foodScore}
              onChange={setFoodScore}
            />
            <StarRow
              label="🙋 Service"
              value={waiterScore}
              onChange={setWaiterScore}
            />
            <StarRow
              label="✨ Overall"
              value={overallScore}
              onChange={setOverallScore}
            />
          </div>
          <textarea
            value={ratingComment}
            onChange={(e) => setRatingComment(e.target.value)}
            placeholder="Leave a comment..."
            rows={3}
            className="w-full px-4 py-3 text-sm rounded-2xl bg-white dark:bg-[#3B2149] border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-brand-500 resize-none mb-3 shadow-sm"
          />
          {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
          <button
            onClick={() => handleSubmitRating(false)}
            disabled={ratingLoading}
            className="w-full py-4 rounded-2xl bg-action hover:bg-action-hover text-white text-sm font-black disabled:opacity-50 mb-2 shadow-lg shadow-action/30 active:scale-95 transition-all"
          >
            {ratingLoading ? "Submitting..." : "Submit rating"}
          </button>
          <button
            onClick={() => handleSubmitRating(true)}
            className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            Skip for now
          </button>
        </div>
      </div>
    );
  }

  // ─── CLOSED ───────────────────────────────────────────────────────────────
  if (step === "closed") {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#2B1838] flex flex-col items-center justify-center px-4 py-10">
        <div className="w-24 h-24 rounded-full bg-action flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-action/40">
          <CheckCircle size={44} className="text-white" />
        </div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-2">
          Thanks for visiting!
        </h1>
        <p className="text-sm text-gray-400">
          {venueName} · {tableLabel}
        </p>
        <p className="text-sm text-gray-400 mt-3 mb-8">See you next time 👋</p>
        {welcomeRwf > 0 && (
          <div className="w-full max-w-sm mb-4 rounded-2xl border-[1.5px] border-[#FFE08A] bg-[#FFF7E0] px-5 py-4 text-center dark:border-[#4A3A5C] dark:bg-[#2A2035]">
            <p className="text-sm font-black text-[#231A2C] dark:text-[#F4F0F7]">🎉 {fmt(welcomeRwf)} Skuzi money is waiting for you</p>
            <p className="mt-1 text-xs text-[#665A72] dark:text-[#D3CADC]">It comes off your next bill when you pay with Skuzi, at any Skuzi restaurant.</p>
          </div>
        )}
        {tabId && (
          <div className="w-full max-w-sm">
            <InviteOptIn tabId={tabId} />
          </div>
        )}
      </div>
    );
  }

  // ─── MENU ─────────────────────────────────────────────────────────────────
  const categories = Object.keys(menuGrouped);
  const filteredItems = searchQuery.trim()
    ? allItems.filter(
        (i) =>
          i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          i.description?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : null;

  return (
    // Desktop: side-by-side. Mobile: stacked
    <div className="min-h-screen bg-gray-50 dark:bg-[#2B1838] flex flex-col md:flex-row">
      {/* Last step before the first order: the guest's MoMo number */}
      {askPhone && (
        <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/50 px-0 md:px-4" onClick={() => !loading && setAskPhone(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ask-phone-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full md:max-w-sm bg-white dark:bg-[#3B2149] rounded-t-[28px] md:rounded-[28px] px-6 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl"
          >
            <p className="text-xs font-black uppercase tracking-widest text-brand-500 dark:text-[#F2B33A]">Last step</p>
            <h2 id="ask-phone-title" className="mt-1 text-2xl font-black text-gray-900 dark:text-white">Your MoMo number</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">So you can pay your bill from your phone when you're ready.</p>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendFirstOrder()}
              placeholder="078 123 4567"
              autoFocus
              aria-label="Your MTN MoMo or Airtel Money number"
              className="mt-4 w-full px-4 py-3.5 text-lg font-bold tracking-wide rounded-2xl bg-gray-50 dark:bg-[#2B1838] border-2 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none focus:border-brand-500 transition-colors"
            />
            {error && <p role="alert" className="text-sm text-red-500 mt-2">{error}</p>}
            <button
              onClick={sendFirstOrder}
              disabled={loading || orderLoading}
              className="mt-4 w-full py-4 rounded-2xl bg-action hover:bg-action-hover text-white text-base font-black transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-action/30 flex items-center justify-center gap-2"
            >
              {loading || orderLoading ? <><Loader size={16} className="animate-spin" /> Sending…</> : <>Send my order · {fmt(cartTotal)}</>}
            </button>
            <button onClick={() => setAskPhone(false)} disabled={loading} className="mt-2 w-full py-2 text-sm text-gray-400 hover:text-gray-600">
              Not now
            </button>
            <p className="text-[11px] text-gray-400 text-center mt-2">
              By sending, you agree to our{" "}
              <a href={`${import.meta.env.VITE_APP_URL}/privacy.html`} target="_blank" rel="noreferrer" className="underline">Privacy Policy</a>
              {" · "}
              <a href={`${import.meta.env.VITE_APP_URL}/terms.html`} target="_blank" rel="noreferrer" className="underline">Terms</a>.
            </p>
          </div>
        </div>
      )}
      {/* ── LEFT: Menu column ──────────────────────────────────────────────── */}
      <div
        className="flex-1 flex flex-col min-w-0"
        style={{ paddingBottom: (cartCount > 0 ? 84 : 0) + (placedOrders.length > 0 ? 68 : 0) }}
      >
        {/* Header: espresso band with the venue, the table, the waiter and the categories */}
        <div ref={menuHeaderRef} className="sticky top-0 z-10 dark guest-skin bg-gray-900 text-[color:var(--g-text)] rounded-b-[28px] shadow-lg shadow-black/10">
          <div className="px-5 pt-5 pb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <VenueLogo logoUrl={venueLogoUrl} venueName={venueName} size={44} />
                <div className="min-w-0">
                  <h1 className="font-display font-bold text-[22px] leading-tight truncate">{venueName}</h1>
                  <p className="text-[13px] text-[color:var(--g-muted)] truncate">
                    {tableLabel}
                    {waiterName ? ` · ${waiterName} is your waiter` : ""}
                  </p>
                </div>
              </div>
              <ThemeCycleButton className="ml-auto flex-shrink-0 !text-[color:var(--g-muted)] hover:!bg-white/10" />
              {placedOrders.length > 0 && (
                <div className="hidden md:flex gap-2 flex-shrink-0">
                  <button
                    onClick={handleNudge}
                    disabled={nudgeLoading || justNudged}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold bg-action text-action-ink  transition-all ${justNudged ? "skuzi-bounce" : ""}`}
                  >
                    {justNudged ? <Check size={20} strokeWidth={3} /> : <WaveIcon />} Skuzi!
                  </button>
                  <button
                    onClick={handleRequestBill}
                    disabled={billLoading}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-bold border-2 border-white/80 text-[color:var(--g-text)] disabled:opacity-50 transition-all"
                  >
                    <Receipt size={14} /> {billLoading ? "..." : "My bill"}
                  </button>
                </div>
              )}
            </div>

            {(isDemo || isGroupTab) && (
              <div className="flex flex-wrap gap-2 mt-3">
                {isDemo && <span className="inline-flex items-center rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-[color:var(--g-text)]">Demo · no real money</span>}
                {isGroupTab && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-white/10 px-2.5 py-1 rounded-full">
                    <Users size={11} /> Group tab
                  </span>
                )}
              </div>
            )}

            <div className="relative mt-4">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--g-muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search the menu"
                aria-label="Search the menu"
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-2xl bg-white/10 border-0 text-[color:var(--g-text)] placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-[#F2B33A]"
              />
            </div>

            {!searchQuery && (
              <div className="flex gap-2 overflow-x-auto scrollbar-hide mt-3 -mx-1 px-1">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => scrollToCategory(cat)}
                    className={`flex-shrink-0 px-4 py-2 rounded-full text-sm whitespace-nowrap transition-all active:scale-95 ${
                      activeCategory === cat ? "bg-action text-white font-extrabold" : "bg-white/10 text-[color:var(--g-text)] font-semibold"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Menu content */}
        <div className="flex-1 px-4 pt-5 overflow-y-auto">
          {skuziOffer?.text && (
            <div className="mb-5 flex items-center gap-3 rounded-2xl border-[1.5px] border-amber-500/60 bg-amber-50 px-4 py-3 dark:bg-amber-500/10">
              <span className="text-2xl" aria-hidden="true">🎁</span>
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-gray-900 dark:text-white">{skuziOffer.title ?? "Your offer"}: {skuziOffer.text}</p>
                <p className="text-xs text-gray-600 dark:text-gray-300">{skuziOffer.offerType === "discount_10" ? "Taken off automatically when you pay here." : "Show this to your waiter."}</p>
              </div>
            </div>
          )}
          {/* Search results */}
          {filteredItems && (
            <div className="mb-6">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">
                {filteredItems.length} result
                {filteredItems.length !== 1 ? "s" : ""} for "{searchQuery}"
              </p>
              {filteredItems.length === 0 ? (
                <div className="text-center py-12">
                  <span className="text-4xl">🔍</span>
                  <p className="text-sm text-gray-400 mt-3">No items found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {filteredItems.map((item) => (
                    <MenuCard
                      key={item.id}
                      item={item}
                      qty={getQty(item.id)}
                      onAdd={() => addToCart(item)}
                      onRemove={() => removeFromCart(item.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Menu by category */}
          {!filteredItems &&
            categories.map((cat) => (
              <div
                key={cat}
                ref={(el) => {
                  catRefs.current[cat] = el;
                }}
                className="mb-8"
              >
                <div className="flex items-baseline justify-between mb-3 px-1">
                  <h2 className="font-display text-2xl font-bold text-gray-900 dark:text-white">{cat}</h2>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{menuGrouped[cat].length} items</span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {menuGrouped[cat].map((item) => (
                    <MenuCard
                      key={item.id}
                      item={item}
                      qty={getQty(item.id)}
                      onAdd={() => addToCart(item)}
                      onRemove={() => removeFromCart(item.id)}
                    />
                  ))}
                </div>
              </div>
            ))}

          {categories.length === 0 && (
            <div className="text-center py-20">
              <span className="text-5xl">🍽</span>
              <p className="text-sm text-gray-400 mt-4">
                Menu is being set up.
              </p>
            </div>
          )}

          {/* Mobile bottom spacer */}
          <div className="h-44 md:h-8" />
        </div>

        {ordersOpen && (
          <div className="md:hidden fixed inset-0 z-[60] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Your orders">
            <button className="absolute inset-0 bg-black/45" aria-label="Close" onClick={() => setOrdersOpen(false)} />
            <div className="relative bg-white dark:bg-gray-900 rounded-t-3xl max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="h-10 w-10 rounded-full bg-[#FCE3D3] text-[#AE4217] dark:bg-gray-800 dark:text-[#F0763A] flex items-center justify-center"><NotebookPen size={20} /></span>
                  <div>
                    <h2 className="text-lg font-black text-gray-900 dark:text-white leading-tight">Your orders</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{tableLabel} · {placedOrders.length} {placedOrders.length === 1 ? "order" : "orders"}</p>
                  </div>
                </div>
                <button onClick={() => setOrdersOpen(false)} aria-label="Close" className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-300"><X size={18} /></button>
              </div>
              <div className="overflow-y-auto px-5 pb-3 space-y-2.5">
                {placedOrders.map((order, n) => (
                  <div key={order.orderId} className="rounded-2xl border border-gray-200 dark:border-gray-800 px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black uppercase tracking-wider text-gray-400">Order {n + 1}</span>
                      <StatusBadge status={order.status} />
                    </div>
                    {order.items.map((i, k) => (
                      <div key={k} className="flex justify-between gap-3 text-sm py-0.5">
                        <span className="text-gray-800 dark:text-gray-100 min-w-0 truncate">{i.quantity} × {i.name}</span>
                        <span className="text-gray-500 dark:text-gray-400 tabular-nums flex-shrink-0">{fmt(i.quantity * i.unitPriceRwf)}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <div className="px-5 pt-3 pb-5 border-t border-gray-100 dark:border-gray-800" style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-gray-500 dark:text-gray-400">Total so far</span>
                  <span className="text-xl font-black text-gray-900 dark:text-white tabular-nums">{fmt(placedOrders.reduce((n, o) => n + o.total, 0))}</span>
                </div>
                <button
                  onClick={() => { setOrdersOpen(false); handleRequestBill(); }}
                  disabled={billLoading}
                  className="w-full h-[54px] rounded-[18px] bg-action hover:bg-action-hover text-action-ink text-base font-extrabold disabled:opacity-50 active:scale-[0.98] transition-all"
                >
                  {billLoading ? "..." : "My bill"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Phone: Skuzi!, My bill and the orders notepad float on the left, away
            from the "+" buttons on the right of every dish. */}
        {step === "menu" && !ordersOpen && (
          <div
            className={`md:hidden fixed left-4 z-30 flex flex-col items-start gap-2.5 transition-all ${cartCount > 0 ? "bottom-[96px]" : "bottom-5"}`}
            style={{ marginBottom: "env(safe-area-inset-bottom)" }}
          >
            {placedOrders.length > 0 && (
              <>
              <button
                onClick={() => setOrdersOpen(true)}
                aria-label={`Your orders (${placedOrders.length})`}
                className="relative h-12 w-12 rounded-full bg-white dark:bg-gray-600 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-500 shadow-lg shadow-black/25 flex items-center justify-center active:scale-95 transition-all"
              >
                <NotebookPen size={21} strokeWidth={2.2} />
                <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 rounded-full bg-[#FFD966] text-[#231A2C] text-[11px] font-black flex items-center justify-center">
                  {placedOrders.length}
                </span>
              </button>
              <button
                onClick={handleRequestBill}
                disabled={billLoading}
                className="h-12 pl-3.5 pr-4 rounded-full bg-white dark:bg-gray-600 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-500 shadow-lg shadow-black/25 flex items-center gap-2 text-[15px] font-bold disabled:opacity-60 active:scale-95 transition-all"
              >
                <Receipt size={18} /> {billLoading ? "..." : "My bill"}
              </button>
              </>
            )}
            <button
              onClick={handleNudge}
              disabled={nudgeLoading || justNudged}
              className={`h-14 pl-4 pr-5 rounded-full bg-[#C9501E] dark:bg-[#E2602A] text-white shadow-xl shadow-black/25 flex items-center gap-2 text-[17px] font-extrabold active:scale-95 transition-all ${justNudged ? "skuzi-bounce" : ""}`}
            >
              {justNudged ? <Check size={20} strokeWidth={3} /> : <WaveIcon />} Skuzi!
            </button>
          </div>
        )}

        {/* Phone: send the order */}
        {cartCount > 0 && (
          <div className="md:hidden fixed bottom-0 left-0 right-0 px-4 pb-4 pt-3 z-20 bg-gray-50 dark:bg-gray-950 rounded-t-[26px] shadow-[0_-12px_30px_-12px_rgba(35,26,44,0.25)]">
            <button
                onClick={() => setCartOpen(!cartOpen)}
                className="w-full h-[60px] rounded-[20px] bg-action text-white px-5 flex items-center justify-between text-[17px] font-extrabold shadow-xl shadow-action/25 active:scale-[0.98] transition-all"
              >
                <span className="flex items-center gap-2"><ShoppingBag size={18} /> Send order · {cartCount} {cartCount === 1 ? "item" : "items"}</span>
                <span>{fmt(cartTotal)}</span>
              </button>
          </div>
        )}
      </div>

      {/* ── RIGHT: Order summary sidebar (desktop only) ─────────────────────── */}
      <div className="hidden md:flex flex-col w-80 xl:w-96 bg-white dark:bg-[#3B2149] border-l border-gray-200 dark:border-gray-800 sticky top-0 h-screen overflow-hidden flex-shrink-0">
        <div className="px-5 py-5 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-base font-black text-gray-900 dark:text-white">
            Order Summary
          </h2>
          {placedOrders.length > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">
              Your orders ({placedOrders.length})
            </p>
          )}
        </div>

        {/* Placed orders */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {placedOrders.length > 0 && (
            <div className="mb-5">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">
                Placed orders
              </p>
              <div className="space-y-2">
                {placedOrders.map((order) => (
                  <div
                    key={order.orderId}
                    className="bg-gray-50 dark:bg-gray-800/50 rounded-xl px-4 py-3"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <StatusBadge status={order.status} />
                      <span className="text-xs font-black text-brand-500">
                        {fmt(order.total)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {order.items
                        .map((i) => `${i.name} ×${i.quantity}`)
                        .join(", ")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Current cart */}
          {cart.length > 0 ? (
            <div>
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">
                Current order
              </p>
              <div className="space-y-3">
                {cart.map((item) => {
                  const emoji = getCatEmoji(item.category);
                  return (
                    <div key={item.id} className="flex items-center gap-3">
                      <span className="text-xl flex-shrink-0">{emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                          {item.name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {fmt(item.priceRwf)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="w-6 h-6 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center active:scale-90 text-gray-600 dark:text-gray-300"
                        >
                          <Minus size={11} />
                        </button>
                        <span className="text-sm font-black text-gray-900 dark:text-white w-5 text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => addToCart(item)}
                          className="w-6 h-6 rounded-lg bg-action flex items-center justify-center text-white active:scale-90"
                        >
                          <Plus size={11} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <ShoppingBag
                size={32}
                className="text-gray-200 dark:text-gray-700 mx-auto mb-3"
              />
              <p className="text-sm text-gray-400">
                Your order will appear here
              </p>
            </div>
          )}
        </div>

        {/* Order total + confirm */}
        {cart.length > 0 && (
          <div className="px-5 py-5 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold text-gray-500 dark:text-gray-400">
                Total
              </span>
              <span className="text-xl font-black text-brand-500">
                {fmt(cartTotal)}
              </span>
            </div>
            {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
            <button
              onClick={confirmOrder}
              disabled={orderLoading}
              className="w-full py-4 rounded-2xl bg-action hover:bg-action-hover text-white text-sm font-black disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-action/30"
            >
              {orderLoading ? (
                <>
                  <Loader size={15} className="animate-spin" /> Placing...
                </>
              ) : (
                "Confirm Order"
              )}
            </button>
          </div>
        )}

        {/* Desktop nudge/bill */}
        {placedOrders.length > 0 && (
          <div className="px-5 pb-5 flex gap-2">
            <button
              onClick={handleNudge}
              disabled={nudgeLoading || justNudged}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-extrabold bg-[#FCE3D3] text-[#AE4217] dark:bg-gray-800 dark:text-[#F0763A]  transition-all ${justNudged ? "skuzi-bounce" : ""}`}
            >
              {justNudged ? <Check size={20} strokeWidth={3} /> : <WaveIcon />} Skuzi!
            </button>
            <button
              onClick={handleRequestBill}
              disabled={billLoading}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold bg-gray-900 dark:bg-white text-white dark:text-gray-900 disabled:opacity-50 transition-all"
            >
              <Receipt size={13} /> {billLoading ? "..." : "My bill"}
            </button>
          </div>
        )}
      </div>

      {/* ── Mobile cart sheet ─────────────────────────────────────────────── */}
      {cartOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setCartOpen(false)}
          />
          <div className="relative bg-white dark:bg-[#3B2149] rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-black text-gray-900 dark:text-white">
                Your order
              </h3>
              <button
                onClick={() => setCartOpen(false)}
                className="text-gray-400"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4 mb-5">
              {cart.map((item) => {
                const emoji = getCatEmoji(item.category);
                return (
                  <div key={item.id} className="flex items-center gap-3">
                    <span className="text-xl">{emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {item.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {fmt(item.priceRwf)} each
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="w-7 h-7 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center active:scale-90"
                      >
                        <Minus size={13} />
                      </button>
                      <span className="text-sm font-black text-gray-900 dark:text-white w-5 text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => addToCart(item)}
                        className="w-7 h-7 rounded-xl bg-action flex items-center justify-center text-white active:scale-90"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                    <p className="text-sm font-black text-gray-700 dark:text-gray-300 w-20 text-right">
                      {fmt(item.priceRwf * item.quantity)}
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between py-4 border-t border-gray-100 dark:border-gray-800 mb-4">
              <span className="text-sm font-black text-gray-900 dark:text-white">
                Total
              </span>
              <span className="text-xl font-black text-brand-500">
                {fmt(cartTotal)}
              </span>
            </div>
            {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
            <button
              onClick={confirmOrder}
              disabled={orderLoading}
              className="w-full py-4 rounded-2xl bg-action hover:bg-action-hover text-white text-sm font-black disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl shadow-action/30"
            >
              {orderLoading ? (
                <>
                  <Loader size={15} className="animate-spin" /> Placing...
                </>
              ) : (
                "Confirm & place order"
              )}
            </button>
          </div>
        </div>
      )}

      {tabId && placedOrders.length > 0 && tabStatus !== "closed" && !cartOpen && <GuestAlerts tabId={tabId} />}

      {/* Skuzi! toast: same pill as "Order placed!" */}
      {nudgeToast && !justOrdered && (
        <div role="status" className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-black px-6 py-3 rounded-full flex items-center gap-2 shadow-2xl whitespace-nowrap">
          <CheckCircle size={16} className="text-brand-400 dark:text-brand-600" /> Your waiter has been notified 👋
        </div>
      )}

      {/* Order placed toast */}
      {justOrdered && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-black px-6 py-3 rounded-full flex items-center gap-2 shadow-2xl">
          <CheckCircle
            size={16}
            className="text-brand-400 dark:text-brand-600"
          />{" "}
          Order placed!
        </div>
      )}
    </div>
  );
}
