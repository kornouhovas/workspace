import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openSettingsService} from '../dist/service/settings.mjs';
const value=result=>{assert.equal(result.ok,true,JSON.stringify(result));return result.value;};
test('status color edits preserve duplicate identities, sibling presentation, folders and restart',()=>{
 const directory=mkdtempSync(join(tmpdir(),'status-colors-')),root=join(directory,'Root'),database=join(directory,'data/app.sqlite');
 for(const path of ['Clients/Active/App','Personal/Active/Tool']){mkdirSync(join(root,path),{recursive:true});writeFileSync(join(root,path,'keep.txt'),'Exact bytes\n');}
 let app=openSettingsService(database);
 try{
  const workspace=value(app.handleCommand({type:'workspace.create',name:'First',rootPath:root,initialize:'status'}));
  const sibling=value(app.handleCommand({type:'workspace.create',name:'Sibling',rootPath:root,initialize:'status'}));
  const query=(type,fields={})=>value(app.handleQuery({type:`workspace.${type}`,workspaceId:workspace.workspaceId,...fields}));
  const command=(type,fields={})=>value(app.handleCommand({type:`workspace.${type}`,workspaceId:workspace.workspaceId,...fields}));
  const preview=query('previewDiscovery',{folderRoles:[{relativePath:'Clients',role:'group'},{relativePath:'Personal',role:'group'},{relativePath:'Clients/Active',role:'status'},{relativePath:'Personal/Active',role:'status'}]});
  command('applyDiscovery',{previewToken:preview.previewToken});
  const before=query('listProjects'),first=before.categories.find(c=>c.relativePath==='Clients/Active'),second=before.categories.find(c=>c.relativePath==='Personal/Active');
  assert.equal(first.name,'Active');assert.equal(second.name,'Active');assert.notEqual(first.categoryId,second.categoryId);
  const options=query('listCategoryPresentation').options;
  command('setCategoryPresentation',{options:options.map((o,i)=>({...o,hidden:o.categoryId===second.categoryId,position:options.length-1-i}))});
  const retained=query('listCategoryPresentation');
  command('setCategoryColor',{categoryId:first.categoryId,color:'blue'});
  command('setCategoryColor',{categoryId:second.categoryId,color:'red'});
  const expected=retained.options.map(o=>({...o,color:o.categoryId===first.categoryId?'blue':'red'}));
  assert.deepEqual(query('listCategoryPresentation').options,expected);
  assert.ok(query('listCategoryPresentation',{workspaceId:sibling.workspaceId}).options.every(o=>o.color==='default'&&!o.hidden));
  const after=query('listProjects');assert.deepEqual(after.projects,before.projects);assert.equal(after.revision,before.revision);
  assert.equal(after.categories.find(c=>c.categoryId===first.categoryId).presentation.color,'blue');
  app.close();app=openSettingsService(database);
  assert.deepEqual(query('listCategoryPresentation').options,expected);
  assert.deepEqual(query('listProjects').projects,before.projects);
  for(const path of ['Clients/Active/App','Personal/Active/Tool'])assert.equal(readFileSync(join(root,path,'keep.txt'),'utf8'),'Exact bytes\n');
  assert.deepEqual(readdirSync(join(root,'Clients/Active')),['App']);
 }finally{app.close();rmSync(directory,{recursive:true,force:true});}
});

test('color command rejects foreign, inactive and malformed targets and only notifies its workspace',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'status-color-validation-')),root=join(directory,'Root');mkdirSync(join(root,'Work','App'),{recursive:true});
 const app=openSettingsService(join(directory,'data/app.sqlite'));
 try{
  const first=value(app.handleCommand({type:'workspace.create',name:'First',rootPath:root,initialize:'status'}));
  const sibling=value(app.handleCommand({type:'workspace.create',name:'Sibling',rootPath:root,initialize:'status'}));
  const otherRoot=join(directory,'Other');mkdirSync(join(otherRoot,'OtherStatus','Tool'),{recursive:true});
  const other=value(app.handleCommand({type:'workspace.create',name:'Other',rootPath:otherRoot,initialize:'status'}));
  const query=(type,workspaceId=first.workspaceId)=>value(app.handleQuery({type:`workspace.${type}`,workspaceId}));
  const categoryId=query('listProjects').categories[0].categoryId;
  const request={type:'workspace.setCategoryColor',workspaceId:first.workspaceId,categoryId,color:'green'};
  const before=query('listCategoryPresentation'),events=[];
  const stop=app.workspaces.subscribe(event=>events.push(event));
  for(const fields of [{color:'#00ff00'},{categoryId:query('listProjects',other.workspaceId).categories[0].categoryId},{categoryId:sibling.workspaceId},{extra:true},{workspaceId:'bad'}]){
   assert.equal(app.handleCommand({...request,...fields}).ok,false);
   assert.deepEqual(query('listCategoryPresentation'),before);
  }
  value(app.handleCommand(request));await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(events.filter(e=>e.type==='workspace.categoryPresentationChanged'),[{type:'workspace.categoryPresentationChanged',sourceId:first.sourceId,workspaceIds:[first.workspaceId]}]);
  events.length=0;value(app.handleCommand(request));await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(events.filter(e=>e.type==='workspace.categoryPresentationChanged'),[]);
  const preview=value(app.handleQuery({type:'workspace.previewDiscovery',workspaceId:first.workspaceId,folderRoles:[{relativePath:'Work',role:'group'}]}));
  value(app.handleCommand({type:'workspace.applyDiscovery',workspaceId:first.workspaceId,previewToken:preview.previewToken}));
  assert.equal(app.handleCommand({...request,color:'red'}).ok,false);stop();
 }finally{app.close();rmSync(directory,{recursive:true,force:true});}
});
