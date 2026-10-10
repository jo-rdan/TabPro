import { useState, useRef, useEffect } from "react";
import { Bell, BellRing, Receipt, ShoppingBag, PhoneOff, DoorClosed } from "lucide-react";

export type NotificationKind =
  | "new_order"
  | "nudge"
  | "bill_requested"
  | "customer_away"
  | "tab_closed";

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  message: string;
  timestamp: string;
  read: boolean;
}

const ICONS: Record<NotificationKind, typeof Bell> = {
  new_order: ShoppingBag,
  nudge: BellRing,
  bill_requested: Receipt,
  customer_away: PhoneOff,
  tab_closed: DoorClosed,
};

const ICON_COLORS: Record<NotificationKind, string> = {
  new_order: "text-brand-500 bg-brand-500/10",
  nudge: "text-amber-600 bg-amber-100 dark:bg-amber-900/40",
  bill_requested: "text-brand-500 bg-brand-500/10",
  customer_away: "text-gray-500 bg-gray-100 dark:bg-gray-800",
  tab_closed: "text-gray-500 bg-gray-100 dark:bg-gray-800",
};

function timeAgo(dateStr: string) {
  const diff = Math.max(
    0,
    Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000),
  );
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

interface Props {
  notifications: NotificationItem[];
  onMarkAllRead: () => void;
}

export default function NotificationBell({ notifications, onMarkAllRead }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next && unreadCount > 0) onMarkAllRead();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleToggle}
        className="relative p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        title="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        // Phones: a full-width sheet under the header, never off-screen.
        // Larger screens: a dropdown under the bell.
        <div className="fixed left-3 right-3 top-24 sm:absolute sm:left-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-80 bg-white dark:bg-[#2B201B] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl z-40 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Notifications
            </h3>
          </div>
          <div className="max-h-[60vh] sm:max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-8">
                No notifications yet.
              </p>
            ) : (
              notifications
                .slice()
                .reverse()
                .map((n) => {
                  const Icon = ICONS[n.kind];
                  return (
                    <div
                      key={n.id}
                      className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 dark:border-gray-800/60 last:border-0 ${
                        n.read ? "" : "bg-brand-50/50 dark:bg-brand-900/10"
                      }`}
                    >
                      <div
                        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${ICON_COLORS[n.kind]}`}
                      >
                        <Icon size={14} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-gray-800 dark:text-gray-200 leading-snug">
                          {n.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {timeAgo(n.timestamp)}
                        </p>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
