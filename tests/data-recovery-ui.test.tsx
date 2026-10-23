import test from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import type { WorkspaceServiceClient } from "../src/renderer/workspace-service-client.js";
import { translate } from "../src/renderer/localization.js";
const browser=new Window();
Object.assign(globalThis,{window:browser,document:browser.document,HTMLElement:browser.HTMLElement,Node:browser.Node,MutationObserver:browser.MutationObserver, CustomEvent:browser.CustomEvent, getComputedStyle:browser.getComputedStyle.bind(browser), HTMLInputElement:browser.HTMLInputElement});
Object.defineProperty(globalThis,"navigator",{configurable:true,value:browser.navigator});
const { DataRecoveryPanel } = await import("../src/renderer/components/DataRecoveryPanel.js");
const {render,screen,cleanup,waitFor}=await import("@testing-library/react");
const {default:userEvent}=await import("@testing-library/user-event");
for(const language of ["en","ru"] as const) test(`${language} file confirmation, keyboard cancel, pending and failure preserve state`,{timeout:10000},async()=>{
 let restores=0,reloaded=0,locked=false;
 const client={backups:async()=>({ok:true,value:{backups:{state:"ready",destination:"/temporary/backups",snapshots:[]}}}),restoreData:async()=>{restores++;return{ok:false,error:{code:"invalid_input"}};}} as unknown as WorkspaceServiceClient;
 const t=(key:Parameters<typeof translate>[1])=>translate(language,key),user=userEvent.setup({document});
 try{
  render(<DataRecoveryPanel client={client} language={language} onRestored={()=>{reloaded++;}} onLock={v=>{locked=v;}}/>);
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
 const client={backups:async()=>({ok:true,value:{backups:{state:"ready",destination:"/temporary/backups",snapshots:[]}}}),restoreData:async()=>{restores++;throw new Error('Lost response');}} as unknown as WorkspaceServiceClient;
 const user=userEvent.setup({document});
 try{
  render(<DataRecoveryPanel client={client} language="en" onRestored={()=>{reloaded++;}} onLock={()=>{}}/>);
  await user.upload(screen.getByLabelText(translate('en','dataFile')),new File(['data'],'export.json',{type:'application/json'}) as unknown as File);
  await user.click(await screen.findByRole('button',{name:translate('en','dataConfirm')}));
  await screen.findByText(translate('en','dataUnknown'));
  assert.equal((screen.getByRole('button',{name:translate('en','dataConfirm')}) as HTMLButtonElement).disabled,true);
  await user.click(screen.getByRole('button',{name:translate('en','dataReload')}));assert.equal(reloaded,1);assert.equal(restores,1);
 }finally{cleanup();}
});

test('pending restore disables actions and a late success after unmount cannot reload another screen', {timeout:10000}, async()=>{
 let resolve!: (value:unknown)=>void, reloads=0, locked=false;
 const client={backups:async()=>({ok:true,value:{backups:{state:"ready",destination:"/temporary/backups",snapshots:[]}}}),restoreData:()=>new Promise(r=>{resolve=r;})} as unknown as WorkspaceServiceClient;
 const user=userEvent.setup({document});
 try{
  const view=render(<DataRecoveryPanel client={client} language="en" onRestored={()=>{reloads++;}} onLock={v=>{locked=v;}}/>);
  await user.upload(screen.getByLabelText(translate('en','dataFile')),new File(['data'],'export.json',{type:'application/json'}));
  await user.click(await screen.findByRole('button',{name:translate('en','dataConfirm')}));
  assert.ok(screen.getByText(translate('en','dataBusy')));
  assert.equal((screen.getByRole('button',{name:translate('en','dataCancel')}) as HTMLButtonElement).disabled,true);
  view.unmount();assert.equal(locked,false);resolve({ok:true,value:{restored:true}});await Promise.resolve();assert.equal(reloads,0);
 }finally{cleanup();}
});

for (const language of ["en", "ru"] as const) test(`${language} verified backup status, retry and keyboard restore use the existing confirmation`, {timeout:10000}, async()=>{
  let restores=0, creates=0, exports=0, locked=false;
  const id="automatic-1792300000000-00000000-0000-4000-8000-000000000000.json";
  const status={state:"ready",destination:"/temporary/backups",snapshots:[{id,createdAt:1792300000000,kind:"automatic"}]};
  const client={
    backups:async()=>({ok:true,value:{backups:status}}),
    backupNow:async()=>{creates++;return {ok:true,value:{backups:{...status,state:creates===1?"failed":"ready"}}};},
    exportBackup:async(selected:string)=>{assert.equal(selected,id);exports++;return {ok:true,value:{content:"saved backup"}};},
    restoreData:async(content:string)=>{assert.equal(content,"saved backup");restores++;return {ok:true,value:{restored:true}};}
  } as unknown as WorkspaceServiceClient;
  const t=(key:Parameters<typeof translate>[1])=>translate(language,key),user=userEvent.setup({document});
  try {
    render(<DataRecoveryPanel client={client} language={language} onRestored={()=>{}} onLock={v=>{locked=v;}}/>);
    await screen.findByText(`${t("backupDestination")}: /temporary/backups`);
    assert.ok(screen.getByText(t("backupPolicy")));
    await user.click(screen.getByRole('button',{name:t("backupNow")}));
    await screen.findByText(t("backupFailed"));
    await user.click(screen.getByRole('button',{name:t("backupNow")}));
    await waitFor(()=>assert.equal(screen.queryByText(t("backupFailed")),null));
    await user.selectOptions(screen.getByLabelText(t("backupSelect")),id);
    const review=screen.getByRole('button',{name:t("backupReview")});review.focus();await user.keyboard('{Enter}');
    await screen.findByText(t("dataReplace"));assert.equal(locked,true);assert.equal(exports,1);assert.equal(restores,0);
    await user.keyboard('{Escape}');await waitFor(()=>assert.equal(locked,false));
    await user.click(screen.getByRole('button',{name:t("backupReview")}));
    await user.click(await screen.findByRole('button',{name:t("dataConfirm")}));
    assert.equal(restores,1);assert.equal(creates,2);
  } finally {cleanup();}
});

test('backup loading, empty, unavailable status and late selection cannot lock a replaced screen', {timeout:10000},async()=>{
  let resolveStatus!:(v:unknown)=>void,resolveExport!:(v:unknown)=>void,selected=0;
  const client={backups:()=>new Promise(r=>{resolveStatus=r;}),exportBackup:()=>new Promise(r=>{resolveExport=r;})} as unknown as WorkspaceServiceClient;
  const user=userEvent.setup({document});
  const {BackupPanel}=await import('../src/renderer/components/BackupPanel.js');
  try {
    let view=render(<BackupPanel onSelecting={()=>{}} client={client} language="en" disabled={false} onSelect={()=>{selected++;}}/>);
    assert.ok(screen.getByText(translate('en','backupLoading')));
    resolveStatus({ok:true,value:{backups:{state:'failed',destination:'/tmp/backups',snapshots:[]}}});
    await screen.findByText(translate('en','backupEmpty'));
    assert.ok(screen.getByText(translate('en','backupFailed')));view.unmount();
    view=render(<BackupPanel onSelecting={()=>{}} client={client} language="en" disabled={false} onSelect={()=>{selected++;}}/>);
    const id='automatic-1792300000000-00000000-0000-4000-8000-000000000000.json';
    resolveStatus({ok:true,value:{backups:{state:'ready',destination:'/tmp/backups',snapshots:[{id,kind:'automatic',createdAt:1792300000000}]}}});
    await waitFor(()=>assert.equal((screen.getByLabelText(translate('en','backupSelect')) as HTMLSelectElement).disabled,false));
    await user.selectOptions(screen.getByLabelText(translate('en','backupSelect')),id);
    await user.click(screen.getByRole('button',{name:translate('en','backupReview')}));view.unmount();
    resolveExport({ok:true,value:{content:'snapshot'}});await Promise.resolve();assert.equal(selected,0);
  } finally {cleanup();}
});

test('reading a backup locks external file selection until the confirmed candidate is ready', {timeout:10000}, async()=>{
  let resolve!:(v:unknown)=>void,locked=false;
  const id='automatic-1792300000000-00000000-0000-4000-8000-000000000000.json';
  const client={backups:async()=>({ok:true,value:{backups:{state:'ready',destination:'/tmp/backups',snapshots:[{id,kind:'automatic',createdAt:1792300000000}]}}}),exportBackup:()=>new Promise(r=>{resolve=r;})} as unknown as WorkspaceServiceClient;
  const user=userEvent.setup({document});
  try {
    render(<DataRecoveryPanel client={client} language="en" onRestored={()=>{}} onLock={value=>{locked=value;}}/>);
    await waitFor(()=>assert.equal((screen.getByLabelText(translate('en','backupSelect')) as HTMLSelectElement).disabled,false));
    await user.selectOptions(screen.getByLabelText(translate('en','backupSelect')),id);
    await user.click(screen.getByRole('button',{name:translate('en','backupReview')}));
    assert.equal((screen.getByLabelText(translate('en','dataFile')) as HTMLInputElement).disabled,true);
    assert.equal(locked,true);
    resolve({ok:true,value:{content:'selected saved backup'}});
    await screen.findByText(translate('en','dataReplace'));assert.equal(locked,true);
    await user.keyboard('{Escape}');await waitFor(()=>assert.equal(locked,false));
  } finally {cleanup();}
});

for (const language of ["en", "ru"] as const) test(`${language} recovery category exposes operations directly and returns focus to the reviewed backup`, async () => {
  const id = "automatic-1792300000000-00000000-0000-4000-8000-000000000000.json";
  const client = {
    backups: async () => ({ ok: true, value: { backups: { state: "ready", destination: "/temporary/backups", snapshots: [{ id, createdAt: 1792300000000, kind: "automatic" }] } } }),
    exportBackup: async () => ({ ok: true, value: { content: "reviewed snapshot" } }),
  } as unknown as WorkspaceServiceClient;
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key), user = userEvent.setup({ document });
  try {
    render(<DataRecoveryPanel client={client} language={language} onRestored={() => {}} onLock={() => {}} />);
    assert.ok(document.querySelector("details") === null, "Recovery operations are visible without a second disclosure");
    const selection = await screen.findByLabelText(t("backupSelect"));
    await waitFor(() => assert.equal((selection as HTMLSelectElement).disabled, false));
    await user.selectOptions(selection, id);
    const review = screen.getByRole("button", { name: t("backupReview") });
    await user.click(review);
    await screen.findByText(t("dataReplace"));
    await user.keyboard("{Escape}");
    await waitFor(() => assert.equal(document.activeElement, review));
  } finally { cleanup(); }
});

test('startup recovery explains failed migrations without issuing unavailable service operations', async () => {
  const { StartupRecovery } = await import('../src/renderer/components/StartupRecovery.js');
  for (const language of ['en', 'ru'] as const) {
    try {
      render(<StartupRecovery language={language} diagnostic={{ stage: 'service_open', code: 'MIGRATION_FAILED' }} />);
      assert.ok(screen.getByText(translate(language, 'backupMigrationFailed')));
      assert.equal(screen.queryAllByRole('button').length, 0);
      assert.ok(screen.getByText(translate(language, 'dataScope')));
    } finally { cleanup(); }
  }
});

test('About shows supplied build version and complete bundled license notices in both languages', async () => {
  const { AboutPanel } = await import('../src/renderer/components/AboutPanel.js');
  for (const language of ['en', 'ru'] as const) {
    try {
      render(<AboutPanel language={language} info={{ version: '0.1.0', notices: [{ title: 'bb — MIT', content: 'Copyright (c) 2026 Michael Yong\nPermission is hereby granted' }] }} />);
      assert.ok(screen.getByText(/0\.1\.0/));
      await userEvent.setup({ document }).click(screen.getByText('bb — MIT'));
      assert.match(document.body.textContent!, /Copyright \(c\) 2026 Michael Yong/);
      assert.match(document.body.textContent!, /Permission is hereby granted/);
    } finally { cleanup(); }
  }
});

test('an unconfirmed restore result cannot claim success or unlock the dialog with Escape', async () => {
  let restored = 0, locked = false;
  const client = {
    backups: async () => ({ ok: true, value: { backups: { state: 'ready', destination: '/temporary/backups', snapshots: [] } } }),
    restoreData: async () => ({ ok: true, value: { restored: false } }),
  } as unknown as WorkspaceServiceClient;
  const user = userEvent.setup({ document });
  try {
    render(<DataRecoveryPanel client={client} language="en" onRestored={() => { restored++; }} onLock={value => { locked = value; }} />);
    await user.upload(screen.getByLabelText(translate('en', 'dataFile')), new File(['snapshot'], 'export.json', { type: 'application/json' }));
    await user.click(await screen.findByRole('button', { name: translate('en', 'dataConfirm') }));
    await screen.findByText(translate('en', 'dataUnknown'));
    await user.keyboard('{Escape}');
    assert.equal(restored, 0);
    assert.equal(locked, true);
    assert.ok(screen.getByRole('dialog'));
    assert.equal((screen.getByRole('button', { name: translate('en', 'dataCancel') }) as HTMLButtonElement).disabled, true);
  } finally { cleanup(); }
});
