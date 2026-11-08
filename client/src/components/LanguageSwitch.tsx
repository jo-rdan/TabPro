import { LANGS, setLang, useLang, type Lang } from "../lib/i18n";

// RW · EN · FR, as small as the theme switch next to it. `onColor` sits on the
// orange guest header; otherwise it follows the light / dark theme.
const LABEL: Record<Lang, string> = { rw: "RW", en: "EN", fr: "FR" };
const NAME: Record<Lang, string> = { rw: "Ikinyarwanda", en: "English", fr: "Français" };

export default function LanguageSwitch({ onColor = false }: { onColor?: boolean }) {
  const lang = useLang();
  return (
    <div
      role="group"
      aria-label="Language"
      data-notranslate
      className={`inline-flex rounded-full p-[3px] ${onColor ? "bg-white/20" : "bg-gray-100 dark:bg-white/10"}`}
    >
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          title={NAME[l]}
          className={`h-[30px] rounded-full px-2.5 text-xs transition-colors ${
            lang === l
              ? onColor
                ? "bg-white font-extrabold text-brand-600"
                : "bg-white font-extrabold text-gray-900 shadow-sm dark:bg-gray-100 dark:text-gray-900"
              : onColor
                ? "font-bold text-white"
                : "font-bold text-gray-500 dark:text-gray-300"
          }`}
        >
          {LABEL[l]}
        </button>
      ))}
    </div>
  );
}
