/** Exact additive migration expectations; legacy authority is deliberately absent. */
export function withIdentityMigrationDefaults(table, rows) {
  return rows.map(row => table === 'sources' ? {durable_evidence:null,evidence_generation:0,...row}
    : table==='project_creation_operations' ? {authorization:null,destination_evidence:null,...row} : table==='category_folder_operations' ? {authorization:null,destination_evidence:null,...row} : table==='project_rename_operations' ? {authorization:null,project_evidence:null,...row} : table==='project_category_move_operations' ? {original_authorization:null,destination_authorization:null,project_evidence:null,...row} : ['projects','categories'].includes(table) ? {durable_evidence:null,...row} : row);
}
export function projectMetadataRecords(result) {
  if(!result.ok) throw new Error(`Project metadata query failed: ${JSON.stringify(result.error)}`);
  return [...result.value.projects,...result.value.retainedProjects];
}

/** Explicit fixture arrangement through the real current reviewed binding API. */
export function bindFixtureFolders(application, workspaceId, mappings) {
  const preview=application.handleQuery({type:'workspace.previewSourceAssociation',workspaceId,mappings});
  if(!preview.ok||!preview.value.previewToken)throw new Error(`Fixture binding preview failed: ${JSON.stringify(preview)}`);
  const applied=application.handleCommand({type:'workspace.applySourceAssociation',workspaceId,previewToken:preview.value.previewToken});
  if(!applied.ok)throw new Error(`Fixture binding apply failed: ${JSON.stringify(applied)}`);
  return applied.value;
}

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { randomUUID } from 'node:crypto';
import { lstatSync,realpathSync } from 'node:fs';

/** Arrange real historical schemas with SQL, without running a newer binary against them. */
export function seedHistoricalFixture(path,migrations,root,properties=[],{language='en',board=false}={}) {
  const sql=new Database(path),sourceId=randomUUID(),workspaceId=randomUUID(),viewId=randomUUID(),projectId=randomUUID();
  const canonicalRoot=realpathSync.native(root);
  const identity=path=>{const stat=lstatSync(path,{bigint:true});return JSON.stringify({dev:String(stat.dev),ino:String(stat.ino),birthtimeNs:String(stat.birthtimeNs)});};
  const definitions=[];
  try {
    migrate(drizzle(sql),{migrationsFolder:migrations});sql.pragma('foreign_keys = ON');
    sql.transaction(()=>{
      sql.prepare('INSERT INTO settings VALUES (?,?)').run('language',language);
      sql.prepare("INSERT INTO sources (id,canonical_root,discovery_mode,discovery_revision,property_revision,applied_root_identity) VALUES (?,?,'direct',1,11,?)").run(sourceId,canonicalRoot,identity(canonicalRoot));
      sql.prepare("INSERT INTO workspaces (id,name,position,source_id) VALUES (?,'Before',0,?)").run(workspaceId,sourceId);
      sql.prepare("INSERT INTO views (id,workspace_id,name,kind) VALUES (?,?,'Table','table')").run(viewId,workspaceId);
      let activeViewId=viewId;
      if(board){activeViewId=randomUUID();sql.prepare("INSERT INTO views (id,workspace_id,name,kind,position) VALUES (?,?,'Board','board',1)").run(activeViewId,workspaceId);}
      if(sql.prepare("SELECT 1 FROM sqlite_schema WHERE name='workspace_view_selection'").get())sql.prepare('INSERT INTO workspace_view_selection VALUES (?,?)').run(workspaceId,activeViewId);
      sql.prepare("INSERT INTO active_workspace VALUES ('active',?,?)").run(workspaceId,activeViewId);
      sql.prepare("INSERT INTO projects (id,source_id,relative_path,native_identity,association_state) VALUES (?,?,'Project',?,'active')").run(projectId,sourceId,identity(canonicalRoot+'/Project'));
      for(const [position,property] of properties.entries()){
        const id=randomUUID();definitions.push({id,...property});
        sql.prepare('INSERT INTO property_definitions (id,source_id,name,property_type,position) VALUES (?,?,?,?,?)').run(id,sourceId,property.name,property.type,position);
        if(property.type==='single_select'){
          const optionId=randomUUID();definitions.at(-1).optionId=optionId;
          sql.prepare('INSERT INTO select_options (id,source_id,property_id,name,color,position) VALUES (?,?,?,?,?,0)').run(optionId,sourceId,id,property.option.name,property.option.color);
          sql.prepare('INSERT INTO select_property_values VALUES (?,?,?,?)').run(projectId,id,sourceId,optionId);
          if(property.option.hidden)sql.prepare('INSERT INTO select_option_visibility VALUES (?,?,1)').run(workspaceId,optionId);
        }else{
          const table={text:'text_property_values',number:'number_property_values',date:'date_property_values'}[property.type];
          if(!table)throw new Error('Unsupported historical fixture type');
          sql.prepare(`INSERT INTO ${table} VALUES (?,?,?,?)`).run(projectId,id,sourceId,property.value);
        }
      }
    })();
    const rows=Object.fromEntries(sql.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name!='__drizzle_migrations'").all()
      .map(({name})=>[name,sql.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all()]));
    return {sourceId,workspaceId,viewId,projectId,canonicalRoot,definitions,rows};
  }finally{sql.close();}
}

export function assertHistoricalFixturePreserved(assert,path,before){
 const sql=new Database(path);
 try{
  for(const [table,rows] of Object.entries(before.rows)){
    const expected=withIdentityMigrationDefaults(table,rows).map(row=>table==='views'?{position:0,filter_config:'{"search":"","rules":[]}',grouping_config:'{"propertyId":null,"settings":[]}',board_config:'{"widths":[],"properties":[],"wrap":true}',table_config:'{"columns":[],"rowOrder":[]}',...row}:row);
    assert.deepEqual(sql.prepare(`SELECT * FROM "${table}" ORDER BY rowid`).all(),expected,table);
  }
  assert.deepEqual(sql.pragma('foreign_key_check'),[]);
 }finally{sql.close();}
}

export function assertHistoricalPublicMetadata(assert,application,fixture){
 const result=application.handleQuery({type:'workspace.listTextProperties',workspaceId:fixture.workspaceId});assert.equal(result.ok,true,JSON.stringify(result));
 const snapshot=result.value;
 assert.equal(snapshot.revision,fixture.rows.sources[0].property_revision);
 assert.deepEqual(snapshot.definitions,fixture.definitions.map(p=>({propertyId:p.id,sourceId:fixture.sourceId,name:p.name,propertyType:p.type})));
 for(const [type,key] of [['text','values'],['number','numberValues'],['date','dateValues']]){
  assert.deepEqual(snapshot[key]??[],fixture.definitions.filter(p=>p.type===type).map(p=>({projectId:fixture.projectId,propertyId:p.id,value:p.value})));
 }
 for(const p of fixture.definitions.filter(p=>p.type==='single_select')){
  assert.ok(snapshot.selectValues.some(v=>v.projectId===fixture.projectId&&v.propertyId===p.id&&v.optionId===p.optionId));
  assert.ok(snapshot.selectOptions.some(o=>o.optionId===p.optionId&&o.name===p.option.name&&o.color===p.option.color&&o.hidden===!!p.option.hidden));
 }
 return result;
}

/** Existing rewind fixtures must remove every additive 0025 object before replay. */
export function rewindCreationAuthorization(db) {
 db.exec(`DROP TRIGGER category_folder_authority_update;
 DROP TRIGGER category_folder_attestation_insert; DROP TRIGGER category_folder_attestation_update; DROP TRIGGER category_folder_attestation_delete;
 DROP TABLE category_folder_attestations; ALTER TABLE category_folder_operations DROP COLUMN authorization; ALTER TABLE category_folder_operations DROP COLUMN destination_evidence;
 DROP TRIGGER project_category_move_authority_update;
 DROP TRIGGER project_category_move_attestation_insert; DROP TRIGGER project_category_move_attestation_update; DROP TRIGGER project_category_move_attestation_delete;
 DROP TABLE project_category_move_attestations; ALTER TABLE project_category_move_operations DROP COLUMN original_authorization; ALTER TABLE project_category_move_operations DROP COLUMN destination_authorization; ALTER TABLE project_category_move_operations DROP COLUMN project_evidence;
 DROP TRIGGER project_rename_authority_update;
 DROP TRIGGER project_rename_attestation_insert; DROP TRIGGER project_rename_attestation_update; DROP TRIGGER project_rename_attestation_delete;
 DROP TABLE project_rename_attestations; ALTER TABLE project_rename_operations DROP COLUMN authorization; ALTER TABLE project_rename_operations DROP COLUMN project_evidence;
 DROP TRIGGER project_creation_authority_update;
 DROP TRIGGER project_creation_attestation_insert; DROP TRIGGER project_creation_attestation_update; DROP TRIGGER project_creation_attestation_delete;
 DROP TABLE project_creation_attestations;
 ALTER TABLE project_creation_operations DROP COLUMN authorization;
 ALTER TABLE project_creation_operations DROP COLUMN destination_evidence;`);
}
