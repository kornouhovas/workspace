import assert from 'node:assert/strict';
import {withDeadline} from './runtime-lifecycle.mjs';
// Navigate to an unsubmitted removal confirmation using the stable workspace ID.
// Session updates may consume a tools gesture; no removal command is replayed.
export async function enterWorkspaceRemoval(page,workspaceId,name) {
 const confirm=page.getByRole('button',{name:/^(Remove configuration|Удалить конфигурацию)$/});
 const group=page.getByRole('group',{name:new RegExp(`^(Workspace actions|Действия с рабочим пространством): ${name}$`)});
 const row=page.locator('.sidebar-workspace-row').filter({has:page.locator(`button[data-workspace-id="${workspaceId}"]`)});
 const deadline=Date.now()+15000;
 while(!await confirm.isVisible()){
  const left=()=>{const ms=deadline-Date.now();assert.ok(ms>0,'Workspace removal entry exceeded15000ms');return Math.min(1000,ms);};
  try{
   if(!await group.isVisible()){
    await row.getByRole('button',{name:/^(Workspace actions|Действия с рабочим пространством):/}).and(page.locator(':enabled')).press('Enter',{timeout:left()});
    await group.waitFor({timeout:left()});
   }
   await group.getByRole('button',{name:/^(Remove workspace|Удалить рабочее пространство)$/}).and(page.locator(':enabled')).press('Enter',{timeout:left()});
   await confirm.waitFor({timeout:left()});
  }catch(error){if(Date.now()>=deadline)throw error;}
 }
 // Preserve a live enabled guard through the caller's single Enter gesture.
 return confirm.and(page.locator(':enabled'));
}

// A contextual activation can expose the rename form before its reply unlocks
// it. Disabled inputs cannot accept a human Escape; wait for that public control.
export async function cancelWorkspaceRename(page,input) {
 const deadline=Date.now()+15000;
 await input.and(page.locator(':enabled')).press('Escape',{timeout:15000});
 await input.waitFor({state:'hidden',timeout:Math.max(1,deadline-Date.now())});
}

// waitForFunction on pinned Playwright treats an async predicate's Promise as
// truthy. Await the public read in an explicit bounded loop; never replay Submit.
export async function waitForWorkspaceRemoval(page,workspaceId,remaining) {
 const deadline=Date.now()+15000;
 await withDeadline(page.evaluate(async({workspaceId,remaining})=>{
  const deadline=Date.now()+15000;
  while(Date.now()<deadline){
   const result=await globalThis.workspace.workspace({type:'workspace.load'});
   if(result.ok&&result.value.workspaces.length===remaining&&!result.value.workspaces.some(workspace=>workspace.workspaceId===workspaceId))return;
   await new Promise(resolve=>setTimeout(resolve,25));
  }
  throw new Error('Workspace removal outcome exceeded15000ms');
 },{workspaceId,remaining}),15000,'Workspace removal outcome');
 // The accepted service effect can precede React's reply handling. Do not hide
 // a still-pending confirmation or start another workspace's entry meanwhile.
 await page.locator('.workspace-removal').waitFor({state:'hidden',timeout:Math.max(1,deadline-Date.now())});
}
