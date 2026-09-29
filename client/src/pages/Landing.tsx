import { useState } from "react";
import { Link } from "react-router-dom";
import {
  QrCode,
  Smartphone,
  Wallet,
  BarChart3,
  Clock,
  Star,
  Users,
  Camera,
  Bell,
  ShieldCheck,
  ArrowRight,
  Check,
  MessageCircle,
  ChevronDown,
  Zap,
} from "lucide-react";
import Logo from "../components/Logo";

// Legal and contact details — must match the RDB registration of VNT250 Ltd.
const COMPANY = {
  legalName: "VNT250 Ltd",
  tin: "156430843",
  address: "KG 31 St, Ngaruyinka, Murama, Kinyinya, Gasabo, Kigali, Rwanda",
  email: "iga.enterprise.ltd@gmail.com",
  phone: "+250 781 268 924",
  whatsapp: "https://wa.me/250781268924?text=Hi%20TabPro%2C%20I%27d%20like%20TabPro%20for%20my%20venue",
};

const STEPS = [
  { icon: QrCode, title: "Scan the table's QR", text: "Customers scan the sticker on the table. The menu opens in their browser — no app to download." },
  { icon: Smartphone, title: "Order from the phone", text: "They order rounds, call the waiter or ask for the bill with one tap. Your waiter is notified instantly." },
  { icon: Wallet, title: "Pay with Mobile Money", text: "MTN MoMo or Airtel Money, right from the bill. The tab closes itself once the payment is confirmed." },
];

const FEATURES = [
  { icon: BarChart3, title: "Live dashboard", text: "Tonight's revenue, active tables and pending orders — from anywhere." },
  { icon: Wallet, title: "Automatic payouts", text: "Your 92% share is sent to your Mobile Money number as soon as a customer pays." },
  { icon: Clock, title: "Busy-hours heatmap", text: "See exactly when you're busiest, day by day and hour by hour, to staff smarter." },
  { icon: Star, title: "Ratings & waiter points", text: "Customers rate food and service. Your best waiters rise on the leaderboard." },
  { icon: Users, title: "Staff & shifts", text: "Invite waiters by WhatsApp, share out tables automatically, track clock-ins." },
  { icon: Camera, title: "Menu from a photo", text: "Photograph your paper menu and TabPro turns it into a digital menu." },
];

const FAQS = [
  { q: "Do my customers need to install an app?", a: "No. They scan the QR code with their phone camera and TabPro opens in the browser. It works on any smartphone." },
  { q: "How much does TabPro cost?", a: "Setup and use are free — no monthly fee, no hardware. TabPro keeps an 8% service fee only on bills paid through the app; the other 92% goes straight to your Mobile Money." },
  { q: "Which payment methods are supported?", a: "MTN MoMo and Airtel Money. The customer approves the payment on their own phone with their PIN." },
  { q: "When do I receive my money?", a: "Your share is sent automatically to your venue's Mobile Money number as soon as the customer's payment is confirmed — usually within seconds." },
  { q: "What do I need to get started?", a: "Your menu, your waiters' phone numbers and a Mobile Money number for payouts. We give you the QR stickers and help you set up." },
];

function PhoneMockup() {
  return (
    <div className="relative mx-auto w-[260px] sm:w-[280px]">
      {/* Floating cards */}
      <div className="absolute -left-24 -top-5 z-20 hidden sm:flex items-center gap-2 rounded-2xl bg-white px-3.5 py-2.5 shadow-xl shadow-black/20 animate-[float_6s_ease-in-out_infinite]">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100"><Bell size={15} className="text-amber-600" /></span>
        <div>
          <p className="text-[11px] font-bold text-gray-900 leading-tight">Table 4 wants to pay</p>
          <p className="text-[10px] text-gray-500">just now</p>
        </div>
      </div>
      <div className="absolute -right-20 -bottom-6 z-20 hidden sm:flex items-center gap-2 rounded-2xl bg-white px-3.5 py-2.5 shadow-xl shadow-black/20 animate-[float_7s_ease-in-out_infinite_1s]">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100"><Check size={15} className="text-brand-600" /></span>
        <div>
          <p className="text-[11px] font-bold text-gray-900 leading-tight">+6,256 RWF payout</p>
          <p className="text-[10px] text-gray-500">sent to your MoMo</p>
        </div>
      </div>

      {/* Phone */}
      <div className="relative rounded-[2.6rem] bg-gray-900 p-2.5 shadow-2xl shadow-black/40 ring-1 ring-white/10">
        <div className="absolute left-1/2 top-2.5 z-10 h-5 w-24 -translate-x-1/2 rounded-b-2xl bg-gray-900" />
        <div className="overflow-hidden rounded-[2.1rem] bg-gray-50">
          <div className="bg-white px-4 pb-3 pt-7">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500 text-[11px] font-bold text-white">YB</span>
              <div>
                <p className="text-[13px] font-bold text-gray-900 leading-tight">Your Bar</p>
                <p className="text-[10px] text-gray-400">Table 4</p>
              </div>
            </div>
          </div>
          <div className="space-y-2 px-3 py-3">
            {[
              ["Primus", "2 × 1,500"],
              ["Brochette", "1 × 3,000"],
              ["Fanta", "1 × 800"],
            ].map(([name, qty]) => (
              <div key={name} className="flex items-center justify-between rounded-xl bg-white px-3 py-2.5 shadow-sm">
                <span className="text-[12px] font-semibold text-gray-800">{name}</span>
                <span className="text-[11px] text-gray-500">{qty}</span>
              </div>
            ))}
            <div className="flex items-center justify-between px-1 pt-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Total</span>
              <span className="text-[15px] font-black text-gray-900">6,800 RWF</span>
            </div>
          </div>
          <div className="px-3 pb-5">
            <div className="rounded-2xl bg-brand-500 py-3 text-center text-[12px] font-bold text-white shadow-lg shadow-brand-500/40">
              Pay with Mobile Money
            </div>
            <div className="mt-2.5 flex justify-center gap-1.5">
              <span className="rounded-full bg-yellow-300 px-2.5 py-0.5 text-[9px] font-bold text-gray-900">MTN MoMo</span>
              <span className="rounded-full bg-red-500 px-2.5 py-0.5 text-[9px] font-bold text-white">Airtel Money</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-200 py-4">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-4 text-left">
        <span className="text-[15px] font-semibold text-gray-900">{q}</span>
        <ChevronDown size={18} className={`flex-shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <p className="mt-2 pr-8 text-sm leading-relaxed text-gray-600">{a}</p>}
    </div>
  );
}

export default function Landing() {
  const loggedIn = !!localStorage.getItem("tabpro_token");

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 antialiased">
      <style>{`@keyframes float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-10px) } }`}</style>

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header className="absolute inset-x-0 top-0 z-30">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <a href="/" className="flex items-center gap-2.5">
            <Logo size={34} />
            <span className="text-lg font-extrabold tracking-tight text-white">TabPro</span>
          </a>
          <div className="hidden items-center gap-8 text-sm font-medium text-white/80 md:flex">
            <a href="#how" className="hover:text-white">How it works</a>
            <a href="#owners" className="hover:text-white">For venues</a>
            <a href="#pricing" className="hover:text-white">Pricing</a>
            <a href="#faq" className="hover:text-white">FAQ</a>
          </div>
          <Link
            to={loggedIn ? "/dashboard" : "/login"}
            className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/25 backdrop-blur transition hover:bg-white/20"
          >
            {loggedIn ? "Dashboard" : "Owner login"}
          </Link>
        </nav>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#063b2a] pb-20 pt-32 sm:pb-28 sm:pt-40">
        <div className="pointer-events-none absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-brand-500/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-48 right-0 h-[480px] w-[480px] rounded-full bg-emerald-300/10 blur-3xl" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "radial-gradient(white 1px, transparent 1px)", backgroundSize: "22px 22px" }}
        />

        <div className="relative mx-auto grid max-w-6xl items-center gap-16 px-5 lg:grid-cols-[1.1fr_1fr]">
          <div className="text-center lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-200 ring-1 ring-white/15">
              <Zap size={13} /> Made for bars & restaurants in Rwanda
            </span>
            <h1 className="mt-6 text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-6xl">
              Order and pay
              <br />
              <span className="bg-gradient-to-r from-emerald-300 to-lime-200 bg-clip-text text-transparent">from the table.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-emerald-50/80 sm:text-lg lg:mx-0">
              Customers scan a QR code, order from their phone and pay with MTN MoMo or Airtel Money. No waiting, no
              waving, no unpaid tabs — and a live view of your venue from anywhere.
            </p>
            <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <a
                href={COMPANY.whatsapp}
                target="_blank"
                rel="noreferrer"
                className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-500 px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-500/40 transition hover:bg-brand-600 sm:w-auto"
              >
                Get TabPro for your venue
                <ArrowRight size={16} className="transition group-hover:translate-x-0.5" />
              </a>
              <a
                href="#how"
                className="inline-flex w-full items-center justify-center rounded-full px-7 py-3.5 text-sm font-semibold text-white ring-1 ring-white/25 transition hover:bg-white/10 sm:w-auto"
              >
                See how it works
              </a>
            </div>
            <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs font-medium text-emerald-100/70 lg:justify-start">
              {["Free to set up", "No app download", "No hardware"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <Check size={14} className="text-emerald-300" /> {t}
                </span>
              ))}
            </div>
          </div>
          <PhoneMockup />
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────── */}
      <section id="how" className="scroll-mt-10 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-5">
          <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-brand-600">How it works</p>
          <h2 className="mx-auto mt-3 max-w-2xl text-center text-3xl font-extrabold tracking-tight sm:text-4xl">
            Three taps from sitting down to paid
          </h2>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <div key={title} className="relative rounded-3xl border border-gray-100 bg-gray-50/60 p-7 transition hover:-translate-y-1 hover:shadow-xl hover:shadow-gray-200/60">
                <span className="absolute right-6 top-5 text-5xl font-black text-gray-100">{i + 1}</span>
                <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500 text-white shadow-lg shadow-brand-500/30">
                  <Icon size={22} />
                </span>
                <h3 className="relative mt-5 text-lg font-bold">{title}</h3>
                <p className="relative mt-2 text-sm leading-relaxed text-gray-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── For owners ──────────────────────────────────────────────────── */}
      <section id="owners" className="scroll-mt-10 bg-gray-950 py-20 text-white sm:py-28">
        <div className="mx-auto max-w-6xl px-5">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">For venue owners</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
                Run a busier night with fewer surprises
              </h2>
              <p className="mt-5 text-base leading-relaxed text-gray-400">
                Faster service means more rounds. Automatic payment means fewer walk-outs. And for the first time, you
                can see what really happens in your venue — even when you're not there.
              </p>
              <a
                href={COMPANY.whatsapp}
                target="_blank"
                rel="noreferrer"
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-gray-900 transition hover:bg-emerald-50"
              >
                <MessageCircle size={16} /> Talk to us on WhatsApp
              </a>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-emerald-400/40 hover:bg-white/[0.07]">
                  <Icon size={20} className="text-emerald-400" />
                  <h3 className="mt-3 text-[15px] font-bold">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-gray-400">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────────── */}
      <section id="pricing" className="scroll-mt-10 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-5">
          <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-brand-600">Pricing</p>
          <h2 className="mx-auto mt-3 max-w-2xl text-center text-3xl font-extrabold tracking-tight sm:text-4xl">
            Free to use. We only earn when you do.
          </h2>
          <div className="mx-auto mt-12 max-w-3xl overflow-hidden rounded-3xl border border-gray-200 shadow-xl shadow-gray-200/60 md:grid md:grid-cols-2">
            <div className="bg-gradient-to-br from-brand-500 to-brand-700 p-8 text-white sm:p-10">
              <p className="text-sm font-semibold text-emerald-100">On every in-app payment</p>
              <div className="mt-4 flex items-end gap-2">
                <span className="text-6xl font-black leading-none">92%</span>
                <span className="pb-1.5 text-sm font-semibold text-emerald-100">to you</span>
              </div>
              <p className="mt-2 text-sm text-emerald-50/90">
                Sent automatically to your Mobile Money number, within seconds of the customer paying.
              </p>
              <div className="mt-6 border-t border-white/20 pt-5 text-sm text-emerald-50/90">
                <span className="font-bold text-white">8%</span> TabPro service fee — covers payments, the platform and support.
              </div>
            </div>
            <ul className="space-y-3.5 p-8 sm:p-10">
              {[
                "No setup fee, no monthly fee",
                "QR stickers for your tables",
                "Unlimited waiters and tables",
                "Live dashboard & reports",
                "Free setup help and training",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-gray-700">
                  <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand-100">
                    <Check size={12} className="text-brand-600" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <section id="faq" className="scroll-mt-10 bg-gray-50 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-5">
          <h2 className="text-center text-3xl font-extrabold tracking-tight sm:text-4xl">Questions</h2>
          <div className="mt-10">
            {FAQS.map((f) => (
              <Faq key={f.q} {...f} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <section className="px-5 py-20">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] bg-[#063b2a] px-8 py-14 text-center sm:px-14">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-500/30 blur-3xl" />
          <h2 className="relative text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Ready to try TabPro?</h2>
          <p className="relative mx-auto mt-4 max-w-lg text-emerald-50/80">
            Send us a message — we'll set up your menu, tables and waiters with you, free of charge.
          </p>
          <a
            href={COMPANY.whatsapp}
            target="_blank"
            rel="noreferrer"
            className="relative mt-8 inline-flex items-center gap-2 rounded-full bg-brand-500 px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-500/40 transition hover:bg-brand-600"
          >
            <MessageCircle size={16} /> Message us on WhatsApp
          </a>
        </div>
      </section>

      {/* ── Footer (legal) ──────────────────────────────────────────────── */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <Logo size={30} />
              <span className="text-base font-extrabold tracking-tight">TabPro</span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-gray-500">
              TabPro is a product of <span className="font-semibold text-gray-700">{COMPANY.legalName}</span>, a company
              registered in Rwanda (Company code / TIN {COMPANY.tin}).
            </p>
            <p className="mt-3 flex items-start gap-2 text-sm text-gray-500">
              <ShieldCheck size={16} className="mt-0.5 flex-shrink-0 text-brand-500" />
              Registered office: {COMPANY.address}
            </p>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">Contact</p>
            <ul className="mt-3 space-y-2 text-sm text-gray-500">
              <li><a className="hover:text-brand-600" href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a></li>
              <li><a className="hover:text-brand-600" href={`tel:${COMPANY.phone.replace(/\s/g, "")}`}>{COMPANY.phone}</a></li>
              <li><a className="hover:text-brand-600" href={COMPANY.whatsapp} target="_blank" rel="noreferrer">WhatsApp</a></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">Legal</p>
            <ul className="mt-3 space-y-2 text-sm text-gray-500">
              <li><a className="hover:text-brand-600" href="/terms.html">Terms & Conditions</a></li>
              <li><a className="hover:text-brand-600" href="/privacy.html">Privacy Policy</a></li>
              <li><Link className="hover:text-brand-600" to="/login">Owner login</Link></li>
              <li><Link className="hover:text-brand-600" to="/waiter">Waiter login</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-100 py-5 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} {COMPANY.legalName}. All rights reserved. TabPro is operated by {COMPANY.legalName}.
        </div>
      </footer>
    </div>
  );
}
