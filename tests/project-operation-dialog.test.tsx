import assert from 'node:assert/strict';
import test from 'node:test';
import React, {useState} from 'react';
import {Window} from 'happy-dom';
const browser=new Window({url:'http://localhost'});
Object.assign(globalThis,{window:browser,document:browser.document,HTMLElement:browser.HTMLElement,Element:browser.Element,Node:browser.Node,MutationObserver:browser.MutationObserver,CustomEvent:browser.CustomEvent,NodeFilter:browser.NodeFilter,HTMLInputElement:browser.HTMLInputElement,getComputedStyle:browser.getComputedStyle.bind(browser)});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:browser.navigator});
// Load Radix after the browser exists so its real document-capture Escape
// listeners participate, just as they do in Electron.
const {ProjectOperationDialog}=await import('../src/renderer/components/ProjectOperationDialog.js');
const {render,screen,cleanup}=await import('@testing-library/react');
const {default:userEvent}=await import('@testing-library/user-event');
test.afterEach(cleanup);
for(const surface of ['independent editor','nested editor','nested menu'] as const) {
 test(`Escape belongs to the ${surface} without dismissing a project operation`,async()=>{
  let closes=0,cancels=0;
  const editor=<input aria-label={surface} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();cancels++;}}}/>;
  render(<><ProjectOperationDialog open title="Rename project" onClose={()=>closes++}>
    <input aria-label="Folder name"/>{surface!=='independent editor'&&editor}
   </ProjectOperationDialog>{surface==='independent editor'&&editor}</>);
  const input=screen.getByRole('textbox',{name:surface});input.focus();await userEvent.keyboard('{Escape}');
  assert.equal(cancels,1);assert.equal(closes,0);assert.ok(document.activeElement===input);
 });
}
test('unclaimed Escape inside the operation dismisses it once',async()=>{
 let closes=0;
 function Example(){const [open,setOpen]=useState(true);return <ProjectOperationDialog open={open} title="Rename project" onClose={()=>{closes++;setOpen(false);}}><input aria-label="Folder name"/></ProjectOperationDialog>;}
 render(<Example/>);screen.getByRole('textbox',{name:'Folder name'}).focus();await userEvent.keyboard('{Escape}');
 assert.equal(closes,1);assert.equal(screen.queryByRole('dialog'),null);
});

const {ContextTools}=await import('../src/renderer/components/ContextTools.js');
for(const nested of [false,true])test(`Escape dismisses a ${nested?'nested':'independent'} contextual menu before an operation`,async()=>{
 let closes=0;
 const menu=<ContextTools label="Action menu"><button type="button">Menu action</button></ContextTools>;
 render(<><ProjectOperationDialog open title="Rename project" onClose={()=>closes++}><input aria-label="Folder name"/>{nested&&menu}</ProjectOperationDialog>{!nested&&menu}</>);
 await userEvent.click(screen.getByRole('button',{name:'Action menu'}));
 screen.getByRole('button',{name:'Menu action'}).focus();await userEvent.keyboard('{Escape}');
 assert.equal(screen.getByRole('button',{name:'Action menu'}).getAttribute('aria-expanded'),'false');assert.equal(closes,0);assert.ok(screen.getByRole('dialog',{name:'Rename project'}));
});
