import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Lock, Sparkles } from "lucide-react";
import { planAllows } from "@tabpro/shared";
import Layout from "../../components/Layout";
import { useAuthStore } from "../../lib/auth";
import Events from "./Events";
import Campaigns from "./Campaigns";

// Promote = the AI event planner (Max) on top, then every event and invite
// the venue sent, with "Plan your own event" (Pro). Events are campaigns with
// a date, so they all live in the one list.
export default function Promote() {
  const { venues, fetchMe } = useAuthStore();
  const venue = venues[0];
  useEffect(() => { if (!venue) fetchMe(); }, []);
  const plan = venue?.planStatus?.effectivePlan ?? venue?.plan;
  const aiOpen = !venue || planAllows(plan, "events");

  return (
    <Layout>
      <div className="mx-auto max-w-5xl">
        <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-white">Promote</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Bring your guests back: events, offers and invites.</p>
        <div className="mt-5">
          {aiOpen ? <Events embedded /> : (
            <Link to="/subscription?need=events" className="mx-auto flex max-w-2xl items-center gap-3 rounded-2xl bg-gray-900 p-5 text-white dark:bg-gray-800">
              <Sparkles size={22} className="flex-none text-[#FFD966]" />
              <span className="min-w-0 flex-1">
                <span className="block font-bold">Skuzi AI</span>
                <span className="block text-sm text-white/75">It plans events for your quiet nights. In Max.</span>
              </span>
              <Lock size={16} className="flex-none opacity-60" aria-label="Not in your package" />
            </Link>
          )}
        </div>
        <div className="mt-8"><Campaigns embedded /></div>
      </div>
    </Layout>
  );
}
