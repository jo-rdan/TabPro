import { useState, useEffect } from 'react';
import { Star, MessageSquare, User, TrendingUp, RefreshCw, Lock } from 'lucide-react';
import Layout from '../../components/Layout';
import { useAuthStore } from '../../lib/auth';
import api from '../../lib/api';

interface Totals {
  count: number;
  food: number | null;
  waiter: number | null;
  overall: number | null;
}

interface WeeklyPoint {
  week: string;
  food: number | null;
  waiter: number | null;
  overall: number | null;
  count: number;
}

interface WaiterRow {
  staffId: string;
  name: string;
  count: number;
  food: number | null;
  waiter: number | null;
  overall: number | null;
}

interface CommentRow {
  id: string;
  comment: string;
  overall: number;
  waiterName: string | null;
  createdAt: string;
}

interface Breakdown {
  totals: Totals | null;
  weekly: WeeklyPoint[];
  byWaiter: WaiterRow[];
  comments: CommentRow[];
}

function Stars({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-gray-400">—</span>;
  return (
    <div className="flex items-center gap-1">
      <span className="text-sm font-black text-gray-900 dark:text-white">{score.toFixed(1)}</span>
      <Star size={12} className="text-amber-400 fill-amber-400" />
    </div>
  );
}

function ScoreBar({ label, score, color }: { label: string; score: number | null; color: string }) {
  const pct = score ? (score / 5) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
        <span className="text-xs font-bold text-gray-900 dark:text-white">{score?.toFixed(1) ?? '—'}</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function Ratings() {
  const { venues, fetchMe } = useAuthStore();
  const venue = venues[0];
  const isPro = venue?.plan === 'pro' || venue?.plan === 'elite';
  useEffect(() => { if (!venue) fetchMe(); }, []);

  const [data, setData] = useState<Breakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'waiters' | 'comments'>('overview');

  const fetchBreakdown = async () => {
    if (!venue) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/ratings/breakdown/${venue.id}`);
      setData(res.data.data);
    } catch {
      setError('Failed to load ratings data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBreakdown(); }, [venue]);

  if (!isPro) {
    return (
      <Layout>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ratings</h1>
        </div>
        <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-gray-800 rounded-2xl p-12 text-center">
          <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock size={20} className="text-purple-500" />
          </div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white mb-2">Pro feature</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-xs mx-auto">
            Ratings give you a full breakdown of food, waiter, and overall scores — with comments and weekly trends. Upgrade to Pro to unlock this.
          </p>
          <a
            href="/subscription"
            className="inline-block px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            View plans →
          </a>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ratings</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {data?.totals ? `${data.totals.count} total reviews` : 'All-time breakdown'}
          </p>
        </div>
        <button
          onClick={fetchBreakdown}
          disabled={loading}
          className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-40"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl mb-6 w-fit">
        {(['overview', 'waiters', 'comments'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all ${
              activeTab === tab
                ? 'bg-white dark:bg-[#161B22] text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab}
            {tab === 'comments' && data?.comments.length ? (
              <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400">
                {data.comments.length}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      {!loading && data && !data.totals && (
        <div className="flex flex-col items-center justify-center py-20 text-center px-6">
          <Star size={40} className="text-gray-200 dark:text-gray-800 mb-4" />
          <p className="text-sm font-semibold text-gray-500">No ratings yet</p>
          <p className="text-xs text-gray-400 mt-1">Ratings will appear here once customers start reviewing.</p>
        </div>
      )}

      {/* ── Overview tab ────────────────────────────────────────────────── */}
      {!loading && data?.totals && activeTab === 'overview' && (
        <div className="space-y-5">
          {/* Score cards */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Food', score: data.totals.food, color: 'text-orange-500' },
              { label: 'Service', score: data.totals.waiter, color: 'text-blue-500' },
              { label: 'Overall', score: data.totals.overall, color: 'text-brand-500' },
            ].map(({ label, score, color }) => (
              <div key={label} className="bg-white dark:bg-[#161B22] border border-gray-100 dark:border-gray-800 rounded-2xl p-4 text-center">
                <p className="text-xs font-semibold text-gray-400 mb-2">{label}</p>
                <p className={`text-3xl font-black ${color}`}>{score?.toFixed(1) ?? '—'}</p>
                <p className="text-xs text-gray-400 mt-1">out of 5</p>
              </div>
            ))}
          </div>

          {/* Score bars */}
          <div className="bg-white dark:bg-[#161B22] border border-gray-100 dark:border-gray-800 rounded-2xl p-5 space-y-4">
            <ScoreBar label="Food quality" score={data.totals.food} color="bg-orange-400" />
            <ScoreBar label="Waiter service" score={data.totals.waiter} color="bg-blue-400" />
            <ScoreBar label="Overall experience" score={data.totals.overall} color="bg-brand-500" />
          </div>

          {/* Weekly trend */}
          <div className="bg-white dark:bg-[#161B22] border border-gray-100 dark:border-gray-800 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={15} className="text-brand-500" />
              <p className="text-sm font-bold text-gray-900 dark:text-white">8-week trend</p>
            </div>
            <div className="space-y-3">
              {data.weekly.filter((w) => w.count > 0).map((w) => (
                <div key={w.week} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-14 flex-shrink-0">{w.week}</span>
                  <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand-500 transition-all"
                      style={{ width: `${((w.overall ?? 0) / 5) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300 w-8 text-right">
                    {w.overall?.toFixed(1) ?? '—'}
                  </span>
                  <span className="text-xs text-gray-400 w-12 text-right">{w.count} reviews</span>
                </div>
              ))}
              {data.weekly.every((w) => w.count === 0) && (
                <p className="text-xs text-gray-400 text-center py-2">No data in last 8 weeks</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Waiters tab ──────────────────────────────────────────────────── */}
      {!loading && data && activeTab === 'waiters' && (
        <div className="space-y-3">
          {data.byWaiter.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">No waiter-linked ratings yet.</p>
          ) : data.byWaiter.map((w) => (
            <div key={w.staffId} className="bg-white dark:bg-[#161B22] border border-gray-100 dark:border-gray-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center flex-shrink-0">
                    <User size={16} className="text-brand-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{w.name}</p>
                    <p className="text-xs text-gray-400">{w.count} reviews</p>
                  </div>
                </div>
                <Stars score={w.overall} />
              </div>
              <div className="space-y-3">
                <ScoreBar label="Food" score={w.food} color="bg-orange-400" />
                <ScoreBar label="Service" score={w.waiter} color="bg-blue-400" />
                <ScoreBar label="Overall" score={w.overall} color="bg-brand-500" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Comments tab ─────────────────────────────────────────────────── */}
      {!loading && data && activeTab === 'comments' && (
        <div className="space-y-3">
          {data.comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <MessageSquare size={36} className="text-gray-200 dark:text-gray-800 mb-3" />
              <p className="text-sm text-gray-400">No written comments yet.</p>
            </div>
          ) : data.comments.map((c) => (
            <div key={c.id} className="bg-white dark:bg-[#161B22] border border-gray-100 dark:border-gray-800 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">{c.comment}</p>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <span className="text-xs font-bold text-amber-500">{c.overall}</span>
                  <Star size={11} className="text-amber-400 fill-amber-400" />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                {c.waiterName && (
                  <span className="text-xs text-gray-400">
                    via <span className="font-medium text-gray-500 dark:text-gray-400">{c.waiterName}</span>
                  </span>
                )}
                <span className="text-xs text-gray-300 dark:text-gray-700">·</span>
                <span className="text-xs text-gray-400">
                  {new Date(c.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
