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
