import { useEffect, useState } from 'react';
import { Lightbulb } from 'lucide-react';
import Layout from '../../components/Layout';
import { useAuthStore } from '../../lib/auth';
import api from '../../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface HeatmapCell {
  day: string;
  hour: number;
  count: number;
}

interface HeatmapData {
  cells: HeatmapCell[][];   // [dayIndex][hourIndex]
  maxCount: number;
  busiestDay: string | null;
  peakHourLabel: string | null;
  avgOrdersPerHour: number;
  peakDays: { day: string; orders: number }[];
  staffingSuggestion: string;
  hours: number[];
  days: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatHour(h: number): string {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const display = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${display} ${ampm}`;
}

function getIntensity(count: number, max: number): number {
  if (max === 0 || count === 0) return 0;
  return count / max; // 0–1
}

function intensityToColor(intensity: number, isDark: boolean): string {
  if (intensity === 0) return isDark ? '#1f2937' : '#f1f5f9';
  // Blue scale matching the mockup: light blue → deep blue
  const stops = isDark
    ? ['#1e3a5f', '#1d4ed8', '#1e40af', '#1e3a8a', '#172554']
    : ['#dbeafe', '#93c5fd', '#3b82f6', '#2563eb', '#1d4ed8'];
  const idx = Math.min(Math.floor(intensity * stops.length), stops.length - 1);
  return stops[idx];
}

// ─── Cell ─────────────────────────────────────────────────────────────────────

function HeatCell({ count, max, isDark }: { count: number; max: number; isDark: boolean }) {
  const intensity = getIntensity(count, max);
  const bg = intensityToColor(intensity, isDark);
  return (
    <div
      title={`${count} orders`}
      style={{ backgroundColor: bg }}
      className="w-8 h-8 rounded-lg transition-colors"
    />
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function BusyHours() {
  const { venues, fetchMe } = useAuthStore();
  const venue = venues[0];
  const isElite = venue?.plan === 'elite';

  const [data, setData] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);

  // Detect dark mode
  const isDark = document.documentElement.classList.contains('dark');

  useEffect(() => {
    if (!venue) fetchMe();
  }, []);

  useEffect(() => {
    if (!venue) { setLoading(false); return; }
    api.get(`/dashboard/busy-hours/${venue.id}`)
      .then((r) => setData(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [venue?.id, isElite]);

  // ── Elite guard removed ───────────────────────────────────────────────────────

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading || !data) {
    return (
      <Layout>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Busy Hours</h1>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-28 bg-gray-100 dark:bg-gray-800 rounded-2xl" />
          <div className="h-72 bg-gray-100 dark:bg-gray-800 rounded-2xl" />
        </div>
      </Layout>
    );
  }

  const maxDay = data.peakDays[0]?.orders ?? 1;

  return (
    <Layout>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Busy Hours</h1>
          <p className="text-sm text-gray-400 mt-0.5">Last 4 weeks · {venue?.name}</p>
        </div>
        <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-bold rounded-full">
          Elite
        </span>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
          <p className="text-xs text-gray-400 mb-1">Busiest day</p>
          <p className="text-xl font-black text-gray-900 dark:text-white">{data.busiestDay ?? '—'}</p>
        </div>
        <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
          <p className="text-xs text-gray-400 mb-1">Peak hour</p>
          <p className="text-xl font-black text-gray-900 dark:text-white">{data.peakHourLabel ?? '—'}</p>
        </div>
        <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
          <p className="text-xs text-gray-400 mb-1">Avg orders/hr</p>
          <p className="text-xl font-black text-gray-900 dark:text-white">{data.avgOrdersPerHour}</p>
        </div>
      </div>

      {/* Heatmap */}
      <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-gray-800 rounded-2xl p-5 mb-4 overflow-x-auto">
        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">
          Orders by Day &amp; Hour
        </p>

        {/* Day header row */}
        <div className="flex gap-2 mb-2 ml-14">
          {data.days.map((day) => (
            <div key={day} className="w-8 text-center text-xs font-semibold text-gray-400">
              {day}
            </div>
          ))}
        </div>

        {/* Hour rows */}
        <div className="space-y-1.5">
          {data.hours.map((hour, hi) => (
            <div key={hour} className="flex items-center gap-2">
              {/* Hour label */}
              <div className="w-12 text-right text-xs text-gray-400 flex-shrink-0">
                {formatHour(hour)}
              </div>
              {/* Cells: one per day */}
              {data.days.map((_, di) => (
                <HeatCell
                  key={di}
                  count={data.cells[di][hi].count}
                  max={data.maxCount}
                  isDark={isDark}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 mt-4 ml-14">
          <span className="text-xs text-gray-400">Low</span>
          {[0, 0.2, 0.5, 0.75, 1].map((v, i) => (
            <div
              key={i}
              style={{ backgroundColor: intensityToColor(v, isDark) }}
              className="w-5 h-5 rounded"
            />
          ))}
          <span className="text-xs text-gray-400">High</span>
        </div>
      </div>

      {/* Peak days ranked */}
      {data.peakDays.length > 0 && (
        <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-gray-800 rounded-2xl p-5 mb-4">
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">
            Peak Days by Orders
          </p>
          <div className="space-y-3">
            {data.peakDays.map(({ day, orders }) => (
              <div key={day} className="flex items-center gap-3">
                <span className="w-10 text-sm font-bold text-gray-900 dark:text-white">{day}</span>
                <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-2 rounded-full bg-blue-500"
                    style={{ width: `${(orders / maxDay) * 100}%` }}
                  />
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400 w-20 text-right">
                  {orders} orders
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Staffing suggestion */}
      <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200/70 dark:border-purple-700/40 rounded-2xl p-5 flex gap-3">
        <Lightbulb size={18} className="text-purple-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-purple-800 dark:text-purple-300 mb-1">
            Staffing suggestion
          </p>
          <p className="text-sm text-purple-700 dark:text-purple-400">
            {data.staffingSuggestion}
          </p>
        </div>
      </div>
    </Layout>
  );
}
