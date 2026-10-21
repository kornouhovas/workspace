import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { Window } from 'happy-dom';
import { WorkspaceServiceClient } from '../src/renderer/workspace-service-client.js';
import type { WorkspaceDesktopApi } from '../src/contracts/desktop-api.js';
const browser = new Window();
Object.assign(globalThis, { window: browser, document: browser.document, HTMLElement: browser.HTMLElement, Element: browser.Element, Node: browser.Node, MutationObserver: browser.MutationObserver, CustomEvent: browser.CustomEvent, getComputedStyle: browser.getComputedStyle.bind(browser) });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: browser.navigator });
const { render, screen, cleanup, waitFor } = await import('@testing-library/react');
const { default: userEvent } = await import('@testing-library/user-event');
const { ProjectFiles } = await import('../src/renderer/components/ProjectFiles.js');
const listed = (projectId: string, relativePath: string, entries: {name:string;kind:'file'|'directory';relativePath:string}[]) => ({ ok:true as const, value:{ outcome:'listed' as const, workspaceId:'workspace',projectId,relativePath,entries,truncated:false } });

test('browse nested real-tree rows with keyboard and separate external Open/Reveal', async () => {
  const calls: unknown[]=[];
  const client=new WorkspaceServiceClient({workspace:async (input: {type:string;projectId:string;relativePath:string})=>{
    calls.push(input);
    if(input.type==='workspace.listProjectFiles') return listed(input.projectId,input.relativePath,input.relativePath ? [{name:'note.txt',kind:'file',relativePath:'src/note.txt'}] : [{name:'src',kind:'directory',relativePath:'src'}]);
    return {ok:true,value:{outcome:'dispatched',...input}};
  }} as unknown as WorkspaceDesktopApi);
  const user=userEvent.setup({document});
  try {
    render(<ProjectFiles client={client} workspaceId="workspace" projectId="atlas" language="en" disabled={false}/>);
    const folder=await screen.findByRole('treeitem',{name:'src'}); folder.focus();
    await user.keyboard('{ArrowRight}');
    const file=await screen.findByRole('treeitem',{name:'note.txt'});
    await user.keyboard('{ArrowDown}'); assert.equal(document.activeElement,file);
    await user.click(screen.getByRole('button',{name:'Open externally'}));
    await user.click(screen.getByRole('button',{name:'Reveal in Finder / Explorer'}));
    assert.deepEqual(calls.slice(-2).map(value=>(value as {type:string}).type),['workspace.openProjectFile','workspace.revealProjectFile']);
    folder.focus(); await user.keyboard('{ArrowLeft}');
    assert.equal(screen.queryByRole('treeitem',{name:'note.txt'}),null);
  } finally {cleanup();}
});

test('a late tree read never replaces the newer project and refresh recovers failures', async()=>{
  let release:(value:unknown)=>void=()=>{};let reads=0;
  const client=new WorkspaceServiceClient({workspace:async(input:{type:string;projectId:string;relativePath:string})=>{
    if(input.projectId==='atlas') return new Promise(resolve=>{release=resolve;});
    if(++reads===1)return {ok:false,error:{code:'filesystem',message:'private exception'}};
    return listed(input.projectId,'',[{name:'new.txt',relativePath:'new.txt',kind:'file'}]);
  }} as unknown as WorkspaceDesktopApi);
  const user=userEvent.setup({document});
  try {
    const view=render(<ProjectFiles client={client} workspaceId="workspace" projectId="atlas" language="en" disabled={false}/>);
    await screen.findByText('Loading files…');
    view.rerender(<ProjectFiles client={client} workspaceId="workspace" projectId="beacon" language="en" disabled={false}/>);
    await screen.findByText('Files could not be read. Refresh to try again.');
    release(listed('atlas','',[{name:'old.txt',relativePath:'old.txt',kind:'file'}]));
    await user.click(screen.getByRole('button',{name:'Refresh files'}));
    await screen.findByRole('treeitem',{name:'new.txt'});
    assert.equal(screen.queryByRole('treeitem',{name:'old.txt'}),null);
    assert.equal(screen.queryByText('private exception'),null);
  }finally{cleanup();}
});

test('RU empty, unavailable, native failure and pending states retain keyboard focus and retry', async()=>{
  let state='empty',release:(value:unknown)=>void=()=>{};
  const client=new WorkspaceServiceClient({workspace:async(input:{type:string;projectId:string;relativePath:string})=>{
    if(input.type!=='workspace.listProjectFiles')return new Promise(resolve=>{release=resolve;});
    return state==='unavailable'?{ok:true,value:{outcome:'rejected',problem:'missing'}}:listed(input.projectId,'',state==='empty'?[]:[{name:'Текст.txt',kind:'file',relativePath:'Текст.txt'}]);
  }} as unknown as WorkspaceDesktopApi);
  const user=userEvent.setup({document});
  try{
    render(<ProjectFiles client={client} workspaceId="workspace" projectId="atlas" language="ru" disabled={false}/>);
    await screen.findByText('Папка пуста.');state='unavailable';
    await user.click(screen.getByRole('button',{name:'Обновить файлы'}));await screen.findByText(/Объект недоступен/);
    state='ready';await user.click(screen.getByRole('button',{name:'Обновить файлы'}));
    const file=await screen.findByRole('treeitem',{name:'Текст.txt'});await user.click(file);
    await user.keyboard('{Enter}');await screen.findByText('Открытие…');
    assert.equal((screen.getByRole('button',{name:'Открыть во внешнем приложении'}) as HTMLButtonElement).disabled,true);
    release({ok:true,value:{outcome:'rejected',problem:'native_error'}});
    await screen.findByRole('alert');await waitFor(()=>assert.equal(document.activeElement,file));
    assert.equal((screen.getByRole('button',{name:'Открыть во внешнем приложении'}) as HTMLButtonElement).disabled,false);
  }finally{cleanup();}
});
