import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import {
  LayoutDashboard,
  QrCode,
  UtensilsCrossed,
  Users,
  ScrollText,
  Star,
  LogOut,
  Sun,
  Moon,
  BarChart2,
  Clock,
  Menu as MenuIcon,
  X,
} from "lucide-react";
import Logo from "./Logo";
import { useAuthStore } from "../lib/auth";
import { useThemeStore } from "../lib/theme";

interface LayoutProps {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Tables", href: "/tables", icon: QrCode },
  { label: "Menu", href: "/menu", icon: UtensilsCrossed },
  { label: "Staff", href: "/staff", icon: Users },
  { label: "Activity", href: "/activity", icon: ScrollText },
  { label: "Ratings", href: "/ratings", icon: Star },
  // { label: "Campaigns", href: "/campaigns", icon: Megaphone },
  { label: "Busy Hours", href: "/busy-hours", icon: BarChart2 },
  { label: "Shifts", href: "/shifts", icon: Clock },
];

// Bottom nav shows the 3 most-used items pinned, then a "More" button
// that opens a sheet with everything else — including locked Pro/Elite
// items, so they stay visible as an upsell instead of disappearing.
const PINNED_NAV = NAV_ITEMS.slice(0, 3);
const MORE_NAV = NAV_ITEMS.slice(3);

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { owner, venues, logout } = useAuthStore();
  const { theme, toggle } = useThemeStore();
  const venue = venues[0];

  const isActive = (href: string) => location.pathname === href;
  const [moreOpen, setMoreOpen] = useState(false);
  const isMoreActive = MORE_NAV.some((item) => isActive(item.href));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0D1117] text-gray-900 dark:text-gray-100">
      {/* ── Side nav (desktop md+) ─────────────────────────────────────────── */}
      <aside
        className="
        hidden md:flex flex-col
        fixed top-0 left-0 h-full w-60
        bg-white dark:bg-[#161B22]
        border-r border-gray-200 dark:border-gray-800
        z-20
      "
      >
        {/* Logo */}
        <div className="px-5 py-5 flex items-center gap-3 border-b border-gray-100 dark:border-gray-800">
          <Logo size={34} />
          <div>
            <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
              TabPro
            </p>
            {venue && (
              <p className="text-xs text-gray-400 truncate max-w-[110px]">
                {venue.name}
              </p>
            )}
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => (
            <Link
              key={href}
              to={href}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors
                ${
                  isActive(href)
                    ? "bg-brand-500 text-white"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
                }
              `}
            >
              <Icon size={17} />
              <span className="flex-1">{label}</span>
            </Link>
          ))}
        </nav>

        {/* Bottom actions */}
        <div className="px-3 py-4 border-t border-gray-100 dark:border-gray-800 space-y-1">
          {/* Owner info */}
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <div className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {owner?.name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
              {owner?.name}
            </p>
          </div>

          {/* Theme toggle */}
          <button
            onClick={toggle}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>

          {/* Logout */}
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Mobile top bar ─────────────────────────────────────────────────── */}
      <header
        className="
        md:hidden fixed top-0 left-0 right-0 z-20
        bg-white dark:bg-[#161B22]
        border-b border-gray-200 dark:border-gray-800
        h-14 px-4 flex items-center justify-between
      "
      >
        <div className="flex items-center gap-2.5">
          <Logo size={30} />
          <span className="text-sm font-bold text-gray-900 dark:text-white">
            TabPro
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggle}
            className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            onClick={logout}
            className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <main
        className="
        md:ml-60
        pt-14 md:pt-0
        pb-20 md:pb-0
        min-h-screen
      "
      >
        <div className="max-w-5xl mx-auto px-4 py-6 md:py-8">{children}</div>
      </main>

      {/* ── Bottom nav (mobile) ────────────────────────────────────────────── */}
      <nav
        className="
        md:hidden fixed bottom-0 left-0 right-0 z-20
        bg-white dark:bg-[#161B22]
        border-t border-gray-200 dark:border-gray-800
        h-16 flex items-stretch
      "
      >
        {PINNED_NAV.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            to={href}
            className={`
              flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors
              ${
                isActive(href)
                  ? "text-brand-500"
                  : "text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }
            `}
          >
            <Icon size={20} />
            <span className="text-[10px]">{label}</span>
            {isActive(href) && (
              <span className="absolute bottom-0 w-6 h-0.5 bg-brand-500 rounded-full" />
            )}
          </Link>
        ))}

        {/* More button — reveals Activity + locked Pro/Elite items as a sales surface */}
        <button
          onClick={() => setMoreOpen(true)}
          className={`
            relative flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors
            ${
              isMoreActive
                ? "text-brand-500"
                : "text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }
          `}
        >
          <div className="relative">
            <MenuIcon size={20} />
          </div>
          <span className="text-[10px]">More</span>
          {isMoreActive && (
            <span className="absolute bottom-0 w-6 h-0.5 bg-brand-500 rounded-full" />
          )}
        </button>
      </nav>

      {/* ── More sheet (mobile) ────────────────────────────────────────────── */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-30">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-[#161B22] rounded-t-3xl border-t border-gray-200 dark:border-gray-800 pb-8 pt-3 px-4 max-h-[75vh] overflow-y-auto">
            {/* Drag handle */}
            <div className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-4" />

            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                More
              </h3>
              <button
                onClick={() => setMoreOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {MORE_NAV.map(({ label, href, icon: Icon }) => {
                return (
                  <Link
                    key={href}
                    to={href}
                    onClick={() => setMoreOpen(false)}
                    className={`
                      relative flex flex-col items-center justify-center gap-2 rounded-2xl px-3 py-4 text-center transition-colors
                      ${
                        isActive(href)
                          ? "bg-brand-50 dark:bg-brand-900/20 border border-brand-200/70 dark:border-brand-700/40"
                          : "bg-gray-50 dark:bg-gray-800/40 border border-transparent"
                      }
                    `}
                  >
                    <Icon
                      size={20}
                      className={isActive(href) ? "text-brand-500" : "text-gray-500 dark:text-gray-400"}
                    />
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      {label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
