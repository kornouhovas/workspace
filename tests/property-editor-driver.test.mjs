import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { _electron } from "playwright-core";
import { closeElectron, withDeadline } from "../scripts/runtime-lifecycle.mjs";
import { openPropertyCreator, waitForFocusedInput } from "../scripts/property-editor-driver.mjs";

// Isolate native browser timers from the rename suite's host-clock mocks.
async function withPage(run) {
  const profile = await mkdtemp(join(tmpdir(), "workspace-property-editor-"));
  const fixture = fileURLToPath(new URL("./fixtures/rename-editor-readiness-electron.cjs", import.meta.url));
  const app = await _electron.launch({ executablePath: createRequire(import.meta.url)("electron"), args: [fixture],
    env: { ...process.env, WORKSPACE_RENAME_EDITOR_PROFILE: profile }, timeout: 10000 });
  const child = app.process();
  const quitEvents = [], timeline = [];
  const started = performance.now();
  const record = event => { if (timeline.length < 16) timeline.push({ event, elapsedMs: Math.round(performance.now() - started) }); };
  let debuggerWaiting = false;
  let stderrTail = "";
  child.once("exit", () => { quitEvents.push("parent-exit"); record("parent-exit"); });
  child.once("close", () => record("stdio-close"));
  child.stderr.on("data", data => {
    const text = stderrTail + data.toString();
    stderrTail = text.slice(-128);
    debuggerWaiting ||= text.includes("Waiting for the debugger to disconnect...");
    for (const event of ["before-quit", "will-quit", "quit", "node-before-exit", "node-exit"])
      if (text.includes(`[property-fixture]${event}`) && !quitEvents.includes(event)) { quitEvents.push(event); record(event); }
  });
  // Finite event receipts distinguish page/context shutdown from a native parent
  // that remains after JavaScript quit. They never request another close.
  app.once("close", () => record("application-close"));
  app.context().once("close", () => record("context-close"));
  let primary;
  try {
    await app.evaluate(({ app }) => {
      for (const event of ["before-quit", "will-quit", "quit"])
        app.on(event, () => process.stderr.write(`[property-fixture]${event}\n`));
      for (const event of ["beforeExit", "exit"])
        process.once(event, () => process.stderr.write(`[property-fixture]${event === "exit" ? "node-exit" : "node-before-exit"}\n`));
    });
    const deadline = Date.now() + 30000;
    const page = await app.firstWindow({ timeout: 30000 });
    page.once("close", () => record("page-close"));
    const url = await withDeadline(app.evaluate(() => globalThis.renameEditorInitialLoad), Math.max(1, deadline - Date.now()), "Property fixture navigation");
    await page.waitForURL(url, { waitUntil: "load", timeout: Math.max(1, deadline - Date.now()) });
    await run(page);
  } catch (error) { primary = error; }
  try {
    // The shared helper now owns one Playwright quit, with the same 10s normal
    // deadline and finite forced cleanup that preserves the original failure.
    // A second close() on a closing Playwright handle can resolve immediately
    // without stopping its native process, so do not use it as forced cleanup.
    record("close-request");
    await closeElectron(app);
    record("close-resolved");
    assert.ok(child.exitCode !== null || child.signalCode !== null);
    await rm(profile, { recursive: true, force: true });
  } catch (error) {
    record("close-rejected");
    error.message = `[property-fixture] ${JSON.stringify({ quitEvents, timeline, debuggerWaiting, parentExited: child.exitCode !== null || child.signalCode !== null,
      forcedCleanup: error.forcedCleanup ?? null })}\n${error.message}`;
    if (primary) console.error("Additional property fixture cleanup failure:", error);
    else primary = error;
  }
  if (primary) throw primary;
}

// This is the runtime driver's native disabled-button/keyboard seam. The app
// owns enablement and form creation; the driver must send one deliberate Enter.
for (const createLabel of ["Create Single Select property", "Создать Single Select-свойство", "Create MultiSelect property", "Create Number property", "Создать Number-свойство", "Create Date property", "Создать Date-свойство"]) {
test(`property creation waits for initial loading before keyboard activation in real Electron: ${createLabel}`, async () => {
  await withPage(async page => {
    page.setDefaultTimeout(5000);
    await page.setContent(`<button id="create" disabled>Add property</button><div id="editor"></div>`);
    await page.evaluate(createLabel => {
      globalThis.fixturePropertyActivations = 0;
      const button = globalThis.document.querySelector("#create");
      button.addEventListener("click", () => {
        globalThis.fixturePropertyActivations++;
        globalThis.document.querySelector("#editor").innerHTML = `<label for="property-name">Property name</label><input id="property-name"><label for="property-type">Property type</label><select id="property-type"><option value="${createLabel.includes("MultiSelect") ? "multi_select" : createLabel.includes("Single Select") ? "single_select" : createLabel.includes("Number") ? "number" : "date"}">${createLabel}</option></select>`;
        globalThis.document.querySelector("#property-name").focus();
      });
      globalThis.setTimeout(() => { button.disabled = false; }, 500);
    }, createLabel);
    const input = await openPropertyCreator(page, { createLabel, propertyNameLabel: "Property name" });
    await input.fill("Tags");
    assert.equal(await input.inputValue(), "Tags");
    assert.equal(await page.evaluate(() => globalThis.fixturePropertyActivations), 1);
  });
});
}

test("property creation keeps the caller deadline and never activates a still-loading control", async () => {
  await withPage(async page => {
    await page.setContent('<button disabled>Add property</button>');
    await page.evaluate(() => {
      globalThis.fixturePropertyActivations = 0;
      globalThis.document.querySelector("button").addEventListener("click", () => { globalThis.fixturePropertyActivations++; });
    });
    // The 100ms subject deadline starts after HTML/listener preparation.
    page.setDefaultTimeout(100);
    await assert.rejects(openPropertyCreator(page, { createLabel: "Create MultiSelect property", propertyNameLabel: "Property name" }), /Timeout/);
    assert.equal(await page.evaluate(() => globalThis.fixturePropertyActivations), 0);
    assert.equal(await page.getByLabel("Property name", { exact: true }).count(), 0);
  });
});


test("creation input readiness observes delayed app-owned focus without taking it", async () => {
  await withPage(async page => {
    page.setDefaultTimeout(1000);
    await page.setContent('<label for="project-creation-name">Name</label><input id="project-creation-name">');
    assert.equal(await page.locator("input").evaluate(node => node === globalThis.document.activeElement), false);
    await page.evaluate(() => {
      globalThis.setTimeout(() => globalThis.document.querySelector("input").focus(), 200);
    });
    await waitForFocusedInput(page, "#project-creation-name");
    assert.equal(await page.locator("input").evaluate(node => node === globalThis.document.activeElement), true);
    assert.equal(await page.locator("input").inputValue(), "");
    await page.locator("input").evaluate(node => node.blur());
    page.setDefaultTimeout(100);
    await assert.rejects(waitForFocusedInput(page, "#project-creation-name"), /Timeout/);
    assert.equal(await page.locator("input").evaluate(node => node === globalThis.document.activeElement), false);
  });
});

test("installed workspace keyboard creation waits for the asynchronous folder selection", async () => {
  const { createInstalledWorkspace } = await import("../scripts/workspace-install-driver.mjs");
  await withPage(async page => {
    // Controlled initial resource load keeps fixture preparation separate from
    // the driver's unchanged one-second keyboard/enablement deadline.
    await page.route("https://workspace-fixture.invalid/prepare", async route => {
      await new Promise(done => setTimeout(done, 1200));
      await route.fulfill({ status: 200, contentType: "text/plain", body: "prepared" });
    });
    await page.setContent('<img src="https://workspace-fixture.invalid/prepare" alt=""><button id="pick">Choose project folder</button><h1>Workspace</h1><div id="result"></div>');
    await page.evaluate(() => {
      const pick = globalThis.document.querySelector("#pick");
      globalThis.installFixtureCreates = 0;
      pick.addEventListener("click", () => {
        globalThis.setTimeout(() => {
          globalThis.installFixtureCreates++;
          globalThis.document.querySelector("#result").innerHTML = `<button aria-current="page">Workspace</button><button id="settings">Settings</button>
            <button id="back" hidden>Back to workspace</button><section id="management" hidden>
            <button role="tab">Workspaces</button><h2 id="workspace-title">Workspace</h2><p>/selected-source</p></section>`;
          globalThis.installFixtureSettingsVisits = 0;
          const management = globalThis.document.querySelector("#management"), back = globalThis.document.querySelector("#back");
          globalThis.document.querySelector("#settings").addEventListener("click", () => {
            globalThis.installFixtureSettingsVisits++; management.hidden = false; back.hidden = false;
          });
          back.addEventListener("click", () => { management.hidden = true; back.hidden = true; });
        }, 200);
      });
    });
    page.setDefaultTimeout(1000);
    await createInstalledWorkspace(page, { name: "Workspace", source: "/selected-source" });
    assert.equal(await page.evaluate(() => globalThis.installFixtureCreates), 1);
    assert.equal(await page.evaluate(() => globalThis.installFixtureSettingsVisits), 1);
    assert.equal(await page.locator("#management").isVisible(), false, "Creation returns to the workspace after checking its exact source");
  });
});

test("installed workspace keyboard driver retains its deadline when automatic creation never completes", async () => {
  const { createInstalledWorkspace } = await import("../scripts/workspace-install-driver.mjs");
  await withPage(async page => {
    await page.setContent('<h1>Workspace</h1><button>Choose project folder</button><p>/selected-source</p>');
    page.setDefaultTimeout(100);
    await assert.rejects(createInstalledWorkspace(page, { name: "Workspace", source: "/selected-source" }), /Timeout/);
    assert.equal(await page.locator("#workspace-title").count(), 0);
  });
});

test("keyboard discovery Apply waits for the reviewed preview before submitting exactly once in EN/RU", async () => {
  const { applyReviewedDiscovery } = await import("../scripts/workspace-management-driver.mjs");
  await withPage(async page => {
    await page.route("https://workspace-fixture.invalid/discovery-prepare", async route => {
      await new Promise(done => setTimeout(done, 1200));
      await route.fulfill({ status:200, contentType:"text/plain", body:"prepared" });
    });
    page.setDefaultTimeout(1000);
    for (const label of ["Apply reviewed projects", "Применить проверенные проекты"]) {
      await page.setContent(`<img src="https://workspace-fixture.invalid/discovery-prepare" alt=""><button disabled>${label}</button>`, { timeout:30000 });
      await page.evaluate(() => {
        const apply = globalThis.document.querySelector("button");
        globalThis.discoveryApplies = 0;
        apply.addEventListener("click", () => { globalThis.discoveryApplies++; });
        globalThis.setTimeout(() => { apply.disabled = false; }, 200);
      });
      await applyReviewedDiscovery(page);
      assert.equal(await page.evaluate(() => globalThis.discoveryApplies), 1);
    }
  });
});

test("keyboard discovery Apply retains its caller deadline when no reviewed preview becomes available", async () => {
  const { applyReviewedDiscovery } = await import("../scripts/workspace-management-driver.mjs");
  await withPage(async page => {
    await page.setContent('<button disabled>Apply reviewed projects</button>');
    page.setDefaultTimeout(100);
    await assert.rejects(applyReviewedDiscovery(page), /Timeout/);
  });
});
