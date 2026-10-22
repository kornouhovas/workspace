/* global document */
// One deliberate public editor activation, never a property mutation replay.
export async function openArchiveTextEditor(scope, label) {
  const button = scope.getByRole('button', {name:label,exact:true}).and(scope.locator('button:enabled'));
  await button.focus();
  await button.press("Enter");
  return scope.getByRole('textbox', {name:label,exact:true});
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
  const input=await openArchiveTextEditor(page,label);
  await input.waitFor({state:'visible',timeout:1000});
  await input.fill('Edited through the public control');
  const result=await page.evaluate(()=>({activations:globalThis.archiveEditorActivations,focused:document.activeElement?.tagName==='TEXTAREA',value:document.querySelector('textarea')?.value}));
  if(result.activations!==1 || !result.focused || result.value!=='Edited through the public control')throw new Error('Archive editor activation/focus control failed');
  await page.reload();
  return {activations:result.activations,focus:true,noDataMutation:true};
}
