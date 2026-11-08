import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Gem, QrCode, UtensilsCrossed, Users } from "lucide-react";
import Layout from "../../components/Layout";
import LogoUploader from "../../components/LogoUploader";
import api from "../../lib/api";
import { useAuthStore } from "../../lib/auth";

// My venue: the set-up-once things in one place, Menu first. Each row opens
// the page it always was (Menu, Tables, Staff, Plan) with a way back here.

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default function MyVenue() {
  const { venues, fetchMe } = useAuthStore();
  const venue = venues[0];
  useEffect(() => { if (!venue) fetchMe(); }, []);
  const [menu, setMenu] = useState<{ total: number; soldOut: number } | null>(null);
  const [tables, setTables] = useState<number | null>(null);
  const [staff, setStaff] = useState<{ total: number; waiting: number } | null>(null);

  useEffect(() => {
    if (!venue) return;
    api.get(`/menu/${venue.id}`).then((r) => {
      const items: { isAvailable: boolean }[] = r.data.data.items;
      setMenu({ total: items.length, soldOut: items.filter((i) => !i.isAvailable).length });
    }).catch(() => {});
    api.get(`/tables/${venue.id}`).then((r) => setTables(r.data.data.length)).catch(() => {});
    api.get(`/staff/${venue.id}`).then((r) => {
      const list: { pendingApproval?: boolean }[] = r.data.data;
      setStaff({ total: list.filter((s) => !s.pendingApproval).length, waiting: list.filter((s) => s.pendingApproval).length });
    }).catch(() => {});
  }, [venue?.id]);

  const saveLogo = async (url: string) => {
    if (!venue) return;
    await api.patch(`/venues/${venue.id}/logo`, { logoUrl: url });
    await fetchMe();
  };

  const plan = venue?.planStatus;
  const planLine = !plan ? "" :
    plan.state === "trial" ? `${plan.planName} · trial, ${plural(plan.trialDaysLeft, "day", "days")} left` :
    plan.state === "paid" ? `${plan.planName} · paid, ${plural(plan.daysLeft, "day", "days")} left` :
    `${plan.planName} · not paid yet`;

  const rows = [
    { href: "/menu", icon: UtensilsCrossed, label: "Menu", accent: true,
      line: menu ? (menu.total === 0 ? "Add your drinks and food" : `${plural(menu.total, "item", "items")}${menu.soldOut ? ` · ${menu.soldOut} sold out` : ""}`) : "" },
    { href: "/tables", icon: QrCode, label: "Tables & stickers",
      line: tables === null ? "" : tables === 0 ? "Add your tables and stick the QR codes" : plural(tables, "table", "tables") },
    { href: "/staff", icon: Users, label: "Staff",
      line: staff ? (staff.total === 0 && !staff.waiting ? "Add your waiters" : plural(staff.total, "person", "people")) : "", waiting: staff?.waiting ?? 0 },
    { href: "/subscription", icon: Gem, label: "Plan", line: planLine, warn: plan?.state === "grace" || plan?.state === "locked" },
  ];

  return (
    <Layout>
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-white">My venue</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Set it up once. Come back only to change something.</p>

        {venue && (
          <div className="mt-5 flex items-center gap-4 rounded-2xl bg-gray-900 p-4 text-white dark:bg-[#3B2149]">
            <LogoUploader venueName={venue.name} currentLogoUrl={venue.logoUrl} onUploaded={saveLogo} size={56} hideButton />
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-xl font-bold">{venue.name}</p>
              <p className="text-sm text-white/70">
                {plan?.momoPayCode ? `MoMo Pay code ${plan.momoPayCode} ✓` : <Link to="/subscription" className="font-bold text-[#FFD966] underline">Add your MoMo Pay code</Link>}
              </p>
            </div>
          </div>
        )}

        <ul className="mt-4 divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-[#3B2149]">
          {rows.map(({ href, icon: Icon, label, line, accent, waiting, warn }) => (
            <li key={href}>
              <Link to={href} className="flex min-h-[72px] items-center gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5">
                <span className={`flex h-11 w-11 flex-none items-center justify-center rounded-xl ${accent ? "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300" : "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-200"}`}>
                  <Icon size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-gray-900 dark:text-white">{label}</span>
                  <span className={`block truncate text-sm ${warn ? "font-bold text-amber-700 dark:text-amber-300" : "text-gray-500 dark:text-gray-400"}`}>
                    {line || " "}
                    {!!waiting && <b className="text-brand-600 dark:text-brand-300"> · {waiting} waiting to join</b>}
                  </span>
                </span>
                <ChevronRight size={18} className="flex-none text-gray-400" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Layout>
  );
}
