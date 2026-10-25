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
// Up to four independently reviewed drafts share the same15s budget.
// No unknown/accepted command is replayed, and the whole flow keeps15s.
export async function renameRoleProject(dialog,name,en,verifyUnchanged,{timeout=15000}={}) {
 const deadline=Date.now()+timeout,remaining=()=>{const left=deadline-Date.now();assert.ok(left>0,'Role rename exceeded its deadline');return left;};
 const review=dialog.getByRole('button',{name:en?'Review current project name':'Проверить текущее имя проекта',exact:true});
 const submit=dialog.getByRole('button',{name:en?'Rename folder':'Переименовать папку',exact:true});
 const input=dialog.getByRole('textbox');
 for(let draft=0;draft<4;draft++){
  await Promise.race([input.and(dialog.locator(':enabled')).waitFor({timeout:remaining()}),review.and(dialog.locator(':enabled')).waitFor({timeout:remaining()})]);
  if(draft>0 || await review.isVisible()){
   await review.and(dialog.locator(':enabled')).waitFor({timeout:remaining()});
   await withDeadline(verifyUnchanged(),remaining(),'Role rename operand verification');
   await review.press('Enter',{timeout:remaining()});
   try{await review.waitFor({state:'hidden',timeout:Math.min(1000,remaining())});}catch(error){if(await review.isVisible()&&await review.isEnabled())continue;throw error;}
  }
  try{
   await input.fill(name,{timeout:Math.min(1000,remaining())});
   await submit.and(dialog.locator(':enabled')).press('Enter',{timeout:Math.min(1000,remaining())});
  }catch(error){
   // An observation can invalidate an enabled operand before the next gesture.
   // Continue only through the explicit no-pending/no-unresolved review guard.
   if(await review.isVisible()&&await review.isEnabled())continue;
   throw error;
  }
  await Promise.race([dialog.waitFor({state:'hidden',timeout:remaining()}),review.and(dialog.locator(':enabled')).waitFor({timeout:remaining()})]);
  if(!await dialog.isVisible())return;
  // Every new draft requires this explicit safe state and fresh no-effect proof.
  // No elapsed-time retry, uncertain-result retry or prior operation-ID replay.
  await review.and(dialog.locator(':enabled')).waitFor({timeout:remaining()});
 }
 throw new Error('Role rename remained invalidated after four reviewed drafts');
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
  assert.equal(await dialog.getByRole('button',{name:/^(Check category move status|Проверить статус перемещения в категорию)$/}).count(),0);
  await withDeadline(verifyUnchanged(),left(),'Role move operand verification');
  assert.equal(attempt,0,'A second invalidated draft requires another explicit review');
  await dialog.getByRole('button',{name:en?'Cancel':'Отмена',exact:true}).press('Enter',{timeout:left()});
  dialog=await withDeadline(reopen(),left(),'Role move reopening');
 }
 throw new Error('Role move preparation did not complete');
}


export async function expandRoleFolder(page,path) {
 const escaped=path.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const expand=page.getByRole('button',{name:new RegExp(`^(Expand|Раскрыть): ${escaped}$`)});
 const collapse=page.getByRole('button',{name:new RegExp(`^(Collapse|Свернуть): ${escaped}$`)});
 const deadline=Date.now()+15000;
 while(!await collapse.isVisible()){
  const ms=deadline-Date.now();assert.ok(ms>0,'Role folder expansion exceeded15000ms');
  await expand.and(page.locator(':enabled')).press('Enter',{timeout:ms});
  try{await collapse.waitFor({timeout:Math.min(1000,Math.max(1,deadline-Date.now()))});}catch(error){if(Date.now()>=deadline)throw error;}
 }
}

export async function completeRoleMove({dialog,en,prepare,reopen,verifyUnchanged}) {
 const deadline=Date.now()+15000,left=()=>{const ms=deadline-Date.now();assert.ok(ms>0,'Role move exceeded15000ms');return ms;};
 for(let draft=0;draft<4;draft++){
  dialog=await withDeadline(prepare(dialog),left(),'Role move draft preparation');
  await dialog.getByRole('button',{name:en?'Move project folder':'Переместить папку проекта',exact:true}).and(dialog.locator(':enabled')).press('Enter',{timeout:left()});
  const stale=dialog.getByText(en?'The source or project changed. Refresh and reopen the editor before submitting again.':'Источник или проект изменился. Обновите данные и откройте редактор снова перед отправкой.',{exact:true});
  const status=dialog.getByRole('button',{name:/^(Check category move status|Проверить статус перемещения в категорию)$/});
  await Promise.race([dialog.waitFor({state:'hidden',timeout:left()}),stale.waitFor({timeout:left()}),status.and(dialog.locator(':enabled')).waitFor({timeout:left()})]);
  if(!await dialog.isVisible())return;
  assert.equal(await status.count(),0,'Unknown moves must use status and cannot be replayed');
  await stale.waitFor({timeout:left()});await withDeadline(verifyUnchanged(),left(),'Role move no-effect proof');
  await dialog.getByRole('button',{name:en?'Cancel':'Отмена',exact:true}).press('Enter',{timeout:left()});
  dialog=await withDeadline(reopen(),left(),'Role move fresh editor');
 }
 throw new Error('Role move remained stale after four reviewed drafts');
}

export async function completeRoleArchive({dialog,en,restore,verifyUnchanged}) {
 const deadline=Date.now()+15000,left=()=>{const ms=deadline-Date.now();assert.ok(ms>0,'Role archive exceeded15000ms');return ms;};
 const review=dialog.getByRole('button',{name:restore?(en?'Review restore':'Проверить восстановление'):(en?'Review archive':'Проверить архивирование'),exact:true});
 const confirm=dialog.getByRole('button',{name:restore?(en?'Restore project':'Восстановить проект'):(en?'Archive project':'Архивировать проект'),exact:true});
 const completed=dialog.getByText(en?'Folder operation completed.':'Операция с папкой завершена.',{exact:true});
 const status=dialog.getByRole('button',{name:/^(Check saved outcome|Проверить сохранённый результат)$/});
 for(let draft=0;draft<4;draft++){
  assert.equal(await status.count(),0,'Unknown archive outcomes cannot be replayed');
  await withDeadline(verifyUnchanged(),left(),'Role archive no-effect proof');
  await review.and(dialog.locator(':enabled')).press('Enter',{timeout:left()});
  try{await confirm.and(dialog.locator(':enabled')).waitFor({timeout:Math.min(1000,left())});}catch(error){if(Date.now()>=deadline)throw error;continue;}
  await dialog.getByText(en?'The project keeps its identity and ordinary properties. The archive mirrors its original relative location. Nothing is overwritten.':'Идентификатор проекта и обычные свойства сохраняются. Архив повторяет исходное относительное размещение. Перезаписи нет.',{exact:true}).waitFor({timeout:left()});
  await confirm.and(dialog.locator(':enabled')).press('Enter',{timeout:left()});
  try{await completed.waitFor({timeout:Math.min(1000,left())});return;}catch(error){if(Date.now()>=deadline)throw error;}
  const idle=dialog.getByRole('button',{name:/^(Cancel archive review|Отменить просмотр архива)$/}).and(dialog.locator(':enabled'));
  const outcome=await Promise.race([
   completed.waitFor({timeout:left()}).then(()=>'completed'),
   status.and(dialog.locator(':enabled')).waitFor({timeout:left()}).then(()=>'status'),
   idle.waitFor({timeout:left()}).then(()=>'idle'),
  ]);
  if(outcome==='completed'||await completed.isVisible())return;
  if(outcome==='status'){
   await status.and(dialog.locator(':enabled')).press('Enter',{timeout:left()});
   await completed.waitFor({timeout:left()});return;
  }
  // Only confirmed idle UI reaches another no-effect proof. A late completion
  // remains an observed terminal result instead of waiting for a removed Cancel.
 }
 throw new Error('Role archive review did not complete within four current drafts');
}
