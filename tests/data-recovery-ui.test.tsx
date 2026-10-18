import test from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { DataRecoveryPanel } from "../src/renderer/components/DataRecoveryPanel.js";
import type { WorkspaceServiceClient } from "../src/renderer/workspace-service-client.js";
import { translate } from "../src/renderer/localization.js";
const browser=new Window();
Object.assign(globalThis,{window:browser,document:browser.document,HTMLElement:browser.HTMLElement,Node:browser.Node,MutationObserver:browser.MutationObserver});
Object.defineProperty(globalThis,"navigator",{configurable:true,value:browser.navigator});
const {render,screen,cleanup,waitFor}=await import("@testing-library/react");
const {default:userEvent}=await import("@testing-library/user-event");
for(const language of ["en","ru"] as const) test(`${language} file confirmation, keyboard cancel, pending and failure preserve state`,{timeout:10000},async()=>{
 let restores=0,reloaded=0,locked=false;
 const client={restoreData:async()=>{restores++;return{ok:false,error:{code:"invalid_input"}};}} as unknown as WorkspaceServiceClient;
 const t=(key:Parameters<typeof translate>[1])=>translate(language,key),user=userEvent.setup({document});
 try{
  render(<DataRecoveryPanel client={client} language={language} onRestored={()=>{reloaded++;}} onLock={v=>{locked=v;}}/>);
  await user.click(screen.getByText(t("dataTitle")));
  assert.ok(screen.getByText(t("dataScope")));
  await user.upload(screen.getByLabelText(t("dataFile")),new File(['snapshot'],"export.json",{type:"application/json"}) as unknown as File);
  await screen.findByText(t("dataReplace"));assert.equal(locked,true);assert.equal(restores,0);
  await user.keyboard('{Escape}');await waitFor(()=>assert.equal(locked,false));
  assert.equal(document.activeElement,screen.getByLabelText(t("dataFile")));
  await user.upload(screen.getByLabelText(t("dataFile")),new File(['invalid'],"export.json",{type:"application/json"}) as unknown as File);
  const button=await screen.findByRole('button',{name:t("dataConfirm")});button.focus();await user.keyboard('{Enter}');
  await screen.findByRole('alert');assert.equal(restores,1);assert.equal(reloaded,0);
 }finally{cleanup();}
});

test('unknown transport outcome disables replay and offers reload',{timeout:10000},async()=>{
 let restores=0,reloaded=0;
 const client={restoreData:async()=>{restores++;throw new Error('Lost response');}} as unknown as WorkspaceServiceClient;
 const user=userEvent.setup({document});
 try{
  render(<DataRecoveryPanel client={client} language="en" onRestored={()=>{reloaded++;}} onLock={()=>{}}/>);
  await user.click(screen.getByText(translate("en","dataTitle")));
  await user.upload(screen.getByLabelText(translate('en','dataFile')),new File(['data'],'export.json',{type:'application/json'}) as unknown as File);
  await user.click(await screen.findByRole('button',{name:translate('en','dataConfirm')}));
  await screen.findByText(translate('en','dataUnknown'));
  assert.equal((screen.getByRole('button',{name:translate('en','dataConfirm')}) as HTMLButtonElement).disabled,true);
  await user.click(screen.getByRole('button',{name:translate('en','dataReload')}));assert.equal(reloaded,1);assert.equal(restores,1);
 }finally{cleanup();}
});

test('pending restore disables actions and a late success after unmount cannot reload another screen', {timeout:10000}, async()=>{
 let resolve!: (value:unknown)=>void, reloads=0, locked=false;
 const client={restoreData:()=>new Promise(r=>{resolve=r;})} as unknown as WorkspaceServiceClient;
 const user=userEvent.setup({document});
 try{
  const view=render(<DataRecoveryPanel client={client} language="en" onRestored={()=>{reloads++;}} onLock={v=>{locked=v;}}/>);
  await user.click(screen.getByText(translate('en','dataTitle')));
  await user.upload(screen.getByLabelText(translate('en','dataFile')),new File(['data'],'export.json',{type:'application/json'}));
  await user.click(await screen.findByRole('button',{name:translate('en','dataConfirm')}));
  assert.ok(screen.getByText(translate('en','dataBusy')));
  assert.equal((screen.getByRole('button',{name:translate('en','dataCancel')}) as HTMLButtonElement).disabled,true);
  view.unmount();assert.equal(locked,false);resolve({ok:true,value:{restored:true}});await Promise.resolve();assert.equal(reloads,0);
 }finally{cleanup();}
});
