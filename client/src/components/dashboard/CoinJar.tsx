import { useEffect, useRef, useState } from 'react';

// Tonight's money as a glass jar filling with coins. The rust ring marks the
// night to beat (best night, or the same night last week). Three.js only loads
// on computers; phones get a flat jar so the dashboard stays light.

interface CoinJarProps {
  total: number;
  /** Money of the night to beat; 0 when there is no history yet. */
  benchmark: number;
  /** e.g. "Best: 318k" or "Last Fri: 210k". */
  benchmarkLabel: string;
  /** Follow the app's light/dark theme. */
  dark: boolean;
}

const MAX_COINS = 84;
const PER_LAYER = 7;
const RING_COINS = 70; // the benchmark sits at this many coins

export function coinCount(total: number, benchmark: number) {
  if (total <= 0) return 0;
  // No history yet: fill most of the jar so the first night still feels good.
  if (benchmark <= 0) return 60;
  return Math.max(1, Math.min(MAX_COINS, Math.round((total / benchmark) * RING_COINS)));
}

function wantsThree() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  if (!window.matchMedia('(min-width: 1024px)').matches) return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export default function CoinJar({ total, benchmark, benchmarkLabel, dark }: CoinJarProps) {
  const [use3d] = useState(wantsThree);
  const [ready, setReady] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<{ update: (coins: number, ringLabel: string | null, now: string) => void; setDark: (dark: boolean) => void; dispose: () => void } | null>(null);
  const darkRef = useRef(dark);
  darkRef.current = dark;

  const coins = coinCount(total, benchmark);
  const ringLabel = benchmark > 0 ? benchmarkLabel : null;
  const nowLabel = total > 0 ? total.toLocaleString() : '';

  useEffect(() => {
    if (!use3d || !canvasRef.current) return;
    let cancelled = false;
    import('./coinJarScene').then(({ createCoinJarScene }) => {
      if (cancelled || !canvasRef.current) return;
      sceneRef.current = createCoinJarScene(canvasRef.current, darkRef.current);
      setReady(true);
    }).catch(() => { /* flat jar stays */ });
    return () => {
      cancelled = true;
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, [use3d]);

  useEffect(() => {
    sceneRef.current?.update(coins, ringLabel, nowLabel);
  }, [coins, ringLabel, nowLabel, ready]);

  useEffect(() => {
    sceneRef.current?.setDark(dark);
  }, [dark, ready]);

  return (
    <div className="relative h-[180px]">
      {use3d && (
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 w-full h-full transition-opacity duration-500 ${ready ? 'opacity-100' : 'opacity-0'}`}
          aria-label={`A glass jar with ${total.toLocaleString()} RWF in coins${ringLabel ? `; the ring marks ${ringLabel}` : ''}`}
        />
      )}
      {(!use3d || !ready) && <FlatJar coins={coins} ringLabel={ringLabel} nowLabel={nowLabel} dark={dark} />}
    </div>
  );
}

// Phones (and the first moment on computers): the same jar as an animated
// drawing. Coins drop in one by one and settle, the jar sways a little and the
// ring glows, so it feels alive without loading 3D.
function FlatJar({ coins, ringLabel, nowLabel, dark }: { coins: number; ringLabel: string | null; nowLabel: string; dark: boolean }) {
  const glass = dark ? '#F4F0F7' : '#554A60';
  const cx = 160, w = 104, top = 34, bottom = 166;
  const left = cx - w / 2, right = cx + w / 2;
  const layerH = (bottom - top - 8) / (MAX_COINS / PER_LAYER);
  const layers = Math.ceil(coins / PER_LAYER);
  const ringY = bottom - 6 - (RING_COINS / PER_LAYER) * layerH;
  const topY = layers ? bottom - 6 - (layers - 1) * layerH : bottom;
  const coinList: { x: number; y: number; i: number }[] = [];
  for (let l = 0; l < layers; l++) {
    const inLayer = l < layers - 1 ? 3 : Math.max(1, Math.round(((coins - l * PER_LAYER) / PER_LAYER) * 3));
    for (let k = 0; k < inLayer; k++) {
      coinList.push({ x: cx - 27 + k * 27 + (l % 2 ? 7 : -4), y: bottom - 6 - l * layerH, i: coinList.length });
    }
  }
  const uid = dark ? 'd' : 'l';
  return (
    <svg viewBox="0 0 320 180" className="w-full h-full overflow-visible" role="img" aria-label={`Coin jar${nowLabel ? `: ${nowLabel} RWF tonight` : ''}`}>
      <defs>
        <clipPath id={`jar-in-${uid}`}><path d={`M${left + 4} -200 H${right - 4} V${bottom - 14} Q${right - 4} ${bottom - 2} ${right - 16} ${bottom - 2} H${left + 16} Q${left + 4} ${bottom - 2} ${left + 4} ${bottom - 14} Z`} /></clipPath>
        <linearGradient id={`jar-glass-${uid}`} x1="0" x2="1">
          <stop offset="0" stopColor={glass} stopOpacity="0.16" />
          <stop offset="0.25" stopColor={glass} stopOpacity="0.04" />
          <stop offset="0.8" stopColor={glass} stopOpacity="0.06" />
          <stop offset="1" stopColor={glass} stopOpacity="0.2" />
        </linearGradient>
        <radialGradient id={`jar-glow-${uid}`}>
          <stop offset="0" stopColor="#F2B33A" stopOpacity={dark ? 0.35 : 0.25} />
          <stop offset="1" stopColor="#F2B33A" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx={cx} cy={bottom - 4} rx="90" ry="22" fill={`url(#jar-glow-${uid})`} />
      <g className="jar-sway">
        {/* back of the glass */}
        <path d={`M${left} ${top} V${bottom - 14} Q${left} ${bottom} ${left + 14} ${bottom} H${right - 14} Q${right} ${bottom} ${right} ${bottom - 14} V${top}`} fill={`url(#jar-glass-${uid})`} />
        <g clipPath={`url(#jar-in-${uid})`}>
          {coinList.map((c) => (
            <g key={c.i} className="jar-coin" style={{ animationDelay: `${Math.min(c.i, 40) * 55}ms` }}>
              <ellipse cx={c.x} cy={c.y + 2.5} rx="15" ry="5.5" fill="#9C6F22" />
              <ellipse cx={c.x} cy={c.y} rx="15" ry="5.5" fill="#F2B33A" />
              <ellipse cx={c.x - 2} cy={c.y - 0.8} rx="9" ry="2.8" fill="#FFD15C" opacity="0.7" />
            </g>
          ))}
        </g>
        {/* front of the glass: outline, shine, rim */}
        <path d={`M${left} ${top} V${bottom - 14} Q${left} ${bottom} ${left + 14} ${bottom} H${right - 14} Q${right} ${bottom} ${right} ${bottom - 14} V${top}`} fill="none" stroke={glass} strokeOpacity="0.45" strokeWidth="2.5" />
        <path d={`M${left + 10} ${top + 14} V${bottom - 22}`} stroke="#FFFFFF" strokeOpacity={dark ? 0.18 : 0.6} strokeWidth="5" strokeLinecap="round" />
        <ellipse cx={cx} cy={top} rx={w / 2 + 4} ry="7" fill="none" stroke={glass} strokeOpacity="0.55" strokeWidth="3" />
        {ringLabel && (
          <ellipse className="jar-ring" cx={cx} cy={ringY} rx={w / 2 + 6} ry="8" fill="none" stroke="#C9603F" strokeWidth="3.5" />
        )}
        {coins > 0 && <circle className="jar-glint" cx={coinList[coinList.length - 1].x + 6} cy={topY - 4} r="2.5" fill="#FFF6DD" />}
      </g>
      {ringLabel && (
        <text x={right + 16} y={ringY + 5} fill={dark ? '#F0884F' : '#A63F15'} fontSize="14" fontWeight="700" fontFamily="Figtree, sans-serif">{ringLabel}</text>
      )}
      {nowLabel && (
        <text className="jar-now" x={left - 14} y={Math.max(topY, top + 14) + 4} textAnchor="end" fill={dark ? '#F2B33A' : '#A06D14'} fontSize="16" fontWeight="800" fontFamily="Figtree, sans-serif">{nowLabel}</text>
      )}
    </svg>
  );
}
