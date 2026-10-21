import { useEffect, useRef } from "react";
export function AreaResize({label,value,min,max,onChange,reverse=false}: {label:string;value:number;min:number;max:number;onChange(value:number):void;reverse?:boolean}) {
  const stop=useRef<(()=>void)|null>(null);
  useEffect(()=>()=>stop.current?.(),[]);
  const clamp=(width:number)=>Math.max(min,Math.min(max,width));
  return <div className="area-resize" role="separator" tabIndex={0} aria-label={label} aria-orientation="vertical" aria-valuemin={min} aria-valuemax={max} aria-valuenow={Math.round(value)}
    onKeyDown={event=>{let next=value;if(event.key==="ArrowLeft")next-=16;if(event.key==="ArrowRight")next+=16;if(event.key==="Home")next=min;if(event.key==="End")next=max;if(next!==value){event.preventDefault();onChange(clamp(next));}}}
    onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();event.currentTarget.focus();stop.current?.();const start=event.clientX;
      const move=(e:PointerEvent)=>onChange(clamp(value+(e.clientX-start)*(reverse?-1:1)));
      const finish=()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",finish);window.removeEventListener("pointercancel",finish);stop.current=null;};
      stop.current=finish;window.addEventListener("pointermove",move);window.addEventListener("pointerup",finish);window.addEventListener("pointercancel",finish);
    }}/>;
}
