import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Minus } from "lucide-react";
import Logo from "../components/Logo";
import AnimatedLogo from "../components/AnimatedLogo";
import BookDemo, { openBookDemo } from "./landing/BookDemo";

// Legal name only: contact goes through "Book a demo", not public numbers.
const COMPANY = { legalName: "VNT250 Ltd" };

// Coffee & imigongo, light and dark. Every colour on the page reads these.
const STYLES = `
.sk-site { --bg:#F4EDE3; --card:#FFFCF7; --ink:#2B201B; --body:#5C4D44; --muted:#7A6A5F; --line:#E3D6C6; --rust:#A64B31; --rust-ink:#9A4129; }
.dark .sk-site { --bg:#1C1511; --card:#2B201B; --ink:#F4EDE3; --body:#D8CBBF; --muted:#A39282; --line:#463A32; --rust:#A64B31; --rust-ink:#DCA088; }
.sk-site h1, .sk-site h2, .sk-site h3 { font-family: 'Bricolage Grotesque', Figtree, sans-serif; }
@keyframes sk-rise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
@keyframes sk-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
.sk-rise { animation: sk-rise .8s cubic-bezier(.2,.7,.2,1) both; }
.sk-float { animation: sk-float 6s ease-in-out infinite; }
.sk-float-2 { animation: sk-float 7s ease-in-out 1s infinite; }
@media (prefers-reduced-motion: reduce) { .sk-rise, .sk-float, .sk-float-2 { animation: none; } }
`;

function Header() {
  const loggedIn = !!localStorage.getItem("tabpro_token");
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 16);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className={`sticky top-0 z-40 bg-[var(--bg)] transition-shadow ${scrolled ? "shadow-[0_1px_0_var(--line)]" : ""}`}>
      <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-4 py-4 sm:px-6 sm:py-5">
        <a href="/" className="flex items-center" aria-label="Skuzi home">
          <AnimatedLogo size={30} on="light" className="dark:hidden" />
          <AnimatedLogo size={30} on="dark" bg="#1C1511" className="hidden dark:inline-flex" />
        </a>
        <nav className="hidden gap-7 text-[15px] font-semibold md:flex">
          <a href="#how" className="hover:text-[var(--rust-ink)]">How it works</a>
          <a href="#owners" className="hover:text-[var(--rust-ink)]">For owners</a>
          <a href="#pricing" className="hover:text-[var(--rust-ink)]">Pricing</a>
        </nav>
        <div className="flex items-center gap-1 sm:gap-2.5">
          <Link to={loggedIn ? "/dashboard" : "/login"} className="px-3 py-2.5 text-[15px] font-semibold hover:text-[var(--rust-ink)]">
            {loggedIn ? "Dashboard" : "Log in"}
          </Link>
          <button onClick={openBookDemo} className="rounded-full bg-[var(--ink)] px-4 py-2.5 text-[15px] font-bold text-[var(--bg)] transition hover:opacity-90 sm:px-5 sm:py-3">
            Book a demo
          </button>
        </div>
      </div>
    </header>
  );
}

function HandTile({ size = 40 }: { size?: number }) {
  return <Logo size={size} />;
}

// The guest's phone, the waiter's call and the owner's night, in one picture.
function HeroPicture() {
  return (
    <div className="relative mx-auto h-[500px] w-full max-w-[460px] sm:h-[560px]">
      <div className="absolute inset-[30px_10px_0_40px] rounded-[48px] bg-[var(--rust)]" />
      <div className="absolute left-1/2 top-0 h-[500px] w-[250px] -translate-x-[58%] rounded-[44px] bg-[#2B201B] p-3 shadow-[0_40px_80px_-30px_rgba(43,32,27,0.6)] sm:h-[560px] sm:w-[280px]">
        <div className="flex h-full flex-col gap-3.5 rounded-[34px] bg-[#F4EDE3] px-[18px] py-[22px] text-[#2B201B]">
          <div className="flex items-center justify-between">
            <b className="font-display text-[20px]">Demo Lounge</b>
            <span className="text-[12px] font-bold text-[#7A6A5F]">Table 4</span>
          </div>
          {[["Goat brochette", "3,500 RWF"], ["Primus 72cl", "1,500 RWF"], ["Fanta", "800 RWF"]].map(([n, p]) => (
            <div key={n} className="flex items-center justify-between rounded-[18px] bg-[#FFFCF7] p-3.5">
              <div><b className="text-[15px]">{n}</b><p className="mt-0.5 text-[13px] text-[#7A6A5F]">{p}</p></div>
              <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[#A64B31] font-extrabold text-[#F4EDE3]">+</span>
            </div>
          ))}
          <div className="mt-1 flex flex-col gap-2.5">
            <span className="rounded-2xl bg-[#D9A441] p-3.5 text-center text-[15px] font-extrabold">Skuzi! Call my waiter</span>
            <span className="rounded-2xl bg-[#2B201B] p-3.5 text-center text-[15px] font-bold text-[#F4EDE3]">Pay 6,500 RWF with MoMo</span>
          </div>
        </div>
      </div>
      <div className="sk-float absolute right-0 top-[120px] flex w-[230px] items-center gap-3 rounded-[22px] bg-[#FFFCF7] p-4 text-[#2B201B] shadow-[0_24px_50px_-24px_rgba(43,32,27,0.45)]">
        <HandTile />
        <div><b className="text-[14px]">Skuzi! Table 4</b><p className="mt-0.5 text-[13px] text-[#5C4D44]">Eric, they're calling you</p></div>
      </div>
      <div className="sk-float-2 absolute -bottom-8 left-0 hidden w-[220px] sm:block rounded-[22px] bg-[#2B201B] p-4 text-[#F4EDE3] shadow-[0_24px_50px_-24px_rgba(0,0,0,0.5)] dark:ring-1 dark:ring-[#463A32]">
        <p className="text-[12px] text-[#D8CBBF]">Tonight so far</p>
        <b className="mt-1 block font-display text-[28px] tracking-[-0.02em]">248,500 <span className="text-[16px] text-[#D8CBBF]">RWF</span></b>
        <p className="mt-1 text-[12px] font-bold text-[#D9A441]">12 tables · 41 orders</p>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-12 px-4 pb-20 pt-8 sm:px-6 sm:pt-10">
      <div className="sk-rise min-w-0 flex-[1_1_520px]">
        <p className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-[var(--line)] bg-[var(--card)] px-3.5 py-2 text-[14px] font-bold">
          <span className="h-2 w-2 rounded-full bg-[#5E7A55]" />Now in Kigali bars and restaurants
        </p>
        <h1 className="mt-6 text-[52px] font-extrabold leading-[0.95] tracking-[-0.045em] sm:text-[72px] lg:text-[84px]">
          No more<br />waving for<br />the <span className="text-[var(--rust)] dark:text-[#DCA088]">waiter.</span>
        </h1>
        <p className="mt-6 max-w-[520px] text-[17px] leading-[1.55] text-[var(--body)] sm:text-[19px]">
          Guests scan the table, order, call and pay with Mobile Money from their phone. You see every table, order and franc, live, even when you're out.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button onClick={openBookDemo} className="rounded-full bg-[#A64B31] px-7 py-[18px] text-[17px] font-extrabold text-[#F4EDE3] transition hover:bg-[#933F28]">
            Book a free demo
          </button>
          <a href="#how" className="rounded-full border-2 border-[var(--ink)] px-6 py-4 text-[17px] font-bold transition hover:bg-[var(--card)]">
            See how it works
          </a>
        </div>
        <p className="mt-5 text-[14px] text-[var(--muted)]">Free setup · No app to download · No machine to buy</p>
      </div>
      <div className="sk-rise min-w-0 flex-[1_1_440px]" style={{ animationDelay: ".15s" }}>
        <HeroPicture />
      </div>
    </section>
  );
}

const STEPS = [
  { n: "1", title: "Order", text: "The menu opens on the guest's phone. No app to download, no waiting to catch an eye.", chip: "bg-[#A64B31] text-[#F4EDE3]" },
  { n: "2", title: "Skuzi!", text: "One tap calls their waiter. Only that waiter's phone buzzes, so the floor stays calm.", chip: "bg-[#D9A441] text-[#2B201B]" },
  { n: "3", title: "Pay", text: "MoMo or Airtel Money from the table. Your share lands on your phone seconds later.", chip: "bg-[#F4EDE3] text-[#2B201B]" },
];

function How() {
  return (
    <section id="how" className="scroll-mt-20 bg-[#2B201B] text-[#F4EDE3] dark:border-y dark:border-[#463A32]">
      <div className="mx-auto max-w-[1240px] px-4 py-20 sm:px-6">
        <h2 className="text-[38px] font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-[52px]">One scan. Three things, done.</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-[28px] bg-[#3A2D26] p-[30px]">
              <span className={`inline-flex h-11 w-11 items-center justify-center rounded-[14px] text-[20px] font-extrabold ${s.chip}`}>{s.n}</span>
              <h3 className="mb-2 mt-[18px] text-[26px] font-bold">{s.title}</h3>
              <p className="leading-[1.55] text-[#D8CBBF]">{s.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Owners() {
  return (
    <section id="owners" className="mx-auto flex max-w-[1240px] scroll-mt-20 flex-wrap items-center gap-12 px-4 py-20 sm:px-6 sm:py-[90px]">
      <div className="min-w-0 flex-[1_1_460px]">
        <p className="text-[14px] font-extrabold uppercase tracking-[0.14em] text-[var(--rust-ink)]">For owners</p>
        <h2 className="mt-3 text-[42px] font-extrabold leading-none tracking-[-0.035em] sm:text-[56px]">Your whole venue in your pocket.</h2>
        <p className="mt-5 max-w-[520px] text-[18px] leading-[1.6] text-[var(--body)]">
          Every table, order and payment as it happens. Who's serving well, which tables wait too long, what sells. From the bar or from home.
        </p>
      </div>
      <div className="grid min-w-0 flex-[1_1_460px] grid-cols-2 gap-4">
        <div className="rounded-3xl border-[1.5px] border-[var(--line)] bg-[var(--card)] p-[22px]">
          <p className="text-[13px] text-[var(--muted)]">Revenue tonight</p>
          <b className="mt-1.5 block font-display text-[32px]">248,500</b>
          <p className="mt-0.5 text-[13px] font-bold text-[#5E7A55] dark:text-[#A9BE9F]">RWF · 92% paid to you</p>
        </div>
        <div className="rounded-3xl border-[1.5px] border-[var(--line)] bg-[var(--card)] p-[22px]">
          <p className="text-[13px] text-[var(--muted)]">Tables open</p>
          <b className="mt-1.5 block font-display text-[32px]">12</b>
          <p className="mt-0.5 text-[13px] text-[var(--body)]">2 calling right now</p>
        </div>
        <div className="col-span-2 flex items-center justify-between gap-4 rounded-3xl bg-[#A64B31] p-[22px] text-[#F4EDE3]">
          <div>
            <b className="font-display text-[20px] sm:text-[22px]">Skuzi! Table 7 is calling</b>
            <p className="mt-1 text-[14px]">Grace's table · just now</p>
          </div>
          <span className="whitespace-nowrap rounded-full bg-[#2B201B] px-4 py-2.5 text-[14px] font-bold">Live</span>
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="mx-auto max-w-[1240px] scroll-mt-20 px-4 pb-20 sm:px-6 sm:pb-[90px]">
      <div className="flex flex-wrap items-center justify-between gap-8 rounded-[32px] bg-[#D9A441] p-8 text-[#2B201B] sm:rounded-[40px] sm:p-14">
        <div className="flex-[1_1_420px]">
          <h2 className="text-[38px] font-extrabold leading-none tracking-[-0.03em] sm:text-[52px]">You only pay when you get paid.</h2>
          <p className="mt-4 text-[18px] leading-[1.55]">
            8% of bills paid through Skuzi by Mobile Money. Cash is free. No monthly fee, no machine, free setup and training.
          </p>
        </div>
        <button onClick={openBookDemo} className="rounded-full bg-[#2B201B] px-8 py-5 text-[18px] font-extrabold text-[#F4EDE3] transition hover:bg-black">
          Book a free demo
        </button>
      </div>
    </section>
  );
}

const FAQS = [
  { q: "Do guests need to install an app?", a: "No. They scan the QR code on the table with their phone camera and Skuzi opens in the browser. It works on any smartphone." },
  { q: "Which payment methods are supported?", a: "MTN MoMo and Airtel Money. The guest approves the payment on their own phone with their PIN. Skuzi never sees their PIN." },
  { q: "When do I receive my money?", a: "Your 92% is sent automatically to your venue's Mobile Money number as soon as the guest's payment is confirmed, usually within seconds." },
  { q: "What does it cost?", a: "Nothing to set up and no monthly fee. Skuzi keeps 8% of bills paid through the app. If a guest pays another way, Skuzi takes nothing." },
  { q: "Do I need special equipment?", a: "No machine at all. Your waiters use their own phones, you use yours, and we provide the QR stickers for your tables." },
  { q: "How do I get started?", a: "Book a free demo on this page. We come to your venue and set up your menu, tables and waiters with you, usually in a single visit." },
];

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="mx-auto grid max-w-[1240px] scroll-mt-20 gap-10 px-4 pb-20 sm:px-6 sm:pb-[90px] lg:grid-cols-[0.8fr_1.2fr]">
      <div>
        <h2 className="text-[38px] font-extrabold leading-none tracking-[-0.03em] sm:text-[48px]">Questions, answered.</h2>
        <p className="mt-4 max-w-sm text-[16px] leading-relaxed text-[var(--body)]">
          Something else on your mind?{" "}
          <button onClick={openBookDemo} className="font-bold text-[var(--rust-ink)] underline underline-offset-4">Ask us during a free demo</button>.
        </p>
      </div>
      <div className="divide-y-[1.5px] divide-[var(--line)] border-y-[1.5px] border-[var(--line)]">
        {FAQS.map((f, i) => {
          const on = open === i;
          return (
            <div key={f.q}>
              <button onClick={() => setOpen(on ? null : i)} className="flex w-full items-center justify-between gap-6 py-5 text-left">
                <span className="text-[17px] font-bold">{f.q}</span>
                <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition ${on ? "bg-[var(--ink)] text-[var(--bg)]" : "bg-[var(--card)] text-[var(--muted)] ring-1 ring-[var(--line)]"}`}>
                  {on ? <Minus size={15} /> : <Plus size={15} />}
                </span>
              </button>
              <div className={`grid transition-all duration-500 ${on ? "grid-rows-[1fr] pb-5 opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                <p className="overflow-hidden pr-12 text-[15.5px] leading-relaxed text-[var(--body)]">{f.a}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// Imigongo band: the rust and espresso triangles of Rwandan cow-dung art.
function Imigongo() {
  return (
    <svg width="100%" height="26" aria-hidden="true" className="block">
      <defs>
        <pattern id="imi-web" width="34" height="26" patternUnits="userSpaceOnUse">
          <path d="M0 26L17 0L34 26Z" fill="#A64B31" />
          <path d="M9 26L17 13L25 26Z" fill="#2B201B" />
        </pattern>
      </defs>
      <rect width="100%" height="26" fill="url(#imi-web)" />
    </svg>
  );
}

// Legal footer: required for payment-partner compliance.
function Footer() {
  return (
    <footer className="bg-[#2B201B] text-[#D8CBBF]">
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-6 px-4 py-12 sm:px-6">
        <span className="font-display text-[38px] font-extrabold leading-none tracking-[-0.045em] text-[#F4EDE3]">skuzi</span>
        <span className="text-[14px]">Skuzi is a product of {COMPANY.legalName}, a company registered in Rwanda.</span>
      </div>
      <div className="border-t border-[#3A2D26]">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-4 px-4 py-6 text-[14px] sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            <a className="hover:text-[#D9A441]" href="/terms.html">Terms & Conditions</a>
            <a className="hover:text-[#D9A441]" href="/privacy.html">Privacy Policy</a>
            <Link className="hover:text-[#D9A441]" to="/login">Owner login</Link>
            <Link className="hover:text-[#D9A441]" to="/waiter">Waiter login</Link>
          </nav>
          <span className="text-[13px] text-[#A39282]">© {new Date().getFullYear()} {COMPANY.legalName}. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}

export default function Landing() {
  useEffect(() => {
    document.documentElement.style.scrollBehavior = "smooth";
    return () => { document.documentElement.style.scrollBehavior = ""; };
  }, []);

  return (
    <div className="sk-site min-h-screen overflow-x-hidden bg-[var(--bg)] font-sans text-[var(--ink)] antialiased selection:bg-[#D9A441] selection:text-[#2B201B]">
      <style>{STYLES}</style>
      <Header />
      <main>
        <Hero />
        <How />
        <Owners />
        <Pricing />
        <Faq />
      </main>
      <Imigongo />
      <Footer />
      <BookDemo />
    </div>
  );
}
