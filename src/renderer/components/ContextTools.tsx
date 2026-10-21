import { useEffect, useLayoutEffect, useRef, useState, useId, type ReactNode, type KeyboardEvent } from "react";
import { Hint } from "./Hint.js";
import { Icon } from "./Icons.js";
/** Nonmodal tools keep controllers mounted, including drafts and pending receipts. */
export function ContextTools({label,children,icon="more",compact=false,disabled=false,onEscape,inline=false}: {
  label:string;children:ReactNode;icon?:"more"|"properties"|"settings";compact?:boolean;disabled?:boolean;inline?:boolean;onEscape?(event:KeyboardEvent<HTMLDivElement>):void;
}) {
  const [open,setOpen]=useState(false);
  const triggerId=useId();
  const [position,setPosition]=useState({left:12,top:12});
  const panel=useRef<HTMLDivElement>(null);
  const trigger=useRef<HTMLButtonElement>(null);
  const close=(focus=false)=>{setOpen(false);if(focus) trigger.current?.focus({preventScroll:true});};
  useLayoutEffect(()=>{
    if(!open) return;
    const place=()=>{
      const anchor=trigger.current?.getBoundingClientRect(), box=panel.current?.getBoundingClientRect();
      if(anchor && box) {
        const next={left:Math.max(12,Math.min(anchor.left,window.innerWidth-box.width-12)),top:Math.max(12,Math.min(anchor.bottom+6,window.innerHeight-box.height-12))};
        setPosition(current=>current.left===next.left && current.top===next.top ? current : next);
      }
    };
    const resize=typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    if(panel.current) resize?.observe(panel.current);
    place();window.addEventListener("resize",place);window.addEventListener("scroll",place,true);
    return ()=>{resize?.disconnect();window.removeEventListener("resize",place);window.removeEventListener("scroll",place,true);};
  },[open]);
  useEffect(()=>{
    if(!open) return;
    (panel.current?.querySelector<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), summary') ?? panel.current)?.focus({preventScroll:true});
    const outside=(event:PointerEvent)=>{if(event.target instanceof Node && !panel.current?.contains(event.target) && !trigger.current?.contains(event.target)) close();};
    document.addEventListener("pointerdown",outside);
    return ()=>document.removeEventListener("pointerdown",outside);
  },[open]);
  if(inline) return <div className="context-tools-inline">{children}</div>;
  return <>
    <Hint label={label}><button id={triggerId} ref={trigger} type="button" className={`workspace-button workspace-button--secondary context-tools-trigger${compact ? " icon-button" : ""}`} disabled={disabled} aria-label={label} aria-expanded={open} aria-controls={`${triggerId}-tools`} aria-haspopup="dialog" onClick={()=>setOpen(!open)}>
      <Icon name={icon}/>{!compact && <span>{label}</span>}
    </button></Hint>
    <div id={`${triggerId}-tools`} ref={panel} hidden={!open} role="dialog" tabIndex={-1} className="contextual-panel context-tools-panel" data-context-return={triggerId} aria-label={label} style={position}
      onClick={event=>{if(event.target instanceof HTMLElement && event.target.closest("[data-close-context]")) close();}}
      onKeyDown={event=>{if(event.key==="Escape") onEscape?.(event); if(event.key==="Escape" && !event.defaultPrevented){event.preventDefault();event.stopPropagation();close(true);}}}>
      <h3>{label}</h3>{children}
    </div>
  </>;
}

export function contextReturnTarget(element: HTMLButtonElement): HTMLButtonElement {
  const id=element.closest("[data-context-return]")?.getAttribute("data-context-return");
  const trigger=id ? document.getElementById(id) : null;
  return trigger?.tagName === "BUTTON" ? trigger as HTMLButtonElement : element;
}
