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

export default function CoinJar({ total, benchmark, benchmarkLabel }: CoinJarProps) {
  const [use3d] = useState(wantsThree);
  const [ready, setReady] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<{ update: (coins: number, ringLabel: string | null, now: string) => void; dispose: () => void } | null>(null);

  const coins = coinCount(total, benchmark);
  const ringLabel = benchmark > 0 ? benchmarkLabel : null;
  const nowLabel = total > 0 ? total.toLocaleString() : '';

  useEffect(() => {
    if (!use3d || !canvasRef.current) return;
    let cancelled = false;
    import('./coinJarScene').then(({ createCoinJarScene }) => {
      if (cancelled || !canvasRef.current) return;
      sceneRef.current = createCoinJarScene(canvasRef.current);
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

  return (
    <div className="relative h-[180px]">
      {use3d && (
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 w-full h-full transition-opacity duration-500 ${ready ? 'opacity-100' : 'opacity-0'}`}
          aria-label={`A glass jar with ${total.toLocaleString()} RWF in coins${ringLabel ? `; the ring marks ${ringLabel}` : ''}`}
        />
      )}
      {(!use3d || !ready) && <FlatJar coins={coins} ringLabel={ringLabel} nowLabel={nowLabel} />}
    </div>
  );
}

// Phones and the first moment on computers: the same jar, drawn flat.
function FlatJar({ coins, ringLabel, nowLabel }: { coins: number; ringLabel: string | null; nowLabel: string }) {
  const top = 30, bottom = 180, height = bottom - top;
  const ringY = bottom - (RING_COINS / MAX_COINS) * height;
  const fillY = bottom - (coins / MAX_COINS) * height;
  const layers = Math.ceil(coins / PER_LAYER);
  return (
    <svg viewBox="0 0 320 200" className="w-full h-full" role="img" aria-label={`Coin jar${nowLabel ? `: ${nowLabel} RWF tonight` : ''}`}>
      <defs>
        <clipPath id="jar-inside"><rect x="112" y={top} width="96" height={height} rx="14" /></clipPath>
      </defs>
      <g clipPath="url(#jar-inside)">
        {Array.from({ length: layers }, (_, i) => {
          const y = bottom - 6 - i * (height / (MAX_COINS / PER_LAYER));
          return (
            <g key={i}>
              {[0, 1, 2].map((k) => (
                <ellipse key={k} cx={130 + k * 30 + (i % 2) * 8} cy={y} rx="16" ry="5.5" fill="#D9A441" stroke="#B8862F" strokeWidth="1.5" />
              ))}
            </g>
          );
        })}
      </g>
      <rect x="112" y={top} width="96" height={height} rx="14" fill="#F4EDE3" fillOpacity="0.08" stroke="#F4EDE3" strokeOpacity="0.45" strokeWidth="2" />
      <rect x="106" y={top - 8} width="108" height="10" rx="5" fill="#F4EDE3" fillOpacity="0.35" />
      {ringLabel && (
        <>
          <line x1="104" x2="216" y1={ringY} y2={ringY} stroke="#D06B4A" strokeWidth="3" strokeLinecap="round" />
          <text x="224" y={ringY + 5} fill="#E08A6A" fontSize="14" fontWeight="700" fontFamily="Figtree, sans-serif">{ringLabel}</text>
        </>
      )}
      {nowLabel && (
        <text x="100" y={Math.max(fillY, top + 14) + 5} textAnchor="end" fill="#D9A441" fontSize="16" fontWeight="700" fontFamily="Figtree, sans-serif">{nowLabel}</text>
      )}
    </svg>
  );
}
