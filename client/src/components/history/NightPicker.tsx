import { useEffect, useMemo, useState } from "react";
import { X, ChevronLeft, ChevronRight, Star, Smartphone, Banknote, Hourglass, Layers } from "lucide-react";
import api from "../../lib/api";
import { nightKey, lastWeekday, nightLabel, monthLabel } from "../../lib/nights";

export type PayFilter = "all" | "momo" | "other" | "open";
export interface HistoryFilters {
  pay: PayFilter;
  payoutsOnTheWay: boolean;
}
export const NO_FILTERS: HistoryFilters = { pay: "all", payoutsOnTheWay: false };

interface NightTotal { night: string; total: number; bills: number }

// The night picker: a calendar that doubles as a heat map (each night tinted
// by how much it made), quick picks, and filters for the bills shown.
export default function NightPicker({
  venueId, night, filters, onApply, onClose,
}: {
  venueId: string;
  night: string;
  filters: HistoryFilters;
  onApply: (night: string, filters: HistoryFilters) => void;
  onClose: () => void;
}) {
  const today = nightKey(0);
  const [month, setMonth] = useState(night.slice(0, 7));
  const [picked, setPicked] = useState(night);
  const [draft, setDraft] = useState<HistoryFilters>(filters);
  const [data, setData] = useState<Record<string, NightTotal[]>>({});

  useEffect(() => {
    if (data[month]) return;
    api.get(`/dashboard/nights/${venueId}`, { params: { month } })
      .then((r) => setData((d) => ({ ...d, [month]: r.data.data.nights })))
      .catch(() => setData((d) => ({ ...d, [month]: [] })));
  }, [month, venueId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);

  const nights = data[month];
  const byNight = useMemo(() => new Map((nights ?? []).map((n) => [n.night, n])), [nights]);
  const max = Math.max(1, ...(nights ?? []).map((n) => n.total));
  const monthTotal = (nights ?? []).reduce((s, n) => s + n.total, 0);
  const monthBills = (nights ?? []).reduce((s, n) => s + n.bills, 0);
  const best = (nights ?? []).reduce<NightTotal | null>((b, n) => (!b || n.total > b.total ? n : b), null);

  // Monday-first grid
  const first = new Date(`${month}-01T12:00:00Z`);
  const lead = (first.getUTCDay() + 6) % 7;
  const daysIn = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: daysIn }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];

  const stepMonth = (d: number) => {
    const dt = new Date(`${month}-01T12:00:00Z`);
    dt.setUTCMonth(dt.getUTCMonth() + d);
    const m = dt.toISOString().slice(0, 7);
    if (m <= today.slice(0, 7)) setMonth(m);
  };
  const jump = (key: string) => { setPicked(key); setMonth(key.slice(0, 7)); };

  const quick: { label: string; key: string | null; icon?: boolean }[] = [
    { label: "Tonight", key: today },
    { label: "Last night", key: nightKey(1) },
    { label: "Last Friday", key: lastWeekday(5) },
    { label: "Last Saturday", key: lastWeekday(6) },
    { label: "Best night", key: best?.night ?? null, icon: true },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="night-picker-title">
      <div className="absolute inset-0 bg-[#1B1524]/60 backdrop-blur-sm" onClick={onClose} />
      <div className="night-pop relative w-full sm:max-w-[440px] max-h-[92vh] overflow-y-auto bg-white dark:bg-[#231A2C] rounded-t-[28px] sm:rounded-[28px] border border-gray-200 dark:border-gray-800 shadow-2xl">
        {/* Header: the month, with a soft imigongo band */}
        <div className="relative overflow-hidden px-5 pt-5 pb-4 bg-gray-900 dark:bg-[#1B1524] text-gray-50">
          <div className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-[#F2B33A]/25 blur-2xl" />
          <div className="relative flex items-start justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#F2B33A]">Pick a night</p>
              <h2 id="night-picker-title" className="mt-1 font-display text-2xl font-bold tracking-tight">{nightLabel(picked)}</h2>
              <p className="text-xs text-gray-300 mt-0.5">
                {byNight.get(picked) ? `${byNight.get(picked)!.total.toLocaleString()} RWF · ${byNight.get(picked)!.bills} paid bills` : picked > today ? "" : "No paid bills"}
              </p>
            </div>
            <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-gray-300 hover:text-white"><X size={18} /></button>
          </div>
          <svg width="100%" height="10" aria-hidden="true" className="absolute bottom-0 left-0 opacity-80">
            <defs><pattern id="imi-pick" width="16" height="10" patternUnits="userSpaceOnUse"><path d="M0 10L8 0L16 10Z" fill="#BF4A1A" /><path d="M4 10L8 5L12 10Z" fill="#231A2C" /></pattern></defs>
            <rect width="100%" height="10" fill="url(#imi-pick)" />
          </svg>
        </div>

        <div className="px-5 pt-4 pb-5">
          {/* Quick picks */}
          <div className="flex flex-wrap gap-2">
            {quick.map((q) => (
              <button
                key={q.label}
                disabled={!q.key}
                onClick={() => q.key && jump(q.key)}
                className={`flex-shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 ${
                  q.key === picked
                    ? "bg-gray-900 text-gray-50 dark:bg-gray-100 dark:text-gray-900"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-[#33293F] dark:text-gray-200"
                }`}
                title={q.icon && best ? `${best.total.toLocaleString()} RWF` : undefined}
              >
                {q.icon && <Star size={11} className="fill-[#F2B33A] text-[#F2B33A]" />}
                {q.label}
              </button>
            ))}
          </div>

          {/* Month navigation */}
          <div className="mt-4 flex items-center justify-between">
            <button onClick={() => stepMonth(-1)} aria-label="Previous month" className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-[#33293F]"><ChevronLeft size={16} /></button>
            <p className="font-display text-base font-bold text-gray-900 dark:text-white">{monthLabel(month)}</p>
            <button onClick={() => stepMonth(1)} disabled={month >= today.slice(0, 7)} aria-label="Next month" className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-[#33293F] disabled:opacity-30"><ChevronRight size={16} /></button>
          </div>

          {/* Calendar = heat map */}
          <div className="mt-2 grid grid-cols-7 gap-1.5 text-center">
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <span key={i} className={`text-[10px] font-bold ${i >= 4 ? "text-[#A63F15] dark:text-[#F29C6F]" : "text-gray-400"}`}>{d}</span>
            ))}
            {cells.map((key, i) => {
              if (!key) return <span key={`b${i}`} />;
              const n = byNight.get(key);
              const future = key > today;
              const level = n ? Math.max(1, Math.ceil((n.total / max) * 5)) : 0;
              const isPicked = key === picked;
              const isToday = key === today;
              return (
                <button
                  key={key}
                  disabled={future}
                  onClick={() => setPicked(key)}
                  title={n ? `${nightLabel(key)} · ${n.total.toLocaleString()} RWF · ${n.bills} bills` : nightLabel(key)}
                  style={{ animationDelay: `${i * 10}ms`, background: HEAT[level] }}
                  className={`night-cell relative aspect-square rounded-xl text-sm font-semibold transition-transform disabled:cursor-default ${
                    future ? "text-gray-300 dark:text-gray-600" : level >= 4 ? "text-white" : "text-gray-800 dark:text-gray-100"
                  } ${!level && !future ? "bg-gray-50 dark:bg-[#231A2C]" : ""} ${
                    isPicked ? "ring-2 ring-offset-2 ring-gray-900 ring-offset-white dark:ring-gray-100 dark:ring-offset-[#231A2C] scale-105" : future ? "" : "hover:scale-105"
                  }`}
                >
                  {Number(key.slice(8))}
                  {isToday && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-[#BF4A1A] dark:bg-[#F2B33A]" />}
                  {best?.night === key && <Star size={9} className="absolute top-0.5 right-0.5 fill-[#FFF6DD] text-[#FFF6DD]" />}
                </button>
              );
            })}
          </div>

          {/* Legend + month total */}
          <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              Quiet
              {HEAT.slice(1).map((c) => <span key={c} className="h-2.5 w-3.5 rounded-[3px]" style={{ background: c }} />)}
              Busy
            </span>
            <span className="font-semibold tabular-nums">
              {nights === undefined ? "…" : `${monthTotal.toLocaleString()} RWF · ${monthBills} bills`}
            </span>
          </div>

          {/* Filters */}
          <p className="mt-5 mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">Show</p>
          <div className="grid grid-cols-4 gap-1.5">
            {([
              ["all", "All bills", Layers],
              ["momo", "MoMo", Smartphone],
              ["other", "Cash/other", Banknote],
              ["open", "Still open", Hourglass],
            ] as const).map(([value, label, Icon]) => (
              <button
                key={value}
                onClick={() => setDraft((d) => ({ ...d, pay: value }))}
                className={`flex flex-col items-center gap-1 rounded-2xl py-2.5 text-[11px] font-semibold transition-colors ${
                  draft.pay === value
                    ? "bg-brand-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-[#33293F] dark:text-gray-300"
                }`}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>
          <label className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-gray-50 dark:bg-[#231A2C] px-4 py-3 cursor-pointer">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Only payouts still on the way</span>
            <input
              type="checkbox"
              checked={draft.payoutsOnTheWay}
              onChange={(e) => setDraft((d) => ({ ...d, payoutsOnTheWay: e.target.checked }))}
              className="peer sr-only"
            />
            <span className="relative h-6 w-11 flex-shrink-0 rounded-full bg-gray-300 dark:bg-gray-700 transition-colors peer-checked:bg-green-500 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5" />
          </label>

          {/* Actions */}
          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={() => { setPicked(today); setMonth(today.slice(0, 7)); setDraft(NO_FILTERS); }}
              className="px-3 py-3 text-sm font-semibold text-gray-500 hover:text-gray-900 dark:hover:text-white"
            >
              Reset
            </button>
            <button
              onClick={() => onApply(picked, draft)}
              className="flex-1 rounded-full bg-gray-900 dark:bg-[#F2B33A] text-gray-50 dark:text-[#231A2C] py-3 text-sm font-extrabold hover:opacity-90 transition-opacity"
            >
              Show {nightLabel(picked).toLowerCase() === "tonight" ? "tonight" : nightLabel(picked)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Milk → honey → rust, the same scale as the busy-hours chart.
const HEAT = ["transparent", "rgba(242,179,58,.22)", "rgba(242,179,58,.45)", "rgba(242,179,58,.8)", "#D0561F", "#BF4A1A"];
