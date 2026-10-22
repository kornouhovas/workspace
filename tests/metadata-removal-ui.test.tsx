import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { Window } from 'happy-dom';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MetadataRemovalPanel } from '../src/renderer/components/MetadataRemovalPanel.js';
import { WorkspaceServiceClient } from '../src/renderer/workspace-service-client.js';
import type { WorkspaceDesktopApi } from '../src/contracts/desktop-api.js';
import { translate } from '../src/renderer/localization.js';
// @ts-expect-error Built service module intentionally has no declarations.
const { openSettingsService } = await import('../dist/service/settings.mjs');
const browser = new Window();
Object.assign(globalThis, { window: browser, document: browser.document, HTMLElement: browser.HTMLElement, Node: browser.Node, MutationObserver: browser.MutationObserver });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: browser.navigator });
const { cleanup, render, screen, waitFor } = await import('@testing-library/react');
const { default: userEvent } = await import('@testing-library/user-event');
for (const language of ['en', 'ru'] as const) test(`${language} keyboard reviews, cancels, refreshes stale usages and deletes through the typed real service`, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'removal-ui-')), root = join(directory, 'root'); mkdirSync(root); mkdirSync(join(root, 'Project'));
  const service = openSettingsService(join(directory, 'app.sqlite'));
  const workspace = service.handleCommand({ type: 'workspace.create', rootPath: root, name: 'One' }).value;
  const { workspaceId } = workspace;
  const command = (type: string, fields = {}) => service.handleCommand({ type: `workspace.${type}`, workspaceId, ...fields });
  const query = (type: string, fields = {}) => service.handleQuery({ type: `workspace.${type}`, workspaceId, ...fields });
  const projectId = command('applyDiscovery', { previewToken: query('previewDiscovery').value.previewToken }).value.projects[0].projectId;
  const propertyId = command('createProperty', { name: 'Notes', propertyType: 'text' }).value.propertyId;
  command('setTextValue', { propertyId, projectId, value: 'exact' });
  const calls: string[] = [];
  const client = new WorkspaceServiceClient({ workspace: async (input: { type: string }) => {
    calls.push(input.type); return input.type === 'workspace.previewMetadataRemoval' ? service.handleQuery(input) : service.handleCommand(input);
  }, onWorkspaceChange: (listener: never) => service.workspaces.subscribe(listener) } as unknown as WorkspaceDesktopApi);
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  let cancelled = 0, committed = 0;
  const props = { client, workspaceId, sourceId: workspace.sourceId, property: query('listTextProperties').value.definitions[0], optionId: null, options: [], language, disabled: false, onCancel: () => { cancelled++; }, onCommitted: () => { committed++; } };
  const user = userEvent.setup({ document });
  try {
    const view = render(<MetadataRemovalPanel {...props} />);
    await screen.findByText('exact');
    const cancel = screen.getByRole('button', { name: t('metadataCancel') }); cancel.focus(); await user.keyboard('{Enter}');
    assert.equal(cancelled, 1); assert.equal(calls.filter(c => c === 'workspace.applyMetadataRemoval').length, 0);
    view.unmount(); render(<MetadataRemovalPanel {...props} />);
    await screen.findByText('exact');
    command('setTextValue', { propertyId, projectId, value: 'new value' });
    await user.click(screen.getByRole('button', { name: t('metadataConfirm') }));
    await screen.findByText(t('metadataStale'));
    assert.equal(query('listTextProperties').value.definitions.length, 1);
    await user.click(screen.getByRole('button', { name: t('metadataReview') }));
    await screen.findByText('new value');
    const confirm = screen.getByRole('button', { name: t('metadataConfirm') }); confirm.focus(); await user.keyboard('{Enter}');
    await waitFor(() => assert.equal(committed, 1));
    assert.equal(query('listTextProperties').value.definitions.length, 0);
  } finally { cleanup(); service.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('a lost apply response observes actual state and requires a new review without replaying the mutation', {timeout:10000}, async () => {
  const workspaceId = '11111111-1111-4111-8111-111111111111', sourceId = '22222222-2222-4222-8222-222222222222', propertyId = '33333333-3333-4333-8333-333333333333';
  const property = { propertyId, sourceId, name: 'Notes', propertyType: 'text' as const };
  let applies = 0, observations = 0, failRead = true;
  const client = { previewMetadataRemoval: async () => failRead ? { ok: false, error: { code: 'storage' } } : { ok: true, value: {
    workspaceId, sourceId, propertyId, propertyName: 'Notes', optionId: null, optionName: null, replacementOptionId: null, replacementName: null,
    previewToken: '44444444-4444-4444-8444-444444444444', projects: [], views: [],
  } }, applyMetadataRemoval: async () => { applies++; throw new Error('Lost reply'); } } as unknown as WorkspaceServiceClient;
  const user = userEvent.setup({ document });
  try {
    render(<MetadataRemovalPanel client={client} workspaceId={workspaceId} sourceId={sourceId} property={property} optionId={null} options={[]} language="en" disabled={false}
      onCancel={() => {}} onCommitted={() => assert.fail('Unknown outcome is not confirmed success')} onObserved={async () => { observations++; }} />);
    await screen.findByText(translate('en', 'metadataPreviewError'));
    assert.equal((screen.getByRole('button', { name: 'Confirm deletion' }) as HTMLButtonElement).disabled, true);
    failRead = false; await user.click(screen.getByRole('button', { name: 'Review usages' })); await screen.findByText(translate('en', 'metadataNoProjects')); await screen.findByText(translate('en', 'metadataNoViews'));
    await user.click(screen.getByRole('button', { name: 'Confirm deletion' })); await screen.findByText(translate('en', 'metadataError'));
    assert.equal(applies, 1); assert.equal(observations, 1);
    assert.equal((screen.getByRole('button', { name: 'Confirm deletion' }) as HTMLButtonElement).disabled, true);
    await waitFor(() => assert.ok(document.activeElement === screen.getByRole('button', { name: 'Review usages' })));
  } finally { cleanup(); }
});

test('review owns navigation; pending Escape cannot cancel and failed Apply requires review before leaving', async () => {
  const {ScalarDrafts,useDraftGuard}=await import('../src/renderer/components/ScalarDrafts.js');
  let navigated=false, release:((value:unknown)=>void)|undefined;
  const preview={workspaceId:'w',sourceId:'s',propertyId:'p',optionId:null,replacementOptionId:null,previewToken:'reviewed',projects:[],views:[]};
  const client={previewMetadataRemoval:async()=>({ok:true,value:preview}),applyMetadataRemoval:async()=>new Promise(resolve=>{release=resolve;})} as unknown as WorkspaceServiceClient;
  function Navigate(){const guard=useDraftGuard();return <button onClick={()=>guard?.run(()=>{navigated=true;})}>Navigate</button>;}
  function Harness(){const [open,setOpen]=React.useState(true);return <ScalarDrafts><Navigate/>{open&&<MetadataRemovalPanel client={client} workspaceId="w" sourceId="s" property={{propertyId:'p',sourceId:'s',name:'Notes',propertyType:'text'}} optionId={null} options={[]} language="en" disabled={false} onCancel={()=>setOpen(false)} onCommitted={()=>assert.fail('Failed apply is not success')}/>}</ScalarDrafts>;}
  const user=userEvent.setup({document});
  try{
    render(<Harness/>);await screen.findByText('No saved views are affected.');
    await user.click(screen.getByRole('button',{name:'Navigate'}));assert.equal(navigated,false);
    await user.click(screen.getByRole('button',{name:'Confirm deletion'}));await user.keyboard('{Escape}');
    assert.ok(screen.getByRole('button',{name:'Cancel deletion'}).hasAttribute('disabled'));
    await user.click(screen.getByRole('button',{name:'Navigate'}));assert.equal(navigated,false);
    release!({ok:false,error:{code:'storage',message:'Unavailable'}});await screen.findByRole('alert');
    assert.ok(screen.getByRole('button',{name:'Confirm deletion'}).hasAttribute('disabled'));
    await user.click(screen.getByRole('button',{name:'Cancel deletion'}));
    await user.click(screen.getByRole('button',{name:'Navigate'}));assert.equal(navigated,true);
  }finally{cleanup();}
});
