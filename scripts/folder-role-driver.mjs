import assert from 'node:assert/strict';
import {withDeadline} from './runtime-lifecycle.mjs';
// Scoped role-journey navigation. Keyboard entry acknowledges the
// current settings surface before selecting its tab; no service mutation.
// A disabled transition may consume a key without activation. Only navigation
// can be re-entered until acknowledged, within the original15s.
export async function openRoleSettingsSection(page, section) {
 const labels={workspaces:/^(Workspaces|Рабочие пространства)$/,appearance:/^(Appearance|Оформление)$/};
 const tab=page.getByRole('tab',{name:labels[section]});
 const deadline=Date.now()+15000;
 while(!await tab.isVisible()){
  const remaining=deadline-Date.now();assert.ok(remaining>0,'Role settings entry exceeded15000ms');
  await page.getByRole('button',{name:/^(Settings|Настройки)$/}).and(page.locator(':enabled')).press('Enter',{timeout:remaining});
  try{await tab.waitFor({timeout:Math.min(1000,Math.max(1,deadline-Date.now()))});}
  catch(error){if(Date.now()>=deadline)throw error;}
 }
 await tab.press('Enter',{timeout:Math.max(1,deadline-Date.now())});
 await tab.and(page.locator('[aria-selected="true"]')).waitFor({timeout:Math.max(1,deadline-Date.now())});
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
