import { useEffect, useState } from 'react';
import { Check, Copy, MessageCircle, Plus, Wallet } from 'lucide-react';
import Layout from '../../components/Layout';
import ConfirmDialog from '../../components/ConfirmDialog';
import Toast from '../../components/Toast';
import api from '../../lib/api';

// The founder's list of Skuzi Creators: approve sign-ups (give a code), pause,
// and record monthly MoMo payouts. Only the founder's account sees this page.
type Creator = {
  id: string; name: string; handle: string | null; phone: string; wantedCode: string | null; code: string | null;
  status: 'applied' | 'active' | 'paused' | 'declined'; accessToken: string; createdAt: string;
  people: number; peopleThisMonth: number; earnedRwf: number; unpaidRwf: number;
};
type Tab = 'applied' | 'active' | 'other';
const MIN_PAYOUT = 5000;
const rwf = (n: number) => `${n.toLocaleString('en-US')} RWF`;
const suggest = (c: Creator) => c.wantedCode || c.name.split(' ')[0].toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);

export default function CreatorsAdmin() {
  const [list, setList] = useState<Creator[] | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('applied');
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'info' } | null>(null);
  const [paying, setPaying] = useState<Creator | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', handle: '', phone: '', code: '' });
  const [copied, setCopied] = useState(false);

  const load = () => api.get('/creators/admin').then((r) => setList(r.data.data)).catch((e) => setError(e?.response?.data?.error || "Couldn't load creators"));
  useEffect(() => { load(); }, []);
  useEffect(() => { if (list && tab === 'applied' && !list.some((c) => c.status === 'applied')) setTab('active'); }, [list]);

  const run = async (id: string, fn: () => Promise<unknown>, msg: string) => {
    setBusy(id);
    try { await fn(); setToast({ msg, type: 'success' }); await load(); }
    catch (e: any) { setToast({ msg: e?.response?.data?.error || 'Something went wrong. Please try again.', type: 'info' }); }
    finally { setBusy(null); }
  };
  const joinLink = `${window.location.origin}/creators/join`;
  const pageLink = (c: Creator) => `${window.location.origin}/creator/${c.accessToken}`;
  const waLink = (c: Creator) => {
    const to = '250' + c.phone.replace(/\D/g, '').replace(/^0/, '');
    const text = `Hi ${c.name.split(' ')[0]}! You're now a Skuzi creator 🎉\nYour code: ${c.code}\nYour link: ${window.location.origin}/c/${c.code}\nYour earnings page (keep it private): ${pageLink(c)}\nFor every new person who pays with Skuzi using your code, you earn a share of their first bill (8,000 RWF bill = 64 RWF), and they get the same back for their next Skuzi bill.`;
    return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
  };

  const shown = (list ?? []).filter((c) => (tab === 'other' ? c.status === 'paused' || c.status === 'declined' : c.status === tab));
  const dueNow = (list ?? []).filter((c) => c.unpaidRwf >= MIN_PAYOUT);
  const count = (s: Tab) => (list ?? []).filter((c) => (s === 'other' ? c.status === 'paused' || c.status === 'declined' : c.status === s)).length;
  const input = 'min-h-[42px] rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-[#1C1511] dark:text-white';
  const btn = 'min-h-[40px] rounded-xl px-3.5 text-sm font-bold disabled:opacity-50';

  return (
    <Layout>
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Creators</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">People who bring new guests with their code. On a new person's first bill, what Skuzi keeps (after payment costs) is split: 25% creator, 25% back to the guest, 50% Skuzi.</p>
          </div>
          <button onClick={() => setAdding((a) => !a)} className="flex min-h-[44px] items-center gap-2 rounded-xl bg-brand-500 px-4 text-sm font-bold text-white hover:bg-brand-600"><Plus size={16} /> Add a creator</button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl bg-[#2B201B] p-5 text-[#F4EDE3]">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-500"><Wallet size={14} /> To pay on the 1st</p>
            <p className="mt-1 font-display text-3xl font-extrabold">{rwf(dueNow.reduce((n, c) => n + c.unpaidRwf, 0))}</p>
            <p className="text-sm text-[#D8CBBF]">{dueNow.length} creator{dueNow.length === 1 ? '' : 's'} at {rwf(MIN_PAYOUT)} or more. Send by MoMo, then tap "Mark paid".</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-[#2B201B]">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Sign-up link to send in DMs</p>
            <p className="mt-1 break-all font-bold text-gray-900 dark:text-white">{joinLink.replace(/^https?:\/\//, '')}</p>
            <button onClick={async () => { try { await navigator.clipboard.writeText(joinLink); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ } }}
              className={`${btn} mt-3 flex items-center gap-1.5 bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-white/10 dark:text-gray-100`}>{copied ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy link</>}</button>
          </div>
        </div>

        {adding && (
          <form onSubmit={(e) => { e.preventDefault(); run('new', () => api.post('/creators/admin', { ...form, handle: form.handle || null }), `${form.name} added with code ${form.code.toUpperCase()}`).then(() => { setAdding(false); setForm({ name: '', handle: '', phone: '', code: '' }); }); }}
            className="mt-4 grid gap-2 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-[#2B201B] sm:grid-cols-5">
            <label className="sr-only" htmlFor="ad-name">Name</label><input id="ad-name" className={input} placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <label className="sr-only" htmlFor="ad-handle">TikTok or Instagram</label><input id="ad-handle" className={input} placeholder="@account" value={form.handle} onChange={(e) => setForm({ ...form, handle: e.target.value })} />
            <label className="sr-only" htmlFor="ad-phone">MoMo number</label><input id="ad-phone" className={input} placeholder="MoMo 07…" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <label className="sr-only" htmlFor="ad-code">Code</label><input id="ad-code" className={`${input} uppercase`} placeholder="CODE" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} />
            <button type="submit" disabled={busy === 'new'} className={`${btn} bg-green-500 text-white hover:bg-green-600`}>Add</button>
          </form>
        )}

        <div className="mt-6 flex gap-2" role="tablist">
          {([['applied', 'Waiting'], ['active', 'Active'], ['other', 'Paused']] as [Tab, string][]).map(([t, l]) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={`min-h-[40px] rounded-full border px-4 text-sm font-bold ${tab === t ? 'border-gray-900 bg-gray-900 text-white dark:border-amber-500 dark:bg-amber-500 dark:text-gray-900' : 'border-gray-200 bg-white text-gray-700 dark:border-gray-800 dark:bg-[#2B201B] dark:text-gray-200'}`}>
              {l} · {count(t)}
            </button>
          ))}
        </div>

        {error && <p role="alert" className="mt-4 text-sm text-red-500">{error}</p>}
        {list === null ? (
          <div className="mt-4 space-y-2">{[0, 1].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />)}</div>
        ) : shown.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
            {tab === 'applied' ? 'No sign-ups waiting. Send the sign-up link to creators you like.' : tab === 'active' ? 'No active creators yet.' : 'Nobody paused.'}
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {shown.map((c) => (
              <li key={c.id} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-[#2B201B]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 dark:text-white">{c.name} {c.code && <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-extrabold tracking-wider text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">{c.code}</span>}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{[c.handle, c.phone].filter(Boolean).join(' · ')}</p>
                  </div>
                  {c.status !== 'applied' && (
                    <div className="flex gap-4 text-right text-sm">
                      <div><p className="font-display text-lg font-extrabold text-gray-900 dark:text-white">{c.people}</p><p className="text-xs text-gray-500 dark:text-gray-400">people</p></div>
                      <div><p className="font-display text-lg font-extrabold text-gray-900 dark:text-white">{c.earnedRwf.toLocaleString('en-US')}</p><p className="text-xs text-gray-500 dark:text-gray-400">earned</p></div>
                      <div><p className={`font-display text-lg font-extrabold ${c.unpaidRwf >= MIN_PAYOUT ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}>{c.unpaidRwf.toLocaleString('en-US')}</p><p className="text-xs text-gray-500 dark:text-gray-400">to pay</p></div>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {c.status === 'applied' && (
                    <>
                      <label className="sr-only" htmlFor={`code-${c.id}`}>Code for {c.name}</label>
                      <input id={`code-${c.id}`} className={`${input} w-36 uppercase tracking-wider`} value={codes[c.id] ?? suggest(c)} onChange={(e) => setCodes({ ...codes, [c.id]: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} />
                      <button disabled={busy === c.id} onClick={() => run(c.id, () => api.post(`/creators/admin/${c.id}/approve`, { code: codes[c.id] ?? suggest(c) }), `${c.name} approved. Send them their link on WhatsApp.`)} className={`${btn} bg-green-500 text-white hover:bg-green-600`}>Approve</button>
                      <button disabled={busy === c.id} onClick={() => run(c.id, () => api.post(`/creators/admin/${c.id}/status`, { status: 'declined' }), 'Declined')} className={`${btn} border border-gray-200 text-gray-700 dark:border-gray-700 dark:text-gray-200`}>Decline</button>
                    </>
                  )}
                  {c.status === 'active' && (
                    <>
                      <a href={waLink(c)} target="_blank" rel="noreferrer" className={`${btn} flex items-center gap-1.5 bg-[#25D366]/15 text-[#1a8f47] dark:text-[#4ade80]`}><MessageCircle size={15} /> Send their links on WhatsApp</a>
                      {c.unpaidRwf > 0 && <button disabled={busy === c.id} onClick={() => setPaying(c)} className={`${btn} bg-amber-500 text-gray-900 hover:bg-amber-400`}>Mark paid · {rwf(c.unpaidRwf)}</button>}
                      <button disabled={busy === c.id} onClick={() => run(c.id, () => api.post(`/creators/admin/${c.id}/status`, { status: 'paused' }), `${c.name}'s code is paused`)} className={`${btn} border border-gray-200 text-gray-700 dark:border-gray-700 dark:text-gray-200`}>Pause</button>
                    </>
                  )}
                  {(c.status === 'paused' || c.status === 'declined') && c.code && (
                    <button disabled={busy === c.id} onClick={() => run(c.id, () => api.post(`/creators/admin/${c.id}/status`, { status: 'active' }), `${c.name} is active again`)} className={`${btn} bg-green-500 text-white`}>Make active</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {paying && (
        <ConfirmDialog
          title={`Did you send ${rwf(paying.unpaidRwf)} to ${paying.name.split(' ')[0]}?`}
          message={`To their MoMo ${paying.phone}. Their page will show it as paid.`}
          confirmLabel="Yes, mark paid"
          cancelLabel="Not yet"
          loading={busy === paying.id}
          onConfirm={async () => { const c = paying; await run(c.id, () => api.post(`/creators/admin/${c.id}/paid`), `${c.name}: payout recorded`); setPaying(null); }}
          onCancel={() => setPaying(null)}
        />
      )}
      {toast && <Toast message={toast.msg} type={toast.type} onDismiss={() => setToast(null)} />}
    </Layout>
  );
}
