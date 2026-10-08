import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, BellOff, CalendarDays, ChevronRight, Lock, Smartphone } from "lucide-react";
import GuestShell from "../../components/guest/GuestShell";
import {
  guestApi, guestToken, guestName, savedBookings, apiError, dayLabel,
  pushSupported, needsHomeScreen, getDeviceSubscription,
} from "../../lib/guest";

// "Me": invites on/off, this phone's notifications, and bookings saved here.
type Guest = { name: string | null; invitesOptIn: boolean; hasDevice: boolean };
type B = { id: string; token: string; status: string; date: string; time: string; partySize: number; startsAt: string; venue: { name: string; slug: string } };

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Waiting", cls: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300" },
  confirmed: { label: "Confirmed", cls: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300" },
  seated: { label: "Arrived", cls: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300" },
  declined: { label: "Declined", cls: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300" },
  cancelled: { label: "Cancelled", cls: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300" },
  expired: { label: "No answer", cls: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300" },
};

export default function Me() {
  const navigate = useNavigate();
  const hasToken = !!guestToken();
  const [guest, setGuest] = useState<Guest | null>(null);
  const [bookings, setBookings] = useState<B[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (hasToken) guestApi.get("/guests/me").then((r) => setGuest(r.data.data)).catch(() => setGuest(null));
    const saved = savedBookings();
    Promise.all(saved.map((s) => guestApi.get(`/guests/bookings/${s.id}`, { params: { t: s.token } }).then((r) => r.data.data).catch(() => null)))
      .then((list) => setBookings((list.filter(Boolean) as B[]).sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())));
  }, []);
  useEffect(() => { if (window.location.hash === "#bookings") document.getElementById("bookings")?.scrollIntoView(); }, [bookings]);

  const toggleInvites = async () => {
    if (!guest) return;
    setBusy(true); setMsg("");
    try { setGuest((await guestApi.post("/guests/me/invites", { optIn: !guest.invitesOptIn })).data.data); }
    catch (e) { setMsg(apiError(e)); }
    finally { setBusy(false); }
  };
  const turnOnDevice = async () => {
    setBusy(true); setMsg("");
    try {
      if (needsHomeScreen()) {
        const code = (await guestApi.post("/guests/me/link-code")).data.data.code;
        navigate(`/home-screen/${code}`);
        return;
      }
      const sub = await getDeviceSubscription();
      if (!sub) { setMsg("Notifications are blocked. Allow them for this site in your browser settings."); return; }
      setGuest((await guestApi.post("/guests/me/devices", { subscription: sub })).data.data);
    } catch (e) { setMsg(apiError(e)); }
    finally { setBusy(false); }
  };

  const now = Date.now();
  const upcoming = (bookings ?? []).filter((b) => new Date(b.startsAt).getTime() > now - 3 * 3600e3 && ["pending", "confirmed", "seated"].includes(b.status));
  const past = (bookings ?? []).filter((b) => !upcoming.includes(b));
  const name = guest?.name ?? guestName();

  return (
    <GuestShell tab="me">
      <div className="mx-auto max-w-xl pt-6">
        <h1 className="font-display text-[30px] font-extrabold tracking-[-0.02em]">{name ? `Hi, ${name}` : "Your Skuzi"}</h1>

        <section className="mt-5 rounded-[22px] bg-[#2B201B] p-5 text-[#F4EDE3]" aria-labelledby="inv">
          <h2 id="inv" className="font-display text-xl font-extrabold">Invites to Kigali's <span className="text-[#D9A441]">best nights</span></h2>
          {hasToken && guest ? (
            <>
              <p className="mt-1 text-sm text-[#D8CBBF]">Karaoke, live music and offers. Two messages a week at most.</p>
              <button onClick={toggleInvites} disabled={busy} role="switch" aria-checked={guest.invitesOptIn}
                className="mt-4 flex min-h-[48px] w-full items-center justify-between rounded-2xl bg-white/10 px-4 font-bold">
                <span className="flex items-center gap-2">{guest.invitesOptIn ? <Bell size={18} /> : <BellOff size={18} />}{guest.invitesOptIn ? "Invites are on" : "Invites are off"}</span>
                <span className={`relative h-7 w-12 rounded-full transition ${guest.invitesOptIn ? "bg-[#D9A441]" : "bg-white/25"}`}>
                  <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${guest.invitesOptIn ? "left-6" : "left-1"}`} />
                </span>
              </button>
              {guest.invitesOptIn && pushSupported() && (
                <button onClick={turnOnDevice} disabled={busy} className="mt-2 flex min-h-[48px] w-full items-center justify-between rounded-2xl bg-white/10 px-4 text-left text-sm font-bold">
                  <span className="flex items-center gap-2"><Smartphone size={18} />{needsHomeScreen() ? "Add Skuzi to your Home Screen" : guest.hasDevice ? "Notifications on this phone: check" : "Turn on notifications on this phone"}</span>
                  <ChevronRight size={18} />
                </button>
              )}
            </>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-[#D8CBBF]">
              Next time you pay with Skuzi at a restaurant, tap <b className="text-[#F4EDE3]">"Yes, invite me"</b>. You'll hear about the best nights first.
            </p>
          )}
          {msg && <p role="alert" className="mt-3 text-sm text-[#F5E1D7]">{msg}</p>}
        </section>

        <section id="bookings" className="mt-8 scroll-mt-6" aria-labelledby="bk">
          <h2 id="bk" className="flex items-center gap-2 font-display text-xl font-extrabold"><CalendarDays size={20} /> Bookings</h2>
          {bookings === null ? (
            <div className="mt-3 h-20 animate-pulse rounded-2xl bg-gray-100 dark:bg-[#2B201B]" />
          ) : bookings.length === 0 ? (
            <div className="mt-3 rounded-2xl border-[1.5px] border-dashed border-gray-200 p-5 text-center dark:border-[#3A2D26]">
              <p className="font-bold">No bookings on this phone yet</p>
              <Link to="/explore" className="mt-3 inline-flex min-h-[44px] items-center rounded-full bg-brand-500 px-5 text-sm font-extrabold text-white">Find a place on Explore</Link>
            </div>
          ) : (
            <>
              {[...upcoming, ...past].map((b) => (
                <Link key={b.id} to={`/booking/${b.id}?t=${encodeURIComponent(b.token)}`}
                  className={`mt-2 flex items-center gap-3 rounded-2xl border-[1.5px] border-gray-200 bg-white px-4 py-3 hover:border-gray-300 dark:border-[#3A2D26] dark:bg-[#2B201B] ${past.includes(b) ? "opacity-70" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{b.venue.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{dayLabel(b.date, true)} · {b.time} · {b.partySize} {b.partySize === 1 ? "person" : "people"}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${STATUS[b.status]?.cls}`}>{STATUS[b.status]?.label}</span>
                </Link>
              ))}
            </>
          )}
        </section>

        <p className="mt-10 flex items-center justify-center gap-1.5 text-center text-xs text-gray-500 dark:text-gray-400"><Lock size={12} /> Your number is never shared with restaurants.</p>
      </div>
    </GuestShell>
  );
}
