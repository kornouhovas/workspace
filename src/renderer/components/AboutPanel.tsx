import type { Language } from "../../contracts/settings.js";
import { shellLabels } from "./DesktopShell.js";

type AppInfo = { version: string; notices: { title: string; content: string }[] };
// Vite embeds canonical package/license inputs; no Node access enters the renderer.
declare const __WORKSPACE_APP_INFO__: AppInfo;
const buildInfo = typeof __WORKSPACE_APP_INFO__ === "undefined" ? null : __WORKSPACE_APP_INFO__;

export function AboutPanel({ language, info = buildInfo }: { language: Language; info?: AppInfo | null }) {
  return <section className="about-panel" aria-labelledby="about-product-title">
    <h2 id="about-product-title">Workspace</h2>
    <p>{shellLabels[language].aboutDescription}</p>
    <p>{language === "en" ? "Version" : "Версия"}: {info?.version ?? (language === "en" ? "Unavailable in this preview" : "Недоступна в этом предпросмотре")}</p>
    <h3>{language === "en" ? "Licenses and acknowledgements" : "Лицензии и благодарности"}</h3>
    {info?.notices.map(notice => <details key={notice.title}>
      <summary>{notice.title}</summary>
      <pre className="about-notice">{notice.content}</pre>
    </details>)}
  </section>;
}
