import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openSettingsService } from '../dist/service/settings.mjs';
function fixture(run, mode = 'direct') {
  const directory = mkdtempSync(join(tmpdir(), 'table-layout-')), root = join(directory, 'root'); mkdirSync(root);
  for (const name of ['Alpha','Beta','Gamma']) { mkdirSync(join(root,name)); if(mode==='grouped' && name!=='Gamma') mkdirSync(join(root,name,'Project')); }
  const path = join(directory,'app.sqlite'); let service = openSettingsService(path);
  const workspace = service.handleCommand({type:'workspace.create',rootPath:root,name:'One'}).value;
  const command = (type,fields={}) => service.handleCommand({type:`workspace.${type}`,workspaceId:workspace.workspaceId,...fields});
  const query = (type,fields={}) => service.handleQuery({type:`workspace.${type}`,workspaceId:workspace.workspaceId,...fields});
  command('applyDiscovery',{previewToken:query('previewDiscovery',{mode}).value.previewToken});
  try { run({workspace,command,query,root,path,serviceSubscribe:listener=>service.workspaces.subscribe(listener),reopen(){service.close();service=openSettingsService(path);}}); }
  finally { service.close();rmSync(directory,{recursive:true,force:true}); }
}

test('Table layout and logical row order survive reopening without changing values',()=>fixture(f=>{
  const {viewId}=f.workspace;
  const projects=f.query('listProjects').value.projects;
  const propertyId=f.command('createProperty',{name:'Notes',propertyType:'text'}).value.propertyId;
  f.command('setTextValue',{projectId:projects[0].projectId,propertyId,value:'Keep exact\ntext'});
  const config={columns:[{propertyId,hidden:true,width:320,wrap:true},{propertyId:'name',hidden:false,width:250,wrap:false}],rowOrder:projects.map(p=>p.projectId).reverse()};
  assert.equal(f.command('setTableLayout',{viewId,config}).ok,true);
  f.reopen();
  assert.deepEqual(f.query('getTableLayout',{viewId}).value.config,config);
  assert.deepEqual(f.query('queryView',{viewId,archived:false}).value.projectIds,config.rowOrder);
  assert.equal(f.query('listTextProperties').value.values[0].value,'Keep exact\ntext');
}));

test('duplicate and sibling layouts diverge, foreign references and malformed settings reject atomically',async()=>{
  const {randomUUID}=await import('node:crypto');
  fixture(f=>{
    const {viewId}=f.workspace,ids=f.query('listProjects').value.projects.map(p=>p.projectId);
    const propertyId=f.command('createProperty',{name:'Score',propertyType:'number'}).value.propertyId;
    const config={columns:[{propertyId:'name',hidden:false,width:180,wrap:false},{propertyId,hidden:true,width:400,wrap:false}],rowOrder:[ids[2],ids[0],ids[1]]};
    assert.equal(f.command('setTableLayout',{viewId,config}).ok,true);
    const copy=f.command('duplicateView',{viewId,name:'Copy'}).value.activeViewId;
    assert.deepEqual(f.query('getTableLayout',{viewId:copy}).value.config,config);
    assert.equal(f.command('setTableLayout',{viewId:copy,config:{columns:[],rowOrder:[]}}).ok,true);
    const sibling=f.command('create',{rootPath:f.root,name:'Sibling'}).value;
    assert.deepEqual(f.query('getTableLayout',{workspaceId:sibling.workspaceId,viewId:sibling.viewId}).value.config,{columns:[],rowOrder:[]});
    const events=[],stop=f.serviceSubscribe(event=>events.push(event));
    for(const patch of [
      {workspaceId:sibling.workspaceId}, {viewId:randomUUID()},
      {config:{...config,rowOrder:[ids[0],ids[0]]}}, {config:{...config,rowOrder:[randomUUID()]}},
      {config:{...config,columns:[{...config.columns[0],hidden:true}]}},
      {config:{...config,columns:[{...config.columns[0],width:119}]}},
      {config:{...config,columns:[{...config.columns[0],width:801}]}},
      {config:{...config,columns:[{...config.columns[1],wrap:true}]}},
      {config:{...config,columns:[{...config.columns[0],propertyId:randomUUID()}]}},
      {config:{...config,extra:true}}, {extra:true}
    ]) assert.equal(f.command('setTableLayout',{viewId,config,...patch}).error.code,'invalid_input');
    stop(); assert.deepEqual(events,[]);
    f.reopen();assert.deepEqual(f.query('getTableLayout',{viewId}).value.config,config);
    assert.deepEqual(f.query('getTableLayout',{viewId:copy}).value.config,{columns:[],rowOrder:[]});
  });
});

test('missing and filtered projects retain identity positions, new discovery appends and groups reuse order',()=>fixture(f=>{
  const {viewId}=f.workspace,projects=f.query('listProjects').value.projects;
  const alpha=projects.find(p=>p.name==='Alpha').projectId,beta=projects.find(p=>p.name==='Beta').projectId,gamma=projects.find(p=>p.name==='Gamma').projectId;
  const config={columns:[],rowOrder:[gamma,alpha,beta]};
  f.command('setTableLayout',{viewId,config});
  mkdirSync(join(f.root,'A-new'));
  f.command('applyDiscovery',{previewToken:f.query('previewDiscovery').value.previewToken});
  const added=f.query('listProjects').value.projects.find(p=>p.name==='A-new').projectId;
  rmSync(join(f.root,'Alpha'),{recursive:true});
  f.command('refreshSource');
  const projection=()=>f.query('queryView',{viewId,archived:false}).value;
  assert.deepEqual(projection().projectIds,[gamma,alpha,beta,added]);
  f.command('setViewFilter',{viewId,config:{search:'Beta',rules:[]}});
  assert.deepEqual(projection().projectIds,[beta]);
  assert.deepEqual(f.query('getTableLayout',{viewId}).value.config,config);
  f.command('setViewFilter',{viewId,config:{search:'',rules:[]}});
  const propertyId=f.command('createProperty',{name:'Tags',propertyType:'multi_select'}).value.propertyId;
  const optionId=f.command('createSelectOption',{propertyId,name:'All',color:'default'}).value.snapshot.selectOptions[0].optionId;
  for(const projectId of [alpha,beta,gamma])assert.equal(f.command('setMultiSelectValue',{propertyId,projectId,optionIds:[optionId]}).ok,true);
  f.command('setViewGrouping',{viewId,config:{propertyId,settings:[]}});
  assert.deepEqual(projection().groups.find(g=>g.value===optionId).projectIds,[gamma,alpha,beta]);
  f.reopen();assert.deepEqual(projection().projectIds,[gamma,alpha,beta,added]);
}));

test('layout migration retains populated views, values, filters and grouping; storage failures emit no commit',async()=>{
  const {default:Database}=await import('better-sqlite3');
  fixture(f=>{
    const {viewId}=f.workspace;
    const propertyId=f.command('createProperty',{name:'Note',propertyType:'text'}).value.propertyId;
    const projectId=f.query('listProjects').value.projects[0].projectId;
    f.command('setTextValue',{projectId,propertyId,value:'  Exact\nText  '});
    f.command('setViewFilter',{viewId,config:{search:'Alpha',rules:[]}});
    f.command('setViewGrouping',{viewId,config:{propertyId,settings:[]}});
    const properties=f.query('listTextProperties'),views=f.query('listViews'),projection=f.query('queryView',{viewId,archived:false});
    const db=new Database(f.path);
    try {db.exec('ALTER TABLE sources DROP COLUMN durable_evidence; ALTER TABLE sources DROP COLUMN evidence_generation; ALTER TABLE categories DROP COLUMN durable_evidence; ALTER TABLE projects DROP COLUMN durable_evidence; DROP TRIGGER initialize_workspace_session; DROP TRIGGER remove_view_session_preview; DROP TABLE workspace_sessions; ALTER TABLE views DROP COLUMN board_config; ALTER TABLE views DROP COLUMN table_config; DELETE FROM __drizzle_migrations WHERE created_at>=1791504021000');}finally{db.close();}
    f.reopen();
    assert.deepEqual(f.query('listTextProperties'),properties);assert.deepEqual(f.query('listViews'),views);assert.deepEqual(f.query('queryView',{viewId,archived:false}),projection);
    assert.deepEqual(f.query('getTableLayout',{viewId}).value.config,{columns:[],rowOrder:[]});
    const sql=new Database(f.path),events=[],stop=f.serviceSubscribe(event=>events.push(event));
    try {
      sql.exec("CREATE TRIGGER layout_failure BEFORE UPDATE OF table_config ON views BEGIN SELECT RAISE(ABORT,'injected'); END");
      assert.equal(f.command('setTableLayout',{viewId,config:{columns:[],rowOrder:[projectId]}}).error.code,'storage');
      assert.deepEqual(events,[]);assert.deepEqual(f.query('getTableLayout',{viewId}).value.config,{columns:[],rowOrder:[]});
      sql.exec('DROP TRIGGER layout_failure');sql.prepare('UPDATE views SET table_config=? WHERE id=?').run('{bad',viewId);
      assert.equal(f.query('getTableLayout',{viewId}).error.code,'storage');
      assert.equal(f.command('setTableLayout',{viewId,config:{columns:[],rowOrder:[]}}).ok,true);
      assert.equal(events.length,1);
    }finally{stop();sql.close();}
  });
});

test('archive and restoration retain the same ordered project identity and metadata',async()=>{
  const {randomUUID}=await import('node:crypto');
  fixture(f=>{
    const {viewId}=f.workspace,projects=f.query('listProjects').value.projects;
    const ids=projects.map(p=>p.projectId).reverse(),projectId=ids[0];
    f.command('setTableLayout',{viewId,config:{columns:[],rowOrder:ids}});
    const location=f.query('previewArchiveLocation',{relativePath:'Archive'}).value;
    f.command('applyArchiveLocation',{operationId:randomUUID(),previewToken:location.previewToken});
    const archive=f.query('previewProjectArchive',{projectId,action:'archive',name:null,createParent:false});
    assert.equal(f.command('applyProjectArchive',{operationId:randomUUID(),previewToken:archive.value.previewToken}).value.operation.stage,'completed');
    assert.deepEqual(f.query('queryView',{viewId,archived:false}).value.projectIds,ids.slice(1));
    f.reopen();assert.deepEqual(f.query('queryView',{viewId,archived:true}).value.projectIds,[projectId]);
    const restore=f.query('previewProjectArchive',{projectId,action:'restore',name:null,createParent:false});
    assert.equal(f.command('applyProjectArchive',{operationId:randomUUID(),previewToken:restore.value.previewToken}).value.operation.stage,'completed');
    assert.deepEqual(f.query('queryView',{viewId,archived:false}).value.projectIds,ids);
  });
});


test('Board ignores corrupt unused Table settings while Table requires explicit repair',async()=>{
  const {default:Database}=await import('better-sqlite3');
  fixture(f=>{
    const {viewId}=f.workspace;
    f.command('setViewLayout',{viewId,kind:'board'});
    const expected=f.query('queryView',{viewId,archived:false});assert.equal(expected.ok,true);
    const sql=new Database(f.path);try{sql.prepare('UPDATE views SET table_config=? WHERE id=?').run('{bad',viewId);}finally{sql.close();}
    assert.deepEqual(f.query('queryView',{viewId,archived:false}),expected);
    f.command('setViewLayout',{viewId,kind:'table'});
    assert.equal(f.query('queryView',{viewId,archived:false}).error.code,'storage');
    assert.equal(f.command('setTableLayout',{viewId,config:{columns:[],rowOrder:[]}}).ok,true);
    assert.equal(f.query('queryView',{viewId,archived:false}).ok,true);
  });
});
