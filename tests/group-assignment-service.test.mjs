import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
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
  try { run({workspace,command,query,root,path,subscribe:listener=>service.workspaces.subscribe(listener),reopen(){service.close();service=openSettingsService(path);}}); }
  finally { service.close();rmSync(directory,{recursive:true,force:true}); }
}
test('group assignment saves exact Text and clears it through the typed service',()=>fixture(f=>{
  const {viewId}=f.workspace;
  const [a,b]=f.query('listProjects').value.projects;
  const propertyId=f.command('createProperty',{name:'Text',propertyType:'text'}).value.propertyId;
  f.command('setTextValue',{projectId:b.projectId,propertyId,value:'  Exact  '});
  f.command('setViewGrouping',{viewId,config:{propertyId,settings:[]}});
  const drop={viewId,propertyId,projectId:a.projectId,fromKey:'null',toKey:JSON.stringify('  Exact  '),archived:false};
  assert.equal(f.command('assignProjectGroup',drop).ok,true);
  f.reopen();
  assert.equal(f.query('listTextProperties').value.values.find(v=>v.projectId===a.projectId).value,'  Exact  ');
  assert.equal(f.command('assignProjectGroup',{...drop,fromKey:drop.toKey,toKey:'null'}).ok,true);
  assert.equal(f.query('listTextProperties').value.values.some(v=>v.projectId===a.projectId),false);
}));
for (const [type, value, field, collection] of [['number','1e-7','expression','numberValues'],['date','2024-02-29','value','dateValues'],['single_select',null,'optionId','selectValues']]) {
  test(`${type} group assignment persists exact destination and clears without moving folders`,()=>fixture(f=>{
    const {viewId}=f.workspace, [a,b]=f.query('listProjects').value.projects;
    const propertyId=f.command('createProperty',{name:type,propertyType:type}).value.propertyId;
    let target=value;
    if(type==='single_select') {const result=f.command('createSelectOption',{propertyId,name:'Ready',color:'green'});target=result.value.snapshot.selectOptions[0].optionId;}
    const setter=type==='number'?'setNumberValue':type==='date'?'setDateValue':'setSelectValue';
    assert.equal(f.command(setter,{projectId:b.projectId,propertyId,[field]:target}).ok,true);
    f.command('setViewGrouping',{viewId,config:{propertyId,settings:[]}});
    const actual=type==='number'?1e-7:target;
    const drop={viewId,propertyId,projectId:a.projectId,fromKey:'null',toKey:JSON.stringify(actual),archived:false};
    const before=f.query('listProjects').value.projects;
    assert.equal(f.command('assignProjectGroup',drop).ok,true);
    f.reopen();
    const saved=f.query('listTextProperties').value[collection].find(v=>v.projectId===a.projectId);
    assert.equal(saved[type==='single_select'?'optionId':'value'],actual);
    const revision=f.query('listTextProperties').value.revision;
    assert.equal(f.command('assignProjectGroup',{...drop,fromKey:drop.toKey}).ok,true);
    assert.equal(f.query('listTextProperties').value.revision,revision);
    assert.equal(f.command('assignProjectGroup',{...drop,fromKey:drop.toKey,toKey:'null'}).ok,true);
    f.reopen();assert.equal(f.query('listTextProperties').value[collection].some(v=>v.projectId===a.projectId),false);
    assert.deepEqual(f.query('listProjects').value.projects,before);
  }));
}
for (const layout of ['table','board']) test(`${layout} fresh membership, siblings, filters and ordering remain truthful`,()=>fixture(f=>{
  const {viewId}=f.workspace, [a,b,c]=f.query('listProjects').value.projects;
  f.command('setViewLayout',{viewId,kind:layout});
  const propertyId=f.command('createProperty',{name:'Notes',propertyType:'text'}).value.propertyId;
  f.command('setTextValue',{projectId:a.projectId,propertyId,value:'A'});
  f.command('setTextValue',{projectId:b.projectId,propertyId,value:'B'});
  const setting={propertyId,order:'manual',manualOrder:['"B"','"A"','null'],hidden:[],collapsed:[],hideEmpty:false};
  f.command('setViewGrouping',{viewId,config:{propertyId,settings:[setting]}});
  f.command('setTableLayout',{viewId,config:{columns:[],rowOrder:[c.projectId,a.projectId,b.projectId]}});
  f.command('setViewFilter',{viewId,config:{search:'',rules:[{propertyId,operator:'equals',operand:'A'}]}});
  const sibling=f.command('create',{name:'Sibling',rootPath:f.root}).value;
  const events=[];f.subscribe(event=>events.push(event));
  const files=readdirSync(f.root);
  const drop={viewId,propertyId,projectId:a.projectId,fromKey:'"A"',toKey:'"B"',archived:false};
  assert.equal(f.command('assignProjectGroup',drop).ok,true);
  assert.deepEqual(f.query('queryView',{viewId,archived:false}).value.projectIds,[]);
  assert.deepEqual(f.query('getViewGrouping',{viewId}).value.config.settings,[setting]);
  assert.deepEqual(f.query('getTableLayout',{viewId}).value.config.rowOrder,[c.projectId,a.projectId,b.projectId]);
  const shared=f.query('listTextProperties',{workspaceId:sibling.workspaceId}).value;
  assert.equal(shared.values.find(v=>v.projectId===a.projectId).value,'B');
  assert.equal(events.some(e=>e.type==='workspace.propertiesChanged'&&e.workspaceIds.includes(sibling.workspaceId)),true);
  assert.deepEqual(readdirSync(f.root),files);
  assert.equal(f.command('assignProjectGroup',drop).ok,false);
}));

test('stale groups, foreign ownership, unsupported types and malformed drops preserve actual values',()=>fixture(f=>{
  const {viewId}=f.workspace, [a,b]=f.query('listProjects').value.projects;
  const propertyId=f.command('createProperty',{name:'Text',propertyType:'text'}).value.propertyId;
  f.command('setTextValue',{projectId:b.projectId,propertyId,value:'B'});
  f.command('setViewGrouping',{viewId,config:{propertyId,settings:[]}});
  const drop={viewId,propertyId,projectId:a.projectId,fromKey:'null',toKey:'"B"',archived:false};
  const before=f.query('listTextProperties'),events=[];f.subscribe(event=>events.push(event));
  for(const extra of [{fromKey:'"B"'},{toKey:'"Missing"'},{toKey:'"b"'},{toKey:'0'},{toKey:'null '},{archived:true},{propertyId:viewId},{workspaceId:viewId},{viewId:propertyId},{projectId:propertyId},{extra:true},{fromKey:[]},{archived:0}]) {
    assert.equal(f.command('assignProjectGroup',{...drop,...extra}).ok,false);
    assert.deepEqual(f.query('listTextProperties'),before);
  }
  assert.equal(events.some(e=>e.type==='workspace.propertiesChanged'),false);
  f.command('setViewGrouping',{viewId,config:{propertyId:'name',settings:[]}});
  assert.equal(f.command('assignProjectGroup',drop).ok,false);
  const multi=f.command('createProperty',{name:'Multi',propertyType:'multi_select'}).value.propertyId;
  f.command('setViewGrouping',{viewId,config:{propertyId:multi,settings:[]}});
  assert.equal(f.command('assignProjectGroup',{...drop,propertyId:multi,toKey:'null'}).ok,false);
}));

test('failed SQLite assignment retains values and emits no success event',async()=>{
  const {default:Database}=await import('better-sqlite3');
  fixture(f=>{
    const {viewId}=f.workspace,[a,b]=f.query('listProjects').value.projects;
    const propertyId=f.command('createProperty',{name:'Text',propertyType:'text'}).value.propertyId;
    f.command('setTextValue',{projectId:b.projectId,propertyId,value:'B'});
    f.command('setViewGrouping',{viewId,config:{propertyId,settings:[]}});
    const before=f.query('listTextProperties'),events=[];f.subscribe(e=>events.push(e));
    const db=new Database(f.path);db.exec("CREATE TRIGGER reject_assignment BEFORE INSERT ON text_property_values BEGIN SELECT RAISE(ABORT, 'injected'); END");db.close();
    assert.equal(f.command('assignProjectGroup',{viewId,propertyId,projectId:a.projectId,fromKey:'null',toKey:'"B"',archived:false}).error.code,'storage');
    assert.deepEqual(f.query('listTextProperties'),before);
    assert.equal(events.some(e=>e.type==='workspace.propertiesChanged'),false);
  });
});
for(const mode of ['direct','grouped']) test(`${mode} archived ordinary assignment stays metadata-only and respects lifecycle`,async()=>{
  const {randomUUID}=await import('node:crypto');
  fixture(f=>{
    const {viewId}=f.workspace,[a,b]=f.query('listProjects').value.projects;
    const propertyId=f.command('createProperty',{name:'Text',propertyType:'text'}).value.propertyId;
    f.command('setTextValue',{projectId:b.projectId,propertyId,value:'B'});
    f.command('setViewGrouping',{viewId,config:{propertyId,settings:[]}});
    const designation=f.query('previewArchiveLocation',{relativePath:'Archive'}).value;
    assert.equal(f.command('applyArchiveLocation',{operationId:randomUUID(),previewToken:designation.previewToken}).ok,true);
    for(const p of [a,b]) {
      const preview=f.query('previewProjectArchive',{projectId:p.projectId,action:'archive',name:null,createParent:false}).value;
      assert.equal(f.command('applyProjectArchive',{operationId:randomUUID(),previewToken:preview.previewToken}).ok,true);
    }
    const before=f.query('listArchivedProjects').value.projects;
    const drop={viewId,propertyId,projectId:a.projectId,fromKey:'null',toKey:'"B"',archived:true};
    assert.equal(f.command('assignProjectGroup',{...drop,archived:false}).ok,false);
    assert.equal(f.command('assignProjectGroup',drop).ok,true);
    f.reopen();
    assert.equal(f.query('listTextProperties').value.values.find(v=>v.projectId===a.projectId).value,'B');
    assert.deepEqual(f.query('listArchivedProjects').value.projects,before);
  },mode);
});
test('a same-group drop preserves authored empty Text without revising source data',()=>fixture(f=>{
  const {viewId}=f.workspace,projectId=f.query('listProjects').value.projects[0].projectId;
  const propertyId=f.command('createProperty',{name:'Text',propertyType:'text'}).value.propertyId;
  f.command('setTextValue',{projectId,propertyId,value:''});
  f.command('setViewGrouping',{viewId,config:{propertyId,settings:[]}});
  const before=f.query('listTextProperties');
  assert.equal(f.command('assignProjectGroup',{viewId,propertyId,projectId,fromKey:'null',toKey:'null',archived:false}).ok,true);
  assert.deepEqual(f.query('listTextProperties'),before);
}));
