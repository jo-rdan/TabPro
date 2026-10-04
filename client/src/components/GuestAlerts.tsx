import { useState } from "react";
import { BellRing, Check, X } from "lucide-react";
import { usePushNotifications } from "../hooks/usePushNotifications";

const storageKey = (tabId: string) => `tabpro_guest_alerts_${tabId}`;
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

// After a guest orders: "Tell me when it's ready", so they can put their
// phone away. Hidden where it can't work (iPhone browser tab, blocked).
export default function GuestAlerts({ tabId }: { tabId: string }) {
  const { isSupported, permission, subscribeToTab } = usePushNotifications();
  const [state, setState] = useState<"idle" | "busy" | "on" | "hidden" | "failed">(() =>
    read(storageKey(tabId)) === "on" ? "on" : read(storageKey(tabId)) === "hidden" ? "hidden" : "idle",
  );

  if (!isSupported || permission === "denied" || state === "hidden") return null;

  if (state === "on") {
    return (
      <div className="flex items-center gap-2 mb-4 px-4 py-2.5 rounded-2xl bg-brand-50 dark:bg-brand-900/20 text-xs font-semibold text-brand-700 dark:text-brand-300">
        <Check size={14} /> We'll notify you when your order is being prepared and served.
      </div>
    );
  }

  const turnOn = async () => {
    setState("busy");
    const ok = await subscribeToTab(tabId);
    if (ok) write(storageKey(tabId), "on");
    setState(ok ? "on" : "failed");
  };

  return (
    <div className="flex items-center gap-3 mb-4 px-4 py-3 rounded-2xl border bg-white dark:bg-[#161B22] border-gray-200 dark:border-gray-800">
      <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0">
        <BellRing size={17} className="text-brand-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900 dark:text-white">Put your phone away</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {state === "failed" ? "That didn't work. Check notifications are allowed, then try again." : "We'll tell you when your order is ready."}
        </p>
      </div>
      <button
        onClick={turnOn}
        disabled={state === "busy"}
        className="px-3 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-xs font-bold flex-shrink-0"
      >
        {state === "busy" ? "…" : "Notify me"}
      </button>
      <button
        onClick={() => { write(storageKey(tabId), "hidden"); setState("hidden"); }}
        aria-label="No thanks"
        className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  );
}
