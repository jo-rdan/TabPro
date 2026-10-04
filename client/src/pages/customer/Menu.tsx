import { useState, useEffect, useRef } from "react";
import GuestAlerts from "../../components/GuestAlerts";
import { useParams } from "react-router-dom";
import api from "../../lib/api";
import {
  ShoppingBag,
  Bell,
  Receipt,
  CheckCircle,
  Loader,
  Users,
  X,
  Plus,
  Minus,
  Search,
} from "lucide-react";
import Logo from "../../components/Logo";
import VenueLogo from "../../components/VenueLogo";
import { useWebSocket } from "../../hooks/useWebSocket";
import { WsEvent } from "@tabpro/shared";
import { apiFetch } from "../../lib/apiFetch";

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

// ─── Menu item card with Foodish photo ───────────────────────────────────────
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
      className={`group flex flex-col bg-white dark:bg-[#1C2128] rounded-2xl overflow-hidden transition-all duration-200 ${
        qty > 0
          ? "ring-2 ring-brand-400 shadow-lg shadow-brand-500/10"
          : "ring-1 ring-gray-200 dark:ring-gray-800 hover:ring-gray-300 dark:hover:ring-gray-700 hover:shadow-md"
      } ${!item.isAvailable ? "opacity-60" : ""}`}
    >
      {/* Photo area */}
      <div
        className="relative overflow-hidden bg-gray-100 dark:bg-gray-800"
        style={{ paddingBottom: "65%" }}
      >
        <div className="absolute inset-0">
          {/* Emoji fallback always rendered behind */}
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700">
            <span className="text-5xl opacity-40 select-none">{emoji}</span>
          </div>
          {/* Food photo */}
          {imgUrl && (
            <img
              src={imgUrl}
              alt={item.name}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgUrl("")}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
            />
          )}
          {/* Gradient overlay at bottom for text readability */}
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/30 to-transparent" />
        </div>

        {/* Qty badge */}
        {qty > 0 && (
          <div className="absolute top-2.5 left-2.5 w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-lg z-10">
            <span className="text-xs font-black text-brand-600">{qty}</span>
          </div>
        )}

        {/* Unavailable overlay */}
        {!item.isAvailable && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
            <span className="text-xs font-bold text-white bg-black/70 px-3 py-1.5 rounded-full">
              Unavailable
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col flex-1">
        <p className="text-sm font-bold text-gray-900 dark:text-white leading-snug line-clamp-1">
          {item.name}
        </p>
        {item.description && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 leading-relaxed line-clamp-2">
            {item.description}
          </p>
        )}
        <div className="flex items-center justify-between mt-auto pt-2.5">
          <span className="text-sm font-black text-brand-500">
            {fmt(item.priceRwf)}
          </span>
          {item.isAvailable &&
            (qty === 0 ? (
              <button
                onClick={onAdd}
                className="w-8 h-8 rounded-xl bg-brand-500 hover:bg-brand-600 flex items-center justify-center text-white shadow-md shadow-brand-500/30 active:scale-90 transition-all"
              >
                <Plus size={16} strokeWidth={3} />
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  onClick={onRemove}
                  className="w-7 h-7 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-center active:scale-90 transition-all"
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
                  onClick={onAdd}
                  className="w-7 h-7 rounded-xl bg-brand-500 flex items-center justify-center text-white active:scale-90 transition-all"
                >
                  <Plus size={12} strokeWidth={3} />
                </button>
              </div>
            ))}
        </div>
      </div>
    </div>
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
      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
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
  const [name, setName] = useState("");
  const [tabId, setTabId] = useState<string | null>(null);
  const [tabStatus, setTabStatus] = useState<TabStatus>("open");
  const [venueId, setVenueId] = useState<string | null>(null);
  const [venueName, setVenueName] = useState("");
  const [venueLogoUrl, setVenueLogoUrl] = useState<string | null>(null);
  const [tableLabel, setTableLabel] = useState("");
  const [isGroupTab, setIsGroupTab] = useState(false);
  const [menuGrouped, setMenuGrouped] = useState<
    Record<string, MenuItemData[]>
  >({});
  const [allItems, setAllItems] = useState<MenuItemData[]>([]);
  const [activeCategory, setActiveCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const catRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [placedOrders, setPlacedOrders] = useState<PlacedOrder[]>([]);
  const [orderLoading, setOrderLoading] = useState(false);
  const [justOrdered, setJustOrdered] = useState(false);
  const [nudgeLoading, setNudgeLoading] = useState(false);
  const [justNudged, setJustNudged] = useState(false);
  const [billLoading, setBillLoading] = useState(false);
  const [billLines, setBillLines] = useState<BillLine[]>([]);
  const [grandTotal, setGrandTotal] = useState(0);

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
    if (!saved) return;
    const s = JSON.parse(saved);
    setTabId(s.tabId);
    setTabStatus(s.tabStatus ?? "open");
    setVenueId(s.venueId);
    setVenueName(s.venueName);
    setAcceptsMobileMoney(s.acceptsMobileMoney !== false);
    setIsDemo(!!s.isDemo);
    setTableLabel(s.tableLabel);
    setPhone(s.phone);
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

  const handleIdentify = async () => {
    if (!phone.trim()) {
      setError("Phone number is required.");
      return;
    }
    if (phone.trim().length < 9) {
      setError("Enter a valid phone number.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/tabs/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qrCode,
          phone: phone.trim(),
          name: name.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      const { tab, venue, table, menuGrouped: mg, isExisting } = data.data;
      setTabId(tab.id);
      setTabStatus(tab.status);
      setVenueId(venue.id);
      setVenueName(venue.name);
      if (venue.logoUrl) setVenueLogoUrl(venue.logoUrl);
      setAcceptsMobileMoney(venue.acceptsMobileMoney !== false);
      setIsDemo(!!venue.isDemo);
      setTableLabel(table.label);
      setMenuGrouped(mg);
      setAllItems(Object.values(mg).flat() as MenuItemData[]);
      setActiveCategory(Object.keys(mg)[0] ?? "");
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
          phone: phone.trim(),
          menuGrouped: mg,
        }),
      );
      // Re-scanning a table whose bill is already requested lands on the bill.
      if (tab.status === "bill_requested") {
        fetchBill(tab.id);
        setStep("bill");
      } else {
        setStep("menu");
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
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

  const handlePlaceOrder = async () => {
    if (!cart.length) return;
    setOrderLoading(true);
    try {
      const res = await apiFetch("/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tabId,
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
    if (!tabId || nudgeLoading || justNudged) return;
    setNudgeLoading(true);
    try {
      await apiFetch(`/tabs/${tabId}/nudge`, { method: "POST" });
      setJustNudged(true);
      setTimeout(() => setJustNudged(false), 10000);
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
    return () => clearInterval(interval);
  }, [tabId, tabStatus]);

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
      const res = await api.post(`/tabpayment/${tabId}/pay`, { phone: cleaned });
      setPayReferenceId(res.data.data.depositId);
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
            setPayStep("success");
            setTabStatus("closed");
            saveSession({ tabStatus: "closed" });
            setTimeout(() => setStep("rating"), 2000);
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

  const scrollToCategory = (cat: string) => {
    setActiveCategory(cat);
    catRefs.current[cat]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  // ─── IDENTIFY ─────────────────────────────────────────────────────────────
  if (step === "identify") {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0D1117] flex flex-col items-center justify-center px-4 py-10">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-500 to-teal-500 flex items-center justify-center mx-auto mb-5 shadow-xl shadow-brand-500/30">
            <Logo size={44} />
          </div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white">
            Welcome!
          </h1>
          <p className="text-gray-400 text-sm mt-2">
            Enter your details to start ordering
          </p>
        </div>
        <div className="w-full max-w-sm bg-white dark:bg-[#161B22] rounded-3xl shadow-xl border border-gray-100 dark:border-gray-800 p-7">
          <div className="mb-4">
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
              Phone number *
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleIdentify()}
              placeholder="07XX XXX XXX"
              autoFocus
              className="w-full px-4 py-3.5 text-base rounded-2xl bg-gray-50 dark:bg-[#0D1117] border-2 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none focus:border-brand-500 transition-colors"
            />
          </div>
          <div className="mb-6">
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
              Name <span className="font-normal normal-case">(optional)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleIdentify()}
              placeholder="e.g. Alice"
              className="w-full px-4 py-3.5 text-base rounded-2xl bg-gray-50 dark:bg-[#0D1117] border-2 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none focus:border-brand-500 transition-colors"
            />
          </div>
          {error && <p className="text-sm text-red-500 mb-4 -mt-2">{error}</p>}
          <button
            onClick={handleIdentify}
            disabled={loading}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-brand-500 to-teal-500 text-white text-base font-black transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-brand-500/30"
          >
            {loading ? "Opening tab..." : "Open my tab →"}
          </button>
        </div>
        <p className="text-xs text-gray-400 text-center mt-4">
          By opening a tab you agree to our{" "}
          <a
            href={`${import.meta.env.VITE_APP_URL}/privacy.html`}
            target="_blank"
            className="underline hover:text-gray-500 transition-colors"
          >
            Privacy Policy
          </a>
          {" · "}
          <a
            href={`${import.meta.env.VITE_APP_URL}/terms.html`}
            target="_blank"
            className="underline hover:text-gray-500 transition-colors"
          >
            Terms
          </a>
          .
        </p>
      </div>
    );
  }

  // ─── BILL ─────────────────────────────────────────────────────────────────
  if (step === "bill") {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0D1117]">
        <div className="bg-white dark:bg-[#161B22] border-b border-gray-200 dark:border-gray-800 px-5 py-4 sticky top-0 z-10">
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
                  "radial-gradient(circle at 50% 0%, #f9f6e8 6px, transparent 6px)",
                backgroundSize: "12px 12px",
                backgroundRepeat: "repeat-x",
                backgroundColor: "#d1d5db",
              }}
            />

            <div style={{ background: "#f9f6e8", padding: "0 20px" }}>
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
                  — TabPro Receipt —
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
                  from TabPro, not a fiscal invoice. Your venue must issue you
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
                  Powered by TabPro
                </p>
              </div>
            </div>

            {/* Torn bottom edge */}
            <div
              style={{
                height: 12,
                backgroundImage:
                  "radial-gradient(circle at 50% 100%, #f9f6e8 6px, transparent 6px)",
                backgroundSize: "12px 12px",
                backgroundRepeat: "repeat-x",
                backgroundColor: "#d1d5db",
              }}
            />
          </div>
          {/* Mobile Money payment flow (pawaPay) */}
          {payStep === "idle" && acceptsMobileMoney && (
            <button
              onClick={() => {
                setPayPhone(phone);
                setPayStep("entering_phone");
              }}
              className="w-full flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-600 text-white font-bold py-4 rounded-2xl transition-colors shadow-lg shadow-brand-500/30"
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
            <div className="bg-gray-50 dark:bg-[#161B22] border border-gray-200 dark:border-gray-800 rounded-2xl px-5 py-4 text-center">
              <p className="text-sm font-bold text-gray-800 dark:text-white">Please pay your waiter</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                In-app Mobile Money isn't available at this venue yet.
              </p>
            </div>
          )}

          {payStep === "entering_phone" && (
            <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
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
              {/* Amount */}
              <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
                <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
                  Amount
                </p>
                <p className="text-xl font-black text-gray-900 dark:text-white">
                  {fmt(grandTotal)}
                </p>
              </div>
              {/* Phone */}
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-2">
                  MTN MoMo or Airtel Money number
                </p>
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-[#0D1117] border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3">
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
              {/* Actions */}
              <div className="px-5 py-4 flex flex-col gap-2">
                <button
                  onClick={handleMomoPay}
                  className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-3 rounded-xl transition-colors"
                >
                  Confirm & pay {fmt(grandTotal)}
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
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-2xl px-5 py-6 text-center">
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
                    and approve the Mobile Money request for {fmt(grandTotal)}
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
                {fmt(grandTotal)} received. Your official RRA receipt will be
                issued at the counter.
              </p>
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
      <div className="min-h-screen bg-gray-50 dark:bg-[#0D1117] flex flex-col items-center justify-center px-4">
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
          <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-gray-800 rounded-3xl px-6 py-2 mb-4 shadow-sm">
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
            className="w-full px-4 py-3 text-sm rounded-2xl bg-white dark:bg-[#161B22] border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-brand-500 resize-none mb-3 shadow-sm"
          />
          {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
          <button
            onClick={() => handleSubmitRating(false)}
            disabled={ratingLoading}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-brand-500 to-teal-500 text-white text-sm font-black disabled:opacity-50 mb-2 shadow-lg shadow-brand-500/30 active:scale-95 transition-all"
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
      <div className="min-h-screen bg-gray-50 dark:bg-[#0D1117] flex flex-col items-center justify-center px-4">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-brand-500 to-teal-500 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-brand-500/40">
          <CheckCircle size={44} className="text-white" />
        </div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-2">
          Thanks for visiting!
        </h1>
        <p className="text-sm text-gray-400">
          {venueName} · {tableLabel}
        </p>
        <p className="text-4xl mt-8">👋</p>
        <p className="text-sm text-gray-400 mt-3">See you next time</p>
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
    <div className="min-h-screen bg-gray-50 dark:bg-[#0D1117] flex flex-col md:flex-row">
      {/* ── LEFT: Menu column ──────────────────────────────────────────────── */}
      <div
        className="flex-1 flex flex-col min-w-0"
        style={{ paddingBottom: cartCount > 0 ? 80 : 0 }}
      >
        {/* Sticky header */}
        <div className="bg-white dark:bg-[#161B22] border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10 shadow-sm">
          <div className="px-4 pt-4 pb-3">
            {/* Venue info row */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <VenueLogo
                  logoUrl={venueLogoUrl}
                  venueName={venueName}
                  size={36}
                />
                <div>
                  <h1 className="font-black text-gray-900 dark:text-white text-xl leading-tight">
                    {venueName}
                  </h1>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-400">{tableLabel}</span>
                    {isDemo && <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">Demo · no real money</span>}
                    {isGroupTab && (
                      <span className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 rounded-full font-bold">
                        <Users size={10} /> Group tab
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {/* Desktop nudge/bill — mobile shows in bottom area */}
              {placedOrders.length > 0 && (
                <div className="hidden md:flex gap-2">
                  <button
                    onClick={handleNudge}
                    disabled={nudgeLoading || justNudged}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${justNudged ? "bg-amber-500 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"}`}
                  >
                    <Bell size={12} /> {justNudged ? "Sent!" : "Nudge waiter"}
                  </button>
                  <button
                    onClick={handleRequestBill}
                    disabled={billLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-900 dark:bg-white text-white dark:text-gray-900 disabled:opacity-50 transition-all"
                  >
                    <Receipt size={12} /> {billLoading ? "..." : "Pay bill"}
                  </button>
                </div>
              )}
            </div>

            {/* Search bar */}
            <div className="relative mb-3">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search menu..."
                className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl bg-gray-100 dark:bg-gray-800 border-0 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
              />
            </div>

            {/* Category chips */}
            {!searchQuery && (
              <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-0">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => scrollToCategory(cat)}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 whitespace-nowrap ${
                      activeCategory === cat
                        ? "bg-brand-500 text-white shadow-md shadow-brand-500/30"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    <span>{getCatEmoji(cat)}</span>
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Menu content */}
        <div className="flex-1 px-4 pt-4 overflow-y-auto">
          {tabId && placedOrders.length > 0 && tabStatus !== "closed" && <GuestAlerts tabId={tabId} />}
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
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
                <div className="flex items-center gap-2.5 mb-4">
                  <span className="text-2xl">{getCatEmoji(cat)}</span>
                  <div>
                    <h2 className="text-base font-black text-gray-900 dark:text-white">
                      {cat}
                    </h2>
                    <p className="text-xs text-gray-400">
                      {menuGrouped[cat].length} items
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
          <div className="h-4 md:h-8" />
        </div>

        {/* Mobile nudge/bill bar — only when orders exist */}
        {placedOrders.length > 0 && (
          <div className="md:hidden fixed bottom-16 left-0 right-0 px-4 z-20 pointer-events-none">
            <div className="flex gap-2 justify-end pointer-events-auto">
              <button
                onClick={handleNudge}
                disabled={nudgeLoading || justNudged}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-bold shadow-xl transition-all ${justNudged ? "bg-amber-500 text-white" : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700"}`}
              >
                <Bell size={13} /> {justNudged ? "Sent!" : "Nudge"}
              </button>
              <button
                onClick={handleRequestBill}
                disabled={billLoading}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-bold bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-xl disabled:opacity-50"
              >
                <Receipt size={13} /> {billLoading ? "..." : "Pay bill"}
              </button>
            </div>
          </div>
        )}

        {/* Mobile cart bar */}
        {cartCount > 0 && (
          <div className="md:hidden fixed bottom-0 left-0 right-0 px-4 pb-4 pt-2 bg-gradient-to-t from-gray-50 dark:from-[#0D1117] via-gray-50/90 dark:via-[#0D1117]/90 to-transparent z-20">
            <button
              onClick={() => setCartOpen(!cartOpen)}
              className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl px-5 py-4 flex items-center justify-between shadow-2xl active:scale-98 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <ShoppingBag size={20} />
                  <span className="absolute -top-2.5 -right-2.5 w-5 h-5 bg-brand-500 rounded-full text-[10px] font-black text-white flex items-center justify-center border-2 border-gray-900 dark:border-white">
                    {cartCount}
                  </span>
                </div>
                <span className="text-sm font-black">View order</span>
              </div>
              <span className="text-sm font-black">{fmt(cartTotal)}</span>
            </button>
          </div>
        )}
      </div>

      {/* ── RIGHT: Order summary sidebar (desktop only) ─────────────────────── */}
      <div className="hidden md:flex flex-col w-80 xl:w-96 bg-white dark:bg-[#161B22] border-l border-gray-200 dark:border-gray-800 sticky top-0 h-screen overflow-hidden flex-shrink-0">
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
                          className="w-6 h-6 rounded-lg bg-brand-500 flex items-center justify-center text-white active:scale-90"
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
              onClick={handlePlaceOrder}
              disabled={orderLoading}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-brand-500 to-teal-500 text-white text-sm font-black disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-brand-500/30"
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
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${justNudged ? "bg-amber-500 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"}`}
            >
              <Bell size={13} /> {justNudged ? "Sent!" : "Nudge"}
            </button>
            <button
              onClick={handleRequestBill}
              disabled={billLoading}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold bg-gray-900 dark:bg-white text-white dark:text-gray-900 disabled:opacity-50 transition-all"
            >
              <Receipt size={13} /> {billLoading ? "..." : "Pay bill"}
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
          <div className="relative bg-white dark:bg-[#161B22] rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto">
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
                        className="w-7 h-7 rounded-xl bg-brand-500 flex items-center justify-center text-white active:scale-90"
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
              onClick={handlePlaceOrder}
              disabled={orderLoading}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-brand-500 to-teal-500 text-white text-sm font-black disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl shadow-brand-500/30"
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
