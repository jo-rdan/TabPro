import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';import { TrendingUp, Users, Clock, Star, ChevronRight, ArrowUpRight, BellRing, CreditCard, X, PhoneOff } from 'lucide-react';
import OpenBills from '../../components/OpenBills';
import Layout from '../../components/Layout';
import ReceiptModal from '../../components/ReceiptModal';
import JoinRequests from '../../components/JoinRequests';
import LogoUploader from '../../components/LogoUploader';
import { useAuthStore } from '../../lib/auth';
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

function formatRwf(n: number) {
  return `${n.toLocaleString()} RWF`;
}

function timeAgo(d: string) {
  const diff = Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 1000));
  if (diff < 60) return `${diff}s ago`;
  return `${Math.floor(diff / 60)}m ago`;
}

export default function Dashboard() {
  const { owner, venues, fetchMe, token } = useAuthStore();
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
      const [statsRes, lbRes, reportRes] = await Promise.all([
        api.get(`/dashboard/stats/${venue.id}`),
        api.get(`/ratings/leaderboard/${venue.id}`),
        api.get(`/dashboard/report/${venue.id}`),
      ]);
      setStats(statsRes.data.data);
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
      value: stats ? formatRwf(stats.revenueTonight) : '—',
      icon: TrendingUp,
      color: 'text-brand-500',
      bg: 'bg-brand-50 dark:bg-brand-900/20',
    },
    {
      label: 'Active tables',
      value: stats?.activeTables ?? '—',
      icon: Users,
      color: 'text-blue-500',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
    },
    {
      label: 'Pending orders',
      value: stats?.pendingOrders ?? '—',
      icon: Clock,
      color: 'text-amber-500',
      bg: 'bg-amber-50 dark:bg-amber-900/20',
    },
    {
      label: 'Avg rating today',
      value: stats?.avgRatingToday ? `${stats.avgRatingToday} ★` : '—',
      sub: stats?.ratingCount ? `${stats.ratingCount} ratings` : undefined,
      icon: Star,
      color: 'text-purple-500',
      bg: 'bg-purple-50 dark:bg-purple-900/20',
    },
  ];

  return (
    <Layout>
      {toast && <Toast message={toast} duration={6000} onDismiss={() => setToast(null)} />}
      <div className="mb-8 flex items-center gap-5 pb-6 border-b border-gray-100 dark:border-gray-800/60">
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
          <p className="text-xs font-medium text-gray-400 dark:text-gray-500 tracking-wide uppercase">
            {owner ? `Welcome back, ${owner.name.split(' ')[0]}` : 'Dashboard'}
          </p>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-none">
            {venue?.name ?? 'Your venue'}
          </h1>
          {venue?.isDemo && (
            <span className="mt-2 inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/40 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-300">
              Demo venue · payments are simulated
            </span>
          )}
        </div>
      </div>

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
                : 'Turn on notifications to hear about orders, waiter calls and payments, even when TabPro is closed'}
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

      {venue && <OpenBills venueId={venue.id} />}

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
                  ? 'bg-white dark:bg-[#161B22] border-gray-200 dark:border-gray-800'
                  : alert.type === 'away'
                  ? 'bg-white dark:bg-[#161B22] border-gray-200 dark:border-gray-800'
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
      <div className="grid grid-cols-2 gap-3 mb-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
              <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center mb-3`}>
                <Icon size={16} className={card.color} />
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {statsLoading ? <span className="text-gray-300 dark:text-gray-600">—</span> : card.value}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{card.label}</p>
              {card.sub && <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>}
            </div>
          );
        })}
      </div>

      {/* Tonight's summary */}
      <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-gray-800 rounded-2xl mb-4">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Tonight's summary</h2>
        </div>
        {!summary || summary.totalOrders === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">
            {statsLoading ? '—' : 'No orders yet tonight'}
          </p>
        ) : (
          <div className="px-5 py-4 space-y-3">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <span className="font-bold text-gray-900 dark:text-white">{stats ? formatRwf(stats.revenueTonight) : '—'}</span> from{' '}
              <span className="font-bold text-gray-900 dark:text-white">{summary.closedTabs}</span> paid {summary.closedTabs === 1 ? 'table' : 'tables'} ·{' '}
              <span className="font-bold text-gray-900 dark:text-white">{summary.totalOrders}</span> {summary.totalOrders === 1 ? 'order' : 'orders'}
            </p>
            {summary.topItems.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Best sellers</p>
                {summary.topItems.map((item) => (
                  <p key={item.name} className="text-xs text-gray-600 dark:text-gray-400">{item.name} ×{item.quantity}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* Live orders */}
        <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-gray-800 rounded-2xl">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Live orders</h2>
            <div className="flex items-center gap-1.5 text-xs text-green-500">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Live
            </div>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-72 overflow-y-auto">
            {liveOrders.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">No orders yet tonight</p>
            )}
            {[...new Map(liveOrders.map((o) => [o.orderId, o])).values()]
              .filter((o) => o.status !== 'delivered')
              .map((order) => (
              <div key={order.orderId} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{order.tableLabel}</span>
                    {order.source === 'staff' && (
                      <span className="text-xs bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 px-1.5 py-0.5 rounded-full">Staff</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {order.items.map((i) => `${i.name} ×${i.quantity}`).join(', ')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{formatRwf(order.total)}</p>
                  <p className="text-xs text-gray-400">{timeAgo(order.placedAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Staff leaderboard */}
        <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-gray-800 rounded-2xl">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Staff leaderboard</h2>
            <Link to="/staff" className="text-xs text-brand-500 flex items-center gap-0.5 hover:underline">
              All staff <ChevronRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {leaderboard.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">No staff added yet</p>
            )}
            {leaderboard.map((entry, i) => (
              <div key={entry.staffId} className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-gray-400 w-4">{i + 1}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{entry.name}</p>
                    <p className="text-xs text-gray-400">
                      {entry.ratingCount > 0 ? `${entry.avgRating} ★ · ${entry.ratingCount} ratings` : 'No ratings yet'}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-bold text-brand-500">{entry.totalPoints} pts</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-3 gap-3 mt-4">
        {/* Tables */}
        <Link
          to="/tables"
          className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-gray-800 rounded-2xl p-4 hover:border-brand-500 dark:hover:border-brand-500 transition-colors group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">Tables</span>
            <ArrowUpRight size={14} className="text-gray-400 group-hover:text-brand-500 transition-colors" />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">QR codes & management</p>
        </Link>

        {/* Staff */}
        <Link
          to="/staff"
          className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-gray-800 rounded-2xl p-4 hover:border-brand-500 dark:hover:border-brand-500 transition-colors group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">Staff</span>
            <ArrowUpRight size={14} className="text-gray-400 group-hover:text-brand-500 transition-colors" />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Invite & track points</p>
        </Link>

        {/* Payment History — coming soon, no redirect */}
        <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-gray-800 rounded-2xl p-4 opacity-70 cursor-default">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">Payments</span>
            <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded-full">Soon</span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Payment history</p>
        </div>
      </div>
      {receiptTabId && (
        <ReceiptModal tabId={receiptTabId} onClose={() => setReceiptTabId(null)} />
      )}
    </Layout>
  );
}
