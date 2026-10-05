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
    'bg-[#2B201B]',
    'bg-brand-500',
    'bg-[#5E7A55]',
    'bg-[#D9A441]',
    'bg-[#B8703F]',
    'bg-[#3A2D26]',
    'bg-[#7D3421]',
    'bg-[#5C4D44]',
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
