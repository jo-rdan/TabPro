import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Gift, Lock, Megaphone, Plus, TrendingUp, Users } from 'lucide-react';
import Layout from '../../components/Layout';
import ConfirmDialog from '../../components/ConfirmDialog';
import api from '../../lib/api';
import { useAuthStore } from '../../lib/auth';
import { kigaliDay, dayLabel, kigaliTime } from '../../lib/guest';

// Campaigns: "We already have the right people." A notification to guests who
// said yes to invites, plus an event on Explore and the venue's Skuzi page.
// Sending is free; Skuzi takes 15% (not 8%) on Skuzi bills of guests it brings.
type Results = { came: number; regulars: number; newFaces: number; spentRwf: number; paidWithSkuzi: number; skuziFeeRwf: number };
type Campaign = {
  id: string; title: string | null; message: string; offerType: string; offerLabel: string | null; offerText: string | null;
  eventAt: string | null; audience: 'regulars' | 'everyone'; status: string; sendAt: string | null; sentAt: string | null;
  recipientCount: number; createdAt: string | null; results: Results;
};
type Audience = { regulars: number; others: number; total: number };

const rwf = (n: number) => `${n.toLocaleString('en-US')} RWF`;
const when = (iso: string | null) => {
  if (!iso) return '';
  const key = new Date(new Date(iso).getTime() + 2 * 3600e3).toISOString().slice(0, 10);
  return `${dayLabel(key, true)} ${kigaliTime(iso)}`;
};
const statusLine = (c: Campaign) =>
  c.status === 'scheduled' ? `Goes out ${when(c.sendAt)}` : c.status === 'cancelled' ? 'Cancelled' : `Sent ${when(c.sentAt)} · reached ${c.recipientCount}`;

function useVenue() {
  const { venues, fetchMe } = useAuthStore();
  useEffect(() => { if (!venues[0]) fetchMe(); }, []);
  return venues[0];
}
function useAudience(venueId?: string) {
  const [a, setA] = useState<Audience | null>(null);
  useEffect(() => { if (venueId) api.get(`/campaigns/audience/${venueId}`).then((r) => setA(r.data.data)).catch(() => {}); }, [venueId]);
  return a;
}

function AudienceCard({ a }: { a: Audience | null }) {
  return (
    <div className="rounded-2xl bg-[#231A2C] p-5 text-[#F4F0F7]">
      <p className="text-xs font-bold uppercase tracking-wider text-amber-500">Your audience</p>
      {a === null ? <div className="mt-2 h-10 animate-pulse rounded-lg bg-white/10" /> : a.total === 0 ? (
        <>
          <p className="mt-1 font-display text-3xl font-extrabold">0 <span className="text-base font-bold text-[#D3CADC]">for now</span></p>
          <p className="mt-1 text-sm text-[#D3CADC]">It builds up every time a guest pays with Skuzi and says yes to invites. Campaigns still show on Explore and your Skuzi page.</p>
        </>
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white/10 px-3 py-2"><p className="font-display text-2xl font-extrabold">{a.regulars.toLocaleString()}</p><p className="text-xs text-[#D3CADC]">Your regulars</p></div>
          <div className="rounded-xl bg-white/10 px-3 py-2"><p className="font-display text-2xl font-extrabold">{a.others.toLocaleString()}</p><p className="text-xs text-[#D3CADC]">Other Skuzi guests</p></div>
        </div>
      )}
      <p className="mt-3 flex items-center gap-1.5 text-xs text-[#86A27B]"><Lock size={12} /> Their numbers stay private. Skuzi sends it for you.</p>
    </div>
  );
}

function FreeBox() {
  return (
    <div className="flex gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-[#231A2C]">
      <Gift size={22} className="flex-none text-amber-500" />
      <p className="text-sm text-gray-700 dark:text-gray-300"><b className="text-gray-900 dark:text-white">Sending is free.</b> You only pay when guests come: 15% on their Skuzi bills, instead of 8%. Max 2 campaigns a week, so invites stay special.</p>
    </div>
  );
}

// ─── List ─────────────────────────────────────────────────────────────────────
export default function Campaigns() {
  const venue = useVenue();
  const audience = useAudience(venue?.id);
  const [list, setList] = useState<Campaign[] | null>(null);
  useEffect(() => { if (venue) api.get(`/campaigns/${venue.id}`).then((r) => setList(r.data.data)).catch(() => setList([])); }, [venue?.id]);

  return (
    <Layout>
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Campaigns</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">We already have the right people. Tell them what's on.</p>
          </div>
          <Link to="/campaigns/new" className="flex min-h-[44px] items-center gap-2 rounded-xl bg-brand-500 px-5 text-sm font-bold text-white hover:bg-brand-600"><Plus size={16} /> New campaign</Link>
        </div>
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0">
            {list === null ? (
              <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />)}</div>
            ) : list.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
                <Megaphone className="mx-auto text-gray-300 dark:text-gray-600" size={36} />
                <p className="mt-3 font-bold text-gray-900 dark:text-white">No campaigns yet</p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Karaoke night, live band, happy hour? Let your guests know.</p>
                <Link to="/campaigns/new" className="mt-4 inline-flex min-h-[44px] items-center rounded-xl bg-brand-500 px-5 text-sm font-bold text-white">Create your first campaign</Link>
              </div>
            ) : (
              <ul className="space-y-2">
                {list.map((c) => (
                  <li key={c.id}>
                    <Link to={`/campaigns/${c.id}`} className={`flex items-center gap-4 rounded-2xl border border-gray-200 bg-white px-4 py-3 hover:border-gray-300 dark:border-gray-800 dark:bg-[#231A2C] ${c.status === 'cancelled' ? 'opacity-60' : ''}`}>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-gray-900 dark:text-white">{c.title}</p>
                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">{statusLine(c)}{c.offerText ? ` · ${c.offerText}` : ''}</p>
                      </div>
                      {c.status === 'sent' && <div className="text-right"><p className="font-display text-xl font-extrabold text-gray-900 dark:text-white">{c.results.came}</p><p className="text-xs text-gray-500 dark:text-gray-400">came</p></div>}
                      {c.status === 'scheduled' && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">Scheduled</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <aside className="space-y-4"><AudienceCard a={audience} /><FreeBox /></aside>
        </div>
      </div>
    </Layout>
  );
}

// ─── New campaign ─────────────────────────────────────────────────────────────
const TIMES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
const toIso = (date: string, time: string) => new Date(`${date}T${time}:00+02:00`).toISOString();

export function CampaignNew() {
  const venue = useVenue();
  const navigate = useNavigate();
  const audience = useAudience(venue?.id);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [hasEvent, setHasEvent] = useState(true);
  const [eventDay, setEventDay] = useState(kigaliDay(0));
  const [eventTime, setEventTime] = useState('20:00');
  const [offer, setOffer] = useState<'none' | 'free_item' | 'discount_10'>('free_item');
  const [offerLabel, setOfferLabel] = useState('Free shot');
  const [everyone, setEveryone] = useState(true);
  const [later, setLater] = useState(false);
  const [sendDay, setSendDay] = useState(kigaliDay(0));
  const [sendTime, setSendTime] = useState('15:00');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const reach = audience ? (everyone ? audience.total : audience.regulars) : 0;
  const offerText = offer === 'discount_10' ? '10% off when you pay with Skuzi' : offer === 'free_item' && offerLabel.trim() ? `${offerLabel.trim()} when you pay with Skuzi` : null;

  const validate = () => {
    if (title.trim().length < 2) return 'Give it a short name, e.g. Karaoke Friday';
    if (message.trim().length < 5) return "Tell guests what's on";
    if (offer === 'free_item' && !offerLabel.trim()) return 'Say what the free item is, e.g. Free shot';
    if (hasEvent && new Date(toIso(eventDay, eventTime)).getTime() < Date.now() - 3600e3) return 'The event time has passed';
    if (later && new Date(toIso(sendDay, sendTime)).getTime() < Date.now()) return 'Pick a sending time in the future';
    if (later && hasEvent && toIso(sendDay, sendTime) > toIso(eventDay, eventTime)) return 'Send it before the event starts';
    return '';
  };
  const submit = async () => {
    setConfirm(false);
    setBusy(true); setError('');
    try {
      const r = await api.post('/campaigns', {
        venueId: venue!.id, title: title.trim(), message: message.trim(), offerType: offer,
        offerLabel: offer === 'free_item' ? offerLabel.trim() : null,
        eventAt: hasEvent ? toIso(eventDay, eventTime) : null,
        audience: everyone ? 'everyone' : 'regulars',
        sendAt: later ? toIso(sendDay, sendTime) : null,
      });
      navigate(`/campaigns/${r.data.data.id}`, { replace: true });
    } catch (e: any) {
      setError(e?.response?.data?.error || "Couldn't send. Check your connection and try again.");
      setBusy(false);
    }
  };
  const onSend = () => { const v = validate(); if (v) { setError(v); return; } setError(''); later ? submit() : setConfirm(true); };

  const label = 'text-xs font-bold uppercase tracking-wider text-brand-700 dark:text-brand-300';
  const input = 'min-h-[46px] w-full rounded-xl border border-gray-200 bg-white px-3.5 text-[15px] font-semibold text-gray-900 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-[#1B1524] dark:text-white';
  const pickSel = 'min-h-[46px] rounded-xl border border-gray-200 bg-white px-3 text-[15px] font-semibold text-gray-900 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-[#1B1524] dark:text-white';
  const chip = (on: boolean) => `min-h-[40px] rounded-full border px-4 text-sm font-bold ${on ? 'border-gray-900 bg-gray-900 text-white dark:border-amber-500 dark:bg-amber-500 dark:text-gray-900' : 'border-gray-200 bg-white text-gray-800 dark:border-gray-700 dark:bg-transparent dark:text-gray-200'}`;
  const days = Array.from({ length: 14 }, (_, i) => kigaliDay(i));

  return (
    <Layout>
      <div className="mx-auto max-w-5xl">
        <Link to="/campaigns" className="mb-4 inline-flex min-h-[40px] items-center gap-1.5 text-sm font-bold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"><ArrowLeft size={16} /> Campaigns</Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">New campaign</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">We already have the right people. <b className="text-gray-800 dark:text-gray-200">Tell them what's on.</b></p>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="flex min-w-0 flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label htmlFor="c-title" className={label}>What's on?</label>
              <input id="c-title" className={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Karaoke Friday" maxLength={40} />
              <label htmlFor="c-msg" className="sr-only">Message</label>
              <textarea id="c-msg" className={`${input} min-h-[84px] resize-none py-2.5 font-medium`} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Come sing with us from 20:00!" maxLength={140} />
              <p className="text-right text-xs text-gray-400">{message.length}/140</p>
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className={label}>When is it?</legend>
              <label className="flex min-h-[40px] items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
                <input type="checkbox" checked={hasEvent} onChange={(e) => setHasEvent(e.target.checked)} className="h-5 w-5 accent-brand-500" /> It's an event with a date (shows on Explore)
              </label>
              {hasEvent && (
                <div className="flex flex-wrap items-center gap-2">
                  <select aria-label="Event day" className={pickSel} value={eventDay} onChange={(e) => setEventDay(e.target.value)}>{days.map((d) => <option key={d} value={d}>{dayLabel(d)}</option>)}</select>
                  <select aria-label="Event time" className={pickSel} value={eventTime} onChange={(e) => setEventTime(e.target.value)}>{TIMES.map((t) => <option key={t}>{t}</option>)}</select>
                </div>
              )}
            </fieldset>

            <fieldset className="flex flex-col gap-2">
              <legend className={label}>Your offer</legend>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={chip(offer === 'none')} onClick={() => setOffer('none')} aria-pressed={offer === 'none'}>None</button>
                <button type="button" className={chip(offer === 'free_item')} onClick={() => setOffer('free_item')} aria-pressed={offer === 'free_item'}>Something free</button>
                <button type="button" className={chip(offer === 'discount_10')} onClick={() => setOffer('discount_10')} aria-pressed={offer === 'discount_10'}>10% off</button>
              </div>
              {offer === 'free_item' && (
                <>
                  <label htmlFor="c-offer" className="sr-only">What's free</label>
                  <input id="c-offer" className={input} value={offerLabel} onChange={(e) => setOfferLabel(e.target.value)} placeholder="Free shot" maxLength={30} />
                </>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {offer === 'discount_10' ? 'Taken off automatically when the guest pays with Skuzi. Your venue covers it.' : offer === 'free_item' ? 'Guests show it to the waiter and get it when they pay with Skuzi. Your venue covers it.' : 'Offers make people more likely to come.'}
              </p>
            </fieldset>

            <fieldset className="flex flex-col gap-2">
              <legend className={label}>Who should know?</legend>
              <div className="flex items-center gap-3 rounded-2xl border-[1.5px] border-brand-500 bg-brand-50 px-4 py-3 dark:bg-brand-500/10">
                <Users size={20} className="text-brand-500" />
                <div className="flex-1"><p className="font-bold text-gray-900 dark:text-white">Your regulars</p><p className="text-xs text-gray-600 dark:text-gray-300">Guests who came in the last 3 months</p></div>
                <span className="font-display text-lg font-extrabold text-gray-900 dark:text-white">{audience?.regulars ?? '…'}</span>
              </div>
              <label className={`flex cursor-pointer items-center gap-3 rounded-2xl border-[1.5px] px-4 py-3 ${everyone ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-transparent'}`}>
                <input type="checkbox" checked={everyone} onChange={(e) => setEveryone(e.target.checked)} className="h-5 w-5 accent-brand-500" />
                <div className="flex-1"><p className="font-bold text-gray-900 dark:text-white">Other Skuzi guests</p><p className="text-xs text-gray-600 dark:text-gray-300">People who go out with Skuzi in Kigali</p></div>
                <span className="font-display text-lg font-extrabold text-gray-900 dark:text-white">{audience?.others ?? '…'}</span>
              </label>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-green-600 dark:text-green-400"><Lock size={12} /> Their numbers stay private. Skuzi sends it for you.</p>
            </fieldset>

            <fieldset className="flex flex-col gap-2">
              <legend className={label}>Send</legend>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={chip(!later)} onClick={() => setLater(false)} aria-pressed={!later}>Now</button>
                <button type="button" className={chip(later)} onClick={() => setLater(true)} aria-pressed={later}>Later</button>
              </div>
              {later && (
                <div className="flex flex-wrap items-center gap-2">
                  <select aria-label="Sending day" className={pickSel} value={sendDay} onChange={(e) => setSendDay(e.target.value)}>{days.map((d) => <option key={d} value={d}>{dayLabel(d)}</option>)}</select>
                  <select aria-label="Sending time" className={pickSel} value={sendTime} onChange={(e) => setSendTime(e.target.value)}>{TIMES.map((t) => <option key={t}>{t}</option>)}</select>
                </div>
              )}
            </fieldset>

            {error && <p role="alert" className="rounded-xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-200">{error}</p>}
            <button onClick={onSend} disabled={busy || !venue} className="min-h-[54px] rounded-xl bg-brand-500 text-base font-bold text-white hover:bg-brand-600 disabled:opacity-50">
              {busy ? 'Sending…' : later ? `Schedule for ${dayLabel(sendDay, true)} ${sendTime}` : reach > 0 ? `Send to ${reach.toLocaleString()} ${reach === 1 ? 'guest' : 'guests'}` : 'Publish on Explore'}
            </button>
            {reach === 0 && audience && <p className="-mt-3 text-center text-xs text-gray-500 dark:text-gray-400">Nobody to notify yet. It will show on Explore and your Skuzi page.</p>}
          </div>

          <aside className="space-y-4">
            <div>
              <p className={label}>What guests see</p>
              <div className="mt-2 rounded-2xl bg-[radial-gradient(120%_70%_at_30%_0%,#5A2A1A,#1B1524_70%)] p-4">
                <div className="flex gap-3 rounded-2xl bg-[#FDFCFE]/95 p-3 text-gray-900 shadow-lg">
                  <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[#231A2C] text-amber-500"><Megaphone size={16} /></div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-gray-500">SKUZI · now</p>
                    <p className="text-sm font-extrabold leading-snug">{title.trim() || 'Karaoke Friday'} at {venue?.name ?? 'your venue'}</p>
                    <p className="text-[13px] leading-snug">{message.trim() || 'Come sing with us from 20:00!'}{offerText ? ` ${offerText}.` : ''}</p>
                  </div>
                </div>
              </div>
            </div>
            <FreeBox />
          </aside>
        </div>
      </div>
      {confirm && (
        <ConfirmDialog
          title={`Send "${title.trim()}" now?`}
          message={`${reach.toLocaleString()} ${reach === 1 ? 'guest gets' : 'guests get'} a notification right away. It can't be unsent.`}
          confirmLabel="Send now"
          cancelLabel="Not yet"
          loading={busy}
          onConfirm={submit}
          onCancel={() => setConfirm(false)}
        />
      )}
    </Layout>
  );
}

// ─── Results ──────────────────────────────────────────────────────────────────
export function CampaignDetail() {
  const venue = useVenue();
  const { campaignId = '' } = useParams();
  const [c, setC] = useState<Campaign | null>(null);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  const load = () => { if (venue) api.get(`/campaigns/${venue.id}/${campaignId}`).then((r) => setC(r.data.data)).catch((e) => setError(e?.response?.data?.error || "Couldn't load this campaign")); };
  useEffect(load, [venue?.id, campaignId]);

  const cancel = async () => {
    try { await api.post(`/campaigns/${venue!.id}/${campaignId}/cancel`); load(); } catch (e: any) { setError(e?.response?.data?.error || "Couldn't cancel"); }
    setConfirm(false);
  };

  return (
    <Layout>
      <div className="mx-auto max-w-3xl">
        <Link to="/campaigns" className="mb-4 inline-flex min-h-[40px] items-center gap-1.5 text-sm font-bold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"><ArrowLeft size={16} /> Campaigns</Link>
        {error && <p role="alert" className="mb-4 rounded-xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-200">{error}</p>}
        {!c ? (!error && <div className="h-60 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />) : (
          <>
            <h1 className="font-display text-3xl font-extrabold text-gray-900 dark:text-white">{c.title}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{statusLine(c)}{c.offerText ? ` · ${c.offerText}` : ''}{c.eventAt ? ` · event ${when(c.eventAt)}` : ''}</p>
            <p className="mt-2 text-gray-700 dark:text-gray-300">"{c.message}"</p>

            {c.status === 'sent' && (
              <>
                <div className="mt-6 rounded-2xl bg-[#231A2C] p-6 text-[#F4F0F7]">
                  <p className="text-sm text-[#D3CADC]">Guests who came because of it</p>
                  <p className="font-display text-6xl font-extrabold leading-none text-amber-500">{c.results.came}</p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-white/10 px-3 py-2"><p className="text-lg font-extrabold">{c.results.regulars}</p><p className="text-xs text-[#D3CADC]">Your regulars</p></div>
                    <div className="rounded-xl bg-white/10 px-3 py-2"><p className="text-lg font-extrabold">{c.results.newFaces}</p><p className="text-xs text-[#D3CADC]">New faces</p></div>
                  </div>
                </div>
                <dl className="mt-4 divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-[#231A2C]">
                  {[
                    ['Reached', `${c.recipientCount} ${c.recipientCount === 1 ? 'guest' : 'guests'}`],
                    ['They spent', rwf(c.results.spentRwf)],
                    ['Paid with Skuzi', `${c.results.paidWithSkuzi} ${c.results.paidWithSkuzi === 1 ? 'bill' : 'bills'}`],
                    ['Skuzi fee (15% on those bills)', rwf(c.results.skuziFeeRwf)],
                  ].map(([k, v]) => <div key={k} className="flex justify-between px-4 py-3 text-sm"><dt className="text-gray-600 dark:text-gray-300">{k}</dt><dd className="font-bold text-gray-900 dark:text-white">{v}</dd></div>)}
                </dl>
                <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-green-600 dark:text-green-400"><TrendingUp size={16} /> Sending cost you nothing. You only pay for guests who came.</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Guests count as "came" when they sit down with Skuzi within 7 days of the campaign.</p>
              </>
            )}
            {c.status === 'scheduled' && (
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500 bg-amber-50 p-4 dark:bg-amber-500/10">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Goes out {when(c.sendAt)}. It's already on Explore{c.eventAt ? ' as an event' : ''}.</p>
                <button onClick={() => setConfirm(true)} className="min-h-[40px] rounded-xl border border-gray-300 bg-white px-4 text-sm font-bold text-gray-700 dark:border-gray-700 dark:bg-transparent dark:text-gray-200">Cancel it</button>
              </div>
            )}
          </>
        )}
      </div>
      {confirm && <ConfirmDialog title="Cancel this campaign?" message="It won't be sent, and it comes off Explore." confirmLabel="Cancel campaign" cancelLabel="Keep it" danger onConfirm={cancel} onCancel={() => setConfirm(false)} />}
    </Layout>
  );
}
