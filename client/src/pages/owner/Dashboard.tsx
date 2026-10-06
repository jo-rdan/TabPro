import { Fragment, useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Users, Clock, Star, ChevronLeft, ChevronRight, BellRing, CreditCard, X, PhoneOff } from 'lucide-react';
import MoneyTonight from '../../components/dashboard/MoneyTonight';
import CoinJar from '../../components/dashboard/CoinJar';
import OpenBills from '../../components/OpenBills';
import Layout from '../../components/Layout';
import ReceiptModal from '../../components/ReceiptModal';
import JoinRequests from '../../components/JoinRequests';
import LogoUploader from '../../components/LogoUploader';
import { useAuthStore } from '../../lib/auth';
import { useThemeStore } from '../../lib/theme';
import { useWebSocket } from '../../hooks/useWebSocket';
import { WsEvent } from '@tabpro/shared';
import Toast from '../../components/Toast';
import api from '../../lib/api';
import { usePushNotifications, useKeepPushSubscribed } from '../../hooks/usePushNotifications';
import NotificationNotice from '../../components/NotificationNotice';

interface Stats {
  revenueTonight: number;
  activeTables: number;
  pendingOrders: number;
  avgRatingToday: number | null;
  ratingCount: number;
}

interface Summary {
  closedTabs: number;
  totalOrders: number;
  topItems: { name: string; quantity: number }[];
}

interface LiveOrder {
  orderId: string;
  tableLabel: string;
  source: 'customer' | 'staff';
  status: string;
  placedAt: string;
  items: { name: string; quantity: number }[];
  total: number;
}

interface DashboardAlert {
  id: string;
  type: 'nudge' | 'bill' | 'away' | 'seated';
  tableLabel: string;
  tabId: string;
  timestamp: string;
}

interface LeaderboardEntry {
  staffId: string;
  name: string;
  totalPoints: number;
  avgRating: number | null;
  ratingCount: number;
}

interface Tonight {
  total: number;
  hourly: { hour: string; cumulative: number }[];
  lastSameNight: number;
  lastSameNightSoFar: number;
  bestNight: number;
  nightsWithData: number;
}

interface BusyHours {
  cells: { count: number }[][];
  maxCount: number;
  hours: number[];
  days: string[];
}

const SLIDES = ["Tonight's summary", 'Busy hours', 'Staff leaderboard'];
const SLIDE_HOURS = [17, 18, 19, 20, 21, 22, 23, 0, 1];
const HEAT = [
  'bg-gray-100 dark:bg-gray-800',
  'bg-[#E6CFA9] dark:bg-[#6B5233]',
  'bg-skuzi-honey',
  'bg-[#B8703F]',
  'bg-brand-500',
];
const BAR_COLOURS = ['bg-gray-900 dark:bg-gray-100', 'bg-brand-500', 'bg-skuzi-honey'];
const slideClass =
  'snap-start flex-[0_0_88%] sm:flex-[0_0_82%] min-w-0 bg-white dark:bg-[#2B201B] border border-gray-200 dark:border-gray-800 rounded-[22px] px-5 py-4 flex flex-col gap-3 min-h-[232px]';
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function shortRwf(n: number) {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`;
}

// Kigali time (UTC+2), with the bar's night starting at 06:00: Mon=0 … Sun=6.
function kigaliClock() {
  const local = new Date(Date.now() + 2 * 3600_000);
  const night = new Date(local.getTime() - 6 * 3600_000);
  const js = night.getUTCDay();
  return {
    day: js === 0 ? 6 : js - 1,
    hour: local.getUTCHours(),
    weekday: WEEKDAYS[night.getUTCDay()],
    label: `${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][local.getUTCDay()]} ${String(local.getUTCHours()).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(2, '0')}`,
  };
}

function formatRwf(n: number) {
  return `${n.toLocaleString()} RWF`;
}

function timeAgo(d: string) {
  const diff = Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 1000));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function Dashboard() {
  const { owner, venues, fetchMe, token } = useAuthStore();
  const isDark = useThemeStore((s) => s.theme === 'dark');
  const venue = venues[0];

  const [stats, setStats] = useState<Stats | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [liveOrders, setLiveOrders] = useState<LiveOrder[]>([]);
  const [receiptTabId, setReceiptTabId] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [joinRefresh, setJoinRefresh] = useState(0);
  const [tonight, setTonight] = useState<Tonight | null>(null);
  const [busy, setBusy] = useState<BusyHours | null>(null);
  const [slide, setSlide] = useState(0);
  const [kigaliNow, setKigaliNow] = useState(kigaliClock);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => setKigaliNow(kigaliClock()), 30_000);
    return () => clearInterval(id);
  }, []);

  const goToSlide = (i: number) => {
    const t = trackRef.current;
    const child = t?.children[i] as HTMLElement | undefined;
    if (t && child) t.scrollTo({ left: child.offsetLeft - t.offsetLeft, behavior: 'smooth' });
  };
  const onTrackScroll = () => {
    const t = trackRef.current;
    if (!t) return;
    let best = 0, dist = Infinity;
    Array.from(t.children).forEach((c, i) => {
      const d = Math.abs((c as HTMLElement).offsetLeft - t.offsetLeft - t.scrollLeft);
      if (d < dist) { dist = d; best = i; }
    });
    if (best !== slide) setSlide(best);
  };

  // Push notifications — no staffId means the server correctly files this
  // subscription under the owner, not a staff member.
  const { isSupported, permission, subscribe } = usePushNotifications();
  const [pushDismissed, setPushDismissed] = useState(false);
  const [pushError, setPushError] = useState(false);
  const showPushBanner = isSupported && !pushDismissed && (permission === 'default' || pushError);
  useKeepPushSubscribed(venue ? { venueId: venue.id } : null);
  const handleEnablePush = async () => {
    if (!venue) return;
    const ok = await subscribe({ venueId: venue.id });
    if (ok) {
      setPushDismissed(true);
      setPushError(false);
    } else {
      setPushError(true);
    }
  };

  useEffect(() => {
    if (!owner) fetchMe();
  }, []);

  const fetchStats = useCallback(async () => {
    if (!venue) return;
    try {
      const [statsRes, lbRes, reportRes, tonightRes, busyRes] = await Promise.all([
        api.get(`/dashboard/stats/${venue.id}`),
        api.get(`/ratings/leaderboard/${venue.id}`),
        api.get(`/dashboard/report/${venue.id}`),
        api.get(`/dashboard/tonight/${venue.id}`),
        api.get(`/dashboard/busy-hours/${venue.id}`),
      ]);
      setStats(statsRes.data.data);
      setTonight(tonightRes.data.data);
      setBusy(busyRes.data.data);
      const report = reportRes.data.data;
      const counts = new Map<string, number>();
      for (const tab of report.activity) {
        for (const order of tab.orders) {
          for (const item of order.items) {
            counts.set(item.name, (counts.get(item.name) ?? 0) + item.quantity);
          }
        }
      }
      setSummary({
        closedTabs: report.closedTabs,
        totalOrders: report.totalOrders,
        topItems: [...counts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([name, quantity]) => ({ name, quantity })),
      });
      setLeaderboard(lbRes.data.data.slice(0, 5));
    } catch {
      // silent
    } finally {
      setStatsLoading(false);
    }
  }, [venue]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Refresh stats every 60 seconds
  useEffect(() => {
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const fetchLiveOrders = useCallback(async () => {
    if (!venue) return;
    try {
      const res = await api.get(`/orders/venue/${venue.id}`);
      const flat: LiveOrder[] = [];
      for (const tab of res.data.data) {
        for (const order of tab.orders) {
          if (order.status === 'delivered') continue;
          flat.push({
            orderId: order.id,
            tableLabel: tab.table.label,
            source: order.source,
            status: order.status,
            placedAt: order.placedAt,
            items: order.items.map((i: any) => ({ name: i.menuItem.name, quantity: i.quantity })),
            total: order.items.reduce((s: number, i: any) => s + i.unitPriceRwf * i.quantity, 0),
          });
        }
      }
      // Newest first
      flat.sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime());
      setLiveOrders(flat.slice(0, 20));
    } catch {
      // Non-fatal — live orders will still populate from the websocket as new ones arrive
    }
  }, [venue]);

  useEffect(() => { fetchLiveOrders(); }, [fetchLiveOrders]);

  // Live orders via WebSocket
  useWebSocket({
    venueId: venue?.id ?? '',
    token: token ?? undefined,
    enabled: !!venue,
    onEvent: (event: WsEvent) => {
      if (event.type === 'new_order') {
        const p = event.payload as any;
        setLiveOrders((prev) => {
          if (prev.find((o) => o.orderId === p.orderId)) return prev;
          return [{
            orderId: p.orderId,
            tableLabel: p.tableLabel,
            source: p.source,
            status: 'pending',
            placedAt: p.placedAt,
            items: p.items,
            total: p.total,
          }, ...prev.slice(0, 19)];
        });
        setStats((prev) => prev ? { ...prev, pendingOrders: prev.pendingOrders + 1 } : prev);
      }
      if (event.type === 'order_status_update') {
        const { orderId, status } = event.payload as any;
        setLiveOrders((prev) => prev.map((o) => o.orderId === orderId ? { ...o, status } : o));
        if (status === 'delivered') {
          setStats((prev) => prev ? { ...prev, pendingOrders: Math.max(0, prev.pendingOrders - 1) } : prev);
        }
      }
      if (event.type === 'tab_closed') {
        setStats((prev) => prev ? { ...prev, activeTables: Math.max(0, prev.activeTables - 1) } : prev);
        fetchStats();
      }
      if (event.type === 'tab_opened') {
        const p = event.payload as any;
        const alert: DashboardAlert = {
          id: `seated-${p.tabId}`,
          type: 'seated',
          tableLabel: p.tableLabel,
          tabId: p.tabId,
          timestamp: event.timestamp,
        };
        setStats((prev) => prev ? { ...prev, activeTables: prev.activeTables + 1 } : prev);
        setAlerts((prev) => [alert, ...prev.slice(0, 9)]);
        // Informational only — clears itself after 20s
        setTimeout(() => setAlerts((prev) => prev.filter((a) => a.id !== alert.id)), 20_000);
      }
      if (event.type === 'new_nudge') {
        const p = event.payload as any;
        const alert: DashboardAlert = {
          id: `nudge-${p.tabId}-${Date.now()}`,
          type: 'nudge',
          tableLabel: p.tableLabel,
          tabId: p.tabId,
          timestamp: event.timestamp,
        };
        setAlerts((prev) => [alert, ...prev.slice(0, 9)]);
        // Auto-dismiss after 60s
        setTimeout(() => setAlerts((prev) => prev.filter((a) => a.id !== alert.id)), 60_000);
      }
      if (event.type === 'bill_requested') {
        const p = event.payload as any;
        const alert: DashboardAlert = {
          id: `bill-${p.tabId}-${Date.now()}`,
          type: 'bill',
          tableLabel: p.tableLabel,
          tabId: p.tabId,
          timestamp: event.timestamp,
        };
        setAlerts((prev) => [alert, ...prev.slice(0, 9)]);
      }
      if (event.type === 'tab_paid') {
        const p = event.payload as any;
        setToast(`💰 ${p.tableLabel} paid ${p.grandTotal?.toLocaleString()} RWF — payout of ${p.venuePayout?.toLocaleString()} RWF on its way to your Mobile Money`);
        setAlerts((prev) => prev.filter((a) => a.tabId !== p.tabId));
      }
      if (event.type === 'staff_join_request') {
        const p = event.payload as any;
        setJoinRefresh((n) => n + 1);
        setToast(`👋 ${p.name} wants to join your team`);
      }
      // A closed page isn't a guest who left: show a quiet sign until they
      // come back or the bill is settled.
      if (event.type === 'customer_away') {
        const p = event.payload as any;
        const alert: DashboardAlert = {
          id: `away-${p.tabId}`,
          type: 'away',
          tableLabel: p.tableLabel,
          tabId: p.tabId,
          timestamp: event.timestamp,
        };
        setAlerts((prev) => [alert, ...prev.filter((a) => a.id !== alert.id).slice(0, 9)]);
      }
      if (event.type === 'customer_back') {
        const p = event.payload as any;
        setAlerts((prev) => prev.filter((a) => a.id !== `away-${p.tabId}`));
      }
    },
  });

  const statCards = [
    {
      label: 'Revenue tonight',
      value: tonight ? tonight.total.toLocaleString() : stats ? stats.revenueTonight.toLocaleString() : '—',
      unit: stats ? 'RWF' : undefined,
      icon: TrendingUp,
      color: 'text-brand-500',
    },
    {
      label: 'Active tables',
      value: stats?.activeTables ?? '—',
      icon: Users,
      color: 'text-gray-500 dark:text-gray-400',
    },
    {
      label: 'Pending orders',
      value: stats?.pendingOrders ?? '—',
      icon: Clock,
      color: 'text-skuzi-honey',
    },
    {
      label: 'Avg rating today',
      value: stats?.avgRatingToday ? `${stats.avgRatingToday} ★` : '—',
      sub: stats?.ratingCount ? `${stats.ratingCount} ratings` : undefined,
      icon: Star,
      color: 'text-skuzi-honey',
    },
  ] as { label: string; value: string | number; unit?: string; sub?: string; icon: typeof Star; color: string }[];

  // The jar's ring: the best night once there's history, else last week.
  const jarBenchmark = tonight && tonight.bestNight > 0
    ? { value: tonight.bestNight, label: `Best: ${shortRwf(tonight.bestNight)}`, name: 'your best night' }
    : { value: 0, label: '', name: '' };
  const comparison = tonight && tonight.lastSameNightSoFar > 0
    ? (() => {
        const pct = Math.round(((tonight.total - tonight.lastSameNightSoFar) / tonight.lastSameNightSoFar) * 100);
        return { up: pct >= 0, text: `${pct >= 0 ? '+' : ''}${pct}% vs last ${kigaliNow.weekday} at this time` };
      })()
    : tonight && tonight.total > 0
    ? { up: true, text: `${formatRwf(tonight.total)} so far` }
    : null;
  const busiestHour = (() => {
    if (!tonight || tonight.hourly.length === 0) return null;
    let best = -1, label: string | null = null;
    tonight.hourly.forEach((h, i) => {
      const added = h.cumulative - (tonight.hourly[i - 1]?.cumulative ?? 0);
      if (added > best && added > 0) { best = added; label = h.hour; }
    });
    return label;
  })();
  const visibleOrders = [...new Map(liveOrders.map((o) => [o.orderId, o])).values()].filter((o) => o.status !== 'delivered');

  return (
    <Layout wide>
      {toast && <Toast message={toast} duration={6000} onDismiss={() => setToast(null)} />}
      <div className="mb-5 flex items-center gap-4 pb-4 border-b border-gray-200 dark:border-gray-800">
        <LogoUploader
          venueName={venue?.name ?? ''}
          currentLogoUrl={venue?.logoUrl}
          onUploaded={async (url) => {
            if (venue?.id) {
              await api.patch(`/venues/${venue.id}/logo`, { logoUrl: url });
              await fetchMe();
            }
          }}
        />
        <div className="flex flex-col gap-1">
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 tracking-[0.14em] uppercase">
            {owner ? `Welcome back, ${owner.name.split(' ')[0]}` : 'Dashboard'}
          </p>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight leading-none">
            {venue?.name ?? 'Your venue'}
          </h1>
          {venue?.isDemo && (
            <span className="mt-2 inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/40 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-300">
              Demo venue · payments are simulated
            </span>
          )}
        </div>
        <span className="ml-auto hidden sm:inline-flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          Live · {kigaliNow.label}
        </span>
      </div>

      {/* Notices and to-do cards sit side by side on computers */}
      <div className="grid gap-4 mb-4 items-start lg:grid-cols-2 empty:hidden [&>*]:!mb-0 lg:[&>*:only-child]:col-span-2">
      <NotificationNotice />

      {/* ── Push notification opt-in ────────────────────────────────────── */}
      {showPushBanner && (
        <div
          className={`border rounded-xl px-4 py-3 mb-5 flex items-center justify-between ${
            pushError
              ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
              : 'bg-brand-50 dark:bg-brand-900/20 border-brand-200 dark:border-brand-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <BellRing size={16} className={pushError ? 'text-red-500' : 'text-brand-500'} />
            <p className={`text-xs font-medium ${pushError ? 'text-red-700 dark:text-red-300' : 'text-brand-700 dark:text-brand-300'}`}>
              {pushError
                ? "Couldn't enable notifications — check your connection and try again"
                : 'Turn on notifications to hear about orders, waiter calls and payments, even when Skuzi is closed'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleEnablePush}
              className={`text-xs px-3 py-1.5 text-white rounded-lg font-medium transition-colors ${pushError ? 'bg-red-500 hover:bg-red-600' : 'bg-brand-500 hover:bg-brand-600'}`}
            >
              {pushError ? 'Retry' : 'Enable'}
            </button>
            <button
              onClick={() => setPushDismissed(true)}
              className={pushError ? 'text-red-400 hover:text-red-600' : 'text-brand-400 hover:text-brand-600'}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {venue && <JoinRequests venueId={venue.id} refreshKey={joinRefresh} />}

      </div>

      {/* ── Live alerts: guests seated, nudges & bill requests ──────────── */}
      {alerts.length > 0 && (
        <div className="space-y-2 mb-5">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`flex items-center justify-between px-4 py-3 rounded-2xl border ${
                alert.type === 'bill'
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200/70 dark:border-green-700/40'
                  : alert.type === 'seated'
                  ? 'bg-white dark:bg-[#2B201B] border-gray-200 dark:border-gray-800'
                  : alert.type === 'away'
                  ? 'bg-white dark:bg-[#2B201B] border-gray-200 dark:border-gray-800'
                  : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200/70 dark:border-amber-700/40'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  alert.type === 'bill'
                    ? 'bg-green-100 dark:bg-green-900/40'
                    : alert.type === 'seated'
                    ? 'bg-brand-50 dark:bg-brand-900/30'
                    : alert.type === 'away'
                    ? 'bg-gray-100 dark:bg-gray-800'
                    : 'bg-amber-100 dark:bg-amber-900/40'
                }`}>
                  {alert.type === 'bill'
                    ? <CreditCard size={15} className="text-green-600 dark:text-green-400" />
                    : alert.type === 'seated'
                    ? <Users size={15} className="text-brand-600 dark:text-brand-400" />
                    : alert.type === 'away'
                    ? <PhoneOff size={15} className="text-gray-500 dark:text-gray-400" />
                    : <BellRing size={15} className="text-amber-600 dark:text-amber-400" />
                  }
                </div>
                <div>
                  <p className={`text-sm font-bold ${
                    alert.type === 'bill'
                      ? 'text-green-800 dark:text-green-300'
                      : alert.type === 'seated'
                      ? 'text-gray-900 dark:text-white'
                      : alert.type === 'away'
                      ? 'text-gray-900 dark:text-white'
                      : 'text-amber-800 dark:text-amber-300'
                  }`}>
                    {alert.tableLabel} — {alert.type === 'bill' ? 'Wants to pay' : alert.type === 'seated' ? 'Guests seated' : alert.type === 'away' ? 'Phone closed · bill still open' : 'Needs attention'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(alert.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                {alert.type === 'bill' && (
                  <button
                    onClick={() => setReceiptTabId(alert.tabId)}
                    className="text-xs font-semibold text-green-700 dark:text-green-300 underline underline-offset-2 hover:no-underline"
                  >
                    Receipt
                  </button>
                )}
                <button
                  onClick={() => setAlerts((prev) => prev.filter((a) => a.id !== alert.id))}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white dark:bg-[#2B201B] border border-gray-200 dark:border-gray-800 rounded-2xl px-4 py-3.5">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 dark:text-gray-400">{card.label}</p>
                <Icon size={15} className={card.color} />
              </div>
              <p className="mt-1 font-display text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                {statsLoading ? <span className="text-gray-300 dark:text-gray-600">—</span> : card.value}
                {!statsLoading && card.unit && <span className="ml-1 text-sm font-semibold text-gray-500 dark:text-gray-400">{card.unit}</span>}
              </p>
              {card.sub && <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>}
            </div>
          );
        })}
        {venue && <OpenBills venueId={venue.id} className="col-span-2 lg:col-span-1" />}
      </div>

      {/* Money tonight + coin jar */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
        <div className="lg:col-span-3 bg-white dark:bg-[#2B201B] border border-gray-200 dark:border-gray-800 rounded-[22px] px-5 pt-4 pb-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Money tonight</h2>
            {comparison && (
              <span className={`text-xs font-bold ${comparison.up ? 'text-green-500 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                {comparison.text}
              </span>
            )}
          </div>
          {tonight && tonight.total > 0 ? (
            <MoneyTonight hourly={tonight.hourly} />
          ) : (
            <div className="h-[180px] flex flex-col items-center justify-center text-center">
              <TrendingUp size={22} className="text-gray-300 dark:text-gray-600 mb-2" />
              <p className="text-sm text-gray-400 dark:text-gray-500">No paid bills yet tonight.<br />The line starts with the first payment.</p>
            </div>
          )}
        </div>
        <div className="lg:col-span-2 bg-white border border-gray-200 dark:bg-gray-950 dark:border-gray-800 rounded-[22px] px-5 pt-4 pb-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-50">Tonight's jar</h2>
            <span className="text-xs text-gray-500 dark:text-gray-300">
              {jarBenchmark.value > 0 ? `${Math.min(999, Math.round(((tonight?.total ?? 0) / jarBenchmark.value) * 100))}% of ${jarBenchmark.name}` : 'Your first night'}
            </span>
          </div>
          <CoinJar total={tonight?.total ?? 0} benchmark={jarBenchmark.value} benchmarkLabel={jarBenchmark.label} dark={isDark} />
        </div>
      </div>

      {/* Live orders + swipe cards */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4">

        <div className="bg-white dark:bg-[#2B201B] border border-gray-200 dark:border-gray-800 rounded-[22px] flex flex-col min-h-0">
          <div className="px-5 pt-4 pb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Live orders</h2>
            <div className="flex items-center gap-1.5 text-xs font-bold text-green-500 dark:text-green-400">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Live
            </div>
          </div>
          <div className="px-5 pb-3 divide-y divide-gray-100 dark:divide-gray-800 max-h-64 overflow-y-auto">
            {visibleOrders.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">No orders waiting</p>
            )}
            {visibleOrders.map((order) => (
              <div key={order.orderId} className="py-2.5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{order.tableLabel}</span>
                    {order.source === 'staff' && (
                      <span className="text-[10px] font-semibold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 px-1.5 py-0.5 rounded-full">Waiter</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 truncate">
                    {order.items.map((i) => `${i.name} ×${i.quantity}`).join(' · ')}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{formatRwf(order.total)} · {timeAgo(order.placedAt)}</p>
                </div>
                <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  order.status === 'pending'
                    ? 'bg-skuzi-honey text-gray-900'
                    : 'bg-gray-900 text-gray-50 dark:bg-gray-100 dark:text-gray-900'
                }`}>
                  {order.status === 'pending' ? 'New' : 'Preparing'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="min-w-0 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {SLIDES.map((label, i) => (
                <button
                  key={label}
                  onClick={() => goToSlide(i)}
                  aria-label={`Show ${label}`}
                  className={`h-2 rounded-full transition-all ${i === slide ? 'w-6 bg-gray-900 dark:bg-gray-100' : 'w-2 bg-gray-300 dark:bg-gray-700'}`}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => goToSlide(Math.max(0, slide - 1))}
                aria-label="Previous card"
                className="w-9 h-9 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#2B201B] text-gray-900 dark:text-white flex items-center justify-center disabled:opacity-40"
                disabled={slide === 0}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => goToSlide(Math.min(SLIDES.length - 1, slide + 1))}
                aria-label="Next card"
                className="w-9 h-9 rounded-full bg-gray-900 text-gray-50 dark:bg-gray-100 dark:text-gray-900 flex items-center justify-center disabled:opacity-40"
                disabled={slide === SLIDES.length - 1}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div
            ref={trackRef}
            onScroll={onTrackScroll}
            className="no-scrollbar flex gap-3.5 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-1"
          >
            {/* Tonight's summary */}
            <div className={slideClass}>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Tonight's summary</h2>
              {!summary || summary.totalOrders === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 py-6">{statsLoading ? '—' : 'No orders yet tonight'}</p>
              ) : (
                <>
                  <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                    <b className="text-gray-900 dark:text-white">{tonight ? formatRwf(tonight.total) : stats ? formatRwf(stats.revenueTonight) : '—'}</b> from{' '}
                    <b className="text-gray-900 dark:text-white">{summary.closedTabs}</b> paid {summary.closedTabs === 1 ? 'table' : 'tables'} ·{' '}
                    <b className="text-gray-900 dark:text-white">{summary.totalOrders}</b> {summary.totalOrders === 1 ? 'order' : 'orders'}.
                    {busiestHour && <> Busiest hour so far: <b className="text-gray-900 dark:text-white">{busiestHour}</b>.</>}
                  </p>
                  {summary.topItems.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <p className="text-xs font-bold text-gray-500 dark:text-gray-400">Best sellers</p>
                      {summary.topItems.map((item, i) => (
                        <div key={item.name} className="flex items-center gap-2.5">
                          <span className="w-28 truncate text-sm text-gray-900 dark:text-white">{item.name}</span>
                          <span className="flex-1 h-3 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                            <span
                              className={`bar-grow block h-full rounded-full ${BAR_COLOURS[i]}`}
                              style={{ width: `${(item.quantity / summary.topItems[0].quantity) * 100}%`, animationDelay: `${i * 0.15}s` }}
                            />
                          </span>
                          <b className="w-8 text-right text-sm text-gray-900 dark:text-white">{item.quantity}</b>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Busy hours */}
            <div className={slideClass}>
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Busy hours</h2>
                <Link to="/busy-hours" className="text-xs font-bold text-brand-500 dark:text-brand-300 hover:underline">Last 4 weeks · darker = busier</Link>
              </div>
              {busy ? (
                <div className="overflow-x-auto no-scrollbar">
                  <div className="grid gap-1.5 min-w-[380px]" style={{ gridTemplateColumns: `34px repeat(${SLIDE_HOURS.length}, minmax(0, 1fr))` }}>
                    <span />
                    {SLIDE_HOURS.map((h) => (
                      <span key={h} className="text-[11px] text-center text-gray-500 dark:text-gray-400">{String(h).padStart(2, '0')}h</span>
                    ))}
                    {busy.days.map((day, di) => (
                      <Fragment key={day}>
                        <span className="text-[11px] text-gray-500 dark:text-gray-400 self-center">{day}</span>
                        {SLIDE_HOURS.map((h) => {
                          const hi = busy.hours.indexOf(h);
                          const count = hi >= 0 ? busy.cells[di][hi].count : 0;
                          const level = count === 0 ? 0 : Math.min(4, Math.ceil((count / busy.maxCount) * 4));
                          const isNow = di === kigaliNow.day && h === kigaliNow.hour;
                          return (
                            <span
                              key={h}
                              title={`${day} ${h}h · ${count} ${count === 1 ? 'order' : 'orders'}`}
                              className={`h-4 rounded-md ${HEAT[level]} ${isNow ? 'cell-now' : ''}`}
                            />
                          );
                        })}
                      </Fragment>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400 dark:text-gray-500 py-6">—</p>
              )}
            </div>

            {/* Staff leaderboard */}
            <div className={slideClass}>
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Staff leaderboard</h2>
                <Link to="/staff" className="text-xs font-bold text-brand-500 dark:text-brand-300 flex items-center gap-0.5 hover:underline">
                  All staff <ChevronRight size={12} />
                </Link>
              </div>
              {leaderboard.length === 0 && (
                <p className="text-sm text-gray-400 dark:text-gray-500 py-6">No staff added yet</p>
              )}
              {leaderboard.map((entry, i) => (
                <div key={entry.staffId} className="flex items-center gap-3">
                  <b className={`w-4 text-sm ${i === 0 ? 'text-skuzi-honey' : 'text-gray-400'}`}>{i + 1}</b>
                  <div className="w-24 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{entry.name}</p>
                    <p className="text-[11px] text-gray-400 truncate">
                      {entry.ratingCount > 0 ? `${entry.avgRating} ★ · ${entry.ratingCount}` : 'No ratings yet'}
                    </p>
                  </div>
                  <span className="flex-1 h-2.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <span
                      className={`bar-grow block h-full rounded-full ${i === 0 ? 'bg-brand-500' : 'bg-gray-900 dark:bg-gray-300'}`}
                      style={{ width: `${Math.max(4, (entry.totalPoints / Math.max(1, leaderboard[0].totalPoints)) * 100)}%`, animationDelay: `${i * 0.15}s` }}
                    />
                  </span>
                  <b className="w-14 text-right text-sm text-gray-900 dark:text-white">{entry.totalPoints} pts</b>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {receiptTabId && (
        <ReceiptModal tabId={receiptTabId} onClose={() => setReceiptTabId(null)} />
      )}
    </Layout>
  );
}
