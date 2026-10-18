import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, readdirSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { openSettingsService } from '../dist/service/settings.mjs';
function fixture(run, mode = 'direct', native, prepare) {
  const directory = mkdtempSync(join(tmpdir(), 'grouping-')), root = join(directory, 'root'); mkdirSync(root);
  for (const name of ['Alpha','Beta','Gamma']) { mkdirSync(join(root,name)); if(mode==='grouped' && name!=='Gamma') mkdirSync(join(root,name,'Project')); }
  prepare?.(root);
  const path = join(directory,'app.sqlite'); let service = openSettingsService(path,undefined,undefined,undefined,undefined,native);
  const workspace = service.handleCommand({type:'workspace.create',rootPath:root,name:'One'}).value;
  const command = (type,fields={}) => service.handleCommand({type:`workspace.${type}`,workspaceId:workspace.workspaceId,...fields});
  const query = (type,fields={}) => service.handleQuery({type:`workspace.${type}`,workspaceId:workspace.workspaceId,...fields});
  command('applyDiscovery',{previewToken:query('previewDiscovery',{mode}).value.previewToken});
  try { run({workspace,command,query,root,path,subscribe:listener=>service.workspaces.subscribe(listener),reopen(){service.close();service=openSettingsService(path,undefined,undefined,undefined,undefined,native);}}); }
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
  assert.equal(f.command('assignProjectGroup',{...drop,propertyId:multi,fromKey:'invalid',toKey:'null'}).ok,false);
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

for (const layout of ['table','board']) test(`${layout} MultiSelect replaces the captured membership and persists the complete set`,()=>fixture(f=>{
  const {viewId}=f.workspace, [project]=f.query('listProjects').value.projects;
  f.command('setViewLayout',{viewId,kind:layout});
  const propertyId=f.command('createProperty',{name:'Tags',propertyType:'multi_select'}).value.propertyId;
  const options={};
  for(const name of ['A','B','C']) options[name]=f.command('createSelectOption',{propertyId,name,color:'green'}).value.snapshot.selectOptions.find(o=>o.name===name).optionId;
  const set=names=>f.command('setMultiSelectValue',{propertyId,projectId:project.projectId,optionIds:names.map(n=>options[n])});
  const saved=()=>f.query('listTextProperties').value.multiSelectValues.filter(v=>v.propertyId===propertyId&&v.projectId===project.projectId).map(v=>v.optionId).sort();
  const key=name=>name===null?'null':JSON.stringify(options[name]);
  f.command('setViewGrouping',{viewId,config:{propertyId,settings:[]}});
  const drop=(from,to)=>f.command('assignProjectGroup',{viewId,propertyId,projectId:project.projectId,fromKey:key(from),toKey:key(to),archived:false});
  for(const [initial,from,to,expected] of [[['A','B'],'A','C',['B','C']],[['A','B'],'A','B',['B']],[['A','B'],'B','C',['A','C']],[['A','B'],'A',null,[]],[[],null,'C',['C']],[['A','B'],'B','B',['A','B']]]) {
    assert.equal(set(initial).ok,true);
    assert.equal(drop(from,to).ok,true);
    f.reopen();assert.deepEqual(saved(),expected.map(n=>options[n]).sort());
    const projection=f.query('queryView',{viewId,archived:false}).value;
    for(const name of ['A','B','C',null]) assert.equal(projection.groups.find(g=>g.key===key(name)).projectIds.includes(project.projectId),expected.length?expected.includes(name):name===null);
  }
}));

test('MultiSelect validates stale membership and destinations without losing unrelated current values',()=>fixture(f=>{
  const {viewId}=f.workspace, projectId=f.query('listProjects').value.projects[0].projectId;
  const propertyId=f.command('createProperty',{name:'Tags',propertyType:'multi_select'}).value.propertyId;
  const ids=[];
  for(const name of ['A','B','C','D']) ids.push(f.command('createSelectOption',{propertyId,name,color:'green'}).value.snapshot.selectOptions.find(o=>o.name===name).optionId);
  const [a,b,c,d]=ids;
  const set=optionIds=>f.command('setMultiSelectValue',{projectId,propertyId,optionIds});
  set([a,b]);f.command('setViewGrouping',{viewId,config:{propertyId,settings:[]}});
  const sibling=f.command('create',{name:'Sibling',rootPath:f.root}).value;
  const drop={viewId,propertyId,projectId,fromKey:JSON.stringify(a),toKey:JSON.stringify(c),archived:false};
  set([a,b,d]); // An unrelated membership was added after drag start.
  assert.equal(f.command('assignProjectGroup',drop).ok,true);
  const values=workspaceId=>f.query('listTextProperties',{workspaceId}).value.multiSelectValues.filter(v=>v.projectId===projectId).map(v=>v.optionId).sort();
  assert.deepEqual(values(sibling.workspaceId),[b,c,d].sort());
  const before=f.query('listTextProperties'),events=[];f.subscribe(e=>events.push(e));
  for(const change of [{},{fromKey:'null'},{fromKey:JSON.stringify(b),toKey:JSON.stringify(viewId)},{fromKey:JSON.stringify(b),toKey:'"deleted-option"'},{fromKey:JSON.stringify(b),propertyId:viewId},{fromKey:JSON.stringify(b),viewId:propertyId},{fromKey:JSON.stringify(b),archived:true}]) {
    assert.equal(f.command('assignProjectGroup',{...drop,...change}).ok,false);
    assert.deepEqual(f.query('listTextProperties'),before);
  }
  assert.equal(events.some(e=>e.type==='workspace.propertiesChanged'),false);
  f.command('setViewGrouping',{viewId,config:{propertyId,settings:[{propertyId,order:'manual',manualOrder:[JSON.stringify(c),JSON.stringify(b)],hidden:[JSON.stringify(a)],collapsed:[],hideEmpty:false}]}});
  assert.equal(f.command('assignProjectGroup',{...drop,fromKey:JSON.stringify(b),toKey:JSON.stringify(a)}).ok,false);
  f.command('setViewFilter',{viewId,config:{search:'',rules:[{propertyId,operator:'any',operand:[b]}]}});
  assert.equal(f.command('assignProjectGroup',{...drop,fromKey:JSON.stringify(b)}).ok,true);
  assert.deepEqual(f.query('queryView',{viewId,archived:false}).value.projectIds,[]);
  assert.deepEqual(values(sibling.workspaceId),[c,d].sort());
  f.reopen();assert.deepEqual(values(sibling.workspaceId),[c,d].sort());
}));
test('failed MultiSelect replacement rolls back the entire set and emits no success',async()=>{
  const {default:Database}=await import('better-sqlite3');
  fixture(f=>{
    const {viewId}=f.workspace,projectId=f.query('listProjects').value.projects[0].projectId;
    const propertyId=f.command('createProperty',{name:'Tags',propertyType:'multi_select'}).value.propertyId;
    for(const name of ['A','B','C'])f.command('createSelectOption',{propertyId,name,color:'green'});
    const [a,b,c]=f.query('listTextProperties').value.selectOptions.map(o=>o.optionId);
    f.command('setMultiSelectValue',{projectId,propertyId,optionIds:[a,b]});
    f.command('setViewGrouping',{viewId,config:{propertyId,settings:[]}});
    const before=f.query('listTextProperties'),events=[];f.subscribe(e=>events.push(e));
    const db=new Database(f.path);db.exec("CREATE TRIGGER reject_multi_drop BEFORE INSERT ON multi_select_property_values BEGIN SELECT RAISE(ABORT, 'injected'); END");db.close();
    assert.equal(f.command('assignProjectGroup',{viewId,propertyId,projectId,fromKey:JSON.stringify(a),toKey:JSON.stringify(c),archived:false}).error.code,'storage');
    assert.deepEqual(f.query('listTextProperties'),before);
    assert.equal(events.some(e=>e.type==='workspace.propertiesChanged'),false);
    f.reopen();assert.deepEqual(f.query('listTextProperties'),before);
  });
});

for(const layout of ['table','board']) test(`${layout} Name drop explains a real same-parent collision`,()=>fixture(f=>{
  const {viewId}=f.workspace,[a,b]=f.query('listProjects').value.projects;
  f.command('setViewLayout',{viewId,kind:layout});
  const propertyId=f.command('createProperty',{name:'Notes',propertyType:'text'}).value.propertyId;
  f.command('setTextValue',{propertyId,projectId:a.projectId,value:'Keep me'});
  // Direct siblings collide; a grouped source allows the same name in different parents.
  const drop={viewId,propertyId:'name',projectId:a.projectId,fromKey:JSON.stringify(a.name),toKey:JSON.stringify(b.name),archived:false};
  f.command('setViewGrouping',{viewId,config:{propertyId:'name',settings:[]}});
  const result=f.command('assignProjectGroup',drop);
  assert.equal(result.ok,true);
  assert.equal(result.value.filesystem.outcome,'rejected');
  assert.equal(result.value.filesystem.problem,'reserved_destination');
  assert.deepEqual(readdirSync(f.root).sort(),['Alpha','Beta','Gamma']);
}));

for(const layout of ['table','board']) test(`${layout} real Name and category drops preserve source identity, metadata, siblings and restart`,()=>fixture(f=>{
  const {viewId}=f.workspace,[a,b]=f.query('listProjects').value.projects;
  const sibling=f.command('create',{name:'Sibling',rootPath:f.root}).value;
  const propertyId=f.command('createProperty',{name:'Notes',propertyType:'text'}).value.propertyId;
  f.command('setTextValue',{propertyId,projectId:a.projectId,value:'Keep me'});
  assert.equal(f.command('renameProject',{projectId:b.projectId,operationId:randomUUID(),name:'Target',expectedRevision:f.query('listProjects').value.revision}).value.outcome,'completed');
  f.command('setViewLayout',{viewId,kind:layout});
  f.command('setViewGrouping',{viewId,config:{propertyId:'name',settings:[]}});
  const drop={viewId,propertyId:'name',projectId:a.projectId,fromKey:JSON.stringify(a.name),toKey:'"Target"',archived:false};
  const events=[];f.subscribe(e=>events.push(e));
  const renamed=f.command('assignProjectGroup',drop);
  assert.equal(renamed.ok,true);assert.equal(renamed.value.filesystem.outcome,'completed');
  const parent=a.relativePath.split('/')[0];
  assert.deepEqual(readdirSync(join(f.root,parent)),['Target']);
  f.reopen();
  let list=f.query('listProjects').value;
  assert.equal(list.projects.find(p=>p.projectId===a.projectId).relativePath,`${parent}/Target`);
  const categoryId=list.categories.find(c=>c.name==='Gamma').categoryId;
  const categoryPropertyId=list.categoryProperty.propertyId;
  f.command('setViewGrouping',{viewId,config:{propertyId:categoryPropertyId,settings:[]}});
  const move={...drop,propertyId:categoryPropertyId,fromKey:JSON.stringify(a.categoryId),toKey:JSON.stringify(categoryId)};
  assert.equal(f.command('assignProjectGroup',move).value.filesystem.outcome,'completed');
  assert.deepEqual(readdirSync(join(f.root,'Gamma')),['Target']);
  assert.deepEqual(readdirSync(join(f.root,parent)),[]);
  f.reopen();list=f.query('listProjects').value;
  assert.equal(list.projects.find(p=>p.projectId===a.projectId).relativePath,'Gamma/Target');
  assert.equal(f.query('listTextProperties',{workspaceId:sibling.workspaceId}).value.values.find(v=>v.projectId===a.projectId).value,'Keep me');
  assert.equal(f.query('listProjects',{workspaceId:sibling.workspaceId}).value.projects.find(p=>p.projectId===a.projectId).categoryId,categoryId);
  assert.ok(events.some(e=>e.type==='workspace.projectsChanged'&&e.workspaceIds.includes(sibling.workspaceId)));
  for(const extra of [{},{fromKey:JSON.stringify(categoryId),toKey:'null'},{fromKey:JSON.stringify(categoryId),toKey:'"../escape"'},{fromKey:JSON.stringify(categoryId),archived:true},{fromKey:JSON.stringify(categoryId),workspaceId:viewId}])
    assert.equal(f.command('assignProjectGroup',{...move,...extra}).ok,false);
  assert.deepEqual(f.query('listProjects').value.projects,list.projects);
},'grouped'));

for(const grouping of ['name','category']) for(const outcome of ['permission_denied','interrupted']) test(`${grouping} drag retains existing ${outcome} filesystem receipt and restart recovery without replay`,()=>{
  let calls=0;
  fixture(f=>{
    const {viewId}=f.workspace,list=f.query('listProjects').value,a=list.projects[0];
    const propertyId=grouping==='name'?'name':list.categoryProperty.propertyId;
    // A Name destination must be a real projected group in a different parent.
    const b=list.projects[1];
    const toKey=grouping==='name'?JSON.stringify(b.name):JSON.stringify(list.categories.find(c=>c.name==='Gamma').categoryId);
    f.command('setViewGrouping',{viewId,config:{propertyId,settings:[]}});
    const drop={viewId,propertyId,projectId:a.projectId,fromKey:JSON.stringify(grouping==='name'?a.name:a.categoryId),toKey,archived:false};
    const before=f.query('listProjects').value.projects;
    const result=f.command('assignProjectGroup',drop);
    assert.equal(result.ok,true);
    assert.equal(result.value.filesystem.outcome,outcome==='interrupted'?'recoverable':'rejected');
    assert.equal(calls,1);
    f.reopen();assert.equal(calls,1);
    if(outcome==='permission_denied') assert.deepEqual(f.query('listProjects').value.projects,before);
    else {
      const retained=f.query('listProjects').value.retainedProjects.find(p=>p.projectId===a.projectId);
      assert.equal(retained.relativePath,a.relativePath);
      assert.equal(retained.resolution,'unresolved');
    }
    if(outcome==='interrupted') {
      const operations=f.query(grouping==='name'?'listProjectRenames':'listProjectCategoryMoves').value.operations;
      assert.equal(operations.length,1);
      assert.equal(operations[0].operationId,result.value.filesystem.operation.operationId);
      const preview=f.query(grouping==='name'?'previewProjectRenameRecovery':'previewProjectCategoryMoveRecovery',{operationId:operations[0].operationId}).value;
      assert.ok(preview.actions.includes('keep_original'));
      assert.equal(f.command(grouping==='name'?'recoverProjectRename':'recoverProjectCategoryMove',{operationId:operations[0].operationId,previewToken:preview.previewToken,action:'keep_original'}).value.problem,'kept_original');
      assert.equal(calls,1);
      assert.deepEqual(f.query('listProjects').value.projects,before);
    }
  },'grouped',()=>{calls++;if(outcome==='interrupted')throw new Error('interrupted');return outcome;},root=>renameSync(join(root,'Beta','Project'),join(root,'Beta','Target')));
});

test('archived Name/category drops cannot rename or move retained placement',()=>fixture(f=>{
  const {viewId}=f.workspace,list=f.query('listProjects').value;
  const designation=f.query('previewArchiveLocation',{relativePath:'Archive'}).value;
  f.command('applyArchiveLocation',{operationId:randomUUID(),previewToken:designation.previewToken});
  for(const p of list.projects){const preview=f.query('previewProjectArchive',{projectId:p.projectId,action:'archive',name:null,createParent:false}).value;assert.equal(f.command('applyProjectArchive',{operationId:randomUUID(),previewToken:preview.previewToken}).ok,true);}
  const before=f.query('listArchivedProjects').value.projects,a=before[0];
  for(const propertyId of ['name',list.categoryProperty.propertyId]) {
    f.command('setViewGrouping',{viewId,config:{propertyId,settings:[]}});
    const groups=f.query('queryView',{viewId,archived:true}).value.groups;
    assert.equal(groups.some(g=>g.key==='null'),false);
    const origin=groups.find(g=>g.projectIds.includes(a.projectId)),destination=groups.find(g=>g.key!==origin.key);
    if(destination)assert.equal(f.command('assignProjectGroup',{viewId,propertyId,projectId:a.projectId,fromKey:origin.key,toKey:destination.key,archived:true}).ok,false);
  }
  f.reopen();assert.deepEqual(f.query('listArchivedProjects').value.projects,before);
},'grouped'));
