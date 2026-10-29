import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import Layout from "../../components/Layout";
import api from "../../lib/api";
import { useAuthStore } from "../../lib/auth";

// The night's report: sales, how it was paid, what's unpaid, best sellers and
// waiters. Bars close at 2am; that's when the owner gets "your report is
// ready". "Download PDF" uses the phone's own save-as-PDF.

interface Report {
  venueName: string;
  night: string;
  salesRwf: number;
  bills: number;
  averageBillRwf: number;
  paid: { momoRwf: number; cashRwf: number; otherRwf: number };
  unpaidRwf: number;
  unpaidBills: { tableLabel: string; totalRwf: number; openedAt: string }[];
  topItems: { name: string; quantity: number; salesRwf: number }[];
  waiters: { name: string; bills: number; salesRwf: number; tipsRwf: number }[];
  busiestHour: { hour: number; salesRwf: number } | null;
  food: { soldRwf: number; boughtRwf: number } | null;
}

const rwf = (n: number) => `${n.toLocaleString("en-US")} RWF`;
const shift = (night: string, days: number) => {
  const d = new Date(`${night}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const longDay = (night: string) =>
  new Date(`${night}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-gray-100 py-2 first:border-t-0 dark:border-gray-800 print:border-gray-200">
      <span className="text-sm text-gray-600 dark:text-gray-300 print:text-gray-700">{label}</span>
      <span className={`tabular-nums ${strong ? "text-base font-extrabold text-gray-900 dark:text-white print:text-black" : "text-sm font-bold text-gray-800 dark:text-gray-100 print:text-black"}`}>{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 print:break-inside-avoid print:border-gray-300 print:bg-white">
      <h2 className="mb-1 text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400 print:text-gray-600">{title}</h2>
      {children}
    </section>
  );
}

export default function NightReport() {
  const { venues, fetchMe } = useAuthStore();
  const venue = venues[0];
  useEffect(() => { if (!venue) fetchMe(); }, []);
  const [params, setParams] = useSearchParams();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const night = params.get("night") ?? "";

  useEffect(() => {
    if (!venue) return;
    setReport(null);
    setError("");
    api
      .get(`/dashboard/night-report/${venue.id}`, { params: night ? { night } : {} })
      .then((r) => setReport(r.data.data))
      .catch((e) => setError(e?.response?.data?.error ?? "Couldn't load the report."));
  }, [venue?.id, night]);

  const go = (days: number) => report && setParams({ night: shift(report.night, days) });
  const paidTotal = report ? report.paid.momoRwf + report.paid.cashRwf + report.paid.otherRwf : 0;

  return (
    <Layout>
      <div className="mx-auto max-w-2xl print:max-w-none">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-white print:text-black">Night report</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 print:text-gray-700">
              {report ? `${report.venueName} · ${longDay(report.night)} (06:00 to 06:00)` : venue?.name}
            </p>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <button onClick={() => go(-1)} disabled={!report} aria-label="Night before" className="rounded-xl border border-gray-200 p-2.5 text-gray-600 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300"><ChevronLeft size={18} /></button>
            <button onClick={() => go(1)} disabled={!report} aria-label="Night after" className="rounded-xl border border-gray-200 p-2.5 text-gray-600 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300"><ChevronRight size={18} /></button>
            <button onClick={() => window.print()} disabled={!report} className="flex items-center gap-1.5 rounded-xl bg-action px-4 py-2.5 text-sm font-extrabold text-action-ink disabled:opacity-50">
              <Download size={16} /> Download PDF
            </button>
          </div>
        </div>

        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
        {!report && !error && <div className="mt-5 h-64 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />}

        {report && (
          <div className="mt-5 flex flex-col gap-3">
            <div className="rounded-2xl bg-gray-900 p-5 text-white print:border print:border-gray-300 print:bg-white print:text-black">
              <p className="text-xs font-bold uppercase tracking-wider text-white/60 print:text-gray-600">Sales</p>
              <p className="mt-1 font-display text-4xl font-bold tabular-nums">{rwf(report.salesRwf)}</p>
              <p className="mt-1 text-sm text-white/80 print:text-gray-700">
                {report.bills} {report.bills === 1 ? "bill" : "bills"} · average {rwf(report.averageBillRwf)}
                {report.busiestHour && ` · busiest ${hh(report.busiestHour.hour)}–${hh((report.busiestHour.hour + 1) % 24)}`}
              </p>
            </div>

            {report.bills === 0 ? (
              <p className="rounded-2xl border border-gray-200 bg-white p-5 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900">No bills on Skuzi this night.</p>
            ) : (
              <>
                <Section title="How it was paid">
                  <Row label="📲 MoMo" value={rwf(report.paid.momoRwf)} />
                  <Row label="💵 Cash" value={rwf(report.paid.cashRwf)} />
                  {report.paid.otherRwf > 0 && <Row label="Other" value={rwf(report.paid.otherRwf)} />}
                  <Row label="Paid" value={rwf(paidTotal)} strong />
                  <Row label={`⚠️ Still unpaid (${report.unpaidBills.length})`} value={rwf(report.unpaidRwf)} strong />
                </Section>

                {report.unpaidBills.length > 0 && (
                  <Section title="Unpaid bills">
                    {report.unpaidBills.map((b, i) => (
                      <Row key={i} label={`${b.tableLabel} · opened ${new Date(b.openedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Kigali" })}`} value={rwf(b.totalRwf)} />
                    ))}
                  </Section>
                )}

                <Section title="Best sellers">
                  {report.topItems.map((it) => (
                    <Row key={it.name} label={`${it.quantity} × ${it.name}`} value={rwf(it.salesRwf)} />
                  ))}
                </Section>

                <Section title="Waiters">
                  {report.waiters.map((w) => (
                    <Row key={w.name} label={`${w.name} · ${w.bills} ${w.bills === 1 ? "bill" : "bills"}${w.tipsRwf ? ` · tips ${rwf(w.tipsRwf)}` : ""}`} value={rwf(w.salesRwf)} />
                  ))}
                </Section>

                {report.food && (
                  <Section title="Food stock">
                    <Row label="Food sold" value={rwf(report.food.soldRwf)} />
                    <Row label="Food bought" value={rwf(report.food.boughtRwf)} />
                    <Row label="Kept" value={rwf(report.food.soldRwf - report.food.boughtRwf)} strong />
                  </Section>
                )}
              </>
            )}
            <p className="text-center text-xs text-gray-400 print:text-gray-500">Skuzi · night of {longDay(report.night)}</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
