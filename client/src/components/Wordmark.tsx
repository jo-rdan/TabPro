import { WavingHand } from './Logo';

// The full Skuzi logo: the waving hand followed by "skuzi".
interface WordmarkProps {
  /** Height of the letters in px. */
  size?: number;
  /** "light" = for light backgrounds, "dark" = for dark ones. */
  on?: 'light' | 'dark';
  className?: string;
}

export default function Wordmark({ size = 28, on = 'light', className = '' }: WordmarkProps) {
  const text = on === 'light' ? '#2B201B' : '#F4EDE3';
  const hand = on === 'light' ? '#A64B31' : '#D9A441';
  return (
    <span className={`inline-flex items-center ${className}`} style={{ gap: size * 0.14 }} aria-label="Skuzi" role="img">
      <svg width={size * 1.05} height={size * 1.05} viewBox="8 4 90 92" aria-hidden="true">
        <WavingHand color={hand} strokeWidth={6.5} />
      </svg>
      <span
        className="font-display"
        style={{ fontWeight: 600, fontSize: size, lineHeight: 1, letterSpacing: '-0.045em', color: text }}
        aria-hidden="true"
      >
        skuzi
      </span>
    </span>
  );
}
