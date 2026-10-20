import { useEffect, useState } from "react";
import { Zap, Check, Phone } from "lucide-react";
import Layout from "../../components/Layout";
import api from "../../lib/api";
import { useAuthStore } from "../../lib/auth";

// Where the venue's share of MoMo payments goes. Without it, customers can't
// pay through the app.
function PayoutNumberCard({ venueId, current, onSaved }: { venueId: string; current: string | null | undefined; onSaved: () => void }) {
  const [editing, setEditing] = useState(!current);
  const [value, setValue] = useState(current ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await api.patch(`/venues/${venueId}/momo-phone`, { momoPhone: value.trim() });
      await onSaved();
      setEditing(false);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#231A2C] border border-gray-200 dark:border-gray-800 rounded-2xl p-5 mb-4">
      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Mobile Money payout number</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        {current ? "Your share of every in-app payment is sent here." : "Add your number so customers can pay through the app."}
      </p>
      {editing ? (
        <>
          <div className="relative mb-2">
            <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="tel"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g. 0788123456"
              className="w-full pl-8 pr-3 py-2 text-sm rounded-xl bg-gray-50 dark:bg-[#1B1524] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving || !value.trim()}
              className="flex-1 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            {current && (
              <button
                onClick={() => { setValue(current); setEditing(false); setError(""); }}
                className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300"
              >
                Cancel
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{current}</p>
          <button onClick={() => setEditing(true)} className="text-xs font-semibold text-brand-500 hover:text-brand-600">
            Change
          </button>
        </div>
      )}
    </div>
  );
}

export default function Subscription() {
  const { venues, fetchMe } = useAuthStore();
  const venue = venues[0];
  useEffect(() => { if (!venue) fetchMe(); }, []);

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Subscription</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{venue?.name}</p>
      </div>

      <div className="max-w-sm mx-auto">
        {/* Free forever card */}
        <div className="bg-white dark:bg-[#231A2C] border-2 border-brand-500 rounded-2xl p-6 shadow-lg shadow-brand-500/10 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center">
              <Zap size={18} className="text-brand-500" />
            </div>
            <div>
              <p className="text-base font-bold text-gray-900 dark:text-white">Skuzi</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Free to use · always</p>
            </div>
          </div>

          <p className="text-3xl font-extrabold text-gray-900 dark:text-white mb-1">Free</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">No monthly fees. No subscriptions.</p>

          <ul className="space-y-2.5">
            {[
              "QR ordering for all tables",
              "Real-time waiter notifications",
              "Bill generation & tab management",
              "Customer ratings & feedback",
              "Staff points & leaderboard",
              "Busy hours heatmap",
              "Shift management & clock-in",
              "Activity log & live dashboard",
              "Marketing campaigns",
            ].map((f) => (
              <li key={f} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
                <Check size={13} className="text-brand-500 mt-0.5 flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        {venue && <PayoutNumberCard venueId={venue.id} current={venue.momoPhone} onSaved={fetchMe} />}

        {/* How Skuzi earns */}
        <div className="bg-gray-50 dark:bg-[#231A2C] border border-gray-200 dark:border-gray-800 rounded-2xl p-5 text-center">
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">How Skuzi earns</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            When customers pay through the app, Skuzi takes an 8% service fee and sends 92% directly to your Mobile Money (MTN MoMo or Airtel Money) — automatically.
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-5">
          Free setup · Free training · No hidden fees
        </p>
      </div>
    </Layout>
  );
}
