import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { Window } from "happy-dom";
import { ViewportProjectRow } from "../src/renderer/components/ViewportProjectRow.js";
const browser = new Window();
Object.assign(globalThis, { window: browser, document: browser.document, HTMLElement: browser.HTMLElement, Node: browser.Node, MutationObserver: browser.MutationObserver });
Object.defineProperty(globalThis, "navigator", { configurable: true, value: browser.navigator });
const { cleanup, render, screen, act, fireEvent, waitFor } = await import("@testing-library/react");
let notify: (entries: { target: Element; isIntersecting: boolean }[]) => void;
class Observer {
  constructor(callback: typeof notify) { notify = callback; }
  observe() {} unobserve() {} disconnect() {}
}
test("offscreen project keeps its identity and loads fields on keyboard focus without losing the focused control", async () => {
  Object.assign(globalThis, { IntersectionObserver: Observer });
  try {
    render(<ul><ViewportProjectRow as="li" projectId="one" projectName="One" language="en" columnCount={2} backwards={{current:false}}>
      {() => <button type="button">Edit One</button>}
    </ViewportProjectRow></ul>);
    assert.equal(document.querySelector('[data-project-id="one"]') !== null, true);
    assert.equal(screen.queryByRole("button", {name:"Edit One"}), null);
    await act(async () => { screen.getByRole("button", {name:"Load project fields: One"}).focus(); });
    assert.ok(document.activeElement === screen.getByRole("button", {name:"Edit One"}));
    await act(async () => { notify([{target:document.querySelector('[data-project-id="one"]')!,isIntersecting:false}]); });
    assert.ok(document.activeElement === screen.getByRole("button", {name:"Edit One"}));
  } finally { cleanup(); Reflect.deleteProperty(globalThis,"IntersectionObserver"); }
});
test("offscreen draft survives blur and fields are released only after the editor closes", async () => {
  Object.assign(globalThis, { IntersectionObserver: Observer });
  function Field() {
    const [editing, setEditing] = React.useState(true);
    return editing ? <div className="text-value-editor"><textarea aria-label="Draft" defaultValue="Keep this draft" />
      <button type="button" onClick={() => setEditing(false)}>Complete</button></div> : <button type="button">Closed field</button>;
  }
  try {
    render(<><button type="button">Outside</button><ul><ViewportProjectRow as="li" projectId="draft" projectName="Draft project" language="ru" columnCount={1} backwards={{current:false}}>
      {() => <Field />}
    </ViewportProjectRow></ul></>);
    const row = document.querySelector('[data-project-id="draft"]')!;
    await act(async () => { notify([{target:row,isIntersecting:true}]); });
    await act(async () => { screen.getByRole("button", {name:"Outside"}).focus(); notify([{target:row,isIntersecting:false}]); });
    assert.equal((screen.getByRole("textbox", {name:"Draft"}) as HTMLTextAreaElement).value, "Keep this draft");
    fireEvent.click(screen.getByRole("button", {name:"Complete"}));
    await waitFor(() => assert.ok(screen.getByRole("button", {name:"Загрузить поля проекта: Draft project"})));
    assert.equal(screen.queryByRole("button", {name:"Closed field"}), null);
  } finally { cleanup(); Reflect.deleteProperty(globalThis,"IntersectionObserver"); }
});
test("backward keyboard navigation opens the last field control", async () => {
  Object.assign(globalThis, { IntersectionObserver: Observer });
  try {
    render(<ul><ViewportProjectRow as="li" projectId="reverse" projectName="Reverse" language="en" columnCount={2} backwards={{current:true}}>
      {() => <><button type="button">First</button><button type="button">Last</button></>}
    </ViewportProjectRow></ul>);
    await act(async () => { screen.getByRole("button", {name:"Load project fields: Reverse"}).focus(); });
    assert.ok(document.activeElement === screen.getByRole("button", {name:"Last"}));
  } finally { cleanup(); Reflect.deleteProperty(globalThis,"IntersectionObserver"); }
});
test("a busy source retains loaded fields without materializing every offscreen project", async () => {
  Object.assign(globalThis, { IntersectionObserver: Observer });
  try {
    render(<ul><ViewportProjectRow as="li" projectId="offscreen" projectName="Offscreen" language="en" columnCount={1} backwards={{current:false}} busy>
      {() => <button type="button">Offscreen editor</button>}
    </ViewportProjectRow></ul>);
    await act(async () => { notify([{target:document.querySelector('[data-project-id="offscreen"]')!,isIntersecting:false}]); });
    assert.ok(screen.queryByRole("button", {name:"Offscreen editor"}) === null);
  } finally { cleanup(); Reflect.deleteProperty(globalThis,"IntersectionObserver"); }
});

test("pending completion releases offscreen fields and a newly pinned first row loads without an observer event", async () => {
  Object.assign(globalThis, { IntersectionObserver: Observer });
  const ui = (busy: boolean, alwaysVisible = false) => <ul><ViewportProjectRow as="li" projectId="retained" projectName="Retained" language="en" columnCount={1}
    backwards={{current:false}} busy={busy} alwaysVisible={alwaysVisible}>{() => <button type="button">Retained fields</button>}</ViewportProjectRow></ul>;
  try {
    const view = render(ui(true));
    const row = document.querySelector('[data-project-id="retained"]')!;
    await act(async () => { notify([{target:row,isIntersecting:true}]); });
    assert.ok(screen.getByRole("button", {name:"Retained fields"}));
    await act(async () => { notify([{target:row,isIntersecting:false}]); });
    assert.ok(screen.getByRole("button", {name:"Retained fields"}), "Pending work pins already loaded fields");
    view.rerender(ui(false));
    await waitFor(() => assert.ok(screen.getByRole("button", {name:"Load project fields: Retained"})));
    assert.equal(screen.queryByRole("button", {name:"Retained fields"}), null);
    view.rerender(ui(false, true));
    await waitFor(() => assert.ok(screen.getByRole("button", {name:"Retained fields"})));
    assert.equal(row.getAttribute("data-fields-ready"), "true");
  } finally { cleanup(); Reflect.deleteProperty(globalThis,"IntersectionObserver"); }
});
