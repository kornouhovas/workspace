/* global requestAnimationFrame */
import assert from 'node:assert/strict';
import {withDeadline} from './runtime-lifecycle.mjs';

// Native group gestures keep their real pointer and original result assertions.
export async function dragRuntimeGroup(source, destination) {
  await source.scrollIntoViewIfNeeded();
  await destination.scrollIntoViewIfNeeded();
  // Scrolling after mouse-down can cancel Chromium's native drag before
  // dragstart. An endpoint still outside the viewport must fail, never replay.
  await source.dragTo(destination, {scroll: 'none'});
}

export async function waitForDragHandleBounds(handle, timeoutMs = 15000) {
  const deadline=performance.now()+timeoutMs;
  while(true) {
    const remaining=deadline-performance.now();
    assert.ok(remaining>0,'Drag handle did not present bounds within its readiness deadline');
    const bounds=await withDeadline(handle.evaluate(async(element,timeout)=>{
      const expires=performance.now()+timeout;
      const frame=()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));
      const read=()=>{const r=element.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
      const usable=()=>element.isConnected&&!element.disabled&&element.checkVisibility();
      const equal=(a,b)=>Object.keys(a).every(key=>a[key]===b[key]);
      while(element.isConnected&&performance.now()<expires) {
        if(!usable()){await frame();continue;}
        const before=read();
        if(before.width<=0||before.height<=0){await frame();continue;}
        await frame();if(!usable())continue;
        const next=read();if(!equal(before,next))continue;
        await frame();if(usable()){const current=read();if(equal(next,current))return current;}
      }
      return null;
    },remaining,{timeout:remaining}),remaining,'Drag handle presentation');
    if(bounds){assert.ok(performance.now()<=deadline,'Drag handle preparation exceeded its readiness deadline');return bounds;}
  }
}
