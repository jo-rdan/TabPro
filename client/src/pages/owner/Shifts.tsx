import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Clock, Check, X, QrCode, KeyRound, AlertCircle, CheckCircle2, MinusCircle } from 'lucide-react';
import Layout from '../../components/Layout';
import { useAuthStore } from '../../lib/auth';
import api from '../../lib/api';
import Toast from '../../components/Toast';

interface AssignedStaff {
  id: string;
  name: string;
}

interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  assignedStaff?: AssignedStaff[];
}

interface AttendanceRow {
  staffId: string;
  staffName: string;
  shiftId: string;
  shiftName: string;
  shiftTime: string;
  status: 'on_time' | 'late' | 'absent' | 'pending';
  clockedInAt: string | null;
  clockedOutAt: string | null;
}

interface WeeklyHoursRow {
  staffId: string;
  staffName: string;
  hours: number;
}

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const display = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${display}:${m.toString().padStart(2, '0')} ${ampm}`;
}

const statusStyles: Record<AttendanceRow['status'], { label: string; className: string; Icon: any }> = {
  on_time: { label: 'On time', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', Icon: CheckCircle2 },
  late: { label: 'Late', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', Icon: AlertCircle },
  absent: { label: 'Absent', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', Icon: MinusCircle },
  pending: { label: 'Not started', className: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400', Icon: Clock },
};

export default function Shifts() {
  const { venues, fetchMe } = useAuthStore();
  const venue = venues[0];

  useEffect(() => { if (!venue) fetchMe(); }, []);

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  // ── Tabs ─────────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<'shifts' | 'attendance'>('shifts');

  // ── Clock-in sticker + PIN ───────────────────────────────────────────────────
  // TabPro ships a pre-printed blank sticker with its own permanent code. The
  // owner claims it once (by scanning it, which opens /claim-sticker?code=...,
  // or by typing the code printed on it below) and never touches it again.
  const [stickerClaimed, setStickerClaimed] = useState(false);
  const [stickerCode, setStickerCode] = useState('');
  const [claimInput, setClaimInput] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState('');
  const [showPinForm, setShowPinForm] = useState(false);
  const [pinDigits, setPinDigits] = useState(['', '', '', '']);
  const [pinSaving, setPinSaving] = useState(false);
  const [pinError, setPinError] = useState('');

  const fetchStickerStatus = async () => {
    if (!venue) return;
    try {
      const res = await api.get(`/clockin/sticker/${venue.id}`);
      setStickerClaimed(res.data.data.claimed);
      setStickerCode(res.data.data.code || '');
    } catch { /* silent */ }
  };

  useEffect(() => {
    if (!venue || tab !== 'attendance') return;
    fetchStickerStatus();
  }, [venue, tab]);

  const handleClaimSticker = async () => {
    if (!venue || !claimInput.trim()) return;
    setClaiming(true);
    setClaimError('');
    try {
      await api.post(`/clockin/claim/${venue.id}`, { code: claimInput.trim() });
      setClaimInput('');
      await fetchStickerStatus();
      setToast('Sticker claimed! Stick it at the entrance.');
    } catch (err: any) {
      setClaimError(err?.response?.data?.error || 'Failed to claim sticker.');
    } finally {
      setClaiming(false);
    }
  };

  const handlePinDigit = (val: string, idx: number) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...pinDigits];
    next[idx] = val;
    setPinDigits(next);
    setPinError('');
  };

  const handleSavePin = async () => {
    const pin = pinDigits.join('');
    if (pin.length !== 4) {
      setPinError('Enter all 4 digits.');
      return;
    }
    setPinSaving(true);
    setPinError('');
    try {
      await api.post(`/clockin/pin/${venue!.id}`, { pin });
      setToast('Venue PIN saved');
      setShowPinForm(false);
      setPinDigits(['', '', '', '']);
    } catch (err: any) {
      setPinError(err?.response?.data?.error || 'Failed to save PIN.');
    } finally {
      setPinSaving(false);
    }
  };

  // ── Attendance + weekly hours ────────────────────────────────────────────────
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [weeklyHours, setWeeklyHours] = useState<WeeklyHoursRow[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(true);

  const fetchAttendance = async () => {
    if (!venue) return;
    try {
      const res = await api.get(`/clockin/attendance/${venue.id}`);
      setAttendance(res.data.data.attendance);
      setWeeklyHours(res.data.data.weeklyHours);
    } catch { /* silent */ }
    finally { setAttendanceLoading(false); }
  };

  useEffect(() => {
    if (!venue || tab !== 'attendance') return;
    fetchAttendance();
  }, [venue, tab]);

  const fetchShifts = async () => {
    if (!venue) return;
    try {
      const res = await api.get(`/shifts/${venue.id}`);
      setShifts(res.data.data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchShifts(); }, [venue]);

  // ── Elite guard ──────────────────────────────────────────────────────────

  const resetForm = () => {
    setName(''); setStartTime(''); setEndTime('');
    setEditingId(null); setShowForm(false); setError('');
  };

  const startEdit = (shift: Shift) => {
    setName(shift.name);
    setStartTime(shift.startTime);
    setEndTime(shift.endTime);
    setEditingId(shift.id);
    setShowForm(true);
    setError('');
  };

  const handleSave = async () => {
    if (!name.trim() || !startTime || !endTime) {
      setError('All fields are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editingId) {
        await api.patch(`/shifts/${editingId}`, { name: name.trim(), startTime, endTime });
        setToast('Shift updated');
      } else {
        await api.post(`/shifts/${venue!.id}`, { name: name.trim(), startTime, endTime });
        setToast('Shift created — waiters auto-assigned evenly');
      }
      await fetchShifts();
      resetForm();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to save shift.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (shiftId: string) => {
    if (!venue) return;
    setDeletingId(shiftId);
    try {
      await api.delete(`/shifts/${shiftId}`, { data: { venueId: venue.id } });
      await fetchShifts();
      setToast('Shift deleted — assignments updated');
    } catch {
      setToast('Failed to delete shift.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Layout>
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Shifts</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{venue?.name}</p>
        </div>
        {tab === 'shifts' && (
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <Plus size={16} />
            Add shift
          </button>
        )}
      </div>

      {/* Tab switcher */}
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800/60 rounded-xl p-1 mb-6 w-fit">
        <button
          onClick={() => setTab('shifts')}
          className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors ${
            tab === 'shifts' ? 'bg-white dark:bg-[#161B22] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          Shifts
        </button>
        <button
          onClick={() => setTab('attendance')}
          className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors ${
            tab === 'attendance' ? 'bg-white dark:bg-[#161B22] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          Attendance
        </button>
      </div>

      {tab === 'shifts' && (
        <>
      {/* Auto-assign info banner */}
      <div className="flex items-start gap-2.5 bg-brand-50 dark:bg-brand-900/20 border border-brand-200/70 dark:border-brand-900/40 rounded-2xl px-4 py-3 mb-5">
        <Clock size={14} className="text-brand-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-brand-700 dark:text-brand-300 leading-relaxed">
          Shifts are automatically distributed evenly across your active waiters whenever you add a shift or a team member.
        </p>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-gray-800 rounded-2xl p-5 mb-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
            {editingId ? 'Edit shift' : 'New shift'}
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Shift name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Evening, Lunch, Morning"
                className="w-full px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-[#0D1117] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Start time</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => { setStartTime(e.target.value); e.target.blur(); }}
                  className="w-full px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-[#0D1117] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 [color-scheme:light] dark:[color-scheme:dark]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">End time</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => { setEndTime(e.target.value); e.target.blur(); }}
                  className="w-full px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-[#0D1117] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 [color-scheme:light] dark:[color-scheme:dark]"
                />
              </div>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button onClick={resetForm} className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 font-semibold rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <X size={14} /> Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
                <Check size={14} /> {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shifts list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : shifts.length === 0 ? (
        <div className="text-center py-16">
          <Clock size={32} className="text-gray-300 dark:text-gray-700 mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No shifts yet. Add one to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shifts.map((shift) => (
            <div key={shift.id} className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-gray-800 rounded-2xl px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center">
                  <Clock size={16} className="text-brand-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{shift.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {formatTime(shift.startTime)} – {formatTime(shift.endTime)}
                  </p>
                  {shift.assignedStaff && shift.assignedStaff.length > 0 ? (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      👤 {shift.assignedStaff.map((s) => s.name).join(', ')}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 italic">No waiter assigned</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => startEdit(shift)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => handleDelete(shift.id)}
                  disabled={deletingId === shift.id}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors disabled:opacity-50"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      </>
      )}

      {tab === 'attendance' && (
        <div className="space-y-6">
          {/* QR + PIN setup */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-gray-800 rounded-2xl p-5 flex flex-col items-center text-center">
              <div className="flex items-center gap-2 mb-3 self-start">
                <QrCode size={16} className="text-brand-500" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Clock-in sticker</h3>
              </div>
              {stickerClaimed ? (
                <>
                  <div className="w-full rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200/70 dark:border-green-700/40 p-4 text-center">
                    <p className="text-xs font-semibold text-green-700 dark:text-green-400">Claimed — code {stickerCode}</p>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 max-w-xs">
                    This is bound to your venue permanently. If the physical sticker is already up at your
                    entrance, you're done — no further action needed here.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 max-w-xs">
                    TabPro shipped you a blank sticker with its own unique code already printed on it.
                    Scan it with your phone camera to claim it, or type the code below.
                  </p>
                  <div className="w-full flex gap-2">
                    <input
                      type="text"
                      value={claimInput}
                      onChange={(e) => setClaimInput(e.target.value.toUpperCase())}
                      placeholder="e.g. AB3X9K"
                      className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-[#0D1117] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <button
                      onClick={handleClaimSticker}
                      disabled={claiming || !claimInput.trim()}
                      className="px-4 py-2 text-sm font-semibold bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-xl transition-colors"
                    >
                      {claiming ? '...' : 'Claim'}
                    </button>
                  </div>
                  {claimError && <p className="text-xs text-red-500 mt-2">{claimError}</p>}
                  <p className="text-xs text-gray-400 mt-3">
                    Once claimed, peel the sticker and stick it at the venue entrance — it never changes again.
                  </p>
                </>
              )}
            </div>

            <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <KeyRound size={16} className="text-brand-500" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Venue PIN</h3>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Waiters enter this 4-digit PIN after scanning the QR, to confirm they're physically at the venue. Post it somewhere staff can see but customers can't.
              </p>

              {!showPinForm ? (
                <button
                  onClick={() => setShowPinForm(true)}
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  Set / change PIN
                </button>
              ) : (
                <div>
                  <div className="flex gap-2 justify-center mb-3">
                    {pinDigits.map((digit, i) => (
                      <input
                        key={i}
                        type="password"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handlePinDigit(e.target.value, i)}
                        className={`w-12 h-12 text-center text-xl font-black rounded-xl border-2 outline-none transition-all bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                          digit ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-gray-200 dark:border-gray-700 focus:border-brand-400'
                        }`}
                      />
                    ))}
                  </div>
                  {pinError && <p className="text-xs text-red-500 mb-2 text-center">{pinError}</p>}
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={() => { setShowPinForm(false); setPinDigits(['', '', '', '']); setPinError(''); }}
                      className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400 font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSavePin}
                      disabled={pinSaving}
                      className="px-3 py-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                      {pinSaving ? 'Saving…' : 'Save PIN'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Today's attendance */}
          <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Today's attendance</h3>
            {attendanceLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : attendance.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No shifts scheduled today.</p>
            ) : (
              <div className="space-y-2">
                {attendance.map((row, i) => {
                  const s = statusStyles[row.status];
                  return (
                    <div key={`${row.staffId}-${row.shiftId}-${i}`} className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{row.staffName}</p>
                        <p className="text-xs text-gray-400">{row.shiftName} · {row.shiftTime}</p>
                      </div>
                      <span className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${s.className}`}>
                        <s.Icon size={11} />
                        {s.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Weekly hours */}
          <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Hours this week</h3>
            {attendanceLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : weeklyHours.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No active waiters yet.</p>
            ) : (
              <div className="space-y-3">
                {weeklyHours
                  .slice()
                  .sort((a, b) => b.hours - a.hours)
                  .map((row) => {
                    const max = Math.max(...weeklyHours.map((r) => r.hours), 1);
                    return (
                      <div key={row.staffId} className="flex items-center gap-3">
                        <span className="w-24 text-sm font-semibold text-gray-900 dark:text-white truncate">{row.staffName}</span>
                        <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
                          <div className="h-2 rounded-full bg-brand-500" style={{ width: `${(row.hours / max) * 100}%` }} />
                        </div>
                        <span className="text-sm text-gray-500 dark:text-gray-400 w-16 text-right">{row.hours}h</span>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
