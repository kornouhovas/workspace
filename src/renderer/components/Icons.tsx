import type { ReactNode } from "react";
const paths: Record<string, ReactNode> = {
  expand: <path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7"/>,
  returnRight: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16M6 12h6m-3-3 3 3-3 3"/></>,
  reopen: <><path d="M4 5v5h5M4 10a8 8 0 1 1 1 9"/></>,
  forward: <path d="m10 6 6 6-6 6"/>,
  sidebar: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></>,
  up: <path d="m6 14 6-6 6 6"/>,
  down: <path d="m6 10 6 6 6-6"/>,
  edit: <><path d="m15 4 5 5-11 11H4v-5L15 4Z"/><path d="m12 7 5 5"/></>,
  drag: <><circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  close: <path d="m6 6 12 12M6 18 18 6"/>,
  more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1"/></>,
  settings: <><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1M5.6 18.4l2.1-2.1m8.6-8.6 2.1-2.1"/><circle cx="12" cy="12" r="5"/></>,
  folder: <path d="M3 7V5h6l2 2h10v12H3V7Z"/>,
  table: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M10 10v10"/></>,
  board: <><rect x="3" y="4" width="7" height="16" rx="2"/><rect x="14" y="4" width="7" height="10" rx="2"/></>,
  back: <path d="m14 6-6 6 6 6"/>,
  properties: <><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="9" cy="18" r="2"/></>,
};
export function Icon({name}: {name: keyof typeof paths}) {
  return <svg className="ui-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}
