import { useEffect, useState, ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, ArrowUpRight, Check, Plus, Minus, Hourglass, HelpCircle, FileX, Moon,
  Zap, BadgeCheck, Send, LineChart, QrCode, UtensilsCrossed, Wallet,
} from "lucide-react";
import { PLANS, planPrice, type PlanId } from "@tabpro/shared";
import { INCLUDED } from "../lib/packages";
import AnimatedLogo from "../components/AnimatedLogo";
import LanguageSwitch from "../components/LanguageSwitch";
import Translated from "../components/Translated";
import ThemeSwitch, { ThemeCycleButton } from "../components/ThemeSwitch";
import Wordmark from "../components/Wordmark";
import BookDemo, { openBookDemo } from "./landing/BookDemo";
import { WAITLIST_MODE, cta } from "../lib/waitlistMode";
import {
  PhoneFrame, ScreenScan, ScreenMenu, ScreenPay, WaiterCall, TonightCard,
  MoneyWidget, PayoutWidget, AlertsWidget,
  Hand, useInView,
} from "./landing/screens";

// Legal name only: contact goes through "Book a demo", not public numbers.
const COMPANY = { legalName: "VNT250 Ltd" };
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

// ─── Building blocks ─────────────────────────────────────────────────────────

function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const { ref, inView } = useInView<HTMLDivElement>(0.15);
  return (
    <div ref={ref} className={`sk-reveal ${inView ? "is-in" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

function Eyebrow({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11.5px] font-bold uppercase tracking-[0.16em] ${dark ? "bg-white/[0.06] text-[#FFD15C] ring-1 ring-white/10" : "bg-[var(--card)] text-[var(--rust-ink)] ring-1 ring-[var(--line)]"}`}>
      <Hand size={13} color={dark ? "#F0763A" : "#BF4A1A"} />
      {children}
    </span>
  );
}

// The honey brush-stroke under a word.
function Swoosh({ children }: { children: ReactNode }) {
  return (
    <span className="relative inline-block whitespace-nowrap">
      {children}
      <svg viewBox="0 0 300 24" preserveAspectRatio="none" className="sk-swoosh absolute -bottom-[0.12em] left-0 h-[0.32em] w-full" aria-hidden="true">
        <path d="M4 16C60 6 140 4 296 12" fill="none" stroke="#F2B33A" strokeWidth="8" strokeLinecap="round" pathLength={1} />
      </svg>
    </span>
  );
}

function ImigongoBand() {
  return (
    <svg width="100%" height="22" aria-hidden="true" className="block">
      <defs>
        <pattern id="imi-band" width="30" height="22" patternUnits="userSpaceOnUse">
          <path d="M0 22L15 0L30 22Z" fill="#BF4A1A" />
          <path d="M8 22L15 11L22 22Z" fill="#231A2C" />
        </pattern>
      </defs>
      <rect width="100%" height="22" fill="url(#imi-band)" />
    </svg>
  );
}

// ─── Nav ─────────────────────────────────────────────────────────────────────

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const loggedIn = !!localStorage.getItem("tabpro_token");
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className={`fixed inset-x-0 top-0 z-50 bg-[var(--paper)] transition-all duration-300 ${scrolled ? "py-3 shadow-[0_1px_0_var(--line)]" : "py-5"}`}>
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 sm:px-8">
        <a href="/" aria-label="Skuzi home" className="flex items-center">
          <AnimatedLogo size={28} on="light" bg="#FDFCFE" className="dark:hidden" />
          <AnimatedLogo size={28} on="dark" bg="#1B1524" className="hidden dark:inline-flex" />
        </a>
        <div className="hidden items-center gap-1 rounded-full bg-[var(--bg)] p-1 ring-1 ring-[var(--line)] md:flex">
          {[["How it works", "#tour"], ["For owners", "#owners"], ["Prices", "#prices"], ["Questions", "#faq"]].map(([l, h]) => (
            <a key={l} href={h} className="rounded-full px-4 py-1.5 text-[13.5px] font-medium text-[var(--body)] transition hover:bg-[var(--bg)] hover:text-[var(--ink)]">{l}</a>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitch />
          <span className="hidden xl:block"><ThemeSwitch /></span>
          <ThemeCycleButton className="xl:hidden" />
          {!WAITLIST_MODE && <Link to={loggedIn ? "/dashboard" : "/login"} className="hidden rounded-full px-4 py-2 text-[13.5px] font-semibold text-[var(--body)] transition hover:text-[var(--ink)] sm:block">
            {loggedIn ? "Dashboard" : "Log in"}
          </Link>}
          <button onClick={openBookDemo} className="whitespace-nowrap rounded-full bg-[var(--cta-bg)] px-4 py-2 text-[13.5px] font-extrabold text-[var(--cta-ink)] transition hover:bg-[var(--cta-hover)]">
            {cta("Book a demo")}
          </button>
        </div>
      </nav>
    </header>
  );
}

// ─── Hero: try it right here ─────────────────────────────────────────────────

function Hero() {
  const [called, setCalled] = useState(false);
  const call = () => {
    if (called) return;
    setCalled(true);
    setTimeout(() => setCalled(false), 5000);
  };
  return (
    <section className="relative overflow-hidden bg-[var(--hero-bg)] pt-32 text-[var(--hero-ink)] sm:pt-40">
      <div className="sk-glow pointer-events-none absolute left-1/2 top-[-12%] h-[900px] w-[1400px] -translate-x-1/2" style={{ opacity: "var(--hero-glow)" }} />
      <div className="sk-pattern pointer-events-none absolute inset-0 hidden dark:block" />
      <div className="sk-pattern-dark sk-pattern-mask pointer-events-none absolute inset-0 opacity-[0.05] dark:hidden" />
      <div className="sk-grain pointer-events-none absolute inset-0" />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full bg-[var(--hero-chip)] py-1 pl-1 pr-3 text-[13px] text-[var(--hero-body)] ring-1 ring-[var(--hero-ring)]">
              <span className="relative flex h-5 items-center rounded-full bg-[#5E7A55] px-2 text-[11px] font-bold text-[#F4F0F7]">
                <span className="sk-ping absolute left-1.5 h-2 w-2 rounded-full bg-[#A9BE9F]" />
                <span className="relative ml-3">Kigali</span>
              </span>
              {WAITLIST_MODE ? "Coming soon to restaurants & bars" : "Now setting up restaurants & bars"}
            </span>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="mt-7 font-display text-[min(46px,10.5vw)] font-extrabold leading-[0.98] tracking-[-0.045em] text-balance sm:text-7xl lg:text-[92px]">
              <span className="inline-flex items-baseline">
                Less waiting.
                <span className="sk-wave ml-2 inline-block translate-y-[0.06em] text-[var(--hero-hand)]"><Hand size={64} color="currentColor" className="h-[0.8em] w-[0.8em]" /></span>
              </span>
              <br />
              <Swoosh><span className="text-[var(--hero-accent)]">More fun.</span></Swoosh>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mx-auto mt-8 max-w-2xl text-[17px] leading-relaxed text-[var(--hero-body)] sm:text-[19px]">
              Faster orders. Happier guests. A more organized staff.
              And your whole restaurant, live on your phone.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button onClick={openBookDemo} className="sk-shine group relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-[var(--cta-bg)] px-7 py-4 text-[16px] font-extrabold text-[var(--cta-ink)] shadow-[0_14px_40px_-10px_var(--cta-glow)] transition hover:bg-[var(--cta-hover)] sm:w-auto">
                {cta("Book a free demo")}
                <ArrowRight size={18} className="transition group-hover:translate-x-1" />
              </button>
              <a href="#try" className="inline-flex w-full items-center justify-center gap-2 rounded-full px-7 py-4 text-[16px] font-bold text-[var(--hero-ink)] ring-1 ring-[var(--hero-ring)] transition hover:bg-[var(--hero-chip)] sm:w-auto">
                Try it below <span aria-hidden>↓</span>
              </a>
            </div>
            <p className="mt-6 text-[13px] text-[var(--hero-muted)]">Free setup · No app to download · No machine to buy</p>
          </Reveal>
        </div>

        {/* Live demo: tap Skuzi! on the guest phone and the waiter's card buzzes */}
        <Reveal delay={320} className="relative mx-auto mt-16 max-w-5xl">
          <div id="try" className="relative flex scroll-mt-28 items-end justify-center">
            <div className="absolute left-0 top-24 hidden lg:block">
              <p className="mb-3 ml-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--hero-muted)]">You, at home</p>
              <div className="sk-float-slow"><TonightCard /></div>
            </div>
            <div className="relative z-10">
              <p className="mb-3 text-center text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--hero-muted)]">Your guest, at table 4</p>
              <PhoneFrame className="h-[560px] w-[292px]">
                <ScreenMenu onCall={call} called={called} compact />
              </PhoneFrame>
            </div>
            <div className="absolute right-0 top-28 hidden lg:block">
              <p className="mb-3 ml-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--hero-muted)]">Your waiter</p>
              <div className={called ? "" : "sk-float"}><WaiterCall calling={called} /></div>
            </div>
          </div>
          {/* On phones the waiter card pops up over the guest phone */}
          <div className={`absolute inset-x-0 top-40 z-30 flex justify-center transition-all duration-500 lg:hidden ${called ? "opacity-100" : "pointer-events-none translate-y-4 opacity-0"}`}>
            <WaiterCall calling={called} />
          </div>
          <div className="pointer-events-none absolute inset-x-0 -bottom-px z-20 h-12 bg-gradient-to-t from-[var(--hero-bg)] to-transparent" />
        </Reveal>
      </div>
    </section>
  );
}

// ─── Pain → fix, with a switch ───────────────────────────────────────────────

const PAINS = [
  { pain: { icon: Hourglass, title: "The second round never comes.", text: "Guests wave, whistle and wait. Many give up and stop ordering. That's money quietly walking out the door." },
    fix: { icon: Zap, title: "Another round in two taps.", text: "Guests order from their own phone the moment they're thirsty. No catching anyone's eye." } },
  { pain: { icon: HelpCircle, title: "“Did table 6 pay?”", text: "Nobody is sure. Someone checks MoMo messages at the door while guests wait to leave." },
    fix: { icon: BadgeCheck, title: "Every bill, clear.", text: "Guests pay your MoMo Pay code or cash, the waiter taps Paid, and you see it on your phone. No guessing at the door." } },
  { pain: { icon: FileX, title: "Orders get lost.", text: "A busy waiter, a scrap of paper, a forgotten brochette. The guest is upset and you lose the sale." },
    fix: { icon: Send, title: "Orders never get lost.", text: "Every order arrives clear, from the table to the bar and kitchen. Nothing to write down, nothing to forget." } },
  { pain: { icon: Moon, title: "You find out at closing.", text: "Or the next morning. You can't fix a slow night you couldn't see." },
    fix: { icon: LineChart, title: "You watch the night as it happens.", text: "Your whole restaurant on your phone, live, wherever you are." } },
];

// Without / With Skuzi: two tabs, the same four moments of a busy night.
function PainSwitch() {
  const [withSkuzi, setWithSkuzi] = useState(false);
  return (
    <section className="relative bg-[var(--bg)]">
      <div className="mx-auto w-full max-w-7xl px-5 py-24 sm:px-8">
        <Reveal className="mx-auto max-w-3xl text-center">
          <Eyebrow>Sound familiar?</Eyebrow>
          <h2 className="mt-5 font-display text-4xl font-extrabold leading-[1.02] tracking-[-0.035em] text-balance sm:text-6xl">
            Friday night, full house,{" "}
            <span className={withSkuzi ? "text-[#5E7A55] dark:text-[#A9BE9F]" : "text-[var(--rust-ink)]"}>{withSkuzi ? "and Skuzi." : "and then…"}</span>
          </h2>
        </Reveal>

        <div className="mt-8 flex justify-center">
          <div role="tablist" aria-label="Without or with Skuzi" className="grid w-[300px] grid-cols-2 rounded-full bg-[var(--card)] p-1.5 text-[14px] font-bold ring-1 ring-[var(--line)]">
            {[false, true].map((w) => (
              <button key={String(w)} role="tab" aria-selected={withSkuzi === w} onClick={() => setWithSkuzi(w)}
                className={`rounded-full py-2 transition-colors ${withSkuzi === w ? (w ? "bg-[#5E7A55] text-[#F4F0F7]" : "bg-[#231A2C] text-[#F4F0F7]") : "text-[var(--muted)]"}`}>
                {w ? "With Skuzi" : "Without Skuzi"}
              </button>
            ))}
          </div>
        </div>

        <div key={String(withSkuzi)} className="sk-fade mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PAINS.map(({ pain, fix }, i) => <FaceCard key={i} side={withSkuzi ? fix : pain} fixed={withSkuzi} />)}
        </div>
        {withSkuzi && (
          <p className="mt-8 text-center text-[16px] font-semibold text-[var(--body)]">
            Skuzi fixes all four, <span className="text-[var(--ink)]">without a single new machine.</span>
          </p>
        )}
      </div>
    </section>
  );
}

function FaceCard({ side, fixed = false }: { side: { icon: typeof Zap; title: string; text: string }; fixed?: boolean }) {
  const Icon = side.icon;
  return (
    <div className={`h-full rounded-[28px] p-7 ${fixed ? "bg-[#231A2C] text-[#F4F0F7] shadow-[0_30px_60px_-30px_rgba(35,26,44,0.6)]" : "bg-[var(--card)] ring-1 ring-[var(--line)]"}`}>
      <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${fixed ? "bg-[#F2B33A] text-[#231A2C]" : "bg-[var(--bg)] text-[var(--muted)]"}`}>
        <Icon size={22} />
      </span>
      <p className={`mt-5 text-[11px] font-extrabold uppercase tracking-[0.16em] ${fixed ? "text-[#A9BE9F]" : "text-[var(--rust-ink)]"}`}>{fixed ? "With Skuzi" : "Without Skuzi"}</p>
      <h3 className="mt-1.5 font-display text-[22px] font-bold leading-tight">{side.title}</h3>
      <p className={`mt-2.5 text-[15px] leading-relaxed ${fixed ? "text-[#D3CADC]" : "text-[var(--body)]"}`}>{side.text}</p>
    </div>
  );
}

// ─── How it works: a guided tour on a phone ─────────────────────────────────

const STEPS = [
  { icon: QrCode, title: "Scan", text: "Guests point their phone camera at the code on the table and your menu opens. No app, no account.", screen: ScreenScan },
  { icon: UtensilsCrossed, title: "Order", text: "They see your menu with prices and order round after round. Your team gets it right away.", screen: () => <ScreenMenu /> },
  { icon: Wallet, title: "Pay", text: "The bill is on their phone, item by item. They pay your MoMo Pay code or cash, and the waiter taps Paid.", screen: ScreenPay },
];

function Tour() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const { ref, inView } = useInView<HTMLDivElement>(0.3);
  useEffect(() => {
    if (!inView || paused) return;
    const t = setTimeout(() => setActive((a) => (a + 1) % STEPS.length), 4400);
    return () => clearTimeout(t);
  }, [active, inView, paused]);
  const Screen = STEPS[active].screen;
  return (
    <section id="tour" className="relative scroll-mt-16 overflow-hidden bg-[var(--bg)] py-24 sm:py-32">
      <div className="sk-glow-sm pointer-events-none absolute -right-40 top-20 h-[600px] w-[600px] opacity-60" />
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal>
          <Eyebrow>How it works</Eyebrow>
          <h2 className="mt-5 max-w-3xl font-display text-4xl font-extrabold leading-[1.02] tracking-[-0.035em] text-balance sm:text-6xl">
            One scan. A few taps. <span className="text-[var(--rust-ink)]">One happy table.</span>
          </h2>
        </Reveal>
      </div>
      <div ref={ref} className="relative mx-auto mt-12 grid max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-[1fr_auto] lg:gap-16">
        <div className="space-y-3">
          {STEPS.map(({ icon: Icon, title, text }, i) => {
            const on = i === active;
            return (
              <button
                key={title}
                onClick={() => { setActive(i); setPaused(true); }}
                className={`group relative w-full overflow-hidden rounded-3xl p-6 text-left transition-all duration-300 ${on ? "bg-[var(--card)] shadow-[0_24px_50px_-30px_rgba(35,26,44,0.45)] ring-1 ring-[var(--line)]" : "hover:bg-[var(--card)]"}`}
              >
                <div className="flex items-start gap-5">
                  <span className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl transition ${on ? "bg-[#F2B33A] text-[#231A2C]" : "bg-[var(--card)] text-[var(--muted)] ring-1 ring-[var(--line)]"}`}>
                    <Icon size={21} />
                  </span>
                  <div>
                    <p className={`font-display text-[21px] font-bold tracking-tight ${on ? "text-[var(--ink)]" : "text-[var(--muted)]"}`}>
                      <span className="mr-2 text-[13px] font-bold text-[var(--rust-ink)]">0{i + 1}</span>{title}
                    </p>
                    <div className={`grid transition-all duration-500 ${on ? "mt-2 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                      <p className="overflow-hidden text-[15.5px] leading-relaxed text-[var(--body)]">{text}</p>
                    </div>
                  </div>
                </div>
                {on && !paused && inView && <span key={active} className="sk-progress absolute bottom-0 left-0 h-[3px] bg-[#F2B33A]" />}
              </button>
            );
          })}
        </div>
        <div className="relative order-first mx-auto lg:order-none">
          <div className="sk-glow-sm pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 opacity-60" />
          <PhoneFrame className="relative h-[560px] w-[280px] sm:h-[620px] sm:w-[300px]">
            <div key={active} className="sk-screen h-full"><Screen /></div>
          </PhoneFrame>
        </div>
      </div>
    </section>
  );
}

// ─── What one more round is worth ────────────────────────────────────────────

function Slider({ label, value, min, max, step, onChange, format }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format: (v: number) => string }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label className="block">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[15px] font-semibold text-[var(--body)]">{label}</span>
        <span className="font-display text-[19px] font-bold tabular-nums">{format(value)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="sk-range mt-3 w-full"
        style={{ background: `linear-gradient(90deg, #BF4A1A ${pct}%, var(--line) ${pct}%)` }}
      />
    </label>
  );
}

function OneMoreRound() {
  const [tables, setTables] = useState(15);
  const [round, setRound] = useState(4000);
  const [nights, setNights] = useState(20);
  const extra = tables * round * nights;
  return (
    <section className="relative overflow-hidden bg-[var(--paper)] py-24 sm:py-28">
      <div className="pointer-events-none absolute -left-32 top-10 h-96 w-96 rounded-full bg-[#F2B33A]/20 blur-3xl" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-2">
        <Reveal>
          <Eyebrow>The hidden cost</Eyebrow>
          <h2 className="mt-4 font-display text-4xl font-extrabold leading-[1.02] tracking-[-0.035em] sm:text-6xl">
            How much are you losing to <span className="text-[var(--rust-ink)]">slow service?</span>
          </h2>
          <p className="mt-5 max-w-lg text-[18px] leading-relaxed text-[var(--body)]">
            Every time a guest gives up waving and stops ordering, that round is gone for good. It never shows up in your till, so you never see it. Move the sliders and see what slips away.
          </p>
        </Reveal>
        <Reveal delay={120}>
          <div className="rounded-[32px] bg-[var(--card)] p-7 shadow-[0_40px_80px_-40px_rgba(35,26,44,0.45)] ring-1 ring-[var(--line)] sm:p-9">
            <div className="space-y-7">
              <Slider label="Tables with guests on a normal night" value={tables} min={3} max={60} step={1} onChange={setTables} format={(v) => `${v}`} />
              <Slider label="Price of one round" value={round} min={1000} max={20000} step={500} onChange={setRound} format={(v) => `${fmt(v)} RWF`} />
              <Slider label="Nights open each month" value={nights} min={4} max={30} step={1} onChange={setNights} format={(v) => `${v}`} />
            </div>
            <div className="mt-8 rounded-[24px] bg-[#231A2C] p-6 text-[#F4F0F7] dark:bg-[#2B1838]">
              <p className="text-[14px] text-[#D3CADC]">If each table misses just <b className="text-[#F4F0F7]">one round</b> a night, you lose</p>
              <p className="mt-1 font-display text-[42px] font-bold leading-none tracking-[-0.03em] tabular-nums text-[#F0884F] sm:text-[52px]">
                −{fmt(extra)} <span className="text-[18px] text-[#D3CADC]">RWF a month</span>
              </p>
              <p className="mt-3 border-t border-white/10 pt-3 text-[14px] text-[#D3CADC]">
                That's <b className="text-[#F4F0F7] tabular-nums">{fmt(extra * 12)} RWF</b> a year your guests wanted to spend.
              </p>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[12.5px] text-[var(--muted)]">An example to help you think, not exact figures.</p>
              <button onClick={openBookDemo} className="inline-flex items-center gap-1.5 text-[14px] font-extrabold text-[var(--rust-ink)] hover:underline underline-offset-4">
                Stop losing rounds <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── For owners ──────────────────────────────────────────────────────────────

function Card({ children, className = "", dark = false }: { children: ReactNode; className?: string; dark?: boolean }) {
  return (
    <div className={`group relative h-full overflow-hidden rounded-[28px] p-7 transition duration-500 hover:-translate-y-1 ${dark ? "bg-[#231A2C] text-[#F4F0F7] ring-1 ring-white/10" : "bg-[var(--card)] ring-1 ring-[var(--line)] hover:shadow-[0_30px_60px_-30px_rgba(35,26,44,0.35)]"} ${className}`}>
      {children}
    </div>
  );
}

function CardTitle({ title, text, dark = false }: { title: string; text: string; dark?: boolean }) {
  return (
    <div className="mt-6">
      <h3 className="font-display text-[21px] font-bold tracking-tight">{title}</h3>
      <p className={`mt-1.5 text-[15px] leading-relaxed ${dark ? "text-[#D3CADC]" : "text-[var(--body)]"}`}>{text}</p>
    </div>
  );
}

function Owners() {
  const { ref, inView } = useInView<HTMLDivElement>(0.2);
  return (
    <section id="owners" className="scroll-mt-16 bg-[var(--paper)] py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal className="grid gap-6 lg:grid-cols-2 lg:items-end">
          <div>
            <Eyebrow>For owners</Eyebrow>
            <h2 className="mt-5 font-display text-4xl font-extrabold leading-[1.02] tracking-[-0.035em] text-balance sm:text-6xl">
              Your restaurant, <span className="text-[var(--rust-ink)]">from anywhere.</span>
            </h2>
          </div>
          <p className="max-w-lg text-[18px] leading-relaxed text-[var(--body)] lg:justify-self-end">
            Stop guessing. See what's happening on the floor as it happens: the money, the tables, your team and your guests. From behind the counter or across town.
          </p>
        </Reveal>

        <div ref={ref} className="mt-14 grid gap-5 md:grid-cols-6">
          <Reveal className="md:col-span-4">
            <Card><MoneyWidget active={inView} /><CardTitle title="Tonight's money, live" text="Every paid bill adds to the line. Know how the night is going before closing time, not after." /></Card>
          </Reveal>
          <Reveal delay={80} className="md:col-span-2">
            <Card dark><PayoutWidget /><CardTitle dark title="100% of the money is yours" text="Guests pay your own MoMo Pay code. Skuzi takes nothing from your sales." /></Card>
          </Reveal>
          <Reveal className="md:col-span-3">
            <Card><AlertsWidget /><CardTitle title="You hear about everything" text="Guests seated, waiters called, bills paid. Nothing happens without you knowing." /></Card>
          </Reveal>
          <Reveal delay={80} className="md:col-span-3">
            <Card>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["Any phone works", "Guests, waiters and you. No downloads."],
                  ["Cash still welcome", "MoMo and cash, side by side."],
                  ["Every waiter covered", "No smartphone? A manager covers their tables."],
                  ["Set up in one visit", "We come to you and get your team going."],
                ].map(([t]) => (
                  <div key={t} className="rounded-2xl bg-[var(--bg)] p-4">
                    <p className="flex items-start gap-1.5 text-[14px] font-extrabold leading-snug"><Check size={15} strokeWidth={3} className="mt-0.5 flex-shrink-0 text-[#5E7A55]" />{t}</p>
                  </div>
                ))}
              </div>
              <CardTitle title="Made for how Kigali restaurants and bars really work" text="Shared tables, busy weekends, cash and MoMo side by side. Skuzi fits in, it doesn't fight you." />
            </Card>
          </Reveal>
          <Reveal className="md:col-span-6">
            <div className="relative overflow-hidden rounded-[28px] bg-[#F2B33A] p-7 text-[#231A2C] sm:p-10">
              <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/20" />
              <div className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full bg-white/10" />
              <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="max-w-xl">
                  <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#231A2C]/70">And there's more inside</p>
                  <h3 className="mt-2 font-display text-[30px] font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-[38px]">The rest, we show you in person.</h3>
                  <p className="mt-3 text-[16px] leading-relaxed text-[#231A2C]/80">Tools to fill your quiet nights, bring guests back and keep your team sharp. Five minutes, at your restaurant, on your own phone.</p>
                </div>
                <button onClick={openBookDemo} className="group inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-full bg-[#231A2C] px-7 py-4 text-[16px] font-extrabold text-[#F4F0F7] transition hover:bg-black">
                  {cta("Book a demo")} <ArrowRight size={18} className="transition group-hover:translate-x-0.5" />
                </button>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// ─── Questions ───────────────────────────────────────────────────────────────

const FAQS = [
  { q: "Do my guests need to download an app?", a: "No. They scan the sticker on the table with their phone camera and your menu opens. It works on any smartphone." },
  { q: "How do guests pay?", a: "With your own MoMo Pay code, or cash as usual. The money goes straight to you: Skuzi takes nothing from your bills." },
  { q: "What does it cost?", a: "One package a month: Go 35,000, Pro 60,000 or Max 120,000 RWF. Nothing to set up, no machine to buy, and the first weeks are free. Pay 6 months or a year at once and save." },
  { q: "Do I need to buy any equipment?", a: "No. Your waiters use their own phones, you use yours, and we bring everything else." },
  { q: "What if some of my waiters don't have a smartphone?", a: "That's fine. Add them anyway: a manager's phone gets their table calls, so no guest is left waiting." },
  { q: "How do I get started?", a: WAITLIST_MODE ? "Join the waitlist. When your spot comes up, we come to you, set up your menu, tables and team with you, and show your waiters how it works. Usually in one visit." : "Book a free demo. We come to you, set up your menu, tables and team with you, and show your waiters how it works. Usually in one visit." },
];

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="scroll-mt-16 bg-[var(--paper)] py-24 sm:py-32">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[0.8fr_1.2fr]">
        <Reveal>
          <Eyebrow>Questions</Eyebrow>
          <h2 className="mt-5 font-display text-4xl font-extrabold leading-[1.02] tracking-[-0.035em] sm:text-5xl">
            Good questions. <span className="text-[var(--rust-ink)]">Straight answers.</span>
          </h2>
          <p className="mt-5 max-w-sm text-[16px] leading-relaxed text-[var(--body)]">
            Something else on your mind?{" "}
            <button onClick={openBookDemo} className="font-bold text-[var(--rust-ink)] underline decoration-[#F2B33A] decoration-2 underline-offset-4">{WAITLIST_MODE ? "Join the waitlist and ask us" : "Ask us during a free demo"}</button>.
          </p>
        </Reveal>
        <Reveal delay={100}>
          <div className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {FAQS.map((f, i) => {
              const on = open === i;
              return (
                <div key={f.q}>
                  <button onClick={() => setOpen(on ? null : i)} className="flex w-full items-center justify-between gap-6 py-6 text-left">
                    <span className="text-[17px] font-bold">{f.q}</span>
                    <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition ${on ? "bg-[#BF4A1A] text-[#F4F0F7]" : "bg-[var(--card)] text-[var(--muted)] ring-1 ring-[var(--line)]"}`}>
                      {on ? <Minus size={15} /> : <Plus size={15} />}
                    </span>
                  </button>
                  <div className={`grid transition-all duration-500 ${on ? "grid-rows-[1fr] pb-6 opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                    <p className="overflow-hidden pr-12 text-[16px] leading-relaxed text-[var(--body)]">{f.a}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── Prices ──────────────────────────────────────────────────────────────────

const PRICE_ROWS: { id: PlanId; who: string }[] = [
  { id: "basic", who: "Small bars" },
  { id: "pro", who: "Most restaurants" },
  { id: "elite", who: "Big nights out" },
];

function Prices() {
  const [period, setPeriod] = useState<"month" | "half" | "year">("month");
  const n = (v: number) => v.toLocaleString("en-US");
  return (
    <section id="prices" className="scroll-mt-16 bg-[var(--bg)] py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal>
          <Eyebrow>Prices</Eyebrow>
          <h2 className="mt-5 font-display text-4xl font-extrabold leading-[1.02] tracking-[-0.035em] sm:text-5xl">
            One package. <span className="text-[var(--rust-ink)]">Nothing taken from your sales.</span>
          </h2>
          <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-[var(--body)]">No setup fee, no machine to buy: Skuzi runs on the phones you already have. Start with a free trial.</p>
          <div className="mt-6 inline-flex flex-wrap rounded-2xl bg-[var(--card)] p-1 ring-1 ring-[var(--line)]" role="group" aria-label="How long to pay for">
            {(["month", "half", "year"] as const).map((p) => (
              <button key={p} onClick={() => setPeriod(p)} aria-pressed={period === p}
                className={`rounded-full px-4 py-2 text-[13.5px] font-bold transition ${period === p ? "bg-[var(--cta-bg)] text-[var(--cta-ink)]" : "text-[var(--body)]"}`}>
                {p === "month" ? "Monthly" : p === "half" ? "6 months" : "1 year · 2 months free"}
              </button>
            ))}
          </div>
        </Reveal>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {PRICE_ROWS.map((row, i) => {
            const plan = PLANS[row.id];
            const price = period === "year" ? plan.yearlyRwf! : period === "half" ? plan.sixMonthRwf! : plan.priceRwf;
            const founding = row.id === "elite";
            const fp = planPrice("elite", true);
            const foundingPrice = period === "year" ? fp.yearlyRwf! : period === "half" ? fp.sixMonthRwf! : fp.priceRwf;
            return (
              <Reveal key={row.id} delay={i * 80}>
                <div className={`flex h-full flex-col rounded-3xl bg-[var(--card)] p-6 ring-1 ${founding ? "ring-2 ring-[#F2B33A]" : "ring-[var(--line)]"}`}>
                  <p className="text-[13px] font-bold uppercase tracking-wider text-[var(--muted)]">{row.who}</p>
                  <p className="mt-1 font-display text-3xl font-extrabold">{plan.name}</p>
                  <p className="mt-4 font-display text-3xl font-extrabold">
                    {n(price)} <span className="text-[14px] font-semibold text-[var(--muted)]">RWF / {period === "year" ? "year" : period === "half" ? "6 months" : "month"}</span>
                  </p>
                  {founding && (
                    <p className="mt-3 rounded-2xl bg-[#FFEDB8] px-4 py-3 text-[14px] font-semibold text-[#5A3A00]">
                      ⭐ First 15 venues: <b>{n(foundingPrice)} RWF</b>, the Pro price, for as long as they stay.
                    </p>
                  )}
                  <ul className="mt-5 space-y-2 text-[15px] text-[var(--body)]">
                    {INCLUDED[row.id].map((h) => <li key={h}>✓ {h}</li>)}
                  </ul>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── Final call ──────────────────────────────────────────────────────────────

function FinalCta() {
  return (
    <section className="bg-[var(--paper)] px-5 pb-24 sm:px-8">
      <Reveal>
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[40px] bg-[#BF4A1A] px-6 py-20 text-center text-[#F4F0F7] sm:py-28">
          <div className="sk-pattern-dark pointer-events-none absolute inset-0 opacity-[0.12]" />
          <div className="pointer-events-none absolute -left-20 -top-20 h-80 w-80 rounded-full bg-[#F2B33A]/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -right-16 h-96 w-96 rounded-full bg-[#231A2C]/40 blur-3xl" />
          <div className="relative">
            <span className="sk-wave inline-block"><Hand size={56} color="#F4F0F7" /></span>
            <h2 className="mx-auto mt-6 max-w-3xl font-display text-4xl font-extrabold leading-[1.02] tracking-[-0.04em] text-balance sm:text-7xl">
              Make this Friday the easy one.
            </h2>
            <p className="mx-auto mt-6 max-w-lg text-[18px] leading-relaxed text-[#FCE3D3]">
              Tell us about your place. We'll come over and set up your menu, tables and team with you, free.
            </p>
            <div className="mt-10 flex justify-center">
              <button onClick={openBookDemo} className="sk-shine group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-[#231A2C] px-8 py-4 text-[16px] font-extrabold text-[#F4F0F7] transition hover:bg-black">
                {cta("Book a free demo")} <ArrowRight size={18} className="transition group-hover:translate-x-1" />
              </button>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

// ─── Footer (legal: required for payment-partner compliance) ─────────────────

function Footer() {
  return (
    <footer className="bg-[#1B1524] text-[#F4F0F7]">
      <ImigongoBand />
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-10 border-b border-white/[0.06] px-5 py-16 sm:px-8 md:flex-row md:items-center">
        <div>
          <p className="flex items-center gap-2 text-[13px] font-semibold text-[#A9BE9F]">
            <span className="relative flex h-2 w-2">
              <span className="sk-ping absolute inline-flex h-full w-full rounded-full bg-[#86A27B] opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#86A27B]" />
            </span>
            {WAITLIST_MODE ? "Coming soon to Kigali" : "Now setting up venues in Kigali"}
          </p>
          <h2 className="mt-4 font-display text-5xl font-extrabold leading-[0.95] tracking-[-0.045em] sm:text-7xl">
            Ready when <span className="text-[#F2B33A]">you are.</span>
          </h2>
        </div>
        <button onClick={openBookDemo} aria-label={cta("Book a demo")} className="group relative h-36 w-36 flex-shrink-0 rounded-full sm:h-40 sm:w-40">
          <svg viewBox="0 0 200 200" className="sk-spin absolute inset-0 h-full w-full" aria-hidden="true">
            <defs><path id="sk-ring" d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0" /></defs>
            {/* textLength = the ring's circumference (2π·78), so the words close the loop exactly */}
            <text fill="rgba(244,237,227,0.75)" fontSize="15" fontWeight="700">
              <textPath href="#sk-ring" textLength="488" lengthAdjust="spacing">{WAITLIST_MODE ? "JOIN THE WAITLIST · FIRST VENUES · JOIN THE WAITLIST · " : "BOOK A DEMO · FREE SETUP · BOOK A DEMO · FREE SETUP ·"}</textPath>
            </text>
          </svg>
          <span className="absolute inset-[30%] flex items-center justify-center rounded-full bg-[#F2B33A] text-[#231A2C] shadow-[0_10px_40px_-6px_rgba(242,179,58,0.7)] transition duration-300 group-hover:scale-110">
            <ArrowUpRight size={26} strokeWidth={2.5} className="transition duration-300 group-hover:rotate-45" />
          </span>
        </button>
      </div>

      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-14 sm:px-8 md:grid-cols-[2fr_1fr]">
        <div>
          <Wordmark size={30} on="dark" />
          <p className="mt-5 max-w-sm text-[14px] leading-relaxed text-[#9C90A8]">
            Skuzi is a product of <span className="font-semibold text-[#D3CADC]">{COMPANY.legalName}</span>, a company registered in Rwanda.
          </p>
        </div>
        <div>
          <p className="text-[13px] font-bold uppercase tracking-[0.15em] text-[#9C90A8]">Legal & access</p>
          <ul className="mt-5 space-y-3 text-[14px] text-[#D3CADC]">
            <li><a className="hover:text-[#F2B33A]" href="/terms.html">Terms & Conditions</a></li>
            <li><a className="hover:text-[#F2B33A]" href="/privacy.html">Privacy Policy</a></li>
            {WAITLIST_MODE ? (
              <li><Link className="hover:text-[#F2B33A]" to="/waitlist">Join the waitlist</Link></li>
            ) : (<>
              <li><Link className="hover:text-[#F2B33A]" to="/login">Owner login</Link></li>
              <li><Link className="hover:text-[#F2B33A]" to="/waiter">Waiter login</Link></li>
            </>)}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-6 text-[12.5px] text-[#6F6379] sm:flex-row sm:justify-between sm:px-8">
          <span>© {new Date().getFullYear()} {COMPANY.legalName}. All rights reserved.</span>
          <span>Made in Kigali.</span>
        </div>
      </div>
    </footer>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

// Coffee & imigongo, with light sections that follow the visitor's theme.
const STYLES = `
.sk-site { --hero-bg:#AE4217; --hero-hand:#FFFFFF; --hero-ink:#FFFFFF; --hero-body:#FFE6D8; --hero-muted:#FFD3BC; --hero-accent:#FFD966; --hero-chip:rgba(255,255,255,.12); --hero-ring:rgba(255,255,255,.30); --hero-glow:0; --cta-bg:#231A2C; --cta-ink:#FFFFFF; --cta-hover:#3A2D48; --cta-glow:rgba(35,26,44,.35); --bg:#F4F0F7; --paper:#FFFFFF; --card:#FDFCFE; --ink:#231A2C; --body:#554A60; --muted:#6F6379; --line:#E2DCE8; --rust-ink:#A63F15; }
.dark .sk-site { --hero-bg:#2B1838; --hero-hand:#F0763A; --hero-ink:#F4F0F7; --hero-body:#D9C6E6; --hero-muted:#C4AED3; --hero-accent:#F2B33A; --hero-chip:rgba(255,255,255,.05); --hero-ring:rgba(255,255,255,.10); --hero-glow:0; --cta-bg:#E2602A; --cta-ink:#FFFFFF; --cta-hover:#EE7843; --cta-glow:rgba(226,96,42,.6); --bg:#2E1A3C; --paper:#2B1838; --card:#3B2149; --ink:#F4F0F7; --body:#D9C6E6; --muted:#C4AED3; --line:#573469; --rust-ink:#F29C6F; }
.sk-reveal { opacity: 0; transform: translateY(28px); transition: opacity .9s cubic-bezier(.2,.7,.2,1), transform .9s cubic-bezier(.2,.7,.2,1); }
.sk-reveal.is-in { opacity: 1; transform: none; }
.sk-glow { background: radial-gradient(closest-side, rgba(191,74,26,.55), transparent 70%), radial-gradient(closest-side at 70% 40%, rgba(242,179,58,.28), transparent 70%); filter: blur(40px); }
.sk-glow-sm { background: radial-gradient(closest-side, rgba(242,179,58,.30), transparent 70%); filter: blur(30px); }
/* Flat colours, like the 2026-10-20 mockup: no glows. */
.sk-glow, .sk-glow-sm { display: none; }
/* Imigongo: soft diamonds, like the cow-dung art of eastern Rwanda */
.sk-pattern { opacity: .07; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='56'%3E%3Cpath d='M28 4L52 28L28 52L4 28Z' fill='none' stroke='%23F4EDE3' stroke-width='2'/%3E%3Cpath d='M28 16L40 28L28 40L16 28Z' fill='%23F4EDE3'/%3E%3C/svg%3E"); mask-image: radial-gradient(ellipse at 50% 30%, black 15%, transparent 70%); -webkit-mask-image: radial-gradient(ellipse at 50% 30%, black 15%, transparent 70%); }
.sk-pattern-mask { mask-image: radial-gradient(ellipse at 50% 30%, black 15%, transparent 70%); -webkit-mask-image: radial-gradient(ellipse at 50% 30%, black 15%, transparent 70%); }
.sk-pattern-dark { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='56'%3E%3Cpath d='M28 4L52 28L28 52L4 28Z' fill='none' stroke='%232B201B' stroke-width='2'/%3E%3Cpath d='M28 16L40 28L28 40L16 28Z' fill='%232B201B'/%3E%3C/svg%3E"); }
.sk-grain { opacity: .07; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }
@keyframes sk-float { 0%,100% { transform: translateY(0) rotate(3deg) } 50% { transform: translateY(-12px) rotate(3deg) } }
@keyframes sk-float-slow { 0%,100% { transform: translateY(0) rotate(-4deg) } 50% { transform: translateY(-10px) rotate(-4deg) } }
.sk-float { animation: sk-float 7s ease-in-out infinite; }
.sk-float-slow { animation: sk-float-slow 8s ease-in-out infinite; }
@keyframes sk-wave { 0%,60%,100% { transform: rotate(0) } 10%,30% { transform: rotate(-14deg) } 20%,40% { transform: rotate(12deg) } }
.sk-wave { transform-origin: 60% 90%; animation: sk-wave 2.6s ease-in-out infinite; }
@keyframes sk-buzz { 0%,100% { transform: translateX(0) rotate(0) } 15% { transform: translateX(-5px) rotate(-2deg) } 30% { transform: translateX(5px) rotate(2deg) } 45% { transform: translateX(-4px) rotate(-1deg) } 60% { transform: translateX(3px) rotate(1deg) } 75% { transform: translateX(0) } }
.sk-buzz { animation: sk-buzz .7s ease-in-out 3; }
@keyframes sk-tapme { 0%,100% { transform: scale(1) } 50% { transform: scale(1.12) } }
.sk-tapme { animation: sk-tapme 1.2s ease-in-out infinite; }
@keyframes sk-swoosh { from { stroke-dashoffset: 1 } to { stroke-dashoffset: 0 } }
.sk-swoosh path { stroke-dasharray: 1; animation: sk-swoosh 1.1s .9s cubic-bezier(.3,.7,.2,1) both; }
@keyframes sk-scan { 0%,100% { top: 12px } 50% { top: calc(100% - 14px) } }
.sk-scanline { animation: sk-scan 2.4s ease-in-out infinite; }
@keyframes sk-toast { from { opacity: 0; transform: translateY(-8px) scale(.98) } to { opacity: 1; transform: none } }
.sk-toast { animation: sk-toast .5s cubic-bezier(.2,.8,.2,1) both; }
@keyframes sk-pop { 0% { opacity: 0; transform: scale(.6) } 70% { transform: scale(1.06) } 100% { opacity: 1; transform: scale(1) } }
.sk-pop { animation: sk-pop .5s cubic-bezier(.2,.8,.2,1) both; }
@keyframes sk-fade { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
.sk-fade { animation: sk-fade .45s ease-out both; }
@keyframes sk-screen { from { opacity: 0; transform: translateX(18px) } to { opacity: 1; transform: none } }
.sk-screen { animation: sk-screen .5s cubic-bezier(.2,.8,.2,1) both; }
@keyframes sk-progress { from { width: 0 } to { width: 100% } }
.sk-progress { animation: sk-progress 4.4s linear both; }
@keyframes sk-draw { from { stroke-dashoffset: 1 } to { stroke-dashoffset: 0 } }
.sk-draw { stroke-dasharray: 1; animation: sk-draw 1.8s ease-out both; }
@keyframes sk-bar { from { transform: scaleX(0) } to { transform: scaleX(1) } }
.sk-bar { transform-origin: left center; animation: sk-bar 1.3s cubic-bezier(.2,.8,.2,1) both; }
@keyframes sk-cell { 0%,100% { filter: none } 50% { filter: brightness(1.15) } }
.sk-cell-now { animation: sk-cell 2.2s ease-in-out infinite; box-shadow: 0 0 0 2px #231A2C; }
.sk-shine::after { content: ''; position: absolute; inset: 0; background: linear-gradient(110deg, transparent 35%, rgba(255,255,255,.45) 50%, transparent 65%); transform: translateX(-120%); animation: sk-shine 4.5s ease-in-out infinite; }
@keyframes sk-shine { 0%, 60% { transform: translateX(-120%) } 100% { transform: translateX(120%) } }
.sk-range { -webkit-appearance: none; appearance: none; height: 6px; border-radius: 999px; outline: none; }
.sk-range::-webkit-slider-thumb { -webkit-appearance: none; width: 24px; height: 24px; border-radius: 50%; background: #BF4A1A; border: 4px solid #FDFCFE; box-shadow: 0 4px 12px rgba(35,26,44,.35); cursor: pointer; }
.sk-range::-moz-range-thumb { width: 18px; height: 18px; border-radius: 50%; background: #BF4A1A; border: 4px solid #FDFCFE; cursor: pointer; }
.sk-range-dark::-webkit-slider-thumb { background: #F2B33A; border-color: #231A2C; }
@keyframes sk-spin { to { transform: rotate(360deg) } }
.sk-spin { animation: sk-spin 18s linear infinite; transform-origin: 50% 50%; }
button:hover > .sk-spin { animation-duration: 6s; }
@keyframes sk-nudge { 0%,100% { opacity: .2; transform: scale(.94) } 50% { opacity: 1; transform: scale(1.04) } }
.sk-nudge { animation: sk-nudge 1.8s ease-in-out infinite; }
/* Flip cards: the problem on the front, the fix on the back */
.sk-flip-scene { perspective: 1200px; height: 100%; }
.sk-flip-card { display: grid; height: 100%; transform-style: preserve-3d; transition: transform .8s cubic-bezier(.3,.7,.2,1); }
.sk-flip-card.is-flipped { transform: rotateY(180deg); }
.sk-face { grid-area: 1 / 1; backface-visibility: hidden; -webkit-backface-visibility: hidden; }
.sk-face-back { transform: rotateY(180deg); }
@keyframes sk-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(4px) } }
.sk-bob { animation: sk-bob 1.4s ease-in-out infinite; }
@keyframes sk-ping { 75%, 100% { transform: scale(2.4); opacity: 0 } }
.sk-ping { animation: sk-ping 1.8s cubic-bezier(0,0,.2,1) infinite; }
@media (prefers-reduced-motion: reduce) {
  .sk-reveal { opacity: 1; transform: none; transition: none; }
  .sk-float, .sk-float-slow, .sk-wave, .sk-buzz, .sk-tapme, .sk-scanline, .sk-shine::after, .sk-progress, .sk-spin, .sk-ping, .sk-nudge, .sk-bob, .sk-cell-now { animation: none; }
  .sk-flip-card { transition: none; }
  .sk-swoosh path, .sk-draw { animation: none; stroke-dasharray: none; }
}
`;

export default function Landing() {
  useEffect(() => {
    document.documentElement.style.scrollBehavior = "smooth";
    return () => { document.documentElement.style.scrollBehavior = ""; };
  }, []);

  return (
    <div className="sk-site min-h-screen [overflow-x:clip] bg-[var(--bg)] font-sans text-[var(--ink)] antialiased selection:bg-[#F2B33A] selection:text-[#231A2C]">
      <style>{STYLES}</style>
      <Translated>
      <Nav />
      <main>
        <Hero />
        <PainSwitch />
        <OneMoreRound />
        <Tour />
        <Owners />
        <Prices />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
      <BookDemo />
      </Translated>
    </div>
  );
}
