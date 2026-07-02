import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
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
const FOODISH_CATEGORIES = [
  "biryani",
  "burger",
  "butter-chicken",
  "dessert",
  "dosa",
  "idly",
  "pasta",
  "pizza",
  "rice",
  "samosa",
];

function getFoodishCategory(name: string, cat: string): string {
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
  // fallback: pick a deterministic random category based on item name hash
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  return FOODISH_CATEGORIES[Math.abs(hash) % FOODISH_CATEGORIES.length];
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
  const [foodScore, setFoodScore] = useState(0);
  const [waiterScore, setWaiterScore] = useState(0);
  const [overallScore, setOverallScore] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingLoading, setRatingLoading] = useState(false);

  // Close tab via beacon when customer closes the browser/tab
  useEffect(() => {
    if (!tabId) return;
    const apiBase = import.meta.env.VITE_API_URL || '/api';

    const handleUnload = () => {
      // Only send if tab is still open (not already closed/billed)
      if (tabStatus === 'open') {
        navigator.sendBeacon(`${apiBase}/tabs/${tabId}/close`);
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [tabId, tabStatus]);

  useEffect(() => {
    if (!qrCode) return;
    const saved = sessionStorage.getItem(SESSION_KEY(qrCode));
    if (!saved) return;
    const s = JSON.parse(saved);
    setTabId(s.tabId);
    setTabStatus(s.tabStatus ?? "open");
    setVenueId(s.venueId);
    setVenueName(s.venueName);
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
    enabled: !!venueId,
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
      const res = await fetch("/api/tabs/open", {
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
      setTableLabel(table.label);
      setMenuGrouped(mg);
      setAllItems(Object.values(mg).flat());
      setActiveCategory(Object.keys(mg)[0] ?? "");
      setIsGroupTab(isExisting);
      sessionStorage.setItem(
        SESSION_KEY(qrCode!),
        JSON.stringify({
          tabId: tab.id,
          tabStatus: tab.status,
          venueId: venue.id,
          venueName: venue.name,
          tableLabel: table.label,
          phone: phone.trim(),
          menuGrouped: mg,
        }),
      );
      setStep("menu");
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
      const res = await fetch("/api/orders", {
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
      await fetch(`/api/tabs/${tabId}/nudge`, { method: "POST" });
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
      await fetch(`/api/tabs/${tabId}/request-bill`, { method: "POST" });
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

  const fetchBill = async (id: string) => {
    try {
      const res = await fetch(`/api/tabs/${id}/bill`);
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
        await fetch("/api/ratings", {
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
              <h1 className="font-black text-gray-900 dark:text-white text-lg">{venueName}</h1>
              <p className="text-xs text-gray-400 mt-0.5">{tableLabel}</p>
            </div>
          </div>
        </div>
        <div className="px-4 pt-6 pb-10 max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-500 to-teal-500 flex items-center justify-center shadow-lg shadow-brand-500/30">
              <Receipt size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white">
                Your bill
              </h2>
              <p className="text-xs text-gray-400">{billLines.length} items</p>
            </div>
          </div>
          <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-gray-800 rounded-3xl overflow-hidden mb-4 shadow-sm">
            {billLines.map((line, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 last:border-0"
              >
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    {line.name}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {fmt(line.unitPriceRwf)} × {line.quantity}
                  </p>
                </div>
                <p className="text-sm font-black text-gray-900 dark:text-white">
                  {fmt(line.subtotal)}
                </p>
              </div>
            ))}
            <div className="flex items-center justify-between px-5 py-5 bg-gradient-to-r from-brand-500 to-teal-500">
              <p className="text-sm font-bold text-white">Total to pay</p>
              <p className="text-2xl font-black text-white">
                {fmt(grandTotal)}
              </p>
            </div>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl px-5 py-4 flex items-center gap-3">
            <span className="text-2xl">👋</span>
            <p className="text-sm text-amber-800 dark:text-amber-300 font-semibold">
              Your waiter is on the way to collect payment.
            </p>
          </div>
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
                <VenueLogo logoUrl={venueLogoUrl} venueName={venueName} size={36} />
                <div>
                  <h1 className="font-black text-gray-900 dark:text-white text-xl leading-tight">
                    {venueName}
                  </h1>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-400">{tableLabel}</span>
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
                    <Receipt size={12} /> {billLoading ? "..." : "Request bill"}
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
                <Receipt size={13} /> {billLoading ? "..." : "Request bill"}
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
              <Receipt size={13} /> {billLoading ? "..." : "Request bill"}
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
