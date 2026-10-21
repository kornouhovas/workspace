import { cloneElement, useEffect, useId, useLayoutEffect, useRef, useState, type ReactElement, type HTMLAttributes } from "react";
import { createPortal } from "react-dom";

/** Noninteractive hints never consume Escape or take focus from their action. */
export function Hint({label,children}: {label:string;children:ReactElement}) {
  const id=useId();
  const [open,setOpen]=useState(false);
  const [position,setPosition]=useState({left:8,top:8});
  const anchor=useRef<HTMLElement | null>(null);
  const content=useRef<HTMLSpanElement>(null);
  const timer=useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelTimer=()=>{if(timer.current!==null) clearTimeout(timer.current);timer.current=null;};
  const hide=()=>{cancelTimer();setOpen(false);};
  useEffect(()=>()=>cancelTimer(),[]);
  useEffect(()=>{
    if(!open) return;
    const dismiss=(event:KeyboardEvent)=>{if(event.key==="Escape") setOpen(false);};
    const scroll=()=>setOpen(false);
    document.addEventListener("keydown",dismiss);
    window.addEventListener("scroll",scroll,true);window.addEventListener("resize",scroll);
    return ()=>{document.removeEventListener("keydown",dismiss);window.removeEventListener("scroll",scroll,true);window.removeEventListener("resize",scroll);};
  },[open]);
  useLayoutEffect(()=>{
    const rect=anchor.current?.getBoundingClientRect(), box=content.current?.getBoundingClientRect();
    if(open && rect && box) setPosition({left:Math.max(8,Math.min(rect.left,window.innerWidth-box.width-8)),top:Math.max(8,rect.bottom+6+box.height<window.innerHeight?rect.bottom+6:rect.top-box.height-6)});
  },[open,label]);
  const target=children as ReactElement<HTMLAttributes<HTMLElement>>;
  return <>{cloneElement(target,{
    "aria-describedby":open ? [target.props["aria-describedby"],id].filter(Boolean).join(" ") : target.props["aria-describedby"],
    onPointerEnter:event=>{target.props.onPointerEnter?.(event);anchor.current=event.currentTarget;cancelTimer();timer.current=setTimeout(()=>setOpen(true),400);},
    onPointerLeave:event=>{target.props.onPointerLeave?.(event);hide();},
    onPointerDown:event=>{target.props.onPointerDown?.(event);hide();},
    onFocus:event=>{target.props.onFocus?.(event);anchor.current=event.currentTarget;cancelTimer();setOpen(true);},
    onBlur:event=>{target.props.onBlur?.(event);hide();},
  })}{open && createPortal(<span id={id} ref={content} role="tooltip" className="control-hint" style={{position:"fixed",pointerEvents:"none",...position}}>{label}</span>,document.body)}</>;
}
