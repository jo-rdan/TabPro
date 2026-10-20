import { useEffect, useState } from "react";
import { Receipt, Phone, X, ChevronRight } from "lucide-react";
import api from "../lib/api";

interface OpenBill {
  tabId: string;
  tableLabel: string;
  total: number;
  phone: string | null;
  name: string | null;
  openedAt: string;
}

const time = (d: string) =>
  new Date(d).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" });

// Bills nobody has touched for hours (often last night's). Not an accusation:
// the owner sees the amount and the guest's number, and decides what to do.
// Shown as one of the dashboard's number cards; tap it to see each bill.
export default function OpenBills({ venueId, className = "" }: { venueId: string; className?: string }) {
  const [bills, setBills] = useState<OpenBill[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api.get(`/dashboard/open-bills/${venueId}`).then((r) => setBills(r.data.data)).catch(() => setBills([]));
  }, [venueId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const sum = (bills ?? []).reduce((s, b) => s + b.total, 0);
  const count = bills?.length ?? 0;

  return (
    <>
      <button
        type="button"
        onClick={() => count > 0 && setOpen(true)}
        disabled={count === 0}
        className={`text-left bg-white dark:bg-[#3B2149] border rounded-2xl px-4 py-3.5 transition-colors ${
          count > 0
            ? "border-amber-300 dark:border-amber-700/60 hover:border-amber-500 cursor-pointer"
            : "border-gray-200 dark:border-gray-800 cursor-default"
        } ${className}`}
      >
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500 dark:text-gray-400">Bills left open</p>
          <Receipt size={15} className={count > 0 ? "text-amber-600 dark:text-amber-400" : "text-gray-400"} />
        </div>
        {bills === null ? (
          <p className="mt-1 font-display text-2xl font-bold text-gray-300 dark:text-gray-600">—</p>
        ) : count === 0 ? (
          <>
            <p className="mt-1 font-display text-2xl font-bold tracking-tight text-gray-900 dark:text-white">0</p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">All settled</p>
          </>
        ) : (
          <>
            <p className="mt-1 font-display text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              {sum.toLocaleString()}
              <span className="ml-1 text-sm font-semibold text-gray-500 dark:text-gray-400">RWF</span>
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5 flex items-center gap-0.5">
              {count} {count === 1 ? "bill" : "bills"} untouched for hours · see <ChevronRight size={12} />
            </p>
          </>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="open-bills-title">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full sm:max-w-md bg-white dark:bg-[#3B2149] border border-gray-200 dark:border-gray-800 rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[80vh] flex flex-col">
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h2 id="open-bills-title" className="text-lg font-bold text-gray-900 dark:text-white">Bills left open</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">Not paid in Skuzi and untouched for hours. Call the guest if you need to.</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                <X size={18} />
              </button>
            </div>
            <ul className="divide-y divide-gray-100 dark:divide-gray-800 overflow-y-auto">
              {(bills ?? []).map((b) => (
                <li key={b.tabId} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {b.tableLabel}
                      <span className="font-normal text-gray-400"> · opened {time(b.openedAt)}</span>
                    </p>
                    {b.phone && (
                      <a href={`tel:${b.phone}`} className="inline-flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 font-medium">
                        <Phone size={11} /> {b.name ? `${b.name} · ` : ""}{b.phone}
                      </a>
                    )}
                  </div>
                  <span className="text-sm font-bold text-gray-900 dark:text-white tabular-nums whitespace-nowrap">
                    {b.total.toLocaleString()} RWF
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex justify-between px-5 py-3 border-t border-gray-100 dark:border-gray-800 text-sm">
              <span className="text-gray-500 dark:text-gray-400">Total</span>
              <b className="text-gray-900 dark:text-white tabular-nums">{sum.toLocaleString()} RWF</b>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
