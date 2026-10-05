import { useEffect, useState } from "react";
import { BellRing, Check, X } from "lucide-react";
import { usePushNotifications } from "../hooks/usePushNotifications";

const storageKey = (tabId: string) => `tabpro_guest_alerts_${tabId}`;
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

// After a guest's first order: "Put your phone away, we'll tell you when it's
// ready." Pops up at the bottom so it can't be missed. If this phone already
// allows Skuzi notifications, it signs up silently. Hidden where it can't
// work (iPhone browser tab, notifications blocked).
export default function GuestAlerts({ tabId }: { tabId: string }) {
  const { isSupported, permission, subscribeToTab } = usePushNotifications();
  const [state, setState] = useState<"idle" | "busy" | "on" | "confirmed" | "hidden" | "failed">(() => {
    const saved = read(storageKey(tabId));
    return saved === "on" ? "confirmed" : saved === "hidden" ? "hidden" : "idle";
  });

  const turnOn = async () => {
    setState("busy");
    const ok = await subscribeToTab(tabId);
    if (ok) write(storageKey(tabId), "on");
    setState(ok ? "on" : "failed");
  };

  useEffect(() => {
    if (state === "idle" && isSupported && permission === "granted") turnOn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "You're set" shows for a few seconds, then gets out of the way.
  useEffect(() => {
    if (state !== "on") return;
    const t = setTimeout(() => setState("confirmed"), 4000);
    return () => clearTimeout(t);
  }, [state]);

  if (!isSupported || permission === "denied" || state === "hidden" || state === "confirmed") return null;

  return (
    <div className="fixed inset-x-0 bottom-[8.5rem] md:bottom-6 z-30 px-4 flex justify-center pointer-events-none">
      <div className="pointer-events-auto w-full max-w-md flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-2xl bg-white dark:bg-[#2B201B] border-gray-200 dark:border-gray-800">
        <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0">
          {state === "on" ? <Check size={18} className="text-brand-500" /> : <BellRing size={18} className="text-brand-500" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 dark:text-white">
            {state === "on" ? "You're set" : "Put your phone away"}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {state === "on"
              ? "We'll tell you when your order is being prepared and served."
              : state === "failed"
                ? "That didn't work. Allow notifications, then try again."
                : "Get a notification when your order is ready."}
          </p>
        </div>
        {state !== "on" && (
          <>
            <button
              onClick={turnOn}
              disabled={state === "busy"}
              className="px-3.5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-xs font-bold flex-shrink-0"
            >
              {state === "busy" ? "…" : "Notify me"}
            </button>
            <button
              onClick={() => { write(storageKey(tabId), "hidden"); setState("hidden"); }}
              aria-label="No thanks"
              className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0"
            >
              <X size={15} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
