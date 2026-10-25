import assert from 'node:assert/strict';
import {withDeadline} from './runtime-lifecycle.mjs';
// Scoped role-journey navigation. Keyboard entry acknowledges the
// current settings surface before selecting its tab; no service mutation.
// A disabled transition may consume a key without activation. Only navigation
// can be re-entered until acknowledged, within the original15s.
export async function openRoleSettingsSection(page, section) {
 const labels={general:/^(General|Основные)$/,workspaces:/^(Workspaces|Рабочие пространства)$/,appearance:/^(Appearance|Оформление)$/};
 const tab=page.getByRole('tab',{name:labels[section]});
 const selected=tab.and(page.locator('[aria-selected="true"]'));
 const deadline=Date.now()+15000;
 while(!await selected.isVisible()){
  const remaining=deadline-Date.now();assert.ok(remaining>0,'Role settings entry exceeded15000ms');
  if(await tab.isVisible())await tab.and(page.locator(':enabled')).press('Enter',{timeout:remaining});
  else await page.getByRole('button',{name:/^(Settings|Настройки)$/}).and(page.locator(':enabled')).press('Enter',{timeout:remaining});
  try{await selected.waitFor({timeout:Math.min(1000,Math.max(1,deadline-Date.now()))});}
  catch(error){if(Date.now()>=deadline)throw error;}
 }
}
// A visible enabled current-name review proves the UI has no unresolved command.
// Only that explicit guard plus unchanged physical operands permits a new draft.
// No unknown/accepted command is replayed, and the whole flow keeps15s.
export async function renameRoleProject(dialog,name,en,verifyUnchanged,{timeout=15000}={}) {
 const deadline=Date.now()+timeout,remaining=()=>{const left=deadline-Date.now();assert.ok(left>0,'Role rename exceeded its deadline');return left;};
 const review=dialog.getByRole('button',{name:en?'Review current project name':'Проверить текущее имя проекта',exact:true});
 const submit=dialog.getByRole('button',{name:en?'Rename folder':'Переименовать папку',exact:true});
 const input=dialog.getByRole('textbox');
 async function author(){
  await Promise.race([input.and(dialog.locator(':enabled')).waitFor({timeout:remaining()}),review.and(dialog.locator(':enabled')).waitFor({timeout:remaining()})]);
  if(await review.isVisible()){await withDeadline(verifyUnchanged(),remaining(),'Role rename operand verification');await review.press('Enter',{timeout:remaining()});}
  await input.fill(name,{timeout:remaining()});
  await submit.and(dialog.locator(':enabled')).press('Enter',{timeout:remaining()});
 }
 await author();
 await Promise.race([dialog.waitFor({state:'hidden',timeout:remaining()}),review.and(dialog.locator(':enabled')).waitFor({timeout:remaining()})]);
 if(await dialog.isVisible()){
  // Explicitly rejected/stale before effect; never Cancel/reopen an uncertain result.
  await review.and(dialog.locator(':enabled')).waitFor({timeout:remaining()});
  await withDeadline(verifyUnchanged(),remaining(),'Role rename operand verification');await review.press('Enter',{timeout:remaining()});
  await input.fill(name,{timeout:remaining()});await submit.and(dialog.locator(':enabled')).press('Enter',{timeout:remaining()});
 }
 await dialog.waitFor({state:'hidden',timeout:remaining()});
}


// Re-enter only the row's tools/editor navigation after row replacement.
// Returned forms are still unsubmitted; filesystem mutation belongs to the caller.
export async function enterRoleDialog(page,{projectId,projectName,label,en}) {
 const modal=page.getByRole('dialog',{name:label,exact:true});
 const toolsName=`${en?'Project actions':'Действия с проектом'}: ${projectName}`;
 const tools=page.getByRole('dialog',{name:toolsName,exact:true});
 const deadline=Date.now()+15000;
 while(!await modal.isVisible()){
  const left=()=>{const ms=deadline-Date.now();assert.ok(ms>0,'Role action entry exceeded15000ms');return Math.min(1000,ms);};
  try{
   if(!await tools.isVisible()){
    await page.locator(`.saved-view-content [data-project-id="${projectId}"]`).scrollIntoViewIfNeeded({timeout:left()});
    await page.getByRole('button',{name:toolsName,exact:true}).and(page.locator(':enabled')).press('Enter',{timeout:left()});
    await tools.waitFor({timeout:left()});
   }
   await tools.getByRole('button',{name:`${label}: ${projectName}`,exact:true}).and(page.locator(':enabled')).press('Enter',{timeout:left()});
   await modal.waitFor({timeout:left()});
  }catch(error){if(Date.now()>=deadline)throw error;}
 }
 return modal;
}


export async function returnRoleWorkspace(page) {
 const entry=page.getByRole('button',{name:/^(Settings|Настройки)$/});
 const deadline=Date.now()+15000;
 while(!await entry.isVisible()){
  const left=deadline-Date.now();assert.ok(left>0,'Role workspace return exceeded15000ms');
  await page.getByRole('button',{name:/^(Back to workspace|Вернуться к работе)$/}).and(page.locator(':enabled')).press('Enter',{timeout:left});
  try{await entry.waitFor({timeout:Math.min(1000,Math.max(1,deadline-Date.now()))});}catch(error){if(Date.now()>=deadline)throw error;}
 }
}
export async function setRoleLanguage(page,language) {
 await openRoleSettingsSection(page,'general');
 await page.locator('#interface-language').selectOption(language);
 await page.waitForFunction(language=>globalThis.document.documentElement.lang===language&&!globalThis.document.querySelector('#interface-language')?.disabled,language);
 await returnRoleWorkspace(page);
}

// Prepare a move form only. Source observation may invalidate the draft during
// a capture; reauthor at most once, before the caller's single submission.
export async function prepareRoleMove({dialog,parent,en,capture,reopen,verifyUnchanged}) {
 const deadline=Date.now()+15000,left=()=>{const ms=deadline-Date.now();assert.ok(ms>0,'Role move preparation exceeded15000ms');return ms;};
 const staleText=en?'The source or project changed. Refresh and reopen the editor before submitting again.':'Источник или проект изменился. Обновите данные и откройте редактор снова перед отправкой.';
 for(let attempt=0;attempt<2;attempt++){
  const select=dialog.getByRole('combobox'),submit=dialog.getByRole('button',{name:en?'Move project folder':'Переместить папку проекта',exact:true}),stale=dialog.getByText(staleText,{exact:true});
  await Promise.race([select.and(dialog.locator(':enabled')).waitFor({timeout:left()}),stale.waitFor({timeout:left()})]);
  if(!await stale.isVisible()){await select.selectOption(parent,{timeout:left()});await withDeadline(capture(),left(),'Role move capture');}
  if(await submit.isEnabled())return dialog;
  await stale.waitFor({timeout:left()});
  // This helper has never submitted; stale UI alone does not authorize a replay.
  assert.equal(await dialog.getByRole('button',{name:/^(Check operation status|Проверить статус операции)$/}).count(),0);
  await withDeadline(verifyUnchanged(),left(),'Role move operand verification');
  assert.equal(attempt,0,'A second invalidated draft requires another explicit review');
  await dialog.getByRole('button',{name:en?'Cancel':'Отмена',exact:true}).press('Enter',{timeout:left()});
  dialog=await withDeadline(reopen(),left(),'Role move reopening');
 }
 throw new Error('Role move preparation did not complete');
}
