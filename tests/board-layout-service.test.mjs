import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openSettingsService } from '../dist/service/settings.mjs';
function fixture(run, mode = 'direct') {
  const directory = mkdtempSync(join(tmpdir(), 'board-layout-')), root = join(directory, 'root'); mkdirSync(root);
  for (const name of ['Alpha','Beta','Gamma']) { mkdirSync(join(root,name)); if(mode==='grouped' && name!=='Gamma') mkdirSync(join(root,name,'Project')); }
  const path = join(directory,'app.sqlite'); let service = openSettingsService(path);
  const workspace = service.handleCommand({type:'workspace.create',rootPath:root,name:'One'}).value;
  const command = (type,fields={}) => service.handleCommand({type:`workspace.${type}`,workspaceId:workspace.workspaceId,...fields});
  const query = (type,fields={}) => service.handleQuery({type:`workspace.${type}`,workspaceId:workspace.workspaceId,...fields});
  command('applyDiscovery',{previewToken:query('previewDiscovery',{mode}).value.previewToken});
  try { run({workspace,command,query,root,path,serviceSubscribe:listener=>service.workspaces.subscribe(listener),reopen(){service.close();service=openSettingsService(path);}}); }
  finally { service.close();rmSync(directory,{recursive:true,force:true}); }
}

test('Board widths and card presentation survive reopen without changing source data',()=>fixture(f=>{
  const {viewId}=f.workspace;
  f.command('setViewLayout',{viewId,kind:'board'});
  const propertyId=f.command('createProperty',{name:'Notes',propertyType:'text'}).value.propertyId;
  const projectId=f.query('listProjects').value.projects[0].projectId;
  f.command('setTextValue',{projectId,propertyId,value:'  Exact\ntext  '});
  f.command('setViewGrouping',{viewId,config:{propertyId:'name',settings:[]}});
  const before=f.query('listTextProperties');
  const config={widths:[{propertyId:'name',key:'"Alpha"',width:280}],properties:[{propertyId,hidden:true}],wrap:false};
  assert.equal(f.command('setBoardLayout',{viewId,config}).ok,true);
  f.reopen();
  assert.deepEqual(f.query('getBoardLayout',{viewId}).value.config,config);
  assert.deepEqual(f.query('listTextProperties'),before);
  assert.equal(f.query('queryView',{viewId,archived:false}).value.groups[0].key,'"Alpha"');
}));

test('stable option keys, new groups, filters and independent duplicates retain Board settings',()=>fixture(f=>{
  const {viewId}=f.workspace;
  f.command('setViewLayout',{viewId,kind:'board'});
  const propertyId=f.command('createProperty',{name:'Tags',propertyType:'multi_select'}).value.propertyId;
  const optionId=f.command('createSelectOption',{propertyId,name:'A',color:'default'}).value.snapshot.selectOptions[0].optionId;
  const projectId=f.query('listProjects').value.projects[0].projectId;
  f.command('setMultiSelectValue',{propertyId,projectId,optionIds:[optionId]});
  const key=JSON.stringify(optionId),grouping={propertyId,settings:[{propertyId,order:'manual',manualOrder:[key,'null'],hidden:[key],collapsed:['null'],hideEmpty:false}]};
  f.command('setViewGrouping',{viewId,config:grouping});
  const config={widths:[{propertyId,key,width:800}],properties:[{propertyId,hidden:true}],wrap:false};
  assert.equal(f.command('setBoardLayout',{viewId,config}).ok,true);
  const before=f.query('listTextProperties');
  const copy=f.command('duplicateView',{viewId,name:'Copy'}).value.activeViewId;
  assert.deepEqual(f.query('getBoardLayout',{viewId:copy}).value.config,config);
  assert.deepEqual(f.query('getViewGrouping',{viewId:copy}).value.config,grouping);
  f.command('setBoardLayout',{viewId:copy,config:{widths:[],properties:[],wrap:true}});
  f.command('setViewGrouping',{viewId:copy,config:{propertyId:null,settings:[]}});
  assert.deepEqual(f.query('listTextProperties'),before);
  assert.equal(f.command('updateSelectOption',{propertyId,optionId,name:'Renamed',color:'blue'}).ok,true);
  const added=f.command('createSelectOption',{propertyId,name:'New',color:'default'}).value.snapshot.selectOptions.find(o=>o.name==='New').optionId;
  f.command('setViewFilter',{viewId,config:{search:'no matches',rules:[]}});
  const groups=f.query('queryView',{viewId,archived:false}).value.groups;
  assert.deepEqual(groups.map(g=>g.key),[key,'null',JSON.stringify(added)]);
  assert.equal(groups[0].label,'Renamed');assert.equal(groups[0].hidden,true);assert.equal(groups[1].collapsed,true);
  assert.ok(groups.every(g=>g.empty));
  const sibling=f.command('create',{rootPath:f.root,name:'Sibling'}).value;
  assert.deepEqual(f.query('getBoardLayout',{workspaceId:sibling.workspaceId,viewId:sibling.viewId}).value.config,{widths:[],properties:[],wrap:true});
  assert.deepEqual(f.query('getTableLayout',{viewId}).value.config,{columns:[],rowOrder:[]});
  f.command('setViewLayout',{viewId,kind:'table'});
  f.reopen();assert.deepEqual(f.query('getBoardLayout',{viewId}).value.config,config);
  assert.deepEqual(f.query('getBoardLayout',{viewId:copy}).value.config,{widths:[],properties:[],wrap:true});
}));

test('Board rejects malformed, foreign and wrong-type keys without writes or notifications',async()=>{
  const {randomUUID}=await import('node:crypto');
  fixture(f=>{
    const {viewId}=f.workspace;
    const propertyId=f.command('createProperty',{name:'Score',propertyType:'number'}).value.propertyId;
    const foreign=f.command('create',{rootPath:f.root,name:'Sibling'}).value;
    const config={widths:[{propertyId,key:'10',width:180}],properties:[{propertyId,hidden:true}],wrap:true};
    assert.equal(f.command('setBoardLayout',{viewId,config}).ok,true);
    const events=[],stop=f.serviceSubscribe(e=>events.push(e));
    for(const patch of [
      {workspaceId:foreign.workspaceId},{viewId:randomUUID()},{extra:true},
      {config:{...config,wrap:'false'}},{config:{...config,extra:true}},
      {config:{...config,widths:[{propertyId,key:'10',width:179}]}},
      {config:{...config,widths:[{propertyId,key:'10',width:801}]}},
      {config:{...config,widths:[{propertyId,key:'10',width:200.5}]}},
      {config:{...config,widths:[...config.widths,...config.widths]}},
      {config:{...config,widths:[{propertyId,key:'"10"',width:200}]}},
      {config:{...config,widths:[{propertyId:'name',key:'null',width:200}]}},
      {config:{...config,widths:[{propertyId:randomUUID(),key:'null',width:200}]}},
      {config:{...config,widths:[{propertyId,key:' 10',width:200}]}},
      {config:{...config,properties:[{propertyId:randomUUID(),hidden:false}]}},
      {config:{...config,properties:[{propertyId:'name',hidden:true}]}},
      {config:{...config,properties:[...config.properties,...config.properties]}}
    ]) assert.equal(f.command('setBoardLayout',{viewId,config,...patch}).error.code,'invalid_input');
    stop();assert.deepEqual(events,[]);
    assert.deepEqual(f.query('getBoardLayout',{viewId}).value.config,config);
  });
});

test('category rename and discovery mode roundtrip keep stable Board column settings',async()=>{
  const {randomUUID}=await import('node:crypto');
  fixture(f=>{
    const {viewId}=f.workspace,initial=f.query('listProjects').value;
    const propertyId=initial.categoryProperty.propertyId,categoryId=initial.projects[0].categoryId;
    const config={widths:[{propertyId,key:JSON.stringify(categoryId),width:360}],properties:[{propertyId,hidden:true}],wrap:false};
    f.command('setViewLayout',{viewId,kind:'board'});
    f.command('setViewGrouping',{viewId,config:{propertyId,settings:[]}});
    assert.equal(f.command('setBoardLayout',{viewId,config}).ok,true);
    const preview=f.query('previewCategoryFolder',{action:'rename',categoryId,name:'Renamed'}).value;
    assert.equal(f.command('applyCategoryFolder',{operationId:randomUUID(),previewToken:preview.previewToken}).ok,true);
    assert.equal(f.query('queryView',{viewId,archived:false}).value.groups.find(g=>g.key===JSON.stringify(categoryId)).label,'Renamed');
    assert.deepEqual(f.query('getBoardLayout',{viewId}).value.config,config);
    f.command('setViewGrouping',{viewId,config:{propertyId:null,settings:[]}});
    assert.equal(f.command('applyDiscovery',{previewToken:f.query('previewDiscovery',{mode:'direct'}).value.previewToken}).ok,true);
    assert.equal(f.command('setBoardLayout',{viewId,config:{...config,wrap:true}}).ok,true);
    assert.equal(f.command('applyDiscovery',{previewToken:f.query('previewDiscovery',{mode:'grouped'}).value.previewToken}).ok,true);
    f.reopen();assert.deepEqual(f.query('getBoardLayout',{viewId}).value.config,{...config,wrap:true});
  },'grouped');
});

test('populated upgrade preserves Table, filters, grouping and values; storage errors require explicit repair',async()=>{
  const {default:Database}=await import('better-sqlite3');
  fixture(f=>{
    const {viewId}=f.workspace;
    const projectId=f.query('listProjects').value.projects[0].projectId;
    const propertyId=f.command('createProperty',{name:'Notes',propertyType:'text'}).value.propertyId;
    f.command('setTextValue',{projectId,propertyId,value:'Preserve exact\nvalue'});
    f.command('setTableLayout',{viewId,config:{columns:[],rowOrder:[projectId]}});
    f.command('setViewFilter',{viewId,config:{search:'Alpha',rules:[]}});
    f.command('setViewGrouping',{viewId,config:{propertyId:'name',settings:[]}});
    const before=['listViews','listTextProperties','getTableLayout','getViewGrouping','queryView'].map(type=>f.query(type,{...(['listViews','listTextProperties'].includes(type)?{}:{viewId}),...(type==='queryView'?{archived:false}:{})}));
    const db=new Database(f.path);try{db.exec('DROP TRIGGER initialize_workspace_session; DROP TRIGGER remove_view_session_preview; DROP TABLE workspace_sessions; ALTER TABLE views DROP COLUMN board_config; DELETE FROM __drizzle_migrations WHERE created_at>=1791504022000');}finally{db.close();}
    f.reopen();
    assert.deepEqual(['listViews','listTextProperties','getTableLayout','getViewGrouping','queryView'].map(type=>f.query(type,{...(['listViews','listTextProperties'].includes(type)?{}:{viewId}),...(type==='queryView'?{archived:false}:{})})),before);
    const empty={widths:[],properties:[],wrap:true};assert.deepEqual(f.query('getBoardLayout',{viewId}).value.config,empty);
    const sql=new Database(f.path),events=[],stop=f.serviceSubscribe(e=>events.push(e));
    try{
      sql.exec("CREATE TRIGGER board_failure BEFORE UPDATE OF board_config ON views BEGIN SELECT RAISE(ABORT,'injected'); END");
      assert.equal(f.command('setBoardLayout',{viewId,config:{...empty,wrap:false}}).error.code,'storage');
      assert.deepEqual(events,[]);assert.deepEqual(f.query('getBoardLayout',{viewId}).value.config,empty);
      sql.exec('DROP TRIGGER board_failure');sql.prepare('UPDATE views SET board_config=? WHERE id=?').run('{bad',viewId);
      assert.equal(f.query('getBoardLayout',{viewId}).error.code,'storage');
      assert.equal(f.command('setBoardLayout',{viewId,config:empty}).ok,true);
      assert.equal(events.length,1);
    }finally{stop();sql.close();}
  });
});

test('semantically corrupt saved Board references fail visibly until explicitly reset',async()=>{
  const {default:Database}=await import('better-sqlite3');const {randomUUID}=await import('node:crypto');
  fixture(f=>{
    const {viewId}=f.workspace;
    const propertyId=f.command('createProperty',{name:'Score',propertyType:'number'}).value.propertyId;
    const db=new Database(f.path);
    try{
      for(const config of [
        {widths:[],properties:[{propertyId:randomUUID(),hidden:true}],wrap:true},
        {widths:[{propertyId,key:'"not a number"',width:300}],properties:[],wrap:false},
        {widths:[{propertyId:'name',key:'null',width:300}],properties:[],wrap:true}
      ]){
        db.prepare('UPDATE views SET board_config=? WHERE id=?').run(JSON.stringify(config),viewId);
        assert.equal(f.query('getBoardLayout',{viewId}).error?.code,'storage');
        assert.equal(f.command('setBoardLayout',{viewId,config:{widths:[],properties:[],wrap:true}}).ok,true);
      }
    }finally{db.close();}
  });
});
