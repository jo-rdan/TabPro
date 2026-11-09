// Day and month names in dates and chart labels ("Mon 16 Nov", "Friday 20 Nov",
// "Wed 19h · 5 orders"), for one language.
type Names = { days: string[]; short: string[]; months: string[]; shortMonths: string[]; orders: (n: string) => string };

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const D = DAYS.join("|"), S = DAYS.map((d) => d.slice(0, 3)).join("|");
const M = MONTHS.join("|"), SM = MONTHS.map((m) => m.slice(0, 3)).join("|");

export function datePatterns(n: Names): [RegExp, (...a: string[]) => string][] {
  const day = (d: string) => n.days[DAYS.indexOf(d)];
  const sday = (d: string) => n.short[DAYS.findIndex((x) => x.startsWith(d))];
  const mon = (m: string) => n.months[MONTHS.indexOf(m)];
  const smon = (m: string) => n.shortMonths[MONTHS.findIndex((x) => x.startsWith(m))];
  return [
    [new RegExp(`^(${S}) (\\d+)h · (\\d+) orders?$`), (_, d, h, c) => `${sday(d)} ${h}h · ${n.orders(c)}`],
    [new RegExp(`^(${D}), (\\d+) (${M}) (\\d{4})$`), (_, d, x, m, y) => `${day(d)}, ${x} ${mon(m)} ${y}`],
    [new RegExp(`^(${D}) (\\d+) (${SM})$`), (_, d, x, m) => `${day(d)} ${x} ${smon(m)}`],
    [new RegExp(`^(${S}) (\\d+) (${SM})$`), (_, d, x, m) => `${sday(d)} ${x} ${smon(m)}`],
    [new RegExp(`^(${D}) (\\d\\d:\\d\\d)$`), (_, d, t) => `${day(d)} ${t}`],
    [new RegExp(`^(${S})$`), (_, d) => sday(d)],
  ];
}
