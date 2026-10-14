import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { withDeadline } from "../scripts/runtime-lifecycle.mjs";
import { _electron } from "playwright-core";
import { fillExactRenameDraft } from "../scripts/smoke-project-rename-ui.mjs";
import { observeRenameEditor, waitForRenameEditor } from "../scripts/rename-editor-readiness.mjs";

const fixture = fileURLToPath(new URL("./fixtures/rename-editor-readiness-electron.cjs", import.meta.url));

async function waitForFixtureNavigation(page, app, deadline) {
  const remaining = () => {
    const value = deadline - Date.now();
    if (value <= 0) throw new Error("Fixture initial navigation deadline exceeded");
    return value;
  };
  const finalURL = await withDeadline(app.evaluate(() => globalThis.renameEditorInitialLoad),
    remaining(), "Fixture initial navigation");
  assert.equal(typeof finalURL, "string"); assert.ok(finalURL.startsWith("data:text/html,"));
  // Main and Page use separate transports; await this exact navigation's
  // browser-context load before any caller can mount or author an input.
  await page.waitForURL(finalURL, { waitUntil: "load", timeout: remaining() });
}

async function withPage(run, removeProfile = rm, controlLoad = false) {
  const profile = await mkdtemp(join(tmpdir(), "workspace-editor-readiness-"));
  const app = await _electron.launch({ executablePath: createRequire(import.meta.url)("electron"), args: [fixture],
    env: { ...process.env, WORKSPACE_RENAME_EDITOR_PROFILE: profile, WORKSPACE_RENAME_EDITOR_CONTROL_LOAD: String(controlLoad) }, timeout: 10000 });
  const child = app.process();
  let failed = false;
  let primary;
  try {
    // Share the original firstWindow allowance with the fixture-owned load.
    const deadline = Date.now() + 30000;
    const page = await app.firstWindow({ timeout: Math.max(1, deadline - Date.now()) });
    await waitForFixtureNavigation(page, app, deadline);
    await run(page, app);
  }
  catch (error) { failed = true; primary = error; }
  try {
    await app.close();
    assert.ok(child.exitCode !== null || child.signalCode !== null, "Fixture must exit before profile removal");
    await removeProfile(profile, { recursive: true, force: true });
  } catch (error) {
    if (!failed) throw error;
    console.error("Additional readiness fixture cleanup failure:", error);
  }
  if (failed) throw primary;
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

// Expire only the renderer observation; keep the host's finite delivery budget.
// Forward its real callback and snapshots without changing the readiness predicate.
function promptObservationPage(page) {
  return { evaluate: (callback, arg) => page.evaluate(callback, { ...arg, deadline: 0 }) };
}

const unknownOperands = {
  inputCount: "unknown", visible: null, enabled: null, editable: null, focused: null, labels: "unknown",
};

function unknownEvidence(failure) {
  return { status: "observation_failed", failure, classification: "unknown",
    initial: { ...unknownOperands }, final: { ...unknownOperands } };
}

function controlledHostClock(t) {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1000 });
  const active = new Set();
  const schedule = globalThis.setTimeout, cancel = globalThis.clearTimeout;
  const scheduled = t.mock.method(globalThis, "setTimeout", (callback, delay) => {
    const handle = schedule(() => { active.delete(handle); callback(); }, delay);
    active.add(handle);
    return handle;
  });
  const cleared = t.mock.method(globalThis, "clearTimeout", handle => { active.delete(handle); cancel(handle); });
  return {
    active,
    tick: ms => t.mock.timers.tick(ms),
    restore: () => { scheduled.mock.restore(); cleared.mock.restore(); t.mock.timers.reset(); },
  };
}

test("fixture cleanup errors retain a failed control's primary error and fail a successful control", async () => {
  const primary = new Error("Controlled primary assertion failure");
  const secondary = new Error("Controlled profile cleanup failure");
  let cleanupCalls = 0;
  const failCleanup = async (...args) => {
    await rm(...args);
    cleanupCalls++;
    throw secondary;
  };
  await assert.rejects(withPage(async () => { throw primary; }, failCleanup), error => error === primary);
  assert.equal(cleanupCalls, 1);
  await assert.rejects(withPage(async () => {}, failCleanup), error => error === secondary);
  assert.equal(cleanupCalls, 2);
});

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
    for (const [scenario, mutate, expected, operands] of [
      ["missing", () => globalThis.document.querySelector("input").remove(), "input_count", { inputCount: "none" }],
      ["hidden", () => { globalThis.document.querySelector("input").style.display = "none"; }, "hidden", { visible: false }],
      ["hidden ancestor", () => { globalThis.document.body.style.visibility = "hidden"; }, "hidden", { visible: false }],
      ["disabled", () => { globalThis.document.querySelector("input").disabled = true; }, "disabled", { enabled: false }],
      ["disabled fieldset", () => {
        const fieldset = globalThis.document.createElement("fieldset"); fieldset.disabled = true;
        globalThis.document.body.append(fieldset); fieldset.append(globalThis.document.querySelector("input"));
      }, "disabled", { enabled: false }],
      ["readonly", () => { globalThis.document.querySelector("input").readOnly = true; }, "not_editable", { editable: false }],
      ["focus loss", () => globalThis.document.querySelector("button").focus(), "unfocused", { focused: false }],
      ["no associated label", () => globalThis.document.querySelector("label").remove(), "label_count", { labels: "none" }],
      ["multiple labels", () => globalThis.document.body.append(globalThis.document.querySelector("label").cloneNode(true)), "label_count", { labels: "multiple" }],
      ["duplicate input", () => globalThis.document.body.append(globalThis.document.querySelector("input").cloneNode(true)), "input_count", { inputCount: "multiple" }],
    ]) await t.test(scenario, async () => {
      await mount(page, "ready");
      await page.evaluate(mutate);
      let evidence;
      await assert.rejects(waitForRenameEditor(promptObservationPage(page), { timeoutMs: 200, record: value => { evidence = value; } }), /readiness timed out/);
      assert.equal(evidence.status, "timed_out"); assert.equal(evidence.failure, "timeout");
      assert.equal(evidence.classification, expected);
      for (const observation of [evidence.initial, evidence.final]) {
        for (const [operand, value] of Object.entries(operands)) assert.equal(observation[operand], value);
        assert.ok(["none", "one", "multiple"].includes(observation.inputCount));
        assert.ok(["none", "one", "multiple", "unknown"].includes(observation.labels));
        for (const operand of ["visible", "enabled", "editable", "focused"]) assert.equal(typeof observation[operand], "boolean");
      }
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

test("never-focused real Electron page exhausts one default allowance without passing", async t => {
  await withPage(async page => {
    await mount(page, "unfocused");
    // Obtain real read-only operands, then control delivery against the host's
    // default deadline. Runner load must not choose which timeout we assert.
    const outcome = await page.evaluate(observeRenameEditor, { deadline: 0 });
    assert.equal(outcome.status, "timed_out");
    assert.equal(outcome.initial.focused, false); assert.equal(outcome.final.focused, false);
    for (const late of [false, true]) await t.test(late ? "late delivery" : "timely delivery", async t => {
      const deferred = Promise.withResolvers(), records = [];
      const clock = controlledHostClock(t);
      let pending;
      try {
        pending = waitForRenameEditor({ evaluate: () => deferred.promise }, { record: value => {
          records.push(value);
          throw new Error("Secondary evidence failure must not replace timeout");
        } });
        const rejected = assert.rejects(pending, late ? /readiness deadline exceeded/ : /readiness timed out/);
        clock.tick(14999);
        assert.equal(records.length, 0); assert.equal(clock.active.size, 1);
        if (late) clock.tick(1);
        else deferred.resolve(outcome);
        await rejected;
        assert.deepEqual(records, [late ? unknownEvidence("timeout") : {
          ...outcome, failure: "timeout", classification: "unfocused",
        }]);
        assert.equal(clock.active.size, 0);
        deferred.resolve(outcome); await deferred.promise;
        await pending.catch(() => {});
        clock.tick(15000);
        assert.equal(records.length, 1);
      } finally {
        deferred.resolve(outcome); await pending?.catch(() => {}); clock.restore();
      }
    });
  });
});

test("real readonly observations retain operand rejection before delivery expiry and unknown after it", async t => {
  await withPage(async page => {
    await mount(page, "ready");
    await page.evaluate(() => { globalThis.document.querySelector("input").readOnly = true; });
    // Complete Electron I/O before controlling host time.
    const outcome = await page.evaluate(observeRenameEditor, { deadline: 0 });
    assert.equal(outcome.status, "timed_out");
    assert.equal(outcome.initial.editable, false); assert.equal(outcome.final.editable, false);
    for (const late of [false, true]) await t.test(late ? "delivery after deadline" : "delivery before deadline", async t => {
      const deferred = Promise.withResolvers(), records = [];
      const clock = controlledHostClock(t);
      let pending;
      try {
        pending = waitForRenameEditor({ evaluate: () => deferred.promise }, {
          timeoutMs: 200, record: value => { records.push(value); },
        });
        const rejected = assert.rejects(pending, late ? /readiness deadline exceeded/ : /readiness timed out/);
        assert.equal(clock.active.size, 1);
        clock.tick(199);
        assert.equal(records.length, 0);
        if (late) clock.tick(1);
        else deferred.resolve(outcome);
        await rejected;
        assert.equal(clock.active.size, 0);
        assert.deepEqual(records, [late ? unknownEvidence("timeout") : {
          ...outcome, failure: "timeout", classification: "not_editable",
        }]);
        const recorded = structuredClone(records);
        deferred.resolve(outcome); await deferred.promise;
        // Await the already rejected operation after late delivery; no new record.
        await pending.catch(() => {});
        clock.tick(200);
        assert.deepEqual(records, recorded);
        assert.equal(clock.active.size, 0);
      } finally {
        deferred.resolve(outcome); await pending?.catch(() => {}); clock.restore();
      }
    });
  });
});

test("host timers are disposed after real success, renderer rejection, transport error and deadline", async t => {
  await withPage(async page => {
    await mount(page, "ready");
    const ready = await page.evaluate(observeRenameEditor, { deadline: Date.now() + 500 });
    await page.evaluate(() => { globalThis.document.querySelector("input").readOnly = true; });
    const rejected = await page.evaluate(observeRenameEditor, { deadline: 0 });
    assert.equal(ready.status, "passed"); assert.equal(rejected.status, "timed_out");
    for (const mode of ["success", "renderer rejection", "transport error", "deadline"]) await t.test(mode, async t => {
      const primary = new Error("Private transport error that must not enter telemetry");
      const records = [], clock = controlledHostClock(t);
      try {
        const pending = waitForRenameEditor({ evaluate: () => {
          if (mode === "transport error") return Promise.reject(primary);
          if (mode === "deadline") return new Promise(() => {});
          return Promise.resolve(mode === "success" ? ready : rejected);
        } }, { timeoutMs: mode === "deadline" ? 30 : 100, record: value => {
          records.push(value);
          if (mode === "transport error" || mode === "deadline") throw new Error("Secondary evidence error");
        } });
        assert.equal(clock.active.size, 1);
        if (mode === "success") assert.equal((await pending).classification, "ready");
        else {
          const rejection = assert.rejects(pending, mode === "transport error" ? error => error === primary :
            mode === "deadline" ? /readiness deadline exceeded/ : /readiness timed out/);
          if (mode === "deadline") {
            clock.tick(29); assert.equal(records.length, 0); assert.equal(clock.active.size, 1);
            clock.tick(1);
          }
          await rejection;
        }
        assert.equal(clock.active.size, 0);
        if (mode === "transport error" || mode === "deadline") {
          assert.deepEqual(records, [unknownEvidence(mode === "deadline" ? "timeout" : "observation_error")]);
        } else assert.deepEqual(records, [{ ...(mode === "success" ? ready : rejected),
          failure: mode === "success" ? null : "timeout", classification: mode === "success" ? "ready" : "not_editable" }]);
        clock.tick(200);
        assert.equal(records.length, 1); assert.equal(clock.active.size, 0);
      } finally { clock.restore(); }
    });
  });
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
    await assert.rejects(waitForRenameEditor(promptObservationPage(page), { timeoutMs: 200 }), /readiness timed out/);
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


test("exact rename authoring survives selection loss between locator actions in real Electron", async () => {
  await withPage(async page => {
    await mount(page, "ready");
    const locator = page.locator("#project-rename-name");
    await locator.fill("  Renamed 日本語");
    let submissions = 0;
    await page.evaluate(() => {
      globalThis.fixtureSubmissions = 0;
      globalThis.document.querySelector("input").addEventListener("keydown", event => {
        if (event.key === "Enter") globalThis.fixtureSubmissions++;
      });
    });
    // Fixture-only selection loss after a successful text-selection action.
    // The driver still uses real locator/keyboard actions; no fake input values.
    const input = {
      selectText: async () => {
        await locator.selectText();
        await locator.evaluate(node => { node.setSelectionRange(node.value.length, node.value.length); });
      },
      press: key => locator.press(key),
      fill: draft => locator.fill(draft),
      inputValue: () => locator.inputValue(),
    };
    assert.equal(await fillExactRenameDraft(input, "  Exact 日本語  "), true);
    assert.equal(await locator.inputValue(), "  Exact 日本語  ");
    submissions = await page.evaluate(() => globalThis.fixtureSubmissions);
    assert.equal(submissions, 0);
    // Ordinary authoring and empty drafts use the same actual locator seam.
    assert.equal(await fillExactRenameDraft(locator, ""), true);
    assert.equal(await locator.inputValue(), "");
  });
});


test("fixture initial navigation cannot erase an authored editor after firstWindow", async () => {
  await withPage(async (page, app) => {
    await mount(page, "ready");
    await withDeadline(app.evaluate(() => globalThis.renameEditorInitialLoad), 30000, "Controlled fixture navigation");
    assert.equal(await page.locator("#project-rename-name").count(), 1);
    assert.equal(await page.locator("#project-rename-name").evaluate(node => node === globalThis.document.activeElement), true);
  }, rm, true);
});


test("fixture main load receipt cannot authorize mounting before Page navigation commits", async () => {
  const finalURL = "data:text/html,fixture-controlled", calls = []; let pendingNavigation = true;
  const app = { evaluate: async () => { calls.push("main_loaded"); return finalURL; } };
  const page = {
    waitForURL: async (url, options) => {
      assert.equal(url, finalURL); assert.equal(options.waitUntil, "load");
      assert.ok(options.timeout > 0 && options.timeout <= 30000);
      calls.push("page_loaded"); pendingNavigation = false;
    },
    setContent: async () => {
      if (pendingNavigation) throw new Error("page.setContent: Execution context was destroyed, most likely because of a navigation");
      calls.push("mounted");
    },
  };
  await waitForFixtureNavigation(page, app, Date.now() + 30000);
  await page.setContent("<input>");
  assert.deepEqual(calls, ["main_loaded", "page_loaded", "mounted"]);
});
