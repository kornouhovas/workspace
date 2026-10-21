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
const {ManagementSurface,ManagementTarget,ManagementHistory}=await import("../src/renderer/components/ManagementSurface.js");
const {PresentationPopover}=await import("../src/renderer/components/PresentationPopover.js");
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

test("portaled recovery tools dismiss from the inside out and preserve their draft",async()=>{
  const user=userEvent.setup({document});
  try {
    render(<ManagementSurface>
      <ContextTools label="Source tools"><ManagementTarget /></ContextTools>
      <ManagementHistory><ContextTools label="Creation recovery"><label>Draft<input /></label></ContextTools></ManagementHistory>
    </ManagementSurface>);
    const source=screen.getByRole("button",{name:"Source tools"});
    await user.click(source);
    const recovery=screen.getByRole("button",{name:"Creation recovery"});
    await user.click(recovery);
    await user.type(screen.getByRole("textbox"),"Keep exact draft");
    await user.keyboard("{Escape}");
    assert.ok(screen.queryByRole("dialog",{name:"Source tools"}));
    assert.equal(screen.queryByRole("dialog",{name:"Creation recovery"})===null,true);
    assert.equal(document.activeElement===recovery,true);
    await user.keyboard("{Escape}");
    assert.equal(screen.queryByRole("dialog",{name:"Source tools"})===null,true);
    assert.equal(document.activeElement===source,true);
    await user.click(source);await user.click(recovery);
    assert.equal((screen.getByRole("textbox") as HTMLInputElement).value,"Keep exact draft");
  } finally {cleanup();}
});

test("nested presentation popover clicks retain the parent and visible focus return",async()=>{
  const user=userEvent.setup({document});
  try {
    render(<ContextTools label="View settings"><PresentationPopover label="Table layout"><button>Show column</button></PresentationPopover></ContextTools>);
    await user.click(screen.getByRole("button",{name:"View settings"}));
    const layout=screen.getByRole("button",{name:"Table layout"});
    await user.click(layout);
    await user.click(screen.getByRole("button",{name:"Show column"}));
    assert.equal(screen.getByRole("button",{name:"View settings"}).getAttribute("aria-expanded"),"true");
    await user.keyboard("{Escape}");
    assert.equal(document.activeElement===layout,true);
    assert.equal(screen.queryByRole("button",{name:"Table layout"})===layout,true);
  } finally {cleanup();}
});

test("an outside SVG icon dismisses the current contextual tools",async()=>{
  const user=userEvent.setup({document});
  try {
    render(<><ContextTools label="View settings"><button>Inside</button></ContextTools><button aria-label="Other tools"><svg><path d="M0 0h4"/></svg></button></>);
    await user.click(screen.getByRole("button",{name:"View settings"}));
    await user.click(screen.getByRole("button",{name:"Other tools"}).querySelector("path")!);
    assert.equal(screen.queryByRole("dialog",{name:"View settings"})===null,true);
  } finally {cleanup();}
});

test('removed column menu returns focus to the visible settings entry when its fallback is hidden',async()=>{
  const user=userEvent.setup({document});
  const fallback=React.createRef<HTMLButtonElement>();
  const content=(column:boolean)=><>
    <ContextTools label="View settings"><button ref={fallback}>Board layout</button></ContextTools>
    {column && <PresentationPopover label="Column width" fallbackFocus={fallback}><button>Resize</button></PresentationPopover>}
  </>;
  try {
    const view=render(content(true));
    await user.click(screen.getByRole('button',{name:'Column width'}));
    view.rerender(content(false));
    const {waitFor}=await import('@testing-library/react');
    await waitFor(()=>assert.ok(document.activeElement===screen.getByRole('button',{name:'View settings'})));
  } finally {cleanup();}
});
