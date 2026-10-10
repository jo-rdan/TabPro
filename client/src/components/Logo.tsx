// The Skuzi app icon: a waving hand (with its two motion lines) on a rust
// tile. Same props as before, so every screen that shows <Logo /> gets it.
interface LogoProps {
  size?: number;
  className?: string;
  /** Tile colour and hand colour; defaults to the main rust icon. */
  tone?: 'rust' | 'espresso' | 'milk';
}

const TONES = {
  rust: { bg: '#A64B31', fg: '#F4EDE3' },
  espresso: { bg: '#2B201B', fg: '#D9A441' },
  milk: { bg: '#F4EDE3', fg: '#A64B31' },
};

export function WavingHand({ color, strokeWidth = 5.5 }: { color: string; strokeWidth?: number }) {
  return (
    <>
      <g
        transform="translate(48 56) rotate(-14) translate(-50 -54)"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M37 55V27a5.5 5.5 0 0 1 11 0v21" />
        <path d="M48 46V20a5.5 5.5 0 0 1 11 0v26" />
        <path d="M59 46V24a5.5 5.5 0 0 1 11 0v24" />
        <path d="M70 50V34a5 5 0 0 1 10 0v24c0 18-11 30-28 30h-3c-10 0-16-4-21-10l-12-15a5.5 5.5 0 0 1 8-7.5l10 9" />
      </g>
      {/* The motion lines are part of the logo: the hand has always just waved. */}
      <g fill="none" stroke={color} strokeWidth={strokeWidth - 0.5} strokeLinecap="round">
        <path d="M77 19q6 5 7 13" />
        <path d="M82 10q10 7 11 21" opacity={0.5} />
      </g>
    </>
  );
}

export default function Logo({ size = 48, className = '', tone = 'rust' }: LogoProps) {
  const { bg, fg } = TONES[tone];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} role="img" aria-label="Skuzi">
      <rect width="100" height="100" rx="24" fill={bg} />
      <WavingHand color={fg} />
    </svg>
  );
}
