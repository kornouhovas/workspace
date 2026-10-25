import {translate} from '../src/renderer/localization.ts';
import {enterWorkspaceRemoval,cancelWorkspaceRename} from '../scripts/workspace-removal-driver.mjs';
/* global document, requestAnimationFrame */
import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron } from "playwright-core";
import { build } from "esbuild";
import { closeElectron } from "../scripts/runtime-lifecycle.mjs";
import { usableRuntimeViewProjection } from "../scripts/runtime-view-readiness.mjs";
import { activateRuntimeView, setRuntimeViewLanguage } from "../scripts/runtime-view-controls.mjs";
import {openRoleSettingsSection,renameRoleProject,reviewRoleConfiguration,expandRoleFolder,enterRoleDialog,prepareRoleMove,completeRoleMove,completeRoleArchive} from "../scripts/folder-role-driver.mjs";
import {openSettingsSection} from "../scripts/runtime-settings.mjs";
import { openArchiveTextEditor } from "../scripts/archive-editor-driver.mjs";
import { installArchiveEntryTrace } from "../scripts/archive-entry-trace.mjs";
import { activateWorkspaceFixture } from "../scripts/workspace-activation-driver.mjs";
import { waitForDragHandleBounds } from "../scripts/runtime-group-drag.mjs";
import { setRuntimeCaptureViewport } from "../scripts/runtime-settings.mjs";
import { readRuntimeInteraction, waitForRuntimeProjection, waitForRuntimeProject } from "../scripts/runtime-performance-timing.mjs";

test('project timing waits for asynchronously mounted fields and tree before committed paint', async () => {
  await withPage(async page => {
    for (const expanded of [false, true]) {
      await page.setContent('<button id="open">Preview</button><main class="saved-view-content"></main>');
      await page.evaluate(expanded => {
        document.querySelector('#open').onclick = () => {
          globalThis.__workspacePerformanceStarted = performance.now();
          const area = document.createElement('section'); area.className = 'project-area';
          area.innerHTML = '<div class="project-detail-fields" aria-busy="false"><div data-project-id="wrong-project"><button class="text-value-button">Committed value</button></div></div><div class="project-files"><button role="treeitem">preserved.txt</button></div>';
          document.body.append(area);
          document.querySelector('.saved-view-content').hidden = expanded;
          setTimeout(() => {
            area.querySelector('[data-project-id]').setAttribute('data-project-id', 'project');
            const tab = document.createElement('button'); tab.setAttribute('data-project-tab', 'project'); tab.setAttribute('aria-selected', 'true');
            document.body.append(tab);
          }, 60);
        };
      }, expanded);
      await page.getByRole('button', { name: 'Preview', exact: true }).press('Enter');
      const timing = await waitForRuntimeProject(page, 'project', expanded, 'Committed value');
      assert.ok(Number.isFinite(timing.paintedAt), 'An async false readiness result must not complete the timing observation');
      const measurement = await readRuntimeInteraction(page, timing);
      assert.ok(measurement.ms >= 60, 'Ready paint must include the current project identity and selected expanded tab');
      assert.equal(await page.locator('.project-files [role="treeitem"]').textContent(), 'preserved.txt');
    }
  });
});

test('preview timing admits current properties and visible loading before the separate tree endpoint', async () => {
  await withPage(async page => {
    await page.setContent('<button id="open">Preview</button><main class="saved-view-content"></main>');
    await page.evaluate(() => {
      document.querySelector('#open').onclick = () => {
        globalThis.__workspacePerformanceStarted = performance.now();
        const area=document.createElement('section');area.className='project-area';
        area.innerHTML='<div class="project-detail-fields" aria-busy="false"><div data-project-id="old"><button class="text-value-button" disabled>Old value</button></div></div><section class="project-files"><p role="status">Loading files…</p></section>';
        document.body.append(area);
        setTimeout(()=>area.querySelector('[data-project-id]').setAttribute('data-project-id','project'),60);
        setTimeout(()=>{const value=area.querySelector('.text-value-button');value.textContent='Committed value';value.disabled=false;},120);
        globalThis.completeProjectFiles=()=>{area.querySelector('.project-files').innerHTML='<button role="treeitem">preserved.txt</button>';};
      };
    });
    await page.getByRole('button',{name:'Preview',exact:true}).press('Enter');
    let timer;
    try {
      const preview=await Promise.race([waitForRuntimeProject(page,'project',false,'Committed value','presented'),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Preview must become usable before file delivery')),1500);})]);
      const measured=await readRuntimeInteraction(page,preview);
      assert.ok(measured.ms>=120,'Preview must contain current identity and values');
      assert.equal(await page.getByRole('status').textContent(),'Loading files…');
      assert.equal(await page.getByRole('button',{name:'Committed value',exact:true}).isEnabled(),true);
      assert.equal(await page.getByRole('treeitem').count(),0);
      await page.evaluate(()=>globalThis.completeProjectFiles());
      const loaded=await waitForRuntimeProject(page,'project',false,'Committed value');
      assert.ok((await readRuntimeInteraction(page,loaded)).ms>=measured.ms);
      assert.equal(await page.getByRole('treeitem').textContent(),'preserved.txt');
    } finally {clearTimeout(timer);}
  });
});

test('role configuration preview acknowledges a discarded read without applying shared changes',async()=>{
 await withPage(async page=>{
  await page.setContent('<button>Review changes</button>');
  await page.evaluate(()=>{globalThis.rolePreviews=0;globalThis.roleApplies=0;document.querySelector('button').onclick=()=>{globalThis.rolePreviews++;if(globalThis.rolePreviews===1)return;const review=document.createElement('div');review.className='folder-role-review';review.innerHTML='<label><input type="checkbox">I reviewed the shared impact</label><button>Apply folder configuration</button>';review.querySelector('button').onclick=()=>{globalThis.roleApplies++;};document.body.append(review);};});
  const review=await reviewRoleConfiguration(page);assert.equal(await review.isVisible(),true);
  assert.deepEqual(await page.evaluate(()=>[globalThis.rolePreviews,globalThis.roleApplies]),[2,0]);
  assert.equal(await review.getByRole('checkbox').isChecked(),false);
 });
});

test('role folder expansion acknowledges a consumed key without changing roles',async()=>{
 await withPage(async page=>{
  await page.setContent('<button aria-label="Expand: Clients/Acme">+</button>');
  await page.evaluate(()=>{const button=document.querySelector('button');let first=true;button.onkeydown=event=>{if(first&&event.key==='Enter'){first=false;event.preventDefault();}};button.onclick=()=>button.setAttribute('aria-label','Collapse: Clients/Acme');});
  await expandRoleFolder(page,'Clients/Acme');assert.equal(await page.getByRole('button').getAttribute('aria-label'),'Collapse: Clients/Acme');
 });
});

test('role settings entry acknowledges keyboard navigation after a pointer interruption',async()=>{
 await withPage(async page=>{
  await page.setContent('<button>Settings</button><div id="tabs"></div>');
  await page.evaluate(()=>{
   const button=document.querySelector('button');button.onpointerdown=()=>{button.disabled=true;setTimeout(()=>{button.disabled=false;},100);};
   button.onclick=()=>{button.hidden=true;const tab=document.createElement('button');tab.setAttribute('role','tab');tab.textContent='Appearance';let firstTab=true;tab.onkeydown=event=>{if(firstTab&&event.key==='Enter'){firstTab=false;event.preventDefault();}};tab.onclick=()=>tab.setAttribute('aria-selected','true');document.querySelector('#tabs').append(tab);};
  });
  page.setDefaultTimeout(300);
  await assert.rejects(openSettingsSection(page,'appearance'),/Timeout/);
  assert.equal(await page.getByRole('tab').count(),0);
  // The first keyboard activation can also be consumed by a transition.
  await page.evaluate(()=>{const button=document.querySelector('button');let first=true;button.addEventListener('keydown',event=>{if(first&&event.key==='Enter'){first=false;event.preventDefault();}});});
  page.setDefaultTimeout(15000);await openRoleSettingsSection(page,'appearance');
  assert.equal(await page.getByRole('tab').getAttribute('aria-selected'),'true');
 });
});

test('workspace creation entry waits for the enabled picker control and activates once',async()=>{
 await withPage(async page=>{
  await page.setContent('<button aria-label="Add workspace" disabled>Add workspace</button><button>Release fixture cleanup</button>');
  await page.evaluate(()=>{globalThis.pickerEntries=0;const button=document.querySelector('[aria-label]');button.onclick=()=>{globalThis.pickerEntries++;};document.querySelectorAll('button')[1].onclick=()=>{button.disabled=false;};});
  const add=page.getByRole('button',{name:'Add workspace',exact:true});await add.press('Enter');assert.equal(await page.evaluate(()=>globalThis.pickerEntries),0);
  const entering=add.and(page.locator(':enabled')).click();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));assert.equal(await page.evaluate(()=>globalThis.pickerEntries),0);
  await page.getByRole('button',{name:'Release fixture cleanup',exact:true}).click();await entering;
  assert.equal(await page.evaluate(()=>globalThis.pickerEntries),1);
 });
});

test('workspace rename cancellation waits for the active reply to enable its input',async()=>{
 await withPage(async page=>{
  await page.setContent('<input aria-label="Workspace name" disabled><button>Release activation reply</button>');
  await page.evaluate(()=>{globalThis.renameCancels=0;const input=document.querySelector('input');input.onkeydown=event=>{if(event.key==='Escape'&&!input.disabled){globalThis.renameCancels++;input.hidden=true;}};document.querySelector('button').onclick=()=>{input.disabled=false;};});
  const input=page.getByRole('textbox');await input.press('Escape');
  assert.equal(await page.evaluate(()=>globalThis.renameCancels),0,'The original premature Escape cannot cancel a busy contextual form');
  let complete=false;const cancelling=cancelWorkspaceRename(page,input).then(()=>{complete=true;});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.equal(complete,false);await page.getByRole('button').click();await cancelling;
  assert.equal(await page.evaluate(()=>globalThis.renameCancels),1);
 });
});

test('workspace removal entry acknowledges tools before the separate configuration command',async()=>{
 await withPage(async page=>{
  await page.setContent('<div class="sidebar-workspace-row"><button data-workspace-id="one">Workspace</button><button aria-label="Workspace actions: Workspace">Tools</button></div>');
  await page.evaluate(()=>{
   globalThis.removalCommands=0;globalThis.removalEntries=0;
   const trigger=document.querySelector('[aria-label]');let first=true;
   trigger.onkeydown=event=>{if(first&&event.key==='Enter'){first=false;event.preventDefault();}};
   trigger.onclick=()=>{globalThis.removalEntries++;const group=document.createElement('div');group.setAttribute('role','group');group.setAttribute('aria-label','Workspace actions: Workspace');group.innerHTML='<button>Remove workspace</button>';document.body.append(group);group.querySelector('button').onclick=()=>{group.remove();const button=document.createElement('button');button.textContent='Remove configuration';button.onclick=()=>{globalThis.removalCommands++;};document.body.append(button);};};
  });
  const confirm=await enterWorkspaceRemoval(page,'one','Workspace');
  assert.equal(await confirm.isVisible(),true);assert.deepEqual(await page.evaluate(()=>[globalThis.removalEntries,globalThis.removalCommands]),[1,0]);
  await confirm.press('Enter');assert.equal(await page.evaluate(()=>globalThis.removalCommands),1);
 });
});

test('role move completion reopens only a verified stale rejection and rejects unknown results',async()=>{
 await withPage(async page=>{
  await page.setContent('<div id="host"></div>');
  await page.evaluate(()=>{
   globalThis.moveAttempts=0;globalThis.moveEffects=0;globalThis.moveUnknown=false;
   globalThis.openCompletionMove=()=>{const dialog=document.createElement('div');dialog.setAttribute('role','dialog');dialog.innerHTML='<button>Move project folder</button><button>Cancel</button>';document.querySelector('#host').append(dialog);dialog.querySelectorAll('button')[1].onclick=()=>dialog.remove();dialog.querySelector('button').onclick=()=>{globalThis.moveAttempts++;if(globalThis.moveAttempts===1){const result=document.createElement(globalThis.moveUnknown?'button':'p');result.textContent=globalThis.moveUnknown?'Check category move status':'The source or project changed. Refresh and reopen the editor before submitting again.';dialog.append(result);}else{globalThis.moveEffects++;dialog.remove();}};};globalThis.openCompletionMove();
  });
  let proofs=0,reopens=0;const options={dialog:page.getByRole('dialog'),en:true,prepare:async dialog=>dialog,reopen:async()=>{reopens++;await page.evaluate(()=>globalThis.openCompletionMove());return page.getByRole('dialog');},verifyUnchanged:async()=>{proofs++;assert.equal(await page.evaluate(()=>globalThis.moveEffects),0);}};
  await completeRoleMove(options);assert.deepEqual([proofs,reopens],[1,1]);assert.deepEqual(await page.evaluate(()=>[globalThis.moveAttempts,globalThis.moveEffects]),[2,1]);
  await page.evaluate(()=>{globalThis.moveAttempts=0;globalThis.moveEffects=0;globalThis.moveUnknown=true;globalThis.openCompletionMove();});proofs=0;reopens=0;
  await assert.rejects(completeRoleMove({...options,dialog:page.getByRole('dialog')}),/Unknown moves/);assert.deepEqual([proofs,reopens],[0,0]);assert.deepEqual(await page.evaluate(()=>[globalThis.moveAttempts,globalThis.moveEffects]),[1,0]);
 });
});

test('role archive completion re-reviews only idle no-effect state and checks unknown outcomes without replay',async()=>{
 await withPage(async page=>{
  async function fixture(unknown,late=false){
   await page.setContent(`<div role="dialog"><button>Review archive</button><button>${translate('en','archiveCancel')}</button></div>`);
   await page.evaluate(({unknown,late})=>{
    globalThis.archiveApplies=0;globalThis.archiveChecks=0;globalThis.archiveEffects=0;
    const dialog=document.querySelector('[role="dialog"]'),review=dialog.querySelector('button');
    const completed=()=>{const message=document.createElement('p');message.textContent='Folder operation completed.';dialog.append(message);};
    review.onclick=()=>{const hint=document.createElement('p');hint.textContent='The project keeps its identity and ordinary properties. The archive mirrors its original relative location. Nothing is overwritten.';dialog.append(hint);const apply=document.createElement('button');apply.textContent='Archive project';dialog.append(apply);apply.onclick=()=>{globalThis.archiveApplies++;apply.remove();hint.remove();if(late){dialog.querySelectorAll('button')[1].remove();setTimeout(()=>{globalThis.archiveEffects++;completed();},1300);}else if(unknown){const check=document.createElement('button');check.textContent='Check saved outcome';check.onclick=()=>{globalThis.archiveChecks++;globalThis.archiveEffects++;completed();};dialog.append(check);}else if(globalThis.archiveApplies>1){globalThis.archiveEffects++;completed();}};};
   },{unknown,late});
  }
  await fixture(false);let proofs=0;
  await completeRoleArchive({dialog:page.getByRole('dialog'),en:true,restore:false,verifyUnchanged:async()=>{proofs++;assert.equal(await page.evaluate(()=>globalThis.archiveEffects),0);}});
  assert.equal(proofs,2);assert.deepEqual(await page.evaluate(()=>[globalThis.archiveApplies,globalThis.archiveChecks,globalThis.archiveEffects]),[2,0,1]);
  await fixture(true);proofs=0;
  await completeRoleArchive({dialog:page.getByRole('dialog'),en:true,restore:false,verifyUnchanged:async()=>{proofs++;assert.equal(await page.evaluate(()=>globalThis.archiveEffects),0);}});
  assert.equal(proofs,1);assert.deepEqual(await page.evaluate(()=>[globalThis.archiveApplies,globalThis.archiveChecks,globalThis.archiveEffects]),[1,1,1]);
  await fixture(false,true);proofs=0;
  await completeRoleArchive({dialog:page.getByRole('dialog'),en:true,restore:false,verifyUnchanged:async()=>{proofs++;assert.equal(await page.evaluate(()=>globalThis.archiveEffects),0);}});
  assert.equal(proofs,1);assert.deepEqual(await page.evaluate(()=>[globalThis.archiveApplies,globalThis.archiveChecks,globalThis.archiveEffects]),[1,0,1]);
 });
});

test('role move preparation reauthors a stale draft before its single explicit submission',async()=>{
 await withPage(async page=>{
  await page.setContent('<div id="host"></div>');
  await page.evaluate(()=>{
   globalThis.moveCommands=0;globalThis.moveForms=0;
   globalThis.openMoveForm=()=>{globalThis.moveForms++;const dialog=document.createElement('div');dialog.setAttribute('role','dialog');dialog.innerHTML='<select aria-label="Parent"><option value="original">Original</option><option value="target">Target</option></select><button>Move project folder</button><button>Cancel</button>';document.querySelector('#host').append(dialog);dialog.querySelectorAll('button')[0].onclick=()=>{globalThis.moveCommands++;dialog.remove();};dialog.querySelectorAll('button')[1].onclick=()=>dialog.remove();};
   globalThis.openMoveForm();
  });
  let captures=0,checks=0;
  const dialog=await prepareRoleMove({dialog:page.getByRole('dialog'),parent:'target',en:true,
   capture:async()=>{if(++captures===1)await page.evaluate(()=>{const dialog=document.querySelector('[role="dialog"]');dialog.querySelector('select').disabled=true;dialog.querySelector('button').disabled=true;const message=document.createElement('p');message.textContent='The source or project changed. Refresh and reopen the editor before submitting again.';dialog.append(message);});},
   reopen:async()=>{await page.evaluate(()=>globalThis.openMoveForm());return page.getByRole('dialog');},
   verifyUnchanged:async()=>{checks++;assert.equal(await page.evaluate(()=>globalThis.moveCommands),0);}});
  assert.equal(checks,1);assert.equal(await dialog.getByRole('combobox').inputValue(),'target');
  assert.deepEqual(await page.evaluate(()=>[globalThis.moveForms,globalThis.moveCommands]),[2,0]);
  await dialog.getByRole('button',{name:'Move project folder',exact:true}).press('Enter');assert.equal(await page.evaluate(()=>globalThis.moveCommands),1);
 });
});

test('role action entry follows a replaced row without submitting a filesystem form',async()=>{
 await withPage(async page=>{
  await page.setContent('<main class="saved-view-content"><div data-project-id="project"><button id="trigger" aria-label="Project actions: Original">Tools</button><div id="tools" role="dialog" aria-label="Project actions: Original" hidden><button aria-label="Archive project: Original">Archive project</button></div></div></main>');
  await page.evaluate(()=>{
   globalThis.roleEntries=0;globalThis.roleDialogs=0;
   const tools=document.querySelector('#tools'),trigger=document.querySelector('#trigger'),button=tools.querySelector('button');
   trigger.onclick=()=>{globalThis.roleEntries++;tools.hidden=false;};
   let replaced=false;
   button.onkeydown=event=>{if(!replaced&&event.key==='Enter'){event.preventDefault();replaced=true;tools.hidden=true;const row=document.querySelector('[data-project-id]');const next=row.cloneNode(true);row.replaceWith(next);next.querySelector('#trigger').onclick=()=>{globalThis.roleEntries++;next.querySelector('#tools').hidden=false;};next.querySelector('#tools button').onclick=()=>{globalThis.roleDialogs++;const modal=document.createElement('div');modal.setAttribute('role','dialog');modal.setAttribute('aria-label','Archive project');modal.textContent='Unsubmitted archive review';document.body.append(modal);};}};
  });
  await enterRoleDialog(page,{projectId:'project',projectName:'Original',label:'Archive project',en:true});
  assert.deepEqual(await page.evaluate(()=>[globalThis.roleEntries,globalThis.roleDialogs]),[2,1]);
  assert.equal(await page.getByRole('dialog',{name:'Archive project',exact:true}).textContent(),'Unsubmitted archive review');
 });
});

test('role rename explicitly re-reviews stale operands and never replays an uncertain submission',async()=>{
 await withPage(async page=>{
  async function fixture(uncertain=false,staleCount=1){
   await page.setContent('<div role="dialog" aria-label="Rename project folder"><form><input aria-label="Name"><button type="button" hidden>Review current project name</button><button type="submit">Rename folder</button></form></div>');
   await page.evaluate(({uncertain,staleCount})=>{
    globalThis.roleAttempts=0;globalThis.roleEffects=0;globalThis.roleReviews=0;
    const input=document.querySelector('input'),review=document.querySelector('[type="button"]'),form=document.querySelector('form');
    review.onclick=()=>{globalThis.roleReviews++;review.hidden=true;input.disabled=false;input.value='Original';};
    form.onsubmit=event=>{event.preventDefault();globalThis.roleAttempts++;if(globalThis.roleAttempts<=staleCount){input.disabled=true;review.hidden=uncertain;}else{if(globalThis.roleReviews!==staleCount)throw new Error('Explicit review is required');globalThis.roleEffects++;document.querySelector('[role="dialog"]').remove();}};
   },{uncertain,staleCount});
  }
  await fixture();const dialog=page.getByRole('dialog');
  await dialog.getByRole('textbox').fill('Renamed');await dialog.getByRole('button',{name:'Rename folder',exact:true}).press('Enter');
  await assert.rejects(dialog.waitFor({state:'hidden',timeout:200}),/Timeout/);
  assert.equal(await page.evaluate(()=>globalThis.roleEffects),0);
  await fixture();let checks=0;
  await renameRoleProject(page.getByRole('dialog'),'Renamed',true,async()=>{checks++;assert.equal(await page.evaluate(()=>globalThis.roleEffects),0);});
  assert.equal(checks,1);assert.deepEqual(await page.evaluate(()=>[globalThis.roleAttempts,globalThis.roleReviews,globalThis.roleEffects]),[2,1,1]);
  await fixture(false,2);checks=0;await renameRoleProject(page.getByRole('dialog'),'Renamed',true,async()=>{checks++;assert.equal(await page.evaluate(()=>globalThis.roleEffects),0);});
  assert.equal(checks,2);assert.deepEqual(await page.evaluate(()=>[globalThis.roleAttempts,globalThis.roleReviews,globalThis.roleEffects]),[3,2,1]);
  await fixture(false,0);checks=0;
  await page.evaluate(()=>{
   const input=document.querySelector('input'),review=document.querySelector('[type="button"]'),submit=document.querySelector('[type="submit"]');let invalidate=true;
   input.onfocus=()=>{if(invalidate){invalidate=false;input.disabled=true;submit.disabled=true;review.hidden=false;}};
   review.onclick=()=>{globalThis.roleReviews++;review.hidden=true;input.disabled=false;submit.disabled=false;input.value='Original';};
   document.querySelector('form').onsubmit=event=>{event.preventDefault();globalThis.roleAttempts++;if(globalThis.roleReviews!==1)throw new Error('Fresh current-name review is required');globalThis.roleEffects++;document.querySelector('[role="dialog"]').remove();};
  });
  await renameRoleProject(page.getByRole('dialog'),'Renamed',true,async()=>{checks++;assert.equal(await page.evaluate(()=>globalThis.roleEffects),0);});
  assert.equal(checks,1);assert.deepEqual(await page.evaluate(()=>[globalThis.roleAttempts,globalThis.roleReviews,globalThis.roleEffects]),[1,1,1]);
  await fixture(true);checks=0;
  await assert.rejects(renameRoleProject(page.getByRole('dialog'),'Renamed',true,async()=>{checks++;},{timeout:500}),/Timeout|deadline/);
  assert.equal(checks,0);assert.deepEqual(await page.evaluate(()=>[globalThis.roleAttempts,globalThis.roleReviews,globalThis.roleEffects]),[1,0,0]);
  await fixture();
  await assert.rejects(renameRoleProject(page.getByRole('dialog'),'Renamed',true,()=>new Promise(()=>{}),{timeout:500}),/verification|deadline/);
  assert.deepEqual(await page.evaluate(()=>[globalThis.roleAttempts,globalThis.roleReviews,globalThis.roleEffects]),[1,0,0]);
 });
});

test('retained archive editor entry survives pointer-time availability interruption', async () => {
  await withPage(async page => {
    const label='Edit Text value: Verified move / Notes';
    await page.setContent(`<button aria-label="${label}">Keep the approved brief.</button><div id="editor"></div>`);
    await page.evaluate(label=>{
      globalThis.editorActivations=0;
      const button=document.querySelector('button');
      button.addEventListener('pointerdown',()=>{button.disabled=true;setTimeout(()=>{button.disabled=false;},100);});
      button.onclick=()=>{globalThis.editorActivations++;const input=document.createElement('textarea');input.setAttribute('aria-label',label);document.querySelector('#editor').append(input);input.focus();};
    },label);
    // The original retained consumer's entry: a completed pointer action does
    // not establish editor activation when availability changes mid-gesture.
    await page.getByRole('button',{name:label,exact:true}).click();
    await assert.rejects(page.getByRole('textbox',{name:label,exact:true}).fill('Archived brief stays editable.',{timeout:200}),/Timeout/);
    assert.equal(await page.evaluate(()=>globalThis.editorActivations),0);
    const input=await openArchiveTextEditor(page,label,'Archived brief stays editable.');
    assert.equal(await input.inputValue(),'Archived brief stays editable.');
    assert.equal(await page.evaluate(()=>globalThis.editorActivations),1);
  });
});

test('archive editor preparation waits for the focused committed control without repeating activation', async () => {
  await withPage(async page => {
    await page.setContent('<button aria-label="Edit archived value">Edit</button><div id="host"></div>');
    await page.evaluate(() => {
      globalThis.editorActivations=0;
      const button=document.querySelector('button');
      button.onkeyup=()=>{button.dataset.keyup='true';};
      button.onclick=()=>{
        globalThis.editorActivations++;
        const input=document.createElement('textarea');input.setAttribute('aria-label','Edit archived value');input.value='Previous';
        document.querySelector('#host').append(input);
        globalThis.releaseEditorFocus=()=>input.focus();
      };
    });
    let prepared=false;
    const preparing=openArchiveTextEditor(page,'Edit archived value');
    void preparing.then(()=>{prepared=true;},()=>{});
    await page.locator('button[data-keyup="true"]').waitFor();
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))));
    assert.equal(prepared,false,'An exposed textbox is not yet the focused committed editor');
    await page.evaluate(()=>globalThis.releaseEditorFocus());
    const input=await preparing;
    await input.fill('New authored value');
    assert.equal(await input.inputValue(),'New authored value');
    assert.equal(await input.evaluate(node=>node===document.activeElement),true);
    assert.equal(await page.evaluate(()=>globalThis.editorActivations),1);
  });
});

test('retained 360px collision captures collapse the real sidebar and restore supported desktop layouts',async()=>{
  await withPage(async page=>{
    await page.setContent('<style>.panel{margin-left:220px}.collapsed .panel{margin-left:0}</style><div class="desktop-shell"><button aria-label="Collapse sidebar" aria-expanded="true"></button><div class="panel">Current owned control</div></div>');
    await page.evaluate(()=>{const button=document.querySelector('button');button.onclick=()=>{const collapsed=button.getAttribute('aria-expanded')==='true';button.setAttribute('aria-expanded',String(!collapsed));button.setAttribute('aria-label',collapsed?'Restore sidebar':'Collapse sidebar');document.querySelector('.desktop-shell').classList.toggle('collapsed',collapsed);};});
    for(const width of [360,1024,420,1440]){
      await setRuntimeCaptureViewport(page,{width,height:800});
      const stress=width===360||width===420;
      assert.equal(await page.getByRole('button',{name:stress?'Restore sidebar':'Collapse sidebar',exact:true}).isVisible(),true);
      assert.equal(await page.locator('.panel').evaluate(node=>node.getBoundingClientRect().left),stress?8:228);
    }
  });
});

test('group drag geometry preparation waits for the presented replacement handle without beginning a gesture', async () => {
  await withPage(async page=>{
    await page.setContent('<button aria-label="Drag source" hidden>Previous projection</button>');
    await page.evaluate(()=>{
      globalThis.dragStarts=0;document.addEventListener('dragstart',()=>globalThis.dragStarts++);
      globalThis.presentHandle=()=>{
        document.querySelector('button').remove();const button=document.createElement('button');button.setAttribute('aria-label','Drag source');button.textContent='Current projection';
        button.style.cssText='position:fixed;left:40px;top:50px;width:26px;height:26px;box-sizing:border-box';document.body.append(button);
      };
    });
    let prepared=false;
    const handle=page.getByRole('button',{name:'Drag source',exact:true,includeHidden:true});
    const preparing=waitForDragHandleBounds(handle).then(value=>{prepared=true;return value;});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.equal(prepared,false,'Missing geometry cannot establish the before-gesture snapshot');
    await page.evaluate(()=>globalThis.presentHandle());
    assert.deepEqual(await preparing,{x:40,y:50,width:26,height:26});
    assert.equal(await page.evaluate(()=>globalThis.dragStarts),0);
    await handle.evaluate(element=>{element.hidden=true;});
    await assert.rejects(waitForDragHandleBounds(handle,30),/Drag handle/);
  });
});

test('workspace activation preparation waits for selected identity and session controls after the backend reply', async () => {
  await withPage(async page=>{
    await page.setContent('<div class="sidebar-workspace-row"><button data-workspace-id="old" aria-current="page">Workspace</button></div><div class="sidebar-workspace-row"><button data-workspace-id="target">Workspace</button></div><button id="deliver">Deliver selection</button><button id="ready">Finish session</button>');
    await page.evaluate(()=>{
      globalThis.activations=[];
      globalThis.workspace={workspace:async input=>{globalThis.activations.push(input);return {ok:true,value:{activeWorkspace:{workspaceId:input.workspaceId}}};}};
      document.querySelector('#deliver').onclick=()=>{document.querySelector('[data-workspace-id="old"]').removeAttribute('aria-current');const current=document.querySelector('[data-workspace-id="target"]');current.setAttribute('aria-current','page');current.disabled=true;};
      document.querySelector('#ready').onclick=()=>{document.querySelector('[data-workspace-id="target"]').disabled=false;};
    });
    let prepared=false;
    const preparing=activateWorkspaceFixture(page,{workspaceId:'target',name:'Workspace'}).then(()=>{prepared=true;});
    await page.waitForFunction(()=>globalThis.activations.length===1);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.equal(prepared,false,'A backend activation reply cannot establish the selected UI identity');
    await page.getByRole('button',{name:'Deliver selection',exact:true}).click();
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.equal(prepared,false,'Selected identity must also finish session preparation');
    await page.getByRole('button',{name:'Finish session',exact:true}).click();await preparing;
    assert.deepEqual(await page.evaluate(()=>globalThis.activations),[{type:'workspace.activate',workspaceId:'target'}]);
  });
});

test('archive entry diagnostic observes DOM changes when installed before the document element', async () => {
  await withPage(async page=>{
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(installArchiveEntryTrace);
    await page.goto('data:text/html,'+encodeURIComponent('<div class="project-area"><textarea>Private draft</textarea></div>'));
    await page.evaluate(()=>{document.querySelector('textarea').disabled=true;});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
    assert.deepEqual(errors,[],'Document-start installation must attach its observer');
    const events=await page.evaluate(()=>globalThis.__workspaceArchiveEntryTrace);
    assert.ok(events.some(event=>event.type==='state' && event.editors.some(editor=>editor.disabled)));
    assert.equal(JSON.stringify(events).includes('Private draft'),false);
  });
});

test('scalar draft recovers keyboard focus after temporary source unavailability without stealing another control', async () => {
  const bundle = await scalarFocusFixture();
  await withPage(async page => {
    await page.setContent('<div id="root"></div>');
    await page.addScriptTag({content:bundle.outputFiles[0].text});
    const editor=await openArchiveTextEditor(page,'Edit Text value: Atlas / Notes','Retained draft');
    await page.evaluate(()=>globalThis.setEditorDisabled(true));
    await page.waitForFunction(()=>document.querySelector('textarea')?.disabled && document.activeElement===document.body);
    await page.evaluate(()=>globalThis.setEditorDisabled(false));
    await page.waitForFunction(()=>!document.querySelector('textarea')?.disabled && document.activeElement===document.querySelector('textarea'),{},{timeout:1500});
    await page.keyboard.type(' continued');
    assert.equal(await editor.inputValue(),'Retained draft continued');
    assert.deepEqual(await page.evaluate(()=>globalThis.savedValues),[]);
    await page.evaluate(()=>globalThis.setEditorDisabled(true));
    await page.getByRole('button',{name:'Independent action',exact:true}).click();
    await page.evaluate(()=>globalThis.setEditorDisabled(false));
    await editor.waitFor({state:'visible'});
    await page.waitForFunction(()=>!document.querySelector('textarea')?.disabled);
    assert.equal(await page.getByRole('button',{name:'Independent action',exact:true}).evaluate(node=>node===document.activeElement),true);
    await page.getByRole('button',{name:'Save value',exact:true}).click();
    await page.waitForFunction(()=>globalThis.savedValues.length===1);
    assert.deepEqual(await page.evaluate(()=>globalThis.savedValues),['Retained draft continued']);
  });
});

test('new scalar editor receives its requested focus after source unavailability interrupts opening', async () => {
  const bundle=await scalarFocusFixture();
  await withPage(async page=>{
    await page.setContent('<div id="root"></div>');await page.addScriptTag({content:bundle.outputFiles[0].text});
    await page.evaluate(()=>{globalThis.disableOnEditorEntry=true;});
    await page.getByRole('button',{name:'Edit Text value: Atlas / Notes',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('textarea')?.disabled && document.activeElement===document.body);
    await page.evaluate(()=>globalThis.setEditorDisabled(false));
    await page.waitForFunction(()=>!document.querySelector('textarea')?.disabled && document.activeElement===document.querySelector('textarea'),{},{timeout:1500});
    await page.keyboard.press('ControlOrMeta+A');await page.keyboard.type('Newly opened value');
    assert.equal(await page.getByRole('textbox',{name:'Edit Text value: Atlas / Notes',exact:true}).inputValue(),'Newly opened value');
    assert.deepEqual(await page.evaluate(()=>globalThis.savedValues),[]);
  });
});

test('source refresh returns focus to the previously focused scalar among retained invalid drafts', async () => {
  const bundle=await scalarFocusFixture();
  await withPage(async page=>{
    await page.setContent('<div id="root"></div>');await page.addScriptTag({content:bundle.outputFiles[0].text});
    await page.getByRole('button',{name:'Edit Number value: Atlas / First',exact:true}).click();
    const first=page.getByRole('textbox',{name:'Edit Number value: Atlas / First',exact:true});
    await first.fill('1/0');await first.press('Enter');
    await page.waitForFunction(()=>document.querySelector('input')?.getAttribute('aria-invalid')==='true');
    await page.getByRole('button',{name:'Edit Number value: Atlas / Second',exact:true}).click();
    const second=page.getByRole('textbox',{name:'Edit Number value: Atlas / Second',exact:true});
    await second.fill('42');
    await page.evaluate(()=>globalThis.setEditorDisabled(true));
    await page.waitForFunction(()=>[...document.querySelectorAll('input')].every(node=>node.disabled)&&document.activeElement===document.body);
    await page.evaluate(()=>globalThis.setEditorDisabled(false));
    await page.waitForFunction(()=>!document.querySelectorAll('input')[1]?.disabled);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.equal(await second.evaluate(node=>node===document.activeElement),true,'Restore the editor that owned focus, not the first retained draft');
    assert.equal(await first.inputValue(),'1/0');assert.equal(await second.inputValue(),'42');
  });
});

async function scalarFocusFixture() {
  return build({bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',
    stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
      import React,{useState} from 'react';
      import {createRoot} from 'react-dom/client';
      import {TextPropertyCell} from './src/renderer/components/TextPropertyCell.tsx';
      globalThis.savedValues=[];
      function Example(){const [disabled,setDisabled]=useState(false);globalThis.setEditorDisabled=setDisabled;
        return <div onClick={event=>{if(globalThis.disableOnEditorEntry && event.target.classList.contains('text-value-button'))setDisabled(true);}}><TextPropertyCell workspaceId="w" sourceId="s" projectId="p" propertyId="f" projectName="Atlas" propertyName="Notes" value="Previous" revision={0} minimumRevision={{current:0}} language="en" disabled={disabled}
          onSave={async value=>{globalThis.savedValues.push(value);return {ok:true,value:{projectId:'p',propertyId:'f',snapshot:{workspaceId:'w',sourceId:'s',revision:1}}};}}/>{['First','Second'].map(name=><TextPropertyCell key={name} workspaceId="w" sourceId="s" projectId="p" propertyId={name} propertyType="number" projectName="Atlas" propertyName={name} value={null} revision={0} minimumRevision={{current:0}} language="en" disabled={disabled}
          onSave={async value=>name==='First'?{ok:false,error:{code:'invalid_input',message:'Invalid number'}}:{ok:true,value:{projectId:'p',propertyId:name,snapshot:{workspaceId:'w',sourceId:'s',revision:1}}}}/>)}<button>Independent action</button></div>;}
      createRoot(document.getElementById('root')).render(<Example/>);
    `}});
}

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
