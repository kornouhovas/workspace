/* global document, requestAnimationFrame */
import assert from 'node:assert/strict';
import {withDeadline} from './runtime-lifecycle.mjs';
// One deliberate public editor activation, never a property mutation replay.
export async function openArchiveTextEditor(scope, label, value) {
  const button = scope.getByRole('button', {name:label,exact:true}).and(scope.locator('button:enabled'));
  await button.focus();
  await button.press("Enter");
  const editor = scope.getByRole('textbox', {name:label,exact:true});
  // Exposing a textarea precedes the committed focus handoff. Prepare the current
  // control without activating it again or replaying any property mutation.
  const deadline = performance.now() + 15000;
  let ready = false;
  while (!ready) {
    const remaining = deadline - performance.now();
    assert.ok(remaining > 0, 'Archived editor focus did not become ready within 15000ms');
    ready = await withDeadline(editor.evaluate(async (element, timeout) => {
      const expires = performance.now() + timeout;
      const usable = () => element.isConnected && !element.disabled && element.checkVisibility() && document.activeElement === element;
      while (performance.now() < expires) {
        if (!element.isConnected) return false;
        if (!usable()) { await new Promise(done => requestAnimationFrame(done)); continue; }
        await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
        if (!usable()) continue;
        await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
        if (usable()) return true;
      }
      return false;
    }, remaining, {timeout:remaining}), remaining, 'Archived editor readiness');
  }
  assert.ok(performance.now() <= deadline, 'Archived editor preparation exceeded 15000ms');
  if (value !== undefined) {
    const remaining = deadline - performance.now();
    assert.ok(remaining > 0, 'Archived editor preparation exhausted its typing deadline');
    await editor.fill(value, {timeout:remaining});
    assert.equal(await editor.inputValue({timeout:Math.max(1,deadline-performance.now())}), value, 'Typing must reach the current editor before Save');
    assert.ok(performance.now() <= deadline, 'Archived editor typing exceeded 15000ms');
  }
  return editor;
}

// A pointer gesture can lose activation when current loading disables its target.
// This control uses the real browser and has no application-data mutation.
export async function exerciseArchiveEditorEntry(page) {
  const label='Archive editor readiness control';
  await page.setContent(`<button aria-label="${label}">Edit value</button><div id="editor"></div>`);
  await page.evaluate(label=>{
    globalThis.archiveEditorActivations=0;
    const button=document.querySelector('button');
    button.addEventListener('pointerdown',()=>{button.disabled=true;setTimeout(()=>{button.disabled=false;},100);});
    button.addEventListener('click',()=>{
      globalThis.archiveEditorActivations++;
      const input=document.createElement('textarea');input.setAttribute('aria-label',label);
      document.querySelector('#editor').append(input);input.focus();
    });
  },label);
  const input=await openArchiveTextEditor(page,label,'Edited through the public control');
  await input.waitFor({state:'visible',timeout:1000});
  const result=await page.evaluate(()=>({activations:globalThis.archiveEditorActivations,focused:document.activeElement?.tagName==='TEXTAREA',value:document.querySelector('textarea')?.value}));
  if(result.activations!==1 || !result.focused || result.value!=='Edited through the public control')throw new Error('Archive editor activation/focus control failed');
  await page.reload();
  return {activations:result.activations,focus:true,noDataMutation:true};
}
