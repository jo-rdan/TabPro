import { useEffect, useState } from "react";
import { PLANS, type PlanId } from "@tabpro/shared";
import Layout from "../../components/Layout";
import api from "../../lib/api";

// Founder only: every venue's package, trial and payment. Owners pay by MoMo
// in the app on their own; "Paid +1 month" is for a payment made outside it.

type Row = {
  id: string; name: string; isDemo: boolean; ownerName: string; ownerEmail: string; createdAt: string;
  plan: PlanId; planName: string; priceRwf: number; trialEndsAt: string | null; trialDaysLeft: number;
  paidUntil: string | null; state: "trial" | "paid" | "grace" | "locked"; orderingPaused: boolean; momoPayCode: string | null;
};

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Kigali" }) : "—");
const STATE: Record<Row["state"], string> = {
  trial: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  paid: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300",
  grace: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  locked: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
};

export default function PlansAdmin() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const load = () => api.get("/plans/admin/all").then((r) => setRows(r.data.data)).catch((e) => setError(e?.response?.data?.error ?? "Could not load"));
  useEffect(() => { load(); }, []);

  const update = async (id: string, body: Record<string, unknown>) => {
    setError("");
    try { await api.patch(`/plans/admin/${id}`, body); await load(); } catch (e: any) { setError(e?.response?.data?.error ?? "Could not save"); }
  };
  const paidMonth = (r: Row) => {
    const from = r.paidUntil && new Date(r.paidUntil) > new Date() ? new Date(r.paidUntil) : new Date();
    return update(r.id, { paidUntil: new Date(from.getTime() + 30 * 24 * 3600e3).toISOString() });
  };

  const live = rows?.filter((r) => !r.isDemo) ?? [];
  const mrr = live.filter((r) => r.state === "paid").reduce((n, r) => n + r.priceRwf, 0);

  return (
    <Layout>
      <div className="mx-auto max-w-4xl">
        <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-white">Plans</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Every restaurant's package. Only you see this page.</p>
        {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <div className="rounded-2xl border border-gray-200 bg-white p-3.5 dark:border-gray-800 dark:bg-gray-900"><p className="font-display text-2xl font-bold text-gray-900 dark:text-white">{live.length}</p><p className="text-xs text-gray-500">restaurants</p></div>
          <div className="rounded-2xl border border-gray-200 bg-white p-3.5 dark:border-gray-800 dark:bg-gray-900"><p className="font-display text-2xl font-bold text-gray-900 dark:text-white">{live.filter((r) => r.state === "trial").length}</p><p className="text-xs text-gray-500">in free trial</p></div>
          <div className="rounded-2xl border border-gray-200 bg-white p-3.5 dark:border-gray-800 dark:bg-gray-900"><p className="font-display text-2xl font-bold text-green-700 dark:text-green-400">{mrr.toLocaleString("en-US")}</p><p className="text-xs text-gray-500">RWF a month, paid</p></div>
        </div>
        <div className="mt-4 flex flex-col gap-2.5">
          {rows === null && !error && <div className="h-24 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />}
          {rows?.map((r) => (
            <div key={r.id} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 dark:text-white">{r.name} {r.isDemo && <span className="text-xs font-semibold text-gray-400">(demo)</span>}</p>
                  <p className="truncate text-xs text-gray-500">{r.ownerName} · {r.ownerEmail} · joined {day(r.createdAt)}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase ${STATE[r.state]}`}>
                  {r.state === "trial" ? `Trial · ${r.trialDaysLeft}d left` : r.state === "paid" ? `Paid · until ${day(r.paidUntil)}` : r.state === "grace" ? "Unpaid · grace" : r.orderingPaused ? "Locked · ordering paused" : "Locked"}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <select value={r.plan} onChange={(e) => update(r.id, { plan: e.target.value })} aria-label={`Package for ${r.name}`}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white">
                  {(Object.keys(PLANS) as PlanId[]).map((id) => <option key={id} value={id}>{PLANS[id].name} · {PLANS[id].priceRwf.toLocaleString("en-US")}</option>)}
                </select>
                <label className="flex items-center gap-1.5 text-xs text-gray-500">Trial ends
                  <input type="date" defaultValue={r.trialEndsAt?.slice(0, 10)} onBlur={(e) => e.target.value && update(r.id, { trialEndsAt: new Date(e.target.value + "T21:00:00Z").toISOString() })}
                    className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                </label>
                <button onClick={() => paidMonth(r)} className="rounded-xl bg-green-600 px-3 py-2 text-sm font-extrabold text-white">Paid +1 month</button>
                {r.paidUntil && <button onClick={() => update(r.id, { paidUntil: null })} className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 dark:border-gray-700 dark:text-gray-300">Clear payment</button>}
                <span className="text-xs text-gray-400">MoMo Pay code: {r.momoPayCode ?? "not set"}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
