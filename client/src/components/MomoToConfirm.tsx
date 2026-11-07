import { useCallback, useEffect, useState } from "react";
import type { WsEvent } from "@tabpro/shared";
import { useWebSocket } from "../hooks/useWebSocket";
import { apiFetch } from "../lib/apiFetch";

// MoMo to confirm: guests pay the venue's own MoMo Pay code, which Skuzi can't
// see, so the person holding that phone confirms it. Used on the owner's
// dashboard, the cashier's page and a manager's screen. "Not yet" tells the
// table's waiter to keep an eye and reminds you every minute, 3 times; then
// the bill turns red.

interface Item {
  tabId: string;
  tableLabel: string;
  totalRwf: number;
  since: string;
  guestSaysPaid: boolean;
  reminders: number;
  waiting: boolean;
  failed: boolean;
  waiterName: string | null;
  guestPhone: string | null;
}

export interface MomoSummary {
  items: Item[];
  confirmedTonight: { bills: number; totalRwf: number };
  confirmers: string[];
}

const rwf = (n: number) => `${n.toLocaleString("en-US")} RWF`;
const ago = (iso: string, now: number) => {
  const m = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  return m < 1 ? "just now" : `${m} min ago`;
};

export default function MomoToConfirm({
  venueId,
  token,
  hideWhenEmpty = false,
  forOwner = false,
  onSummary,
}: {
  venueId: string;
  token: string;
  hideWhenEmpty?: boolean;
  // The owner's dashboard: an owner who handed MoMo to others still sees the red ones.
  forOwner?: boolean;
  onSummary?: (s: MomoSummary | null) => void;
}) {
  const [data, setData] = useState<MomoSummary | null>(null);
  const [allowed, setAllowed] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    if (!venueId || !token) return;
    try {
      const res = await apiFetch(`/momo/${venueId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 403) {
        setAllowed(false);
        onSummary?.(null);
        return;
      }
      const d = await res.json();
      if (d.success) {
        setAllowed(true);
        setData(d.data);
        onSummary?.(d.data);
      }
    } catch {
      /* keeps the last list; the next poll retries */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId, token]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 15000);
    const tick = setInterval(() => setNow(Date.now()), 15000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [load]);

  useWebSocket({
    venueId,
    token: token || undefined,
    enabled: !!venueId && !!token && allowed,
    onEvent: (event: WsEvent) => {
      if (["momo_check", "momo_failed", "payment_claimed", "tab_closed"].includes(event.type)) load();
    },
  });

  const act = async (item: Item, what: "received" | "not-yet") => {
    setBusy(`${item.tabId}:${what}`);
    setError("");
    try {
      const res = await apiFetch(`/momo/tabs/${item.tabId}/${what}`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      if (!d.success) setError(d.error || "That didn't work. Try again.");
      else if (what === "not-yet" && !item.waiting) {
        setNote(`👀 ${item.waiterName ?? "The waiter"} is keeping an eye on ${item.tableLabel}. We'll ask you again in 1 minute.`);
        setTimeout(() => setNote(""), 8000);
      }
      await load();
    } catch {
      setError("No connection. Try again.");
    } finally {
      setBusy(null);
    }
  };

  if (!allowed || !data) return null;
  const items = forOwner && !data.confirmers.includes("owner") ? data.items.filter((i) => i.failed) : data.items;
  if (hideWhenEmpty && items.length === 0) return null;

  return (
    <section aria-label="MoMo to confirm" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">MoMo to confirm</h2>
        <span className="font-display text-2xl font-bold tabular-nums text-gray-900 dark:text-white">{items.length}</span>
      </div>

      {note && <p role="status" className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-gray-900 ring-1 ring-gray-200 dark:bg-gray-900 dark:text-white dark:ring-gray-700">{note}</p>}
      {error && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 dark:bg-red-900/20 dark:text-red-300">{error}</p>}

      {items.length === 0 && (
        <p className="rounded-2xl bg-white px-4 py-6 text-center text-sm text-gray-500 ring-1 ring-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:ring-gray-800">
          Nothing to check. When a guest pays by MoMo, it shows up here.
        </p>
      )}

      {items.map((item) =>
        item.failed ? (
          <div key={item.tabId} className="flex flex-col gap-2.5 rounded-[22px] border-2 border-red-500 bg-red-50 p-4 text-gray-900 dark:border-red-500/70 dark:bg-red-950/40 dark:text-white">
            <p className="font-extrabold text-red-700 dark:text-red-300">⚠️ MoMo didn't arrive</p>
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-display text-xl font-bold">{item.tableLabel}{item.waiterName && <span className="ml-2 text-sm font-semibold text-gray-500 dark:text-gray-400">{item.waiterName}'s table</span>}</p>
              <p className="font-extrabold tabular-nums">{rwf(item.totalRwf)}</p>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Asked 3 times, no money yet.{item.guestPhone && <> Guest: <span className="select-all font-bold tabular-nums text-gray-900 dark:text-white">{item.guestPhone}</span></>}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => act(item, "received")} disabled={busy !== null} className="h-12 rounded-2xl bg-green-600 font-extrabold text-white disabled:opacity-50">
                {busy === `${item.tabId}:received` ? "…" : "✓ It arrived"}
              </button>
              {item.guestPhone ? (
                <a href={`tel:${item.guestPhone}`} className="flex h-12 items-center justify-center rounded-2xl border border-gray-300 bg-white font-bold text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white">Call guest</a>
              ) : (
                <span className="flex h-12 items-center justify-center rounded-2xl border border-gray-200 text-sm font-semibold text-gray-400 dark:border-gray-700">No number</span>
              )}
            </div>
          </div>
        ) : (
          <div key={item.tabId} className={`flex flex-col gap-2.5 rounded-[22px] bg-white p-4 text-gray-900 ring-1 dark:bg-gray-900 dark:text-white ${item.waiting ? "ring-2 ring-[#F2B33A]" : "ring-gray-200 dark:ring-gray-800"}`}>
            <div className="flex items-center justify-between gap-3">
              <p className="font-display text-xl font-bold">{item.tableLabel}</p>
              <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${item.waiting ? "bg-[#FFF1CC] text-[#7A5A16]" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-300"}`}>
                {item.waiting ? `waiting · reminder ${Math.min(item.reminders + 1, 3)} of 3` : ago(item.since, now)}
              </span>
            </div>
            <p className="text-2xl font-extrabold tabular-nums">
              {rwf(item.totalRwf)} <span className="text-xs font-bold text-gray-500 dark:text-gray-400">· MoMo{item.guestSaysPaid ? " · guest says paid" : ""}</span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => act(item, "received")} disabled={busy !== null} className="h-12 rounded-2xl bg-green-600 font-extrabold text-white disabled:opacity-50">
                {busy === `${item.tabId}:received` ? "…" : "✓ Received"}
              </button>
              <button onClick={() => act(item, "not-yet")} disabled={busy !== null} className="h-12 rounded-2xl border border-gray-300 bg-white font-bold text-gray-900 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900 dark:text-white">
                {busy === `${item.tabId}:not-yet` ? "…" : "Not yet"}
              </button>
            </div>
          </div>
        ),
      )}
    </section>
  );
}
