/* global window, document, innerWidth */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,mkdir,realpath,writeFile,readFile,stat} from 'node:fs/promises';
import {tmpdir,release} from 'node:os';
import {join,resolve} from 'node:path';
import {_electron} from 'playwright-core';
import {closeElectron,cleanupOwnedFixture,ownedProcessesStopped} from './runtime-lifecycle.mjs';
import {setInterfaceLanguage,openSettingsSection,returnToWorkspace} from './runtime-settings.mjs';
import {packagedExecutablePath} from './runtime-executable.mjs';
import {enterContextFor} from './runtime-context-tools.mjs';
const mode=process.argv[2]??'dev';assert.ok(['dev','release'].includes(mode));
const root=resolve(import.meta.dirname,'..'), evidence=resolve(process.env.WORKSPACE_SMOKE_EVIDENCE_DIR??`work/issue-60-projects-${mode}`);
await mkdir(evidence,{recursive:true});
const fixture=await realpath(await mkdtemp(join(tmpdir(),'workspace-contextual-projects-')));
const report={issue:60,mode,sha:process.env.GITHUB_SHA??null,run:process.env.GITHUB_RUN_ID??null,attempt:process.env.GITHUB_RUN_ATTEMPT??null,platform:process.platform,kernel:release(),checks:[],screens:[],shutdowns:[],status:'running'};
const parents=new Set(),backends=new Set();let app,page,failure,launchUnverified=false;
const query=async input=>{const result=await page.evaluate(input=>window.workspace.workspace(input),input);assert.equal(result.ok,true,JSON.stringify(result));return result.value;};
async function close(){if(!app)return;const shutdown={normalQuit:false,backendsExited:false};report.shutdowns.push(shutdown);await closeElectron(app);shutdown.normalQuit=true;app=undefined;assert.equal(await ownedProcessesStopped(parents,backends),true);shutdown.backendsExited=true;}
try {
 launchUnverified=true;
 app=await _electron.launch({executablePath:mode==='dev'?createRequire(import.meta.url)('electron'):packagedExecutablePath(root,process.platform,process.arch),args:[root],cwd:root,env:{...process.env,WORKSPACE_USER_DATA_DIR:join(fixture,'data')}});
 parents.add(app.process());page=await app.firstWindow();page.setDefaultTimeout(15000);
 await page.waitForFunction(async()=>(await window.workspace.getBackendStatus()).state==='ready');
 for(const pid of await app.evaluate(({app})=>app.getAppMetrics().filter(m=>m.type==='Utility'&&m.serviceName?.includes('Node')).map(m=>m.pid)))backends.add(pid);
 assert.ok(backends.size);launchUnverified=false;
 for(const language of ['en','ru']) {
  await setInterfaceLanguage(page,language); const en=language==='en';
  const source=join(fixture,language);await mkdir(join(source,'Brand refresh'),{recursive:true});await mkdir(join(source,'Customer portal'));await writeFile(join(source,'Brand refresh','keep.txt'),'retained');
  const {workspaceId,viewId}=await query({type:'workspace.create',name:'Design studio',rootPath:source});
  const call=(type,fields={})=>query({type:`workspace.${type}`,workspaceId,...fields});
  const list=await call('applyDiscovery',{previewToken:(await call('previewDiscovery')).previewToken});
  const project=list.projects.find(p=>p.name==='Brand refresh');
  const propertyId=(await call('createProperty',{name:'Notes',propertyType:'text'})).propertyId;
  await call('setTextValue',{projectId:project.projectId,propertyId,value:'Keep this exact note'});
  let name=project.name;
  for(const layout of ['table','board']) {
   await call('setViewLayout',{viewId,kind:layout});await page.reload();
   const createLabel=en?'Create project folder':'Создать папку проекта', cancelLabel=en?'Cancel':'Отмена';
   const create=page.getByRole('button',{name:createLabel,exact:true});await create.click();
   let dialog=page.getByRole('dialog',{name:createLabel,exact:true});
   await dialog.getByRole('textbox').fill(`Created ${layout}`);
   await dialog.getByRole('button',{name:cancelLabel,exact:true}).click();
   assert.equal((await call('listProjects')).projects.length,2+(layout==='board'?1:0));
   await create.press('Enter');dialog=page.getByRole('dialog',{name:createLabel,exact:true});
   const valueLabel=`${en?'Edit Text value':'Редактировать Text-значение'}: ${name} / Notes`;
   await page.getByRole('button',{name:valueLabel,exact:true}).click();
   await page.getByRole('textbox',{name:valueLabel,exact:true}).press('Escape');
   assert.equal(await dialog.isVisible(),true,'Independent editor Escape keeps creation open');
   const projectTools=page.getByRole('button',{name:`${en?'Project actions':'Действия с проектом'}: ${name}`,exact:true});
   await projectTools.click();
   await page.getByRole('dialog',{name:`${en?'Project actions':'Действия с проектом'}: ${name}`,exact:true}).getByRole('button').first().focus();
   await page.keyboard.press('Escape');
   assert.equal(await projectTools.getAttribute('aria-expanded'),'false');
   assert.equal(await dialog.isVisible(),true,'Independent menu Escape keeps creation open');
   report.checks.push({language,layout,independentEditorEscape:true,independentMenuEscape:true});
   await dialog.getByRole('textbox').press('Enter');await dialog.waitFor({state:'detached'});
   const created=(await call('listProjects')).projects.find(p=>p.name===`Created ${layout}`);assert.ok(created);assert.equal((await stat(join(source,created.relativePath))).isDirectory(),true);
   report.checks.push({language,layout,create:true,cancelNoEffect:true});
   for(const location of ['list','preview','expanded']) {
    if(location!=='list')await page.getByRole('button',{name:`${en?'Preview project':'Открыть предпросмотр проекта'}: ${name}`,exact:true}).click();
    if(location==='expanded')await page.getByRole('button',{name:en?'Expand project':'Развернуть проект',exact:true}).click();
    const scope=location==='list'?page.locator('.saved-view-content'):page.locator('.project-area');
    const renameLabel=en?'Rename project folder':'Переименовать папку проекта';
    const rename=scope.getByRole('button',{name:`${renameLabel}: ${name}`,exact:true,includeHidden:true});
    await enterContextFor(page,rename);await rename.press('Enter');
    dialog=page.getByRole('dialog',{name:renameLabel,exact:true});
    let input=dialog.getByRole('textbox');
    const reviewCurrent=dialog.getByRole('button',{name:en?'Review current project name':'Проверить текущее имя проекта',exact:true});
    await Promise.race([input.and(page.locator(':enabled')).waitFor(), reviewCurrent.waitFor()]);
    if(await reviewCurrent.isVisible()) { await reviewCurrent.click(); report.checks.push({language,layout,location,explicitCurrentReview:true}); }

    const fillReviewed = async value => {
     try { await input.fill(value,{timeout:1000}); }
     catch(error) {
      if(!await reviewCurrent.isVisible())throw error;
      await reviewCurrent.click();report.checks.push({language,layout,location,explicitCurrentReview:true,blockedBeforeInput:true});
      await input.fill(value);
     }
    };
    // A source observation may arrive between opening and typing. Review is an
    // explicit UI action before submission, never a replay of a filesystem command.
    // Occupied targets cannot replace either project or their metadata.
    await fillReviewed('Customer portal');await input.press('Enter');
    await dialog.getByText(en?'This folder name or identity is occupied or reserved. Choose another name.':'Это имя или идентификатор папки занят или зарезервирован. Выберите другое имя.',{exact:true}).waitFor();
    await dialog.getByRole('button',{name:cancelLabel,exact:true}).click();
    await enterContextFor(page,rename);await rename.press('Enter');
    dialog=page.getByRole('dialog',{name:renameLabel,exact:true});
    assert.equal((await call('listProjects')).projects.find(p=>p.projectId===project.projectId).name,name);
    input=dialog.getByRole('textbox');
    if(await reviewCurrent.isVisible())await reviewCurrent.click();
    const next=`Brand ${layout} ${location}`;await fillReviewed(next);await input.press('Enter');await dialog.waitFor({state:'detached'});
    name=next;assert.equal((await call('listProjects')).projects.find(p=>p.projectId===project.projectId).name,name);
    assert.equal(await readFile(join(source,name,'keep.txt'),'utf8'),'retained');
    assert.equal((await call('listTextProperties')).values.find(v=>v.projectId===project.projectId&&v.propertyId===propertyId).value,'Keep this exact note');
    if(location==='expanded') {
     assert.equal(await page.locator(`[data-project-tab="${project.projectId}"]`).count(),1);
     await page.getByRole('button',{name:en?'Return project to the right':'Вернуть проект вправо',exact:true}).click();
    }
    if(location!=='list')await page.getByRole('button',{name:en?'Close preview':'Закрыть предпросмотр',exact:true}).click();
    report.checks.push({language,layout,location,rename:true,collisionPreserved:true,identity:true,metadata:true});
   }
   for(const theme of ['light','dark']) {
    await openSettingsSection(page,'appearance');await page.getByRole('radio',{name:theme==='light'?/^(Light|Светлая)$/:/^(Dark|Тёмная)$/}).click();await returnToWorkspace(page);
    for(const size of [{width:1024,height:720},{width:1440,height:960}]) {
     await page.setViewportSize(size);await page.evaluate(()=>document.fonts.ready);
     await create.click();dialog=page.getByRole('dialog',{name:createLabel,exact:true});await dialog.getByRole('textbox').fill('Autumn campaign');
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
     const stem=`${language}-${theme}-${layout}-${size.width}-create`;await page.screenshot({path:join(evidence,`${stem}.png`)});report.screens.push(stem);
     await dialog.getByRole('textbox').press('Escape');await dialog.waitFor({state:'detached'});
     const renameLabel=en?'Rename project folder':'Переименовать папку проекта';
     const rename=page.getByRole('button',{name:`${renameLabel}: ${name}`,exact:true,includeHidden:true});await enterContextFor(page,rename);await rename.press('Enter');
     dialog=page.getByRole('dialog',{name:renameLabel,exact:true});await dialog.getByRole('textbox').fill('Campaign design');
     const renameStem=`${language}-${theme}-${layout}-${size.width}-rename`;await page.screenshot({path:join(evidence,`${renameStem}.png`)});report.screens.push(renameStem);
     await dialog.getByRole('textbox').press('Escape');await dialog.waitFor({state:'detached'});
    }
   }
  }
 }
 await close();report.status='passed';
} catch(error) {failure=error;report.status='failed';report.failure={name:error.name,message:error.message};if(app)try{await page.screenshot({path:join(evidence,'failure.png'),timeout:2000});await close();}catch(error){report.shutdownFailure=error.message;}}
finally {await cleanupOwnedFixture(fixture,{processesStopped:ownedProcessesStopped(parents,backends,{launchUnverified}),primaryFailure:failure,record:async cleanup=>{report.cleanup=cleanup;await writeFile(join(evidence,'report.json'),JSON.stringify(report,null,2)+'\n');}});}
console.info(`Contextual projects: ${report.checks.length} journeys, ${report.screens.length} captures; normal shutdown and owned cleanup verified.`);
