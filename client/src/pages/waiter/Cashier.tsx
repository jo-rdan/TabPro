import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BellRing, LogOut } from "lucide-react";
import MomoToConfirm, { MomoSummary } from "../../components/MomoToConfirm";
import LanguageSwitch from "../../components/LanguageSwitch";
import { usePushNotifications, useKeepPushSubscribed } from "../../hooks/usePushNotifications";

// The cashier's screen: they hold the venue's MoMo Pay phone, so they confirm
// that each MoMo payment really arrived. Nothing else: no tables, no menu.

export default function Cashier() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const venueId = params.get("venueId") || localStorage.getItem("tabpro_staff_venue") || "";
  const token = params.get("token") || localStorage.getItem("tabpro_staff_token") || "";
  const staffId = localStorage.getItem("tabpro_staff_id") || undefined;
  const name = (() => {
    try {
      return (JSON.parse(localStorage.getItem("tabpro_staff_session") || "{}").name || "").split(" ")[0];
    } catch {
      return "";
    }
  })();
  const [summary, setSummary] = useState<MomoSummary | null>(null);
  const { isSupported, permission, subscribe, needsHomeScreen } = usePushNotifications();
  const [pushState, setPushState] = useState<"idle" | "error">("idle");
  useKeepPushSubscribed(venueId && token ? { venueId, staffId, token } : null);

  const signOut = () => {
    ["tabpro_staff_session", "tabpro_staff_token", "tabpro_staff_id", "tabpro_staff_venue"].forEach((k) => localStorage.removeItem(k));
    navigate("/waiter", { replace: true });
  };

  if (!venueId || !token) {
    return (
      <div className="min-h-screen bg-[#2B1838] text-white flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="font-display text-2xl font-bold">Sign in to confirm MoMo payments</p>
        <button onClick={() => navigate("/waiter")} className="rounded-2xl bg-[#E2602A] px-6 py-3 font-extrabold">Sign in</button>
      </div>
    );
  }

  const waitingCount = summary?.items.length ?? 0;

  return (
    <div className="min-h-screen bg-[#2B1838] text-white">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-[#2B1838]/95 px-4 py-3 backdrop-blur sm:px-6">
        <div>
          <p className="font-display text-2xl font-bold leading-none">💰 Cashier</p>
          <p className="mt-1 text-sm font-semibold text-[#D9C6E6]">
            {waitingCount} to confirm{name && ` · ${name}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
        <LanguageSwitch onColor />
        <button onClick={signOut} aria-label="Sign out" className="rounded-xl bg-white/10 p-2.5 text-white/80">
          <LogOut size={16} />
        </button>
        </div>
      </header>

      <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 pb-10 sm:px-6">
        {isSupported && permission !== "granted" && (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#FFD966] px-4 py-3 text-gray-900">
            <p className="flex items-center gap-2 text-sm font-bold">
              <BellRing size={16} />
              {needsHomeScreen
                ? "Add Skuzi to your Home Screen to get MoMo alerts"
                : pushState === "error"
                  ? "Couldn't turn on alerts. Try again."
                  : "Turn on alerts so you hear when a guest pays"}
            </p>
            {!needsHomeScreen && (
              <button
                onClick={async () => setPushState((await subscribe({ venueId, staffId, token })) ? "idle" : "error")}
                className="flex-none rounded-xl bg-gray-900 px-3 py-2 text-sm font-extrabold text-white"
              >
                Turn on
              </button>
            )}
          </div>
        )}

        {/* The list itself reads in light colours on this dark page. */}
        <div className="[&_h2]:text-white [&_section>div:first-child_span]:text-white">
          <MomoToConfirm venueId={venueId} token={token} onSummary={setSummary} />
        </div>

        {summary && (
          <div className="flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3 text-sm">
            <span className="text-[#D9C6E6]">Confirmed tonight</span>
            <b className="tabular-nums">
              {summary.confirmedTonight.bills} {summary.confirmedTonight.bills === 1 ? "bill" : "bills"} · {summary.confirmedTonight.totalRwf.toLocaleString("en-US")} RWF
            </b>
          </div>
        )}
      </main>
    </div>
  );
}
