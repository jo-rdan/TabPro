import { useState } from "react";
import { BellOff, X } from "lucide-react";
import { usePushNotifications } from "../hooks/usePushNotifications";

// Explains why alerts can't arrive on this device, when we can tell:
// iPhones need the site on the Home Screen, and a "Block" needs undoing.
export default function NotificationNotice({ className = "" }: { className?: string }) {
  const { permission, needsHomeScreen } = usePushNotifications();
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  let message = "";
  if (needsHomeScreen) {
    message =
      'On iPhone, alerts only work from the Home Screen: tap Share, then "Add to Home Screen", and open Skuzi from there.';
  } else if (permission === "denied") {
    message =
      "Notifications are blocked on this device, so you won't hear about new orders. Allow notifications for this site in your browser settings.";
  }
  if (!message) return null;

  return (
    <div className={className}>
    <div className="border rounded-xl px-4 py-3 mb-5 flex items-start justify-between gap-3 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
      <div className="flex items-start gap-2">
        <BellOff size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs font-medium text-amber-800 dark:text-amber-200">{message}</p>
      </div>
      <button onClick={() => setHidden(true)} aria-label="Dismiss" className="text-amber-500 hover:text-amber-700">
        <X size={14} />
      </button>
    </div>
    </div>
  );
}
