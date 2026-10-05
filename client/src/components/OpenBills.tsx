import { useEffect, useState } from "react";
import { Receipt, Phone } from "lucide-react";
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
export default function OpenBills({ venueId }: { venueId: string }) {
  const [bills, setBills] = useState<OpenBill[]>([]);

  useEffect(() => {
    api.get(`/dashboard/open-bills/${venueId}`).then((r) => setBills(r.data.data)).catch(() => {});
  }, [venueId]);

  if (bills.length === 0) return null;
  const sum = bills.reduce((s, b) => s + b.total, 0);

  return (
    <div className="bg-white dark:bg-[#2B201B] border border-gray-200 dark:border-gray-800 rounded-2xl mb-5 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
            <Receipt size={15} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Bills left open</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Not paid in Skuzi and untouched for hours</p>
          </div>
        </div>
        <span className="text-sm font-bold text-gray-900 dark:text-white tabular-nums whitespace-nowrap">
          {sum.toLocaleString()} RWF
        </span>
      </div>
      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
        {bills.map((b) => (
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
    </div>
  );
}
