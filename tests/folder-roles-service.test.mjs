import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {openSettingsService} from '../dist/service/settings.mjs';

function value(result) { assert.equal(result.ok,true,JSON.stringify(result)); return result.value; }

test('a reviewed group role keeps its project visible without a status through restart', () => {
  const directory=mkdtempSync(join(tmpdir(),'folder-roles-'));
  const root=join(directory,'Root');mkdirSync(join(root,'Clients','App'),{recursive:true});
  const database=join(directory,'data','workspace.sqlite');
  let app=openSettingsService(database);
  try {
    const workspace=value(app.handleCommand({type:'workspace.create',name:'Workspace',rootPath:root,initialize:'status'}));
    const before=value(app.handleQuery({type:'workspace.listProjects',workspaceId:workspace.workspaceId}));
    const preview=value(app.handleQuery({type:'workspace.previewDiscovery',workspaceId:workspace.workspaceId,folderRoles:[{relativePath:'Clients',role:'group'}]}));
    assert.ok(preview.previewToken);
    const after=value(app.handleCommand({type:'workspace.applyDiscovery',workspaceId:workspace.workspaceId,previewToken:preview.previewToken}));
    assert.equal(after.projects.length,1);
    assert.equal(after.projects[0].projectId,before.projects[0].projectId);
    assert.equal(after.projects[0].categoryId,null);
    assert.deepEqual(after.categories,[]);
    value(app.handleCommand({type:'workspace.refreshSource',workspaceId:workspace.workspaceId}));
    assert.equal(value(app.handleQuery({type:'workspace.listProjects',workspaceId:workspace.workspaceId,observed:true})).projects.some(row=>row.projectId===before.projects[0].projectId),true);
    app.close();app=openSettingsService(database);
    assert.deepEqual(value(app.handleQuery({type:'workspace.listProjects',workspaceId:workspace.workspaceId})).projects,after.projects);
    assert.deepEqual(value(app.handleQuery({type:'workspace.previewDiscovery',workspaceId:workspace.workspaceId})).folderRoles,[{relativePath:'Clients',role:'group'}]);
  } finally {app.close();rmSync(directory,{recursive:true,force:true});}
});

test('nearest status, same-name statuses and explicit descendant overrides survive parent edits', () => {
  const directory=mkdtempSync(join(tmpdir(),'folder-statuses-'));
  const root=join(directory,'Root');
  for (const path of ['Clients/Acme/App','Clients/Other/Acme/Tool','Work/Urgent/App','Plain/App']) mkdirSync(join(root,path),{recursive:true});
  const app=openSettingsService(join(directory,'data','workspace.sqlite'));
  try {
    const workspace=value(app.handleCommand({type:'workspace.create',name:'Workspace',rootPath:root,initialize:'status'}));
    const roles=[{relativePath:'Clients',role:'group'},{relativePath:'Clients/Acme',role:'status'},
      {relativePath:'Clients/Other',role:'group'},{relativePath:'Clients/Other/Acme',role:'status'},
      {relativePath:'Work/Urgent',role:'status'},{relativePath:'Plain',role:'group'}];
    const apply=(folderRoles)=>{
      const preview=value(app.handleQuery({type:'workspace.previewDiscovery',workspaceId:workspace.workspaceId,folderRoles}));
      return value(app.handleCommand({type:'workspace.applyDiscovery',workspaceId:workspace.workspaceId,previewToken:preview.previewToken}));
    };
    const after=apply(roles);
    assert.deepEqual(after.projects.map(project=>project.relativePath).sort(),['Clients/Acme/App','Clients/Other/Acme/Tool','Plain/App','Work/Urgent/App']);
    const status=path=>after.categories.find(category=>category.categoryId===after.projects.find(project=>project.relativePath===path).categoryId)?.relativePath ?? null;
    assert.equal(status('Clients/Acme/App'),'Clients/Acme');
    assert.equal(status('Clients/Other/Acme/Tool'),'Clients/Other/Acme');
    assert.equal(status('Work/Urgent/App'),'Work/Urgent');
    assert.equal(after.categories.find(category=>category.relativePath==='Work/Urgent').name,'Urgent');
    assert.equal(status('Plain/App'),null);
    const changed=apply(roles.map(row=>row.relativePath==='Clients'?{...row,role:'status'}:row));
    assert.deepEqual(changed.projects.map(project=>[project.projectId,project.categoryId]),after.projects.map(project=>[project.projectId,project.categoryId]));
  } finally {app.close();rmSync(directory,{recursive:true,force:true});}
});

test('deep exclusion review retains values and independent sibling views, and rejects stale Apply', () => {
  const directory=mkdtempSync(join(tmpdir(),'folder-exclusions-'));
  const root=join(directory,'Root');mkdirSync(join(root,'Clients','Acme','App'),{recursive:true});
  const app=openSettingsService(join(directory,'data','workspace.sqlite'));
  try {
    const first=value(app.handleCommand({type:'workspace.create',name:'First',rootPath:root,initialize:'status'}));
    const sibling=value(app.handleCommand({type:'workspace.create',name:'Sibling',rootPath:root,initialize:'status'}));
    const roles=[{relativePath:'Clients',role:'group'},{relativePath:'Clients/Acme',role:'status'}];
    const review=value(app.handleQuery({type:'workspace.previewDiscovery',workspaceId:first.workspaceId,folderRoles:roles}));
    const projects=value(app.handleCommand({type:'workspace.applyDiscovery',workspaceId:first.workspaceId,previewToken:review.previewToken}));
    const project=projects.projects[0];
    const property=value(app.handleCommand({type:'workspace.createProperty',workspaceId:first.workspaceId,name:'Notes',propertyType:'text'}));
    value(app.handleCommand({type:'workspace.setTextValue',workspaceId:first.workspaceId,projectId:project.projectId,propertyId:property.propertyId,value:'Keep me'}));
    value(app.handleCommand({type:'workspace.setViewGrouping',workspaceId:sibling.workspaceId,viewId:sibling.viewId,config:{propertyId:null,settings:[]}}));
    const excluded=value(app.handleQuery({type:'workspace.previewDiscovery',workspaceId:first.workspaceId,excludedRelativePaths:['Clients/Acme/App']}));
    assert.deepEqual(excluded.affectedWorkspaces.map(workspace=>workspace.name),['First','Sibling']);
    assert.equal(excluded.projectEffects.noLongerRecognized[0].projectId,project.projectId);
    const applied=value(app.handleCommand({type:'workspace.applyDiscovery',workspaceId:first.workspaceId,previewToken:excluded.previewToken}));
    assert.equal(applied.retainedProjects.some(row=>row.projectId===project.projectId),true);
    assert.equal(value(app.handleQuery({type:'workspace.listTextProperties',workspaceId:sibling.workspaceId})).values[0].value,'Keep me');
    assert.equal(value(app.handleQuery({type:'workspace.getViewGrouping',workspaceId:sibling.workspaceId,viewId:sibling.viewId})).config.propertyId,null);
    const restored=value(app.handleQuery({type:'workspace.previewDiscovery',workspaceId:first.workspaceId,excludedRelativePaths:[]}));
    mkdirSync(join(root,'Clients','Acme','Other'));
    assert.equal(app.handleCommand({type:'workspace.applyDiscovery',workspaceId:first.workspaceId,previewToken:restored.previewToken}).error.code,'stale_preview');
  } finally {app.close();rmSync(directory,{recursive:true,force:true});}
});

test('settings can explicitly inspect below a project without enrolling its contents', () => {
  const directory=mkdtempSync(join(tmpdir(),'folder-tree-'));
  const root=join(directory,'Root');mkdirSync(join(root,'Work','Project','Inner'),{recursive:true});
  const app=openSettingsService(join(directory,'data','workspace.sqlite'));
  try {
    const workspace=value(app.handleCommand({type:'workspace.create',name:'Workspace',rootPath:root,initialize:'status'}));
    const before=value(app.handleQuery({type:'workspace.listProjects',workspaceId:workspace.workspaceId}));
    const tree=value(app.handleQuery({type:'workspace.getFolderChildren',workspaceId:workspace.workspaceId,parentRelativePath:'Work/Project'}));
    assert.deepEqual(tree.children.map(row=>[row.relativePath,row.role]),[['Work/Project/Inner','project']]);
    assert.deepEqual(value(app.handleQuery({type:'workspace.listProjects',workspaceId:workspace.workspaceId})).projects,before.projects);
    assert.equal(app.handleQuery({type:'workspace.getFolderChildren',workspaceId:workspace.workspaceId,parentRelativePath:'../outside'}).ok,false);
  } finally {app.close();rmSync(directory,{recursive:true,force:true});}
});

test('stored view projection includes active projects with no status', () => {
  const directory=mkdtempSync(join(tmpdir(),'folder-view-'));const root=join(directory,'Root');mkdirSync(join(root,'Clients','App'),{recursive:true});
  const app=openSettingsService(join(directory,'data','workspace.sqlite'));
  try {
    const workspace=value(app.handleCommand({type:'workspace.create',name:'Workspace',rootPath:root,initialize:'status'}));
    const preview=value(app.handleQuery({type:'workspace.previewDiscovery',workspaceId:workspace.workspaceId,folderRoles:[{relativePath:'Clients',role:'group'}]}));
    const list=value(app.handleCommand({type:'workspace.applyDiscovery',workspaceId:workspace.workspaceId,previewToken:preview.previewToken}));
    const query=value(app.handleQuery({type:'workspace.queryView',workspaceId:workspace.workspaceId,viewId:workspace.viewId,archived:false,
      projection:{revision:list.revision,projectIds:list.projects.map(project=>project.projectId)}}));
    assert.equal(query.projectIds.includes(list.projects[0].projectId),true);
    assert.equal(query.groups.find(group=>group.value===null).projectIds.includes(list.projects[0].projectId),true);
  }finally{app.close();rmSync(directory,{recursive:true,force:true});}
});

test('reinterpreting a legacy direct source retains the former project and its values', () => {
  const directory=mkdtempSync(join(tmpdir(),'folder-direct-'));const root=join(directory,'Root');mkdirSync(join(root,'Work','App'),{recursive:true});
  const app=openSettingsService(join(directory,'data','workspace.sqlite'));
  try {
    const workspace=value(app.handleCommand({type:'workspace.create',name:'Workspace',rootPath:root}));
    const direct=value(app.handleQuery({type:'workspace.previewDiscovery',workspaceId:workspace.workspaceId,mode:'direct'}));
    const before=value(app.handleCommand({type:'workspace.applyDiscovery',workspaceId:workspace.workspaceId,previewToken:direct.previewToken}));
    const project=before.projects[0];
    const property=value(app.handleCommand({type:'workspace.createProperty',workspaceId:workspace.workspaceId,name:'Notes',propertyType:'text'}));
    value(app.handleCommand({type:'workspace.setTextValue',workspaceId:workspace.workspaceId,projectId:project.projectId,propertyId:property.propertyId,value:'Original metadata'}));
    const preview=value(app.handleQuery({type:'workspace.previewDiscovery',workspaceId:workspace.workspaceId,folderRoles:[{relativePath:'Work',role:'status'}]}));
    const after=value(app.handleCommand({type:'workspace.applyDiscovery',workspaceId:workspace.workspaceId,previewToken:preview.previewToken}));
    assert.equal(after.projects[0].relativePath,'Work/App');
    assert.equal(after.categories.find(category=>category.categoryId===after.projects[0].categoryId)?.relativePath,'Work');
    assert.ok(after.categoryProperty);assert.notEqual(after.projects[0].projectId,project.projectId);
    assert.equal(after.retainedProjects.some(row=>row.projectId===project.projectId),true);
    assert.equal(value(app.handleQuery({type:'workspace.listTextProperties',workspaceId:workspace.workspaceId})).values.find(row=>row.projectId===project.projectId).value,'Original metadata');
  }finally{app.close();rmSync(directory,{recursive:true,force:true});}
});

test('application-data export and restore preserve role configuration and project references', () => {
  const directory=mkdtempSync(join(tmpdir(),'folder-backup-'));const root=join(directory,'Root');mkdirSync(join(root,'Clients','App'),{recursive:true});
  const app=openSettingsService(join(directory,'data','workspace.sqlite'));
  try {
    const workspace=value(app.handleCommand({type:'workspace.create',name:'Workspace',rootPath:root,initialize:'status'}));
    const preview=value(app.handleQuery({type:'workspace.previewDiscovery',workspaceId:workspace.workspaceId,folderRoles:[{relativePath:'Clients',role:'group'}]}));
    const before=value(app.handleCommand({type:'workspace.applyDiscovery',workspaceId:workspace.workspaceId,previewToken:preview.previewToken}));
    const exported=value(app.handleQuery({type:'data.export'}));
    value(app.handleCommand({type:'data.restore',content:exported.content}));
    const after=value(app.handleQuery({type:'workspace.listProjects',workspaceId:workspace.workspaceId}));
    assert.deepEqual(after.projects,before.projects);
    assert.deepEqual(value(app.handleQuery({type:'workspace.getFolderChildren',workspaceId:workspace.workspaceId,parentRelativePath:''})).folderRoles,[{relativePath:'Clients',role:'group'}]);
  }finally{app.close();rmSync(directory,{recursive:true,force:true});}
});

test('a no-status nested project keeps its file-tree access after role reinterpretation', () => {
  const directory=mkdtempSync(join(tmpdir(),'folder-files-'));const root=join(directory,'Root');mkdirSync(join(root,'Clients','Team','App','Documents'),{recursive:true});
  const app=openSettingsService(join(directory,'data','workspace.sqlite'));
  try{
    const workspace=value(app.handleCommand({type:'workspace.create',name:'Workspace',rootPath:root,initialize:'status'}));
    const preview=value(app.handleQuery({type:'workspace.previewDiscovery',workspaceId:workspace.workspaceId,folderRoles:[{relativePath:'Clients',role:'group'},{relativePath:'Clients/Team',role:'group'}]}));
    const list=value(app.handleCommand({type:'workspace.applyDiscovery',workspaceId:workspace.workspaceId,previewToken:preview.previewToken}));
    const files=value(app.handleQuery({type:'workspace.listProjectFiles',workspaceId:workspace.workspaceId,projectId:list.projects[0].projectId,relativePath:''}));
    assert.equal(files.outcome,'listed');assert.deepEqual(files.entries.map(entry=>entry.name),['Documents']);
  }finally{app.close();rmSync(directory,{recursive:true,force:true});}
});

test('a replaced status ancestor cannot silently reattach its existing project metadata', async () => {
  const {renameSync}=await import('node:fs');
  const directory=mkdtempSync(join(tmpdir(),'folder-parent-'));const root=join(directory,'Root');mkdirSync(join(root,'Clients','Acme','App'),{recursive:true});
  const app=openSettingsService(join(directory,'data','workspace.sqlite'));
  try{
    const workspace=value(app.handleCommand({type:'workspace.create',name:'Workspace',rootPath:root,initialize:'status'}));
    const roles=[{relativePath:'Clients',role:'group'},{relativePath:'Clients/Acme',role:'status'}];
    const preview=value(app.handleQuery({type:'workspace.previewDiscovery',workspaceId:workspace.workspaceId,folderRoles:roles}));
    const before=value(app.handleCommand({type:'workspace.applyDiscovery',workspaceId:workspace.workspaceId,previewToken:preview.previewToken}));
    const project=before.projects[0];
    renameSync(join(root,'Clients','Acme'),join(directory,'OldAcme'));
    mkdirSync(join(root,'Clients','Acme'));renameSync(join(directory,'OldAcme','App'),join(root,'Clients','Acme','App'));
    const after=value(app.handleQuery({type:'workspace.listProjects',workspaceId:workspace.workspaceId}));
    assert.equal(after.projects.some(row=>row.projectId===project.projectId),false);
    assert.equal(after.retainedProjects.some(row=>row.projectId===project.projectId),true);
  }finally{app.close();rmSync(directory,{recursive:true,force:true});}
});

test('a shared-ownership change invalidates the reviewed configuration', () => {
  const directory=mkdtempSync(join(tmpdir(),'folder-owners-'));const root=join(directory,'Root');mkdirSync(join(root,'Work','App'),{recursive:true});
  const app=openSettingsService(join(directory,'data','workspace.sqlite'));
  try{
    const workspace=value(app.handleCommand({type:'workspace.create',name:'First',rootPath:root,initialize:'status'}));
    const review=value(app.handleQuery({type:'workspace.previewDiscovery',workspaceId:workspace.workspaceId,folderRoles:[{relativePath:'Work',role:'group'}]}));
    value(app.handleCommand({type:'workspace.create',name:'New affected workspace',rootPath:root,initialize:'status'}));
    const applied=app.handleCommand({type:'workspace.applyDiscovery',workspaceId:workspace.workspaceId,previewToken:review.previewToken});
    assert.equal(applied.ok,false);assert.equal(applied.error.code,'stale_preview');
    assert.equal(value(app.handleQuery({type:'workspace.listProjects',workspaceId:workspace.workspaceId})).projects[0].categoryId!==null,true);
  }finally{app.close();rmSync(directory,{recursive:true,force:true});}
});

for(const folderRoles of [null,[{relativePath:'../outside',role:'group'}],[{relativePath:'/outside',role:'status'}],[{relativePath:'Work',role:'unknown'}],[{relativePath:'Work',role:'group'},{relativePath:'Work',role:'status'}]])test(`invalid role configuration is rejected without changing saved projects: ${JSON.stringify(folderRoles)}`,()=>{
  const directory=mkdtempSync(join(tmpdir(),'folder-invalid-'));const root=join(directory,'Root');mkdirSync(join(root,'Work','App'),{recursive:true});
  const app=openSettingsService(join(directory,'data','workspace.sqlite'));
  try{
    const workspace=value(app.handleCommand({type:'workspace.create',name:'First',rootPath:root,initialize:'status'}));
    const before=value(app.handleQuery({type:'workspace.listProjects',workspaceId:workspace.workspaceId}));
    const result=app.handleQuery({type:'workspace.previewDiscovery',workspaceId:workspace.workspaceId,folderRoles});
    assert.equal(result.ok,false);assert.equal(result.error.code,'invalid_input');
    assert.deepEqual(value(app.handleQuery({type:'workspace.listProjects',workspaceId:workspace.workspaceId})).projects,before.projects);
  }finally{app.close();rmSync(directory,{recursive:true,force:true});}
});
