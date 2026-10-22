import { useDraftGuard } from "./ScalarDrafts.js";
import { Hint } from "./Hint.js";
import { Icon } from "./Icons.js";
import * as Menu from "@radix-ui/react-dropdown-menu";
import * as Tabs from "@radix-ui/react-tabs";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ViewCommand, ViewSnapshot, WorkspaceView } from "../../contracts/views.js";
import type { Language } from "../../contracts/settings.js";
import { translate, type TranslationKey } from "../localization.js";
import { WorkspaceServiceClient } from "../workspace-service-client.js";
import { StatusMessage } from "./bb-foundation.js";

interface Props { onWillLoad?(): void; projectTabs?: ReactNode; projectActive?: boolean; onSelectView?(): void; tools?: ReactNode; client: WorkspaceServiceClient; workspaceId: string; language: Language; disabled: boolean; panelId?: string; onChange(view: WorkspaceView | null): void }
export function ViewsPanel(props: Props) { return <ViewCollection key={props.workspaceId} {...props} />; }
function ViewCollection({ onWillLoad, projectTabs, projectActive, onSelectView, tools, client, workspaceId, language, disabled, panelId, onChange }: Props) {
  const guard = useDraftGuard();
  const transition = (action: () => void) => { if (guard) guard.run(action); else action(); };
  const t = (key: TranslationKey) => translate(language, key);
  const [snapshot, setSnapshot] = useState<ViewSnapshot | null>(null);
  const [loading, setLoading] = useState(true), [pending, setPending] = useState(false);
  const [error, setError] = useState<"viewsError" | "viewSaveError" | "viewValidation" | null>(null);
  const [draft, setDraft] = useState<{ action: "create" | "duplicate" | "edit"; viewId?: string; name: string; kind: "table" | "board" } | null>(null);
  const [menu, setMenu] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const version = useRef(0), lifetime = useRef(0), busy = useRef(false);
  const current = useRef(onChange); current.current = onChange;
  const willLoad=useRef(onWillLoad);willLoad.current=onWillLoad;
  const input = useRef<HTMLInputElement>(null), select = useRef<HTMLButtonElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null), restoreFocus = useRef(false);
  const active = snapshot?.views.find(view => view.viewId === snapshot.activeViewId);
  const position = snapshot?.views.findIndex(view => view.viewId === snapshot.activeViewId) ?? -1;
  const load = async () => {
    const request = ++version.current;
    willLoad.current?.();
    setLoading(true);
    try {
      const result = await client.listViews(workspaceId);
      if (request !== version.current) return;
      if (result.ok && result.value.workspaceId === workspaceId) {
        setSnapshot(result.value);
        current.current(result.value.views.find(view => view.viewId === result.value.activeViewId) ?? null);
        setError(value => value === "viewsError" ? null : value);
      } else { setError("viewsError"); current.current(null); }
    } catch { if (request === version.current) { setError("viewsError"); current.current(null); } }
    finally { if (request === version.current) setLoading(false); }
  };
  useEffect(() => {
    const unsubscribe = client.onWorkspaceChange(event => { if (event.type === "workspace.listChanged") void load(); });
    void load();
    return () => { version.current++; lifetime.current++; unsubscribe(); };
  }, [client, workspaceId]);
  useEffect(() => { if (draft) input.current?.focus(); }, [draft?.action]);
  useEffect(() => { if (!draft && !deleting && !pending && !loading && restoreFocus.current) { restoreFocus.current = false; (trigger.current ?? select.current)?.focus(); } }, [draft, deleting, pending, loading]);
  const close = () => { restoreFocus.current = true; setDraft(null); setDeleting(null); setError(null); };
  const mutate = (command: ViewCommand) => {
    if (guard) guard.run(() => applyMutation(command)); else void applyMutation(command);
  };
  const applyMutation = async (command: ViewCommand) => {
    if (busy.current || disabled) return;
    willLoad.current?.();
    busy.current = true; setPending(true); setError(null);
    const started = lifetime.current;
    try {
      const result = await client.changeView(command);
      if (started !== lifetime.current) return;
      if (result.ok && result.value.workspaceId === workspaceId) { close(); trigger.current = command.type === "workspace.activateView" ? null : (trigger.current ?? menuButton.current); await load(); }
      else { setError("viewSaveError"); await load(); }
    } catch { if (started === lifetime.current) { setError("viewSaveError"); await load(); } }
    finally { if (started === lifetime.current) { busy.current = false; setPending(false); } }
  };
  const save = () => {
    if (!draft) return;
    if (!draft.name.trim() || draft.name.length > 200) { setError("viewValidation"); input.current?.focus(); return; }
    if (draft.action === "edit") void mutate({ type: "workspace.updateView", workspaceId, viewId: draft.viewId!, name: draft.name, kind: draft.kind });
    else if (draft.action === "duplicate") void mutate({ type: "workspace.duplicateView", workspaceId, viewId: draft.viewId!, name: draft.name });
    else void mutate({ type: "workspace.createView", workspaceId, name: draft.name, kind: draft.kind });
  };
  const blocked = disabled || pending || loading || !snapshot || error === "viewsError" || !!draft || !!deleting;
  const move = (offset: number) => {
    if (!snapshot || position < 0) return;
    trigger.current = menuButton.current;
    const viewIds = snapshot.views.map(v => v.viewId);
    [viewIds[position], viewIds[position + offset]] = [viewIds[position + offset], viewIds[position]];
    void mutate({ type: "workspace.reorderViews", workspaceId, viewIds });
  };
  return <section className="views-panel" aria-label={t("viewsTitle")} aria-busy={pending || loading}>
    {loading && <StatusMessage kind="info" title={t("viewsLoading")} />}
    {error && <StatusMessage kind="error" title={t(error)} />}
    {error && <button className="workspace-button workspace-button--secondary" type="button" disabled={loading || pending} onClick={() => void load()}>{t("viewsRetry")}</button>}
    <div className="view-controls">
      <Tabs.Root value={projectActive ? "" : snapshot?.activeViewId ?? ""} activationMode="manual" onValueChange={viewId => transition(() => { onSelectView?.(); if(viewId !== snapshot?.activeViewId) void mutate({ type: "workspace.activateView", workspaceId, viewId }); })}>
        <Tabs.List className="saved-view-tabs" aria-label={t("viewCurrent")}>
          {snapshot?.views.map(view => <Tabs.Trigger className="saved-view-tab" key={view.viewId} value={view.viewId} id={`saved-view-${view.viewId}`} aria-controls={panelId} disabled={blocked}
            ref={view.viewId === snapshot.activeViewId ? select : undefined}><Icon name={view.kind === "table" ? "table" : "board"}/>{view.name}</Tabs.Trigger>)}
        </Tabs.List>
      </Tabs.Root>
      <Hint label={t("viewCreate")}><button className="workspace-button workspace-button--secondary icon-button" type="button" aria-label={t("viewCreate")} disabled={blocked} onClick={event => { trigger.current = event.currentTarget; setDraft({ action: "create", name: "", kind: "table" }); }}><Icon name="plus"/></button></Hint>
      <Menu.Root open={menu} onOpenChange={setMenu} modal={false}>
        <Hint label={`${t("viewActions")}: ${active?.name ?? ""}`}><Menu.Trigger asChild><button ref={menuButton} type="button" className="workspace-button workspace-button--secondary" disabled={blocked || !active}
          aria-label={`${t("viewActions")}: ${active?.name ?? ""}`}><Icon name="more"/></button></Menu.Trigger></Hint>
        <Menu.Portal><Menu.Content className="contextual-panel view-actions" align="end" sideOffset={4} collisionPadding={8}
          onCloseAutoFocus={event => { if (draft || deleting || pending) event.preventDefault(); }}>
      <Menu.Item className="workspace-button workspace-button--secondary" disabled={blocked || !active} onSelect={() => { trigger.current = menuButton.current; setMenu(false); setDraft({ action: "edit", viewId: active!.viewId, name: active!.name, kind: active!.kind }); }}>{t("viewEdit")}</Menu.Item>
      <Menu.Item className="workspace-button workspace-button--secondary" disabled={blocked || !active} onSelect={() => { trigger.current = menuButton.current; setMenu(false); setDraft({ action: "duplicate", viewId: active!.viewId, name: active!.name, kind: active!.kind }); }}>{t("viewDuplicate")}</Menu.Item>
      <Menu.Item className="workspace-button workspace-button--secondary" disabled={blocked || position <= 0} onSelect={() => { setMenu(false); move(-1); }}>{t("viewEarlier")}</Menu.Item>
      <Menu.Item className="workspace-button workspace-button--secondary" disabled={blocked || !snapshot || position >= snapshot.views.length - 1} onSelect={() => { setMenu(false); move(1); }}>{t("viewLater")}</Menu.Item>
      <Menu.Item className="workspace-button workspace-button--secondary" disabled={blocked || !snapshot || snapshot.views.length < 2} onSelect={() => { trigger.current = menuButton.current; setMenu(false); setDeleting(active!.viewId); }}>{t("viewDelete")}</Menu.Item>
        </Menu.Content></Menu.Portal>
      </Menu.Root>
      {projectTabs}
      {tools}
    </div>
    {draft && <form className="view-form" onSubmit={event => { event.preventDefault(); save(); }} onKeyDown={event => { if (event.key === "Escape" && !pending) { event.preventDefault(); close(); } }}>
      <label>{t("viewName")} <input className="workspace-input" ref={input} value={draft.name} disabled={pending || disabled} aria-invalid={error === "viewValidation"} onChange={event => setDraft({ ...draft, name: event.currentTarget.value })} /></label>
      {draft.action !== "duplicate" && <label>{t("viewLayout")} <select className="workspace-input" aria-label={t("viewLayout")} value={draft.kind} disabled={pending || disabled} onChange={event => setDraft({ ...draft, kind: event.currentTarget.value as "table" | "board" })}>
        <option value="table">{t("tableViewTitle")}</option><option value="board">{t("boardViewTitle")}</option>
      </select></label>}
      <button className="workspace-button workspace-button--secondary" type="submit" disabled={pending || disabled}>{t("viewSave")}</button>
      <button className="workspace-button workspace-button--secondary" type="button" disabled={pending} onClick={close}>{t("viewCancel")}</button>
    </form>}
    {deleting && <div className="view-form" onKeyDown={event => { if (event.key === "Escape" && !pending) close(); }}>
      <p>{t("viewDeleteDescription")}</p>
      <button className="workspace-button workspace-button--secondary" type="button" autoFocus disabled={pending || disabled} onClick={() => void mutate({ type: "workspace.deleteView", workspaceId, viewId: deleting })}>{t("viewConfirmDelete")}</button>
      <button className="workspace-button workspace-button--secondary" type="button" disabled={pending} onClick={close}>{t("viewCancel")}</button>
    </div>}
  </section>;
}
