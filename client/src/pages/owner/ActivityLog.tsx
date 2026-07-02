import { useState, useEffect } from 'react';
import { Users, User, Clock, Receipt } from 'lucide-react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import { useAuthStore } from '../../lib/auth';
import api from '../../lib/api';
import ReceiptModal from '../../components/ReceiptModal';

interface OrderEntry {
  orderId: string;
  source: 'customer' | 'staff';
  status: string;
  placedAt: string;
  items: { name: string; quantity: number; unitPriceRwf: number; subtotal: number }[];
  total: number;
}

interface TabEntry {
  tabId: string;
  tableLabel: string;
  tabStatus: string;
  openedAt: string;
  closedAt: string | null;
  orders: OrderEntry[];
  tabTotal: number;
}

function formatRwf(n: number) {
  return `${n.toLocaleString()} RWF`;
}

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ActivityLog() {
  const { venues, fetchMe } = useAuthStore();
  const venue = venues[0];
  useEffect(() => { if (!venue) fetchMe(); }, []);

  const [activity, setActivity] = useState<TabEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [receiptTabId, setReceiptTabId] = useState<string | null>(null);

  useEffect(() => {
    const fetchActivity = async () => {
      if (!venue) return;
      try {
        const res = await api.get(`/dashboard/activity/${venue.id}`);
        setActivity(res.data.data);
      } catch {
        setError('Failed to load activity.');
      } finally {
        setLoading(false);
      }
    };
    fetchActivity();
  }, [venue]);

  const totalRevenue = activity
    .filter((t) => t.tabStatus === 'closed')
    .reduce((s, t) => s + t.tabTotal, 0);

  const totalOrders = activity.flatMap((t) => t.orders).length;
  const customerOrders = activity.flatMap((t) => t.orders).filter((o) => o.source === 'customer').length;

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Activity log</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Tonight · {venue?.name}</p>
      </div>

      {/* Summary */}
      {!loading && activity.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-center">
            <p className="text-lg font-bold text-gray-900 dark:text-white">{formatRwf(totalRevenue)}</p>
            <p className="text-xs text-gray-500 mt-0.5">Revenue</p>
          </div>
          <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-center">
            <p className="text-lg font-bold text-gray-900 dark:text-white">{totalOrders}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total orders</p>
          </div>
          <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-center">
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {totalOrders > 0 ? Math.round((customerOrders / totalOrders) * 100) : 0}%
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Self-ordered</p>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

      <div className="space-y-4">
        {activity.map((tab) => (
          <div key={tab.tabId} className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
            {/* Tab header */}
            <div className="px-5 py-3 bg-gray-50 dark:bg-[#0D1117] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{tab.tableLabel}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  tab.tabStatus === 'closed'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                }`}>
                  {tab.tabStatus === 'closed' ? 'Closed' : 'Open'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <Clock size={11} />
                  {formatTime(tab.openedAt)}
                  {tab.closedAt && ` → ${formatTime(tab.closedAt)}`}
                </span>
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  {formatRwf(tab.tabTotal)}
                </span>
                <button
                  onClick={() => setReceiptTabId(tab.tabId)}
                  className="flex items-center gap-1 text-xs text-brand-500 hover:underline"
                  title="Open receipt"
                >
                  <Receipt size={12} />
                  Receipt
                </button>
              </div>
            </div>

            {/* Orders */}
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {tab.orders.map((order) => (
                <div key={order.orderId} className="px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                      order.source === 'customer'
                        ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400'
                        : 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400'
                    }`}>
                      {order.source === 'customer' ? <User size={10} /> : <Users size={10} />}
                      {order.source === 'customer' ? 'Customer' : 'Staff'}
                    </div>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {order.items.map((i) => `${i.name} ×${i.quantity}`).join(', ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">{formatTime(order.placedAt)}</span>
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      {formatRwf(order.total)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {!loading && activity.length === 0 && (
          <div className="text-center py-16 text-sm text-gray-400 dark:text-gray-500">
            No activity yet tonight.
          </div>
        )}
      </div>
      {receiptTabId && (
        <ReceiptModal tabId={receiptTabId} onClose={() => setReceiptTabId(null)} />
      )}
    </Layout>
  );
}
