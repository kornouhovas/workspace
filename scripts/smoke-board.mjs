/* global window, document, innerWidth */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,mkdir,realpath,writeFile,rename} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {_electron} from 'playwright-core';
import {closeElectron,cleanupOwnedFixture,ownedProcessesStopped} from './runtime-lifecycle.mjs';
import {openSettingsSection,returnToWorkspace,setInterfaceLanguage} from './runtime-settings.mjs';
import {enterContextFor} from './runtime-context-tools.mjs';
import {openGroupingControls,closeGroupingControls,waitForPresentationBounds} from './runtime-presentation-controls.mjs';
const root=resolve(import.meta.dirname,'..');
const evidence=resolve(process.env.WORKSPACE_SMOKE_EVIDENCE_DIR??'work/issue-53-board');
await mkdir(evidence,{recursive:true});
const fixture=await realpath(await mkdtemp(join(tmpdir(),'workspace-board-')));
const source=join(fixture,'source');await mkdir(source);
for(const name of ['Brand refresh','Customer portal','Release checklist']) await mkdir(join(source,name));
const parents=new Set(),backends=new Set(),screens=[],checks=[];
let app,page,failure,launchUnverified=false;
try {
  launchUnverified=true;
  app=await _electron.launch({executablePath:createRequire(import.meta.url)('electron'),args:[root],cwd:root,env:{...process.env,WORKSPACE_USER_DATA_DIR:join(fixture,'data')}});
  parents.add(app.process());page=await app.firstWindow();page.setDefaultTimeout(15000);
  await page.waitForFunction(async()=> (await window.workspace.getBackendStatus()).state==='ready');
  for(const pid of await app.evaluate(({app})=>app.getAppMetrics().filter(m=>m.type==='Utility'&&m.serviceName?.includes('Node')).map(m=>m.pid)))backends.add(pid);
  assert.ok(backends.size>0);launchUnverified=false;
  const query=async input=>{const result=await page.evaluate(input=>window.workspace.workspace(input),input);assert.equal(result.ok,true,JSON.stringify(result));return result.value;};
  const {workspaceId,viewId}=await query({type:'workspace.create',name:'Design studio',rootPath:source});
  const call=(type,fields={})=>query({type:`workspace.${type}`,workspaceId,...fields});
  const projects=(await call('applyDiscovery',{previewToken:(await call('previewDiscovery')).previewToken})).projects;
  await call('updateView',{viewId,name:'Board',kind:'board'});
  const notes=(await call('createProperty',{name:'Notes',propertyType:'text'})).propertyId;
  const stage=(await call('createProperty',{name:'Stage',propertyType:'single_select'})).propertyId;
  const tags=(await call('createProperty',{name:'Tags',propertyType:'multi_select'})).propertyId;
  const number=(await call('createProperty',{name:'Estimate',propertyType:'number'})).propertyId;
  const date=(await call('createProperty',{name:'Due',propertyType:'date'})).propertyId;
  const option=async(propertyId,name,color)=> (await call('createSelectOption',{propertyId,name,color})).snapshot.selectOptions.find(o=>o.propertyId===propertyId&&o.name===name).optionId;
  const todo=await option(stage,'To do','blue'),done=await option(stage,'Done','green');
  await option(stage,'Review','default');
  const design=await option(tags,'Design','blue'),launch=await option(tags,'Launch','green');
  await call('setTextValue',{projectId:projects[0].projectId,propertyId:notes,value:'Review the launch assets'});
  await call('setSelectValue',{projectId:projects[0].projectId,propertyId:stage,optionId:todo});
  await call('setSelectValue',{projectId:projects[1].projectId,propertyId:stage,optionId:done});
  await call('setMultiSelectValue',{projectId:projects[0].projectId,propertyId:tags,optionIds:[design,launch]});
  await call('setNumberValue',{projectId:projects[0].projectId,propertyId:number,expression:'42'});
  await call('setDateValue',{projectId:projects[0].projectId,propertyId:date,value:'2026-10-21'});
  await call('setViewGrouping',{viewId,config:{propertyId:stage,settings:[]}});await page.reload();
  const openLayout=async language=>{
    const label=language==='en'?'Board layout':'Настройки доски';
    const trigger=page.getByRole('button',{name:label,exact:true,includeHidden:true});
    await enterContextFor(page,trigger);await trigger.press('Enter');await waitForPresentationBounds(page,label);
    return page.getByRole('dialog',{name:label,exact:true});
  };
  for(const content of ['ordinary','long']) {
    if(content==='long') await call('setTextValue',{projectId:projects[0].projectId,propertyId:notes,value:'Review launch assets. Проверить материалы. '.repeat(20)+'\nSecond line'});
    for(const language of ['en','ru']) {
      await setInterfaceLanguage(page,language);
      for(const theme of ['light','dark']) {
        await openSettingsSection(page,'appearance');await page.getByRole('radio',{name:theme==='light'?/^(Light|Светлая)$/:/^(Dark|Тёмная)$/}).click();
        await returnToWorkspace(page);
        for(const size of [{width:1024,height:720},{width:1440,height:960}]) {
          await page.setViewportSize(size);await page.locator('.project-card').first().waitFor();await page.evaluate(()=>document.fonts.ready);
          assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
          await page.screenshot({path:join(evidence,`${content}-${language}-${theme}-${size.width}.png`)});
          const propertiesLabel=language==='en'?'Properties':'Свойства';
          const properties=page.getByRole('button',{name:propertiesLabel,exact:true,includeHidden:true});
          await enterContextFor(page,properties);await properties.click();
          const propertyPanel=page.getByRole('dialog',{name:propertiesLabel,exact:true});
          const rename=propertyPanel.getByRole('button',{name:`${language==='en'?'Rename property':'Переименовать свойство'}: Notes`,exact:true});
          await rename.click();
          const draft=propertyPanel.getByRole('textbox',{name:language==='en'?'Property name':'Название свойства',exact:true});
          await draft.fill('Uncommitted name');await draft.press('Escape');
          await page.waitForFunction(label=>document.activeElement?.getAttribute('aria-label')===label,`${language==='en'?'Rename property':'Переименовать свойство'}: Notes`);
          await page.keyboard.press('Escape');
          await openLayout(language);
          await page.screenshot({path:join(evidence,`${content}-${language}-${theme}-${size.width}-layout.png`)});
          await page.keyboard.press('Escape');
          await page.waitForFunction(label=>document.activeElement?.getAttribute('aria-label')===label,language==='en'?'Board layout':'Настройки доски');
          await page.keyboard.press('Escape');
          const header=page.locator('.project-group[aria-label="To do"]');
          const widthLabel=`${language==='en'?'Column width':'Ширина колонки'}: To do`;
          const widthButton=header.getByRole('button',{name:widthLabel,exact:true});
          await enterContextFor(page,widthButton);await widthButton.press('Enter');await waitForPresentationBounds(page,widthLabel);
          await page.screenshot({path:join(evidence,`${content}-${language}-${theme}-${size.width}-column.png`)});
          await page.keyboard.press('Escape');await page.waitForFunction(label=>document.activeElement?.getAttribute('aria-label')===label,widthLabel);
          await openGroupingControls(page,language);
          await page.screenshot({path:join(evidence,`${content}-${language}-${theme}-${size.width}-grouping.png`)});
          await closeGroupingControls(page,language);
          screens.push({content,language,theme,...size});
        }
      }
    }
  }
  await setInterfaceLanguage(page,'en');
  const before=await call('listTextProperties');
  const widthTrigger=page.locator('.project-group[aria-label="To do"]').getByRole('button',{name:'Column width: To do',exact:true});
  await widthTrigger.click();const slider=page.getByRole('slider',{name:'Column width: To do',exact:true});await slider.focus();await slider.press('Home');
  await page.waitForFunction(()=>document.querySelector('.project-group[aria-label="To do"]')?.style.flexBasis==='180px');await page.screenshot({path:join(evidence,'width-minimum.png')});await slider.press('End');
  await page.waitForFunction(()=>document.querySelector('.project-group[aria-label="To do"]')?.style.flexBasis==='800px');await page.keyboard.press('Escape');
  let grouping=await openGroupingControls(page,'en');
  await grouping.getByRole('button',{name:'Move group later: To do',exact:true}).click();
  await grouping.getByRole('button',{name:'Collapse group: To do',exact:true}).click();
  await page.locator('.project-group[aria-label="To do"] .project-card').waitFor({state:'detached'});await page.screenshot({path:join(evidence,'collapsed.png')});
  await grouping.getByRole('button',{name:'Expand group: To do',exact:true}).click();
  await grouping.getByRole('button',{name:'Hide group: To do',exact:true}).click();await page.locator('.project-group[aria-label="To do"]').waitFor({state:'detached'});
  await grouping.getByRole('button',{name:'Show group: To do',exact:true}).click();await page.locator('.project-group[aria-label="To do"]').waitFor();
  assert.deepEqual(await call('listTextProperties'),before);
  await closeGroupingControls(page,'en');
  const layout=await openLayout('en');
  await layout.getByLabel('Show on cards: Notes',{exact:true}).click();
  await page.locator(`.project-card [data-column-id="${notes}"]`).waitFor({state:'detached'});
  await layout.getByLabel('Wrap card content',{exact:true}).click();await page.locator('.board-content-nowrap').first().waitFor();await page.keyboard.press('Escape');await page.keyboard.press('Escape');
  await page.reload();await page.locator('.project-group[aria-label="To do"] .board-content-nowrap').waitFor();
  assert.equal(await page.locator('.project-group[aria-label="To do"]').evaluate(el=>el.style.flexBasis),'800px');
  assert.equal(await page.locator(`.project-card [data-column-id="${notes}"]`).count(),0);
  await call('setViewGrouping',{viewId,config:{propertyId:tags,settings:[]}});
  await page.waitForFunction(()=>document.querySelectorAll('.project-card').length===4);
  assert.equal(await page.locator('.project-group[aria-label="Design"] .project-card').count(),1);
  assert.equal(await page.locator('.project-group[aria-label="Launch"] .project-card').count(),1);
  for(const propertyId of ['name',notes,number,date,null]) {
    await call('setViewGrouping',{viewId,config:{propertyId,settings:[]}});
    if(propertyId) await page.locator('.project-group').first().waitFor();else await page.locator('.grouped-board').waitFor({state:'detached'});
    assert.equal((await call('getViewGrouping',{viewId})).config.propertyId,propertyId);
  }
  checks.push('keyboard width bounds','collapse/hide/restore','order does not mutate values','reload width/visibility/wrap','MultiSelect membership','all scalar grouping and none');
  // Filtered-empty is a real saved Board state, inspected in the full matrix.
  await call('setViewFilter',{viewId,config:{search:'No synthetic match',rules:[]}});
  for(const content of ['empty','unavailable']) {
    if(content==='unavailable') {await call('setViewFilter',{viewId,config:{search:'',rules:[]}});await rename(source,join(fixture,'offline'));await page.reload();}
  for(const language of ['en','ru']) { await setInterfaceLanguage(page,language); for(const theme of ['light','dark']) {
    await openSettingsSection(page,'appearance');await page.getByRole('radio',{name:theme==='light'?/^(Light|Светлая)$/:/^(Dark|Тёмная)$/}).click();await returnToWorkspace(page);
    for(const size of [{width:1024,height:720},{width:1440,height:960}]) {await page.setViewportSize(size);await page.getByRole('heading',{name:content==='empty'?/^(No matching projects|Нет подходящих проектов)$/:/^(Project folder unavailable|Папка проекта недоступна)$/}).waitFor();await page.screenshot({path:join(evidence,`${content}-${language}-${theme}-${size.width}.png`)});}
  }}
  }
  await rename(join(fixture,'offline'),source);
  await page.getByRole('button',{name:/^(Retry folder access|Проверить доступ к папке)$/}).click();
  await page.locator('.project-card').first().waitFor();
  checks.push('source unavailable/retry recovery');
} catch(error) {failure=error; if(page) await page.screenshot({path:join(evidence,'failure.png')}).catch(()=>{});}
finally {
  let stopped=false,cleaned=false;
  try {if(app)await closeElectron(app);stopped=await ownedProcessesStopped(parents,backends,{launchUnverified});assert.equal(stopped,true);}catch(error){failure??=error;}
  try {cleaned=await cleanupOwnedFixture(fixture,{processesStopped:stopped,primaryFailure:failure,record:()=>{}});}catch(error){failure??=error;}
  await writeFile(join(evidence,'report.json'),JSON.stringify({sha:process.env.GITHUB_SHA??null,platform:process.platform,screens,checks,launchUnverified,stopped,cleaned,failure:failure?.stack},null,2));
}
if(failure)throw failure;
console.log(`Board: ${screens.length} populated/long variants, 8 empty and 8 unavailable variants; ${checks.join(', ')}`);
