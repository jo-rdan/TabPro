import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Lock } from "lucide-react";
import { planAllows } from "@tabpro/shared";
import Layout from "../../components/Layout";
import { useAuthStore } from "../../lib/auth";
import NightReport from "./NightReport";
import ActivityLog from "./ActivityLog";

// Reports = the night report (what you should have) and every bill (History),
// one switch apart. ?view=bills opens the bills; ?night= still works.
export default function Reports() {
  const { venues, fetchMe } = useAuthStore();
  const venue = venues[0];
  useEffect(() => { if (!venue) fetchMe(); }, []);
  const [params, setParams] = useSearchParams();
  const bills = params.get("view") === "bills";
  const plan = venue?.planStatus?.effectivePlan ?? venue?.plan;
  const billsOpen = !venue || planAllows(plan, "history");
  const tab = (on: boolean) =>
    `flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${on ? "bg-white text-gray-900 shadow-sm dark:bg-brand-500 dark:text-white" : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"}`;

  return (
    <Layout>
      <div className="mx-auto max-w-2xl print:max-w-none">
        <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-white print:hidden">Reports</h1>
        <div role="tablist" aria-label="Reports" className="mt-4 mb-5 flex gap-1 rounded-2xl bg-gray-100 p-1 dark:bg-white/10 print:hidden">
          <button role="tab" aria-selected={!bills} onClick={() => setParams({})} className={tab(!bills)}>Night report</button>
          <button role="tab" aria-selected={bills} onClick={() => setParams({ view: "bills" })} className={tab(bills)}>
            Every bill {!billsOpen && <Lock size={12} className="ml-1 inline opacity-60" aria-label="Not in your package" />}
          </button>
        </div>
        {!bills ? <NightReport embedded /> : billsOpen ? <ActivityLog embedded /> : (
          <Link to="/subscription?need=history" className="block rounded-2xl border border-gray-200 bg-white p-5 text-center dark:border-gray-800 dark:bg-[#3B2149]">
            <p className="font-bold text-gray-900 dark:text-white">Every bill, night by night</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Who served it, how it was paid, any night you pick. In Pro.</p>
          </Link>
        )}
      </div>
    </Layout>
  );
}
