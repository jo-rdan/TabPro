// Illustrated product screens for the website, in Skuzi's coffee & imigongo
// look. Pure presentation: no real data.
import { useEffect, useRef, useState, ReactNode } from "react";
import { Check, Plus, Search, Camera, ArrowRight, Star, Loader2, Bell, Users, Wallet } from "lucide-react";
import { WavingHand } from "../../components/Logo";

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

export function useInView<T extends HTMLElement>(threshold = 0.25) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setInView(true); io.disconnect(); }
    }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return { ref, inView };
}

export function useCountUp(target: number, run: boolean, ms = 1600) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run) return;
    let raf = 0;
    const from = v;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setV(from + (target - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, target, ms]);
  return v;
}

export function Hand({ size = 18, color = "currentColor", className = "" }: { size?: number; color?: string; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="8 4 90 92" className={className} aria-hidden="true">
      <WavingHand color={color} strokeWidth={7} />
    </svg>
  );
}

export function PhoneFrame({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative rounded-[2.9rem] bg-[#120E18] p-[10px] shadow-[0_50px_90px_-30px_rgba(0,0,0,0.7)] ring-1 ring-white/10 ${className}`}>
      <div className="absolute left-1/2 top-[10px] z-20 h-[24px] w-[104px] -translate-x-1/2 rounded-b-[16px] bg-[#120E18]" />
      <div className="relative h-full overflow-hidden rounded-[2.35rem] bg-[#F4F0F7] text-[#231A2C]">{children}</div>
    </div>
  );
}

function VenueHeader({ waiter = "Eric" }: { waiter?: string }) {
  return (
    <div className="rounded-b-[22px] bg-[#231A2C] px-4 pb-4 pt-9 text-[#F4F0F7]">
      <div className="flex items-center justify-between">
        <p className="font-display text-[16px] font-bold leading-tight">Your Place</p>
        <span className="rounded-full bg-[#F2B33A] px-2 py-0.5 text-[9px] font-extrabold text-[#231A2C]">Table 4</span>
      </div>
      <p className="mt-0.5 text-[10.5px] text-[#D3CADC]">{waiter} is your waiter</p>
    </div>
  );
}

// ─── Guest screens (product tour + hero) ─────────────────────────────────────

export function ScreenScan() {
  return (
    <div className="relative flex h-full flex-col items-center justify-center bg-[#1B1524]">
      <div className="absolute inset-0 opacity-60" style={{ background: "radial-gradient(circle at 50% 42%, rgba(242,179,58,.35) 0%, transparent 55%)" }} />
      <div className="relative h-44 w-44">
        {["left-0 top-0 border-l-4 border-t-4 rounded-tl-2xl", "right-0 top-0 border-r-4 border-t-4 rounded-tr-2xl", "left-0 bottom-0 border-l-4 border-b-4 rounded-bl-2xl", "right-0 bottom-0 border-r-4 border-b-4 rounded-br-2xl"].map((c) => (
          <span key={c} className={`absolute h-10 w-10 border-[#F2B33A] ${c}`} />
        ))}
        {/* The table sticker: a rust tile with the hand, as on real tables */}
        <div className="absolute inset-6 flex flex-col items-center justify-center gap-1 rounded-2xl bg-[#BF4A1A] shadow-xl">
          <Hand size={46} color="#F4F0F7" />
          <span className="font-display text-[13px] font-bold text-[#F4F0F7]">Scan me</span>
        </div>
        <span className="sk-scanline absolute inset-x-3 h-0.5 rounded-full bg-[#F2B33A] shadow-[0_0_16px_4px_rgba(242,179,58,0.7)]" />
      </div>
      <p className="relative mt-8 text-[12.5px] font-semibold text-[#F4F0F7]">Point your camera at the sticker</p>
      <p className="relative mt-1 text-[10.5px] text-[#9C90A8]">No app to download</p>
    </div>
  );
}

const MENU = [
  { name: "Primus", note: "Beer · 72cl", price: 1500, qty: 2 },
  { name: "Goat brochette", note: "Grill", price: 3500, qty: 1 },
  { name: "Fanta Citron", note: "Soft drink", price: 800, qty: 0 },
  { name: "Chips mayai", note: "Kitchen", price: 2500, qty: 0 },
];

/** The guest's menu. In the hero it's live: tap "Skuzi!" and the waiter's card buzzes. */
export function ScreenMenu({ onCall, called = false, compact = false }: { onCall?: () => void; called?: boolean; compact?: boolean }) {
  const [qty, setQty] = useState(MENU.map((m) => m.qty));
  const total = MENU.reduce((s, m, i) => s + m.price * qty[i], 0);
  const items = qty.reduce((a, b) => a + b, 0);
  return (
    <div className="flex h-full flex-col">
      <VenueHeader />
      <div className="px-3 pt-3">
        <div className="flex items-center gap-2 rounded-xl bg-[#FDFCFE] px-3 py-2 text-[11px] text-[#9C90A8] ring-1 ring-[#E2DCE8]">
          <Search size={12} /> Search the menu
        </div>
      </div>
      <div className="flex-1 space-y-2 overflow-hidden px-3 py-3">
        {MENU.slice(0, compact ? 3 : 4).map((m, i) => (
          <div key={m.name} className="flex items-center gap-3 rounded-2xl bg-[#FDFCFE] p-2.5 ring-1 ring-[#E2DCE8]">
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-bold">{m.name}</p>
              <p className="text-[10px] text-[#6F6379]">{m.note}</p>
              <p className="text-[11px] font-bold text-[#BF4A1A]">{fmt(m.price)} RWF</p>
            </div>
            <button
              type="button"
              aria-label={`Add ${m.name}`}
              onClick={() => setQty((q) => q.map((v, j) => (j === i ? v + 1 : v)))}
              className={`flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-[11px] font-bold transition active:scale-90 ${qty[i] ? "bg-[#231A2C] text-[#F4F0F7]" : "bg-[#BF4A1A] text-[#F4F0F7]"}`}
            >
              {qty[i] ? qty[i] : <Plus size={14} />}
            </button>
          </div>
        ))}
      </div>
      <div className="space-y-2 p-3">
        <button
          type="button"
          onClick={onCall}
          className={`relative flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-[13px] font-extrabold transition active:scale-[0.98] ${called ? "bg-[#5E7A55] text-[#F4F0F7]" : "bg-[#F2B33A] text-[#231A2C]"}`}
        >
          {called ? <><Check size={15} strokeWidth={3} /> Eric is on his way</> : <><Hand size={17} color="#231A2C" /> Skuzi!</>}
          {onCall && !called && <span className="sk-tapme absolute -right-1 -top-2 rounded-full bg-[#BF4A1A] px-2 py-0.5 text-[9px] font-extrabold text-[#F4F0F7]">Tap me</span>}
        </button>
        <div className="flex items-center justify-between rounded-2xl bg-[#BF4A1A] px-4 py-3 text-[#F4F0F7]">
          <span className="text-[12px] font-bold">Send order · {items} items</span>
          <span className="text-[12px] font-bold">{fmt(total)} RWF</span>
        </div>
      </div>
    </div>
  );
}

export function ScreenCall() {
  return (
    <div className="flex h-full flex-col">
      <VenueHeader />
      <div className="flex-1 space-y-2.5 px-3 py-3">
        <p className="px-1 text-[10px] font-bold uppercase tracking-wider text-[#6F6379]">Your orders</p>
        {[
          ["2 × Primus · Brochette", "Served", "bg-[#E4EADF] text-[#3F5A38]"],
          ["1 × Fanta Citron", "Preparing", "bg-[#231A2C] text-[#F4F0F7]"],
        ].map(([t, s, c]) => (
          <div key={t} className="flex items-center justify-between rounded-2xl bg-[#FDFCFE] p-3 ring-1 ring-[#E2DCE8]">
            <span className="text-[11.5px] font-semibold">{t}</span>
            <span className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold ${c}`}>{s}</span>
          </div>
        ))}
        <div className="sk-toast mx-1 mt-5 flex flex-col items-center rounded-3xl bg-[#F2B33A] px-4 py-5 text-center text-[#231A2C]">
          <span className="sk-wave inline-block"><Hand size={44} color="#231A2C" /></span>
          <p className="mt-2 font-display text-[18px] font-bold">Skuzi!</p>
          <p className="text-[11px] font-semibold">Eric knows. He'll be right with you.</p>
        </div>
      </div>
    </div>
  );
}

export function ScreenPay() {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDone(true), 1700);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="flex h-full flex-col">
      <VenueHeader />
      <div className="mx-3 mt-3 rounded-2xl bg-[#FDFCFE] p-4 ring-1 ring-[#E2DCE8]">
        {[["Primus", "2 × 1,500", "3,000"], ["Goat brochette", "1 × 3,500", "3,500"], ["Fanta Citron", "1 × 800", "800"]].map(([n, q, s]) => (
          <div key={n} className="flex justify-between py-1.5 text-[11.5px]">
            <span className="font-semibold">{n} <span className="font-normal text-[#9C90A8]">{q}</span></span>
            <span className="font-semibold">{s}</span>
          </div>
        ))}
        <div className="mt-2 flex items-end justify-between border-t border-dashed border-[#E2DCE8] pt-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#6F6379]">Total</span>
          <span className="font-display text-[20px] font-bold">7,300 <span className="text-[11px]">RWF</span></span>
        </div>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        {done ? (
          <div className="sk-pop flex flex-col items-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#5E7A55] text-[#F4F0F7] shadow-lg shadow-[#5E7A55]/40"><Check size={30} strokeWidth={3} /></span>
            <p className="mt-3 text-[14px] font-extrabold">Paid · 7,300 RWF</p>
            <p className="mt-1 text-[10.5px] text-[#6F6379]">Thank you! See you next time.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <Loader2 size={34} className="animate-spin text-[#BF4A1A]" />
            <p className="mt-3 text-[13px] font-extrabold">Approve on your phone</p>
            <p className="mt-1 text-[10.5px] text-[#6F6379]">Enter your MoMo PIN to confirm</p>
          </div>
        )}
      </div>
      <div className="flex justify-center gap-1.5 pb-6">
        <span className="rounded-full bg-[#ffcb05] px-2.5 py-1 text-[9px] font-extrabold text-[#231A2C]">MTN MoMo</span>
        <span className="rounded-full bg-[#e40000] px-2.5 py-1 text-[9px] font-extrabold text-white">Airtel Money</span>
      </div>
    </div>
  );
}

// ─── Hero side cards ─────────────────────────────────────────────────────────

/** The waiter's phone card: quiet, then buzzes when the guest taps Skuzi!. */
export function WaiterCall({ calling }: { calling: boolean }) {
  return (
    <div className={`w-[230px] rounded-[24px] p-4 shadow-[0_30px_60px_-25px_rgba(0,0,0,0.6)] transition-colors duration-300 ${calling ? "sk-buzz bg-[#BF4A1A] text-[#F4F0F7]" : "bg-[#FDFCFE] text-[#231A2C]"}`}>
      <p className={`text-[10px] font-bold uppercase tracking-[0.14em] ${calling ? "text-[#FCE3D3]" : "text-[#6F6379]"}`}>Eric's phone</p>
      {calling ? (
        <div className="mt-2 flex items-center gap-3">
          <span className="sk-wave inline-block"><Hand size={34} color="#F4F0F7" /></span>
          <div>
            <p className="font-display text-[17px] font-bold leading-tight">Skuzi! Table 4</p>
            <p className="text-[11.5px] text-[#FCE3D3]">would love a hand · now</p>
          </div>
        </div>
      ) : (
        <div className="mt-2 space-y-1.5">
          {[["Table 2", "2 × Mützig"], ["Table 7", "Brochette, chips"]].map(([t, d]) => (
            <div key={t} className="flex items-center justify-between rounded-xl bg-[#F4F0F7] px-3 py-2 text-[11.5px]">
              <b>{t}</b><span className="text-[#554A60]">{d}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Owner's "tonight so far": the number climbs and a little jar fills. */
export function TonightCard() {
  const { ref, inView } = useInView<HTMLDivElement>(0.3);
  const [target, setTarget] = useState(186500);
  useEffect(() => {
    if (!inView) return;
    const steps = [7300, 14500, 9000, 23000, 6800];
    let i = 0;
    const t = setInterval(() => { setTarget((v) => v + steps[i++ % steps.length]); }, 2600);
    return () => clearInterval(t);
  }, [inView]);
  const v = useCountUp(target, inView, 1200);
  const fill = Math.min(0.92, 0.35 + (v - 186500) / 300000);
  return (
    <div ref={ref} className="flex w-[240px] items-center gap-4 rounded-[24px] bg-[#231A2C] p-4 text-[#F4F0F7] shadow-[0_30px_60px_-25px_rgba(0,0,0,0.7)] ring-1 ring-white/10">
      <svg viewBox="0 0 40 56" className="h-14 w-10 flex-shrink-0" aria-hidden="true">
        <clipPath id="sk-jar"><rect x="4" y="8" width="32" height="44" rx="7" /></clipPath>
        <rect x="4" y={8 + 44 * (1 - fill)} width="32" height="44" fill="#F2B33A" clipPath="url(#sk-jar)" style={{ transition: "y .8s cubic-bezier(.2,.8,.2,1)" }} />
        <rect x="4" y="8" width="32" height="44" rx="7" fill="none" stroke="#F4F0F7" strokeOpacity=".5" strokeWidth="2" />
        <rect x="2" y="3" width="36" height="6" rx="3" fill="#F4F0F7" fillOpacity=".35" />
      </svg>
      <div>
        <p className="text-[11px] text-[#D3CADC]">Tonight so far</p>
        <p className="font-display text-[24px] font-bold leading-tight tabular-nums">{fmt(v)}</p>
        <p className="text-[11px] font-bold text-[#F2B33A]">RWF · on your phone</p>
      </div>
    </div>
  );
}

// ─── Owner widgets (bento) ───────────────────────────────────────────────────

export function MoneyWidget({ active }: { active: boolean }) {
  const v = useCountUp(248500, active);
  const pts = [4, 6, 5, 10, 14, 13, 22, 28, 34, 40, 47, 56];
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${(i / (pts.length - 1)) * 300} ${68 - p}`).join(" ");
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] font-semibold text-[var(--muted)]">Money tonight</p>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E4EADF] px-2 py-0.5 text-[11px] font-bold text-[#3F5A38]"><span className="h-1.5 w-1.5 rounded-full bg-[#5E7A55]" />Live</span>
      </div>
      <p className="mt-1 font-display text-[40px] font-bold tracking-tight tabular-nums">{fmt(v)} <span className="text-lg text-[var(--muted)]">RWF</span></p>
      <svg viewBox="0 0 300 70" className="mt-3 h-24 w-full" preserveAspectRatio="none" aria-hidden="true" style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id="sk-money" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#F2B33A" stopOpacity="0.5" />
            <stop offset="1" stopColor="#F2B33A" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${path} L 300 70 L 0 70 Z`} fill="url(#sk-money)" />
        <path d={path} fill="none" stroke="#BF4A1A" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" className={active ? "sk-draw" : "opacity-0"} pathLength={1} />
      </svg>
    </div>
  );
}

export function PayoutWidget() {
  return (
    <div className="space-y-2.5">
      {[
        ["Table 4 paid", "7,300 RWF", "Sent to your MoMo", "just now"],
        ["Table 9 paid", "14,500 RWF", "Sent to your MoMo", "4 min ago"],
        ["Table 2 paid", "9,000 RWF", "Sent to your MoMo", "11 min ago"],
      ].map(([t, a, s, w], i) => (
        <div key={t} className="flex items-center gap-3 rounded-2xl bg-white/[0.06] p-3 ring-1 ring-white/10" style={{ opacity: 1 - i * 0.22 }}>
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#5E7A55]/30"><Check size={16} className="text-[#A9BE9F]" /></span>
          <div className="min-w-0 flex-1">
            <p className="flex justify-between text-[12.5px] font-bold text-[#F4F0F7]"><span>{t}</span><span>{a}</span></p>
            <p className="flex justify-between gap-2 text-[10.5px] text-[#9C90A8]"><span className="truncate">{s}</span><span className="flex-shrink-0">{w}</span></p>
          </div>
        </div>
      ))}
    </div>
  );
}

const HEAT = ["#EFEBF2", "#FFE08A", "#F2B33A", "#D0561F", "#BF4A1A"];
export function HeatmapWidget() {
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  const lvl = (d: number, h: number) => {
    const weekend = d >= 4 ? 1.7 : 1;
    const evening = Math.exp(-Math.pow(h - 5, 2) / 5);
    return Math.min(4, Math.round(evening * weekend * (2 + ((d * 7 + h * 3) % 4) / 2)));
  };
  return (
    <div>
      <div className="space-y-1.5">
        {days.map((d, di) => (
          <div key={di} className="flex items-center gap-1.5">
            <span className="w-3 text-[9.5px] font-bold text-[var(--muted)]">{d}</span>
            {Array.from({ length: 9 }).map((_, h) => (
              <span key={h} className={`h-4 flex-1 rounded-[4px] ${di === 4 && h === 5 ? "sk-cell-now" : ""}`} style={{ background: HEAT[lvl(di, h)] }} />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between pl-4 text-[9px] font-semibold text-[var(--muted)]"><span>17h</span><span>21h</span><span>01h</span></div>
    </div>
  );
}

export function LeaderboardWidget() {
  return (
    <div className="space-y-2">
      {[["Alice", 312, 4.9, 100], ["Eric", 276, 4.7, 88], ["Grace", 241, 4.6, 77]].map(([n, p, r, w], i) => (
        <div key={n as string} className="flex items-center gap-3">
          <b className={`w-3 text-[13px] ${i === 0 ? "text-[#F2B33A]" : "text-[var(--muted)]"}`}>{i + 1}</b>
          <span className="w-12 text-[12.5px] font-bold">{n}</span>
          <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--line)]">
            <span className="sk-bar block h-full rounded-full" style={{ width: `${w}%`, background: i === 0 ? "#BF4A1A" : "var(--ink)", animationDelay: `${i * 0.15}s` }} />
          </span>
          <span className="flex w-9 items-center gap-0.5 text-[11px] font-semibold text-[var(--muted)]"><Star size={10} className="fill-[#F2B33A] text-[#F2B33A]" />{r}</span>
          <span className="w-12 text-right text-[12px] font-extrabold tabular-nums">{p} pts</span>
        </div>
      ))}
    </div>
  );
}

export function MenuPhotoWidget() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative w-[44%] rotate-[-4deg] rounded-lg bg-[#FAF8FC] p-3 text-[#231A2C] shadow-md ring-1 ring-black/5">
        <p className="text-center font-serif text-[11px] italic">— Menu —</p>
        {["Primus ....... 1500", "Mützig ....... 1800", "Brochette .... 3500", "Chips ........ 2000"].map((l) => (
          <p key={l} className="mt-1 font-mono text-[8.5px] text-[#554A60]">{l}</p>
        ))}
        <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[#231A2C] text-[#F4F0F7]"><Camera size={13} /></span>
      </div>
      <ArrowRight size={18} className="flex-shrink-0 text-[#BF4A1A]" />
      <div className="flex-1 space-y-1.5">
        {[["Primus", "1,500"], ["Mützig", "1,800"], ["Brochette", "3,500"]].map(([n, p]) => (
          <div key={n} className="flex justify-between rounded-lg bg-[var(--card)] px-2.5 py-1.5 text-[10.5px] ring-1 ring-[var(--line)]">
            <span className="font-bold">{n}</span>
            <span className="font-semibold text-[#BF4A1A]">{p}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Owner alerts that keep arriving: the "I know everything" feeling.
const ALERTS: [typeof Bell, string, string, string][] = [
  [Users, "Table 7", "Guests just sat down", "bg-[#EFEBF2] text-[#554A60]"],
  [Wallet, "Table 4 paid", "7,300 RWF · on your MoMo", "bg-[#E4EADF] text-[#3F5A38]"],
  [Bell, "Table 2 called Grace", "She's on her way", "bg-[#FFEDB8] text-[#7A5A16]"],
  [Users, "Table 9", "Guests just sat down", "bg-[#EFEBF2] text-[#554A60]"],
  [Wallet, "Table 1 paid", "14,500 RWF · on your MoMo", "bg-[#E4EADF] text-[#3F5A38]"],
];
export function AlertsWidget() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((x) => x + 1), 2400);
    return () => clearInterval(t);
  }, []);
  const rows = [0, 1, 2].map((i) => ALERTS[(n + i) % ALERTS.length]);
  return (
    <div className="space-y-2">
      {rows.map(([Icon, t, d, c], i) => (
        <div key={`${n}-${i}`} className={`flex items-center gap-3 rounded-2xl bg-[var(--card)] px-3 py-2.5 ring-1 ring-[var(--line)] ${i === 0 ? "sk-toast" : ""}`} style={{ opacity: 1 - i * 0.2 }}>
          <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl ${c}`}><Icon size={15} /></span>
          <div className="min-w-0">
            <p className="text-[12px] font-extrabold">{t}</p>
            <p className="truncate text-[11px] text-[var(--muted)]">{d}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
