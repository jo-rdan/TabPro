import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, CreditCard, Lock, Smartphone, Loader2 } from "lucide-react";
import { PLANS, PLAN_FOR, planPrice, type PlanFeature, type PlanId, type PlanStatus } from "@tabpro/shared";
import Layout from "../../components/Layout";
import { FoundingStrip } from "../../components/PlanWall";
import api from "../../lib/api";
import { useAuthStore } from "../../lib/auth";
import { INCLUDED } from "../../lib/packages";

// Plan: the venue's package (Go / Pro / Max), its free trial (with
// everything), paying a month with MoMo, and the MoMo Pay code guests pay.
// Skuzi takes nothing from sales.

type Status = PlanStatus;
const rwf = (n: number) => `${n.toLocaleString("en-US")} RWF`;
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "Africa/Kigali" }) : "");


const FEATURE_NAME: Record<PlanFeature, string> = {
  history: "History", bookings: "Bookings", campaigns: "Campaigns", momo: "MoMo payments", stock: "Stock", kitchen: "The kitchen screen", events: "Skuzi AI",
};

function MomoCodeCard({ venueId, status, onSaved }: { venueId: string; status: Status; onSaved: (s: Status) => void }) {
  const [code, setCode] = useState(status.momoPayCode ?? "");
  const [editing, setEditing] = useState(!status.momoPayCode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const allowed = PLANS[status.plan].features.includes("momo");
  const save = async () => {
    setSaving(true); setError("");
    try {
      const r = await api.patch(`/plans/${venueId}/momo-code`, { code });
      onSaved(r.data.data); setEditing(false);
    } catch (e: any) { setError(e?.response?.data?.error ?? "Could not save. Try again."); } finally { setSaving(false); }
  };
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <p className="flex items-center gap-1.5 text-sm font-bold text-gray-900 dark:text-white"><Smartphone size={16} /> Your MoMo Pay code</p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Guests pay this code from their bill. <b className="text-gray-900 dark:text-white">100% goes straight to you</b>: Skuzi takes nothing from your sales. Your waiter taps "Paid" once it shows on your MoMo.
      </p>
      {!allowed ? (
        <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-gray-50 px-3 py-2.5 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-300"><Lock size={14} /> Part of every package.</p>
      ) : editing ? (
        <div className="mt-3">
          <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="e.g. 123456" aria-label="MoMo Pay code"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 font-display text-2xl font-bold tracking-[0.12em] text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
          {error && <p role="alert" className="mt-2 text-sm font-semibold text-red-600">{error}</p>}
          <div className="mt-2 flex gap-2">
            <button onClick={save} disabled={saving || code.length < 4} className="flex-1 rounded-xl bg-action py-2.5 text-sm font-extrabold text-action-ink disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
            {status.momoPayCode && <button onClick={() => { setCode(status.momoPayCode ?? ""); setEditing(false); }} className="rounded-xl border border-gray-200 px-4 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">Cancel</button>}
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center justify-between">
          <p className="font-display text-2xl font-bold tracking-[0.12em] text-gray-900 dark:text-white">{status.momoPayCode}</p>
          <button onClick={() => setEditing(true)} className="text-sm font-bold text-brand-600 dark:text-brand-300">Change</button>
        </div>
      )}
    </div>
  );
}

// Pays one month of a package from the owner's MoMo: their phone asks for the
// PIN, then this checks every few seconds until MoMo confirms.
function PayCard({ venueId, plan, founding, deal, card, onPaid }: { venueId: string; plan: PlanId; founding: boolean; deal: number | null; card: boolean; onPaid: (s: Status) => void }) {
  const [phone, setPhone] = useState(() => localStorage.getItem("skuzi_pay_phone") ?? "");
  const [step, setStep] = useState<"form" | "waiting" | "done">("form");
  // Every package can be paid for a year at once, cheaper the bigger the package.
  const { priceRwf: monthRwf, sixMonthRwf, yearlyRwf } = planPrice(plan, founding, deal);
  const [period, setPeriod] = useState<"month" | "half" | "year">("month");
  const price = (period === "year" && yearlyRwf) || (period === "half" && sixMonthRwf) || monthRwf;
  const months = period === "year" ? 12 : period === "half" ? 6 : 1;
  const [error, setError] = useState("");
  const [opening, setOpening] = useState(false);
  const timer = useRef<number>();

  // Card: Lemon Squeezy's page takes the card, then comes back here.
  const payByCard = async () => {
    setError(""); setOpening(true);
    try {
      const r = await api.post(`/plans/${venueId}/card`, { plan, period });
      window.location.href = r.data.data.url;
    } catch (e: any) {
      setError(e?.response?.data?.error ?? "Could not open the card payment. Try again.");
      setOpening(false);
    }
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const pay = async () => {
    setError("");
    try {
      localStorage.setItem("skuzi_pay_phone", phone);
    } catch { /* private mode */ }
    try {
      const r = await api.post(`/plans/${venueId}/pay`, { plan, phone, period });
      setStep("waiting");
      const { depositId } = r.data.data;
      const started = Date.now();
      const check = async () => {
        try {
          const c = await api.get(`/plans/${venueId}/pay/${depositId}`);
          const d = c.data.data;
          if (d.status === "successful") { setStep("done"); onPaid(d.plan); return; }
          if (d.status === "failed") { setStep("form"); setError(d.error || "The payment didn't go through. Try again."); return; }
        } catch { /* keep checking */ }
        if (Date.now() - started > 3 * 60_000) { setStep("form"); setError("No answer from MoMo yet. If money left your account, it will show here within a few minutes."); return; }
        timer.current = window.setTimeout(check, 3000);
      };
      timer.current = window.setTimeout(check, 3000);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? "Could not start the payment. Try again.");
    }
  };

  if (step === "done") return <p className="mt-3 rounded-xl bg-green-500/15 px-4 py-3 text-sm font-bold text-green-800 dark:text-green-200">Paid ✓ Thank you!</p>;
  if (step === "waiting") {
    return (
      <p className="mt-3 flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold">
        <Loader2 size={16} className="animate-spin" /> Check your phone and approve with your MoMo PIN…
      </p>
    );
  }
  return (
    <div className="mt-3">
      {yearlyRwf && (
        <div className="mb-2 inline-flex flex-wrap rounded-xl bg-white/10 p-1" role="group" aria-label="How long to pay for">
          {(["month", "half", "year"] as const).map((p) => (
            <button key={p} onClick={() => setPeriod(p)} aria-pressed={period === p}
              className={`rounded-lg px-3 py-1.5 text-xs font-extrabold ${period === p ? "bg-white text-gray-900" : "text-white/80"}`}>
              {p === "month" ? "1 month" : p === "half" ? "6 months" : "1 year · 2 months free"}
            </button>
          ))}
        </div>
      )}
      {card && (
        <>
          <button onClick={payByCard} disabled={opening}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FFD966] px-5 py-3 text-sm font-extrabold text-gray-900 disabled:opacity-60">
            <CreditCard size={16} /> {opening ? "Opening…" : `Pay ${rwf(price)} by card`}
          </button>
          <p className="mt-1.5 text-xs text-white/60">Renews by itself. Stop any time.</p>
          <p className="my-3 text-center text-xs font-bold uppercase tracking-wider text-white/40">or with MoMo</p>
        </>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="Your MoMo number, 07…" aria-label="MoMo number to pay from"
          className="min-w-0 flex-1 rounded-xl bg-white px-4 py-3 text-base font-semibold text-gray-900 placeholder-gray-400" />
        <button onClick={pay} disabled={phone.replace(/\D/g, "").length < 9}
          className="rounded-xl bg-[#FFD966] px-5 py-3 text-sm font-extrabold text-gray-900 disabled:opacity-60">
          Pay {rwf(price)} with MoMo
        </button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm font-semibold text-red-200">{error}</p>}
      <p className="mt-2 text-xs text-white/60">{months === 1 ? `One month of ${PLANS[plan].name}.` : `${months === 12 ? "A full year" : "6 months"} of ${PLANS[plan].name}: you save ${rwf(monthRwf * months - price)}.`} Paying early never loses days.</p>
    </div>
  );
}

export default function Subscription() {
  const { venues, fetchMe } = useAuthStore();
  const venue = venues[0];
  useEffect(() => { if (!venue) fetchMe(); }, []);
  const [status, setStatus] = useState<Status | null>(null);
  const [switching, setSwitching] = useState<PlanId | null>(null);
  const [error, setError] = useState("");
  const [params] = useSearchParams();
  const need = params.get("need") as PlanFeature | null;
  // Which package to pay for (after the trial, paying is how you switch).
  const [payFor, setPayFor] = useState<PlanId | null>(null);
  const paid = async (s: Status | null) => { if (s) setStatus((old) => ({ ...s, card: old?.card })); await fetchMe(); };
  // Back from the card page: the payment lands a few seconds later.
  const cardDone = params.get("card") === "done";

  useEffect(() => {
    if (!venue) return;
    const load = () => api.get(`/plans/${venue.id}`).then((r) => setStatus(r.data.data)).catch(() => {});
    load();
    if (!cardDone) return;
    const t = [4000, 10000, 25000].map((ms) => window.setTimeout(load, ms));
    return () => t.forEach(window.clearTimeout);
  }, [venue?.id]);

  const choose = async (plan: PlanId) => {
    if (!venue) return;
    setSwitching(plan); setError("");
    try { const r = await api.patch(`/plans/${venue.id}`, { plan }); setStatus(r.data.data); await fetchMe(); }
    catch (e: any) { setError(e?.response?.data?.error ?? "Could not switch. Try again."); } finally { setSwitching(null); }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-white">Plan</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{venue?.name}</p>
        {cardDone && (
          <p className="mt-4 rounded-2xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-800 dark:bg-green-500/10 dark:text-green-200">
            💳 Card payment received, thank you! Your package updates here within a minute.
          </p>
        )}

        {need && PLAN_FOR[need] && (
          <div className="mt-4 flex items-start gap-2 rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-800 dark:bg-white/5 dark:text-brand-200">
            <Lock size={16} className="mt-0.5 flex-none" /> {FEATURE_NAME[need]} is part of {PLANS[PLAN_FOR[need]].name}. Switch below to use it.
          </div>
        )}

        {status === null ? (
          <div className="mt-5 h-32 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
        ) : (
          <>
            {(status.founding || !!status.dealPriceRwf) && <div className="mt-5"><FoundingStrip founding={status.founding} dealRwf={status.dealPriceRwf} /></div>}
            <div className="mt-5 rounded-2xl bg-gray-900 p-5 text-white dark:bg-gray-800">
              <p className="text-xs font-bold uppercase tracking-wider text-white/60">Your package</p>
              <p className="mt-1 font-display text-3xl font-bold">{status.planName} <span className="text-base font-semibold text-white/70">· {rwf(status.priceRwf)} / month</span></p>
              <p className="mt-2 text-sm text-white/80">
                {status.state === "paid" && `Paid until ${day(status.paidUntil)} ✓`}
                {status.state === "trial" && `Free trial with everything unlocked: ${status.trialDaysLeft} ${status.trialDaysLeft === 1 ? "day" : "days"} left (until ${day(status.trialEndsAt)})`}
                {status.state === "grace" && `Unpaid. Pay by ${day(status.locksAt)} to keep your dashboard.`}
                {status.state === "locked" && (status.orderingPaused ? "Unpaid: your dashboard is locked and guests can't order from their phones." : `Unpaid: your dashboard is locked. Guests stop ordering from their phones on ${day(status.pausesAt)}.`)}
              </p>
              {venue && <PayCard key={payFor ?? status.plan} venueId={venue.id} plan={payFor ?? status.plan} founding={status.founding} deal={status.dealPriceRwf} card={!!status.card && !status.dealPriceRwf} onPaid={paid} />}
            </div>

            {venue && <div className="mt-4"><MomoCodeCard venueId={venue.id} status={status} onSaved={setStatus} /></div>}

            <h2 className="mt-7 font-display text-xl font-bold text-gray-900 dark:text-white">Packages</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">No setup fee, no machine, nothing taken from your sales.</p>
            {error && <p role="alert" className="mt-2 text-sm font-semibold text-red-600">{error}</p>}
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {(Object.keys(PLANS) as PlanId[]).map((id) => {
                const p = PLANS[id];
                const current = status.plan === id;
                const yours = planPrice(id, status.founding, status.dealPriceRwf).priceRwf;
                return (
                  <div key={id} className={`flex flex-col rounded-2xl border-2 bg-white p-5 dark:bg-gray-900 ${current ? "border-brand-500" : "border-gray-200 dark:border-gray-800"}`}>
                    <div className="flex items-center justify-between">
                      <p className="font-display text-xl font-bold text-gray-900 dark:text-white">{p.name}</p>
                      {current && <span className="rounded-full bg-brand-500 px-2.5 py-0.5 text-[11px] font-extrabold uppercase text-white">Yours</span>}
                    </div>
                    {yours < p.priceRwf && (
                      <p className="mt-1 w-fit rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-extrabold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">{status.dealPriceRwf ? "⭐ Your special price" : "⭐ Founding venue · Pro price"}</p>
                    )}
                    <p className="mt-1 font-display text-2xl font-bold text-gray-900 dark:text-white">
                      {yours.toLocaleString("en-US")} <span className="text-sm font-semibold text-gray-500">RWF / month</span>
                      {yours < p.priceRwf && <span className="ml-2 text-sm font-semibold text-gray-400 line-through">{p.priceRwf.toLocaleString("en-US")}</span>}
                    </p>
                    <p className="text-xs font-bold text-green-700 dark:text-green-400">{p.trialDays === 14 ? "2 weeks free" : "1 month free"}</p>
                    <ul className="mt-3 flex-1 space-y-2">
                      {INCLUDED[id].map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300"><Check size={15} className="mt-0.5 flex-none text-brand-500" />{f}</li>
                      ))}
                    </ul>
                    {!current && (
                      status.state === "trial" ? (
                        <button onClick={() => choose(id)} disabled={switching !== null} className="mt-4 rounded-xl bg-action py-2.5 text-sm font-extrabold text-action-ink disabled:opacity-50">{switching === id ? "Switching…" : `Switch to ${p.name}`}</button>
                      ) : (
                        <button onClick={() => { setPayFor(id); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="mt-4 rounded-xl border-2 border-gray-900 py-2.5 text-center text-sm font-extrabold text-gray-900 dark:border-gray-100 dark:text-white">
                          {payFor === id ? "Selected ↑ pay above" : `Pay for ${p.name} instead`}
                        </button>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
