import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Gift, MapPin, Clock } from "lucide-react";
import GuestShell, { GuestState } from "../../components/guest/GuestShell";
import { guestApi, guestName, apiError, rwf, dayLabel, kigaliDay } from "../../lib/guest";

// "Where to tonight?" Built to look full with one restaurant: it leads with
// tonight's event (or the restaurant itself), then real dishes, then the week.
// Nothing is made up and there are no counters.
type Item = { id: string; name: string; description: string | null; category: string; priceRwf: number };
type Status = { open: boolean; closesAt?: string; opensAt?: string };
type Venue = {
  slug: string; name: string; location: string | null; logoUrl: string | null; bookingsEnabled: boolean; hoursSet: boolean;
  status: Status; picks: { label: string; items: Item[] };
};
type Event = { id: string; title: string | null; message: string; eventAt: string | null; time: string | null; offer: string | null; venue: { slug: string; name: string; location: string | null } };

const greeting = () => {
  const h = new Date(Date.now() + 2 * 3600e3).getUTCHours();
  return h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};
export const statusText = (s: Status, hoursSet: boolean) =>
  !hoursSet ? null : s.open ? `Open now · until ${s.closesAt}` : s.opensAt ? `Opens ${/^\w{3} /.test(s.opensAt) ? s.opensAt.replace(/^(\w)(\w\w)/, (_, a, b) => a.toUpperCase() + b) : `at ${s.opensAt}`}` : "Closed";

const eventDay = (iso: string | null) => (iso ? dayLabel(new Date(new Date(iso).getTime() + 2 * 3600e3).toISOString().slice(0, 10), true) : "");
const isDrink = (c: string) => /drink|beer|bia|wine|cocktail|juice|soda|spirit|bar|coffee|tea|shot/i.test(c);

export function DishIcon({ category, className = "" }: { category: string; className?: string }) {
  return isDrink(category) ? (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="#D9A441" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 4h10l-1 16H8z" /><path d="M7.5 9h9" /></svg>
  ) : (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="#D9A441" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 13h18" /><path d="M5 13a7 7 0 0 1 14 0" /><path d="M12 6V4" /><path d="M2 17h20" /></svg>
  );
}
const TILE = ["#5C3A2C", "#3E4A37", "#6B4A1E", "#4A2F3A", "#2F3F4A", "#5A4630"];

export default function Explore() {
  const [data, setData] = useState<{ venues: Venue[]; events: Event[] } | null>(null);
  const [error, setError] = useState("");
  const load = () => {
    setError("");
    guestApi.get("/guests/explore").then((r) => setData(r.data.data)).catch((e) => setError(apiError(e)));
  };
  useEffect(load, []);
  const name = guestName();

  if (error) {
    return (
      <GuestShell tab="explore" tone="night">
        <GuestState title="Couldn't load Explore" text={error} action={<button onClick={load} className="mt-2 min-h-[44px] rounded-full bg-[#D9A441] px-6 font-extrabold text-[#2B201B]">Try again</button>} />
      </GuestShell>
    );
  }

  const venues = data?.venues ?? [];
  const events = data?.events ?? [];
  const today = kigaliDay(0);
  const hero = events[0] ?? null;
  const heroVenue = hero ? venues.find((v) => v.slug === hero.venue.slug) : venues[0];
  const dishes = venues.flatMap((v) => v.picks.items.map((i) => ({ ...i, venue: v }))).slice(0, 6);
  const week = events.slice(hero ? 1 : 0, 6);

  return (
    <GuestShell tab="explore" tone="night">
      <section className="pt-5">
        <p className="text-sm text-[#D8CBBF]">{greeting()}{name ? `, ${name}` : ""}</p>
        <h1 className="font-display text-[32px] font-extrabold leading-tight tracking-[-0.03em] md:text-5xl">
          Where to <span className="text-[#D9A441]">tonight?</span>
        </h1>
      </section>

      {!data ? (
        <div className="mt-5 grid gap-4 md:grid-cols-[1.35fr_1fr]" aria-busy="true">
          <div className="h-60 animate-pulse rounded-[26px] bg-[#2B201B]" />
          <div className="h-60 animate-pulse rounded-[26px] bg-[#2B201B]" />
        </div>
      ) : venues.length === 0 ? (
        <GuestState
          title="Skuzi is coming to restaurants near you"
          text="Ask your favourite restaurant or bar for Skuzi. Less waiting, more fun."
        />
      ) : (
        <div className="mt-5 grid gap-6 md:grid-cols-[1.35fr_1fr] md:items-start">
          {/* Tonight: the event, else the restaurant itself */}
          <article className="relative overflow-hidden rounded-[26px] bg-[radial-gradient(120%_120%_at_100%_0%,#A64B31,#3A2017_60%)] p-5 md:p-7">
            {hero ? (
              <>
                <span className="inline-block rounded-full bg-[#D9A441] px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#2B201B]">
                  {hero.eventAt && new Date(new Date(hero.eventAt).getTime() + 2 * 3600e3).toISOString().slice(0, 10) === today ? "Tonight" : eventDay(hero.eventAt)}
                  {hero.time ? ` · ${hero.time}` : ""}
                </span>
                <h2 className="mt-3 font-display text-[34px] font-extrabold leading-none tracking-[-0.02em] md:text-[44px]">{hero.title}</h2>
                <p className="mt-2 flex items-center gap-1.5 text-sm text-[#F4E3D7]"><MapPin size={14} /> {hero.venue.name}{hero.venue.location ? ` · ${hero.venue.location}` : ""}</p>
                <p className="mt-2 text-[14.5px] leading-snug text-[#F4EDE3]/90">{hero.message}</p>
                {hero.offer && <p className="mt-2 flex items-center gap-1.5 text-[13.5px] font-semibold"><Gift size={16} className="text-[#D9A441]" /> {hero.offer}</p>}
              </>
            ) : heroVenue ? (
              <>
                {statusText(heroVenue.status, heroVenue.hoursSet) && (
                  <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] ${heroVenue.status.open ? "bg-[#5E7A55] text-white" : "bg-[#D9A441] text-[#2B201B]"}`}>
                    {statusText(heroVenue.status, heroVenue.hoursSet)}
                  </span>
                )}
                <h2 className="mt-3 font-display text-[34px] font-extrabold leading-none tracking-[-0.02em] md:text-[44px]">{heroVenue.name}</h2>
                {heroVenue.location && <p className="mt-2 flex items-center gap-1.5 text-sm text-[#F4E3D7]"><MapPin size={14} /> {heroVenue.location}</p>}
                <p className="mt-2 text-[14.5px] text-[#F4EDE3]/90">See the menu and prices before you go.</p>
              </>
            ) : null}
            {heroVenue && (
              <div className="mt-5 flex gap-2">
                {heroVenue.bookingsEnabled && (
                  <Link to={`/v/${heroVenue.slug}/book${hero ? `?c=${hero.id}` : ""}`} className="flex min-h-[46px] flex-1 items-center justify-center rounded-full bg-[#FFFCF7] px-4 text-[14.5px] font-extrabold text-[#2B201B] hover:bg-white">
                    Book a table
                  </Link>
                )}
                <Link to={`/v/${heroVenue.slug}${hero ? `?c=${hero.id}` : ""}`} className="flex min-h-[46px] flex-1 items-center justify-center rounded-full border-[1.5px] border-[#F4EDE3]/50 px-4 text-[14.5px] font-extrabold hover:bg-white/10">
                  See the menu
                </Link>
              </div>
            )}
          </article>

          <div className="flex flex-col gap-6">
            {dishes.length > 0 && (
              <section aria-labelledby="hungry">
                <h2 id="hungry" className="font-display text-[19px] font-extrabold">Hungry for…</h2>
                <div className="-mx-5 mt-3 flex snap-x gap-2.5 overflow-x-auto px-5 pb-1 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
                  {dishes.map((d, i) => (
                    <Link key={d.id} to={`/v/${d.venue.slug}`} className="w-[118px] flex-none snap-start rounded-[18px] bg-[#2B201B] p-3 hover:bg-[#3A2D26] md:w-auto">
                      <div className="flex h-16 items-center justify-center rounded-xl" style={{ background: TILE[i % TILE.length] }}>
                        <DishIcon category={d.category} className="h-8 w-8" />
                      </div>
                      <p className="mt-2 line-clamp-2 text-[13.5px] font-bold leading-tight">{d.name}</p>
                      <p className="mt-1 text-[12.5px] font-bold text-[#D9A441]">{rwf(d.priceRwf)}</p>
                      {venues.length > 1 && <p className="mt-0.5 truncate text-[11px] text-[#D8CBBF]">{d.venue.name}</p>}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {week.length > 0 && (
              <section aria-labelledby="week">
                <h2 id="week" className="font-display text-[19px] font-extrabold">This week</h2>
                <ul className="mt-3 flex flex-col gap-2">
                  {week.map((e) => {
                    const d = e.eventAt ? new Date(new Date(e.eventAt).getTime() + 2 * 3600e3) : null;
                    return (
                      <li key={e.id}>
                        <Link to={`/v/${e.venue.slug}?c=${e.id}`} className="flex items-center gap-3 rounded-2xl bg-[#2B201B] px-3 py-2.5 hover:bg-[#3A2D26]">
                          <div className="flex w-11 flex-col items-center">
                            <span className="text-[11px] font-extrabold uppercase text-[#D9A441]">{d?.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })}</span>
                            <span className="font-display text-lg font-extrabold">{d?.getUTCDate()}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold">{e.title}</p>
                            <p className="truncate text-xs text-[#D8CBBF]">{e.venue.name}{e.time ? ` · ${e.time}` : ""}</p>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {venues.length > 1 && (
              <section aria-labelledby="places">
                <h2 id="places" className="font-display text-[19px] font-extrabold">Places on Skuzi</h2>
                <ul className="mt-3 flex flex-col gap-2">
                  {venues.map((v) => (
                    <li key={v.slug}>
                      <Link to={`/v/${v.slug}`} className="flex items-center justify-between gap-3 rounded-2xl bg-[#2B201B] px-4 py-3 hover:bg-[#3A2D26]">
                        <div className="min-w-0">
                          <p className="truncate font-bold">{v.name}</p>
                          <p className="truncate text-xs text-[#D8CBBF]">{[v.location, statusText(v.status, v.hoursSet)].filter(Boolean).join(" · ")}</p>
                        </div>
                        <Clock size={16} className={v.status.open ? "text-[#86A27B]" : "text-[#D8CBBF]"} aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      )}
    </GuestShell>
  );
}
