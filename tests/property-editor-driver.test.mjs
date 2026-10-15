import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { _electron } from "playwright-core";
import { closeElectron, withDeadline } from "../scripts/runtime-lifecycle.mjs";
import { openPropertyCreator } from "../scripts/property-editor-driver.mjs";

// Isolate native browser timers from the rename suite's host-clock mocks.
async function withPage(run) {
  const profile = await mkdtemp(join(tmpdir(), "workspace-property-editor-"));
  const fixture = fileURLToPath(new URL("./fixtures/rename-editor-readiness-electron.cjs", import.meta.url));
  const app = await _electron.launch({ executablePath: createRequire(import.meta.url)("electron"), args: [fixture],
    env: { ...process.env, WORKSPACE_RENAME_EDITOR_PROFILE: profile }, timeout: 10000 });
  const child = app.process();
  const quitEvents = [];
  child.once("exit", () => quitEvents.push("parent-exit"));
  child.stderr.on("data", data => {
    for (const event of ["before-quit", "will-quit", "quit"])
      if (data.toString().includes(`[property-fixture]${event}`) && !quitEvents.includes(event)) quitEvents.push(event);
  });
  let primary;
  try {
    await app.evaluate(({ app }) => {
      for (const event of ["before-quit", "will-quit", "quit"])
        app.on(event, () => process.stderr.write(`[property-fixture]${event}\n`));
    });
    const deadline = Date.now() + 30000;
    const page = await app.firstWindow({ timeout: 30000 });
    const url = await withDeadline(app.evaluate(() => globalThis.renameEditorInitialLoad), Math.max(1, deadline - Date.now()), "Property fixture navigation");
    await page.waitForURL(url, { waitUntil: "load", timeout: Math.max(1, deadline - Date.now()) });
    await run(page);
  } catch (error) { primary = error; }
  try {
    try {
      // Playwright owns app.quit() and debugger disconnection. Avoid a second
      // concurrent quit request from the general runtime helper in this fixture.
      await withDeadline(app.close(), 10000, "Electron shutdown");
    } catch (error) {
      // Failed normal closure stays failed. Reuse owned forced cleanup only to
      // stop a remaining fixture process, never to turn that failure into a pass.
      if (child.exitCode === null && child.signalCode === null) {
        try { await closeElectron(app, 1); }
        catch (cleanupError) { error.forcedCleanup = cleanupError.forcedCleanup ?? { status: "unverified" }; }
      }
      throw error;
    }
    assert.ok(child.exitCode !== null || child.signalCode !== null);
    await rm(profile, { recursive: true, force: true });
  } catch (error) {
    error.message = `[property-fixture] ${JSON.stringify({ quitEvents, parentExited: child.exitCode !== null || child.signalCode !== null,
      forcedCleanup: error.forcedCleanup ?? null })}\n${error.message}`;
    if (primary) console.error("Additional property fixture cleanup failure:", error);
    else primary = error;
  }
  if (primary) throw primary;
}

// This is the runtime driver's native disabled-button/keyboard seam. The app
// owns enablement and form creation; the driver must send one deliberate Enter.
test("property creation waits for initial loading before keyboard activation in real Electron", async () => {
  await withPage(async page => {
    page.setDefaultTimeout(5000);
    await page.setContent('<button id="create" disabled>Create MultiSelect property</button><div id="editor"></div>');
    await page.evaluate(() => {
      globalThis.fixturePropertyActivations = 0;
      const button = globalThis.document.querySelector("#create");
      button.addEventListener("click", () => {
        globalThis.fixturePropertyActivations++;
        globalThis.document.querySelector("#editor").innerHTML = '<label for="property-name">Property name</label><input id="property-name">';
        globalThis.document.querySelector("#property-name").focus();
      });
      globalThis.setTimeout(() => { button.disabled = false; }, 500);
    });
    const input = await openPropertyCreator(page, { createLabel: "Create MultiSelect property", propertyNameLabel: "Property name" });
    await input.fill("Tags");
    assert.equal(await input.inputValue(), "Tags");
    assert.equal(await page.evaluate(() => globalThis.fixturePropertyActivations), 1);
  });
});

test("property creation keeps the caller deadline and never activates a still-loading control", async () => {
  await withPage(async page => {
    page.setDefaultTimeout(100);
    await page.setContent('<button disabled>Create MultiSelect property</button>');
    await page.evaluate(() => {
      globalThis.fixturePropertyActivations = 0;
      globalThis.document.querySelector("button").addEventListener("click", () => { globalThis.fixturePropertyActivations++; });
    });
    await assert.rejects(openPropertyCreator(page, { createLabel: "Create MultiSelect property", propertyNameLabel: "Property name" }), /Timeout/);
    assert.equal(await page.evaluate(() => globalThis.fixturePropertyActivations), 0);
    assert.equal(await page.getByLabel("Property name", { exact: true }).count(), 0);
  });
});
