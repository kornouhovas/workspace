import { useDraftGuard } from "./ScalarDrafts.js";
import { Hint } from "./Hint.js";
import { Icon } from "./Icons.js";
import * as Menu from "@radix-ui/react-dropdown-menu";
import * as Tabs from "@radix-ui/react-tabs";
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
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
  const [menuViewId, setMenuViewId] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ viewId: string; from: number; to: number; delta: number; width: number } | null>(null);
  const dragGesture = useRef<{ viewId: string; from: number; startX: number; width: number; centers: number[]; moved: boolean; to: number } | null>(null);
  const suppressClick = useRef(false);
  const pointerSelecting = useRef(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const version = useRef(0), lifetime = useRef(0), busy = useRef(false);
  const current = useRef(onChange); current.current = onChange;
  const willLoad=useRef(onWillLoad);willLoad.current=onWillLoad;
  const input = useRef<HTMLInputElement>(null), select = useRef<HTMLButtonElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null), restoreFocus = useRef(false);
  const active = snapshot?.views.find(view => view.viewId === snapshot.activeViewId);
  const menuView = snapshot?.views.find(view => view.viewId === menuViewId) ?? active;
  const position = snapshot?.views.findIndex(view => view.viewId === menuView?.viewId) ?? -1;
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
  const beginDrag = (event: PointerEvent<HTMLButtonElement>, viewId: string, index: number) => {
    if (event.button !== 0 || blocked || !snapshot) return;
    suppressClick.current = false;
    const tabs = Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? []);
    const boxes = tabs.map(tab => tab.getBoundingClientRect());
    dragGesture.current = { viewId, from: index, startX: event.clientX, width: boxes[index].width + 2, centers: boxes.map(box => box.left + box.width / 2), moved: false, to: index };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const updateDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const gesture = dragGesture.current;
    if (!gesture) return;
    const delta = event.clientX - gesture.startX;
    if (!gesture.moved && Math.abs(delta) < 5) return;
    gesture.moved = true;
    const center = gesture.centers[gesture.from] + delta;
    gesture.to = gesture.centers.slice(1).filter((value, index) => center > (gesture.centers[index] + value) / 2).length;
    setDrag({ viewId: gesture.viewId, from: gesture.from, to: gesture.to, delta, width: gesture.width });
  };
  const finishDrag = (event: PointerEvent<HTMLButtonElement>, cancelled = false) => {
    const gesture = dragGesture.current;
    if (!gesture) return;
    dragGesture.current = null; setDrag(null); pointerSelecting.current = false;
    if (!gesture.moved) return;
    suppressClick.current = true;
    if (!cancelled && gesture.to !== gesture.from && snapshot) {
      const ids = snapshot.views.map(view => view.viewId);
      ids.splice(gesture.to, 0, ids.splice(gesture.from, 1)[0]);
      trigger.current = event.currentTarget;
      mutate({ type: "workspace.reorderViews", workspaceId, viewIds: ids });
    }
  };
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => { if (event.key === "Escape" && dragGesture.current?.moved) { event.preventDefault(); dragGesture.current = null; setDrag(null); pointerSelecting.current = false; suppressClick.current = true; } };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, []);
  const move = (offset: number) => {
    if (!snapshot || position < 0) return;
    trigger.current = menuButton.current;
    const viewIds = snapshot.views.map(v => v.viewId);
    [viewIds[position], viewIds[position + offset]] = [viewIds[position + offset], viewIds[position]];
    void mutate({ type: "workspace.reorderViews", workspaceId, viewIds });
  };
  return <section className="views-panel" aria-label={t("viewsTitle")} aria-busy={pending || loading}>
    {loading && !snapshot && <StatusMessage kind="info" title={t("viewsLoading")} />}
    {error && <StatusMessage kind="error" title={t(error)} />}
    {error && <button className="workspace-button workspace-button--secondary" type="button" disabled={loading || pending} onClick={() => void load()}>{t("viewsRetry")}</button>}
    <div className="view-controls">
      <Tabs.Root value={projectActive ? "" : snapshot?.activeViewId ?? ""} activationMode="manual" onValueChange={viewId => { if (pointerSelecting.current) return; transition(() => { onSelectView?.(); if(viewId !== snapshot?.activeViewId) void mutate({ type: "workspace.activateView", workspaceId, viewId }); }); }}>
        <Tabs.List className="saved-view-tabs" aria-label={t("viewCurrent")}>
          {snapshot?.views.map((view, index) => {
            let shift = 0;
            if (drag) {
              if (drag.viewId === view.viewId) shift = drag.delta;
              else if (drag.from < drag.to && index > drag.from && index <= drag.to) shift = -drag.width;
              else if (drag.from > drag.to && index >= drag.to && index < drag.from) shift = drag.width;
            }
            return <Tabs.Trigger className="saved-view-tab" key={view.viewId} value={view.viewId} id={`saved-view-${view.viewId}`} aria-controls={panelId} disabled={blocked}
              style={{ transform: shift ? `translateX(${shift}px)` : undefined, transition: drag?.viewId === view.viewId ? "none" : "transform 150ms ease", zIndex: drag?.viewId === view.viewId ? 1 : undefined }}
              onMouseDownCapture={event => { if (event.button === 0) pointerSelecting.current = true; }}
              onClick={event => { pointerSelecting.current = false; if (suppressClick.current) { suppressClick.current = false; event.preventDefault(); return; } event.currentTarget.focus(); transition(() => { onSelectView?.(); if (view.viewId !== snapshot.activeViewId) mutate({ type: "workspace.activateView", workspaceId, viewId: view.viewId }); }); }}
              onPointerDown={event => beginDrag(event, view.viewId, index)} onPointerMove={updateDrag} onPointerUp={event => finishDrag(event)} onPointerCancel={event => finishDrag(event, true)}
              onContextMenu={event => { event.preventDefault(); if (!blocked) { trigger.current = event.currentTarget; setMenuViewId(view.viewId); setMenu(true); } }}
              ref={view.viewId === snapshot.activeViewId ? select : undefined}><Icon name={view.kind === "table" ? "table" : "board"}/>{view.name}</Tabs.Trigger>;
          })}
        </Tabs.List>
      </Tabs.Root>
      <Menu.Root modal={false}>
        <Hint label={t("viewCreate")}><Menu.Trigger asChild><button className="workspace-button workspace-button--secondary icon-button" type="button" aria-label={t("viewCreate")} disabled={blocked} onClick={event => { trigger.current = event.currentTarget; }}><Icon name="plus"/></button></Menu.Trigger></Hint>
        <Menu.Portal><Menu.Content className="contextual-panel view-actions" align="start" sideOffset={4} collisionPadding={8}>
          {(["board", "table"] as const).map(kind => <Menu.Item key={kind} className="workspace-button workspace-button--secondary" onSelect={() => mutate({ type: "workspace.createView", workspaceId, name: kind === "board" ? "Board" : "Table", kind })}>{t(kind === "board" ? "boardViewTitle" : "tableViewTitle")}</Menu.Item>)}
        </Menu.Content></Menu.Portal>
      </Menu.Root>
      <Menu.Root open={menu} onOpenChange={setMenu} modal={false}>
        <Hint label={`${t("viewActions")}: ${active?.name ?? ""}`}><Menu.Trigger asChild><button ref={menuButton} type="button" className="workspace-button workspace-button--secondary" disabled={blocked || !active}
          aria-label={`${t("viewActions")}: ${active?.name ?? ""}`} onPointerDown={() => { setMenuViewId(snapshot?.activeViewId ?? null); trigger.current = menuButton.current; }} onKeyDown={() => { setMenuViewId(snapshot?.activeViewId ?? null); trigger.current = menuButton.current; }}><Icon name="more"/></button></Menu.Trigger></Hint>
        <Menu.Portal><Menu.Content className="contextual-panel view-actions" align="end" sideOffset={4} collisionPadding={8}
          onCloseAutoFocus={event => { if (draft || deleting || pending) event.preventDefault(); }}>
      <Menu.Item className="workspace-button workspace-button--secondary" disabled={blocked || !active} onSelect={() => { trigger.current = trigger.current ?? menuButton.current; setMenu(false); setDraft({ action: "edit", viewId: menuView!.viewId, name: menuView!.name, kind: menuView!.kind }); }}>{t("viewEdit")}</Menu.Item>
      <Menu.Item className="workspace-button workspace-button--secondary" disabled={blocked || !active} onSelect={() => { trigger.current = trigger.current ?? menuButton.current; setMenu(false); setDraft({ action: "duplicate", viewId: menuView!.viewId, name: menuView!.name, kind: menuView!.kind }); }}>{t("viewDuplicate")}</Menu.Item>
      <Menu.Item className="workspace-button workspace-button--secondary" disabled={blocked || position <= 0} onSelect={() => { setMenu(false); move(-1); }}>{t("viewEarlier")}</Menu.Item>
      <Menu.Item className="workspace-button workspace-button--secondary" disabled={blocked || !snapshot || position >= snapshot.views.length - 1} onSelect={() => { setMenu(false); move(1); }}>{t("viewLater")}</Menu.Item>
      <Menu.Item className="workspace-button workspace-button--secondary" disabled={blocked || !snapshot || snapshot.views.length < 2} onSelect={() => { trigger.current = trigger.current ?? menuButton.current; setMenu(false); setDeleting(menuView!.viewId); }}>{t("viewDelete")}</Menu.Item>
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
