import type { GlobalProvider } from "@ladle/react";
import { I18nProvider } from "../src/i18n";
import "../src/styles.css";

export const Provider: GlobalProvider = ({ children, globalState }) => (
  <I18nProvider>
    <div
      className={`${globalState.theme === "dark" ? "dark" : ""} min-h-screen bg-background p-6 text-foreground`}
    >
      {children}
    </div>
  </I18nProvider>
);
