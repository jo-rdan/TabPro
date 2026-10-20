import { useEffect, useState } from 'react';
import { CalendarDays, Check, Copy, ExternalLink, Phone, Users, X, Clock } from 'lucide-react';
import Layout from '../../components/Layout';
import ConfirmDialog from '../../components/ConfirmDialog';
import Toast from '../../components/Toast';
import api from '../../lib/api';
import { useAuthStore } from '../../lib/auth';
import { useWebSocket } from '../../hooks/useWebSocket';
import { kigaliDay, dayLabel } from '../../lib/guest';
import OpeningHours from '../../components/owner/OpeningHours';

// The owner's bookings: requests to accept (with a table) or decline, the
// night's list, and the restaurant's own Skuzi page, where guests book.
type Booking = {
  id: string; status: 'pending' | 'confirmed' | 'declined' | 'cancelled' | 'expired' | 'seated';
  name: string; phone: string; partySize: number; note: string | null; time: string; startsAt: string;
  table: { id: string; label: string } | null;
};
type TableRow = { id: string; label: string; isActive: boolean };
const DAYS = 7;

export default function Bookings() {
  const { venues, token, fetchMe } = useAuthStore();
  const venue = venues[0];
  // The night that's on now: before 06:00 it's still last night.
  const tonight = kigaliDay(-0.25);
  const [day, setDay] = useState(tonight);
  const [list, setList] = useState<Booking[] | null>(null);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [pick, setPick] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'info' } | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<Booking | null>(null);
  const [copied, setCopied] = useState(false);
  const [hoursOpen, setHoursOpen] = useState(false);

  useEffect(() => { if (!venue) fetchMe(); }, []);

  const load = async () => {
    if (!venue) return;
    try {
      const r = await api.get(`/venue-bookings/${venue.id}`, { params: { date: day } });
      setList(r.data.data.bookings);
      setPendingTotal(r.data.data.pendingTotal);
    } catch {
      setList([]);
    }
  };
  useEffect(() => { setList(null); load(); }, [venue?.id, day]);
  useEffect(() => {
    if (!venue) return;
    api.get(`/tables/${venue.id}`).then((r) => setTables((r.data.data as TableRow[]).filter((t) => t.isActive))).catch(() => {});
  }, [venue?.id]);
  useWebSocket({
    venueId: venue?.id ?? '',
    token: token ?? undefined,
    enabled: !!venue,
    onEvent: (e) => { if (e.type === 'booking_update' || e.type === 'tab_opened') load(); },
  });

  const act = async (b: Booking, action: 'accept' | 'decline' | 'table', tableId?: string | null) => {
    if (!venue) return;
    setBusy(b.id);
    try {
      if (action === 'accept') await api.post(`/venue-bookings/${venue.id}/${b.id}/accept`, { tableId: tableId ?? null });
      if (action === 'decline') await api.post(`/venue-bookings/${venue.id}/${b.id}/decline`);
      if (action === 'table') await api.patch(`/venue-bookings/${venue.id}/${b.id}/table`, { tableId: tableId ?? null });
      setToast({ msg: action === 'accept' ? `${b.name}'s booking accepted. They've been told.` : action === 'decline' ? (b.status === 'confirmed' ? 'Booking cancelled. The guest has been told.' : 'Declined. The guest has been told.') : 'Table updated', type: 'success' });
      await load();
    } catch (e: any) {
      setToast({ msg: e?.response?.data?.error || 'Something went wrong. Please try again.', type: 'info' });
    } finally {
      setBusy(null);
    }
  };

  const toggleBookings = async () => {
    if (!venue) return;
    try {
      await api.patch(`/venues/${venue.id}/settings`, { bookingsEnabled: !venue.bookingsEnabled });
      await fetchMe();
    } catch {
      setToast({ msg: "Couldn't save. Check your connection.", type: 'info' });
    }
  };

  const pageUrl = venue?.slug ? `${window.location.origin}/v/${venue.slug}` : '';
  const copy = async () => {
    try { await navigator.clipboard.writeText(pageUrl); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ }
  };

  const pending = (list ?? []).filter((b) => b.status === 'pending');
  const booked = (list ?? []).filter((b) => b.status === 'confirmed' || b.status === 'seated');
  const closed = (list ?? []).filter((b) => ['declined', 'cancelled', 'expired'].includes(b.status));
  const people = (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`;
  const card = 'rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#3B2149]';

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bookings</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {pendingTotal > 0 ? `${pendingTotal} request${pendingTotal === 1 ? '' : 's'} waiting for your answer` : 'Guests book a table on your Skuzi page. You accept or decline.'}
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0">
            {/* Days */}
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="tablist" aria-label="Day">
              {Array.from({ length: DAYS }, (_, i) => kigaliDay(i - 0.25)).map((k) => (
                <button key={k} role="tab" aria-selected={day === k} onClick={() => setDay(k)}
                  className={`min-h-[42px] flex-none rounded-full border px-4 text-sm font-bold transition ${day === k ? 'border-gray-900 bg-gray-900 text-white dark:border-amber-500 dark:bg-amber-500 dark:text-gray-900' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 dark:border-gray-800 dark:bg-[#3B2149] dark:text-gray-200'}`}>
                  {k === tonight ? 'Tonight' : dayLabel(k, true)}
                </button>
              ))}
            </div>

            {list === null ? (
              <div className="mt-5 space-y-3">{[0, 1].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />)}</div>
            ) : list.length === 0 ? (
              <div className={`${card} mt-5 p-8 text-center`}>
                <CalendarDays className="mx-auto text-gray-300 dark:text-gray-600" size={36} />
                <p className="mt-3 font-bold text-gray-900 dark:text-white">No bookings for {day === tonight ? 'tonight' : dayLabel(day)} yet</p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Share your Skuzi page so guests can book.</p>
              </div>
            ) : (
              <>
                {pending.length > 0 && (
                  <section className="mt-5" aria-labelledby="waiting">
                    <h2 id="waiting" className="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-300">Waiting for you · {pending.length}</h2>
                    <div className="mt-2 space-y-3">
                      {pending.map((b) => (
                        <div key={b.id} className="rounded-2xl border-[1.5px] border-amber-500 bg-amber-50 p-4 dark:bg-amber-500/10">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-lg font-bold text-gray-900 dark:text-white">{b.name}</p>
                              <a href={`tel:${b.phone}`} className="inline-flex min-h-[32px] items-center gap-1 text-sm font-semibold text-brand-600 dark:text-brand-300"><Phone size={13} /> {b.phone}</a>
                              {b.note && <p className="text-sm text-gray-600 dark:text-gray-300">"{b.note}"</p>}
                            </div>
                            <div className="text-right">
                              <p className="font-display text-xl font-extrabold text-gray-900 dark:text-white">{b.time}</p>
                              <p className="flex items-center justify-end gap-1 text-sm font-bold text-gray-700 dark:text-gray-200"><Users size={14} /> {b.partySize}</p>
                            </div>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:items-center">
                            <label className="col-span-2 flex min-h-[44px] items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm dark:border-gray-700 dark:bg-[#3B2149] dark:text-gray-200 sm:flex-1">
                              <span>Table</span>
                              <select value={pick[b.id] ?? ''} onChange={(e) => setPick((p) => ({ ...p, [b.id]: e.target.value }))} className="max-w-[60%] bg-transparent font-bold outline-none">
                                <option value="">Decide later</option>
                                {tables.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                              </select>
                            </label>
                            <button onClick={() => act(b, 'decline')} disabled={busy === b.id} className="min-h-[44px] rounded-xl border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-transparent dark:text-gray-200">Decline</button>
                            <button onClick={() => act(b, 'accept', pick[b.id] || null)} disabled={busy === b.id} className="min-h-[44px] rounded-xl bg-green-500 px-5 text-sm font-bold text-white hover:bg-green-600 disabled:opacity-50">Accept</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {booked.length > 0 && (
                  <section className="mt-6" aria-labelledby="booked">
                    <h2 id="booked" className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Booked · {booked.length} · {people(booked.reduce((n, b) => n + b.partySize, 0))}</h2>
                    <div className={`${card} mt-2 divide-y divide-gray-100 dark:divide-gray-800`}>
                      {booked.map((b) => (
                        <div key={b.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <span className="w-14 flex-none font-display text-lg font-extrabold text-gray-900 dark:text-white">{b.time}</span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-bold text-gray-900 dark:text-white">{b.name} · {people(b.partySize)}</p>
                              <p className="truncate text-xs text-gray-500 dark:text-gray-400">{b.status === 'seated' ? <span className="font-bold text-green-600 dark:text-green-400">Arrived</span> : <a href={`tel:${b.phone}`} className="hover:underline">{b.phone}</a>}{b.note ? ` · "${b.note}"` : ''}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 pl-[68px] sm:pl-0">
                            <select aria-label={`Table for ${b.name}`} value={b.table?.id ?? ''} disabled={busy === b.id || b.status === 'seated'} onChange={(e) => act(b, 'table', e.target.value || null)}
                              className="min-h-[40px] flex-1 rounded-xl border border-gray-200 bg-white px-2 text-sm font-bold text-gray-800 dark:border-gray-700 dark:bg-[#3B2149] dark:text-gray-200 sm:flex-none">
                              <option value="">No table yet</option>
                              {tables.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                            </select>
                            {b.status === 'confirmed' && (
                              <button onClick={() => setConfirmCancel(b)} aria-label={`Cancel ${b.name}'s booking`} className="flex h-10 w-10 flex-none items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10"><X size={18} /></button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {closed.length > 0 && (
                  <details className="mt-6">
                    <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Declined, cancelled or not answered · {closed.length}</summary>
                    <ul className="mt-2 space-y-1 text-sm text-gray-500 dark:text-gray-400">
                      {closed.map((b) => <li key={b.id}>{b.time} · {b.name} · {people(b.partySize)} · {b.status === 'expired' ? 'not answered in time' : b.status}</li>)}
                    </ul>
                  </details>
                )}
              </>
            )}
          </div>

          {/* Your page + settings */}
          <aside className="space-y-4">
            <div className="rounded-2xl bg-[#231A2C] p-5 text-[#F4F0F7]">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-500">Your Skuzi page</p>
              <p className="mt-1 break-all text-sm font-bold">{pageUrl ? pageUrl.replace(/^https?:\/\//, '') : '…'}</p>
              <p className="mt-1 text-xs text-[#D3CADC]">Guests see your menu and book a table here.</p>
              <div className="mt-3 flex gap-2">
                <button onClick={copy} disabled={!pageUrl} className="flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/10 text-sm font-bold hover:bg-white/15">{copied ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy link</>}</button>
                <a href={pageUrl || undefined} target="_blank" rel="noreferrer" className="flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-amber-500 text-sm font-bold text-gray-900 hover:bg-amber-400"><ExternalLink size={15} /> Open</a>
              </div>
            </div>

            <div className={`${card} p-5`}>
              <button role="switch" aria-checked={!!venue?.bookingsEnabled} onClick={toggleBookings} className="flex w-full items-center justify-between gap-3 text-left">
                <span>
                  <span className="block font-bold text-gray-900 dark:text-white">Take bookings</span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400">{venue?.bookingsEnabled ? 'Guests can book on your page' : 'Off: guests can only see your menu'}</span>
                </span>
                <span className={`relative h-7 w-12 flex-none rounded-full transition ${venue?.bookingsEnabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-700'}`}>
                  <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${venue?.bookingsEnabled ? 'left-6' : 'left-1'}`} />
                </span>
              </button>
            </div>

            <div className={`${card} p-5`}>
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 font-bold text-gray-900 dark:text-white"><Clock size={16} /> Opening hours</p>
                <button onClick={() => setHoursOpen(true)} className="min-h-[36px] rounded-lg px-3 text-sm font-bold text-brand-600 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-white/5">Edit</button>
              </div>
              {!venue?.openingHours && <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">Not set yet. Guests can book 11:00–22:00 until you set yours.</p>}
              {venue?.openingHours && (
                <dl className="mt-2 space-y-0.5 text-sm">
                  {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => {
                    const h = venue.openingHours?.[d];
                    return <div key={d} className="flex justify-between"><dt className="capitalize text-gray-500 dark:text-gray-400">{d}</dt><dd className="font-semibold text-gray-800 dark:text-gray-200">{h ? `${h.open} – ${h.close}` : 'Closed'}</dd></div>;
                  })}
                </dl>
              )}
            </div>
          </aside>
        </div>
      </div>

      {hoursOpen && venue && (
        <OpeningHours
          initial={venue.openingHours ?? null}
          onClose={() => setHoursOpen(false)}
          onSave={async (hours) => {
            await api.patch(`/venues/${venue.id}/settings`, { openingHours: hours });
            await fetchMe();
            setHoursOpen(false);
            setToast({ msg: 'Opening hours saved', type: 'success' });
          }}
        />
      )}
      {confirmCancel && (
        <ConfirmDialog
          title={`Cancel ${confirmCancel.name}'s booking?`}
          message={`${confirmCancel.time}, ${people(confirmCancel.partySize)}. The guest will be told.`}
          confirmLabel="Cancel booking"
          cancelLabel="Keep it"
          danger
          loading={busy === confirmCancel.id}
          onConfirm={async () => { await act(confirmCancel, 'decline'); setConfirmCancel(null); }}
          onCancel={() => setConfirmCancel(null)}
        />
      )}
      {toast && <Toast message={toast.msg} type={toast.type} onDismiss={() => setToast(null)} />}
    </Layout>
  );
}
