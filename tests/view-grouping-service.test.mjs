import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openSettingsService } from '../dist/service/settings.mjs';
function fixture(run) {
  const directory = mkdtempSync(join(tmpdir(), 'grouping-')), root = join(directory, 'root'); mkdirSync(root);
  for (const name of ['Alpha','Beta','Gamma']) mkdirSync(join(root,name));
  const path = join(directory,'app.sqlite'); let service = openSettingsService(path);
  const workspace = service.handleCommand({type:'workspace.create',rootPath:root,name:'One'}).value;
  const command = (type,fields={}) => service.handleCommand({type:`workspace.${type}`,workspaceId:workspace.workspaceId,...fields});
  const query = (type,fields={}) => service.handleQuery({type:`workspace.${type}`,workspaceId:workspace.workspaceId,...fields});
  command('applyDiscovery',{previewToken:query('previewDiscovery').value.previewToken});
  try { run({workspace,command,query,root,path,reopen(){service.close();service=openSettingsService(path);}}); }
  finally { service.close();rmSync(directory,{recursive:true,force:true}); }
}
const config = propertyId => ({propertyId,settings:[]});
test('Name grouping projects through the typed service without changing project identity',()=>fixture(f=>{
  const viewId=f.workspace.viewId;
  assert.equal(f.command('setViewGrouping',{viewId,config:config('name')}).ok,true);
  const result=f.query('queryView',{viewId,archived:false}); assert.equal(result.ok,true);
  assert.deepEqual(result.value.groups.map(g=>g.value),['Alpha','Beta','Gamma']);
  assert.deepEqual(result.value.groups.flatMap(g=>g.projectIds).sort(),result.value.projectIds.toSorted());
}));

test('exact scalar membership, type-aware order, empty values and edits survive reopening',()=>fixture(f=>{
  const {viewId}=f.workspace;
  const projects=f.query('listProjects').value.projects;
  const alpha=projects.find(p=>p.name==='Alpha').projectId, beta=projects.find(p=>p.name==='Beta').projectId;
  const run=()=>f.query('queryView',{viewId,archived:false}).value.groups;
  for(const [type, first, second, expected] of [['text','a','A',['A','a',null]],['number','10','2',[2,10,null]],['date','2024-02-29','2023-12-31',['2023-12-31','2024-02-29',null]]]) {
    const propertyId=f.command('createProperty',{name:type,propertyType:type}).value.propertyId;
    const set=(projectId,value)=>f.command(type==='number'?'setNumberValue':type==='date'?'setDateValue':'setTextValue',{projectId,propertyId,[type==='number'?'expression':'value']:value});
    assert.equal(set(alpha,first).ok,true);assert.equal(set(beta,second).ok,true);
    assert.equal(f.command('setViewGrouping',{viewId,config:config(propertyId)}).ok,true);
    assert.deepEqual(run().map(g=>g.value),expected);
    const setting={propertyId,order:'descending',manualOrder:[],hidden:[],collapsed:[],hideEmpty:false};
    f.command('setViewGrouping',{viewId,config:{propertyId,settings:[setting]}});
    assert.deepEqual(run().map(g=>g.value),[expected[1],expected[0],null]);
    f.reopen();assert.deepEqual(run().map(g=>g.value),[expected[1],expected[0],null]);
    setting.order='manual';setting.manualOrder=['null',JSON.stringify(expected[0])];
    f.command('setViewGrouping',{viewId,config:{propertyId,settings:[setting]}});
    assert.deepEqual(run().map(g=>g.value),[null,...expected.slice(0,2)]);
    assert.equal(set(alpha,null).ok,true); assert.equal(run().find(g=>g.value===null).projectIds.includes(alpha),true);
  }
}));

test('visibility, collapse and hide-empty are per-view presentation independent of filters and duplication',()=>fixture(f=>{
  const {viewId}=f.workspace;
  const propertyId=f.command('createProperty',{name:'Score',propertyType:'number'}).value.propertyId;
  const alpha=f.query('listProjects').value.projects.find(p=>p.name==='Alpha').projectId;
  f.command('setNumberValue',{projectId:alpha,propertyId,expression:'0'});
  const setting={propertyId,order:'manual',manualOrder:['null','0'],hidden:['0'],collapsed:['null'],hideEmpty:false};
  const saved={propertyId,settings:[setting]};
  assert.equal(f.command('setViewGrouping',{viewId,config:saved}).ok,true);
  const result=()=>f.query('queryView',{viewId,archived:false}).value;
  assert.equal(result().groups.find(g=>g.value===0).hidden,true);
  assert.equal(result().groups.find(g=>g.value===null).collapsed,true);
  assert.equal(result().projectIds.length,3);
  const copy=f.command('duplicateView',{viewId,name:'Copy'}).value.activeViewId;
  assert.deepEqual(f.query('getViewGrouping',{viewId:copy}).value.config,saved);
  f.command('setViewGrouping',{viewId:copy,config:config(null)});
  f.command('setViewGrouping',{viewId,config:{...saved,propertyId:'name'}});
  f.command('setViewGrouping',{viewId,config:saved});
  assert.equal(f.command('setViewFilter',{viewId,config:{search:'Beta',rules:[]}}).ok,true);
  assert.deepEqual(result().groups.map(g=>[g.value,g.empty]),[[null,false],[0,true]]);
  assert.equal(f.command('setViewGrouping',{viewId,config:{propertyId,settings:[{...setting,hidden:[],hideEmpty:true}]}}).ok,true);
  assert.equal(result().groups.find(g=>g.value===0).hidden,true);
  f.reopen();assert.equal(result().groups.find(g=>g.value===0).hidden,true);
  assert.equal(f.query('queryView',{viewId:copy,archived:false}).value.groups,undefined);
  const sibling=f.command('create',{rootPath:f.root,name:'Sibling'}).value;
  assert.equal(f.command('setViewGrouping',{workspaceId:sibling.workspaceId,viewId,config:config(null)}).error.code,'invalid_input');
}));

test('Text whitespace is exact, empty merges with missing, and source siblings see value changes',()=>fixture(f=>{
  const {viewId}=f.workspace;
  const propertyId=f.command('createProperty',{name:'Text',propertyType:'text'}).value.propertyId;
  const projects=f.query('listProjects').value.projects;
  const alpha=projects.find(p=>p.name==='Alpha').projectId,beta=projects.find(p=>p.name==='Beta').projectId;
  f.command('setTextValue',{projectId:alpha,propertyId,value:' '});f.command('setTextValue',{projectId:beta,propertyId,value:''});
  f.command('setViewGrouping',{viewId,config:config(propertyId)});
  const groups=()=>f.query('queryView',{viewId,archived:false}).value.groups;
  assert.deepEqual(groups().map(g=>g.value),[' ',null]);assert.equal(groups()[1].projectIds.length,2);
  const sibling=f.command('create',{rootPath:f.root,name:'Sibling'}).value;
  f.command('setTextValue',{workspaceId:sibling.workspaceId,projectId:alpha,propertyId,value:'Changed'});
  assert.deepEqual(groups().map(g=>g.value),['Changed',null]);
}));

test('invalid ownership/type/key payloads and failed saves preserve configuration; corrupt settings can be explicitly repaired',async()=>{
  const {default:Database}=await import('better-sqlite3');
  fixture(f=>{
    const {viewId}=f.workspace;
    f.command('setViewGrouping',{viewId,config:config('name')});
    const before=f.query('getViewGrouping',{viewId});
    const select=f.command('createProperty',{name:'Select',propertyType:'single_select'}).value.propertyId;
    for(const bad of [config(select),{propertyId:'name',settings:[{propertyId:'name',order:'manual',manualOrder:['null'],hidden:[],collapsed:[],hideEmpty:false}]},{propertyId:'name',settings:[],extra:true}]) {
      assert.equal(f.command('setViewGrouping',{viewId,config:bad}).error.code,'invalid_input');
      assert.deepEqual(f.query('getViewGrouping',{viewId}),before);
    }
    const db=new Database(f.path);
    try {
      db.exec("CREATE TRIGGER grouping_failure BEFORE UPDATE OF grouping_config ON views BEGIN SELECT RAISE(ABORT,'injected'); END");
      assert.equal(f.command('setViewGrouping',{viewId,config:config(null)}).error.code,'storage');
      assert.deepEqual(f.query('getViewGrouping',{viewId}),before);
      db.exec('DROP TRIGGER grouping_failure');
      db.prepare('UPDATE views SET grouping_config=? WHERE id=?').run('{bad',viewId);
      assert.equal(f.query('getViewGrouping',{viewId}).error.code,'storage');
      assert.equal(f.query('queryView',{viewId,archived:false}).error.code,'storage');
      assert.equal(f.command('setViewGrouping',{viewId,config:config(null)}).ok,true);
    }finally{db.close();}
    f.reopen();assert.deepEqual(f.query('getViewGrouping',{viewId}).value.config,config(null));
  });
});

test('pre-grouping upgrade preserves populated views, filters, selection and scalar values',async()=>{
  const {default:Database}=await import('better-sqlite3');
  fixture(f=>{
    const {viewId}=f.workspace;
    const propertyId=f.command('createProperty',{name:'Number',propertyType:'number'}).value.propertyId;
    const projectId=f.query('listProjects').value.projects[0].projectId;
    f.command('setNumberValue',{projectId,propertyId,expression:'10'});
    const properties=f.query('listTextProperties');
    const views=f.command('createView',{name:'Board',kind:'board'});
    const filter={search:'Alpha',rules:[]};f.command('setViewFilter',{viewId,config:filter});
    // Remove only the newest schema boundary; reopening reapplies its real migration.
    const db=new Database(f.path);
    try{db.exec('ALTER TABLE views DROP COLUMN grouping_config; DELETE FROM __drizzle_migrations WHERE created_at=1791504020000');}finally{db.close();}
    f.reopen();
    assert.deepEqual(f.query('listViews'),views);
    assert.deepEqual(f.query('listTextProperties'),properties);
    assert.deepEqual(f.query('getViewFilter',{viewId}).value.config,filter);
    assert.deepEqual(f.query('getViewGrouping',{viewId}).value.config,config(null));
  });
});

test('semantically invalid persisted keys fail visibly on read and are explicitly repairable',async()=>{
  const {default:Database}=await import('better-sqlite3');
  fixture(f=>{
    const {viewId}=f.workspace;
    const db=new Database(f.path);
    try{db.prepare('UPDATE views SET grouping_config=? WHERE id=?').run(JSON.stringify({propertyId:'name',settings:[{propertyId:'name',order:'default',manualOrder:[],hidden:['null'],collapsed:[],hideEmpty:false}]}),viewId);}finally{db.close();}
    assert.equal(f.query('getViewGrouping',{viewId}).ok,false);
    assert.equal(f.command('setViewGrouping',{viewId,config:config(null)}).ok,true);
    assert.equal(f.query('queryView',{viewId,archived:false}).ok,true);
  });
});

test('manual fallback orders new values stably, and Active/Archived share settings with separate groups',async()=>{
  const {randomUUID}=await import('node:crypto');
  fixture(f=>{
    const {viewId}=f.workspace;
    const propertyId=f.command('createProperty',{name:'Score',propertyType:'number'}).value.propertyId;
    const projects=f.query('listProjects').value.projects;
    const alpha=projects.find(p=>p.name==='Alpha').projectId,beta=projects.find(p=>p.name==='Beta').projectId;
    f.command('setNumberValue',{projectId:alpha,propertyId,expression:'10'});
    const setting={propertyId,order:'manual',manualOrder:['10'],hidden:[],collapsed:[],hideEmpty:false};
    f.command('setViewGrouping',{viewId,config:{propertyId,settings:[setting]}});
    f.command('setNumberValue',{projectId:beta,propertyId,expression:'2'});
    const groups=archived=>f.query('queryView',{viewId,archived}).value.groups;
    assert.deepEqual(groups(false).map(g=>g.value),[10,2,null]);
    const location=f.query('previewArchiveLocation',{relativePath:'Archive'}).value;
    f.command('applyArchiveLocation',{operationId:randomUUID(),previewToken:location.previewToken});
    const preview=f.query('previewProjectArchive',{projectId:alpha,action:'archive',name:null,createParent:false}).value;
    assert.equal(f.command('applyProjectArchive',{operationId:randomUUID(),previewToken:preview.previewToken}).value.operation.stage,'completed');
    assert.deepEqual(groups(false).map(g=>g.value),[2,null]);
    assert.deepEqual(groups(true).map(g=>g.value),[10,null]);
    assert.deepEqual(groups(true)[0].projectIds,[alpha]);
    f.reopen();assert.deepEqual(groups(true).map(g=>g.value),[10,null]);
  });
});
