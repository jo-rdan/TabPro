import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, Lock, Smartphone } from "lucide-react";
import { PLANS, PLAN_FOR, type PlanFeature, type PlanId } from "@tabpro/shared";
import Layout from "../../components/Layout";
import api from "../../lib/api";
import { useAuthStore } from "../../lib/auth";

// Plan: the venue's package (Starter / Pro / Bar+), its free trial, and the
// MoMo Pay code guests pay. Skuzi takes nothing from sales.

type Status = {
  plan: PlanId; planName: string; priceRwf: number; trialEndsAt: string | null; trialDaysLeft: number;
  paidUntil: string | null; state: "trial" | "paid" | "due"; momoPayCode: string | null;
};

const SKUZI_WHATSAPP = "250781268924";
const rwf = (n: number) => `${n.toLocaleString("en-US")} RWF`;
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "Africa/Kigali" }) : "");

const INCLUDED: Record<PlanId, string[]> = {
  basic: ["QR menu and ordering at every table", "Skuzi! button: guests reach their waiter", "Your live dashboard, from anywhere", "Unlimited tables and staff"],
  pro: ["Everything in Starter", "Guests pay your MoMo Pay code from the bill", "History: every night, every bill", "Bookings and your page on Explore", "Campaigns that bring guests back"],
  elite: ["Everything in Pro", "Bar stock: every bottle counted", "Closing count shows what went missing", "Kitchen screen: the chef sees food orders, taps Ready", "Kitchen: food spending vs food sold"],
};

const FEATURE_NAME: Record<PlanFeature, string> = {
  history: "History", bookings: "Bookings", campaigns: "Campaigns", momo: "MoMo payments", stock: "Stock", kitchen: "The kitchen screen",
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
        <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-gray-50 px-3 py-2.5 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-300"><Lock size={14} /> Part of Pro and Bar+. On Starter, guests pay the waiter.</p>
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

export default function Subscription() {
  const { venues, fetchMe } = useAuthStore();
  const venue = venues[0];
  useEffect(() => { if (!venue) fetchMe(); }, []);
  const [status, setStatus] = useState<Status | null>(null);
  const [switching, setSwitching] = useState<PlanId | null>(null);
  const [error, setError] = useState("");
  const [params] = useSearchParams();
  const need = params.get("need") as PlanFeature | null;

  useEffect(() => { if (venue) api.get(`/plans/${venue.id}`).then((r) => setStatus(r.data.data)).catch(() => {}); }, [venue?.id]);

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

        {need && PLAN_FOR[need] && (
          <div className="mt-4 flex items-start gap-2 rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-800 dark:bg-white/5 dark:text-brand-200">
            <Lock size={16} className="mt-0.5 flex-none" /> {FEATURE_NAME[need]} is part of {PLANS[PLAN_FOR[need]].name}. Switch below to use it.
          </div>
        )}

        {status === null ? (
          <div className="mt-5 h-32 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
        ) : (
          <>
            <div className="mt-5 rounded-2xl bg-gray-900 p-5 text-white dark:bg-gray-800">
              <p className="text-xs font-bold uppercase tracking-wider text-white/60">Your package</p>
              <p className="mt-1 font-display text-3xl font-bold">{status.planName} <span className="text-base font-semibold text-white/70">· {rwf(status.priceRwf)} / month</span></p>
              <p className="mt-2 text-sm text-white/80">
                {status.state === "paid" && `Paid until ${day(status.paidUntil)} ✓`}
                {status.state === "trial" && `Free trial: ${status.trialDaysLeft} ${status.trialDaysLeft === 1 ? "day" : "days"} left (until ${day(status.trialEndsAt)})`}
                {status.state === "due" && "Your free trial has ended. Pay your package to keep going."}
              </p>
              {status.state === "due" && (
                <a href={`https://wa.me/${SKUZI_WHATSAPP}?text=${encodeURIComponent(`Hi Skuzi, I'd like to pay my ${status.planName} package for ${venue?.name ?? "my restaurant"}.`)}`} target="_blank" rel="noreferrer"
                  className="mt-3 inline-flex rounded-full bg-[#FFD966] px-4 py-2 text-sm font-extrabold text-gray-900">Pay on WhatsApp</a>
              )}
            </div>

            {venue && <div className="mt-4"><MomoCodeCard venueId={venue.id} status={status} onSaved={setStatus} /></div>}

            <h2 className="mt-7 font-display text-xl font-bold text-gray-900 dark:text-white">Packages</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">No setup fee, no machine, nothing taken from your sales.</p>
            {error && <p role="alert" className="mt-2 text-sm font-semibold text-red-600">{error}</p>}
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {(Object.keys(PLANS) as PlanId[]).map((id) => {
                const p = PLANS[id];
                const current = status.plan === id;
                return (
                  <div key={id} className={`flex flex-col rounded-2xl border-2 bg-white p-5 dark:bg-gray-900 ${current ? "border-brand-500" : "border-gray-200 dark:border-gray-800"}`}>
                    <div className="flex items-center justify-between">
                      <p className="font-display text-xl font-bold text-gray-900 dark:text-white">{p.name}</p>
                      {current && <span className="rounded-full bg-brand-500 px-2.5 py-0.5 text-[11px] font-extrabold uppercase text-white">Yours</span>}
                    </div>
                    <p className="mt-1 font-display text-2xl font-bold text-gray-900 dark:text-white">{p.priceRwf.toLocaleString("en-US")} <span className="text-sm font-semibold text-gray-500">RWF / month</span></p>
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
                        <a href={`https://wa.me/${SKUZI_WHATSAPP}?text=${encodeURIComponent(`Hi Skuzi, I'd like to switch ${venue?.name ?? "my restaurant"} to ${p.name}.`)}`} target="_blank" rel="noreferrer" className="mt-4 rounded-xl border-2 border-gray-900 py-2.5 text-center text-sm font-extrabold text-gray-900 dark:border-gray-100 dark:text-white">Switch on WhatsApp</a>
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
