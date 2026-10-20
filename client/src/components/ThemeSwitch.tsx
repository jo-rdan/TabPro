import { Sun, Moon, Monitor } from 'lucide-react';
import { useThemeStore, ThemeMode } from '../lib/theme';

// Light · Auto · Dark in one small pill with a sliding marker.
// "row" fits the open sidebar, "column" the collapsed one, "labels" the phone sheet.
const MODES: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
  { mode: 'light', label: 'Light', icon: Sun },
  { mode: 'system', label: 'Auto', icon: Monitor },
  { mode: 'dark', label: 'Dark', icon: Moon },
];

export default function ThemeSwitch({ layout = 'row' }: { layout?: 'row' | 'column' | 'labels' }) {
  const { mode, setMode } = useThemeStore();
  const index = MODES.findIndex((m) => m.mode === mode);
  const vertical = layout === 'column';
  const seg = layout === 'labels' ? 'flex-1 h-10 gap-1.5' : 'w-8 h-8';

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={`relative inline-flex ${vertical ? 'flex-col' : 'flex-row'} ${layout === 'labels' ? 'w-full' : ''} rounded-full bg-gray-100 dark:bg-[#1B1524] p-1 ring-1 ring-gray-200 dark:ring-gray-800`}
    >
      {/* sliding marker */}
      <span
        aria-hidden="true"
        className={`absolute rounded-full bg-white dark:bg-[#33293F] shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 transition-transform duration-300 ease-out ${
          vertical ? 'left-1 top-1 w-8 h-8' : layout === 'labels' ? 'top-1 left-1 h-10 w-[calc((100%-8px)/3)]' : 'top-1 left-1 w-8 h-8'
        }`}
        style={{ transform: vertical ? `translateY(${index * 100}%)` : `translateX(${index * 100}%)` }}
      />
      {MODES.map(({ mode: m, label, icon: Icon }) => {
        const on = m === mode;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={`${label} theme`}
            title={m === 'system' ? 'Auto: follow this device' : `${label} theme`}
            onClick={() => setMode(m)}
            className={`relative z-10 flex items-center justify-center rounded-full ${seg} text-xs font-semibold transition-colors ${
              on ? 'text-gray-900 dark:text-white' : 'text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300'
            }`}
          >
            <Icon size={15} className={on ? (m === 'light' ? 'theme-spin text-amber-500' : m === 'dark' ? 'theme-tilt text-amber-400' : 'theme-pop text-brand-500 dark:text-brand-400') : ''} key={on ? `${m}-on` : m} />
            {layout === 'labels' && <span>{label}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** One button that cycles Light → Dark → Auto; for tight spots like the phone top bar. */
export function ThemeCycleButton({ className = '' }: { className?: string }) {
  const { mode, toggle } = useThemeStore();
  const current = MODES.find((m) => m.mode === mode)!;
  const Icon = current.icon;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Theme: ${current.label}. Tap to change`}
      title={`Theme: ${current.label}`}
      className={`p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${className}`}
    >
      <Icon size={18} key={mode} className="theme-pop" />
    </button>
  );
}
