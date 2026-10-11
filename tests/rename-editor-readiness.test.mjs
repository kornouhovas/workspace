import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { _electron } from "playwright-core";
import { waitForRenameEditor } from "../scripts/rename-editor-readiness.mjs";

const fixture = fileURLToPath(new URL("./fixtures/rename-editor-readiness-electron.cjs", import.meta.url));

async function withPage(run) {
  const profile = await mkdtemp(join(tmpdir(), "workspace-editor-readiness-"));
  const app = await _electron.launch({ executablePath: createRequire(import.meta.url)("electron"), args: [fixture],
    env: { ...process.env, WORKSPACE_RENAME_EDITOR_PROFILE: profile }, timeout: 10000 });
  const child = app.process();
  try { await run(await app.firstWindow()); }
  finally {
    await app.close();
    assert.ok(child.exitCode !== null || child.signalCode !== null, "Fixture must exit before profile removal");
    await rm(profile, { recursive: true, force: true });
  }
}

// The fixture app owns focus. The driver neither focuses nor mutates the input.
async function mount(page, scenario) {
  await page.setContent('<label for="project-rename-name">Name</label><input id="project-rename-name"><button>Other</button>');
  await page.evaluate(scenario => {
    const input = globalThis.document.querySelector("input");
    if (scenario === "ready") input.focus();
    if (scenario === "delayed") {
      // Inject visibility before focus; arm only once the first observation ran.
      const tick = () => {
        if (globalThis.fixtureObserved) input.focus();
        else globalThis.requestAnimationFrame(tick);
      };
      globalThis.requestAnimationFrame(tick);
    }
  }, scenario);
}

function observedPage(page) {
  return {
    evaluate: async (callback, arg) => {
      const pending = page.evaluate(callback, arg);
      await page.evaluate(() => { globalThis.fixtureObserved = true; });
      return pending;
    },
  };
}

test("visible labelled Name waits for fixture-app delayed focus without driver focus", async () => {
  await withPage(async page => {
    await mount(page, "delayed");
    const outcome = await waitForRenameEditor(observedPage(page), { timeoutMs: 1000 });
    assert.equal(outcome.initial.focused, false);
    assert.equal(outcome.final.focused, true);
    assert.equal(outcome.status, "passed");
    assert.equal(await page.locator("#project-rename-name").evaluate(node => node === globalThis.document.activeElement), true);
  });
});

test("real Electron operands reject absent, hidden, disabled, unfocused and wrong-label editors", async t => {
  await withPage(async page => {
    for (const [scenario, mutate, expected] of [
      ["missing", () => globalThis.document.querySelector("input").remove(), "input_count"],
      ["hidden", () => { globalThis.document.querySelector("input").style.display = "none"; }, "hidden"],
      ["hidden ancestor", () => { globalThis.document.body.style.visibility = "hidden"; }, "hidden"],
      ["disabled", () => { globalThis.document.querySelector("input").disabled = true; }, "disabled"],
      ["disabled fieldset", () => {
        const fieldset = globalThis.document.createElement("fieldset"); fieldset.disabled = true;
        globalThis.document.body.append(fieldset); fieldset.append(globalThis.document.querySelector("input"));
      }, "disabled"],
      ["readonly", () => { globalThis.document.querySelector("input").readOnly = true; }, "not_editable"],
      ["focus loss", () => globalThis.document.querySelector("button").focus(), "unfocused"],
      ["no associated label", () => globalThis.document.querySelector("label").remove(), "label_count"],
      ["multiple labels", () => globalThis.document.body.append(globalThis.document.querySelector("label").cloneNode(true)), "label_count"],
      ["duplicate input", () => globalThis.document.body.append(globalThis.document.querySelector("input").cloneNode(true)), "input_count"],
    ]) await t.test(scenario, async () => {
      await mount(page, "ready");
      await page.evaluate(mutate);
      let evidence;
      await assert.rejects(waitForRenameEditor(page, { timeoutMs: 200, record: value => { evidence = value; } }), /readiness timed out/);
      assert.equal(evidence.status, "timed_out"); assert.equal(evidence.failure, "timeout");
      assert.equal(evidence.classification, expected);
      assert.deepEqual(Object.keys(evidence.initial).sort(), ["editable", "enabled", "focused", "inputCount", "labels", "visible"]);
      assert.deepEqual(Object.keys(evidence.final).sort(), Object.keys(evidence.initial).sort());
      assert.deepEqual(Object.keys(evidence).sort(), ["classification", "failure", "final", "initial", "status"]);
      // Reset fixture-only ancestor styling before the next independent case.
      await page.evaluate(() => { globalThis.document.body.style.visibility = ""; });
    });
  });
});

test("already-ready editor passes immediately with strict finite operands", async () => {
  await withPage(async page => {
    await mount(page, "ready");
    const outcome = await waitForRenameEditor(page, { timeoutMs: 500 });
    assert.deepEqual(outcome.initial, { inputCount: "one", visible: true, enabled: true, editable: true, focused: true, labels: "one" });
    assert.deepEqual(outcome.final, outcome.initial);
    assert.equal(outcome.classification, "ready"); assert.equal(outcome.failure, null);
  });
});

test("never-focused real Electron page exhausts one default allowance without passing", async () => {
  await withPage(async page => {
    await mount(page, "unfocused");
    let evidence;
    const started = performance.now();
    await assert.rejects(waitForRenameEditor(page, { record: value => {
      evidence = value;
      throw new Error("Secondary evidence failure must not replace timeout");
    } }), /readiness timed out/);
    const elapsed = performance.now() - started;
    assert.ok(elapsed >= 14000 && elapsed < 15500, `One allowance took ${elapsed}ms`);
    assert.equal(evidence.classification, "unfocused");
    assert.equal(evidence.initial.focused, false); assert.equal(evidence.final.focused, false);
    assert.equal(evidence.status, "timed_out");
  });
});

test("transport and evidence failures preserve the exact primary error and cannot pass unknown state", async () => {
  const primary = new Error("Private transport error that must not enter telemetry");
  let evidence;
  await assert.rejects(waitForRenameEditor({ evaluate: async () => { throw primary; } }, {
    timeoutMs: 100,
    record: value => { evidence = value; throw new Error("Secondary evidence error"); },
  }), error => error === primary);
  assert.deepEqual(evidence, {
    status: "observation_failed", failure: "observation_error", classification: "unknown",
    initial: { inputCount: "unknown", visible: null, enabled: null, editable: null, focused: null, labels: "unknown" },
    final: { inputCount: "unknown", visible: null, enabled: null, editable: null, focused: null, labels: "unknown" },
  });
  await assert.rejects(waitForRenameEditor({ evaluate: () => new Promise(() => {}) }, {
    timeoutMs: 30, record: value => { evidence = value; throw new Error("Secondary evidence error"); },
  }), /readiness deadline exceeded/);
  assert.equal(evidence.failure, "timeout"); assert.equal(evidence.classification, "unknown");
  for (const timeoutMs of [0, -1, 15001, Infinity, NaN]) {
    await assert.rejects(waitForRenameEditor({}, { timeoutMs }), RangeError);
  }
});

test("recording failure after a successful observation remains a failure", async () => {
  await withPage(async page => {
    await mount(page, "ready");
    const secondary = new Error("Evidence failure");
    await assert.rejects(waitForRenameEditor(page, { record: () => { throw secondary; } }), error => error === secondary);
  });
});

test("browser frame and timer observations are released on success, timeout and observation error", async () => {
  await withPage(async page => {
    await page.evaluate(() => {
      const frames = new Set(), timers = new Set();
      const raf = globalThis.requestAnimationFrame.bind(globalThis), cancel = globalThis.cancelAnimationFrame.bind(globalThis);
      const timeout = globalThis.setTimeout.bind(globalThis), clear = globalThis.clearTimeout.bind(globalThis);
      globalThis.requestAnimationFrame = callback => {
        const handle = raf(time => { frames.delete(handle); callback(time); }); frames.add(handle); return handle;
      };
      globalThis.cancelAnimationFrame = handle => { frames.delete(handle); cancel(handle); };
      globalThis.setTimeout = (callback, delay) => {
        const handle = timeout(() => { timers.delete(handle); callback(); }, delay); timers.add(handle); return handle;
      };
      globalThis.clearTimeout = handle => { timers.delete(handle); clear(handle); };
      globalThis.fixtureResourceCounts = () => ({ frames: frames.size, timers: timers.size });
    });
    await mount(page, "delayed");
    await waitForRenameEditor(observedPage(page), { timeoutMs: 1000 });
    assert.deepEqual(await page.evaluate(() => globalThis.fixtureResourceCounts()), { frames: 0, timers: 0 });
    await mount(page, "unfocused");
    await assert.rejects(waitForRenameEditor(page, { timeoutMs: 200 }), /readiness timed out/);
    assert.deepEqual(await page.evaluate(() => globalThis.fixtureResourceCounts()), { frames: 0, timers: 0 });
    await mount(page, "unfocused");
    await page.evaluate(() => {
      const input = globalThis.document.querySelector("input"), rect = input.getBoundingClientRect.bind(input);
      let calls = 0;
      input.getBoundingClientRect = () => {
        if (++calls > 1) throw new Error("Controlled snapshot failure");
        return rect();
      };
    });
    let evidence;
    await assert.rejects(waitForRenameEditor(page, { timeoutMs: 500, record: value => { evidence = value; } }), /Controlled snapshot failure/);
    assert.equal(evidence.status, "observation_failed"); assert.equal(evidence.failure, "observation_error");
    assert.deepEqual(await page.evaluate(() => globalThis.fixtureResourceCounts()), { frames: 0, timers: 0 });
  });
});
