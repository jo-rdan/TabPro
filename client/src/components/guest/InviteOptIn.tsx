import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, Compass } from "lucide-react";
import { Hand } from "./GuestShell";
import { guestApi, setGuestToken, setGuestName, needsHomeScreen, pushSupported, getDeviceSubscription, apiError } from "../../lib/guest";

// After paying, the happiest moment: "Want invites to Kigali's best nights?"
// Yes → Android/computer: allow notifications right here. iPhone: a short guide
// to put Skuzi on the Home Screen (the only way iPhone allows them).
const DONE_KEY = "skuzi_invites_yes";
const said = () => { try { return localStorage.getItem(DONE_KEY) === "1"; } catch { return false; } };

export default function InviteOptIn({ tabId }: { tabId: string }) {
  const navigate = useNavigate();
  const [state, setState] = useState<"ask" | "busy" | "done" | "hidden">(said() ? "done" : "ask");
  const [note, setNote] = useState("");

  const yes = async () => {
    setState("busy");
    setNote("");
    try {
      const iphone = needsHomeScreen();
      const sub = !iphone && pushSupported() ? await getDeviceSubscription() : null;
      const r = await guestApi.post("/guests/invites", { tabId, optIn: true, subscription: sub });
      setGuestToken(r.data.data.guestToken);
      setGuestName(r.data.data.name);
      try { localStorage.setItem(DONE_KEY, "1"); } catch { /* ignore */ }
      if (iphone) {
        const code = (await guestApi.post("/guests/me/link-code")).data.data.code;
        navigate(`/home-screen/${code}`);
        return;
      }
      if (!sub && pushSupported()) setNote("Notifications are blocked on this phone. You can allow them later in your browser settings.");
      setState("done");
    } catch (e) {
      setNote(apiError(e));
      setState("ask");
    }
  };

  if (state === "hidden") return null;
  if (state === "done") {
    return (
      <div className="w-full rounded-[22px] bg-[#231A2C] p-5 text-left text-[#F4F0F7]">
        <p className="flex items-center gap-2 font-bold"><Check size={18} className="text-[#86A27B]" /> You're on the invite list</p>
        {note && <p className="mt-1 text-sm text-[#D3CADC]">{note}</p>}
        <Link to="/explore" className="mt-3 flex min-h-[46px] items-center justify-center gap-2 rounded-full bg-[#F2B33A] text-sm font-extrabold text-[#231A2C]">
          <Compass size={16} /> See what's on tonight
        </Link>
      </div>
    );
  }
  return (
    <div className="w-full rounded-[24px] bg-[#231A2C] p-5 text-left text-[#F4F0F7]">
      <Hand className="h-10 w-10" />
      <p className="mt-2 font-display text-[24px] font-extrabold leading-tight tracking-[-0.02em]">
        Want invites to Kigali's <span className="text-[#F2B33A]">best nights?</span>
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-[#D3CADC]">Karaoke, live music and offers at places you'll love. Two messages a week at most. Stop any time.</p>
      {note && <p role="alert" className="mt-2 text-sm text-[#FCE3D3]">{note}</p>}
      <button onClick={yes} disabled={state === "busy"} className="mt-4 min-h-[52px] w-full rounded-full bg-[#F2B33A] text-base font-extrabold text-[#231A2C] disabled:opacity-60">
        {state === "busy" ? "One moment…" : "Yes, invite me"}
      </button>
      <button onClick={() => setState("hidden")} className="mt-1 min-h-[44px] w-full rounded-full text-sm font-bold text-[#D3CADC]">Not now</button>
      <p className="mt-1 text-center text-xs text-[#9C90A8]">Your number is never shared with restaurants.</p>
    </div>
  );
}
