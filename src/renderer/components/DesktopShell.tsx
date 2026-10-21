import { Hint } from "./Hint.js";
import { Icon } from "./Icons.js";
// Settings navigation/section patterns adapted from bb f135a001. See docs/reuse.md and bb/LICENSE.
import { useEffect, useRef, useState, type ReactNode } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import * as RadioGroup from "@radix-ui/react-radio-group";
import type { Appearance, Language } from "../../contracts/settings.js";
import type { WorkspaceLoad } from "../../contracts/workspaces.js";


const sections = ["general", "appearance", "workspaces", "sources", "backup", "about"] as const;
type Section = typeof sections[number];
export const shellLabels = {
  en: { actions: "Workspace actions", add: "Add workspace", rename: "Rename workspace", remove: "Remove workspace", up: "Move up", down: "Move down", settings: "Settings", back: "Back to workspace", general: "General", appearance: "Appearance", workspaces: "Workspaces", sources: "Sources", backup: "Backup and recovery", about: "About", theme: "Color theme", light: "Light", dark: "Dark", system: "System", retry: "Retry", workspace: "Workspace", unavailable: "Settings will be available when the backend reconnects.", aboutDescription: "Workspace organizes real project folders using properties and saved views." },
  ru: { actions: "Действия с рабочим пространством", add: "Добавить рабочее пространство", rename: "Переименовать рабочее пространство", remove: "Удалить рабочее пространство", up: "Переместить выше", down: "Переместить ниже", settings: "Настройки", back: "Вернуться к работе", general: "Основные", appearance: "Оформление", workspaces: "Рабочие пространства", sources: "Источники", backup: "Резервные копии и восстановление", about: "О приложении", theme: "Цветовая тема", light: "Светлая", dark: "Тёмная", system: "Системная", retry: "Повторить", workspace: "Рабочее пространство", unavailable: "Настройки станут доступны после подключения сервиса.", aboutDescription: "Workspace помогает работать с папками проектов, свойствами и сохранёнными видами." },
};

export function AppearanceControl({ language, value, disabled, onChange }: { language: Language; value: Appearance; disabled?: boolean; onChange(value: Appearance): void }) {
  const l = shellLabels[language];
  return <RadioGroup.Root className="theme-options" aria-label={l.theme} value={value} disabled={disabled} onValueChange={next => onChange(next as Appearance)}>
    {(["light", "dark", "system"] as const).map(option => <label key={option} className="theme-option">
      <RadioGroup.Item className="theme-radio" value={option}><RadioGroup.Indicator className="theme-radio-indicator" /></RadioGroup.Item>
      {l[option]}
    </label>)}
  </RadioGroup.Root>;
}

export type WorkspaceAction = "settings" | "rename" | "remove" | "up" | "down";

export function DesktopShell({ language, data, busy, locked, onCreate, onManage, onActivate, onEmptyWorkspaceShown, renderPanels, children }: {
  language: Language; data: WorkspaceLoad | null; busy: boolean; locked: boolean;
  onCreate?(): void; onManage?(id: string, action: WorkspaceAction): Promise<boolean>;
  onActivate(id: string): void; onEmptyWorkspaceShown?(): void; renderPanels(back: () => void): Record<Section, ReactNode>; children: ReactNode;
}) {
  const l = shellLabels[language];
  const [open, setOpen] = useState(false);
  const [contextId, setContextId] = useState<string | null>(null);
  const contextTrigger = useRef<HTMLButtonElement | null>(null);
  const [restoreContextFocus, setRestoreContextFocus] = useState(false);
  useEffect(() => {
    if (restoreContextFocus && !busy) { contextTrigger.current?.focus(); setRestoreContextFocus(false); }
  }, [restoreContextFocus, busy]);
  const [section, setSection] = useState<Section>("general");
  const settingsButton = useRef<HTMLButtonElement>(null);
  const backButton = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const changedPage = useRef(false);
  const returningToEmpty = useRef(false);
  useEffect(() => {
    if (!changedPage.current || (!open && returningToEmpty.current && busy)) return;
    changedPage.current = false;
    if (open) backButton.current?.focus();
    else if (returningToEmpty.current && onEmptyWorkspaceShown) {
      returningToEmpty.current = false;
      onEmptyWorkspaceShown();
    } else (previousFocus.current?.isConnected ? previousFocus.current : settingsButton.current)?.focus({ preventScroll: true });
  }, [open, busy, onEmptyWorkspaceShown]);
  const enter = () => {
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : settingsButton.current;
    changedPage.current = true; setOpen(true);
  };
  const back = () => { changedPage.current = true; setOpen(false); };
  const previousCount = useRef(data?.workspaces.length ?? 0);
  useEffect(() => {
    if (previousCount.current > 0 && data?.workspaces.length === 0 && open && section === "workspaces") {
      returningToEmpty.current = true;
      back();
    }
    previousCount.current = data?.workspaces.length ?? 0;
  }, [data, open, section]);
  const manage = async (id: string, action: WorkspaceAction) => {
    setContextId(null);
    if (await onManage?.(id, action)) {
      if (action === "up" || action === "down") { setRestoreContextFocus(true); return; }
      previousFocus.current = contextTrigger.current;
      // The editor/confirmation owns initial focus when entered contextually.
      changedPage.current = action === "settings";
      setSection("workspaces"); setOpen(true);
    }
  };
  const panels = renderPanels(back);
  return <Tabs.Root className="desktop-shell bg-background text-foreground" orientation="vertical" activationMode="manual" value={section} onValueChange={value => setSection(value as Section)}>
    <aside className="desktop-sidebar" aria-label={open ? l.settings : l.workspaces}>
      <div className="desktop-brand">Workspace</div>
      <div className="sidebar-scroll">
        <div hidden={open}>
          <p className="sidebar-label">{l.workspaces}</p>
          <nav aria-label={l.workspaces} className="sidebar-items">
            {data?.workspaces.map((workspace, index, all) => <div key={workspace.workspaceId} className="sidebar-workspace-row"
              onBlur={event => { if (contextId === workspace.workspaceId && !event.currentTarget.contains(event.relatedTarget as Node | null)) setContextId(null); }}
              onKeyDown={event => { if (event.key === "Escape" && contextId === workspace.workspaceId) { event.preventDefault(); setContextId(null); contextTrigger.current?.focus(); } }}>
              <button type="button" className="sidebar-item" data-workspace-id={workspace.workspaceId}
                aria-current={data.activeWorkspace?.workspaceId === workspace.workspaceId ? "page" : undefined}
                disabled={busy || locked} onClick={() => { setContextId(null); onActivate(workspace.workspaceId); }}>
                <span aria-hidden="true" className="workspace-monogram">{workspace.name.trim().slice(0, 1).toUpperCase() || "W"}</span>
                <span className="sidebar-name">{workspace.name}</span>
              </button>
              {onManage && <Hint label={`${l.actions}: ${workspace.name}`}><button type="button" className="workspace-context-trigger" disabled={busy || locked}
                aria-label={`${l.actions}: ${workspace.name}`} aria-expanded={contextId === workspace.workspaceId}
                onClick={event => { contextTrigger.current = event.currentTarget; setContextId(contextId === workspace.workspaceId ? null : workspace.workspaceId); }}><Icon name="more"/></button></Hint>}
              {contextId === workspace.workspaceId && <div role="group" className="workspace-context" aria-label={`${l.actions}: ${workspace.name}`}>
                {(["settings", "rename", "up", "down", "remove"] as const).map(action => <button key={action} type="button" className="sidebar-item"
                  disabled={busy || locked || (action === "up" && index === 0) || (action === "down" && index === all.length - 1)}
                  onClick={() => void manage(workspace.workspaceId, action)}>{l[action]}</button>)}
              </div>}
            </div>)}
            {onCreate && <button type="button" className="sidebar-item sidebar-create" disabled={busy || locked} onClick={onCreate}><Icon name="plus"/> {l.add}</button>}
          </nav>
        </div>
        <div hidden={!open}>
          <button ref={backButton} type="button" className="sidebar-item" disabled={locked} onClick={back}><Icon name="back"/> {l.back}</button>
          <p className="sidebar-label">{l.settings}</p>
          <Tabs.List aria-label={l.settings} className="sidebar-items">
            {sections.map(item => <Tabs.Trigger className="sidebar-item" key={item} value={item} disabled={locked && item !== section}>{l[item]}</Tabs.Trigger>)}
          </Tabs.List>
        </div>
      </div>
      <button ref={settingsButton} type="button" className="sidebar-item sidebar-settings" hidden={open} disabled={locked} onClick={enter}><Icon name="settings"/>{l.settings}</button>
    </aside>
    <div className="desktop-area">
      <div className="desktop-workspace" aria-hidden={open} inert={open}>{children}</div>
      <div className="desktop-settings" hidden={!open}>
        {sections.map(item => <Tabs.Content key={item} value={item} forceMount hidden={!open || section !== item} className="settings-page" tabIndex={0}>
          <header className="settings-page-heading"><p>{l.settings}</p><h1>{l[item]}</h1></header>
          <div className="settings-card">{item === "sources" && (!open || section !== item) ? null : panels[item]}</div>
        </Tabs.Content>)}
      </div>
    </div>
  </Tabs.Root>;
}
