import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import {
  LayoutDashboard,
  QrCode,
  UtensilsCrossed,
  Users,
  History,
  LogOut,
  Menu as MenuIcon,
  X,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { WavingHand } from "./Logo";
import ThemeSwitch, { ThemeCycleButton } from "./ThemeSwitch";
import VenueLogo from "./VenueLogo";
import LogoUploader from "./LogoUploader";
import api from "../lib/api";
import Wordmark from "./Wordmark";
import { useAuthStore } from "../lib/auth";
import { useThemeStore } from "../lib/theme";

interface LayoutProps {
  children: React.ReactNode;
  /** Use more of the screen (the dashboard fits everything on one screen). */
  wide?: boolean;
}

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Tables", href: "/tables", icon: QrCode },
  { label: "Menu", href: "/menu", icon: UtensilsCrossed },
  { label: "Staff", href: "/staff", icon: Users },
  { label: "History", href: "/history", icon: History },
  // Hidden for launch to keep Skuzi simple to pitch and learn; the pages
  // still exist and can come back as paid extras: /ratings, /busy-hours,
  // /shifts (the staff sticker and venue PIN moved to Staff).
];

// Bottom nav shows the 3 most-used items pinned, then a "More" button
// that opens a sheet with everything else — including locked Pro/Elite
// items, so they stay visible as an upsell instead of disappearing.
const PINNED_NAV = NAV_ITEMS.slice(0, 3);
const MORE_NAV = NAV_ITEMS.slice(3);

export default function Layout({ children, wide = false }: LayoutProps) {
  const location = useLocation();
  const { owner, venues, logout, fetchMe } = useAuthStore();
  const venue = venues[0];
  const [venueSheet, setVenueSheet] = useState(false);
  const saveLogo = async (url: string) => {
    if (!venue) return;
    await api.patch(`/venues/${venue.id}/logo`, { logoUrl: url });
    await fetchMe();
  };
  const { theme } = useThemeStore();

  const isActive = (href: string) => location.pathname === href;
  const [moreOpen, setMoreOpen] = useState(false);
  // Desktop sidebar can shrink to icons; remembered on this device only.
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("skuzi_nav_collapsed") === "1"; } catch { return false; }
  });
  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try { localStorage.setItem("skuzi_nav_collapsed", c ? "0" : "1"); } catch { /* private mode */ }
      return !c;
    });
  };
  const isMoreActive = MORE_NAV.some((item) => isActive(item.href));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#1C1511] text-gray-900 dark:text-gray-100">
      {/* ── Side nav (desktop md+) ─────────────────────────────────────────── */}
      <aside
        className={`
        hidden md:flex flex-col
        fixed top-0 left-0 h-full
        bg-white dark:bg-[#2B201B]
        border-r border-gray-200 dark:border-gray-800
        z-20 transition-[width] duration-300
        ${collapsed ? "w-[76px]" : "w-60"}
      `}
      >
        {/* Logo: the hand waves once a minute, open or collapsed */}
        <div className={`pt-6 pb-5 ${collapsed ? "px-0 flex justify-center" : "px-5"}`}>
          {collapsed ? (
            <svg width="34" height="34" viewBox="8 4 90 92" className="nav-wave" role="img" aria-label="Skuzi">
              <WavingHand color={theme === "dark" ? "#D9A441" : "#A64B31"} strokeWidth={6.5} />
            </svg>
          ) : (
            <>
              <Wordmark size={24} on="light" className="nav-wave dark:hidden" />
              <Wordmark size={24} on="dark" className="nav-wave hidden dark:inline-flex" />
              <p className="mt-1.5 pl-8 text-[12px] font-semibold italic text-gray-500 dark:text-gray-400 whitespace-nowrap">
                Skuzi me, another round!
              </p>
            </>
          )}
        </div>

        {/* Collapse / expand */}
        <button
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand menu" : "Collapse menu"}
          title={collapsed ? "Expand menu" : "Collapse menu"}
          className="absolute -right-3.5 top-8 z-30 w-7 h-7 rounded-full bg-white dark:bg-[#3A2D26] border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white shadow-sm flex items-center justify-center"
        >
          {collapsed ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
        </button>

        {/* The venue: big logo and name when open, just the logo when collapsed */}
        {venue && (
          collapsed ? (
            <div className="flex justify-center pb-6" title={venue.name}>
              <LogoUploader venueName={venue.name} currentLogoUrl={venue.logoUrl} onUploaded={saveLogo} size={44} hideButton />
            </div>
          ) : (
            <div className="mx-3 px-4 pt-2 pb-8 flex flex-col items-center text-center">
              <LogoUploader venueName={venue.name} currentLogoUrl={venue.logoUrl} onUploaded={saveLogo} size={76} />
              <p className="mt-1 font-display text-xl font-bold leading-tight tracking-tight text-gray-900 dark:text-white break-words max-w-full">
                {venue.name}
              </p>
              {venue.isDemo && (
                <span className="mt-2 rounded-full bg-amber-100 dark:bg-amber-900/40 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                  Demo · payments simulated
                </span>
              )}
            </div>
          )
        )}

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => (
            <Link
              key={href}
              to={href}
              title={collapsed ? label : undefined}
              className={`
                flex items-center gap-3 py-2.5 rounded-xl text-sm font-medium transition-colors
                ${collapsed ? "justify-center px-0" : "px-3"}
                ${
                  isActive(href)
                    ? "bg-gray-900 text-gray-50 font-bold dark:bg-brand-500 dark:text-white"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
                }
              `}
            >
              <Icon size={17} className="flex-shrink-0" />
              {!collapsed && <span className="flex-1 whitespace-nowrap">{label}</span>}
            </Link>
          ))}
        </nav>

        {/* Bottom actions */}
        <div className="px-3 py-4 border-t border-gray-100 dark:border-gray-800 space-y-1">
          {/* Owner info */}
          <div className={`flex items-center gap-3 py-2 mb-1 ${collapsed ? "justify-center" : "px-3"}`} title={collapsed ? owner?.name : undefined}>
            <div className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {owner?.name?.[0]?.toUpperCase() ?? "?"}
            </div>
            {!collapsed && (
              <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                {owner?.name}
              </p>
            )}
          </div>

          {/* Theme: Light · Auto · Dark */}
          {collapsed ? (
            <div className="flex justify-center py-1.5">
              <ThemeSwitch layout="column" />
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 pl-3 pr-1 py-1.5">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Theme</span>
              <ThemeSwitch />
            </div>
          )}

          {/* Logout */}
          <button
            onClick={logout}
            title={collapsed ? "Sign out" : undefined}
            className={`w-full flex items-center gap-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-colors ${collapsed ? "justify-center" : "px-3"}`}
          >
            <LogOut size={17} />
            {!collapsed && "Sign out"}
          </button>
        </div>
      </aside>

      {/* ── Mobile top bar ─────────────────────────────────────────────────── */}
      <header
        className="
        md:hidden fixed top-0 left-0 right-0 z-20
        bg-white dark:bg-[#2B201B]
        border-b border-gray-200 dark:border-gray-800
        h-14 px-4 flex items-center justify-between
      "
      >
        {venue ? (
          // Venue badge: your logo wearing a little Skuzi hand sticker. Tap it for the venue card.
          <button onClick={() => setVenueSheet(true)} className="flex items-center gap-2.5 min-w-0 text-left" aria-label={`${venue.name}: venue card`}>
            <span className="relative flex-shrink-0">
              <VenueLogo logoUrl={venue.logoUrl} venueName={venue.name} size={36} />
              <span className="absolute -bottom-1.5 -right-1.5 w-[22px] h-[22px] rounded-full bg-brand-500 ring-2 ring-white dark:ring-[#2B201B] flex items-center justify-center">
                <svg width="15" height="15" viewBox="8 4 90 92" className="nav-wave" aria-hidden="true"><WavingHand color="#F4EDE3" strokeWidth={8} /></svg>
              </span>
            </span>
            <span className="min-w-0">
              <span className="block font-display text-[15px] font-bold leading-tight text-gray-900 dark:text-white truncate">{venue.name}</span>
              <span className="block text-[10.5px] italic font-semibold text-gray-500 dark:text-gray-400 truncate">Skuzi me, another round!</span>
            </span>
          </button>
        ) : (
          <div className="flex items-center gap-2.5">
            <Wordmark size={21} on="light" className="dark:hidden" />
            <Wordmark size={21} on="dark" className="hidden dark:inline-flex" />
          </div>
        )}
        <div className="flex items-center gap-1">
          <ThemeCycleButton />
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
        className={`
        ${collapsed ? "md:ml-[76px]" : "md:ml-60"}
        transition-[margin] duration-300
        pt-14 md:pt-0
        pb-20 md:pb-0
        min-h-screen
      `}
      >
        <div className={`${wide ? "max-w-7xl md:px-8" : "max-w-5xl"} mx-auto px-4 py-6 md:py-7`}>{children}</div>
      </main>

      {/* ── Bottom nav (mobile) ────────────────────────────────────────────── */}
      <nav
        className="
        md:hidden fixed bottom-0 left-0 right-0 z-20
        bg-white dark:bg-[#2B201B]
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

      {/* ── Venue card (mobile) ───────────────────────────────────────────── */}
      {venueSheet && venue && (
        <div className="md:hidden fixed inset-0 z-30">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setVenueSheet(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-[#2B201B] rounded-t-3xl border-t border-gray-200 dark:border-gray-800 pb-8 pt-3 px-5">
            <div className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-3" />
            <button onClick={() => setVenueSheet(false)} aria-label="Close" className="absolute right-4 top-4 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg">
              <X size={16} />
            </button>
            <div className="flex flex-col items-center text-center pt-2">
              <LogoUploader venueName={venue.name} currentLogoUrl={venue.logoUrl} onUploaded={saveLogo} size={96} />
              <p className="mt-1 font-display text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{venue.name}</p>
              {venue.isDemo && (
                <span className="mt-2 rounded-full bg-amber-100 dark:bg-amber-900/40 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-300">
                  Demo venue · payments are simulated
                </span>
              )}
            </div>
            <div className="mt-6 flex items-center justify-between rounded-2xl bg-gray-50 dark:bg-[#231A16] px-4 py-3">
              <Wordmark size={18} on="light" className="nav-wave dark:hidden" />
              <Wordmark size={18} on="dark" className="nav-wave hidden dark:inline-flex" />
              <span className="text-xs italic font-semibold text-gray-500 dark:text-gray-400">Skuzi me, another round!</span>
            </div>
          </div>
        </div>
      )}

      {/* ── More sheet (mobile) ────────────────────────────────────────────── */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-30">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-[#2B201B] rounded-t-3xl border-t border-gray-200 dark:border-gray-800 pb-8 pt-3 px-4 max-h-[75vh] overflow-y-auto">
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

            <p className="mt-6 mb-2.5 text-xs font-bold uppercase tracking-[0.14em] text-gray-400">Theme</p>
            <ThemeSwitch layout="labels" />
          </div>
        </div>
      )}
    </div>
  );
}
