// Tonight's money as it builds up, hour by hour: a rust line over a honey
// fill, with a pulsing dot on "now".

interface MoneyTonightProps {
  hourly: { hour: string; cumulative: number }[];
}

const W = 640, H = 230, LEFT = 20, RIGHT = 620, TOP = 40, BOTTOM = 196;

// Smooth line through the points (Catmull-Rom turned into cubic curves).
function smooth(pts: [number, number][]) {
  if (pts.length === 0) return '';
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1y = Math.min(BOTTOM, Math.max(TOP - 10, p1[1] + (p2[1] - p0[1]) / 6));
    const c2y = Math.min(BOTTOM, Math.max(TOP - 10, p2[1] - (p3[1] - p1[1]) / 6));
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6} ${c1y} ${p2[0] - (p3[0] - p1[0]) / 6} ${c2y} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

export default function MoneyTonight({ hourly }: MoneyTonightProps) {
  // Always show at least 6 hours so "now" isn't glued to the right edge early on.
  const slots = Math.max(hourly.length + 1, 6);
  const step = (RIGHT - LEFT) / (slots - 1);
  const max = Math.max(...hourly.map((h) => h.cumulative), 1);
  const y = (v: number) => BOTTOM - (v / max) * (BOTTOM - TOP);
  const pts: [number, number][] = hourly.map((h, i) => [LEFT + i * step, y(h.cumulative)]);
  const line = smooth(pts);
  const last = pts[pts.length - 1];
  const lastValue = hourly[hourly.length - 1]?.cumulative ?? 0;
  const firstHour = Number(hourly[0]?.hour.slice(0, 2) ?? 17);
  const labelEvery = slots > 8 ? 2 : 1;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full h-[180px] block"
      role="img"
      aria-label={hourly.length ? `Money tonight: ${lastValue.toLocaleString()} RWF so far` : 'No money yet tonight'}
    >
      <defs>
        <linearGradient id="money-honey" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#D9A441" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#D9A441" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g className="stroke-gray-100 dark:stroke-gray-800" strokeWidth="1.5">
        {[TOP, (TOP + BOTTOM) / 2 - 18, BOTTOM - 36].map((ly) => <line key={ly} x1={LEFT} x2={RIGHT} y1={ly} y2={ly} />)}
      </g>
      {last && (
        <>
          <path key={`a${lastValue}`} className="money-area" d={`${line} L${last[0]} ${BOTTOM} L${LEFT} ${BOTTOM} Z`} fill="url(#money-honey)" />
          <path key={`l${lastValue}`} className="money-line" pathLength={1} d={line} fill="none" stroke="#A64B31" strokeWidth="4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <circle className="money-ring" cx={last[0]} cy={last[1]} r="9" fill="#A64B31" opacity="0.4" />
          <circle cx={last[0]} cy={last[1]} r="6" fill="#A64B31" />
          {lastValue > 0 && (
            <text
              x={last[0] > RIGHT - 90 ? last[0] - 12 : last[0] + 12}
              y={Math.max(last[1] + 22, TOP + 4)}
              textAnchor={last[0] > RIGHT - 90 ? 'end' : 'start'}
              className="fill-gray-900 dark:fill-white"
              fontSize="13"
              fontWeight="700"
            >
              {lastValue.toLocaleString()}
            </text>
          )}
        </>
      )}
      <g fontSize="13" className="fill-gray-500 dark:fill-gray-400">
        {Array.from({ length: slots }, (_, i) => {
          const isNow = i === hourly.length - 1;
          if (!isNow && i % labelEvery !== 0) return null;
          const x = LEFT + i * step;
          return (
            <text
              key={i}
              x={x}
              y={222}
              textAnchor={i === 0 ? 'start' : i === slots - 1 ? 'end' : 'middle'}
              className={isNow ? 'fill-gray-900 dark:fill-white' : undefined}
              fontWeight={isNow ? 700 : 400}
            >
              {isNow ? 'now' : `${String((firstHour + i) % 24).padStart(2, '0')}:00`}
            </text>
          );
        })}
      </g>
    </svg>
  );
}
