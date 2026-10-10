import { create } from 'zustand';

type Theme = 'light' | 'dark';
export type ThemeMode = Theme | 'system';

const KEY = 'skuzi_theme_mode';

function getSystemTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readMode(): ThemeMode {
  try {
    const m = localStorage.getItem(KEY);
    if (m === 'light' || m === 'dark' || m === 'system') return m;
  } catch { /* private mode: fall back to the device */ }
  return 'system';
}

const resolve = (mode: ThemeMode): Theme => (mode === 'system' ? getSystemTheme() : mode);

function applyClass(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

// Light, dark, or follow the device ("system"). The choice is remembered on
// this device; "system" keeps following the phone/computer as it changes.
export const useThemeStore = create<{
  mode: ThemeMode;
  theme: Theme;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
  init: () => void;
}>((set, get) => ({
  mode: readMode(),
  theme: resolve(readMode()),

  init: () => {
    const mode = readMode();
    const theme = resolve(mode);
    applyClass(theme);
    set({ mode, theme });

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (get().mode !== 'system') return;
      const next: Theme = e.matches ? 'dark' : 'light';
      applyClass(next);
      set({ theme: next });
    });
  },

  setMode: (mode) => {
    try { localStorage.setItem(KEY, mode); } catch { /* not saved, still applied */ }
    const theme = resolve(mode);
    applyClass(theme);
    set({ mode, theme });
  },

  // Cycles light → dark → system (used by the compact phone button).
  toggle: () => {
    const order: ThemeMode[] = ['light', 'dark', 'system'];
    const { mode, setMode } = get();
    setMode(order[(order.indexOf(mode) + 1) % order.length]);
  },
}));
