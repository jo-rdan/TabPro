import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { Bell, CalendarCheck, CalendarX, Check, Clock, Send, Users } from "lucide-react";
import GuestShell, { GuestState } from "../../components/guest/GuestShell";
import ConfirmDialog from "../../components/ConfirmDialog";
import { guestApi, apiError, dayLabel, saveBooking, pushSupported, needsHomeScreen, getDeviceSubscription } from "../../lib/guest";

// A guest's booking, on its private link (/booking/<id>?t=<token>). Shows the
// answer as soon as it comes (checks every 20 s while waiting) and lets them
// cancel. Notifications are offered for the answer and the 2-hour reminder.
type Booking = {
  id: string; token: string; status: "pending" | "confirmed" | "declined" | "cancelled" | "expired" | "seated";
  date: string; time: string; partySize: number; name: string; note: string | null; table: string | null; startsAt: string;
  venue: { name: string; slug: string; location: string | null };
};

const HERO: Record<Booking["status"], { title: (b: Booking) => string; text: (b: Booking) => string; tone: string; Icon: typeof Send }> = {
  pending: { title: () => "Request sent!", text: (b) => `${b.venue.name} will confirm soon.`, tone: "bg-gray-100 text-brand-500 dark:bg-gray-900 dark:text-[color:var(--g-hi)]", Icon: Send },
  confirmed: { title: () => "You're booked!", text: (b) => `See you ${dayLabel(b.date).toLowerCase() === "today" ? "today" : dayLabel(b.date)} at ${b.time}.`, tone: "bg-green-500 text-white", Icon: CalendarCheck },
  seated: { title: () => "Enjoy your night!", text: (b) => `You're at ${b.venue.name}${b.table ? `, ${b.table}` : ""}.`, tone: "bg-green-500 text-white", Icon: Check },
  declined: { title: () => "Not this time", text: (b) => `${b.venue.name} can't take this booking. Try another time or another place.`, tone: "bg-gray-100 text-gray-500 dark:bg-gray-900 dark:text-gray-300", Icon: CalendarX },
  cancelled: { title: () => "Booking cancelled", text: () => "This booking is cancelled.", tone: "bg-gray-100 text-gray-500 dark:bg-gray-900 dark:text-gray-300", Icon: CalendarX },
  expired: { title: () => "No answer in time", text: (b) => `${b.venue.name} didn't confirm before the time. Sorry! You can book again.`, tone: "bg-gray-100 text-gray-500 dark:bg-gray-900 dark:text-gray-300", Icon: Clock },
};

export default function BookingStatus() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const token = params.get("t") ?? "";
  const justBooked = !!(useLocation().state as any)?.justBooked;
  const [b, setB] = useState<Booking | null>(null);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notify, setNotify] = useState<"idle" | "on" | "off" | "home">("idle");
  const timer = useRef<number>();

  const load = () =>
    guestApi.get(`/guests/bookings/${id}`, { params: { t: token } })
      .then((r) => { setB(r.data.data); saveBooking({ id, token }); })
      .catch((e) => setError(e?.response?.status === 404 ? "missing" : apiError(e)));

  useEffect(() => { load(); }, [id, token]);
  useEffect(() => {
    window.clearInterval(timer.current);
    if (b?.status === "pending") timer.current = window.setInterval(load, 20_000);
    return () => window.clearInterval(timer.current);
  }, [b?.status]);

  const cancel = async () => {
    setBusy(true);
    try { setB((await guestApi.post(`/guests/bookings/${id}/cancel`, { t: token })).data.data); }
    catch (e) { setError(apiError(e)); }
    finally { setBusy(false); setConfirm(false); }
  };
  const turnOn = async () => {
    if (needsHomeScreen()) { setNotify("home"); return; }
    const sub = await getDeviceSubscription();
    if (!sub) { setNotify("off"); return; }
    try { await guestApi.post(`/guests/bookings/${id}/device`, { t: token, subscription: sub }); setNotify("on"); }
    catch { setNotify("off"); }
  };

  if (error === "missing") {
    return <GuestShell tab="bookings"><GuestState title="We couldn't find this booking" text="The link may be incomplete. Open it again from where you saved it." action={<Link to="/me#bookings" className="mt-2 flex min-h-[44px] items-center rounded-full bg-action px-6 font-extrabold text-white">My bookings</Link>} /></GuestShell>;
  }
  if (!b) {
    return <GuestShell tab="bookings">{error ? <GuestState title="Couldn't load your booking" text={error} action={<button onClick={() => { setError(""); load(); }} className="mt-2 min-h-[44px] rounded-full bg-action px-6 font-extrabold text-white">Try again</button>} /> : <div className="mx-auto mt-16 h-40 max-w-md animate-pulse rounded-3xl bg-gray-100 dark:bg-gray-900" />}</GuestShell>;
  }

  const hero = HERO[b.status];
  const active = b.status === "pending" || b.status === "confirmed";
  const future = new Date(b.startsAt).getTime() > Date.now();

  return (
    <GuestShell tab="bookings">
      <div className="mx-auto max-w-md pt-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className={`flex h-16 w-16 items-center justify-center rounded-full ${hero.tone}`}><hero.Icon size={28} /></div>
          <h1 className="font-display text-[28px] font-extrabold tracking-[-0.02em]">{hero.title(b)}</h1>
          <p className="text-[15px] leading-relaxed text-gray-500 dark:text-gray-400" aria-live="polite">{hero.text(b)}</p>
        </div>

        <div className="mt-6 rounded-[22px] bg-gray-900 p-5 text-[color:var(--g-text)]">
          <Link to={`/v/${b.venue.slug}`} className="font-display text-xl font-extrabold hover:underline">{b.venue.name}</Link>
          {b.venue.location && <p className="text-sm text-[color:var(--g-muted)]">{b.venue.location}</p>}
          <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
            <div><p className="text-xs text-[color:var(--g-muted)]">Day</p><p className="font-extrabold">{dayLabel(b.date, true)}</p></div>
            <div><p className="text-xs text-[color:var(--g-muted)]">Time</p><p className="font-extrabold">{b.time}</p></div>
            <div><p className="text-xs text-[color:var(--g-muted)]">People</p><p className="flex items-center gap-1 font-extrabold"><Users size={14} />{b.partySize}</p></div>
          </div>
          {b.table && <p className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-sm font-bold">Your table: {b.table}</p>}
          {b.note && <p className="mt-3 text-sm text-[color:var(--g-muted)]">"{b.note}"</p>}
        </div>

        {active && future && (
          <ol className="mt-6 space-y-0 px-1">
            {[
              { done: true, title: "Request sent", text: justBooked ? "Just now" : "Sent" },
              { done: b.status === "confirmed", title: b.status === "confirmed" ? "Confirmed by the restaurant" : "Restaurant confirms", text: b.status === "confirmed" ? "All set" : "Usually within an hour" },
              { done: false, title: "Reminder", text: "2 hours before" },
            ].map((s, i, all) => (
              <li key={s.title} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full ${s.done ? "bg-green-500 text-white" : "border-[2.5px] border-[color:var(--g-hi)]"}`}>{s.done && <Check size={14} strokeWidth={3} />}</span>
                  {i < all.length - 1 && <span className="h-7 w-0.5 bg-gray-200 dark:bg-gray-800" />}
                </div>
                <div className="pb-2"><p className="font-bold leading-6">{s.title}</p><p className="text-xs text-gray-500 dark:text-gray-400">{s.text}</p></div>
              </li>
            ))}
          </ol>
        )}

        {active && future && pushSupported() && (
          <div className="mt-6 rounded-[20px] border-[1.5px] border-gray-200 p-4 dark:border-gray-800">
            {notify === "on" ? (
              <p className="flex items-center gap-2 text-sm font-bold text-green-600 dark:text-green-400"><Check size={16} /> We'll notify you on this phone.</p>
            ) : notify === "home" ? (
              <p className="text-sm leading-relaxed">On iPhone, notifications work once Skuzi is on your Home Screen: tap <b>Share</b>, then <b>Add to Home Screen</b>. Until then, keep this page: the answer shows up here.</p>
            ) : notify === "off" ? (
              <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">Notifications are off. No problem: come back to this page to see the answer.</p>
            ) : (
              <button onClick={turnOn} className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-gray-900 text-sm font-extrabold text-[color:var(--g-text)] dark:bg-action dark:text-action-ink">
                <Bell size={16} /> Notify me of the answer
              </button>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-col items-center gap-2">
          {(b.status === "declined" || b.status === "expired" || b.status === "cancelled") && (
            <Link to={`/v/${b.venue.slug}/book`} className="flex min-h-[50px] w-full items-center justify-center rounded-full bg-action font-extrabold text-white">Book again</Link>
          )}
          {active && future && (
            <button onClick={() => setConfirm(true)} disabled={busy} className="min-h-[44px] px-4 text-sm font-bold text-brand-600 hover:underline dark:text-[#F29C6F]">Cancel booking</button>
          )}
          <p className="text-center text-xs text-gray-500 dark:text-gray-400">This page is your booking. It's saved under Bookings on this phone.</p>
        </div>
      </div>
      {confirm && (
        <ConfirmDialog
          title="Cancel this booking?"
          message={`${b.venue.name}, ${dayLabel(b.date)} at ${b.time}. The restaurant will be told.`}
          confirmLabel="Cancel booking"
          cancelLabel="Keep it"
          danger
          loading={busy}
          onConfirm={cancel}
          onCancel={() => setConfirm(false)}
        />
      )}
    </GuestShell>
  );
}
