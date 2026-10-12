import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate as nextTurn } from "node:timers/promises";
import { runInNewContext } from "node:vm";
import { Window } from "happy-dom";
import { measureDiscoveryLayout } from "../scripts/runtime-layout.mjs";
import { waitForRuntimeInterface } from "../scripts/runtime-startup.mjs";

function fixture() {
  const browser = new Window();
  const context = { document: browser.document, window: browser, innerWidth: 420, requestAnimationFrame: (callback) => setImmediate(callback) };
  let attempts = 0, firstAttempt;
  const attempted = new Promise((resolve) => { firstAttempt = resolve; });
  const page = {
    async waitForFunction(callback) {
      while (++attempts < 1000) {
        const result = runInNewContext(`(${callback.toString()})()`, context);
        assert.equal(typeof result?.then, "undefined", "Playwright waitForFunction does not await Promise predicates");
        firstAttempt();
        if (result) return { jsonValue: async () => result, dispose: async () => {} };
        await nextTurn();
      }
      throw new Error("Controlled readiness never completed");
    },
    evaluate: (callback) => runInNewContext(`(${callback.toString()})()`, context),
    locator: () => ({ waitFor: async () => { assert.ok(browser.document.querySelector("#interface-language")); } }),
  };
  return { browser, context, page, attempted, attempts: () => attempts };
}
function mount(f, clipped = false) {
  f.browser.document.body.innerHTML = '<section class="table-view" aria-busy="false"><div class="project-table-scroll"><div class="category-property-header"><button>Rename category</button></div></div></section>';
  const header = f.browser.document.querySelector(".category-property-header");
  const button = header.querySelector("button"), scroll = header.parentElement;
  let prepared = false, scrolled = 0;
  header.scrollIntoView = () => { prepared = true; scrolled++; };
  scroll.getBoundingClientRect = () => ({ left: 30, right: 384 });
  button.getBoundingClientRect = () => ({ left: prepared ? 180 : 400, right: prepared && !clipped ? 380 : 600 });
  return { scrolled: () => scrolled };
}

test("layout measurement waits for delayed Table mount after independently visible stale review", async () => {
  const f = fixture();
  try {
    f.browser.document.body.innerHTML = '<h3>Stale review</h3><section class="table-view" aria-busy="true"></section>';
    let completed = false;
    const measurement = measureDiscoveryLayout(f.page).then((result) => { completed = true; return result; });
    await f.attempted;
    assert.equal(completed, false);
    const table = mount(f);
    const result = await measurement;
    assert.equal(table.scrolled(), 1);
    assert.deepEqual(Array.from(result.clippedControls), []);
    assert.ok(f.attempts() >= 2);
  } finally { await f.browser.happyDOM.close(); }
});

test("a Table replaced during scroll preparation must itself be prepared before measurement", async () => {
  const f = fixture();
  try {
    const old = mount(f); let replacement, frames = 0;
    f.context.requestAnimationFrame = (callback) => setImmediate(() => {
      if (++frames === 1) replacement = mount(f);
      callback();
    });
    const result = await measureDiscoveryLayout(f.page);
    assert.equal(old.scrolled(), 1);
    assert.equal(replacement.scrolled(), 1);
    assert.ok(f.attempts() >= 2);
    assert.deepEqual(Array.from(result.clippedControls), []);
  } finally { await f.browser.happyDOM.close(); }
});

test("stable genuine clipping is returned immediately with geometry, never retried into success", async () => {
  const f = fixture();
  try {
    mount(f, true);
    const result = await measureDiscoveryLayout(f.page);
    assert.deepEqual(Array.from(result.clippedControls), ["Rename category"]);
    assert.equal(result.controls[0].right, 600);
    assert.equal(f.attempts(), 1);
  } finally { await f.browser.happyDOM.close(); }
});

test("runtime startup distinguishes terminal backend failure and records bounded diagnostics before throwing", async () => {
  const f = fixture(); const outcomes = [];
  try {
    f.browser.document.body.innerHTML = '<main class="workspace-screen"><section class="bb-status--error"></section></main>';
    f.browser.workspace = { getBackendStatus: async () => ({ state: "unavailable", diagnostic: { stage: "service_open", code: "SQLITE_BUSY" }, message: "private path and SQL" }) };
    await assert.rejects(waitForRuntimeInterface(f.page, async (outcome) => outcomes.push(outcome)), /startup failed/);
    assert.deepEqual(JSON.parse(JSON.stringify(outcomes)), [{ state: "unavailable", diagnostic: { stage: "service_open", code: "SQLITE_BUSY" } }]);
    assert.equal(JSON.stringify(outcomes).includes("private"), false);
  } finally { await f.browser.happyDOM.close(); }
});

test("runtime interface stays pending while starting and records ready only for the actual interface", async () => {
  const f = fixture(); const outcomes = [];
  try {
    f.browser.workspace = { getBackendStatus: async () => ({ state: "starting" }) };
    const waiting = waitForRuntimeInterface(f.page, async (outcome) => outcomes.push(outcome));
    await f.attempted;
    assert.deepEqual(outcomes, []);
    f.browser.workspace.getBackendStatus = async () => ({ state: "ready" });
    f.browser.document.body.innerHTML = '<select id="interface-language"></select>';
    await waiting;
    assert.deepEqual(JSON.parse(JSON.stringify(outcomes)), [{ state: "ready" }]);
  } finally { await f.browser.happyDOM.close(); }
});

test('terminal native renderer observation classifies states without clicks or status text retention', async () => {
  const { nativeInvocationRendererState } = await import('../scripts/native-bridge-evidence.mjs');
  const browser = new Window();
  try {
    const observe = () => runInNewContext(`(${nativeInvocationRendererState.toString()})(input)`,
      { document: browser.document, input: { label: 'Reveal: owned', dispatched: 'Request sent.' } });
    assert.equal(observe(), 'absent');
    browser.document.body.innerHTML = '<div class="project-reveal"><button aria-label="Reveal: owned">Reveal</button></div>';
    let clicks = 0;
    const button = browser.document.querySelector('button'); button.addEventListener('click', () => clicks++);
    assert.equal(observe(), 'idle');
    button.disabled = true; assert.equal(observe(), 'pending'); button.disabled = false;
    button.parentElement.insertAdjacentHTML('beforeend', '<section class="bb-status bb-status--error">private path error</section>');
    assert.equal(observe(), 'error');
    const status = button.parentElement.querySelector('.bb-status');
    status.className = 'bb-status bb-status--info'; status.textContent = 'Request sent.';
    assert.equal(observe(), 'acknowledged');
    status.textContent = 'private unexpected message'; assert.equal(observe(), 'unknown');
    assert.equal(clicks, 0);
  } finally { await browser.happyDOM.close(); }
});
