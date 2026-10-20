import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Gift, MapPin, QrCode } from "lucide-react";
import GuestShell, { GuestState } from "../../components/guest/GuestShell";
import { guestApi, apiError, rwf, dayLabel, kigaliDay } from "../../lib/guest";
import { statusText, DishIcon } from "./Explore";

// A restaurant's own page on Skuzi (/v/<slug>): what's on, its dishes with
// prices, opening hours, and "Book a table".
type Item = { id: string; name: string; description: string | null; category: string; priceRwf: number };
type Page = {
  slug: string; name: string; location: string | null; bookingsEnabled: boolean; hoursSet: boolean; isDemo: boolean;
  status: { open: boolean; closesAt?: string; opensAt?: string };
  hours: { day: string; hours: { open: string; close: string } | null }[];
  picks: { label: string; items: Item[] };
  events: { id: string; title: string | null; message: string; eventAt: string | null; time: string | null; offer: string | null }[];
  menu: Record<string, Item[]>;
};
const DAY_NAMES: Record<string, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
const WEEK = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export default function VenuePage() {
  const { slug = "" } = useParams();
  const [params] = useSearchParams();
  const campaign = params.get("c");
  const [page, setPage] = useState<Page | null>(null);
  const [error, setError] = useState<{ text: string; missing: boolean } | null>(null);
  const [cat, setCat] = useState<string | null>(null);

  const load = () => {
    setError(null);
    guestApi.get(`/guests/v/${encodeURIComponent(slug)}`)
      .then((r) => setPage(r.data.data))
      .catch((e) => setError({ text: apiError(e), missing: e?.response?.status === 404 }));
  };
  useEffect(load, [slug]);
  useEffect(() => { if (page) document.title = `${page.name} · Skuzi`; return () => { document.title = "Skuzi"; }; }, [page]);

  const categories = useMemo(() => Object.keys(page?.menu ?? {}), [page]);
  const shown = cat ?? categories[0] ?? null;

  if (error) {
    return (
      <GuestShell tab="explore">
        <GuestState
          title={error.missing ? "We couldn't find this restaurant" : "Couldn't load this page"}
          text={error.missing ? "The link may be old. Have a look at what's on Skuzi instead." : error.text}
          action={error.missing
            ? <Link to="/explore" className="mt-2 flex min-h-[44px] items-center rounded-full bg-action px-6 font-extrabold text-white">Explore Skuzi</Link>
            : <button onClick={load} className="mt-2 min-h-[44px] rounded-full bg-action px-6 font-extrabold text-white">Try again</button>}
        />
      </GuestShell>
    );
  }
  if (!page) {
    return (
      <GuestShell tab="explore" header={false}>
        <div className="-mx-5 h-48 animate-pulse bg-gray-900 md:mx-0 md:mt-6 md:rounded-[28px]" />
        <div className="mt-6 space-y-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-900" />)}</div>
      </GuestShell>
    );
  }

  const status = statusText(page.status, page.hoursSet);
  const event = page.events.find((e) => e.id === campaign) ?? page.events[0];
  const todayKey = kigaliDay(0);
  const evDay = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 2 * 3600e3).toISOString().slice(0, 10) : "");
  const bookHref = `/v/${page.slug}/book${campaign ? `?c=${campaign}` : ""}`;

  return (
    <GuestShell tab="explore" header={false}>
      <div className="md:grid md:grid-cols-[1fr_320px] md:gap-8 md:pt-6">
        <div className="min-w-0">
          {/* Hero */}
          <div className="-mx-5 bg-gray-900 px-5 pb-8 pt-4 text-[color:var(--g-text)] md:mx-0 md:rounded-[28px] md:px-8 md:pt-6">
            <Link to="/explore" aria-label="Back to Explore" className="flex h-11 w-11 items-center justify-center rounded-full bg-black/30 hover:bg-black/40">
              <ArrowLeft size={18} />
            </Link>
            <h1 className="mt-5 font-display text-[32px] font-extrabold leading-tight tracking-[-0.02em] md:text-[44px]">{page.name}</h1>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {page.location && <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-bold"><MapPin size={12} />{page.location}</span>}
              {status && <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${page.status.open ? "bg-[#5E7A55]/90" : "bg-white/15"}`}>{status}</span>}
              {page.isDemo && <span className="rounded-full bg-action px-2.5 py-1 text-xs font-extrabold text-action-ink">Demo restaurant</span>}
            </div>
          </div>

          {event && (
            <div className="relative -mt-4 rounded-[20px] border-[1.5px] border-gray-200 bg-white p-4 shadow-[0_8px_24px_rgba(35,26,44,.08)] dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-start gap-3">
                <div className="flex w-14 flex-none flex-col items-center">
                  <span className="text-[11px] font-extrabold uppercase text-brand-500 dark:text-[color:var(--g-hi)]">{evDay(event.eventAt) === todayKey ? "Tonight" : dayLabel(evDay(event.eventAt), true)}</span>
                  <span className="font-display text-lg font-extrabold">{event.time}</span>
                </div>
                <div className="min-w-0">
                  <p className="font-extrabold">{event.title}</p>
                  <p className="text-[13.5px] leading-snug text-gray-600 dark:text-gray-300">{event.message}</p>
                  {event.offer && <p className="mt-1.5 flex items-center gap-1.5 text-[13px] font-bold text-brand-600 dark:text-[color:var(--g-hi)]"><Gift size={15} /> {event.offer}</p>}
                </div>
              </div>
            </div>
          )}

          {page.picks.items.length > 0 && (
            <section className="mt-7" aria-labelledby="picks">
              <h2 id="picks" className="font-display text-xl font-extrabold">{page.picks.label}</h2>
              <div className="mt-3 grid grid-cols-3 gap-2.5">
                {page.picks.items.map((i) => (
                  <div key={i.id} className="rounded-[18px] bg-gray-900 p-3 text-[color:var(--g-text)]">
                    <div className="flex h-14 items-center justify-center rounded-xl bg-gray-800"><DishIcon category={i.category} className="h-7 w-7" /></div>
                    <p className="mt-2 line-clamp-2 text-[13px] font-bold leading-tight">{i.name}</p>
                    <p className="mt-1 text-[12.5px] font-bold text-[color:var(--g-hi)]">{rwf(i.priceRwf)}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {categories.length > 0 && (
            <section className="mt-7" aria-labelledby="menu">
              <h2 id="menu" className="font-display text-xl font-extrabold">Menu</h2>
              <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:px-0" role="tablist">
                {categories.map((c) => (
                  <button
                    key={c}
                    role="tab"
                    aria-selected={shown === c}
                    onClick={() => setCat(c)}
                    className={`min-h-[40px] flex-none rounded-full border-[1.5px] px-4 text-[13.5px] font-bold ${
                      shown === c ? "border-gray-900 bg-gray-900 text-[color:var(--g-text)] dark:border-[color:var(--g-hi)] dark:bg-action dark:text-action-ink" : "border-gray-200 bg-white dark:border-gray-800 dark:bg-transparent"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
                {(shown ? page.menu[shown] : []).map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-4 py-3.5">
                    <div className="min-w-0">
                      <p className="font-bold">{i.name}</p>
                      {i.description && <p className="text-[13px] text-gray-500 dark:text-gray-400">{i.description}</p>}
                    </div>
                    <span className="flex-none font-extrabold">{i.priceRwf.toLocaleString("en-US")}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400"><QrCode size={14} /> Prices in RWF. At your table, scan the sticker to order and pay.</p>
            </section>
          )}
        </div>

        {/* Side: book + hours (bottom bar on phones) */}
        <aside className="mt-8 md:mt-0">
          <div className="md:sticky md:top-6 md:rounded-[24px] md:border-[1.5px] md:border-gray-200 md:p-5 md:dark:border-gray-800">
            {page.bookingsEnabled && (
              <Link to={bookHref} className="hidden min-h-[54px] items-center justify-center rounded-full bg-action text-base font-extrabold text-white hover:bg-action-hover md:flex">
                Book a table
              </Link>
            )}
            {page.hoursSet && (
              <div className="md:mt-5">
                <h2 className="font-display text-lg font-extrabold">Opening hours</h2>
                <dl className="mt-2 space-y-1 text-sm">
                  {WEEK.map((d) => {
                    const h = page.hours.find((x) => x.day === d)?.hours;
                    return (
                      <div key={d} className="flex justify-between">
                        <dt className="text-gray-500 dark:text-gray-400">{DAY_NAMES[d]}</dt>
                        <dd className="font-semibold">{h ? `${h.open} – ${h.close}` : "Closed"}</dd>
                      </div>
                    );
                  })}
                </dl>
              </div>
            )}
          </div>
        </aside>
      </div>

      {page.bookingsEnabled && (
        <div className="fixed inset-x-0 bottom-[64px] z-20 border-t border-gray-200 bg-[#FDFCFE]/95 px-5 py-3 backdrop-blur dark:border-gray-800 dark:bg-gray-950/95 md:hidden" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
          <Link to={bookHref} className="mx-auto flex min-h-[52px] max-w-md items-center justify-center rounded-full bg-action text-base font-extrabold text-white">
            Book a table
          </Link>
        </div>
      )}
      {page.bookingsEnabled && <div className="h-20 md:hidden" aria-hidden="true" />}
    </GuestShell>
  );
}
