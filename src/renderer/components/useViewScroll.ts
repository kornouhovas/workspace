import { useLayoutEffect, useRef, useState } from "react";
export type ViewScrollPosition = { top: number; left: number; children: {top:number;left:number}[] };
const scrollAreas = (element: HTMLElement) => Array.from(element.querySelectorAll<HTMLElement>(".project-table-scroll, .grouped-board"));

// Restore after the selected view's asynchronous projection has painted. A
// collapsed/temporarily empty projection must not overwrite its saved position.
export function useViewScroll(viewId: string | undefined, expanded: boolean, positions: Map<string,ViewScrollPosition>) {
  const element = useRef<HTMLDivElement>(null);
  const paused=useRef(false);
  const [epoch,setEpoch]=useState(0);
  const restoring = useRef<ViewScrollPosition | null>(null);
  const save = () => {
    if (!viewId || expanded || paused.current || restoring.current || !element.current) return;
    positions.set(viewId, {top:element.current.scrollTop,left:element.current.scrollLeft,
      children:scrollAreas(element.current).map(child=>({top:child.scrollTop,left:child.scrollLeft}))});
  };
  useLayoutEffect(()=>{
    const owner = element.current;
    if (!owner || expanded) return;
    const target = positions.get(viewId ?? "") ?? {top:0,left:0,children:[]};
    restoring.current=target;
    owner.dataset.scrollRestoring="true";
    let frame=0;
    const restore = () => {
      if(restoring.current !== target) return;
      window.cancelAnimationFrame(frame);
      const ready=!owner.querySelector('[aria-busy="true"]');
      const bounded=(value:number,extent:number,viewport:number)=>ready ? Math.min(value,Math.max(0,extent-viewport)):value;
      const apply=()=>{
        const top=bounded(target.top,owner.scrollHeight,owner.clientHeight);
        const left=bounded(target.left,owner.scrollWidth,owner.clientWidth);
        owner.scrollTop=top;owner.scrollLeft=left;
        const children=scrollAreas(owner);
        let placed=owner.scrollTop===top && owner.scrollLeft===left;
        children.forEach((child,index)=>{
          const position=target.children[index] ?? {top:0,left:0};
          const childTop=bounded(position.top,child.scrollHeight,child.clientHeight);
          const childLeft=bounded(position.left,child.scrollWidth,child.clientWidth);
          child.scrollTop=childTop;child.scrollLeft=childLeft;
          placed &&= child.scrollTop===childTop && child.scrollLeft===childLeft;
        });
        return placed && (ready || children.length>=target.children.length);
      };
      const placed=apply();
      if(ready && placed)frame=window.requestAnimationFrame(()=>{
        frame=window.requestAnimationFrame(()=>{
          if(restoring.current!==target)return;
          apply();restoring.current=null;delete owner.dataset.scrollRestoring;
        });
      });
    };
    restore();
    const observer=new MutationObserver(restore);
    observer.observe(owner,{subtree:true,childList:true,attributes:true,attributeFilter:["aria-busy","style"]});
    const resize=typeof ResizeObserver === "undefined"?null:new ResizeObserver(restore);
    resize?.observe(owner);
    return ()=>{window.cancelAnimationFrame(frame);observer.disconnect();resize?.disconnect();delete owner.dataset.scrollRestoring;};
  },[viewId,expanded,positions,epoch]);
  return {element,save, suspend:()=>{if(!paused.current)save();paused.current=true;}, resume:()=>{paused.current=false;setEpoch(value=>value+1);},cancelRestore:()=>{restoring.current=null;if(element.current)delete element.current.dataset.scrollRestoring;}};
}
