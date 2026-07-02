import { useState, useEffect, useRef } from "react";
import {
  Check,
  Zap,
  Crown,
  Phone,
  Loader2,
  CheckCircle,
  XCircle,
} from "lucide-react";
import Layout from "../../components/Layout";
import { useAuthStore } from "../../lib/auth";
import api from "../../lib/api";

interface SubData {
  plan: "basic" | "pro" | "elite";
  status: string;
  trialDaysLeft: number;
  isTrialActive: boolean;
  isTrialExpired: boolean;
  trialEndsAt: string | null;
}

type PlanKey = "basic" | "pro" | "elite";
type PayStep = "idle" | "phone" | "pending" | "success" | "failed";
type Billing = "monthly" | "yearly";

const PLANS = [
  {
    key: "basic" as PlanKey,
    name: "Basic",
    monthlyRwf: 20000,
    yearlyRwf: 18000,
    icon: Zap,
    color: "text-blue-500",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    popular: false,
    features: [
      "QR ordering for all tables",
      "Real-time waiter notifications",
      "Bill generation and tab management",
      "Customer ratings",
      "Staff points and leaderboard",
      "Owner live dashboard",
      "Activity log",
    ],
  },
  {
    key: "pro" as PlanKey,
    name: "Pro",
    monthlyRwf: 39000,
    yearlyRwf: 35000,
    icon: Crown,
    color: "text-purple-500",
    bg: "bg-purple-50 dark:bg-purple-900/20",
    popular: true,
    features: [
      "Everything in Basic",
      "Ratings breakdown and per-waiter stats",
      "Busy hours heatmap and analytics",
      "Staff clock-in and shift management",
      "Priority support",
    ],
  },
];

function fmt(n: number) {
  return `${n.toLocaleString()} RWF`;
}

export default function Subscription() {
  const { venues, fetchMe } = useAuthStore();
  const venue = venues[0];
  useEffect(() => {
    if (!venue) fetchMe();
  }, []);

  const [sub, setSub] = useState<SubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [billing, setBilling] = useState<Billing>("monthly");

  const [selectedPlan, setSelectedPlan] = useState<PlanKey | null>(null);
  const [phone, setPhone] = useState("");
  const [payStep, setPayStep] = useState<PayStep>("idle");
  const [payError, setPayError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!venue) return;
      try {
        const res = await api.get(`/subscriptions/${venue.id}`);
        setSub(res.data.data);
      } catch {
        /* silent */
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [venue]);

  useEffect(
    () => () => {
      if (pollRef.current) clearInterval(pollRef.current);
    },
    [],
  );

  const startPay = (planKey: PlanKey) => {
    setSelectedPlan(planKey);
    setPhone("");
    setPayError("");
    setPayStep("phone");
  };

  const cancelPay = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setPayStep("idle");
    setSelectedPlan(null);
    setPayError("");
  };

  const submitPayment = async () => {
    if (!venue || !selectedPlan) return;
    if (phone.replace(/\D/g, "").length < 9) {
      setPayError("Enter a valid MTN Rwanda number (e.g. 0781234567)");
      return;
    }
    setPayError("");
    setPayStep("pending");
    try {
      const planData = PLANS.find((p) => p.key === selectedPlan)!;
      const amountRwf =
        billing === "yearly" ? planData.yearlyRwf * 12 : planData.monthlyRwf;
      const res = await api.post(`/momo/${venue.id}/pay`, {
        plan: selectedPlan,
        phone,
        amountRwf,
      });
      const ref: string = res.data.data.referenceId;

      let attempts = 0;
      pollRef.current = setInterval(async () => {
        attempts++;
        try {
          const check = await api.get(`/momo/status/${ref}`);
          const { status } = check.data.data;
          if (status === "successful") {
            clearInterval(pollRef.current!);
            setPayStep("success");
            const updated = await api.get(`/subscriptions/${venue.id}`);
            setSub(updated.data.data);
            fetchMe();
          } else if (status === "failed") {
            clearInterval(pollRef.current!);
            setPayStep("failed");
            setPayError("Payment was declined or cancelled. Please try again.");
          } else if (attempts >= 36) {
            clearInterval(pollRef.current!);
            setPayStep("failed");
            setPayError(
              "Payment timed out. If you approved the prompt, please contact support.",
            );
          }
        } catch {
          /* keep polling */
        }
      }, 5000);
    } catch (err: any) {
      setPayStep("phone");
      setPayError(
        err.response?.data?.error || "Failed to initiate payment. Try again.",
      );
    }
  };

  const selectedPlanData = PLANS.find((p) => p.key === selectedPlan);
  const selectedPrice = selectedPlanData
    ? billing === "yearly"
      ? selectedPlanData.yearlyRwf * 12
      : selectedPlanData.monthlyRwf
    : 0;

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Subscription
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {venue?.name}
        </p>
      </div>

      {/* Current status banner */}
      {sub && (
        <div
          className={`rounded-2xl border p-5 mb-6 ${
            sub.isTrialExpired
              ? "bg-red-50 dark:bg-red-900/20 border-red-200/70 dark:border-red-700/40"
              : sub.isTrialActive
                ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200/70 dark:border-amber-700/40"
                : "bg-brand-50 dark:bg-brand-900/20 border-brand-200/70 dark:border-brand-700/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white capitalize">
                {sub.status === "trialing"
                  ? sub.isTrialActive
                    ? `Free trial — ${sub.trialDaysLeft} days left`
                    : "Trial expired"
                  : `${sub.plan} plan — Active`}
              </p>
              {sub.isTrialActive && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Trial ends{" "}
                  {sub.trialEndsAt
                    ? new Date(sub.trialEndsAt).toLocaleDateString()
                    : ""}
                </p>
              )}
              {sub.isTrialExpired && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                  Subscribe to keep using TabPro
                </p>
              )}
            </div>
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full ${
                sub.status === "active"
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : sub.isTrialActive
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              }`}
            >
              {sub.status === "active"
                ? "Active"
                : sub.isTrialActive
                  ? "Trial"
                  : "Expired"}
            </span>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Billing toggle */}
      {!loading && (
        <>
          <div className="flex items-center justify-center gap-3 mb-6">
            <button
              onClick={() => setBilling("monthly")}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                billing === "monthly"
                  ? "bg-brand-500 text-white"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling("yearly")}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                billing === "yearly"
                  ? "bg-brand-500 text-white"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              Yearly{" "}
              <span className="text-xs font-bold text-green-500 ml-1">
                −10%
              </span>
            </button>
          </div>

          {/* Plan cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 max-w-2xl mx-auto w-full">
            {PLANS.map((plan) => {
              const Icon = plan.icon;
              const isCurrent =
                sub?.plan === plan.key && sub?.status === "active";
              const price =
                billing === "yearly" ? plan.yearlyRwf * 12 : plan.monthlyRwf;

              return (
                <div
                  key={plan.key}
                  className={`relative bg-white dark:bg-[#161B22] border-2 rounded-2xl p-6 flex flex-col ${
                    plan.popular
                      ? "border-amber-400 dark:border-amber-500 shadow-lg shadow-amber-500/10"
                      : isCurrent
                        ? "border-brand-500"
                        : "border-gray-200 dark:border-gray-800"
                  }`}
                >
                  {/* Most popular badge */}
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-[#2D1A00] text-amber-500 text-xs font-black px-3 py-1 rounded-full whitespace-nowrap">
                        Most popular
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-8 h-8 rounded-lg ${plan.bg} flex items-center justify-center`}
                      >
                        <Icon size={16} className={plan.color} />
                      </div>
                      <span className="text-sm font-bold text-gray-900 dark:text-white">
                        {plan.name}
                      </span>
                    </div>
                    {isCurrent && (
                      <span className="text-xs bg-brand-500 text-white px-2 py-0.5 rounded-full font-medium">
                        Current
                      </span>
                    )}
                  </div>

                  <p className="text-2xl font-bold text-gray-900 dark:text-white mb-0.5">
                    {fmt(price)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
                    {billing === "yearly" ? "per year" : "per month"}
                    {billing === "yearly" && (
                      <span className="text-green-500 font-semibold ml-1">
                        (10% off, billed yearly)
                      </span>
                    )}
                  </p>

                  <ul className="space-y-2 mb-6 flex-1">
                    {plan.features.map((f) => (
                      <li
                        key={f}
                        className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400"
                      >
                        <Check
                          size={13}
                          className="text-brand-500 mt-0.5 flex-shrink-0"
                        />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200/70 dark:border-green-700/40 rounded-xl p-3 text-center">
                      <p className="text-xs font-semibold text-green-700 dark:text-green-400">
                        You're on this plan
                      </p>
                    </div>
                  ) : (
                    <button
                      onClick={() => startPay(plan.key)}
                      className={`w-full text-white text-sm font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 ${
                        plan.popular
                          ? "bg-amber-400 hover:bg-amber-500 text-amber-900"
                          : "bg-brand-500 hover:bg-brand-600"
                      }`}
                    >
                      <Phone size={14} />
                      Pay with MoMo
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer note */}
          <p className="text-center text-xs text-gray-400 mt-6">
            30-day free trial on all plans · Free setup & training · No hidden fees
          </p>
        </>
      )}

      {/* MoMo Payment Modal */}
      {payStep !== "idle" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={payStep === "pending" ? undefined : cancelPay}
          />
          <div className="relative bg-white dark:bg-[#161B22] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-xl">
            {payStep === "phone" && (
              <>
                <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">
                  Pay with MTN MoMo
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
                  You'll receive a payment prompt on your phone for{" "}
                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                    {fmt(selectedPrice)}
                    {billing === "yearly" ? "/year" : "/month"} (
                    {selectedPlanData?.name} plan)
                  </span>
                </p>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  MTN Rwanda phone number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 0781234567"
                  className="w-full px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-[#0D1117] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 mb-2"
                />
                {payError && (
                  <p className="text-xs text-red-500 mb-3">{payError}</p>
                )}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={cancelPay}
                    className="flex-1 border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 font-semibold py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitPayment}
                    className="flex-1 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
                  >
                    Send prompt
                  </button>
                </div>
              </>
            )}

            {payStep === "pending" && (
              <div className="text-center py-4">
                <Loader2
                  size={36}
                  className="text-brand-500 animate-spin mx-auto mb-4"
                />
                <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">
                  Waiting for payment
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  A payment prompt has been sent to{" "}
                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                    {phone}
                  </span>
                  . Approve it on your phone to continue.
                </p>
                <p className="text-xs text-gray-400 mt-3">
                  This page will update automatically.
                </p>
              </div>
            )}

            {payStep === "success" && (
              <div className="text-center py-4">
                <CheckCircle
                  size={40}
                  className="text-green-500 mx-auto mb-4"
                />
                <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">
                  Payment successful!
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
                  Your{" "}
                  <span className="font-semibold capitalize">
                    {selectedPlan}
                  </span>{" "}
                  plan is now active.
                </p>
                <button
                  onClick={cancelPay}
                  className="w-full bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
                >
                  Done
                </button>
              </div>
            )}

            {payStep === "failed" && (
              <div className="text-center py-4">
                <XCircle size={40} className="text-red-500 mx-auto mb-4" />
                <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">
                  Payment failed
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  {payError}
                </p>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={cancelPay}
                    className="flex-1 border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 font-semibold py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setPayStep("phone")}
                    className="flex-1 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
                  >
                    Try again
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
