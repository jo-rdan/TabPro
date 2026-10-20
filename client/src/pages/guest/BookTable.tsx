import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Minus, Plus } from "lucide-react";
import GuestShell, { GuestState } from "../../components/guest/GuestShell";
import { guestApi, apiError, dayLabel, kigaliDay, saveBooking, guestName, setGuestName } from "../../lib/guest";

// Book a table: day, time, how many, name and phone. Free; the restaurant
// confirms. Only real, open times can be picked.
const DAYS = 14;
const PHONE_KEY = "skuzi_guest_phone";
const readPhone = () => { try { return localStorage.getItem(PHONE_KEY) ?? ""; } catch { return ""; } };

export default function BookTable() {
  const { slug = "" } = useParams();
  const [params] = useSearchParams();
  const campaignId = params.get("c");
  const navigate = useNavigate();
  const [venue, setVenue] = useState<{ name: string; bookingsEnabled: boolean } | null>(null);
  const [loadError, setLoadError] = useState("");
  const [day, setDay] = useState(kigaliDay(0));
  const [times, setTimes] = useState<string[] | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [party, setParty] = useState(2);
  const [name, setName] = useState(guestName() ?? "");
  const [phone, setPhone] = useState(readPhone());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [triedToday, setTriedToday] = useState(false);

  useEffect(() => {
    guestApi.get(`/guests/v/${encodeURIComponent(slug)}`)
      .then((r) => setVenue(r.data.data))
      .catch((e) => setLoadError(e?.response?.status === 404 ? "We couldn't find this restaurant" : apiError(e)));
  }, [slug]);

  useEffect(() => {
    setTimes(null);
    setTime(null);
    guestApi.get(`/guests/v/${encodeURIComponent(slug)}/times`, { params: { date: day } })
      .then((r) => {
        const t: string[] = r.data.data.times;
        // Nothing left today? Jump to tomorrow once, so the first screen is useful.
        if (!t.length && day === kigaliDay(0) && !triedToday) { setTriedToday(true); setDay(kigaliDay(1)); return; }
        setTimes(t);
        setTime((cur) => cur && t.includes(cur) ? cur : t.find((x) => x >= "19:00") ?? t[0] ?? null);
      })
      .catch(() => setTimes([]));
  }, [slug, day]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!time) { setError("Pick a time"); return; }
    if (name.trim().length < 2) { setError("Please enter your name"); return; }
    if (phone.replace(/\D/g, "").length < 9) { setError("Please enter your phone number"); return; }
    setBusy(true);
    setError("");
    try {
      const r = await guestApi.post("/guests/bookings", { slug, date: day, time, partySize: party, name: name.trim(), phone: phone.trim(), note: note.trim() || null, campaignId });
      const b = r.data.data;
      saveBooking({ id: b.id, token: b.token });
      setGuestName(name.trim());
      try { localStorage.setItem(PHONE_KEY, phone.trim()); } catch { /* ignore */ }
      navigate(`/booking/${b.id}?t=${encodeURIComponent(b.token)}`, { replace: true, state: { justBooked: true } });
    } catch (err) {
      setError(apiError(err));
      setBusy(false);
    }
  };

  if (loadError) {
    return <GuestShell tab="explore"><GuestState title={loadError} action={<Link to="/explore" className="mt-2 flex min-h-[44px] items-center rounded-full bg-brand-500 px-6 font-extrabold text-white">Explore Skuzi</Link>} /></GuestShell>;
  }
  if (venue && !venue.bookingsEnabled) {
    return <GuestShell tab="explore"><GuestState title={`${venue.name} isn't taking bookings on Skuzi right now`} text="You can still walk in, or try another day." action={<Link to={`/v/${slug}`} className="mt-2 flex min-h-[44px] items-center rounded-full bg-brand-500 px-6 font-extrabold text-white">See the menu</Link>} /></GuestShell>;
  }

  const label = "text-xs font-extrabold uppercase tracking-[0.08em] text-brand-700 dark:text-[#F2B33A]";
  const field = "h-12 w-full rounded-2xl border-[1.5px] border-gray-200 bg-white px-4 text-[15px] font-semibold text-gray-900 outline-none placeholder:font-medium placeholder:text-gray-400 focus:border-brand-500 dark:border-[#33293F] dark:bg-[#231A2C] dark:text-[#F4F0F7]";
  const chip = (on: boolean) => `border-[1.5px] font-bold ${on ? "border-gray-900 bg-gray-900 text-[#F4F0F7] dark:border-[#F2B33A] dark:bg-[#F2B33A] dark:text-[#231A2C]" : "border-gray-200 bg-white text-gray-900 dark:border-[#33293F] dark:bg-[#231A2C] dark:text-[#F4F0F7]"}`;

  return (
    <GuestShell tone="night" header={false}>
      <div className="mx-auto max-w-xl">
        <div className="-mx-5 bg-[#1B1524] px-5 pb-6 pt-4 text-[#F4F0F7] md:mx-0 md:mt-6 md:rounded-[28px] md:px-8">
          <Link to={`/v/${slug}`} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/15"><ArrowLeft size={18} /></Link>
          <p className="mt-4 text-xs font-extrabold uppercase tracking-[0.08em] text-[#F2B33A]">Book a table</p>
          <h1 className="font-display text-[28px] font-extrabold tracking-[-0.02em]">{venue?.name ?? "…"}</h1>
          <p className="text-sm text-[#D3CADC]">Free. No call needed. The restaurant confirms.</p>
        </div>

        <form onSubmit={submit} className="mt-5 flex flex-col gap-5" noValidate>
          <fieldset>
            <legend className={label}>Day</legend>
            <div className="-mx-5 mt-2 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:px-0">
              {Array.from({ length: DAYS }, (_, i) => kigaliDay(i)).map((k) => (
                <button type="button" key={k} onClick={() => setDay(k)} aria-pressed={day === k}
                  className={`min-h-[56px] min-w-[76px] flex-none rounded-2xl px-3 text-[13px] leading-tight ${chip(day === k)}`}>
                  {dayLabel(k, true)}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className={label}>Time</legend>
            {times === null ? (
              <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6">{[0, 1, 2, 3].map((i) => <div key={i} className="h-11 animate-pulse rounded-xl bg-gray-100 dark:bg-[#231A2C]" />)}</div>
            ) : times.length === 0 ? (
              <p className="mt-2 rounded-2xl bg-gray-100 px-4 py-3 text-sm text-gray-600 dark:bg-[#231A2C] dark:text-gray-300">
                {day === kigaliDay(0) ? "No more times today. Pick another day." : "Closed that day. Pick another day."}
              </p>
            ) : (
              <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6">
                {times.map((t) => (
                  <button type="button" key={t} onClick={() => setTime(t)} aria-pressed={time === t}
                    className={`min-h-[44px] rounded-xl text-sm ${time === t ? "border-[1.5px] border-brand-500 bg-brand-500 font-bold text-white" : chip(false)}`}>
                    {t}
                  </button>
                ))}
              </div>
            )}
          </fieldset>

          <div className="flex items-center justify-between rounded-2xl border-[1.5px] border-gray-200 bg-white px-4 py-3 dark:border-[#33293F] dark:bg-[#231A2C]">
            <span id="people" className="font-bold">People</span>
            <div className="flex items-center gap-4" role="group" aria-labelledby="people">
              <button type="button" aria-label="Fewer people" disabled={party <= 1} onClick={() => setParty((p) => Math.max(1, p - 1))}
                className="flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-gray-200 disabled:opacity-40 dark:border-[#33293F]"><Minus size={18} /></button>
              <span className="min-w-[24px] text-center font-display text-2xl font-extrabold" aria-live="polite">{party}</span>
              <button type="button" aria-label="More people" disabled={party >= 30} onClick={() => setParty((p) => Math.min(30, p + 1))}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-900 text-[#F4F0F7] disabled:opacity-40 dark:bg-[#F2B33A] dark:text-[#231A2C]"><Plus size={18} /></button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className={label}>Your details</span>
            <label className="sr-only" htmlFor="bk-name">Your name</label>
            <input id="bk-name" className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" maxLength={60} />
            <label className="sr-only" htmlFor="bk-phone">Phone number</label>
            <input id="bk-phone" className={field} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone, e.g. 0788 123 456" type="tel" inputMode="tel" autoComplete="tel" maxLength={20} />
            <label className="sr-only" htmlFor="bk-note">Note for the restaurant (optional)</label>
            <input id="bk-note" className={field} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note, e.g. birthday (optional)" maxLength={200} />
          </div>

          {error && <p role="alert" className="rounded-2xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-200">{error}</p>}

          <div>
            <button type="submit" disabled={busy || !time}
              className="min-h-[54px] w-full rounded-full bg-brand-500 text-base font-extrabold text-white hover:bg-brand-600 disabled:opacity-50">
              {busy ? "Sending…" : time ? `Book for ${party} · ${dayLabel(day, true)} ${time}` : "Pick a time"}
            </button>
            <p className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">Free. You'll get an answer from the restaurant.</p>
          </div>
        </form>
      </div>
    </GuestShell>
  );
}
