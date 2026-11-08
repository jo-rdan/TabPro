import { useState, useEffect, useMemo } from "react";
import NightPicker, { HistoryFilters, NO_FILTERS } from "../../components/history/NightPicker";
import { nightKey, nightLabel, addDays } from "../../lib/nights";
import { Users, User, Clock, Receipt, CalendarDays, ChevronLeft, ChevronRight, CheckCircle2, Hourglass, Smartphone, Banknote, X } from "lucide-react";
import Layout from "../../components/Layout";
import { useAuthStore } from "../../lib/auth";
import api from "../../lib/api";
import ReceiptModal from "../../components/ReceiptModal";

interface OrderEntry {
  orderId: string;
  source: "customer" | "staff";
  status: string;
  placedAt: string;
  items: { name: string; quantity: number; unitPriceRwf: number; subtotal: number }[];
  total: number;
}

// "momo" = paid in the app (old model and the demo venue); "momo_direct" = the guest paid the
// venue's MoMo Pay code and staff marked it. Either way, MoMo is what staff or the app recorded.
type Payment =
  | { method: "momo" | "momo_direct"; amountRwf: number; paidAt: string }
  | { method: "cash" | "other" }
  | null;

interface TabEntry {
  tabId: string;
  tableLabel: string;
  tabStatus: string;
  openedAt: string;
  closedAt: string | null;
  orders: OrderEntry[];
  tabTotal: number;
  payment: Payment;
}

const formatRwf = (n: number) => `${n.toLocaleString()} RWF`;
const formatTime = (d: string) => new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

// embedded: the "Every bill" side of Reports.
export default function ActivityLog({ embedded = false }: { embedded?: boolean }) {
  const { venues, fetchMe } = useAuthStore();
  const venue = venues[0];
  useEffect(() => {
    if (!venue) fetchMe();
  }, []);

  const today = nightKey(0);
  const [night, setNight] = useState(today);
  const [activity, setActivity] = useState<TabEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [receiptTabId, setReceiptTabId] = useState<string | null>(null);
  const strip = useMemo(() => Array.from({ length: 7 }, (_, i) => nightKey(i)), [today]);

  useEffect(() => {
    if (!venue) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    api
      .get(`/dashboard/activity/${venue.id}`, { params: night === today ? {} : { night } })
      .then((res) => { if (!cancelled) setActivity(res.data.data); })
      .catch(() => { if (!cancelled) setError("Couldn't load that night. Check your connection and try again."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [venue, night, today]);

  const shift = (days: number) => {
    const key = addDays(night, days);
    if (key <= today) setNight(key);
  };
  const [pickerOpen, setPickerOpen] = useState(false);
  const [filters, setFilters] = useState<HistoryFilters>(NO_FILTERS);
  const isMomo = (t: TabEntry) => t.payment?.method === "momo" || t.payment?.method === "momo_direct";
  const filtered = activity.filter((t) => {
    if (filters.pay === "momo" && !isMomo(t)) return false;
    if (filters.pay === "other" && t.payment?.method !== "cash") return false;
    if (filters.pay === "open" && t.tabStatus === "closed") return false;
    return true;
  });
  const filterLabels = [
    filters.pay === "momo" && "MoMo only",
    filters.pay === "other" && "Cash only",
    filters.pay === "open" && "Not paid yet only",
  ].filter(Boolean) as string[];

  const paid = activity.filter((t) => t.tabStatus === "closed");
  const total = paid.reduce((s, t) => s + t.tabTotal, 0);
  const momo = paid.filter(isMomo);
  const momoTotal = momo.reduce((s, t) => s + t.tabTotal, 0);
  const cash = paid.filter((t) => t.payment?.method === "cash");
  const cashTotal = cash.reduce((s, t) => s + t.tabTotal, 0);
  const open = activity.filter((t) => t.tabStatus !== "closed");
  const openTotal = open.reduce((s, t) => s + t.tabTotal, 0);
  const bills = (n: number) => `${n} ${n === 1 ? "bill" : "bills"}`;

  const page = (
    <>
      {!embedded && <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">History</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Every bill and payment, night by night · {venue?.name}
          </p>
        </div>
      </div>}

      {/* Night picker: the last 7 nights, arrows, and a calendar for older ones */}
      <div className="mb-6 flex items-center gap-2">
        <button onClick={() => shift(-1)} aria-label="Night before" className="flex-shrink-0 w-9 h-9 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#3B2149] text-gray-600 dark:text-gray-300 flex items-center justify-center hover:text-gray-900 dark:hover:text-white">
          <ChevronLeft size={16} />
        </button>
        <div className="no-scrollbar flex-1 min-w-0 flex gap-2 overflow-x-auto">
          {strip.map((key) => (
            <button
              key={key}
              onClick={() => setNight(key)}
              className={`flex-shrink-0 px-3.5 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                night === key
                  ? "bg-gray-900 text-gray-50 dark:bg-gray-100 dark:text-gray-900"
                  : "bg-white dark:bg-[#3B2149] border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              {nightLabel(key)}
            </button>
          ))}
          {!strip.includes(night) && (
            <span className="flex-shrink-0 px-3.5 py-2 rounded-full text-sm font-semibold bg-gray-900 text-gray-50 dark:bg-gray-100 dark:text-gray-900 whitespace-nowrap">
              {nightLabel(night)}
            </span>
          )}
        </div>
        <button onClick={() => shift(1)} disabled={night === today} aria-label="Night after" className="flex-shrink-0 w-9 h-9 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#3B2149] text-gray-600 dark:text-gray-300 flex items-center justify-center hover:text-gray-900 dark:hover:text-white disabled:opacity-40">
          <ChevronRight size={16} />
        </button>
        <button
          onClick={() => setPickerOpen(true)}
          className="relative flex-shrink-0 w-9 h-9 rounded-full bg-brand-500 text-white flex items-center justify-center hover:bg-brand-600"
          title="Calendar and filters"
          aria-label="Open calendar and filters"
        >
          <CalendarDays size={16} />
          {filterLabels.length > 0 && <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-[#F2B33A] ring-2 ring-gray-50 dark:ring-[#2B1838]" />}
        </button>
      </div>

      {/* The night in numbers */}
      {!loading && !error && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="bg-white dark:bg-[#3B2149] border border-gray-200 dark:border-gray-800 rounded-2xl px-4 py-3.5">
            <p className="text-xs text-gray-500 dark:text-gray-400">Total sales</p>
            <p className="mt-1 font-display text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{total.toLocaleString()} <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">RWF</span></p>
            <p className="text-xs text-gray-400 mt-0.5">{bills(paid.length)} marked paid</p>
          </div>
          <div className="bg-white dark:bg-[#3B2149] border border-gray-200 dark:border-gray-800 rounded-2xl px-4 py-3.5">
            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1"><Smartphone size={12} /> Paid with MoMo</p>
            <p className="mt-1 font-display text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{momoTotal.toLocaleString()} <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">RWF</span></p>
            <p className="text-xs text-gray-400 mt-0.5">{bills(momo.length)} · marked by staff</p>
          </div>
          <div className="bg-white dark:bg-[#3B2149] border border-gray-200 dark:border-gray-800 rounded-2xl px-4 py-3.5">
            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1"><Banknote size={12} /> Paid in cash</p>
            <p className="mt-1 font-display text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{cashTotal.toLocaleString()} <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">RWF</span></p>
            <p className="text-xs text-gray-400 mt-0.5">{bills(cash.length)} · marked by staff</p>
          </div>
          <div className={`bg-white dark:bg-[#3B2149] border rounded-2xl px-4 py-3.5 ${open.length ? "border-amber-300/80 dark:border-amber-700/50" : "border-green-300/70 dark:border-green-700/50"}`}>
            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              {open.length ? <Hourglass size={12} className="text-amber-600 dark:text-amber-400" /> : <CheckCircle2 size={12} className="text-green-600 dark:text-green-400" />} Not paid yet
            </p>
            <p className="mt-1 font-display text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{openTotal.toLocaleString()} <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">RWF</span></p>
            <p className={`text-xs mt-0.5 ${open.length ? "text-amber-700 dark:text-amber-300" : "text-green-600 dark:text-green-400"}`}>
              {open.length ? `${bills(open.length)} still open` : "Every bill is marked paid"}
            </p>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

      {/* Active filters */}
      {filterLabels.length > 0 && !loading && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {filterLabels.map((l) => (
            <span key={l} className="inline-flex items-center gap-1 rounded-full bg-brand-50 dark:bg-brand-900/20 px-3 py-1 text-xs font-semibold text-brand-700 dark:text-brand-300">{l}</span>
          ))}
          <button onClick={() => setFilters(NO_FILTERS)} className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-900 dark:hover:text-white">
            <X size={12} /> Clear · showing {filtered.length} of {activity.length}
          </button>
        </div>
      )}

      {!loading && (
        <div className="space-y-4">
          {filtered.map((tab) => (
            <div key={tab.tabId} className="bg-white dark:bg-[#3B2149] border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
              {/* Bill header */}
              <div className="px-5 py-3 bg-gray-50 dark:bg-[#2B1838] flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{tab.tableLabel}</span>
                  <PaidChip tab={tab} />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <Clock size={11} />
                    {formatTime(tab.openedAt)}
                    {tab.closedAt && ` → ${formatTime(tab.closedAt)}`}
                  </span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">{formatRwf(tab.tabTotal)}</span>
                  <button onClick={() => setReceiptTabId(tab.tabId)} className="flex items-center gap-1 text-xs text-brand-500 hover:underline" title="Open receipt">
                    <Receipt size={12} />
                    Receipt
                  </button>
                </div>
              </div>

              {/* Orders */}
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {tab.orders.map((order) => (
                  <div key={order.orderId} className="px-5 py-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex-shrink-0 flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                          order.source === "customer"
                            ? "bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400"
                            : "bg-[#FFF7E0] text-[#7A5A16] dark:bg-[#F2B33A]/10 dark:text-[#FFD15C]"
                        }`}
                      >
                        {order.source === "customer" ? <User size={10} /> : <Users size={10} />}
                        {order.source === "customer" ? "Guest" : "Waiter"}
                      </div>
                      <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                        {order.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs text-gray-400">{formatTime(order.placedAt)}</span>
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400 tabular-nums">{formatRwf(order.total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {filtered.length === 0 && !error && (
            <div className="text-center py-16 text-sm text-gray-400 dark:text-gray-500">
              {activity.length > 0 ? "No bills match these filters." : night === today ? "No bills yet tonight." : "No bills that night."}
            </div>
          )}
        </div>
      )}
      {pickerOpen && venue && (
        <NightPicker
          venueId={venue.id}
          night={night}
          filters={filters}
          onClose={() => setPickerOpen(false)}
          onApply={(n, f) => { setNight(n); setFilters(f); setPickerOpen(false); }}
        />
      )}
      {receiptTabId && <ReceiptModal tabId={receiptTabId} onClose={() => setReceiptTabId(null)} />}
    </>
  );
  return embedded ? page : <Layout>{page}</Layout>;
}

function PaidChip({ tab }: { tab: TabEntry }) {
  if (tab.tabStatus !== "closed") {
    return <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">Not paid yet</span>;
  }
  if (tab.payment?.method === "momo" || tab.payment?.method === "momo_direct") {
    return <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Paid · MoMo</span>;
  }
  return <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">{tab.payment?.method === "cash" ? "Paid · cash" : "Paid"}</span>;
}
