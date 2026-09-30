import {_electron as electron} from '@playwright/test';
import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';
const dir=resolve('work/workspace-dnk/before'),fixture=await mkdtemp(join(tmpdir(),'workspace-cjq-')),metadata=join(fixture,'metadata'),root=join(fixture,'Projects');
await mkdir(metadata);for(const name of ['Alpha','Beta','Gamma'])await mkdir(join(root,'Active',name),{recursive:true});
await mkdir(join(root,'Done','Delta'),{recursive:true});await writeFile(join(metadata,'settings.json'),JSON.stringify({rootPath:root}));
const out={fixture,metadata,provenance:'Real Electron 41; isolated metadata/source; renderer screenshots and inputs via Playwright CDP; picker outcome for temporary B source injected; no native titlebar claim.',checks:[],screenshots:[]};let app,page,workspaceId,tableId,props={},values={};
const check=(name,ok,data)=>{out.checks.push({name,passed:!!ok,data});if(!ok)throw Error(name)};
async function start(){app=await electron.launch({args:['electron/main.js'],env:{...process.env,WORKSPACE_DEV:'1',WORKSPACE_DEV_DATA:metadata,WORKSPACE_DEV_URL:''}});page=await app.firstWindow();page.setDefaultTimeout(9000);await page.getByRole('button',{name:'Add Workspace',exact:true}).waitFor();}
const req=(method,payload={})=>page.evaluate(({method,payload})=>window.workspace.request(method,payload),{method,payload});
const load=async()=>{await page.reload();await page.getByRole('tab',{name:'Table',exact:true}).waitFor();if(await page.getByRole('tab',{name:'Table',exact:true}).getAttribute('aria-selected')!=='true') await page.getByRole('tab',{name:'Table',exact:true}).click();await page.waitForTimeout(350)};
const projection=()=>req('workspace.getViewProjection',{workspaceId,viewId:tableId});
async function grouping(propertyId,settings={}){await req('workspace.updateView',{workspaceId,viewId:tableId,patch:{grouping:propertyId?{propertyId,...settings}:null}});await load();}
async function groupMenu(){
 await page.waitForTimeout(250);
 if (await page.locator('[data-workspace-group-menu]').count()) return;
 if (!(await page.locator('[data-workspace-view-filter-menu]').count())) await page.getByRole('button',{name:'Customize Columns',exact:true}).click();
 if(await page.locator('[data-workspace-group-trigger]').count())await page.locator('[data-workspace-group-trigger]').click();
 await page.locator('[data-workspace-group-menu]').first().waitFor();
}
async function shot(name){const path=join(dir,name+'.png');await page.screenshot({path,fullPage:true});out.screenshots.push(path)}
async function fit(w,h){await app.evaluate(({BrowserWindow},{w,h})=>{const win=BrowserWindow.getAllWindows()[0];win.setContentSize(w,h);win.webContents.setZoomFactor(1)},{w,h});await page.setViewportSize({width:w,height:h});await page.waitForTimeout(180);check(`dimensions ${w}×${h}`,await page.evaluate(({w,h})=>innerWidth===w&&innerHeight===h,{w,h}));}
try{
await mkdir(dir,{recursive:true});await start();workspaceId=(await req('workspace.getRoot')).root.workspaceId;const views=await req('workspace.listViews',{workspaceId});tableId=views.views.find(v=>v.viewType==='table').id;out.ids={workspaceId,tableId};
for(const type of ['text','number','date','select','multi-select'])props[type]=(await req('workspace.createProperty',{workspaceId,name:type==='text'?'Notes with long column name':type==='multi-select'?'Areas':type,type})).property.id;
for(const type of ['select','multi-select']){values[type]=[];for(const [name,color]of [['Automobile and other transport — a very long grouping value for responsive truncation','red'],['Other','blue'],['Unused','green']])values[type].push((await req('workspace.createSelectValue',{workspaceId,propertyId:props[type],name,color})).selectValue.id);}
await req('workspace.setActiveView',{workspaceId,viewId:tableId});const projects=(await projection()).projection.rows;out.projects=projects;
for(const [index,project]of projects.entries()){for(const type of ['text','number','date','select','multi-select']){const value=type==='text'?[' A\nSecond line with a long description that wraps around the cell and keeps exact whitespace','A','a',null][index]:type==='number'?[0,2,10,null][index]:type==='date'?['2026-01-01','2026-09-01','2026-09-01',null][index]:type==='select'?[values.select[0],values.select[1],values.select[0],null][index]:[[values[type][0],values[type][1]],[values[type][0]],[],[values[type][1]]][index];await req('workspace.updateProjectPropertyValue',{workspaceId,projectId:project.id,propertyId:props[type],value});}}
const visible=['property:name','property:status',...Object.values(props)];await req('workspace.updateView',{workspaceId,viewId:tableId,patch:{visiblePropertyIds:visible,propertyLayout:{[props.text]:{wrapContent:true}}}});await load();check('legacy Table flat',await page.locator('[data-table-group-id]').count()===0);await shot('initial-flat');
// Matrix: grouped/flat/menu both themes, widths, sidebar states.
for(const theme of ['Light','Dark']){await page.evaluate(theme=>localStorage.setItem('workspace.theme',theme.toLowerCase()),theme);await load();for(const [w,h]of [[1440,960],[1024,720]]){await fit(w,h);for(const sidebar of ['open','collapsed']){const target=sidebar==='open'?'Show sidebar':'Hide sidebar';if(await page.getByRole('button',{name:target,exact:true}).count())await page.getByRole('button',{name:target,exact:true}).click();await page.waitForTimeout(200);await grouping(props['multi-select']);await shot(`${theme}-${w}-${sidebar}-grouped`);check('horizontal/vertical accessible',await page.locator('table').evaluate(table=>table.scrollWidth>=table.clientWidth));await groupMenu();await shot(`${theme}-${w}-${sidebar}-menu`);check('Group by and Sort distinct',await page.getByRole('combobox',{name:'Group by',exact:true}).count()===1&&await page.getByRole('combobox',{name:'Sort',exact:true}).count()===1);await page.keyboard.press('Escape');await page.keyboard.press('Escape');await grouping(null);await shot(`${theme}-${w}-${sidebar}-flat`);}}}
out.props=props;out.values=values;await writeFile(resolve('work/workspace-dnk/fixture.json'),JSON.stringify({fixture,metadata,ids:out.ids,props,values},null,2));
}catch(error){out.error=error.stack;try{await shot('failure')}catch{}}finally{await writeFile(join(dir,'electron-results.json'),JSON.stringify(out,null,2));console.log(JSON.stringify({checks:out.checks.length,error:out.error,fixture},null,2));await app?.close().catch(()=>{});if(out.error)process.exitCode=1;}
