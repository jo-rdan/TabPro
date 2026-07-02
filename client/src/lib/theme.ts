import { create } from 'zustand';

type Theme = 'light' | 'dark';

function getSystemTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyClass(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export const useThemeStore = create<{
  theme: Theme;
  toggle: () => void;
  init: () => void;
}>((set, get) => ({
  theme: getSystemTheme(),

  init: () => {
    const theme = getSystemTheme();
    applyClass(theme);
    set({ theme });

    // Always stay in sync with OS — no manual override persists across sessions
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      const next: Theme = e.matches ? 'dark' : 'light';
      applyClass(next);
      set({ theme: next });
    });
  },

  toggle: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
    applyClass(next);
    set({ theme: next });
    // No localStorage — toggle is session-only, system preference always wins on next load
  },
}));




