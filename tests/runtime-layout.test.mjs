import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { Window } from "happy-dom";
import { waitForCategoryMoveEditor } from "../scripts/runtime-layout.mjs";

function fixture(states) {
  const browser = new Window();
  browser.document.body.innerHTML = '<select id="project-category-move-destination"><option value="original">Original</option><option value="destination">Destination</option></select>';
  const select = browser.document.querySelector("select");
  let disposed = false;
  const observed = [];
  const page = {
    async waitForFunction(predicate, expected, options) {
      assert.equal(options.timeout, 15000);
      for (const state of states) {
        select.value = state.value; select.disabled = state.disabled ?? false;
        if (state.focused) select.focus(); else select.blur();
        const ready = runInNewContext(`(${predicate.toString()})(expected)`, { document: browser.document, expected });
        observed.push({ ready, value: select.value });
        assert.equal(select.value, state.value, "Readiness must never author a selection");
        if (ready) return { dispose: async () => { disposed = true; } };
      }
      throw new Error("Controlled readiness deadline");
    },
  };
  return { browser, page, observed, disposed: () => disposed };
}

test("category editor readiness waits past focused destination until the original reset commits", async () => {
  const f = fixture([{ value: "destination", focused: true }, { value: "original", focused: true }]);
  try {
    await waitForCategoryMoveEditor(f.page, "original");
    assert.deepEqual(f.observed, [{ ready: false, value: "destination" }, { ready: true, value: "original" }]);
    assert.equal(f.disposed(), true);
  } finally { await f.browser.happyDOM.close(); }
});

test("category editor readiness also requires usable focus", async () => {
  const f = fixture([{ value: "original", focused: false }, { value: "original", disabled: true }, { value: "original", focused: true }]);
  try {
    await waitForCategoryMoveEditor(f.page, "original");
    assert.deepEqual(f.observed.map(({ ready }) => ready), [false, false, true]);
  } finally { await f.browser.happyDOM.close(); }
});

test("persistent wrong selection fails the bounded wait without repairing the editor", async () => {
  const f = fixture([{ value: "destination", focused: true }]);
  try {
    await assert.rejects(waitForCategoryMoveEditor(f.page, "original"), /Controlled readiness deadline/);
    assert.deepEqual(f.observed, [{ ready: false, value: "destination" }]);
    assert.equal(f.disposed(), false);
  } finally { await f.browser.happyDOM.close(); }
});

test('layout inspection accepts an intentionally ellipsized path but still rejects accidental content overflow', async()=>{
  const { measureDiscoveryLayout }=await import('../scripts/runtime-layout.mjs');
  const browser=new Window();
  browser.document.body.innerHTML='<div class="table-view"><div class="workspace-toolbar"><p class="workspace-root" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Full accessible source path</p></div><div class="project-table-scroll"><table class="project-table"><tbody><tr><td>Unintentionally overflowing content</td></tr></tbody></table></div></div>';
  const path=browser.document.querySelector('.workspace-root'),cell=browser.document.querySelector('td');
  for(const element of [path,cell]) {
    Object.defineProperty(element,'scrollWidth',{value:200});
    Object.defineProperty(element,'clientWidth',{value:80});
  }
  const context={document:browser.document,innerWidth:1024,getComputedStyle:element=>browser.getComputedStyle(element),requestAnimationFrame:callback=>callback()};
  const page={waitForFunction:async()=>({dispose:async()=>{}}),evaluate:async predicate=>runInNewContext(`(${predicate.toString()})()`,context)};
  try {
    const layout=await measureDiscoveryLayout(page);
    assert.deepEqual(Array.from(layout.elements),['TD']);
    assert.equal(path.textContent,'Full accessible source path');
    path.style.textOverflow='clip';
    assert.deepEqual(Array.from((await measureDiscoveryLayout(page)).elements),['workspace-root','TD']);
  } finally {await browser.happyDOM.close();}
});
