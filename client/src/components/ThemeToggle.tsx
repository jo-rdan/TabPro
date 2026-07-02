import { Moon, Sun } from 'lucide-react';
import { useThemeStore } from '../lib/theme';

export default function ThemeToggle() {
  const { theme, toggle } = useThemeStore();

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      className="
        p-2 rounded-lg
        text-gray-500 dark:text-gray-400
        hover:bg-gray-100 dark:hover:bg-gray-800
        transition-colors duration-150
        focus:outline-none focus:ring-2 focus:ring-brand-500
      "
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
