import { useEffect, useState } from "react";
import { UserPlus, Check, X } from "lucide-react";
import api from "../lib/api";

interface Pending {
  id: string;
  name: string;
  phone: string;
}

// Waiters who scanned the clock-in sticker and asked to join. Shown on the
// dashboard and the Staff page; bump `refreshKey` when a new request arrives.
export default function JoinRequests({
  venueId,
  refreshKey = 0,
  onChange,
}: {
  venueId: string;
  refreshKey?: number;
  onChange?: () => void;
}) {
  const [pending, setPending] = useState<Pending[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!venueId) return;
    api
      .get(`/staff/${venueId}`)
      .then((res) => setPending(res.data.data.filter((s: any) => s.pendingApproval)))
      .catch(() => {});
  }, [venueId, refreshKey]);

  async function decide(member: Pending, approve: boolean) {
    setBusy(member.id);
    setError("");
    try {
      if (approve) await api.post(`/staff/${member.id}/approve`);
      else await api.delete(`/staff/${member.id}/join-request`);
      setPending((prev) => prev.filter((p) => p.id !== member.id));
      onChange?.();
    } catch (err: any) {
      setError(err?.response?.data?.error || "Something went wrong. Try again.");
    } finally {
      setBusy(null);
    }
  }

  if (pending.length === 0) return null;

  return (
    <div className="space-y-2 mb-5">
      {pending.map((member) => (
        <div
          key={member.id}
          className="flex items-center gap-3 px-4 py-3 rounded-2xl border bg-brand-50 dark:bg-brand-900/20 border-brand-200 dark:border-brand-800"
        >
          <div className="w-9 h-9 rounded-xl bg-white dark:bg-brand-900/40 flex items-center justify-center flex-shrink-0">
            <UserPlus size={17} className="text-brand-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {member.name} wants to join your team
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{member.phone}</p>
          </div>
          <button
            onClick={() => decide(member, false)}
            disabled={busy === member.id}
            aria-label={`Decline ${member.name}`}
            className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-white dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            <X size={16} />
          </button>
          <button
            onClick={() => decide(member, true)}
            disabled={busy === member.id}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
          >
            <Check size={14} /> Approve
          </button>
        </div>
      ))}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
