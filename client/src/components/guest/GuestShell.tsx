import { Link } from "react-router-dom";
import { Compass, CalendarDays, UserRound } from "lucide-react";
import { WavingHand } from "../Logo";

// The frame of guests' own Skuzi: logo on top, Explore · Bookings · Me at the
// bottom on phones (on the top bar from tablets up). `tone` "night" is the
// espresso look of Explore; "day" follows the guest's light/dark setting.
type Tab = "explore" | "bookings" | "me";

/** The Skuzi hand, motion lines included, at any size. */
export function Hand({ className = "h-7 w-7", color = "#D9A441" }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true"><WavingHand color={color} /></svg>
  );
}

const TABS: { id: Tab; label: string; href: string; Icon: typeof Compass }[] = [
  { id: "explore", label: "Explore", href: "/explore", Icon: Compass },
  { id: "bookings", label: "Bookings", href: "/me#bookings", Icon: CalendarDays },
  { id: "me", label: "Me", href: "/me", Icon: UserRound },
];

export function GuestLogo({ night = false }: { night?: boolean }) {
  return (
    <Link to="/explore" aria-label="Skuzi Explore" className="inline-flex items-center gap-1.5">
      <Hand />
      <span className={`font-display text-[22px] font-semibold tracking-[-0.04em] ${night ? "text-[#F4EDE3]" : "text-gray-900 dark:text-[#F4EDE3]"}`}>skuzi</span>
    </Link>
  );
}

export default function GuestShell({
  children,
  tab,
  tone = "day",
  header = true,
}: {
  children: React.ReactNode;
  tab?: Tab;
  tone?: "night" | "day";
  header?: boolean;
}) {
  const night = tone === "night";
  const bg = night ? "bg-[#1C1511] text-[#F4EDE3]" : "bg-[#FFFCF7] text-gray-900 dark:bg-[#1C1511] dark:text-[#F4EDE3]";
  return (
    <div className={`min-h-screen ${bg} font-sans [overflow-x:clip]`}>
      {header && (
        <header className="mx-auto flex max-w-5xl items-center justify-between px-5 pt-5 md:px-8">
          <GuestLogo night={night} />
          {tab && (
            <nav aria-label="Skuzi" className="hidden items-center gap-1 md:flex">
              {TABS.map(({ id, label, href }) => (
                <Link
                  key={id}
                  to={href}
                  aria-current={tab === id ? "page" : undefined}
                  className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                    tab === id
                      ? "bg-[#D9A441] text-[#2B201B]"
                      : night ? "text-[#D8CBBF] hover:bg-white/10" : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </nav>
          )}
        </header>
      )}
      <main className={`mx-auto max-w-5xl px-5 md:px-8 ${tab ? "pb-28 md:pb-12" : "pb-12"}`}>{children}</main>
      {tab && (
        <nav
          aria-label="Skuzi"
          className={`fixed inset-x-0 bottom-0 z-30 border-t md:hidden ${night ? "border-[#3A2D26] bg-[#1C1511]/95" : "border-gray-200 bg-[#FFFCF7]/95 dark:border-[#3A2D26] dark:bg-[#1C1511]/95"} backdrop-blur`}
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="mx-auto flex max-w-md justify-around px-3 pt-2 pb-2">
            {TABS.map(({ id, label, href, Icon }) => {
              const on = tab === id;
              return (
                <Link
                  key={id}
                  to={href}
                  aria-current={on ? "page" : undefined}
                  className={`flex min-h-[48px] min-w-[72px] flex-col items-center justify-center gap-0.5 text-[11.5px] font-bold ${
                    on ? "text-[#D9A441]" : night ? "text-[#D8CBBF]" : "text-gray-500 dark:text-gray-300"
                  }`}
                >
                  <Icon size={22} strokeWidth={on ? 2.4 : 2} />
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}

/** A friendly full-page state (loading, not found, offline). */
export function GuestState({ title, text, action }: { title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <Hand className="h-14 w-14" />
      <h1 className="font-display text-2xl font-extrabold tracking-tight">{title}</h1>
      {text && <p className="max-w-sm text-[15px] leading-relaxed text-gray-500 dark:text-gray-400">{text}</p>}
      {action}
    </div>
  );
}
