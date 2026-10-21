import { useEffect, useState } from "react";
import { apiFetch } from "../lib/apiFetch";

// "Served by Alice 🏆 Top waiter this week" with a Tip button, on the guest's
// bill and rating screens. The tip goes from the guest's MoMo straight to the
// waiter's (Skuzi never holds it); "I've sent it" tells the waiter right away.

interface Waiter {
  name: string;
  topThisWeek: boolean;
  fastService: boolean;
  rating: { avg: number; count: number } | null;
  tipMomo: string | null;
}

const AMOUNTS = [500, 1000, 2000];
const fmt = (n: number) => `${n.toLocaleString("en-US")} RWF`;
const spaced = (p: string) => p.replace(/^(\d{4})(\d{3})(\d{3})$/, "$1 $2 $3");

export default function WaiterTipCard({ tabId }: { tabId: string }) {
  const doneKey = `skuzi_tipped_${tabId}`;
  const [waiter, setWaiter] = useState<Waiter | null>(null);
  const [amount, setAmount] = useState<number | null>(1000);
  const [other, setOther] = useState("");
  const [step, setStep] = useState<"pick" | "send" | "done">(() => {
    try {
      return sessionStorage.getItem(doneKey) ? "done" : "pick";
    } catch {
      return "pick";
    }
  });
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch(`/tabs/${tabId}/waiter`)
      .then((r) => r.json())
      .then((d) => d.success && setWaiter(d.data))
      .catch(() => {});
  }, [tabId]);

  if (!waiter) return null;
  const tip = amount ?? (Number(other.replace(/\D/g, "")) || 0);
  const valid = tip >= 100 && tip <= 100000;

  const sent = async () => {
    setSending(true);
    setError("");
    try {
      const r = await apiFetch(`/tabs/${tabId}/tip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountRwf: tip }),
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      try {
        sessionStorage.setItem(doneKey, "1");
      } catch { /* private mode */ }
      setStep("done");
    } catch (e: any) {
      setError(e?.message || "That didn't go through. Try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <p className="text-xs font-black uppercase tracking-widest text-brand-500 dark:text-[#F0763A]">Served by</p>
      <div className="mt-2 flex items-center gap-3">
        <div className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-brand-500 text-xl font-black text-white">
          {waiter.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-lg font-black text-gray-900 dark:text-white">{waiter.name}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {waiter.topThisWeek && <span className="rounded-full bg-[#FFEDB8] px-2.5 py-0.5 text-xs font-extrabold text-[#7A5A16]">🏆 Top waiter this week</span>}
            {waiter.fastService && <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-extrabold text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">⚡ Fast service</span>}
            {waiter.rating && (
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-extrabold text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                ⭐ {waiter.rating.avg} · {waiter.rating.count} guests
              </span>
            )}
          </div>
        </div>
      </div>

      {waiter.tipMomo && step === "done" && (
        <div className="mt-4 rounded-2xl bg-green-50 px-4 py-3 text-center dark:bg-green-500/10">
          <p className="text-sm font-extrabold text-green-800 dark:text-green-300">Thank you! {waiter.name} has been told 💛</p>
        </div>
      )}

      {waiter.tipMomo && step === "pick" && (
        <>
          <p className="mt-4 text-sm font-bold text-gray-900 dark:text-white">Say thanks with a tip 💛</p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {AMOUNTS.map((a) => (
              <button
                key={a}
                onClick={() => setAmount(a)}
                className={`rounded-xl py-3 text-sm font-black ${amount === a ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900" : "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white"}`}
              >
                {a.toLocaleString("en-US")}
              </button>
            ))}
            <button
              onClick={() => setAmount(null)}
              className={`rounded-xl py-3 text-sm font-black ${amount === null ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900" : "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white"}`}
            >
              Other
            </button>
          </div>
          {amount === null && (
            <input
              value={other}
              onChange={(e) => setOther(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              placeholder="Amount in RWF"
              aria-label="Tip amount"
              autoFocus
              className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base font-bold text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          )}
          <button
            onClick={() => setStep("send")}
            disabled={!valid}
            className="mt-3 w-full rounded-2xl bg-[#FFCB05] py-4 text-base font-extrabold text-[#1B1B1B] disabled:opacity-50"
          >
            📱 Tip {waiter.name} {valid ? fmt(tip) : ""}
          </button>
          <p className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">Goes straight to {waiter.name}'s MoMo. 100% theirs.</p>
        </>
      )}

      {waiter.tipMomo && step === "send" && (
        <>
          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-gray-50 px-4 py-3 dark:bg-gray-800">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{waiter.name}'s MoMo</p>
              <p className="font-mono text-2xl font-black tracking-wider text-gray-900 dark:text-white">{spaced(waiter.tipMomo)}</p>
            </div>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(waiter.tipMomo!).then(() => setCopied(true)).catch(() => {});
                setTimeout(() => setCopied(false), 2000);
              }}
              className="rounded-full bg-white px-4 py-2 text-sm font-bold text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
          <a
            href={`tel:${encodeURIComponent("*182#")}`}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#FFCB05] py-4 text-base font-extrabold text-[#1B1B1B]"
          >
            📱 Open MoMo
          </a>
          <p className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
            In MoMo: Send money → {spaced(waiter.tipMomo)} → {fmt(tip)} → your PIN.
          </p>
          {error && <p role="alert" className="mt-2 text-center text-sm font-semibold text-red-600">{error}</p>}
          <button
            onClick={sent}
            disabled={sending}
            className="mt-3 w-full rounded-2xl bg-gray-900 py-4 text-base font-extrabold text-white disabled:opacity-60 dark:bg-white dark:text-gray-900"
          >
            {sending ? "…" : "I've sent it"}
          </button>
          <button onClick={() => setStep("pick")} className="mt-2 w-full text-center text-sm font-semibold text-gray-500 dark:text-gray-400">
            Change amount
          </button>
        </>
      )}
    </div>
  );
}
