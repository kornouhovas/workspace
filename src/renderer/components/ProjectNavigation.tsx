import { useDraftGuard } from "./ScalarDrafts.js";
import { useWorkspaceSession } from "./WorkspaceSession.js";
import type { ViewScrollPosition } from "./useViewScroll.js";
import { useLayoutEffect, useRef, useState } from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import * as Tabs from "@radix-ui/react-tabs";
import type { Language } from "../../contracts/settings.js";
import { Icon } from "./Icons.js";
import { Hint } from "./Hint.js";

export const navigationLabels = {
  en: { preview: "Preview project", project: "Project", expand: "Expand project", returnRight: "Return project to the right", closePreview: "Close preview", close: "Close project tab", tabs: "Project tabs", actions: "Project tab actions", earlier: "Move tab left", later: "Move tab right", others: "Close other project tabs", right: "Close project tabs to the right", reopen: "Reopen closed project", unavailable: "This project is unavailable in the current source. Refresh the source or return to the view.", sidebar: "Sidebar width", projectWidth: "Project area width", collapse: "Collapse sidebar", restore: "Restore sidebar", back: "Back", forward: "Forward", destination: "This destination is no longer available.", retry: "Retry" },
  ru: { preview: "Открыть предпросмотр проекта", project: "Проект", expand: "Развернуть проект", returnRight: "Вернуть проект вправо", closePreview: "Закрыть предпросмотр", close: "Закрыть вкладку проекта", tabs: "Вкладки проектов", actions: "Действия с вкладкой проекта", earlier: "Переместить вкладку влево", later: "Переместить вкладку вправо", others: "Закрыть другие вкладки проектов", right: "Закрыть вкладки проектов справа", reopen: "Открыть закрытый проект", unavailable: "Проект недоступен в текущем источнике. Обновите источник или вернитесь к представлению.", sidebar: "Ширина боковой панели", projectWidth: "Ширина области проекта", collapse: "Свернуть боковую панель", restore: "Восстановить боковую панель", back: "Назад", forward: "Вперёд", destination: "Это назначение больше недоступно.", retry: "Повторить" },
};
type Session = { tabs: string[]; closed: string[]; expanded: string | null; previews: Record<string, string | null> };
export type NavigationMemory = { state?: Session; width?: number; scrolls: Map<string,ViewScrollPosition>; names: Map<string,string> };
export function createNavigationMemory(): NavigationMemory { return {scrolls:new Map(),names:new Map()}; }
export function useProjectNavigation(viewId: string | undefined, memory?: NavigationMemory) {
  const guard = useDraftGuard();
  const persisted = useWorkspaceSession();
  const [local, setLocal] = useState<Session>(()=>memory?.state ?? {tabs:[],closed:[],expanded:null,previews:{}});
  const state: Session = persisted?.state ? { tabs: persisted.state.tabs, expanded: persisted.state.expanded, previews: persisted.state.previews, closed: local.closed } : local;
  const latest = useRef(state); latest.current = state;
  const set = (change: (state: Session) => Session) => {
    const apply = () => {
    const next = change(latest.current); latest.current = next;
    setLocal(next);
    persisted?.update({ tabs: next.tabs, expanded: next.expanded, previews: next.previews });
    };
    if (guard) guard.run(apply); else apply();
  };
  useLayoutEffect(()=>{if(memory) memory.state=state;},[memory,state]);
  const triggers = useRef(new Map<string, HTMLElement>());
  const preview = viewId ? state.previews[viewId] ?? null : null;
  const show = (id: string, trigger?: HTMLElement) => {
    if (!viewId) return;
    if (trigger) triggers.current.set(id, trigger);
    set(s=>({...s,expanded:null,previews:{...s.previews,[viewId]:id}}));
  };
  const expand = (id: string) => set(s=>({...s,expanded:id,tabs:s.tabs.includes(id)?s.tabs:[...s.tabs,id],closed:s.closed.filter(p=>p!==id)}));
  const close = (ids: string[], right = false) => set(s=> {
    const removed=s.tabs.filter(id=>ids.includes(id));
    const activeRemoved=!!s.expanded && removed.includes(s.expanded);
    return {...s,tabs:s.tabs.filter(id=>!ids.includes(id)),closed:[...s.closed.filter(id=>!removed.includes(id)),...removed],expanded:activeRemoved?null:s.expanded,
      previews:right && activeRemoved && viewId ? {...s.previews,[viewId]:s.expanded}:s.previews};
  });
  const move = (id: string, target: string) => set(s=> {
    const from=s.tabs.indexOf(id), to=s.tabs.indexOf(target); if(from<0 || to<0 || from===to) return s;
    const tabs=[...s.tabs]; tabs.splice(to,0,...tabs.splice(from,1)); return {...s,tabs};
  });
  const focusView = () => { const focus = () => { window.requestAnimationFrame(()=> {
    const id=state.expanded ?? preview;
    const trigger=id ? triggers.current.get(id):null;
    (trigger?.isConnected && !trigger.closest('[hidden]') ? trigger : document.getElementById(`saved-view-${viewId}`))?.focus({preventScroll:true});
  }); }; if (guard) guard.run(focus); else focus(); };
  return { ...state, preview, show, expand, close, move, focusView,
    selectView:()=>set(s=>({...s,expanded:null})),
    closePreview:()=>{if(viewId) set(s=>({...s,previews:{...s.previews,[viewId]:null}})); focusView();},
    reopen:()=>set(s=>{const id=s.closed.at(-1);return id?{...s,tabs:s.tabs.includes(id)?s.tabs:[...s.tabs,id],closed:s.closed.filter(p=>p!==id),expanded:id}:s;}),
  };
}
export type ProjectNavigation = ReturnType<typeof useProjectNavigation>;
export function ProjectTabs({session,language,name,disabled}: {session:ProjectNavigation;language:Language;name(id:string):string;disabled:boolean}) {
  const l=navigationLabels[language];
  const drag=useRef<string|null>(null);
  return <div className="project-tabs">
    <Tabs.Root value={session.expanded ?? ""} activationMode="manual" onValueChange={session.expand}>
      <Tabs.List aria-label={l.tabs} className="retained-project-tabs">
        {session.tabs.map((id,index)=><div className="project-tab" key={id} draggable={!disabled}
          onDragStart={event=>{drag.current=id;event.dataTransfer.setData("application/x-workspace-project-tab",id);event.dataTransfer.effectAllowed="move";}}
          onDragEnd={()=>{drag.current=null;}}
          onDragOver={event=>{if(drag.current)event.preventDefault();}}
          onDrop={event=>{event.preventDefault();if(!disabled && drag.current)session.move(drag.current,id);drag.current=null;}}>
          <Tabs.Trigger className="saved-view-tab" value={id} disabled={disabled} title={name(id)} data-project-tab={id}><Icon name="folder"/>{name(id)}</Tabs.Trigger>
          <Hint label={`${l.close}: ${name(id)}`}><button className="tab-close icon-button" type="button" disabled={disabled} aria-label={`${l.close}: ${name(id)}`} onClick={()=>{session.close([id]);session.focusView();}}><Icon name="close"/></button></Hint>
          <Menu.Root modal={false}><Hint label={`${l.actions}: ${name(id)}`}><Menu.Trigger asChild><button type="button" className="tab-menu icon-button" disabled={disabled} aria-label={`${l.actions}: ${name(id)}`}><Icon name="more"/></button></Menu.Trigger></Hint>
            <Menu.Portal><Menu.Content className="contextual-panel view-actions" sideOffset={4} collisionPadding={8} onCloseAutoFocus={event=>{if(!session.tabs.includes(id))event.preventDefault();}}>
              {([
                [l.earlier,index===0,()=>session.move(id,session.tabs[index-1])],
                [l.later,index===session.tabs.length-1,()=>session.move(id,session.tabs[index+1])],
                [l.close,false,()=>{session.close([id]);session.focusView();}],
                [l.others,session.tabs.length<2,()=>{session.close(session.tabs.filter(p=>p!==id));session.focusView();}],
                [l.right,index===session.tabs.length-1,()=>{session.close(session.tabs.slice(index+1));session.focusView();}],
                [l.reopen,!session.closed.length,session.reopen],
              ] as const).map(([label,blocked,action])=><Menu.Item className="workspace-button workspace-button--secondary" disabled={blocked} key={label} onSelect={action}>{label}</Menu.Item>)}
            </Menu.Content></Menu.Portal>
          </Menu.Root>
        </div>)}
      </Tabs.List>
    </Tabs.Root>
    <Hint label={l.reopen}><button type="button" className="workspace-button workspace-button--secondary icon-button" disabled={disabled || !session.closed.length} aria-label={l.reopen} onClick={session.reopen}><Icon name="reopen"/></button></Hint>
  </div>;
}
