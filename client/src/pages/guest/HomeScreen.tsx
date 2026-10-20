import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Gift } from "lucide-react";
import GuestShell, { Hand, GuestState } from "../../components/guest/GuestShell";
import { guestApi, guestToken, setGuestToken, setGuestName, getDeviceSubscription, apiError, isStandalone } from "../../lib/guest";

// iPhone only lets a site notify once it's on the Home Screen, and keeps the
// icon's storage apart from Safari. So the icon is added from a page whose
// address carries a one-time code (/join/<code>): the first time it opens, it
// connects to the guest, then asks to allow notifications.

/** While this page is open, "Add to Home Screen" saves an icon that opens /join/<code>. */
function useJoinManifest(code: string) {
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const original = link?.href;
    const manifest = {
      name: "Skuzi", short_name: "Skuzi", display: "standalone",
      start_url: `${window.location.origin}/join/${code}`, scope: `${window.location.origin}/`,
      theme_color: "#1B1524", background_color: "#1B1524",
      icons: [
        { src: `${window.location.origin}/icon-192.png`, sizes: "192x192", type: "image/png" },
        { src: `${window.location.origin}/icon-512.png`, sizes: "512x512", type: "image/png" },
      ],
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" }));
    if (link) link.href = url;
    // Without a manifest, iPhone uses the page's own address, which carries the code too.
    window.history.replaceState(window.history.state, "", `/join/${code}?add=1`);
    return () => { if (link && original) link.href = original; URL.revokeObjectURL(url); };
  }, [code]);
}

export function HomeScreenGuide() {
  const { code = "" } = useParams();
  useJoinManifest(code);
  return (
    <GuestShell tone="day">
      <div className="mx-auto max-w-md pt-8">
        <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-brand-700 dark:text-[color:var(--g-hi)]">One last step on iPhone</p>
        <h1 className="mt-1 font-display text-[30px] font-extrabold leading-tight tracking-[-0.02em]">
          Put Skuzi on your <span className="text-brand-500">Home Screen</span>
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-gray-500 dark:text-gray-400">That's how your invites and offers reach you. Two taps, no download.</p>
        <ol className="mt-6 flex flex-col gap-2.5">
          {[
            { n: 1, text: <>Tap <b>Share</b> at the bottom of Safari</>, icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2B6CD8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12" /><path d="M8 7l4-4 4 4" /><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" /></svg> },
            { n: 2, text: <>Choose <b>Add to Home Screen</b></>, icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M12 8v8M8 12h8" /></svg> },
            { n: 3, text: <>Open Skuzi from your Home Screen and tap <b>Allow</b></>, icon: <span className="flex h-full w-full items-center justify-center rounded-xl bg-gray-900"><Hand className="h-7 w-7" /></span> },
          ].map((s) => (
            <li key={s.n} className="flex items-center gap-3.5 rounded-[18px] border-[1.5px] border-gray-200 bg-white px-4 py-3.5 dark:border-gray-800 dark:bg-gray-900">
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-gray-900 text-sm font-extrabold text-[color:var(--g-text)] dark:bg-action dark:text-action-ink">{s.n}</span>
              <span className="flex-1 text-[15px] leading-snug">{s.text}</span>
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-gray-100 dark:bg-white/10">{s.icon}</span>
            </li>
          ))}
        </ol>
        <div className="mt-5 flex items-center gap-3 rounded-[20px] bg-gray-900 p-4 text-[color:var(--g-text)]">
          <Gift size={22} className="flex-none text-[color:var(--g-hi)]" />
          <p className="text-sm leading-snug">You'll also find places to go tonight and book a table, right from the icon.</p>
        </div>
        <Link to="/explore" className="mt-6 flex min-h-[48px] items-center justify-center text-sm font-bold text-gray-500 dark:text-gray-400">Maybe later</Link>
      </div>
    </GuestShell>
  );
}

export function Join() {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<"connecting" | "ready" | "done" | "error">("connecting");
  const [error, setError] = useState("");
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    // Opened in Safari right after "Add to Home Screen" was offered: show the steps.
    if (!isStandalone() && new URLSearchParams(window.location.search).get("add")) { navigate(`/home-screen/${code}`, { replace: true }); return; }
    // The icon always opens this address: once connected, go straight to Explore.
    if (guestToken()) { navigate("/explore", { replace: true }); return; }
    guestApi.post("/guests/claim", { code })
      .then((r) => { setGuestToken(r.data.data.guestToken); setGuestName(r.data.data.name); setName(r.data.data.name); setState("ready"); })
      .catch((e) => { setError(apiError(e)); setState("error"); });
  }, [code]);

  const allow = async () => {
    const sub = await getDeviceSubscription();
    if (sub) await guestApi.post("/guests/me/devices", { subscription: sub }).catch(() => {});
    setState("done");
    setTimeout(() => navigate("/explore", { replace: true }), 900);
  };

  if (state === "error") {
    return <GuestShell tone="night"><GuestState title="Almost there" text={`${error} You can still explore Skuzi.`} action={<Link to="/explore" className="mt-2 flex min-h-[44px] items-center rounded-full bg-action px-6 font-extrabold text-action-ink">Explore Skuzi</Link>} /></GuestShell>;
  }
  return (
    <GuestShell tone="night" header={false}>
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
        <Hand className="h-16 w-16" />
        <h1 className="font-display text-[30px] font-extrabold leading-tight tracking-[-0.02em]">
          {state === "done" ? "You're all set!" : <>Welcome{name ? `, ${name}` : ""} to <span className="text-[color:var(--g-hi)]">Skuzi</span></>}
        </h1>
        <p className="max-w-xs text-[15px] text-[color:var(--g-muted)]">{state === "done" ? "Your invites will arrive here." : "One tap so your invites and offers can reach you."}</p>
        {state === "ready" && (
          <button onClick={allow} className="mt-2 min-h-[52px] rounded-full bg-action px-8 text-base font-extrabold text-action-ink">Turn on invites</button>
        )}
        {state === "connecting" && <p className="text-sm text-[color:var(--g-muted)]" aria-live="polite">Connecting…</p>}
      </div>
    </GuestShell>
  );
}
