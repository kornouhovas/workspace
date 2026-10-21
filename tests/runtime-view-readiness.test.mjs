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
import { activateRuntimeView, setRuntimeViewLanguage } from "../scripts/runtime-view-controls.mjs";
import { readRuntimeInteraction, waitForRuntimeProjection } from "../scripts/runtime-performance-timing.mjs";

async function withPage(run) {
  const profile = await mkdtemp(join(tmpdir(), "runtime-view-readiness-"));
  const app = await _electron.launch({ executablePath: createRequire(import.meta.url)("electron"),
    args: [fileURLToPath(new URL("./fixtures/rename-editor-readiness-electron.cjs", import.meta.url))],
    env: { ...process.env, WORKSPACE_RENAME_EDITOR_PROFILE: profile }, timeout: 10000 });
  const child = app.process();
  const quitEvents = [];
  let debuggerWait = false;
  child.stdout?.on("data", chunk => {
    for (const match of String(chunk).matchAll(/\[readiness-quit:(before-quit|will-quit|quit|window-all-closed|node-exit)\]/g)) quitEvents.push(match[1]);
  });
  child.stderr?.on("data", chunk => { debuggerWait ||= String(chunk).includes("Waiting for the debugger to disconnect"); });
  let primary;
  try {
    await app.evaluate(({ app }) => {
      for (const event of ["before-quit", "will-quit", "quit", "window-all-closed"]) app.on(event, () => process.stdout.write(`[readiness-quit:${event}]\n`));
      process.on("exit", () => process.stdout.write("[readiness-quit:node-exit]\n"));
    });
    const page = await app.firstWindow();
    await page.waitForURL(await app.evaluate(() => globalThis.renameEditorInitialLoad));
    await run(page, app);
  } catch (error) { primary = error; }
  try { await closeElectron(app); await rm(profile, { recursive: true, force: true }); }
  catch (error) {
    error.message += ` ${JSON.stringify({ quitEvents, debuggerWait, exitCode: child.exitCode,
      signaled: child.signalCode !== null, forcedCleanup: error.forcedCleanup })}`;
    if (primary) console.error("Additional view readiness cleanup failure:", error);
    else primary = error;
  }
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

test("fractional scroll bounds exclude fully clipped skeletons while retaining a subpixel visible row", async () => {
  await withPage(async page => {
    await page.setContent(`<style>body{margin:0}#clip{position:absolute;left:100px;top:100px;width:200px;height:100.5px;overflow:hidden}
      .row{position:absolute;width:200px;height:20px}#outside{top:100.8125px}#edge{top:100.3125px}</style>
      <main class="text-properties" aria-busy="false"><div id="clip">
        <div id="outside" class="row" data-project-id="outside" data-fields-ready="false"><button>Load outside</button></div>
        <div id="edge" class="row" data-project-id="edge" data-fields-ready="true"><button>Edit edge</button></div>
      </div></main>`);
    const ids = ["outside", "edge"];
    assert.equal(await page.evaluate(usableRuntimeViewProjection, ids), true,
      "Integer clientHeight must not extend a fractional clip to include an invisible skeleton");
    await page.evaluate(() => document.querySelector("#edge").setAttribute("data-fields-ready", "false"));
    assert.equal(await page.evaluate(usableRuntimeViewProjection, ids), false,
      "Even a subpixel visible portion still requires loaded fields");
    for (const axis of ["vertical", "horizontal"]) for (const extent of [100.4, 100.5]) {
      await page.evaluate(({ axis, extent }) => {
        const clip = document.querySelector("#clip"), edge = document.querySelector("#edge"), outside = document.querySelector("#outside");
        clip.style.border = "1.5px solid transparent";
        clip.style.width = `${axis === "horizontal" ? extent : 200}px`;
        clip.style.height = `${axis === "vertical" ? extent : 200}px`;
        for (const row of [edge, outside]) {
          row.style.left = axis === "horizontal" ? `${row === edge ? 100.3125 : 100.8125}px` : "0px";
          row.style.top = axis === "vertical" ? `${row === edge ? 100.3125 : 100.8125}px` : "0px";
        }
        edge.setAttribute("data-fields-ready", "true");
      }, { axis, extent });
      assert.equal(await page.evaluate(usableRuntimeViewProjection, ids), true, `${axis} ${extent}: fully hidden skeleton is excluded`);
      await page.evaluate(() => document.querySelector("#edge").setAttribute("data-fields-ready", "false"));
      assert.equal(await page.evaluate(usableRuntimeViewProjection, ids), false, `${axis} ${extent}: a visible fraction requires fields`);
    }
  });
});

test("runtime activation supports current tabs and the immutable baseline select with one action each", async () => {
  await withPage(async page => {
    page.setDefaultTimeout(500);
    await page.route("https://view-fixture.invalid/ready.svg", async route => {
      await new Promise(done => setTimeout(done, 650));
      await route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>' });
    });
    await page.setContent('<img alt="" src="https://view-fixture.invalid/ready.svg"><label>Current view <select><option value="table">Table</option><option value="board">Board</option></select></label>', { timeout: 30000 });
    await page.evaluate(() => {
      globalThis.activations = [];
      document.querySelector("select").addEventListener("change", event => globalThis.activations.push(event.target.value));
    });
    await activateRuntimeView(page, { viewId: "board", name: "Board" });
    assert.deepEqual(await page.evaluate(() => globalThis.activations), ["board"]);
    await page.setContent('<div role="tablist" aria-label="Current view"><button role="tab" aria-selected="true">Table</button><button role="tab" aria-selected="false">Board</button></div>', { timeout: 30000 });
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
        // Arm completion from the first actual readiness observation. A late
        // host cannot skip the pending phase this control is meant to exercise.
        const getAttribute = content.getAttribute.bind(content);
        let armed = false;
        content.getAttribute = name => {
          const value = getAttribute(name);
          if (name === "aria-busy" && value === "true" && !armed) {
            armed = true;
            setTimeout(() => {
              content.setAttribute("aria-busy", "false");
              globalThis.requestAnimationFrame(() => { const until = performance.now() + 80; while (performance.now() < until) { /* controlled renderer work */ } });
            }, 120);
          }
          return value;
        };
      });
    });
    await page.getByRole("button", { name: "Apply", exact: true }).press("Enter");
    await new Promise(done => setTimeout(done, 250)); // Reproduce late host delivery before readiness observation.
    const readyTiming = await waitForRuntimeProjection(page, ["one"], true);
    assert.ok(readyTiming.inspections.length > 0 && readyTiming.inspections.length <= 64);
    assert.ok(readyTiming.inspections.some(item => !item.projectionReady && item.pendingCount > 0));
    assert.ok(readyTiming.inspections.at(-1).projectionReady && readyTiming.inspections.at(-1).endpointReady);
    const before = await readRuntimeInteraction(page, readyTiming);
    assert.ok(before.initialReadinessMs >= 200, "The observed pending phase and renderer work must precede the first paint");
    await new Promise(done => setTimeout(done, 250)); // Deliberate driver delay after completed renderer work.
    const after = await readRuntimeInteraction(page, readyTiming);
    assert.equal(after.ms, before.ms, "Later driver scheduling must not move the committed-paint endpoint");
    assert.ok(after.ms >= 200, "Pending content and renderer work before the completion frames stay measured");
    assert.ok(after.observedMs - before.observedMs >= 240, "The injected driver delay is independently observable");
    assert.ok(after.driverObservationDelayMs >= 240);
    await assert.rejects(readRuntimeInteraction(page, { ...readyTiming, paintedAt: Number.NaN }), /fresh measured event/);
    await assert.rejects(readRuntimeInteraction(page, { ...readyTiming, observationStartedAt: Number.NaN }), /fresh measured event/);
    await assert.rejects(readRuntimeInteraction(page, { ...readyTiming, firstPaintedAt: Number.NaN }), /fresh measured event/);
    await assert.rejects(readRuntimeInteraction(page), /fresh measured event/);
    const startedAt = await page.evaluate(() => globalThis.__workspacePerformanceStarted);
    await assert.rejects(readRuntimeInteraction(page, { ...readyTiming, paintedAt: startedAt - 1 }), /fresh measured event/);
    await assert.rejects(readRuntimeInteraction(page, { ...readyTiming, paintedAt: startedAt + 1_000_000 }), /fresh measured event/);
    await page.evaluate(() => { globalThis.__workspacePerformanceStarted = undefined; });
    await assert.rejects(readRuntimeInteraction(page, readyTiming), /fresh measured event/);
    await page.evaluate(() => { globalThis.__workspacePerformanceStarted = Number.NaN; });
    await assert.rejects(readRuntimeInteraction(page, readyTiming), /fresh measured event/);
  });
});


test("projection readiness rechecks fields invalidated during the first frame pair", async () => {
  await withPage(async page => {
    await page.setContent('<section class="text-properties" aria-busy="false"><div data-project-id="one" data-fields-ready="true"><button>Edit value</button></div></section>');
    await page.evaluate(() => {
      const row = document.querySelector("[data-project-id]");
      const bounds = row.getBoundingClientRect.bind(row);
      let first = true, invalidated = false;
      row.getBoundingClientRect = () => {
        if (first) {
          first = false;
          globalThis.requestAnimationFrame(() => { row.setAttribute("data-fields-ready", "false"); invalidated = true; });
        } else if (invalidated) {
          row.setAttribute("data-fields-ready", "true"); globalThis.recoveredAt = performance.now(); invalidated = false;
        }
        return bounds();
      };
    });
    const { paintedAt } = await waitForRuntimeProjection(page, ["one"]);
    const recoveredAt = await page.evaluate(() => globalThis.recoveredAt);
    assert.ok(Number.isFinite(recoveredAt) && paintedAt >= recoveredAt, "Final paint must wait for fields revealed as unready after initial layout");
  });
});


test("readiness stabilization completes in the renderer before delayed driver result delivery", async () => {
  await withPage(async page => {
    await page.setContent('<section class="text-properties" aria-busy="false"><div data-project-id="one" data-fields-ready="true"><button>Edit value</button></div></section>');
    let gapStartedAt;
    const delayedPage = {
      evaluate: page.evaluate.bind(page),
      waitForFunction: async (...args) => {
        const result = await page.waitForFunction(...args);
        gapStartedAt ??= await page.evaluate(() => performance.now());
        await new Promise(done => setTimeout(done, 250));
        return result;
      },
    };
    const { paintedAt } = await waitForRuntimeProjection(delayedPage, ["one"]);
    assert.ok(paintedAt <= gapStartedAt, "A host pause delivering the result must occur after renderer stabilization");
  });
});


test("runtime language selection preserves current settings navigation and the immutable inline select", async () => {
  await withPage(async page => {
    page.setDefaultTimeout(500);
    const select = '<label for="interface-language">Language</label><select id="interface-language"><option value="en">English</option><option value="ru">Russian</option></select>';
    await page.setContent(select, { timeout: 30000 });
    await page.evaluate(() => {
      document.documentElement.lang = "en"; globalThis.actions = [];
      document.querySelector("select").addEventListener("change", event => { document.documentElement.lang = event.target.value; globalThis.actions.push(event.target.value); });
    });
    await setRuntimeViewLanguage(page, "ru");
    assert.deepEqual(await page.evaluate(() => globalThis.actions), ["ru"]);
    await page.setContent(`<button id="settings">Settings</button><div id="panel" hidden><button role="tab">General</button>${select}<button id="back">Back to workspace</button></div>`, { timeout: 30000 });
    await page.evaluate(() => {
      document.documentElement.lang = "en"; globalThis.actions = [];
      const panel = document.querySelector("#panel"), settings = document.querySelector("#settings");
      settings.addEventListener("click", () => { settings.hidden = true; panel.hidden = false; globalThis.actions.push("settings"); });
      document.querySelector('[role="tab"]').addEventListener("click", () => globalThis.actions.push("general"));
      document.querySelector("select").addEventListener("change", event => { document.documentElement.lang = event.target.value; globalThis.actions.push(event.target.value); });
      document.querySelector("#back").addEventListener("click", () => { panel.hidden = true; settings.hidden = false; globalThis.actions.push("back"); });
    });
    await setRuntimeViewLanguage(page, "ru");
    assert.deepEqual(await page.evaluate(() => globalThis.actions), ["settings", "general", "ru", "back"]);
  });
});

test('optional performance command probe observes one original request and preserves replies and failures', async () => {
  const { installPerformanceCommandProbe } = await import('../scripts/runtime-performance-probe.mjs');
  const handlers = new Map(), requests = [];
  const failure = new Error('Private command failure');
  const original = async (event, input) => { requests.push({event,input}); if(input.fail) throw failure; return input.reply; };
  handlers.set('workspace:command',original);
  const ipcMain = {_invokeHandlers:handlers,removeHandler:name=>handlers.delete(name),handle:(name,handler)=>handlers.set(name,handler)};
  try {
    installPerformanceCommandProbe({ipcMain});
    const invoke=handlers.get('workspace:command'),reply={ok:true,value:{private:'Not diagnostic output'}};
    assert.equal(await invoke('event',{type:'workspace.setViewGrouping',reply}),reply);
    await assert.rejects(invoke('event',{type:'workspace.queryView',fail:true}),error=>error===failure);
    assert.equal(requests.length,2);
    const observations=globalThis.__workspacePerformanceCommands;
    assert.deepEqual(observations.map(item=>item.type),['workspace.setViewGrouping','workspace.queryView']);
    assert.equal(JSON.stringify(observations).includes('Private'),false);
    assert.equal(JSON.stringify(observations).includes('Not diagnostic output'),false);
    for(const observation of observations) assert.ok(Number.isFinite(observation.started)&&Number.isFinite(observation.finished)&&observation.durationMs>=0);
  } finally {delete globalThis.__workspacePerformanceCommands;}
});

test('optional command diagnostics retain a bounded history and fail closed for an unavailable Electron handler', async () => {
  const { installPerformanceCommandProbe } = await import('../scripts/runtime-performance-probe.mjs');
  const handlers=new Map([['workspace:command',async()=>({ok:true})]]);
  const ipcMain={_invokeHandlers:handlers,removeHandler:name=>handlers.delete(name),handle:(name,handler)=>handlers.set(name,handler)};
  try {
    installPerformanceCommandProbe({ipcMain});
    for(let i=0;i<260;i++) await handlers.get('workspace:command')(null,{type:'workspace.queryView'});
    assert.equal(globalThis.__workspacePerformanceCommands.length,256);
    await handlers.get('workspace:command')(null,{type:'workspace.listProjects'});
    assert.equal(globalThis.__workspacePerformanceCommands.length,256);
    assert.throws(()=>installPerformanceCommandProbe({ipcMain:{_invokeHandlers:new Map()}}),/handler unavailable/);
  } finally {delete globalThis.__workspacePerformanceCommands;}
});

test('filter reset waits for enabled Save before its single keyboard action and full projection', async () => {
  const { pressRuntimeFilterSave } = await import('../scripts/runtime-view-controls.mjs');
  await withPage(async page => {
    await page.setContent('<button disabled>Save search and filters</button><div data-count="100"></div>');
    await page.evaluate(() => {
      globalThis.filterResetCalls=0;
      const button=document.querySelector('button');
      button.onclick=()=>{globalThis.filterResetCalls++;document.querySelector('div').dataset.count='1000';};
      setTimeout(()=>{button.disabled=false;},500);
    });
    await pressRuntimeFilterSave(page);
    assert.deepEqual(await page.evaluate(()=>({calls:globalThis.filterResetCalls,count:document.querySelector('div').dataset.count,enabled:!document.querySelector('button').disabled})),{calls:1,count:'1000',enabled:true});
  });
});

test('failed projection inspection is readonly and retains only bounded counts and control states', async () => {
  const {inspectRuntimeProjectionFailure}=await import('../scripts/runtime-view-readiness.mjs');
  await withPage(async page=>{
    await page.setContent('<main class="text-properties"><form class="view-filters" aria-busy="true"><input type="search" value="Private authored search"><button type="submit" disabled>Save</button></form><section class="project-group"><div data-project-id="private-one" data-fields-ready="true"></div><div data-project-id="private-two" data-fields-ready="false"></div></section></main>');
    const before=await page.content();
    const result=await page.evaluate(inspectRuntimeProjectionFailure,['private-one','different']);
    assert.deepEqual(result,{expectedCount:2,rowCount:2,firstMismatch:1,unloadedCount:1,pendingCount:1,groupCount:1,saveDisabled:true,searchEmpty:false});
    assert.equal(await page.content(),before);
    assert.equal(/private|authored|different/i.test(JSON.stringify(result)),false);
  });
});


test('performance request observations distinguish assignment, filtering, editing and scan latency without authored data', async () => {
  const { installPerformanceCommandProbe } = await import('../scripts/runtime-performance-probe.mjs');
  const handlers=new Map(), requests=[];
  handlers.set('workspace:command',async(_event,input)=>{requests.push(input);return {ok:true};});
  const ipcMain={_invokeHandlers:handlers,removeHandler:name=>handlers.delete(name),handle:(name,handler)=>handlers.set(name,handler)};
  try {
    installPerformanceCommandProbe({ipcMain});
    const types=['workspace.assignProjectGroup','workspace.setViewFilter','workspace.setTextValue','workspace.refreshSource','workspace.listTextProperties'];
    for(const type of types) await handlers.get('workspace:command')(null,{type,value:'Private authored value',projectId:'Private project'});
    assert.equal(requests.length,types.length);
    assert.deepEqual(globalThis.__workspacePerformanceCommands.map(item=>item.type),types);
    assert.equal(JSON.stringify(globalThis.__workspacePerformanceCommands).includes('Private'),false);
  } finally {delete globalThis.__workspacePerformanceCommands;}
});


test('projection endpoint observation precedes slow locator delivery but requires committed result text and membership',async()=>{
  await withPage(async page=>{
    await page.setContent('<button id="save">Apply</button><section class="text-properties" aria-busy="false"><div data-project-id="one" data-fields-ready="true"><button>Edit value</button></div></section>');
    await page.evaluate(()=>{
      document.querySelector('#save').addEventListener('keydown',()=>{globalThis.__workspacePerformanceStarted=performance.now();},{once:true});
      document.querySelector('#save').addEventListener('click',()=>{
        setTimeout(()=>{
          const group=document.createElement('section');group.className='project-group';group.setAttribute('aria-label','Destination');
          group.append(document.querySelector('[data-project-id="one"]'));document.querySelector('.text-properties').append(group);
          const status=document.createElement('h2');status.className='bb-status__title';status.textContent='Saved';document.querySelector('.text-properties').append(status);
          globalThis.endpointCommittedAt=performance.now();
        },150);
      });
    });
    await page.locator('#save').press('Enter');
    const waiting=waitForRuntimeProjection(page,['one'],false,[{selector:'.text-properties .bb-status__title',text:'Saved'},{selector:'.project-group[aria-label="Destination"] [data-project-id="one"]'}]);
    await page.getByRole('heading',{name:'Saved',exact:true}).waitFor();
    await new Promise(done=>setTimeout(done,300)); // Controlled late driver delivery.
    const timing=await waiting,committed=await page.evaluate(()=>globalThis.endpointCommittedAt);
    assert.ok(timing.firstPaintedAt>=committed,'Actual committed result must precede the paint endpoint');
    const measured=await readRuntimeInteraction(page,timing);
    assert.ok(measured.driverObservationDelayMs>=200,'Late host polling cannot move an already captured endpoint');
  });
});


test('explicit scheduling diagnostics record original native throttling and leave default observation unchanged',async()=>{
  await withPage(async(_page,app)=>{
    const {inspectPerformanceWindow}=await import('../scripts/runtime-performance-probe.mjs');
    const original=await app.evaluate(inspectPerformanceWindow);
    assert.equal(original.originalBackgroundThrottling,true);assert.equal(original.backgroundThrottling,true);
    const changed=await app.evaluate(inspectPerformanceWindow,true);
    assert.equal(changed.originalBackgroundThrottling,true);assert.equal(changed.backgroundThrottling,false);
    const after=await app.evaluate(inspectPerformanceWindow);
    assert.equal(after.originalBackgroundThrottling,false);assert.equal(after.backgroundThrottling,false);
  });
});


test('scheduling diagnostics reject ordinary and strict routes before creating evidence or fixtures',async()=>{
  const {spawnSync}=await import('node:child_process');const {access}=await import('node:fs/promises');
  const directory=await mkdtemp(join(tmpdir(),'scheduling-guard-')),evidence=join(directory,'uncreated');
  try{
    for(const [flags,message] of [
      [['--profile-unthrottled'],'Scheduling diagnostics require a separate renderer profile'],
      [['--profile-unthrottled','--profile-filters','--enforce'],'Profiled runs are diagnostic, never target acceptance'],
    ]){
      const result=spawnSync(process.execPath,[fileURLToPath(new URL('../scripts/smoke-performance.mjs',import.meta.url)),...flags],
        {encoding:'utf8',env:{...process.env,WORKSPACE_SMOKE_EVIDENCE_DIR:evidence}});
      assert.equal(result.status,1);assert.ok(result.stderr.includes(message));
      await assert.rejects(access(evidence),{code:'ENOENT'});
    }
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('grouping preparation observes a presented stable popover before choosing a value', async () => {
  await withPage(async page => {
    const {openGroupingControls} = await import('../scripts/runtime-presentation-controls.mjs');
    await page.setContent('<button aria-expanded="false">Grouping</button><section role="region" aria-label="Grouping" hidden style="width:260px;height:100px;background:green"><select aria-label="Group by"><option value="">None</option><option value="field">Field</option></select></section>');
    await page.evaluate(() => {
      globalThis.activations = 0; globalThis.changes = 0; globalThis.presented = false;
      const trigger = document.querySelector('button'), panel = document.querySelector('section');
      trigger.onclick = () => {
        globalThis.activations++; trigger.setAttribute('aria-expanded','true'); panel.hidden = false;
        panel.animate([{transform:'translateX(80px)'},{transform:'translateX(0)'}],{duration:250,fill:'forwards'}).finished.then(() => {globalThis.presented = true;});
      };
      document.querySelector('select').onchange = () => {globalThis.changes++;};
    });
    const panel = await openGroupingControls(page);
    assert.equal(await page.evaluate(() => globalThis.presented),true,'DOM presence alone must not release an unpresented moving popover');
    assert.equal(await page.evaluate(() => globalThis.activations),1);
    assert.equal(await page.evaluate(() => globalThis.changes),0,'Preparation never chooses or warms grouping values');
    assert.equal(await panel.getByLabel('Group by',{exact:true}).inputValue(),'');
    await panel.getByLabel('Group by',{exact:true}).selectOption('field');
    assert.equal(await page.evaluate(() => globalThis.changes),1);
  });
});

test('filter and editor preparation observes presented operands without submitting a mutation', async t => {
  const { enterContextFor } = await import('../scripts/runtime-context-tools.mjs');
  await withPage(async page => {
    for (const [name, context, surfaceClass] of [
      ['filter tools', true, 'context-tools-panel'],
      ['inline editor', false, 'text-value-editor'],
      ['inline control', false, ''],
    ]) await t.test(name, async () => {
      await page.setContent(`<button id="entry" ${context ? 'class="context-tools-trigger" aria-expanded="false"' : ''}>Open</button>
        <section id="surface" class="${surfaceClass}" ${context ? 'data-context-return="entry"' : ''}
          hidden style="width:260px;height:120px;background:green"><label>Draft<input value="Unchanged"></label><button id="save">Save</button></section>`);
      await page.evaluate(() => {
        globalThis.preparation = { opens: 0, saves: 0, presented: false };
        const entry = document.querySelector('#entry'), surface = document.querySelector('#surface');
        entry.onclick = () => {
          globalThis.preparation.opens++; entry.setAttribute('aria-expanded', 'true'); surface.hidden = false;
          // A scoped editor locator must observe its changing owner, even when
          // the Save button itself has already stopped moving.
          const frames = surface.classList.contains('text-value-editor') ? [{width:'260px'},{width:'520px'}] : [{transform:'translateX(80px)'},{transform:'translateX(0)'}];
          surface.animate(frames, {duration:500,fill:'forwards'}).finished.then(() => { globalThis.preparation.presented = true; });
        };
        document.querySelector('#save').onclick = () => { globalThis.preparation.saves++; };
      });
      if (!context) await page.getByRole('button', {name:'Open',exact:true}).press('Enter');
      const control = context ? page.getByRole('button', {name:'Save',exact:true,includeHidden:true}) : page.locator('#surface').getByRole('button', {name:'Save',exact:true,includeHidden:true});
      const save = await enterContextFor(page, control, { waitForPresentation: true });
      assert.deepEqual(await page.evaluate(() => globalThis.preparation), {opens:1,saves:0,presented:true});
      assert.equal(await page.getByRole('textbox', {name:'Draft',exact:true}).inputValue(), 'Unchanged');
      await save.press('Enter');
      assert.equal(await page.evaluate(() => globalThis.preparation.saves), 1);
    });
  });
});
