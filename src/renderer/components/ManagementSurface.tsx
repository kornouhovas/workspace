import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ContextTools } from "./ContextTools.js";

// Relocate management presentation without relocating its owning controllers.
// Pending operations, subscriptions and drafts keep their original lifetimes.
const ManagementContext = createContext<{
  viewTarget: HTMLDivElement | null;
  setViewTarget(target: HTMLDivElement | null): void;
  target: HTMLDivElement | null;
  setTarget(target: HTMLDivElement | null): void;
} | null>(null);
const ViewControlsVisible=createContext(true);

export function ViewControlsScope({visible,children}: {visible:boolean;children:ReactNode}) {
  return <ViewControlsVisible.Provider value={visible}>{children}</ViewControlsVisible.Provider>;
}
export function useViewControlsVisible() { return useContext(ViewControlsVisible); }

export function ManagementSurface({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  const [viewTarget,setViewTarget]=useState<HTMLDivElement | null>(null);
  return <ManagementContext.Provider value={{ target, setTarget, viewTarget, setViewTarget }}>{children}</ManagementContext.Provider>;
}

export function ManagementTarget() {
  const context = useContext(ManagementContext);
  return <div className="source-management" ref={context?.setTarget} />;
}

export function ManagementHistory({ children }: { children: ReactNode }) {
  const context = useContext(ManagementContext);
  if (!context) return children;
  return context.target ? createPortal(children, context.target) : null;
}

export function ViewToolsTarget({label,hidden=false}: {label:string;hidden?:boolean}) {
  const context=useContext(ManagementContext);
  return <div className="view-tools-entry" hidden={hidden}><ContextTools label={label} icon="properties" compact>
    <div className="view-settings-controls" ref={context?.setViewTarget}/>
  </ContextTools></div>;
}

export function ViewControls({children}: {children:ReactNode}) {
  const context=useContext(ManagementContext);
  const visible=useContext(ViewControlsVisible);
  if(!context) return children;
  return context.viewTarget ? createPortal(<div className="view-controls-scope" hidden={!visible} aria-hidden={!visible}>{children}</div>,context.viewTarget) : null;
}
