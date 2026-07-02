interface Props {
  logoUrl?: string | null;
  venueName?: string;
  size?: number;
  className?: string;
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

// Deterministic color from venue name
function getBgColor(name: string) {
  const colors = [
    'bg-violet-500',
    'bg-brand-500',
    'bg-emerald-500',
    'bg-amber-500',
    'bg-rose-500',
    'bg-cyan-500',
    'bg-indigo-500',
    'bg-fuchsia-500',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function VenueLogo({ logoUrl, venueName = '', size = 40, className = '' }: Props) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={venueName}
        width={size}
        height={size}
        className={`rounded-xl object-cover flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  const initials = getInitials(venueName) || '?';
  const bg = getBgColor(venueName);
  const fontSize = size * 0.36;

  return (
    <div
      className={`${bg} rounded-xl flex items-center justify-center flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <span className="text-white font-bold leading-none" style={{ fontSize }}>
        {initials}
      </span>
    </div>
  );
}
