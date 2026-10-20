import { useState, useEffect } from "react";
import {
  UserPlus,
  Copy,
  Check,
  Star,
  Trophy,
  PowerOff,
  Power,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Info,
} from "lucide-react";
import Layout from "../../components/Layout";
import { useAuthStore } from "../../lib/auth";
import api from "../../lib/api";
import JoinRequests from "../../components/JoinRequests";
import Toast from "../../components/Toast";
import ClockInSetup from "../../components/ClockInSetup";
import { CLOCK_IN_ENABLED } from "../../lib/features";
import { useWebSocket } from "../../hooks/useWebSocket";
import type { WsEvent } from "@tabpro/shared";

interface StaffRow {
  id: string;
  name: string;
  phone: string;
  role: "waiter" | "manager";
  hasSmartphone: boolean;
  isActive: boolean;
  inviteStatus: "none" | "invited" | "active" | "no_phone";
  inviteToken: string | null;
  totalPoints: number;
  ratingCount: number;
  avgRating: number | null;
}

interface TableRow {
  id: string;
  label: string;
  isActive: boolean;
}

interface ShiftAssignment {
  staffId: string;
  tableIds: string[];
}

export default function Staff() {
  const { venues, fetchMe, token } = useAuthStore();
  const venue = venues[0];
  useEffect(() => {
    if (!venue) fetchMe();
  }, []);

  const [staffList, setStaffList] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [newRole, setNewRole] = useState<"waiter" | "manager">("waiter");
  const [newHasPhone, setNewHasPhone] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<StaffRow | null>(
    null,
  );
  const [toggling, setToggling] = useState<string | null>(null);

  // ── Table assignments ─────────────────────────────────────────────────────
  const [venueTablesAll, setVenueTablesAll] = useState<TableRow[]>([]);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [expandedStaffId, setExpandedStaffId] = useState<string | null>(null);
  const [savingAssignment, setSavingAssignment] = useState<string | null>(null);
  const [resending, setResending] = useState<string | null>(null);
  const [joinRefresh, setJoinRefresh] = useState(0);

  const fetchStaff = async () => {
    if (!venue) return;
    try {
      const res = await api.get(`/staff/${venue.id}`);
      setStaffList(res.data.data.filter((s: StaffRow & { pendingApproval?: boolean }) => !s.pendingApproval));
    } catch {
      setError("Failed to load staff.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, [venue]);

  // Load all venue tables + assignments on mount
  useEffect(() => {
    if (!venue) return;
    const load = async () => {
      const [tablesRes, assignRes] = await Promise.all([
        api.get(`/tables/${venue.id}`),
        api.get(`/tables/assignments/${venue.id}`),
      ]);
      setVenueTablesAll(
        tablesRes.data.data.filter((t: TableRow) => t.isActive),
      );
      setAssignments(
        assignRes.data.data.map((a: any) => ({
          staffId: a.staffId,
          tableIds: a.tableIds,
        })),
      );
    };
    load().catch(() => {});
  }, [venue]);

  // Live-update invite status: when a waiter opens their invite link, flip
  // "Invite sent" to "Active" immediately instead of waiting for a page refresh.
  useWebSocket({
    venueId: venue?.id ?? "",
    token: token ?? undefined,
    enabled: !!venue,
    onEvent: (event: WsEvent) => {
      if (event.type === "staff_invite_accepted") {
        const { staffId, name } = event.payload as { staffId: string; name: string };
        setStaffList((prev) =>
          prev.map((s) =>
            s.id === staffId ? { ...s, inviteStatus: "active", inviteToken: null } : s,
          ),
        );
        setToast(`${name} accepted their invite`);
      }
      if (event.type === "staff_join_request") {
        const { name } = event.payload as { name: string };
        setJoinRefresh((n) => n + 1);
        setToast(`${name} wants to join your team`);
      }
    },
  });

  const getAssignedIds = (staffId: string) =>
    assignments.find((a) => a.staffId === staffId)?.tableIds ?? [];

  const toggleTableForStaff = (staffId: string, tableId: string) => {
    setAssignments((prev) => {
      const existing = prev.find((a) => a.staffId === staffId);
      const current = existing?.tableIds ?? [];
      const next = current.includes(tableId)
        ? current.filter((id) => id !== tableId)
        : [...current, tableId];
      if (existing)
        return prev.map((a) =>
          a.staffId === staffId ? { ...a, tableIds: next } : a,
        );
      return [...prev, { staffId, tableIds: next }];
    });
  };

  const saveAssignment = async (staffId: string) => {
    setSavingAssignment(staffId);
    try {
      await api.post("/tables/assignments", {
        staffId,
        tableIds: getAssignedIds(staffId),
      });
    } catch {
      setError("Failed to save assignment.");
    } finally {
      setSavingAssignment(null);
    }
  };

  const handleUpdate = async (member: StaffRow, changes: { role?: "waiter" | "manager"; hasSmartphone?: boolean }) => {
    if (!venue) return;
    setUpdating(member.id);
    try {
      await api.patch(`/staff/${member.id}`, changes);
      await fetchStaff();
      const assignRes = await api.get(`/tables/assignments/${venue.id}`);
      setAssignments(assignRes.data.data.map((a: any) => ({ staffId: a.staffId, tableIds: a.tableIds })));
      setToast(
        changes.role === "manager"
          ? `${member.name} is now a manager: they see every table and cover waiters without a smartphone.`
          : changes.role === "waiter"
            ? `${member.name} is a waiter again.`
            : changes.hasSmartphone === false
              ? `${member.name}'s alerts will go to your manager (or to you).`
              : `${member.name} will get their own alerts. Send them their invite link.`,
      );
    } catch (err: any) {
      setError(err?.response?.data?.error || "Couldn't save that change.");
    } finally {
      setUpdating(null);
    }
  };

  const handleCreate = async () => {
    if (!name.trim() || !phone.trim() || !venue) return;
    setCreating(true);
    setError("");
    try {
      await api.post("/staff", {
        venueId: venue.id,
        name: name.trim(),
        phone: phone.trim(),
        role: newRole,
        hasSmartphone: newHasPhone,
      });
      const addedWithoutPhone = !newHasPhone;
      setName("");
      setPhone("");
      setNewRole("waiter");
      setNewHasPhone(true);
      setShowForm(false);
      await fetchStaff();
      // Reload assignments since they just got redistributed
      const assignRes = await api.get(`/tables/assignments/${venue.id}`);
      setAssignments(
        assignRes.data.data.map((a: any) => ({
          staffId: a.staffId,
          tableIds: a.tableIds,
        })),
      );
      setToast(
        addedWithoutPhone
          ? "Added. Their tables' alerts will go to your manager (or to you)."
          : "Staff added — tables auto-assigned evenly. Tap \"Send via WhatsApp\" to invite them.",
      );
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to add staff.");
    } finally {
      setCreating(false);
    }
  };

  const getInviteUrl = (token: string) =>
    `${window.location.origin}/invite/${token}`;

  const handleResendInvite = async (member: StaffRow) => {
    setResending(member.id);
    try {
      const res = await api.post(`/staff/${member.id}/resend-invite`);
      const { whatsappLink } = res.data.data;
      // Open WhatsApp deep link — owner taps Send on their device
      window.open(whatsappLink, "_blank");
    } catch {
      setError("Failed to resend invite.");
    } finally {
      setResending(null);
    }
  };

  const handleToggleActive = async (member: StaffRow) => {
    setToggling(member.id);
    setConfirmDeactivate(null);
    try {
      await api.patch(`/staff/${member.id}/active`, {
        isActive: !member.isActive,
      });
      await fetchStaff();
      // Reload assignments since they got redistributed
      if (venue) {
        const assignRes = await api.get(`/tables/assignments/${venue.id}`);
        setAssignments(
          assignRes.data.data.map((a: any) => ({
            staffId: a.staffId,
            tableIds: a.tableIds,
          })),
        );
      }
      const action = member.isActive ? "deactivated" : "reactivated";
      setToast(
        `Staff ${action} — tables auto-reassigned across active waiters`,
      );
    } catch {
      setError(
        `Failed to ${member.isActive ? "deactivate" : "reactivate"} staff member.`,
      );
    } finally {
      setToggling(null);
    }
  };

  const copyInviteUrl = (token: string) => {
    navigator.clipboard.writeText(getInviteUrl(token));
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const sorted = [...staffList].sort((a, b) => b.totalPoints - a.totalPoints);

  return (
    <Layout>
      {/* Toast */}
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Staff
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {staffList.length} team members · {venue?.name}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <UserPlus size={16} />
          Add staff
        </button>
      </div>

      {venue && <JoinRequests venueId={venue.id} refreshKey={joinRefresh} onChange={fetchStaff} />}

      {/* Auto-assign info banner */}
      <div className="flex items-start gap-2.5 bg-brand-50 dark:bg-brand-900/20 border border-brand-200/70 dark:border-brand-900/40 rounded-2xl px-4 py-3 mb-5">
        <Info size={14} className="text-brand-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-brand-700 dark:text-brand-300 leading-relaxed">
          Tables are automatically distributed evenly across your active waiters
          whenever you add a table or a team member. Waiters who aren't on the
          list can scan your staff sticker (below) and tap "Join the team". You approve them here.
        </p>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-[#3B2149] border border-gray-200 dark:border-gray-800 rounded-2xl p-5 mb-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Add team member
          </h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="px-4 py-2.5 text-sm rounded-xl bg-gray-50 dark:bg-[#2B1838] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="07XX XXX XXX"
              className="px-4 py-2.5 text-sm rounded-xl bg-gray-50 dark:bg-[#2B1838] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-4">
            <div className="inline-flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1">
              {(["waiter", "manager"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setNewRole(r)}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors ${
                    newRole === r ? "bg-white dark:bg-[#3B2149] text-gray-900 dark:text-white shadow-sm" : "text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <label className="inline-flex items-center gap-2.5 text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none">
              <input id="new-has-phone" type="checkbox" checked={newHasPhone} onChange={(e) => setNewHasPhone(e.target.checked)} className="w-4 h-4 accent-brand-500" />
              Has a smartphone
            </label>
          </div>
          {!newHasPhone && (
            <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2 mb-3">
              No invite needed. They still get tables and points; alerts for their tables go to your manager, or to you.
            </p>
          )}
          {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
          <button
            onClick={handleCreate}
            disabled={creating || !name.trim() || !phone.trim()}
            className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors"
          >
            {creating ? "Adding..." : newHasPhone ? "Add & generate invite link" : "Add to team"}
          </button>
          {newHasPhone && (
            <p className="text-xs text-gray-400 mt-2">
              An invite link will be generated. Share it with them via WhatsApp.
            </p>
          )}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      <div className="space-y-3">
        {sorted.map((member, i) => (
          <div
            key={member.id}
            className={`bg-white dark:bg-[#3B2149] border rounded-2xl p-5 transition-opacity ${
              member.isActive
                ? "border-gray-200 dark:border-gray-800"
                : "border-gray-100 dark:border-gray-900 opacity-60"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                {i === 0 && member.totalPoints > 0 && member.isActive && (
                  <Trophy size={16} className="text-amber-400" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <p
                      className={`text-sm font-semibold ${member.isActive ? "text-gray-900 dark:text-white" : "text-gray-400 dark:text-gray-600 line-through"}`}
                    >
                      {member.name}
                    </p>
                    {!member.isActive ? (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                        Deactivated
                      </span>
                    ) : (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          member.inviteStatus === "active"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : member.inviteStatus === "invited"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                              : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                        }`}
                      >
                        {member.inviteStatus === "active"
                          ? "Active"
                          : member.inviteStatus === "invited"
                            ? "Invite sent"
                            : member.inviteStatus === "no_phone"
                              ? "On the team"
                              : "No invite"}
                      </span>
                    )}
                    {member.role === "manager" && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                        Manager
                      </span>
                    )}
                    {!member.hasSmartphone && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                        📵 No smartphone
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{member.phone}</p>
                  {member.isActive && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs">
                      <button
                        onClick={() => handleUpdate(member, { role: member.role === "manager" ? "waiter" : "manager" })}
                        disabled={updating === member.id}
                        className="font-semibold text-brand-600 dark:text-brand-400 hover:underline disabled:opacity-50"
                      >
                        {member.role === "manager" ? "Make waiter" : "Make manager"}
                      </button>
                      <span className="text-gray-300 dark:text-gray-700">·</span>
                      <button
                        onClick={() => handleUpdate(member, { hasSmartphone: !member.hasSmartphone })}
                        disabled={updating === member.id}
                        className="font-semibold text-gray-500 dark:text-gray-400 hover:underline disabled:opacity-50"
                      >
                        {member.hasSmartphone ? "Mark as no smartphone" : "Mark as having a smartphone"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-bold text-brand-500">
                    {member.totalPoints} pts
                  </p>
                  {member.avgRating && (
                    <p className="text-xs text-gray-400 flex items-center gap-0.5 justify-end">
                      <Star size={10} className="text-amber-400" />
                      {member.avgRating} ({member.ratingCount})
                    </p>
                  )}
                </div>
                <button
                  onClick={() =>
                    member.isActive
                      ? setConfirmDeactivate(member)
                      : handleToggleActive(member)
                  }
                  disabled={toggling === member.id}
                  title={member.isActive ? "Deactivate" : "Reactivate"}
                  className={`p-2 rounded-xl transition-colors disabled:opacity-40 ${
                    member.isActive
                      ? "text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                      : "text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20"
                  }`}
                >
                  {toggling === member.id ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : member.isActive ? (
                    <PowerOff size={16} />
                  ) : (
                    <Power size={16} />
                  )}
                </button>
              </div>
            </div>

            {member.isActive && member.inviteToken && member.hasSmartphone && (
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <p className="text-xs text-gray-400 font-mono truncate mb-2">
                  {getInviteUrl(member.inviteToken)}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleResendInvite(member)}
                    disabled={resending === member.id}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white font-semibold transition-colors disabled:opacity-50"
                  >
                    {resending === member.id ? (
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <MessageCircle size={13} />
                    )}
                    Send via WhatsApp
                  </button>
                  <button
                    onClick={() => copyInviteUrl(member.inviteToken!)}
                    className="flex items-center gap-1 text-xs px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
                  >
                    {copiedToken === member.inviteToken ? (
                      <>
                        <Check size={12} className="text-green-500" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy size={12} /> Copy
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Table assignment panel */}
            {member.isActive && (
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={() =>
                    setExpandedStaffId(
                      expandedStaffId === member.id ? null : member.id,
                    )
                  }
                  className="flex items-center justify-between w-full text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                      Tables assigned
                    </span>
                    {getAssignedIds(member.id).length > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 font-bold">
                        {getAssignedIds(member.id).length}
                      </span>
                    )}
                  </div>
                  {expandedStaffId === member.id ? (
                    <ChevronUp size={14} className="text-gray-400" />
                  ) : (
                    <ChevronDown size={14} className="text-gray-400" />
                  )}
                </button>

                {expandedStaffId === member.id && (
                  <div className="mt-3">
                    {venueTablesAll.length === 0 ? (
                      <p className="text-xs text-gray-400">
                        No tables set up yet.
                      </p>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {venueTablesAll.map((table) => {
                            const assigned = getAssignedIds(member.id).includes(
                              table.id,
                            );
                            return (
                              <button
                                key={table.id}
                                onClick={() =>
                                  toggleTableForStaff(member.id, table.id)
                                }
                                className={`text-xs px-3 py-1.5 rounded-xl font-semibold border transition-all ${
                                  assigned
                                    ? "bg-brand-500 border-brand-500 text-white"
                                    : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-brand-300 dark:hover:border-brand-700"
                                }`}
                              >
                                {table.label}
                              </button>
                            );
                          })}
                        </div>
                        <button
                          onClick={() => saveAssignment(member.id)}
                          disabled={savingAssignment === member.id}
                          className="text-xs px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold disabled:opacity-50 transition-colors flex items-center gap-2"
                        >
                          {savingAssignment === member.id ? (
                            <>
                              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />{" "}
                              Saving...
                            </>
                          ) : (
                            <>
                              <Check size={12} /> Save
                            </>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {!loading && staffList.length === 0 && (
          <div className="text-center py-16 text-sm text-gray-400 dark:text-gray-500">
            No staff yet. Add your first team member above.
          </div>
        )}
      </div>

      {/* ── Deactivate confirmation modal ─────────────────────────────────── */}
      {confirmDeactivate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setConfirmDeactivate(null)}
          />
          <div className="relative bg-white dark:bg-[#3B2149] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-900/30 mb-4 mx-auto">
              <PowerOff size={22} className="text-red-500" />
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white text-center mb-1">
              Deactivate {confirmDeactivate.name}?
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-5">
              They won't be able to use their invite link or appear in
              leaderboards. You can reactivate them at any time.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeactivate(null)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => handleToggleActive(confirmDeactivate)}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors"
              >
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}
      {/* How new waiters join and clock in (moved here from Shifts) */}
      {venue && CLOCK_IN_ENABLED && (
        <div className="mt-8">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Joining &amp; clock-in</h2>
          <ClockInSetup venueId={venue.id} onToast={setToast} />
        </div>
      )}
    </Layout>
  );
}
