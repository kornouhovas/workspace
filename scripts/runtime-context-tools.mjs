// Follow the real UI entry point; never invoke service commands to reveal UI.
export async function enterContextFor(page, control, { waitForPresentation = false } = {}) {
  await control.waitFor({state:'attached'});
  const owners=await control.evaluate(element=>{
    const owners=[];
    for(let panel=element.parentElement;panel;panel=panel.parentElement) {
      if(panel.hasAttribute('data-context-return')) owners.push(panel.getAttribute('data-context-return'));
    }
    return owners;
  });
  // Dismiss another tools surface before navigating to an obscured row/field.
  // Work inside out so each real trigger remains visible and actionable.
  for(const trigger of (await page.locator('.context-tools-trigger[aria-expanded="true"]').all()).reverse()) {
    if(!owners.includes(await trigger.getAttribute('id'))) { await trigger.focus(); await trigger.press('Enter'); }
  }
  const entries=await control.evaluate(element=>{
    const entries=[];
    for(let panel=element.parentElement;panel;panel=panel.parentElement) {
      if(panel.hidden && panel.hasAttribute('data-context-return')) entries.unshift(panel.getAttribute('data-context-return'));
    }
    return entries;
  });
  for(const entry of entries) await page.locator(`[id=${JSON.stringify(entry)}]`).click();
  const details=await control.evaluate(element=>{
    const summaries=[];
    for(let parent=element.parentElement;parent;parent=parent.parentElement) {
      if(parent.tagName==='DETAILS' && !parent.open) summaries.unshift(parent.querySelector('summary')?.textContent);
    }
    return summaries.filter(Boolean);
  });
  for(const name of details) await page.getByText(name,{exact:true}).click();
  await control.waitFor({state:'visible'});
  if (waitForPresentation) {
    // Actionability can precede composited pixels. The caller can explicitly
    // prepare presented operands without submitting or warming a mutation.
    // Resolve from the actual node: a row-scoped locator cannot be re-rooted
    // inside its own editor with Locator.filter({ has: control }).
    const owner = await control.evaluateHandle(element => element.closest('.context-tools-panel, .text-value-editor') ?? element);
    try { await owner.asElement().screenshot({ animations: 'allow' }); }
    finally { await owner.dispose(); }
  }
  return control;
}
