interface LogoProps {
  size?: number;
  className?: string;
}

export default function Logo({ size = 48, className = '' }: LogoProps) {
  const s = size;
  const pad = s * 0.18;
  const gap = s * 0.08;
  const sq = (s - pad * 2 - gap) / 2;
  const r = sq * 0.28;

  return (
    <svg
      width={s}
      height={s}
      viewBox={`0 0 ${s} ${s}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="TabPro logo"
    >
      {/* Outer rounded square */}
      <rect
        width={s}
        height={s}
        rx={s * 0.22}
        fill="#1D9E75"
      />

      {/* Top-left square */}
      <rect
        x={pad}
        y={pad}
        width={sq}
        height={sq}
        rx={r}
        fill="white"
        fillOpacity={0.95}
      />

      {/* Top-right square */}
      <rect
        x={pad + sq + gap}
        y={pad}
        width={sq}
        height={sq}
        rx={r}
        fill="white"
        fillOpacity={0.7}
      />

      {/* Bottom-left square */}
      <rect
        x={pad}
        y={pad + sq + gap}
        width={sq}
        height={sq}
        rx={r}
        fill="white"
        fillOpacity={0.7}
      />

      {/* Bottom-right square */}
      <rect
        x={pad + sq + gap}
        y={pad + sq + gap}
        width={sq}
        height={sq}
        rx={r}
        fill="white"
        fillOpacity={0.45}
      />
    </svg>
  );
}
