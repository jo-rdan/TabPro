import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, BellOff, CalendarDays, ChevronRight, Lock, Smartphone, Wallet } from "lucide-react";
import GuestShell from "../../components/guest/GuestShell";
import {
  guestApi, guestToken, guestName, apiError,
  pushSupported, needsHomeScreen, getDeviceSubscription, rwf,
} from "../../lib/guest";

// "Me": Skuzi money, invites on/off and this phone's notifications. Bookings have their own tab.
type WalletLine = { kind: "got" | "used"; amountRwf: number; at: string; from: string | null; venue: string | null };
type Guest = { name: string | null; invitesOptIn: boolean; hasDevice: boolean; wallet?: { balanceRwf: number; history: WalletLine[] } };

export default function Me() {
  const navigate = useNavigate();
  const hasToken = !!guestToken();
  const [guest, setGuest] = useState<Guest | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (hasToken) guestApi.get("/guests/me").then((r) => setGuest(r.data.data)).catch(() => setGuest(null));
  }, []);

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

  const name = guest?.name ?? guestName();

  return (
    <GuestShell tab="me">
      <div className="mx-auto max-w-xl pt-6">
        <h1 className="font-display text-[30px] font-extrabold tracking-[-0.02em]">{name ? `Hi, ${name}` : "Your Skuzi"}</h1>

        {guest?.wallet && guest.wallet.history.length > 0 && (
          <section className="mt-5 rounded-[22px] border-[1.5px] border-[#FFE08A] bg-[#FFF7E0] p-5 text-[#231A2C] dark:border-[#4A3A5C] dark:bg-[#2A2035] dark:text-[#F4F0F7]" aria-labelledby="money">
            <h2 id="money" className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-[0.08em] text-brand-700 dark:text-[#F2B33A]"><Wallet size={16} /> Your Skuzi money</h2>
            <p className="mt-2 font-display text-[44px] font-extrabold leading-none tracking-[-0.02em] tabular-nums">{rwf(guest.wallet.balanceRwf)}</p>
            <p className="mt-2 text-sm text-[#665A72] dark:text-[#D3CADC]">
              {guest.wallet.balanceRwf > 0
                ? "Comes off your next bill when you pay with Skuzi, at any Skuzi restaurant."
                : "All used. Thanks for paying with Skuzi!"}
            </p>
            <ul className="mt-4 divide-y divide-[#FFE08A] border-t border-[#FFE08A] dark:divide-[#4A3A5C] dark:border-[#4A3A5C]">
              {guest.wallet.history.slice(0, 6).map((l, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-bold">{l.kind === "got" ? (l.from ? `Welcome money from ${l.from}` : "Welcome money") : "Used on your bill"}</span>
                    <span className="block truncate text-xs text-[#665A72] dark:text-[#D3CADC]">{l.venue ?? "Skuzi"} · {new Date(l.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                  </span>
                  <span className={`flex-none font-extrabold tabular-nums ${l.kind === "got" ? "text-green-700 dark:text-green-400" : ""}`}>{l.kind === "got" ? "+" : "−"}{l.amountRwf.toLocaleString("en-US")}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-5 rounded-[22px] bg-[#231A2C] p-5 text-[#F4F0F7]" aria-labelledby="inv">
          <h2 id="inv" className="font-display text-xl font-extrabold">Invites to Kigali's <span className="text-[#F2B33A]">best nights</span></h2>
          {hasToken && guest ? (
            <>
              <p className="mt-1 text-sm text-[#D3CADC]">Karaoke, live music and offers. Two messages a week at most.</p>
              <button onClick={toggleInvites} disabled={busy} role="switch" aria-checked={guest.invitesOptIn}
                className="mt-4 flex min-h-[48px] w-full items-center justify-between rounded-2xl bg-white/10 px-4 font-bold">
                <span className="flex items-center gap-2">{guest.invitesOptIn ? <Bell size={18} /> : <BellOff size={18} />}{guest.invitesOptIn ? "Invites are on" : "Invites are off"}</span>
                <span className={`relative h-7 w-12 rounded-full transition ${guest.invitesOptIn ? "bg-[#F2B33A]" : "bg-white/25"}`}>
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
            <p className="mt-2 text-sm leading-relaxed text-[#D3CADC]">
              Next time you pay with Skuzi at a restaurant, tap <b className="text-[#F4F0F7]">"Yes, invite me"</b>. You'll hear about the best nights first.
            </p>
          )}
          {msg && <p role="alert" className="mt-3 text-sm text-[#FCE3D3]">{msg}</p>}
        </section>

        <Link to="/my-bookings" className="mt-8 flex min-h-[52px] items-center justify-between rounded-2xl border-[1.5px] border-gray-200 bg-white px-4 font-bold hover:border-gray-300 dark:border-[#33293F] dark:bg-[#231A2C]">
          <span className="flex items-center gap-2"><CalendarDays size={18} /> Your bookings</span>
          <ChevronRight size={18} />
        </Link>

        <p className="mt-10 flex items-center justify-center gap-1.5 text-center text-xs text-gray-500 dark:text-gray-400"><Lock size={12} /> Your number is never shared with restaurants.</p>
      </div>
    </GuestShell>
  );
}
