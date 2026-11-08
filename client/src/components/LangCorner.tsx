import type { ReactNode } from "react";
import Translated from "./Translated";
import LanguageSwitch from "./LanguageSwitch";

// Sign-in and sign-up screens: the page in the chosen language, with the small
// RW · EN · FR switch in the top corner, so nobody has to read English to start.
export default function LangCorner({ children }: { children: ReactNode }) {
  return (
    <Translated>
      <div className="fixed right-3 z-50" style={{ top: "calc(env(safe-area-inset-top, 0px) + 12px)" }}>
        <LanguageSwitch />
      </div>
      {children}
    </Translated>
  );
}
