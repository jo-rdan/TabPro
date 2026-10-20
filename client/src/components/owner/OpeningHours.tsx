import { useState } from 'react';
import { X } from 'lucide-react';

// Edit opening hours: each day open or closed, with opening and closing times
// (closing after midnight is fine, e.g. 18:00 – 02:00).
type DayHours = { open: string; close: string } | null;
type Hours = Record<string, DayHours>;
const DAYS: [string, string][] = [['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'], ['thu', 'Thursday'], ['fri', 'Friday'], ['sat', 'Saturday'], ['sun', 'Sunday']];
const TIMES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
const DEFAULT: DayHours = { open: '11:00', close: '23:00' };

export default function OpeningHours({ initial, onSave, onClose }: {
  initial: Hours | null;
  onSave: (h: Hours) => Promise<void>;
  onClose: () => void;
}) {
  const [hours, setHours] = useState<Hours>(() => Object.fromEntries(DAYS.map(([k]) => [k, initial ? initial[k] ?? null : DEFAULT])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: DayHours) => setHours((h) => ({ ...h, [k]: v }));
  const copyToAll = (k: string) => setHours(Object.fromEntries(DAYS.map(([d]) => [d, hours[k]])));

  const save = async () => {
    if (DAYS.some(([k]) => hours[k] && hours[k]!.open === hours[k]!.close)) { setError('Opening and closing time must be different'); return; }
    setBusy(true); setError('');
    try { await onSave(hours); } catch (e: any) { setError(e?.response?.data?.error || "Couldn't save. Check your connection."); setBusy(false); }
  };

  const select = 'min-h-[40px] rounded-lg border border-gray-200 bg-white px-2 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:bg-[#1B1524] dark:text-white';
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="hours-title">
      <div className="absolute inset-0 bg-[#1B1524]/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-[28px] border border-gray-200 bg-white px-5 pb-6 pt-5 shadow-2xl dark:border-gray-800 dark:bg-[#231A2C] sm:max-w-lg sm:rounded-[28px]">
        <div className="flex items-center justify-between">
          <h2 id="hours-title" className="font-display text-xl font-bold text-gray-900 dark:text-white">Opening hours</h2>
          <button onClick={onClose} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-white/10"><X size={18} /></button>
        </div>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Shown on your Skuzi page. Guests can book from opening until an hour before closing.</p>
        <ul className="mt-4 divide-y divide-gray-100 dark:divide-gray-800">
          {DAYS.map(([k, label]) => {
            const h = hours[k];
            return (
              <li key={k} className="flex flex-wrap items-center gap-2 py-2.5">
                <label className="flex min-w-[118px] items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
                  <input type="checkbox" checked={!!h} onChange={(e) => set(k, e.target.checked ? (h ?? DEFAULT) : null)} className="h-5 w-5 accent-brand-500" />
                  {label}
                </label>
                {h ? (
                  <div className="flex flex-1 items-center gap-1.5">
                    <select aria-label={`${label} opens`} value={h.open} onChange={(e) => set(k, { ...h, open: e.target.value })} className={select}>{TIMES.map((t) => <option key={t}>{t}</option>)}</select>
                    <span className="text-gray-400">–</span>
                    <select aria-label={`${label} closes`} value={h.close} onChange={(e) => set(k, { ...h, close: e.target.value })} className={select}>{TIMES.map((t) => <option key={t}>{t}</option>)}</select>
                    {h.close <= h.open && <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">next day</span>}
                  </div>
                ) : <span className="flex-1 text-sm text-gray-400">Closed</span>}
                {k === 'mon' && <button onClick={() => copyToAll('mon')} className="min-h-[36px] text-xs font-bold text-brand-600 hover:underline dark:text-brand-300">Same every day</button>}
              </li>
            );
          })}
        </ul>
        {error && <p role="alert" className="mt-2 text-sm text-red-500">{error}</p>}
        <button onClick={save} disabled={busy} className="mt-4 min-h-[50px] w-full rounded-xl bg-brand-500 font-bold text-white hover:bg-brand-600 disabled:opacity-50">{busy ? 'Saving…' : 'Save hours'}</button>
      </div>
    </div>
  );
}
