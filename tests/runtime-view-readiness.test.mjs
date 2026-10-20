/* global document */
import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron } from "playwright-core";
import { closeElectron } from "../scripts/runtime-lifecycle.mjs";
import { usableRuntimeViewProjection } from "../scripts/runtime-view-readiness.mjs";
import { activateRuntimeView } from "../scripts/runtime-view-controls.mjs";
import { readRuntimeInteraction, waitForRuntimeProjection } from "../scripts/runtime-performance-timing.mjs";

async function withPage(run) {
  const profile = await mkdtemp(join(tmpdir(), "runtime-view-readiness-"));
  const app = await _electron.launch({ executablePath: createRequire(import.meta.url)("electron"),
    args: [fileURLToPath(new URL("./fixtures/rename-editor-readiness-electron.cjs", import.meta.url))],
    env: { ...process.env, WORKSPACE_RENAME_EDITOR_PROFILE: profile }, timeout: 10000 });
  let primary;
  try {
    const page = await app.firstWindow();
    await page.waitForURL(await app.evaluate(() => globalThis.renameEditorInitialLoad));
    await run(page);
  } catch (error) { primary = error; }
  try { await closeElectron(app); await rm(profile, { recursive: true, force: true }); }
  catch (error) { primary ??= error; }
  if (primary) throw primary;
}


test("view readiness excludes clipped fields but requires every visible editor and the complete ordered projection", async () => {
  await withPage(async page => {
    await page.setViewportSize({ width: 1024, height: 720 });
    await page.setContent(`<style>body{margin:0}#clip{position:absolute;left:300px;top:100px;width:200px;height:100px;overflow:auto}
      #columns{display:flex;width:800px}.row{flex:0 0 200px;height:80px}</style>
      <main class="text-properties" aria-busy="false"><div id="clip"><div id="columns">
      <div class="row" data-project-id="left" data-fields-ready="false"><button>Load left</button></div>
      <div class="row" data-project-id="middle" data-fields-ready="true"><button>Edit middle</button></div>
      <div class="row" data-project-id="edge" data-fields-ready="false"><button>Load edge</button></div>
      <div class="row" data-project-id="right" data-fields-ready="false"><button>Load right</button></div>
      </div></div></main>`);
    await page.evaluate(() => { document.querySelector("#clip").scrollLeft = 220; });
    const ids = ["left", "middle", "edge", "right"];
    assert.equal(await page.evaluate(usableRuntimeViewProjection, ids), false, "The partially clipped edge is still visible and must load");
    await page.evaluate(() => { document.querySelector('[data-project-id="edge"]').setAttribute("data-fields-ready", "true"); });
    assert.equal(await page.evaluate(usableRuntimeViewProjection, ids), true, "Fully clipped rows may retain unloaded identity skeletons");
    assert.equal(await page.evaluate(usableRuntimeViewProjection, ["middle", "left", "edge", "right"]), false, "Clipping does not waive order");
    assert.equal(await page.evaluate(usableRuntimeViewProjection, ids.slice(1)), false, "Clipping does not waive complete membership");
    await page.evaluate(() => { document.querySelector('[data-project-id="middle"]').setAttribute("data-fields-ready", "false"); });
    assert.equal(await page.evaluate(usableRuntimeViewProjection, ids), false, "Visible skeletons still fail");
    await page.evaluate(() => {
      const row = document.querySelector('[data-project-id="middle"]');
      row.setAttribute("data-fields-ready", "true"); row.replaceChildren();
    });
    assert.equal(await page.evaluate(usableRuntimeViewProjection, ids), false, "A ready marker alone is insufficient without actual editors");
    await page.evaluate(() => {
      document.querySelector('[data-project-id="middle"]').innerHTML = "<button>Edit middle</button>";
      document.querySelector(".text-properties").setAttribute("aria-busy", "true");
    });
    assert.equal(await page.evaluate(usableRuntimeViewProjection, ids), false, "Pending projection still fails");
    await page.evaluate(() => { document.querySelector(".text-properties").setAttribute("aria-busy", "false"); });
    assert.equal(await page.evaluate(usableRuntimeViewProjection, ids), true);
    await page.evaluate(() => {
      const clip = document.querySelector("#clip");
      clip.style.left = "0px"; clip.style.width = "1000px";
      document.querySelector("#columns").style.display = "block";
      clip.scrollLeft = 0; clip.scrollTop = 90;
    });
    assert.equal(await page.evaluate(usableRuntimeViewProjection, ids), true, "Vertical clipping also permits fully hidden skeletons");
    await page.evaluate(() => { document.querySelector('[data-project-id="edge"]').setAttribute("data-fields-ready", "false"); });
    assert.equal(await page.evaluate(usableRuntimeViewProjection, ids), false, "A partially visible bottom edge still requires editors");
  });
});

test("runtime activation supports current tabs and the immutable baseline select with one action each", async () => {
  await withPage(async page => {
    page.setDefaultTimeout(500);
    await page.setContent('<label>Current view <select><option value="table">Table</option><option value="board">Board</option></select></label>');
    await page.evaluate(() => {
      globalThis.activations = [];
      document.querySelector("select").addEventListener("change", event => globalThis.activations.push(event.target.value));
    });
    await activateRuntimeView(page, { viewId: "board", name: "Board" });
    assert.deepEqual(await page.evaluate(() => globalThis.activations), ["board"]);
    await page.setContent('<div role="tablist" aria-label="Current view"><button role="tab" aria-selected="true">Table</button><button role="tab" aria-selected="false">Board</button></div>');
    await page.evaluate(() => {
      globalThis.activations = [];
      document.querySelectorAll('[role="tab"]').forEach(tab => tab.addEventListener("click", () => {
        document.querySelectorAll('[role="tab"]').forEach(item => item.setAttribute("aria-selected", String(item === tab)));
        globalThis.activations.push(tab.textContent);
      }));
    });
    await activateRuntimeView(page, { viewId: "board", name: "Board" });
    assert.deepEqual(await page.evaluate(() => globalThis.activations), ["Board"]);
    assert.equal(await page.getByRole("tab", { name: "Board", selected: true }).count(), 1);
  });
});


test("event-to-paint timing includes delayed committed work and excludes later driver observation", async () => {
  await withPage(async page => {
    await page.setContent('<button id="save">Apply</button><section class="text-properties" aria-busy="false"><div data-project-id="one" data-fields-ready="true"><button>Edit value</button></div></section>');
    await page.evaluate(() => {
      document.querySelector("#save").addEventListener("keydown", () => { globalThis.__workspacePerformanceStarted = performance.now(); }, { once: true });
      document.querySelector("#save").addEventListener("click", () => {
        const content = document.querySelector(".text-properties"); content.setAttribute("aria-busy", "true");
        setTimeout(() => {
          content.setAttribute("aria-busy", "false");
          globalThis.requestAnimationFrame(() => { const until = performance.now() + 80; while (performance.now() < until) { /* controlled renderer work */ } });
        }, 120);
      });
    });
    await page.getByRole("button", { name: "Apply", exact: true }).press("Enter");
    const paintedAt = await waitForRuntimeProjection(page, ["one"]);
    const before = await readRuntimeInteraction(page, paintedAt);
    await new Promise(done => setTimeout(done, 250)); // Deliberate driver delay after completed renderer work.
    const after = await readRuntimeInteraction(page, paintedAt);
    assert.equal(after.ms, before.ms, "Later driver scheduling must not move the committed-paint endpoint");
    assert.ok(after.ms >= 200, "Pending content and renderer work before the completion frames stay measured");
    assert.ok(after.observedMs - before.observedMs >= 240, "The injected driver delay is independently observable");
    assert.ok(after.driverObservationDelayMs >= 240);
    await assert.rejects(readRuntimeInteraction(page, Number.NaN), /fresh measured event/);
    const startedAt = await page.evaluate(() => globalThis.__workspacePerformanceStarted);
    await assert.rejects(readRuntimeInteraction(page, startedAt - 1), /fresh measured event/);
    await assert.rejects(readRuntimeInteraction(page, startedAt + 1_000_000), /fresh measured event/);
    await page.evaluate(() => { globalThis.__workspacePerformanceStarted = undefined; });
    await assert.rejects(readRuntimeInteraction(page, paintedAt), /fresh measured event/);
    await page.evaluate(() => { globalThis.__workspacePerformanceStarted = Number.NaN; });
    await assert.rejects(readRuntimeInteraction(page, paintedAt), /fresh measured event/);
  });
});


test("projection readiness rechecks fields invalidated during the first frame pair", async () => {
  await withPage(async page => {
    await page.setContent('<section class="text-properties" aria-busy="false"><div data-project-id="one" data-fields-ready="true"><button>Edit value</button></div></section>');
    let first = true;
    const controlledPage = {
      evaluate: page.evaluate.bind(page),
      waitForFunction: async (...args) => {
        const result = await page.waitForFunction(...args);
        if (first) {
          first = false;
          await page.evaluate(() => globalThis.requestAnimationFrame(() => {
            const row = document.querySelector("[data-project-id]"); row.setAttribute("data-fields-ready", "false");
            setTimeout(() => { row.setAttribute("data-fields-ready", "true"); globalThis.recoveredAt = performance.now(); }, 180);
          }));
        }
        return result;
      },
    };
    const paintedAt = await waitForRuntimeProjection(controlledPage, ["one"]);
    const recoveredAt = await page.evaluate(() => globalThis.recoveredAt);
    assert.ok(Number.isFinite(recoveredAt) && paintedAt >= recoveredAt, "Final paint must wait for fields revealed as unready after initial layout");
  });
});
