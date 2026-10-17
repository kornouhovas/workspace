import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openSettingsService } from '../dist/service/settings.mjs';
function fixture(run, mode = 'direct') {
  const directory = mkdtempSync(join(tmpdir(), 'grouping-')), root = join(directory, 'root'); mkdirSync(root);
  for (const name of ['Alpha','Beta','Gamma']) { mkdirSync(join(root,name)); if(mode==='grouped' && name!=='Gamma') mkdirSync(join(root,name,'Project')); }
  const path = join(directory,'app.sqlite'); let service = openSettingsService(path);
  const workspace = service.handleCommand({type:'workspace.create',rootPath:root,name:'One'}).value;
  const command = (type,fields={}) => service.handleCommand({type:`workspace.${type}`,workspaceId:workspace.workspaceId,...fields});
  const query = (type,fields={}) => service.handleQuery({type:`workspace.${type}`,workspaceId:workspace.workspaceId,...fields});
  command('applyDiscovery',{previewToken:query('previewDiscovery',{mode}).value.previewToken});
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
    const unavailable='11111111-1111-4111-8111-111111111111';
    for(const bad of [config(unavailable),{propertyId:'name',settings:[{propertyId:'name',order:'manual',manualOrder:['null'],hidden:[],collapsed:[],hideEmpty:false}]},{propertyId:'name',settings:[],extra:true}]) {
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

test('valid long and JSON-escaped Text values remain independently hideable and manually orderable',()=>fixture(f=>{
  const {viewId}=f.workspace;
  const propertyId=f.command('createProperty',{name:'Exact text',propertyType:'text'}).value.propertyId;
  const projectId=f.query('listProjects').value.projects[0].projectId;
  for(const value of ['x'.repeat(10001),'\\'.repeat(6000),'\n'.repeat(6000)]) {
    assert.equal(f.command('setTextValue',{projectId,propertyId,value}).ok,true);
    assert.equal(f.command('setViewGrouping',{viewId,config:config(propertyId)}).ok,true);
    const key=JSON.stringify(value);
    const setting={propertyId,order:'manual',manualOrder:[key,'null'],hidden:[key],collapsed:[],hideEmpty:false};
    assert.equal(f.command('setViewGrouping',{viewId,config:{propertyId,settings:[setting]}}).ok,true);
    const groups=f.query('queryView',{viewId,archived:false}).value.groups;
    assert.equal(groups[0].value,value);assert.equal(groups[0].hidden,true);
    assert.deepEqual(groups[0].projectIds,[projectId]);
    f.reopen();assert.equal(f.query('getViewGrouping',{viewId}).value.config.settings[0].manualOrder[0],key);
  }
}));

test('selection grouping uses stable IDs, all options and MultiSelect memberships across restart',()=>fixture(f=>{
  const {viewId}=f.workspace;
  const alpha=f.query('listProjects').value.projects.find(p=>p.name==='Alpha').projectId;
  for(const propertyType of ['single_select','multi_select']) {
    const propertyId=f.command('createProperty',{name:propertyType,propertyType}).value.propertyId;
    const option=name=>{
      const result=f.command('createSelectOption',{propertyId,name,color:'default'});
      assert.equal(result.ok,true);
      return result.value.snapshot.selectOptions.find(o=>o.propertyId===propertyId&&o.name===name).optionId;
    };
    const a=option('Zulu'),b=option('Alpha'),c=option('Unused');
    f.command('setSelectOptionHidden',{propertyId,optionId:b,hidden:true});
    const set=optionIds=>f.command(propertyType==='multi_select'?'setMultiSelectValue':'setSelectValue',{propertyId,projectId:alpha,...(propertyType==='multi_select'?{optionIds}:{optionId:optionIds[0]??null})});
    assert.equal(set([a,b]).ok,true);
    assert.equal(f.command('setViewGrouping',{viewId,config:config(propertyId)}).ok,true);
    const groups=()=>f.query('queryView',{viewId,archived:false}).value.groups;
    assert.deepEqual(groups().map(g=>g.value),[a,b,c,null]);
    assert.deepEqual(groups().map(g=>g.label),['Zulu','Alpha','Unused',undefined]);
    assert.deepEqual(groups()[0].projectIds,[alpha]);
    assert.deepEqual(groups()[1].projectIds,propertyType==='multi_select'?[alpha]:[]);
    assert.equal(groups()[1].hidden,false);
    const setting={propertyId,order:'manual',manualOrder:[JSON.stringify(b),JSON.stringify(a)],hidden:[JSON.stringify(c)],collapsed:[JSON.stringify(a)],hideEmpty:false};
    assert.equal(f.command('setViewGrouping',{viewId,config:{propertyId,settings:[setting]}}).ok,true);
    f.command('updateSelectOption',{propertyId,optionId:a,name:'Renamed',color:'blue'});
    assert.equal(groups().find(g=>g.value===a).collapsed,true);
    assert.equal(groups().find(g=>g.value===a).label,'Renamed');
    const copy=f.command('duplicateView',{viewId,name:'Copy'}).value.activeViewId;
    f.command('setViewGrouping',{viewId:copy,config:config(null)});
    f.reopen();
    assert.deepEqual(groups().map(g=>g.value),[b,a,c,null]);
    assert.equal(groups().find(g=>g.value===c).hidden,true);
    assert.equal(set([b]).ok,true);
    assert.deepEqual(groups().find(g=>g.value===a).projectIds,[]);
    assert.deepEqual(groups().find(g=>g.value===b).projectIds,[alpha]);
    assert.equal(f.query('queryView',{viewId,archived:false}).value.projectIds.length,3);
    assert.equal(f.query('queryView',{viewId:copy,archived:false}).value.groups,undefined);
  }
}));


test('folder-backed grouping follows physical categories without an empty destination',()=>fixture(f=>{
  const {viewId}=f.workspace;
  const list=f.query('listProjects').value;
  const propertyId=list.categoryProperty.propertyId;
  assert.equal(f.command('setViewGrouping',{viewId,config:config(propertyId)}).ok,true);
  const groups=()=>f.query('queryView',{viewId,archived:false}).value.groups;
  assert.deepEqual(groups().map(g=>g.label),['Alpha','Beta','Gamma']);
  assert.equal(groups().some(g=>g.value===null),false);
  for(const category of list.categories) {
    assert.deepEqual(groups().find(g=>g.value===category.categoryId).projectIds,list.projects.filter(p=>p.categoryId===category.categoryId).map(p=>p.projectId));
  }
  assert.equal(groups().find(g=>g.label==='Gamma').empty,true);
  const setting={propertyId,order:'default',manualOrder:[],hidden:['null'],collapsed:[],hideEmpty:false};
  assert.equal(f.command('setViewGrouping',{viewId,config:{propertyId,settings:[setting]}}).error.code,'invalid_input');
  f.reopen();assert.deepEqual(groups().map(g=>g.label),['Alpha','Beta','Gamma']);
},'grouped'));

test('option order, filtered empties and view-owned presentation stay independent of source metadata',()=>fixture(f=>{
  const {viewId}=f.workspace;
  const propertyId=f.command('createProperty',{name:'Tags',propertyType:'multi_select'}).value.propertyId;
  const option=name=>f.command('createSelectOption',{propertyId,name,color:'default'}).value.snapshot.selectOptions.find(o=>o.name===name).optionId;
  const a=option('Zulu'),b=option('Alpha'),c=option('Middle');
  const projectId=f.query('listProjects').value.projects.find(p=>p.name==='Alpha').projectId;
  f.command('setMultiSelectValue',{propertyId,projectId,optionIds:[a,b]});
  const groups=()=>f.query('queryView',{viewId,archived:false}).value.groups;
  const setting={propertyId,order:'default',manualOrder:[],hidden:[],collapsed:[],hideEmpty:false};
  const save=()=>f.command('setViewGrouping',{viewId,config:{propertyId,settings:[setting]}});
  assert.equal(save().ok,true);
  f.command('reorderSelectOptions',{propertyId,optionIds:[c,b,a]});
  assert.deepEqual(groups().map(g=>g.value),[c,b,a,null]);
  setting.order='ascending';save();assert.deepEqual(groups().map(g=>g.value),[b,c,a,null]);
  setting.order='descending';save();assert.deepEqual(groups().map(g=>g.value),[a,c,b,null]);
  setting.order='manual';setting.manualOrder=[JSON.stringify(b)];setting.collapsed=[JSON.stringify(a)];setting.hidden=[JSON.stringify(c)];save();
  assert.deepEqual(groups().map(g=>g.value),[b,c,a,null]);
  const sibling=f.command('create',{rootPath:f.root,name:'Sibling'}).value;
  f.command('setViewGrouping',{workspaceId:sibling.workspaceId,viewId:sibling.viewId,config:config(propertyId)});
  f.command('updateSelectOption',{workspaceId:sibling.workspaceId,propertyId,optionId:a,name:'Updated',color:'red'});
  assert.equal(groups().find(g=>g.value===a).label,'Updated');
  assert.equal(groups().find(g=>g.value===a).collapsed,true);
  assert.equal(f.query('queryView',{workspaceId:sibling.workspaceId,viewId:sibling.viewId,archived:false}).value.groups.find(g=>g.value===a).collapsed,false);
  f.command('setViewFilter',{viewId,config:{search:'Beta',rules:[]}});
  assert.deepEqual(groups().map(g=>g.empty),[true,true,true,false]);
  setting.hideEmpty=true;save();assert.deepEqual(groups().map(g=>g.hidden),[true,true,true,false]);
  const copy=f.command('duplicateView',{viewId,name:'Copy'}).value.activeViewId;
  f.command('setViewGrouping',{viewId:copy,config:config(propertyId)});
  assert.equal(f.query('queryView',{viewId:copy,archived:false}).value.groups.find(g=>g.value===a).hidden,false);
  f.reopen();assert.deepEqual(groups().map(g=>g.hidden),[true,true,true,false]);
  const other=f.command('createProperty',{name:'Other',propertyType:'single_select'}).value.propertyId;
  for(const key of [JSON.stringify('Alpha'),JSON.stringify(42),JSON.stringify(a)]) {
    const target=key===JSON.stringify(a)?other:propertyId;
    assert.equal(f.command('setViewGrouping',{viewId,config:{propertyId:target,settings:[{...setting,propertyId:target,hidden:[key]}]}}).error.code,'invalid_input');
  }
}));

test('category renames and moves retain keys and archive grouping preserves original category',async()=>{
  const {randomUUID}=await import('node:crypto');
  const {existsSync}=await import('node:fs');
  fixture(f=>{
    const {viewId}=f.workspace,list=f.query('listProjects').value;
    const propertyId=list.categoryProperty.propertyId,a=list.categories.find(c=>c.name==='Alpha').categoryId,b=list.categories.find(c=>c.name==='Beta').categoryId;
    const projectId=list.projects.find(p=>p.categoryId===a).projectId;
    const setting={propertyId,order:'manual',manualOrder:[JSON.stringify(a)],hidden:[],collapsed:[JSON.stringify(a)],hideEmpty:false};
    f.command('setViewGrouping',{viewId,config:{propertyId,settings:[setting]}});
    const rename=f.query('previewCategoryFolder',{action:'rename',categoryId:a,name:'Renamed'});
    assert.equal(rename.ok,true);
    assert.equal(f.command('applyCategoryFolder',{operationId:randomUUID(),previewToken:rename.value.previewToken}).value.outcome,'completed');
    const groups=archived=>f.query('queryView',{viewId,archived}).value.groups;
    assert.equal(groups(false)[0].value,a);assert.equal(groups(false)[0].label,'Renamed');assert.equal(groups(false)[0].collapsed,true);
    // Avoid an occupied destination by moving the Alpha project to the empty category.
    const destination=list.categories.find(c=>c.name==='Gamma').categoryId;
    const before=f.query('listProjects').value;
    const move=f.command('moveProjectCategory',{operationId:randomUUID(),projectId,destinationCategoryId:destination,expectedRevision:before.revision});
    assert.equal(move.value.outcome,'completed');
    assert.deepEqual(groups(false).find(g=>g.value===destination).projectIds,[projectId]);
    assert.deepEqual(groups(false).find(g=>g.value===a).projectIds,[]);
    assert.equal(existsSync(join(f.root,'Gamma','Project')),true);
    const ordinary=f.command('createProperty',{name:'Ordinary',propertyType:'single_select'}).value.propertyId;
    const option=f.command('createSelectOption',{propertyId:ordinary,name:'Beta',color:'default'}).value.snapshot.selectOptions.find(o=>o.propertyId===ordinary).optionId;
    assert.equal(f.command('setSelectValue',{propertyId:ordinary,projectId,optionId:option}).ok,true);
    assert.equal(f.query('listProjects').value.projects.find(p=>p.projectId===projectId).categoryId,destination);
    assert.equal(existsSync(join(f.root,'Gamma','Project')),true);
    const location=f.query('previewArchiveLocation',{relativePath:'Archive'}).value;
    f.command('applyArchiveLocation',{operationId:randomUUID(),previewToken:location.previewToken});
    const preview=f.query('previewProjectArchive',{projectId,action:'archive',name:null,createParent:false}).value;
    assert.equal(f.command('applyProjectArchive',{operationId:randomUUID(),previewToken:preview.previewToken}).value.operation.stage,'completed');
    assert.deepEqual(groups(true).find(g=>g.value===destination).projectIds,[projectId]);
    assert.equal(groups(true).some(g=>g.value===null),false);
    f.reopen();assert.deepEqual(groups(true).find(g=>g.value===destination).projectIds,[projectId]);
    assert.equal(groups(false).some(g=>g.value===b),true);
  },'grouped');
});
