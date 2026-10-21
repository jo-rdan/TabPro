import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import type { PlanStatus } from "@tabpro/shared";

// The package banner (trial ending, payment due) and the wall that goes up
// when it's unpaid 3+ days. Only the Plan page stays open behind the wall.

const rwf = (n: number) => `${n.toLocaleString("en-US")} RWF`;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Kigali" });

export function PlanBanner({ status }: { status?: PlanStatus }) {
  if (!status) return null;
  const soon = (status.state === "trial" || status.state === "paid") && status.daysLeft <= 3;
  if (!soon && status.state !== "grace") return null;
  const text =
    status.state === "grace"
      ? `Your package is unpaid. Pay ${rwf(status.priceRwf)} by ${day(status.locksAt)} to keep your dashboard.`
      : status.state === "trial"
        ? `Your free trial ends in ${status.daysLeft} ${status.daysLeft === 1 ? "day" : "days"}. Pay ${rwf(status.priceRwf)} to keep everything.`
        : `${status.planName} renews in ${status.daysLeft} ${status.daysLeft === 1 ? "day" : "days"}: ${rwf(status.priceRwf)}.`;
  return (
    <Link
      to="/subscription"
      className={`mb-4 flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-semibold ${status.state === "grace" ? "bg-red-600 text-white" : "bg-[#FFD966] text-gray-900"}`}
    >
      <span>⏰ {text}</span>
      <span className="flex-none rounded-full bg-gray-900 px-3 py-1.5 text-xs font-extrabold text-white">Pay with MoMo</span>
    </Link>
  );
}

export function PlanWall({ status, venueName }: { status: PlanStatus; venueName?: string }) {
  return (
    <div className="mx-auto mt-6 max-w-md rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 text-white">
        <Lock size={26} />
      </div>
      <h1 className="mt-4 font-display text-2xl font-bold text-gray-900 dark:text-white">Your dashboard is locked</h1>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
        {venueName ?? "Your venue"}'s {status.planName} package is unpaid. Pay {rwf(status.priceRwf)} with MoMo and everything opens again straight away.
      </p>
      <p className={`mt-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${status.orderingPaused ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300" : "bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-200"}`}>
        {status.orderingPaused
          ? "🚫 Guests can't order from their phones right now. They're waiting for the waiter again."
          : `Your waiters and guests still work for now. From ${day(status.pausesAt)}, guests can't order from their phones.`}
      </p>
      <Link to="/subscription" className="mt-5 block rounded-2xl bg-action py-3.5 text-base font-extrabold text-action-ink">
        Pay {rwf(status.priceRwf)} with MoMo
      </Link>
    </div>
  );
}
