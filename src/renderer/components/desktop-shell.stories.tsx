import { useState } from "react";
import type { Appearance } from "../../contracts/settings.js";
import { AppearanceControl } from "./DesktopShell.js";
import "../app.css";

export function Themes() {
  const [appearance, setAppearance] = useState<Appearance>("system");
  return <div className="bb-foundation-preview">
    <h2>Appearance · Оформление</h2>
    <AppearanceControl language="en" value={appearance} onChange={setAppearance} />
    <AppearanceControl language="ru" value={appearance} onChange={setAppearance} />
    <AppearanceControl language="en" value="dark" disabled onChange={() => {}} />
    <p role="alert">A failed save keeps the accepted selection. · При ошибке остаётся сохранённая тема.</p>
  </div>;
}
