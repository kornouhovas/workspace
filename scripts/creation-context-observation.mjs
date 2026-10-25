// Passive, disposable-fixture diagnosis only. Never focuses, clicks or commands.
export async function installCreationContextObservation(page, parameters) {
  await page.evaluate(({label,sourceId})=>{
    globalThis.creationContextObservation?.dispose();
    const events=[],start=performance.now();let dropped=0,last='';
    const visible=node=>!!node&&node.getClientRects().length>0&&globalThis.getComputedStyle(node).visibility!=='hidden';
    const describe=node=>node?{tag:node.tagName,id:node.getAttribute('id')??'',label:(node.getAttribute('aria-label')??'').slice(0,180)}:null;
    const state=()=>{
      const buttons=[...globalThis.document.querySelectorAll('button')].filter(node=>node.getAttribute('aria-label')===label);
      const target=buttons[0],owners=[],blockers=[];
      for(let node=target,depth=0;node&&depth<32;node=node.parentElement,depth++) {
        if(node.hasAttribute('data-context-return')) {
          const id=node.getAttribute('data-context-return'),trigger=globalThis.document.getElementById(id);
          owners.push({id,hidden:node.hidden,expanded:trigger?.getAttribute('aria-expanded')??null});
        }
        const style=globalThis.getComputedStyle(node);
        if(node.hidden||style.display==='none'||style.visibility==='hidden'||node.inert)
          blockers.push({...describe(node),hidden:node.hidden,display:style.display,visibility:style.visibility,inert:node.inert});
      }
      return {count:buttons.length,visible:visible(target),row:target?.closest('[data-project-id]')?.getAttribute('data-project-id')??null,
        owners,blockers,active:describe(globalThis.document.activeElement),
        dialogs:[...globalThis.document.querySelectorAll('[role="dialog"]')].filter(visible).slice(0,12).map(describe),
        open:[...globalThis.document.querySelectorAll('.context-tools-trigger[aria-expanded="true"]')].slice(0,12).map(describe)};
    };
    const record=(reason,detail=null,force=false)=>{
      const current=state(),encoded=JSON.stringify(current);if(!force&&encoded===last)return;last=encoded;
      if(events.length===96){events.shift();dropped++;}events.push({at:Math.round(performance.now()-start),reason,detail,state:current});
    };
    const mutations=new globalThis.MutationObserver(()=>record('dom'));
    mutations.observe(globalThis.document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','aria-expanded','aria-busy','style','class']});
    const input=event=>record(event.type,describe(event.target instanceof globalThis.Element?event.target:null),true);
    for(const type of ['pointerdown','pointerup','click','focusin'])globalThis.document.addEventListener(type,input,true);
    const stop=globalThis.window.workspace.onWorkspaceChange(event=>{
      if(event.sourceId===sourceId&&['workspace.projectsChanged','workspace.sourceObserved'].includes(event.type))
        record('workspace', {type:event.type,revision:event.revision??null,observationRevision:event.observationRevision??null},true);
    });
    globalThis.creationContextObservation={dispose(){
      mutations.disconnect();stop();for(const type of ['pointerdown','pointerup','click','focusin'])globalThis.document.removeEventListener(type,input,true);
      const result={diagnostic:true,label,events,dropped,final:state()};delete globalThis.creationContextObservation;return result;
    }};
    record('installed',null,true);
  },parameters);
}
export async function collectCreationContextObservation(page) {
  return page.evaluate(()=>globalThis.creationContextObservation?.dispose()??{diagnostic:true,unavailable:true});
}
