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
