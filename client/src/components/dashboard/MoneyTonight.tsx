import { useEffect, useRef, useState } from 'react';

// Tonight's money as it builds up, hour by hour: a rust line over a honey
// fill, with a pulsing dot on "now". Drawn at the card's real size, so lines
// and text never get stretched.

interface MoneyTonightProps {
  hourly: { hour: string; cumulative: number }[];
}

const H = 180;
const TOP = 26, BOTTOM = H - 30, LABEL_Y = H - 8;

// Smooth line through the points (Catmull-Rom turned into cubic curves),
// kept inside the chart so it never dips below zero.
function smooth(pts: [number, number][]) {
  if (pts.length === 0) return '';
  const clamp = (v: number) => Math.min(BOTTOM, Math.max(TOP - 8, v));
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6} ${clamp(p1[1] + (p2[1] - p0[1]) / 6)} ${p2[0] - (p3[0] - p1[0]) / 6} ${clamp(p2[1] - (p3[1] - p1[1]) / 6)} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

export default function MoneyTonight({ hourly }: MoneyTonightProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(600);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setW(Math.max(240, Math.round(el.clientWidth)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const left = 22, right = W - 22;
  // Always show at least 6 hours so "now" isn't glued to the right edge early on.
  const slots = Math.max(hourly.length + 1, 6);
  const step = (right - left) / (slots - 1);
  const max = Math.max(...hourly.map((h) => h.cumulative), 1);
  const y = (v: number) => BOTTOM - (v / max) * (BOTTOM - TOP);
  const pts: [number, number][] = hourly.map((h, i) => [left + i * step, y(h.cumulative)]);
  const line = smooth(pts);
  const last = pts[pts.length - 1];
  const lastValue = hourly[hourly.length - 1]?.cumulative ?? 0;
  const firstHour = Number(hourly[0]?.hour.slice(0, 2) ?? 17);
  // Fewer labels on narrow cards so they never collide.
  const labelEvery = step < 56 ? 2 : 1;
  const valueOnLeft = !!last && last[0] > right - 90;

  return (
    <div ref={boxRef} className="w-full">
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="block"
        role="img"
        aria-label={hourly.length ? `Money tonight: ${lastValue.toLocaleString()} RWF so far` : 'No money yet tonight'}
      >
        <defs>
          <linearGradient id="money-honey" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#D9A441" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#D9A441" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g className="stroke-gray-100 dark:stroke-gray-800" strokeWidth="1.5">
          {[TOP, (TOP + BOTTOM) / 2, BOTTOM].map((ly) => <line key={ly} x1={left} x2={right} y1={ly} y2={ly} />)}
        </g>
        {last && (
          <>
            <path key={`a${lastValue}`} className="money-area" d={`${line} L${last[0]} ${BOTTOM} L${left} ${BOTTOM} Z`} fill="url(#money-honey)" />
            <path key={`l${lastValue}`} className="money-line" pathLength={1} d={line} fill="none" stroke="#A64B31" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle className="money-ring" cx={last[0]} cy={last[1]} r="8" fill="#A64B31" />
            <circle cx={last[0]} cy={last[1]} r="5.5" fill="#A64B31" />
            {lastValue > 0 && (
              <text
                x={valueOnLeft ? last[0] - 14 : last[0] + 14}
                y={last[1] < TOP + 16 ? last[1] + 24 : last[1] - 14}
                textAnchor={valueOnLeft ? 'end' : 'start'}
                className="fill-gray-900 dark:fill-white"
                fontSize="13"
                fontWeight="700"
              >
                {lastValue.toLocaleString()}
              </text>
            )}
          </>
        )}
        <g fontSize="12" className="fill-gray-500 dark:fill-gray-400">
          {Array.from({ length: slots }, (_, i) => {
            const isNow = i === hourly.length - 1;
            if (!isNow && i % labelEvery !== 0) return null;
            // Don't print an hour right on top of "now".
            if (!isNow && labelEvery === 2 && Math.abs(i - (hourly.length - 1)) === 1) return null;
            return (
              <text
                key={i}
                x={left + i * step}
                y={LABEL_Y}
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
    </div>
  );
}
