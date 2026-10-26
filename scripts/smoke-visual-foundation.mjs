/* global window, document */
import assert from 'node:assert/strict';
import { runtimeSmokeLaunch } from './runtime-executable.mjs';
import { mkdtemp, mkdir, realpath, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron } from 'playwright-core';
import { closeElectron, cleanupOwnedFixture, ownedProcessesStopped } from './runtime-lifecycle.mjs';
import { openSettingsSection, returnToWorkspace, setInterfaceLanguage } from './runtime-settings.mjs';
import { enterContextFor } from './runtime-context-tools.mjs';
const root = resolve(import.meta.dirname, '..');
const before = process.argv.includes('--before');
const evidence = resolve(process.env.WORKSPACE_SMOKE_EVIDENCE_DIR ?? `work/issue-68/${before ? 'before' : 'after'}`);
await mkdir(evidence, {recursive:true});
const fixture = await realpath(await mkdtemp(join(tmpdir(), 'workspace-visual-foundation-')));
const source = join(fixture, 'source'); await mkdir(source);
for (const name of ['Brand refresh', 'Customer portal', 'Release checklist']) await mkdir(join(source, name));
const parents = new Set(), backends = new Set(), checks = [], stateChecks = [];
let app, page, cdp, failure;
try {
  app = await _electron.launch({...runtimeSmokeLaunch(root),cwd:root,env:{...process.env,WORKSPACE_USER_DATA_DIR:join(fixture,'data')}});
  parents.add(app.process());
  page = await app.firstWindow(); page.setDefaultTimeout(15000);
  cdp=await page.context().newCDPSession(page);
  await cdp.send("DOM.enable"); await cdp.send("CSS.enable");
  await page.waitForFunction(async () => (await window.workspace.getBackendStatus()).state === 'ready');
  for (const pid of await app.evaluate(({app}) => app.getAppMetrics().filter(m => m.type === 'Utility' && m.serviceName?.includes('Node')).map(m => m.pid))) backends.add(pid);
  const query = async input => { const r = await page.evaluate(input => window.workspace.workspace(input),input); assert.equal(r.ok,true,JSON.stringify(r)); return r.value; };
  const workspace = await query({type:'workspace.create',name:'Design studio',rootPath:source});
  const workspaceId = workspace.workspaceId;
  const captureState = async (content) => {
    for(const language of ['en','ru']) {
      await setInterfaceLanguage(page,language);
      for(const theme of ['light','dark']) {
        await openSettingsSection(page,'appearance');
        await page.getByRole('radio',{name:theme==='light'?/^(Light|Светлая)$/:/^(Dark|Тёмная)$/}).click();
        await page.waitForFunction(t=>document.documentElement.dataset.theme===t,theme);
        await returnToWorkspace(page);
        for(const size of [{width:1024,height:720},{width:1440,height:960}]) {
          await page.setViewportSize(size);
          await page.locator('.desktop-workspace').evaluate(el=>el.scrollTop=0);
          const state=content==='unconfigured' ? page.getByRole('button',{name:language==='en'?'Set up project source':'Настроить источник проектов'})
            : content==='configured-empty' ? page.locator('.table-view .bb-empty-state')
            : page.getByRole('heading',{name:language==='en'?'No matching projects':'Нет подходящих проектов'});
          await state.waitFor();
          assert.equal(await page.locator('.table-view .bb-empty-state:visible').count(),content==='filtered-empty'?0:1);
          assert.equal(await page.locator('.project-table tbody tr:visible').count(),0);
          if(content==='unconfigured') assert.equal(await page.getByRole('heading',{name:/^(No matching projects|Нет подходящих проектов)$/}).count(),0);
          assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
          await page.screenshot({path:join(evidence,`${content}-${language}-${theme}-${size.width}.png`)});
          if(content==='unconfigured') {
            await state.click();
            const sourceTools=page.getByRole('dialog',{name:language==='en'?'Source tools':'Инструменты источника',exact:true});
            await sourceTools.waitFor();
            await page.keyboard.press('Escape');
            assert.equal(await sourceTools.isVisible(),false);
          }
          stateChecks.push({content,language,theme,...size});
        }
      }
    }
  };
  if(!before) { await page.reload(); await captureState('unconfigured'); }
  const preview = await query({type:'workspace.previewDiscovery',workspaceId,mode:'direct'});
  await query({type:'workspace.applyDiscovery',workspaceId,previewToken:preview.previewToken});
  const property = await query({type:'workspace.createProperty',workspaceId,name:'Notes',propertyType:'text'});
  const projects = await query({type:'workspace.listProjects',workspaceId});
  await query({type:'workspace.setTextValue',workspaceId,projectId:projects.projects[0].projectId,propertyId:property.propertyId,value:'Review the launch assets'});
  for (const kind of ['table','board']) await query({type:'workspace.createView',workspaceId,name:kind === 'table' ? 'All projects' : 'Board',kind});
  const views = await query({type:'workspace.listViews',workspaceId});
  await query({type:'workspace.activateView',workspaceId,viewId:views.views.find(v=>v.name==='All projects').viewId});
  await page.reload();
  for (const content of ['ordinary','long']) {
    if (content === 'long') {
      await query({type:'workspace.renameProperty',workspaceId,propertyId:property.propertyId,name:'Notes — Примечания и следующие шаги '.repeat(3)});
      await query({type:'workspace.setTextValue',workspaceId,projectId:projects.projects[0].projectId,propertyId:property.propertyId,value:'Review the launch assets. Проверить материалы. '.repeat(12)+'\nSecond line'});
    }
    for (const language of ['en','ru']) {
      await setInterfaceLanguage(page,language);
      for (const theme of ['light','dark']) {
        await openSettingsSection(page,'appearance');
        await page.getByRole('radio',{name: theme==='light' ? /^(Light|Светлая)$/ : /^(Dark|Тёмная)$/}).click();
        await page.waitForFunction(t=>document.documentElement.dataset.theme===t,theme);
        await returnToWorkspace(page);
        for (const size of [{width:1024,height:720},{width:1440,height:960}]) {
          await page.setViewportSize(size);
          await page.locator('.desktop-workspace').evaluate(el=>el.scrollTop=0);
          await page.locator('.project-table tbody tr').first().waitFor();
          await page.evaluate(()=>document.fonts.ready);
          const geometry = await page.evaluate(()=>({tableTop:document.querySelector('.project-table')?.getBoundingClientRect().top,viewStripBottom:document.querySelector('.views-panel')?.getBoundingClientRect().bottom,fonts:[...document.fonts].map(f=>({family:f.family,status:f.status})),overflow:document.documentElement.scrollWidth>window.innerWidth}));
          await page.screenshot({path:join(evidence,`${content}-${language}-${theme}-${size.width}-table.png`)});
          if (!before) { assert.ok(geometry.tableTop - geometry.viewStripBottom <= 24,JSON.stringify(geometry)); assert.equal(geometry.overflow,false); assert.ok(geometry.fonts.some(f=>f.family.includes('Inter')&&f.status==='loaded'),'Bundled Inter rendered'); }
          const {root:dom}=await cdp.send('DOM.getDocument');
          const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:dom.nodeId,selector:'.sidebar-label'});
          const {fonts:platformFonts}=await cdp.send('CSS.getPlatformFontsForNode',{nodeId});
          if(!before) assert.ok(platformFonts.some(font=>font.isCustomFont && font.familyName.includes('Inter') && font.glyphCount>0),JSON.stringify(platformFonts));
          checks.push({content,language,theme,...size,...geometry,platformFonts});

          if (!before) {
            const labels = language === 'en' ? ['Source tools','Add property','Project archive'] : ['Инструменты источника','Добавить свойство','Архив проектов'];
            for (const [index,label] of labels.entries()) {
              const trigger=page.getByRole('button',{name:label,exact:true,includeHidden:true});
              await enterContextFor(page,trigger);
              await trigger.focus(); await trigger.press('Enter');
              const panel=page.getByRole('dialog',{name:index===1?(language==='en'?'Properties':'Свойства'):label,exact:true});
              await panel.waitFor();
              const bounds=await panel.boundingBox();
              assert.ok(bounds && bounds.x>=0 && bounds.y>=0 && bounds.x+bounds.width<=size.width && bounds.y+bounds.height<=size.height,JSON.stringify({label,bounds,size}));
              await page.screenshot({path:join(evidence,`${content}-${language}-${theme}-${size.width}-tools-${index}.png`)});
              if(index===1) {
                const field=panel.getByRole('textbox',{name:language==='en'?'Property name':'Название свойства',exact:true});
                await field.fill('Uncommitted draft');
                await page.screenshot({path:join(evidence,`${content}-${language}-${theme}-${size.width}-property-draft.png`)});
                await field.press('Escape');
                assert.equal(await field.count(),0);
                await page.waitForFunction(label=>document.activeElement?.getAttribute('aria-label')===label,label);
                continue;
              }
              await page.keyboard.press('Escape');
              assert.equal(await trigger.evaluate(el=>el===document.activeElement),true);
            }
            const rowTrigger=page.getByRole('button',{name:`${language==='en'?'Project actions':'Действия с проектом'}: Brand refresh`,exact:true});
            await rowTrigger.focus();
            await page.getByRole('tooltip',{name:new RegExp(language==='en'?'Project actions':'Действия с проектом')}).waitFor();
            await rowTrigger.press('Enter');
            await page.screenshot({path:join(evidence,`${content}-${language}-${theme}-${size.width}-row-actions.png`)});
            await page.keyboard.press('Escape');
            await page.waitForFunction(label=>document.activeElement?.getAttribute('aria-label')===label,`${language==='en'?'Project actions':'Действия с проектом'}: Brand refresh`);
            assert.equal(await rowTrigger.evaluate(el=>el===document.activeElement),true);
            const editor=page.getByRole('button',{name:new RegExp(`^(Edit Text value|Редактировать Text-значение): Brand refresh /`)});
            await editor.press('Enter');
            await page.getByRole('textbox',{name:new RegExp(`^(Edit Text value|Редактировать Text-значение): Brand refresh /`)}).waitFor();
            await page.screenshot({path:join(evidence,`${content}-${language}-${theme}-${size.width}-value-editor.png`)});
            await page.keyboard.press('Escape');
            assert.equal(await editor.evaluate(el=>el===document.activeElement),true);
          }
          await openSettingsSection(page,'general');
          await page.screenshot({path:join(evidence,`${content}-${language}-${theme}-${size.width}-settings.png`)});
          if(!before && content==='ordinary') {
            for(const section of ['workspaces','sources','backup','about']) {
              await openSettingsSection(page,section);
              await page.screenshot({path:join(evidence,`${content}-${language}-${theme}-${size.width}-settings-${section}.png`)});
            }
          }
          await returnToWorkspace(page);
        }
      }
    }
  }
  if(!before) {
    await query({type:'workspace.setViewFilter',workspaceId,viewId:views.views.find(v=>v.name==='All projects').viewId,config:{search:'No matching synthetic project',rules:[]}});
    await captureState('filtered-empty');
    const emptyRoot=join(fixture,'empty-source');await mkdir(emptyRoot);
    const empty=await query({type:'workspace.create',name:'Empty studio',rootPath:emptyRoot});
    const preview=await query({type:'workspace.previewDiscovery',workspaceId:empty.workspaceId,mode:'direct'});
    await query({type:'workspace.applyDiscovery',workspaceId:empty.workspaceId,previewToken:preview.previewToken});
    await page.reload();
    await captureState('configured-empty');
  }
} catch (error) {
  failure=error;
  if(page) console.log(await page.evaluate(()=>({focus:document.activeElement?.outerHTML?.slice(0,250),openTools:[...document.querySelectorAll('.context-tools-panel:not([hidden])')].map(panel=>panel.getAttribute('aria-label'))})).catch(()=>({diagnostic:'unavailable'})));
}
finally {
  let stopped=false;
  try { if(cdp) await cdp.detach(); if(app) await closeElectron(app); stopped=await ownedProcessesStopped(parents,backends); assert.equal(stopped,true); }
  catch(error) { failure??=error; }
  let cleaned=false;
  try { cleaned=await cleanupOwnedFixture(fixture,{processesStopped:stopped,primaryFailure:failure,record:result=>{cleaned=result.status === "passed";}}); } catch(error) { failure??=error; }
  await writeFile(join(evidence,'report.json'),JSON.stringify({sha:process.env.GITHUB_SHA??null,before,checks,stateChecks,stopped,cleaned,failure:failure?.stack},null,2));
}
if(failure) throw failure;
console.log(`Visual foundation: ${checks.length} screen variants and ${stateChecks.length} empty-state variants, clean shutdown and fixture cleanup`);
