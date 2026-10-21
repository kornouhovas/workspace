import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { Window } from "happy-dom";
const browser = new Window();
Object.assign(globalThis, {window:browser,document:browser.document,HTMLElement:browser.HTMLElement,Element:browser.Element,Node:browser.Node,MutationObserver:browser.MutationObserver,CustomEvent:browser.CustomEvent,getComputedStyle:browser.getComputedStyle.bind(browser),NodeFilter:browser.NodeFilter,HTMLInputElement:browser.HTMLInputElement,ResizeObserver:browser.ResizeObserver,requestAnimationFrame:browser.requestAnimationFrame.bind(browser),cancelAnimationFrame:browser.cancelAnimationFrame.bind(browser)});
Object.defineProperty(globalThis,"navigator",{configurable:true,value:browser.navigator});
const {render,screen,cleanup} = await import("@testing-library/react");
const {default:userEvent} = await import("@testing-library/user-event");
const {Hint}=await import("../src/renderer/components/Hint.js");
const {ContextTools} = await import("../src/renderer/components/ContextTools.js");
for(const label of ["Source tools","Инструменты источника"]) test(`${label}: Escape returns focus without discarding a form draft`,async()=>{
  const user=userEvent.setup({document});
  try {
    render(<ContextTools label={label}><label>Draft<input defaultValue="" /></label><button>Apply</button></ContextTools>);
    assert.equal(screen.queryByRole("textbox"),null);
    const trigger=screen.getByRole("button",{name:label});
    trigger.focus(); await user.keyboard("{Enter}");
    await user.type(screen.getByRole("textbox"),"Keep this draft");
    await user.keyboard("{Escape}");
    assert.equal(screen.queryByRole("textbox"),null);
    assert.equal(document.activeElement,trigger);
    await user.click(trigger);
    assert.equal((screen.getByRole("textbox") as HTMLInputElement).value,"Keep this draft");
  } finally {cleanup();}
});

test("workspace tools share the owning surface's visibility and inert boundary",async()=>{
  const user=userEvent.setup({document});
  const content=(hidden:boolean)=><section aria-hidden={hidden} inert={hidden}><ContextTools label="Source tools"><button>Review folders</button></ContextTools></section>;
  try {
    const view=render(content(false));
    await user.click(screen.getByRole("button",{name:"Source tools"}));
    assert.ok(screen.getByRole("dialog",{name:"Source tools"}));
    view.rerender(content(true));
    assert.equal(screen.queryByRole("dialog",{name:"Source tools"}),null);
    assert.equal(screen.queryByRole("button",{name:"Review folders"}),null);
  } finally {cleanup();}
});

test("an active operation owns Escape before the containing tools dismiss",async()=>{
  const user=userEvent.setup({document});
  let cancellations=0;
  try {
    render(<ContextTools label="Archive" onEscape={event=>{event.preventDefault();cancellations++;}}><button>Apply reviewed move</button></ContextTools>);
    await user.click(screen.getByRole("button",{name:"Archive"}));
    await user.keyboard("{Escape}");
    assert.equal(cancellations,1);
    assert.ok(screen.getByRole("dialog",{name:"Archive"}));
  } finally {cleanup();}
});

test("a focused action hint does not consume the tools Escape",async()=>{
  const user=userEvent.setup({document});
  try {
    render(<ContextTools label="Row actions"><Hint label="Move earlier"><button>Move earlier</button></Hint></ContextTools>);
    const entry=screen.getByRole("button",{name:"Row actions"});
    await user.click(entry);
    assert.ok(screen.getByRole("tooltip",{name:"Move earlier"}));
    await user.keyboard("{Escape}");
    assert.equal(screen.queryByRole("dialog",{name:"Row actions"}),null);
    assert.equal(document.activeElement===entry,true);
  } finally {cleanup();}
});
