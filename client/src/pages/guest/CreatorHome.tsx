import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Check, Copy, Users, Wallet, Clock } from "lucide-react";
import GuestShell, { GuestState, Hand } from "../../components/guest/GuestShell";
import { guestApi, apiError, rwf, saveCreatorCode } from "../../lib/guest";

// A creator's own page (private link from the founder): their code, their link,
// how many people they brought and what they've earned. Never who the people are.
type Home = {
  name: string; handle: string | null; status: string; code: string | null;
  people: number; peopleThisMonth: number; earnedRwf: number; unpaidRwf: number; paidRwf: number; minPayoutRwf: number;
  recent: { createdAt: string; earningRwf: number; venue: string | null }[];
  payouts: { amountRwf: number; people: number; paidAt: string }[];
};

const nextFirst = () => {
  const d = new Date(Date.now() + 2 * 3600e3);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
};
const day = (iso: string) => new Date(new Date(iso).getTime() + 2 * 3600e3).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export function CreatorHome() {
  const { token = "" } = useParams();
  const [h, setH] = useState<Home | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  useEffect(() => {
    guestApi.get(`/creators/me/${encodeURIComponent(token)}`).then((r) => setH(r.data.data)).catch((e) => setError(e?.response?.status === 404 ? "missing" : apiError(e)));
  }, [token]);

  if (error) return <GuestShell><GuestState title={error === "missing" ? "We couldn't find this page" : "Couldn't load your page"} text={error === "missing" ? "Ask the Skuzi team to send you your link again." : error} /></GuestShell>;
  if (!h) return <GuestShell><div className="mx-auto mt-16 h-48 max-w-md animate-pulse rounded-3xl bg-gray-100 dark:bg-gray-900" /></GuestShell>;

  const link = h.code ? `${window.location.origin}/c/${h.code}` : "";
  const copy = async (what: "code" | "link") => {
    try { await navigator.clipboard.writeText(what === "code" ? h.code ?? "" : link); setCopied(what); setTimeout(() => setCopied(null), 1600); } catch { /* ignore */ }
  };
  const stat = "rounded-2xl border-[1.5px] border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900";

  return (
    <GuestShell>
      <div className="mx-auto max-w-3xl pt-6">
        <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-brand-700 dark:text-[color:var(--g-hi)]">Skuzi Creator</p>
        <h1 className="font-display text-[32px] font-extrabold tracking-[-0.02em]">Hi, {h.name.split(" ")[0]}</h1>

        {h.status === "applied" && <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">We're reviewing your sign-up. You'll get your code on WhatsApp soon.</p>}
        {h.status === "paused" && <p className="mt-4 rounded-2xl bg-gray-100 px-4 py-3 text-sm font-semibold text-gray-700 dark:bg-white/10 dark:text-gray-200">Your code is paused right now. Contact the Skuzi team.</p>}

        {h.code && (
          <div className="mt-5 rounded-[24px] bg-[radial-gradient(120%_120%_at_100%_0%,#BF4A1A,#231A2C_62%)] p-5 text-[color:var(--g-text)] md:p-7">
            <p className="text-sm text-[color:var(--g-muted)]">Your code</p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <span className="font-display text-[44px] font-extrabold leading-none tracking-[0.04em]">{h.code}</span>
              <button onClick={() => copy("code")} className="flex min-h-[40px] items-center gap-1.5 rounded-full bg-white/15 px-4 text-sm font-bold hover:bg-white/25">{copied === "code" ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy</>}</button>
            </div>
            <p className="mt-4 text-sm text-[color:var(--g-muted)]">Your link (put it in your bio)</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="break-all text-[15px] font-bold">{link.replace(/^https?:\/\//, "")}</span>
              <button onClick={() => copy("link")} className="flex min-h-[40px] items-center gap-1.5 rounded-full bg-action px-4 text-sm font-extrabold text-action-ink">{copied === "link" ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy link</>}</button>
            </div>
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className={stat}><Users size={18} className="text-brand-500" /><p className="mt-2 font-display text-3xl font-extrabold">{h.peopleThisMonth}</p><p className="text-xs text-gray-500 dark:text-gray-400">People this month</p></div>
          <div className={stat}><Wallet size={18} className="text-brand-500" /><p className="mt-2 font-display text-3xl font-extrabold">{h.earnedRwf.toLocaleString("en-US")}</p><p className="text-xs text-gray-500 dark:text-gray-400">RWF earned in total</p></div>
          <div className={stat}><Clock size={18} className="text-amber-500" /><p className="mt-2 font-display text-3xl font-extrabold">{h.unpaidRwf.toLocaleString("en-US")}</p><p className="text-xs text-gray-500 dark:text-gray-400">RWF waiting for payout</p></div>
          <div className={stat}><Check size={18} className="text-green-500" /><p className="mt-2 font-display text-3xl font-extrabold">{h.paidRwf.toLocaleString("en-US")}</p><p className="text-xs text-gray-500 dark:text-gray-400">RWF paid to your MoMo</p></div>
        </div>
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
          {h.unpaidRwf >= h.minPayoutRwf
            ? <>Next payout: <b>{rwf(h.unpaidRwf)}</b> on {nextFirst()}.</>
            : <>Payouts go out on the 1st once you reach {rwf(h.minPayoutRwf)}. You're {rwf(Math.max(0, h.minPayoutRwf - h.unpaidRwf))} away.</>}
        </p>

        <section className="mt-8">
          <h2 className="font-display text-xl font-extrabold">People you brought</h2>
          {h.recent.length === 0 ? (
            <p className="mt-2 rounded-2xl border-[1.5px] border-dashed border-gray-200 p-5 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">Nobody yet. Post a video at a Skuzi restaurant and say your code!</p>
          ) : (
            <ul className="mt-2 divide-y divide-gray-100 rounded-2xl border-[1.5px] border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
              {h.recent.map((r, i) => (
                <li key={i} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span>{day(r.createdAt)} · {r.venue ?? "A Skuzi restaurant"}</span>
                  <span className="font-extrabold text-green-600 dark:text-green-400">+{r.earningRwf.toLocaleString("en-US")} RWF</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-8 rounded-[22px] bg-gray-900 p-5 text-[color:var(--g-text)]">
          <h2 className="font-display text-lg font-extrabold">How you earn</h2>
          <ul className="mt-2 space-y-1.5 text-sm text-[color:var(--g-muted)]">
            <li>For every new person: <b className="text-[color:var(--g-hi)]">a share of their first bill</b>. A bill of 8,000 RWF earns you 64 RWF; 20,000 RWF earns you 184 RWF.</li>
            <li>They get the same amount back as Skuzi money for their next Skuzi bill. Tell them!</li>
            <li>They must be new to Skuzi, pay with Skuzi, and type your code (or open your link first). Each person counts once.</li>
            <li>Tip: bigger bills earn you more. Tag <b className="text-[color:var(--g-text)]">@skuzi.xyz</b> in your videos.</li>
          </ul>
        </section>
      </div>
    </GuestShell>
  );
}

/** /c/<CODE>: a follower opened a creator's link. Keep the code for when they pay. */
export function CreatorLink() {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    guestApi.get(`/creators/code/${encodeURIComponent(code)}`)
      .then((r) => { saveCreatorCode(r.data.data.code, r.data.data.name); setName(r.data.data.name); })
      .catch(() => setMissing(true));
  }, [code]);
  useEffect(() => { if (missing) navigate("/explore", { replace: true }); }, [missing]);
  return (
    <GuestShell tone="night" header={false}>
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
        <Hand className="h-16 w-16" />
        {name ? (
          <>
            <h1 className="font-display text-[32px] font-extrabold leading-tight tracking-[-0.02em]"><span className="text-[color:var(--g-hi)]">{name}</span> invited you to Skuzi</h1>
            <p className="max-w-xs text-[15px] text-[color:var(--g-muted)]">Order and pay from your table at Skuzi restaurants. Pay with Skuzi and you get money back for your next Skuzi bill. {name}'s code is saved for when you pay.</p>
            <Link to="/explore" className="mt-2 flex min-h-[52px] items-center rounded-full bg-action px-8 text-base font-extrabold text-action-ink">See where to go tonight</Link>
          </>
        ) : <p className="text-sm text-[color:var(--g-muted)]" aria-live="polite">One moment…</p>}
      </div>
    </GuestShell>
  );
}
