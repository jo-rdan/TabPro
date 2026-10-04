import { useEffect, useRef, useState, ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  X,
  ArrowUpRight,
  Plus,
  Minus,
  QrCode,
  UtensilsCrossed,
  Hand,
  Wallet,
  Smartphone,
  LayoutDashboard,
  Sparkles,
} from "lucide-react";
import Logo from "../components/Logo";
import BookDemo, { openBookDemo } from "./landing/BookDemo";
import {
  PhoneFrame,
  ScreenScan,
  ScreenMenu,
  ScreenCall,
  ScreenPay,
  RevenueWidget,
  HeatmapWidget,
  LeaderboardWidget,
  PayoutWidget,
  MenuPhotoWidget,
  OrderFeed,
} from "./landing/mockups";

// Legal name only: contact goes through "Book a demo", not public numbers.
const COMPANY = {
  legalName: "VNT250 Ltd",
};

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

// ─── Scroll reveal ────────────────────────────────────────────────────────────

function useInView<T extends HTMLElement>(threshold = 0.2) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setInView(true);
        io.disconnect();
      }
    }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return { ref, inView };
}

function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const { ref, inView } = useInView<HTMLDivElement>(0.15);
  return (
    <div ref={ref} className={`lp-reveal ${inView ? "is-in" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

function Eyebrow({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${dark ? "bg-white/[0.06] text-emerald-300 ring-1 ring-white/10" : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dark ? "bg-emerald-300" : "bg-emerald-500"}`} />
      {children}
    </span>
  );
}

const Serif = ({ children }: { children: ReactNode }) => <span className="lp-serif font-normal italic">{children}</span>;

// ─── Nav ──────────────────────────────────────────────────────────────────────

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
    <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled ? "bg-[#06140f]/80 py-3 shadow-[0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl" : "py-5"}`}>
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 sm:px-8">
        <a href="/" className="flex items-center gap-2.5">
          <Logo size={32} />
          <span className="text-[17px] font-extrabold tracking-tight text-white">TabPro</span>
        </a>
        <div className="hidden items-center gap-1 rounded-full bg-white/[0.04] p-1 ring-1 ring-white/10 md:flex">
          {[["Product", "#tour"], ["For owners", "#owners"], ["Pricing", "#pricing"], ["FAQ", "#faq"]].map(([l, h]) => (
            <a key={l} href={h} className="rounded-full px-4 py-1.5 text-[13px] font-medium text-white/70 transition hover:bg-white/10 hover:text-white">{l}</a>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Link to={loggedIn ? "/dashboard" : "/login"} className="hidden rounded-full px-4 py-2 text-[13px] font-semibold text-white/80 transition hover:text-white sm:block">
            {loggedIn ? "Dashboard" : "Log in"}
          </Link>
          <button onClick={openBookDemo} className="rounded-full bg-white px-4 py-2 text-[13px] font-bold text-gray-900 transition hover:bg-emerald-100">
            Book a demo
          </button>
        </div>
      </nav>
    </header>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#06140f] pt-32 sm:pt-40">
      <div className="lp-aurora pointer-events-none absolute left-1/2 top-[-20%] h-[900px] w-[1400px] -translate-x-1/2" />
      <div className="lp-grid pointer-events-none absolute inset-0" />
      <div className="lp-grain pointer-events-none absolute inset-0" />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <Reveal>
            <a href="#tour" className="group inline-flex items-center gap-2 rounded-full bg-white/[0.05] py-1 pl-1 pr-3 text-[12.5px] text-white/70 ring-1 ring-white/10 transition hover:ring-white/25">
              <span className="rounded-full bg-emerald-400 px-2 py-0.5 text-[11px] font-bold text-emerald-950">New</span>
              MTN MoMo & Airtel Money, right at the table
              <ArrowRight size={13} className="transition group-hover:translate-x-0.5" />
            </a>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="mt-7 text-[44px] font-extrabold leading-[0.98] tracking-[-0.04em] text-balance text-white sm:text-7xl lg:text-[88px]">
              The whole night,
              <br />
              <Serif>
                <span className="bg-gradient-to-r from-emerald-200 via-emerald-300 to-lime-200 bg-clip-text text-transparent">settled at the table.</span>
              </Serif>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mx-auto mt-7 max-w-2xl text-[17px] leading-relaxed text-white/60 sm:text-lg">
              Guests order and pay with Mobile Money from their own phone. You see every table, order and payment as it
              happens — and run your venue from anywhere.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button onClick={openBookDemo} className="lp-shine group relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-emerald-400 px-7 py-4 text-[15px] font-bold text-emerald-950 shadow-[0_10px_40px_-8px_rgba(52,211,153,0.6)] transition hover:bg-emerald-300 sm:w-auto">
                Book a free demo
                <ArrowRight size={17} className="transition group-hover:translate-x-1" />
              </button>
              <a href="#tour" className="inline-flex w-full items-center justify-center gap-2 rounded-full px-7 py-4 text-[15px] font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/5 sm:w-auto">
                Watch it work
              </a>
            </div>
            <p className="mt-6 text-[12.5px] text-white/40">Free to set up · No app to download · No hardware</p>
          </Reveal>
        </div>

        {/* Product composition */}
        <Reveal delay={320} className="relative mx-auto mt-20 max-w-5xl">
          <div className="relative flex items-end justify-center gap-6">
            {/* Owner dashboard card */}
            <div className="absolute left-0 top-16 hidden w-[340px] rotate-[-5deg] rounded-3xl bg-white p-5 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)] lg:block lp-float-slow">
              <div className="mb-4 flex items-center gap-2 text-[11px] font-bold text-gray-400"><LayoutDashboard size={13} /> OWNER DASHBOARD</div>
              <RevenueWidget active />
            </div>
            {/* Customer phone */}
            <PhoneFrame className="relative z-10 h-[600px] w-[292px] translate-y-10">
              <ScreenMenu />
            </PhoneFrame>
            {/* Waiter feed */}
            <div className="absolute right-0 top-24 hidden w-[330px] rotate-[4deg] rounded-3xl bg-[#f3f5f3] p-4 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)] lg:block lp-float">
              <div className="mb-3 flex items-center gap-2 text-[11px] font-bold text-gray-400"><Smartphone size={13} /> WAITER · LIVE ORDERS</div>
              <OrderFeed />
            </div>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-40 bg-gradient-to-t from-[#06140f] to-transparent" />
        </Reveal>
      </div>
    </section>
  );
}

// ─── Marquee ──────────────────────────────────────────────────────────────────

function Marquee() {
  const items = ["Scan the table", "Order from your phone", "Call the waiter", "Pay with MoMo", "Pay with Airtel Money", "Rate the night", "Venue paid in seconds"];
  const row = [...items, ...items];
  return (
    <div className="relative overflow-hidden border-y border-white/[0.06] bg-[#06140f] py-6">
      <div className="lp-marquee flex w-max gap-12">
        {row.map((t, i) => (
          <span key={i} className="flex items-center gap-12 whitespace-nowrap text-[15px] font-semibold text-white/35">
            {t}
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/60" />
          </span>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#06140f]" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#06140f]" />
    </div>
  );
}

// ─── Before / after ───────────────────────────────────────────────────────────

function BeforeAfter() {
  const without = [
    "Guests wave for 10 minutes to order a second round",
    "Orders scribbled on paper — and sometimes forgotten",
    "“Did table 6 pay?” Screenshots of MoMo SMS at the door",
    "Tabs walk out when it gets busy",
    "You only know how the night went at closing",
  ];
  const withTp = [
    "Guests order the moment they want another round",
    "Every order lands on the right waiter's phone",
    "Payment confirmed automatically — the tab closes itself",
    "Every bill is tracked from first order to payment",
    "Revenue, tables and ratings live, from anywhere",
  ];
  return (
    <section className="bg-[#f6f5f0] py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal className="mx-auto max-w-3xl text-center">
          <Eyebrow>Why TabPro</Eyebrow>
          <h2 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-[-0.035em] text-balance text-gray-950 sm:text-6xl">
            Friday night, <Serif>two ways.</Serif>
          </h2>
        </Reveal>
        <div className="mt-16 grid gap-5 lg:grid-cols-2">
          <Reveal>
            <div className="h-full rounded-[2rem] bg-white p-8 ring-1 ring-black/[0.06] sm:p-10">
              <p className="text-[13px] font-bold uppercase tracking-[0.15em] text-gray-400">Without TabPro</p>
              <ul className="mt-7 space-y-5">
                {without.map((t) => (
                  <li key={t} className="flex gap-4 text-[16px] leading-snug text-gray-500">
                    <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gray-100"><X size={13} className="text-gray-400" /></span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="relative h-full overflow-hidden rounded-[2rem] bg-[#06140f] p-8 sm:p-10">
              <div className="lp-aurora-sm pointer-events-none absolute -right-24 -top-24 h-80 w-80" />
              <p className="relative text-[13px] font-bold uppercase tracking-[0.15em] text-emerald-300">With TabPro</p>
              <ul className="relative mt-7 space-y-5">
                {withTp.map((t) => (
                  <li key={t} className="flex gap-4 text-[16px] font-medium leading-snug text-white">
                    <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-400"><Check size={13} strokeWidth={3} className="text-emerald-950" /></span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// ─── Product tour ─────────────────────────────────────────────────────────────

const STEPS = [
  { icon: QrCode, title: "Scan", text: "Every table gets a TabPro sticker. Guests scan it with their camera and the menu opens instantly — no app, no account.", screen: ScreenScan },
  { icon: UtensilsCrossed, title: "Order", text: "They browse your menu and order round after round. Each order goes straight to the waiter serving that table.", screen: ScreenMenu },
  { icon: Hand, title: "Call", text: "Need something? One tap calls the waiter. Guests see their orders go from preparing to delivered.", screen: ScreenCall },
  { icon: Wallet, title: "Pay", text: "The bill is itemised on their phone. They approve with their MoMo PIN — the tab closes and the venue is paid automatically.", screen: ScreenPay },
];

function ProductTour() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const { ref, inView } = useInView<HTMLDivElement>(0.3);
  useEffect(() => {
    if (!inView || paused) return;
    const t = setTimeout(() => setActive((a) => (a + 1) % STEPS.length), 4200);
    return () => clearTimeout(t);
  }, [active, inView, paused]);
  const Screen = STEPS[active].screen;

  return (
    <section id="tour" className="scroll-mt-16 bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal>
          <Eyebrow>For your guests</Eyebrow>
          <h2 className="mt-5 max-w-2xl text-4xl font-extrabold leading-[1.05] tracking-[-0.035em] text-balance text-gray-950 sm:text-6xl">
            From <Serif>“excuse me”</Serif> to paid, in four taps.
          </h2>
        </Reveal>
      </div>
      <div ref={ref} className="mx-auto mt-12 grid max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-[1fr_auto] lg:gap-16">
        <div>
          <div className="space-y-3">
            {STEPS.map(({ icon: Icon, title, text }, i) => {
              const on = i === active;
              return (
                <button
                  key={title}
                  onClick={() => { setActive(i); setPaused(true); }}
                  className={`group relative w-full overflow-hidden rounded-3xl p-6 text-left transition-all duration-300 ${on ? "bg-[#f6f5f0] ring-1 ring-black/[0.06]" : "hover:bg-gray-50"}`}
                >
                  <div className="flex items-start gap-5">
                    <span className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl transition ${on ? "bg-[#06140f] text-emerald-300" : "bg-gray-100 text-gray-400 group-hover:text-gray-600"}`}>
                      <Icon size={21} />
                    </span>
                    <div>
                      <p className={`text-[19px] font-extrabold tracking-tight ${on ? "text-gray-950" : "text-gray-400"}`}>
                        <span className="mr-2 text-[13px] font-bold text-emerald-600">0{i + 1}</span>{title}
                      </p>
                      <div className={`grid transition-all duration-500 ${on ? "mt-2 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                        <p className="overflow-hidden text-[15px] leading-relaxed text-gray-600">{text}</p>
                      </div>
                    </div>
                  </div>
                  {on && !paused && inView && <span key={active} className="lp-progress absolute bottom-0 left-0 h-[3px] bg-emerald-500" />}
                </button>
              );
            })}
          </div>
        </div>
        <div className="relative order-first mx-auto lg:order-none">
          <div className="lp-aurora-sm pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 opacity-60" />
          <PhoneFrame className="relative h-[560px] w-[280px] sm:h-[620px] sm:w-[300px]">
            <div key={active} className="lp-screen h-full">
              <Screen />
            </div>
          </PhoneFrame>
        </div>
      </div>
    </section>
  );
}

// ─── Bento: owner features ────────────────────────────────────────────────────

function Card({ children, className = "", dark = false }: { children: ReactNode; className?: string; dark?: boolean }) {
  return (
    <div className={`group relative overflow-hidden rounded-[2rem] p-7 transition duration-500 hover:-translate-y-1 ${dark ? "bg-[#0b1f17] ring-1 ring-white/10" : "bg-white ring-1 ring-black/[0.06] hover:shadow-[0_30px_60px_-25px_rgba(6,20,15,0.25)]"} ${className}`}>
      {children}
    </div>
  );
}

function CardTitle({ title, text, dark = false }: { title: string; text: string; dark?: boolean }) {
  return (
    <div className="mt-6">
      <h3 className={`text-[19px] font-extrabold tracking-tight ${dark ? "text-white" : "text-gray-950"}`}>{title}</h3>
      <p className={`mt-1.5 text-[14.5px] leading-relaxed ${dark ? "text-white/55" : "text-gray-500"}`}>{text}</p>
    </div>
  );
}

function Owners() {
  const { ref, inView } = useInView<HTMLDivElement>(0.2);
  return (
    <section id="owners" className="scroll-mt-16 bg-[#f6f5f0] py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal className="grid gap-6 lg:grid-cols-2 lg:items-end">
          <div>
            <Eyebrow>For owners</Eyebrow>
            <h2 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-[-0.035em] text-balance text-gray-950 sm:text-6xl">
              Your venue, <Serif>in your pocket.</Serif>
            </h2>
          </div>
          <p className="max-w-lg text-[17px] leading-relaxed text-gray-500 lg:justify-self-end">
            Everything happening on the floor, as it happens — money, tables, staff and guests. Whether you're behind
            the bar or across town.
          </p>
        </Reveal>

        <div ref={ref} className="mt-14 grid gap-5 md:grid-cols-6">
          <Reveal className="md:col-span-4">
            <Card className="h-full">
              <RevenueWidget active={inView} />
              <CardTitle title="Live revenue" text="Tonight's takings update with every paid bill — no waiting for closing time to know how you did." />
            </Card>
          </Reveal>
          <Reveal delay={80} className="md:col-span-2">
            <Card dark className="h-full">
              <PayoutWidget />
              <CardTitle dark title="Paid in seconds" text="Your 92% lands on your Mobile Money the moment a guest pays." />
            </Card>
          </Reveal>
          <Reveal className="md:col-span-2">
            <Card className="h-full">
              <HeatmapWidget />
              <CardTitle title="Busy hours" text="Know your rush, day by day, and staff for it." />
            </Card>
          </Reveal>
          <Reveal delay={80} className="md:col-span-2">
            <Card className="h-full">
              <LeaderboardWidget />
              <CardTitle title="Waiter leaderboard" text="Guest ratings earn points. Great service gets seen." />
            </Card>
          </Reveal>
          <Reveal delay={160} className="md:col-span-2">
            <Card className="h-full">
              <MenuPhotoWidget />
              <CardTitle title="Menu from a photo" text="Snap your paper menu — TabPro builds the digital one." />
            </Card>
          </Reveal>
        </div>

        <Reveal className="mt-5">
          <div className="grid gap-px overflow-hidden rounded-[2rem] bg-black/[0.06] ring-1 ring-black/[0.06] sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Staff invites", "Add waiters by phone — they join from a WhatsApp link."],
              ["Auto table assignment", "Tables are shared out evenly across your team."],
              ["Shifts & clock-in", "Staff clock in by scanning your venue's sticker."],
              ["Guest ratings", "Food, service and overall — after every visit."],
            ].map(([t, d]) => (
              <div key={t} className="bg-white p-6">
                <p className="flex items-center gap-2 text-[15px] font-extrabold text-gray-950"><Check size={15} className="text-emerald-500" strokeWidth={3} />{t}</p>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-gray-500">{d}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── Pricing + calculator ─────────────────────────────────────────────────────

function Slider({ label, value, min, max, step, onChange, format }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format: (v: number) => string }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label className="block">
      <div className="flex items-baseline justify-between">
        <span className="text-[14px] font-semibold text-white/60">{label}</span>
        <span className="text-[17px] font-extrabold tabular-nums text-white">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="lp-range mt-3 w-full"
        style={{ background: `linear-gradient(90deg, #34d399 ${pct}%, rgba(255,255,255,0.12) ${pct}%)` }}
      />
    </label>
  );
}

function Pricing() {
  const [bill, setBill] = useState(8000);
  const [bills, setBills] = useState(40);
  const [nights, setNights] = useState(20);
  const volume = bill * bills * nights;
  return (
    <section id="pricing" className="scroll-mt-16 bg-[#06140f] py-24 sm:py-32">
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <div className="lp-aurora pointer-events-none absolute left-1/2 top-0 h-[600px] w-[1000px] -translate-x-1/2 opacity-40" />
        <Reveal className="relative mx-auto max-w-3xl text-center">
          <Eyebrow dark>Pricing</Eyebrow>
          <h2 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-[-0.035em] text-balance text-white sm:text-6xl">
            Free to use.
            <br />
            <Serif>We earn when you do.</Serif>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-balance text-[17px] leading-relaxed text-white/55">
            No setup fee. No monthly fee. No hardware. TabPro keeps 8% of bills paid through the app — the other 92% goes
            straight to your Mobile Money.
          </p>
        </Reveal>

        <Reveal delay={100} className="relative mx-auto mt-16 max-w-5xl">
          <div className="grid overflow-hidden rounded-[2rem] ring-1 ring-white/10 lg:grid-cols-[1.15fr_1fr]">
            <div className="space-y-8 bg-white/[0.03] p-8 backdrop-blur sm:p-10">
              <p className="text-[13px] font-bold uppercase tracking-[0.15em] text-emerald-300">Estimate your month</p>
              <Slider label="Average bill" value={bill} min={2000} max={50000} step={500} onChange={setBill} format={(v) => `${fmt(v)} RWF`} />
              <Slider label="Bills paid in-app per night" value={bills} min={5} max={300} step={5} onChange={setBills} format={(v) => `${v}`} />
              <Slider label="Open nights per month" value={nights} min={4} max={30} step={1} onChange={setNights} format={(v) => `${v}`} />
              <p className="text-[12px] text-white/35">An estimate to help you plan — not a guarantee of sales.</p>
            </div>
            <div className="flex flex-col justify-between bg-emerald-400 p-8 text-emerald-950 sm:p-10">
              <div>
                <p className="text-[14px] font-bold">Paid to you each month</p>
                <p className="mt-2 text-5xl font-extrabold tracking-[-0.04em] tabular-nums sm:text-6xl">
                  {fmt(volume * 0.92)}
                  <span className="ml-2 text-xl">RWF</span>
                </p>
                <div className="mt-8 space-y-3 border-t border-emerald-950/15 pt-6 text-[15px]">
                  <div className="flex justify-between"><span>Paid by guests in-app</span><span className="font-bold tabular-nums">{fmt(volume)} RWF</span></div>
                  <div className="flex justify-between"><span>TabPro fee (8%)</span><span className="font-bold tabular-nums">{fmt(volume * 0.08)} RWF</span></div>
                  <div className="flex justify-between"><span>Monthly subscription</span><span className="font-bold">0 RWF</span></div>
                </div>
              </div>
              <button onClick={openBookDemo} className="group mt-10 inline-flex items-center justify-center gap-2 rounded-full bg-[#06140f] px-6 py-4 text-[15px] font-bold text-white transition hover:bg-black">
                Book a free demo <ArrowRight size={16} className="transition group-hover:translate-x-1" />
              </button>
            </div>
          </div>
        </Reveal>

        <Reveal delay={150} className="relative mx-auto mt-10 grid max-w-5xl gap-4 text-[14px] text-white/60 sm:grid-cols-3">
          {["QR stickers for your tables", "Unlimited tables & waiters", "Free setup and training"].map((t) => (
            <p key={t} className="flex items-center justify-center gap-2"><Check size={16} className="text-emerald-400" strokeWidth={3} />{t}</p>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────

const FAQS = [
  { q: "Do guests need to install an app?", a: "No. They scan the QR code on the table with their phone camera and TabPro opens in the browser. It works on any smartphone." },
  { q: "Which payment methods are supported?", a: "MTN MoMo and Airtel Money. The guest approves the payment on their own phone with their PIN — TabPro never sees their PIN." },
  { q: "When do I receive my money?", a: "Your 92% is sent automatically to your venue's Mobile Money number as soon as the guest's payment is confirmed — usually within seconds." },
  { q: "What does it cost?", a: "Nothing to set up and no monthly fee. TabPro keeps 8% of bills paid through the app. If a guest pays another way, TabPro takes nothing." },
  { q: "Do I need special equipment?", a: "No hardware at all. Your waiters use their own phones, you use yours, and we provide the QR stickers for your tables." },
  { q: "How do I get started?", a: "Book a free demo on this page. We'll come to your venue and set up your menu, tables and waiters with you — usually in a single visit." },
];

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="scroll-mt-16 bg-white py-24 sm:py-32">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[0.8fr_1.2fr]">
        <Reveal>
          <Eyebrow>FAQ</Eyebrow>
          <h2 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-[-0.035em] text-balance text-gray-950 sm:text-5xl">
            Questions, <Serif>answered.</Serif>
          </h2>
          <p className="mt-5 max-w-sm text-[16px] leading-relaxed text-gray-500">
            Something else on your mind?{" "}
            <button onClick={openBookDemo} className="font-semibold text-emerald-700 underline decoration-emerald-300 underline-offset-4 hover:decoration-emerald-600">
              Ask us during a free demo
            </button>
            .
          </p>
        </Reveal>
        <Reveal delay={100}>
          <div className="divide-y divide-gray-100 border-y border-gray-100">
            {FAQS.map((f, i) => {
              const on = open === i;
              return (
                <div key={f.q}>
                  <button onClick={() => setOpen(on ? null : i)} className="flex w-full items-center justify-between gap-6 py-6 text-left">
                    <span className="text-[17px] font-bold tracking-tight text-gray-950">{f.q}</span>
                    <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition ${on ? "bg-[#06140f] text-white" : "bg-gray-100 text-gray-500"}`}>
                      {on ? <Minus size={15} /> : <Plus size={15} />}
                    </span>
                  </button>
                  <div className={`grid transition-all duration-500 ${on ? "grid-rows-[1fr] pb-6 opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                    <p className="overflow-hidden pr-12 text-[15.5px] leading-relaxed text-gray-500">{f.a}</p>
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

// ─── Final CTA ────────────────────────────────────────────────────────────────

function FinalCta() {
  return (
    <section className="bg-white px-5 pb-24 sm:px-8">
      <Reveal>
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] bg-[#06140f] px-6 py-20 text-center sm:py-28">
          <div className="lp-aurora pointer-events-none absolute left-1/2 top-1/2 h-[700px] w-[1100px] -translate-x-1/2 -translate-y-1/2 opacity-70" />
          <div className="lp-grid pointer-events-none absolute inset-0" />
          <div className="relative">
            <Sparkles size={26} className="mx-auto text-emerald-300" />
            <h2 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold leading-[1.02] tracking-[-0.04em] text-balance text-white sm:text-7xl">
              Make tonight <Serif>easier.</Serif>
            </h2>
            <p className="mx-auto mt-6 max-w-lg text-[17px] leading-relaxed text-white/55">
              Tell us about your venue. We'll set up your menu, tables and team with you — free.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button onClick={openBookDemo} className="lp-shine group relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-emerald-400 px-8 py-4 text-[15px] font-bold text-emerald-950 transition hover:bg-emerald-300 sm:w-auto">
                Book a free demo <ArrowRight size={17} className="transition group-hover:translate-x-1" />
              </button>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

// ─── Footer (legal — required for payment-partner compliance) ─────────────────

function Footer() {
  return (
    <footer className="bg-[#06140f] text-white">
      {/* Sign-off: one confident line and a spinning "Book a demo" badge */}
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-10 border-b border-white/[0.06] px-5 py-16 sm:px-8 md:flex-row md:items-center">
        <div>
          <p className="flex items-center gap-2 text-[13px] font-semibold text-emerald-300/90">
            <span className="relative flex h-2 w-2">
              <span className="lp-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Now setting up venues in Kigali
          </p>
          <h2 className="mt-4 text-5xl font-extrabold leading-[0.95] tracking-[-0.045em] sm:text-7xl">
            Ready when <Serif>you are.</Serif>
          </h2>
        </div>
        <button onClick={openBookDemo} aria-label="Book a demo" className="group relative h-36 w-36 flex-shrink-0 rounded-full sm:h-40 sm:w-40">
          <svg viewBox="0 0 200 200" className="lp-spin absolute inset-0 h-full w-full" aria-hidden="true">
            <defs>
              <path id="lp-ring" d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0" />
            </defs>
            {/* textLength = the ring's circumference (2π·78), so the words close the loop exactly */}
            <text fill="rgba(255,255,255,0.75)" fontSize="15" fontWeight="700">
              <textPath href="#lp-ring" textLength="488" lengthAdjust="spacing">
                BOOK A DEMO · FREE SETUP · BOOK A DEMO · FREE SETUP ·
              </textPath>
            </text>
          </svg>
          <span className="absolute inset-[30%] flex items-center justify-center rounded-full bg-emerald-400 text-emerald-950 shadow-[0_10px_40px_-6px_rgba(52,211,153,0.7)] transition duration-300 group-hover:scale-110 group-hover:bg-emerald-300">
            <ArrowUpRight size={26} strokeWidth={2.5} className="transition duration-300 group-hover:rotate-45" />
          </span>
        </button>
      </div>

      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-14 sm:px-8 md:grid-cols-[2fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <Logo size={30} />
            <span className="text-[17px] font-extrabold tracking-tight">TabPro</span>
          </div>
          <p className="mt-5 max-w-sm text-[14px] leading-relaxed text-white/50">
            TabPro is a product of <span className="font-semibold text-white/80">{COMPANY.legalName}</span>, a company
            registered in Rwanda.
          </p>
        </div>
        <div>
          <p className="text-[13px] font-bold uppercase tracking-[0.15em] text-white/40">Legal & access</p>
          <ul className="mt-5 space-y-3 text-[14px] text-white/70">
            <li><a className="hover:text-emerald-300" href="/terms.html">Terms & Conditions</a></li>
            <li><a className="hover:text-emerald-300" href="/privacy.html">Privacy Policy</a></li>
            <li><Link className="hover:text-emerald-300" to="/login">Owner login</Link></li>
            <li><Link className="hover:text-emerald-300" to="/waiter">Waiter login</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-6 text-[12.5px] text-white/35 sm:flex-row sm:justify-between sm:px-8">
          <span>© {new Date().getFullYear()} {COMPANY.legalName}. All rights reserved.</span>
          <span>TabPro is operated by {COMPANY.legalName}.</span>
        </div>
      </div>
    </footer>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const STYLES = `
.lp-root { font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
.lp-serif { font-family: 'Instrument Serif', Georgia, serif; letter-spacing: -0.01em; }
.lp-reveal { opacity: 0; transform: translateY(28px); transition: opacity .9s cubic-bezier(.2,.7,.2,1), transform .9s cubic-bezier(.2,.7,.2,1); }
.lp-reveal.is-in { opacity: 1; transform: none; }
.lp-aurora { background: radial-gradient(closest-side, rgba(29,158,117,.55), transparent 70%), radial-gradient(closest-side at 70% 40%, rgba(163,230,53,.18), transparent 70%); filter: blur(40px); }
.lp-aurora-sm { background: radial-gradient(closest-side, rgba(52,211,153,.35), transparent 70%); filter: blur(30px); }
.lp-grid { background-image: linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.045) 1px, transparent 1px); background-size: 64px 64px; mask-image: radial-gradient(ellipse at 50% 30%, black 20%, transparent 70%); -webkit-mask-image: radial-gradient(ellipse at 50% 30%, black 20%, transparent 70%); }
.lp-grain { opacity: .08; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }
@keyframes lp-float { 0%,100% { transform: translateY(0) rotate(4deg) } 50% { transform: translateY(-14px) rotate(4deg) } }
@keyframes lp-float-slow { 0%,100% { transform: translateY(0) rotate(-5deg) } 50% { transform: translateY(-12px) rotate(-5deg) } }
.lp-float { animation: lp-float 7s ease-in-out infinite; }
.lp-float-slow { animation: lp-float-slow 8s ease-in-out infinite; }
@keyframes lp-marquee { to { transform: translateX(-50%) } }
.lp-marquee { animation: lp-marquee 38s linear infinite; }
@keyframes lp-scan { 0%,100% { top: 12px } 50% { top: calc(100% - 14px) } }
.lp-scanline { animation: lp-scan 2.4s ease-in-out infinite; }
@keyframes lp-toast { from { opacity: 0; transform: translateY(-8px) scale(.98) } to { opacity: 1; transform: none } }
.lp-toast { animation: lp-toast .5s cubic-bezier(.2,.8,.2,1) both; }
@keyframes lp-pop { 0% { opacity: 0; transform: scale(.6) } 70% { transform: scale(1.06) } 100% { opacity: 1; transform: scale(1) } }
.lp-pop { animation: lp-pop .5s cubic-bezier(.2,.8,.2,1) both; }
@keyframes lp-screen { from { opacity: 0; transform: translateX(18px) } to { opacity: 1; transform: none } }
.lp-screen { animation: lp-screen .5s cubic-bezier(.2,.8,.2,1) both; }
@keyframes lp-progress { from { width: 0 } to { width: 100% } }
.lp-progress { animation: lp-progress 4.2s linear both; }
.lp-draw { stroke-dasharray: 600; stroke-dashoffset: 600; animation: lp-dash 1.8s ease-out forwards; }
@keyframes lp-dash { to { stroke-dashoffset: 0 } }
.lp-shine::after { content: ''; position: absolute; inset: 0; background: linear-gradient(110deg, transparent 35%, rgba(255,255,255,.45) 50%, transparent 65%); transform: translateX(-120%); animation: lp-shine 4.5s ease-in-out infinite; }
@keyframes lp-shine { 0%, 60% { transform: translateX(-120%) } 100% { transform: translateX(120%) } }
.lp-range { -webkit-appearance: none; appearance: none; height: 6px; border-radius: 999px; outline: none; }
.lp-range::-webkit-slider-thumb { -webkit-appearance: none; width: 22px; height: 22px; border-radius: 50%; background: #fff; box-shadow: 0 0 0 5px rgba(52,211,153,.35), 0 4px 10px rgba(0,0,0,.4); cursor: pointer; }
.lp-range::-moz-range-thumb { width: 22px; height: 22px; border: 0; border-radius: 50%; background: #fff; box-shadow: 0 0 0 5px rgba(52,211,153,.35); cursor: pointer; }
@keyframes lp-spin { to { transform: rotate(360deg) } }
.lp-spin { animation: lp-spin 18s linear infinite; transform-origin: 50% 50%; }
button:hover > .lp-spin { animation-duration: 6s; }
@keyframes lp-ping { 75%, 100% { transform: scale(2.4); opacity: 0 } }
.lp-ping { animation: lp-ping 1.8s cubic-bezier(0,0,.2,1) infinite; }
@media (prefers-reduced-motion: reduce) {
  .lp-reveal { opacity: 1; transform: none; transition: none; }
  .lp-float, .lp-float-slow, .lp-marquee, .lp-scanline, .lp-shine::after, .lp-progress, .lp-spin, .lp-ping { animation: none; }
}
`;

export default function Landing() {
  useEffect(() => {
    document.documentElement.style.scrollBehavior = "smooth";
    return () => { document.documentElement.style.scrollBehavior = ""; };
  }, []);

  return (
    <div className="lp-root min-h-screen bg-white text-gray-950 antialiased selection:bg-emerald-300 selection:text-emerald-950">
      <style>{STYLES}</style>
      <Nav />
      <main>
        <Hero />
        <Marquee />
        <BeforeAfter />
        <ProductTour />
        <Owners />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
      <BookDemo />
    </div>
  );
}
