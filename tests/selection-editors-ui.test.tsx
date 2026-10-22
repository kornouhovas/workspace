import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { Window } from 'happy-dom';
import { MultiSelectPropertyCell } from '../src/renderer/components/MultiSelectPropertyCell.js';
import { TextPropertyCell } from '../src/renderer/components/TextPropertyCell.js';
import { ScalarDrafts, useDraftGuard } from '../src/renderer/components/ScalarDrafts.js';
const browser = new Window();
Object.assign(globalThis,{window:browser,document:browser.document,HTMLElement:browser.HTMLElement,Node:browser.Node,MutationObserver:browser.MutationObserver,CustomEvent:browser.CustomEvent,Element:browser.Element,NodeFilter:browser.NodeFilter,HTMLInputElement:browser.HTMLInputElement,ResizeObserver:browser.ResizeObserver,requestAnimationFrame:browser.requestAnimationFrame.bind(browser),cancelAnimationFrame:browser.cancelAnimationFrame.bind(browser),getComputedStyle:browser.getComputedStyle.bind(browser)});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:browser.navigator});
const {render,screen,cleanup,waitFor}=await import('@testing-library/react');
const {default:userEvent}=await import('@testing-library/user-event');
const options=['Ready','Done','Hidden'].map((name,index)=>({optionId:name,propertyId:'p',sourceId:'s',name,color:'blue' as const,hidden:index===2,position:index}));
const base={workspaceId:'w',sourceId:'s',projectId:'j',propertyId:'p',projectName:'Atlas',propertyName:'Status',options,revision:1,minimumRevision:{current:1},language:'en' as const,disabled:false};
function success(){return {ok:true as const,value:{projectId:'j',propertyId:'p',snapshot:{workspaceId:'w',sourceId:'s',revision:2,definitions:[],values:[]}}};}
function Navigate({onNavigate}:{onNavigate:()=>void}){const guard=useDraftGuard();return <button onClick={()=>guard?.run(onNavigate)}>Navigate</button>;}
test('Single Select commits on choice and closing does not undo it',async()=>{
 const user=userEvent.setup();const saved:(string|null)[]=[];
 try{render(<TextPropertyCell {...base} propertyType="single_select" value={null} onSave={async value=>{saved.push(value);return success();}}/>);
 await user.click(screen.getByRole('button',{name:'Edit Single Select value: Atlas / Status'}));
 await user.selectOptions(screen.getByRole('combobox'), 'Ready');
 await waitFor(()=>assert.deepEqual(saved,['Ready']));
 await waitFor(()=>assert.equal(screen.queryByRole('combobox'),null));
 await user.keyboard('{Escape}');assert.deepEqual(saved,['Ready']);
 }finally{cleanup();}
});
test('rapid MultiSelect toggles serialize, failed saves block navigation without retry, explicit retry retains set',async()=>{
 const user=userEvent.setup();const calls:string[][]=[];let release:((result:ReturnType<typeof success>|{ok:false;error:{code:'storage';message:string}})=>void)|undefined;let navigated=false;
 try{render(<ScalarDrafts><MultiSelectPropertyCell {...base} value={[]} onSave={async ids=>{calls.push(ids);if(calls.length===1)return new Promise(resolve=>{release=resolve;});return success();}}/><Navigate onNavigate={()=>{navigated=true;}}/></ScalarDrafts>);
 await user.click(screen.getByRole('button',{name:'Edit MultiSelect value: Atlas / Status'}));
 await user.click(screen.getByRole('checkbox',{name:'Ready'}));
 await user.click(screen.getByRole('checkbox',{name:'Done'}));
 assert.deepEqual(calls,[['Ready']]);assert.equal((screen.getByRole('checkbox',{name:'Done'}) as HTMLInputElement).checked,true);
 await user.click(screen.getByRole('button',{name:'Navigate'}));assert.equal(navigated,false);
 release!({ok:false,error:{code:'storage',message:'Unavailable'}});
 await screen.findByRole('alert');assert.equal(navigated,false);assert.deepEqual(calls,[['Ready']]);
 await user.click(screen.getByRole('button',{name:'Navigate'}));assert.deepEqual(calls,[['Ready']]);assert.equal(navigated,false);
 await user.click(screen.getByRole('button',{name:'Save value'}));
 await waitFor(()=>assert.deepEqual(calls,[['Ready'],['Ready','Done']]));
 assert.ok(screen.getByRole('checkbox',{name:'Done'}));
 await user.keyboard('{Escape}');await user.click(screen.getByRole('button',{name:'Navigate'}));assert.equal(navigated,true);
 }finally{cleanup();}
});
test('each rapid MultiSelect toggle is saved in order; pending Escape retains the menu, successful navigation waits for all saves',async()=>{
 const user=userEvent.setup();const calls:string[][]=[];const releases:(()=>void)[]=[];let navigated=false;
 try{render(<ScalarDrafts><MultiSelectPropertyCell {...base} value={[]} onSave={async ids=>{calls.push(ids);await new Promise<void>(resolve=>releases.push(resolve));return success();}}/><Navigate onNavigate={()=>{navigated=true;}}/></ScalarDrafts>);
 await user.click(screen.getByRole('button',{name:'Edit MultiSelect value: Atlas / Status'}));
 await user.click(screen.getByRole('checkbox',{name:'Ready'}));await user.click(screen.getByRole('checkbox',{name:'Done'}));await user.click(screen.getByRole('checkbox',{name:'Ready'}));
 await user.keyboard('{Escape}');assert.ok(screen.getByRole('group'));
 await user.click(screen.getByRole('button',{name:'Navigate'}));assert.equal(navigated,false);
 releases[0]();await waitFor(()=>assert.deepEqual(calls,[['Ready'],['Ready','Done']]));assert.equal(navigated,false);
 releases[1]();await waitFor(()=>assert.deepEqual(calls,[['Ready'],['Ready','Done'],['Done']]));assert.equal(navigated,false);
 releases[2]();await waitFor(()=>assert.equal(navigated,true));
 }finally{cleanup();}
});
test('Single Select failure blocks navigation without replay; cancellation allows leaving and restores focus',async()=>{
 const user=userEvent.setup();let attempts=0,navigated=false;
 try{render(<ScalarDrafts><TextPropertyCell {...base} propertyType="single_select" value="Ready" onSave={async()=>{attempts++;return {ok:false,error:{code:'storage',message:'Offline'}};}}/><Navigate onNavigate={()=>{navigated=true;}}/></ScalarDrafts>);
 const trigger=screen.getByRole('button',{name:'Edit Single Select value: Atlas / Status'});await user.click(trigger);
 await user.selectOptions(screen.getByRole('combobox'),'Done');await screen.findByRole('alert');
 assert.equal((screen.getByRole('combobox') as HTMLSelectElement).value,'Done');assert.equal(trigger.textContent,'Ready');
 await user.click(screen.getByRole('button',{name:'Navigate'}));assert.equal(navigated,false);assert.equal(attempts,1);
 await user.click(screen.getByRole('button',{name:'Cancel value edit'}));await waitFor(()=>assert.equal(document.activeElement,trigger));
 await user.click(screen.getByRole('button',{name:'Navigate'}));assert.equal(navigated,true);assert.equal(attempts,1);
 }finally{cleanup();}
});
