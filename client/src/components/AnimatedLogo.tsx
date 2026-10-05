// The Skuzi logo in motion: the hand waves, glides left, and "skuzi" slides
// out from behind it. Loops every 7 seconds; still for people who asked for
// less motion. The motion lines stay visible, as they do in the still logo.

interface AnimatedLogoProps {
  /** Letter height in px. */
  size?: number;
  /** "light" = for light backgrounds, "dark" = for dark ones. */
  on?: 'light' | 'dark';
  /** The colour behind the logo: the hand is filled with it so the word can hide behind. */
  bg?: string;
  className?: string;
}

const HAND = [
  'M37 55V27a5.5 5.5 0 0 1 11 0v21',
  'M48 46V20a5.5 5.5 0 0 1 11 0v26',
  'M59 46V24a5.5 5.5 0 0 1 11 0v24',
  'M70 50V34a5 5 0 0 1 10 0v24c0 18-11 30-28 30h-3c-10 0-16-4-21-10l-12-15a5.5 5.5 0 0 1 8-7.5l10 9',
];

export default function AnimatedLogo({ size = 64, on = 'light', bg, className = '' }: AnimatedLogoProps) {
  const ink = on === 'light' ? '#2B201B' : '#F4EDE3';
  const hand = on === 'light' ? '#A64B31' : '#D9A441';
  const fill = bg ?? (on === 'light' ? '#F4EDE3' : '#2B201B');
  return (
    <span className={`sz-lock ${className}`} style={{ fontSize: size, color: ink }} role="img" aria-label="Skuzi">
      <span className="sz-hand-wrap">
        <svg className="sz-hand" viewBox="12 6 90 90" aria-hidden="true">
          <g transform="translate(48 56) rotate(-12) translate(-50 -54)">
            <g fill="none" stroke={fill} strokeWidth="18" strokeLinecap="round" strokeLinejoin="round">
              {HAND.map((d) => <path key={d} d={d} />)}
            </g>
            <path d="M37 48H80V62C80 78 70 88 54 88H50C42 88 36 84 32 79L22 66L37 63Z" fill={fill} />
            <g fill="none" stroke={hand} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
              {HAND.map((d) => <path key={d} d={d} />)}
            </g>
          </g>
          <g className="sz-waves" fill="none" stroke={hand} strokeWidth="5.5" strokeLinecap="round">
            <path d="M82 16q6 5 7 13" />
            <path d="M87 7q10 7 11 21" opacity="0.5" />
          </g>
        </svg>
      </span>
      <span className="sz-clip" aria-hidden="true">
        <span className="sz-word">skuzi</span>
      </span>
    </span>
  );
}
