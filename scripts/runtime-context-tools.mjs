// Follow the real UI entry point; never invoke service commands to reveal UI.
export async function enterContextFor(page, control) {
  await control.waitFor({state:'attached'});
  const entry=await control.evaluate(element=>{
    const panel=element.closest('[data-context-return]');
    return panel?.hidden ? panel.getAttribute('data-context-return') : null;
  });
  if(entry) await page.locator(`[id=${JSON.stringify(entry)}]`).click();
  const details=await control.evaluate(element=>{
    const summaries=[];
    for(let parent=element.parentElement;parent;parent=parent.parentElement) {
      if(parent.tagName==='DETAILS' && !parent.open) summaries.unshift(parent.querySelector('summary')?.textContent);
    }
    return summaries.filter(Boolean);
  });
  for(const name of details) await page.getByText(name,{exact:true}).click();
  await control.waitFor({state:'visible'});
  return control;
}
