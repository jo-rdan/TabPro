import { useState, useEffect, useMemo } from "react";
import { Users, User, Clock, Receipt, CalendarDays, ChevronLeft, ChevronRight, CheckCircle2, Loader2, RotateCw, Smartphone, Banknote } from "lucide-react";
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

type Payment =
  | { method: "momo"; amountRwf: number; payoutRwf: number | null; payoutStatus: "pending" | "successful" | "failed"; paidAt: string }
  | { method: "other" }
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

const DAY = 24 * 3600_000;
const KIGALI = 2 * 3600_000;

// The bar's night runs 06:00 → 06:00 Kigali time; key it by the evening's date.
function nightKey(offsetDays = 0) {
  const local = new Date(Date.now() + KIGALI - (new Date(Date.now() + KIGALI).getUTCHours() < 6 ? DAY : 0) - offsetDays * DAY);
  return local.toISOString().slice(0, 10);
}

function nightLabel(key: string) {
  if (key === nightKey(0)) return "Tonight";
  if (key === nightKey(1)) return "Last night";
  const d = new Date(`${key}T12:00:00Z`);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

const formatRwf = (n: number) => `${n.toLocaleString()} RWF`;
const formatTime = (d: string) => new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export default function ActivityLog() {
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
    const d = new Date(`${night}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    const key = d.toISOString().slice(0, 10);
    if (key <= today) setNight(key);
  };

  const paid = activity.filter((t) => t.tabStatus === "closed");
  const total = paid.reduce((s, t) => s + t.tabTotal, 0);
  const momo = paid.filter((t) => t.payment?.method === "momo");
  const momoTotal = momo.reduce((s, t) => s + (t.payment?.method === "momo" ? t.payment.amountRwf : 0), 0);
  const otherTotal = total - momo.reduce((s, t) => s + t.tabTotal, 0);
  const received = momo.reduce((s, t) => s + (t.payment?.method === "momo" && t.payment.payoutStatus === "successful" ? t.payment.payoutRwf ?? 0 : 0), 0);
  const onTheWay = momo.filter((t) => t.payment?.method === "momo" && t.payment.payoutStatus !== "successful").length;
  const stillOpen = activity.length - paid.length;

  return (
    <Layout>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">History</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Every bill and payment, night by night · {venue?.name}
          </p>
        </div>
      </div>

      {/* Night picker: the last 7 nights, arrows, and a calendar for older ones */}
      <div className="mb-6 flex items-center gap-2">
        <button onClick={() => shift(-1)} aria-label="Night before" className="flex-shrink-0 w-9 h-9 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#2B201B] text-gray-600 dark:text-gray-300 flex items-center justify-center hover:text-gray-900 dark:hover:text-white">
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
                  : "bg-white dark:bg-[#2B201B] border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
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
        <button onClick={() => shift(1)} disabled={night === today} aria-label="Night after" className="flex-shrink-0 w-9 h-9 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#2B201B] text-gray-600 dark:text-gray-300 flex items-center justify-center hover:text-gray-900 dark:hover:text-white disabled:opacity-40">
          <ChevronRight size={16} />
        </button>
        <label className="relative flex-shrink-0 w-9 h-9 rounded-full bg-brand-500 text-white flex items-center justify-center cursor-pointer" title="Pick a date">
          <CalendarDays size={16} />
          <input
            type="date"
            max={today}
            value={night}
            onChange={(e) => e.target.value && e.target.value <= today && setNight(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer"
            aria-label="Pick a night"
          />
        </label>
      </div>

      {/* The night in numbers */}
      {!loading && !error && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="bg-white dark:bg-[#2B201B] border border-gray-200 dark:border-gray-800 rounded-2xl px-4 py-3.5">
            <p className="text-xs text-gray-500 dark:text-gray-400">Total sales</p>
            <p className="mt-1 font-display text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{total.toLocaleString()} <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">RWF</span></p>
            <p className="text-xs text-gray-400 mt-0.5">{paid.length} paid {paid.length === 1 ? "bill" : "bills"}{stillOpen ? ` · ${stillOpen} still open` : ""}</p>
          </div>
          <div className="bg-white dark:bg-[#2B201B] border border-gray-200 dark:border-gray-800 rounded-2xl px-4 py-3.5">
            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1"><Smartphone size={12} /> Paid with MoMo</p>
            <p className="mt-1 font-display text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{momoTotal.toLocaleString()} <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">RWF</span></p>
            <p className="text-xs text-gray-400 mt-0.5">{momo.length} {momo.length === 1 ? "bill" : "bills"} through Skuzi</p>
          </div>
          <div className="bg-white dark:bg-[#2B201B] border border-gray-200 dark:border-gray-800 rounded-2xl px-4 py-3.5">
            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1"><Banknote size={12} /> Paid another way</p>
            <p className="mt-1 font-display text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{otherTotal.toLocaleString()} <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">RWF</span></p>
            <p className="text-xs text-gray-400 mt-0.5">Cash or at the counter · no fee</p>
          </div>
          <div className="bg-white dark:bg-[#2B201B] border border-green-300/70 dark:border-green-700/50 rounded-2xl px-4 py-3.5">
            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1"><CheckCircle2 size={12} className="text-green-600 dark:text-green-400" /> Received on your MoMo</p>
            <p className="mt-1 font-display text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{received.toLocaleString()} <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">RWF</span></p>
            <p className={`text-xs mt-0.5 ${onTheWay ? "text-amber-700 dark:text-amber-300" : "text-green-600 dark:text-green-400"}`}>
              {onTheWay ? `${onTheWay} ${onTheWay === 1 ? "payout" : "payouts"} on the way` : momo.length ? "All payouts received" : "Your 92% of MoMo bills"}
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

      {!loading && (
        <div className="space-y-4">
          {activity.map((tab) => (
            <div key={tab.tabId} className="bg-white dark:bg-[#2B201B] border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
              {/* Bill header */}
              <div className="px-5 py-3 bg-gray-50 dark:bg-[#1C1511] flex flex-wrap items-center justify-between gap-2">
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

              {/* Where the money went */}
              {tab.payment?.method === "momo" && <PayoutLine payment={tab.payment} />}

              {/* Orders */}
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {tab.orders.map((order) => (
                  <div key={order.orderId} className="px-5 py-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex-shrink-0 flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                          order.source === "customer"
                            ? "bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400"
                            : "bg-[#FBF3E2] text-[#7A5A16] dark:bg-[#D9A441]/10 dark:text-[#E9C77E]"
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

          {activity.length === 0 && !error && (
            <div className="text-center py-16 text-sm text-gray-400 dark:text-gray-500">
              {night === today ? "No bills yet tonight." : "No bills that night."}
            </div>
          )}
        </div>
      )}
      {receiptTabId && <ReceiptModal tabId={receiptTabId} onClose={() => setReceiptTabId(null)} />}
    </Layout>
  );
}

function PaidChip({ tab }: { tab: TabEntry }) {
  if (tab.tabStatus !== "closed") {
    return <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">Still open</span>;
  }
  if (tab.payment?.method === "momo") {
    return <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Paid · MoMo</span>;
  }
  return <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">Paid · cash or other</span>;
}

function PayoutLine({ payment }: { payment: Extract<Payment, { method: "momo" }> }) {
  const amount = payment.payoutRwf != null ? formatRwf(payment.payoutRwf) : "Your 92%";
  const state =
    payment.payoutStatus === "successful"
      ? { icon: <CheckCircle2 size={13} />, text: "on your MoMo", cls: "text-green-700 dark:text-green-400" }
      : payment.payoutStatus === "failed"
      ? { icon: <RotateCw size={13} />, text: "being sent again automatically", cls: "text-amber-700 dark:text-amber-300" }
      : { icon: <Loader2 size={13} className="animate-spin" />, text: "on its way to your MoMo", cls: "text-amber-700 dark:text-amber-300" };
  return (
    <div className={`px-5 py-2 border-b border-gray-100 dark:border-gray-800 text-xs font-semibold flex items-center gap-1.5 ${state.cls}`}>
      {state.icon}
      <span className="tabular-nums">{amount}</span> {state.text}
    </div>
  );
}
