/**
 * Contract fixture for the unconverted #72 command engines, NOT the application API.
 * Uses the actual production factories, real SQLite/triggers and native adapters.
 * The application WorkspaceService gate is never disabled or patched. No durable
 * evidence is backfilled after an operation. legacyProjectList is a fixture peer
 * for these engines' legacy-triple contract, not evidence for #71 discovery.
 */
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import * as schema from '../../src/service/db/schema.ts';
import { openSettingsService as openApplicationService } from '../../dist/service/settings.mjs';
import { renameNoReplace } from '../../dist/service/project-rename-filesystem.mjs';
import { createProjectCreationService } from '../../src/service/project-creation.ts';
import { createProjectRenameService } from '../../src/service/project-rename.ts';
import { createProjectCategoryMoveService } from '../../src/service/project-category-move.ts';
import { createCategoryOptionsService } from '../../src/service/category-options.ts';
import { createCategoryRemovalService } from '../../src/service/category-removal.ts';
import { createProjectArchiveService } from '../../src/service/project-archive.ts';
import { createProjectArchiveMutations } from '../../src/service/project-archive-mutations.ts';
import { createProjectRecoveryService } from '../../src/service/project-recovery.ts';
import { createProjectRevealService } from '../../src/service/project-reveal.ts';
import { createProjectFilesService } from '../../src/service/project-files.ts';
import { assignProjectGroup } from '../../src/service/group-assignment.ts';
import { planDiscovery, scanDirectSource, scanGroupedSource, sameIdentity, reliableIdentity, projectExclusions, modeRetainedResolution } from '../../src/service/discovery.ts';
import { createWorkspacePublisher } from '../../src/service/workspace-publication.ts';
import { readProjectReservations } from '../../src/service/project-rename-reservations.ts';

export function openUnconvertedEngineFixture(path, migrations, workspaceFilesystem, observer, filesystem, native = renameNoReplace) {
  const application = openApplicationService(path,migrations,workspaceFilesystem,observer,filesystem,native);
  const sqlite = new Database(path); sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite,{schema}), listeners = new Set();
  let engines=[], requests={};
  const publish=createWorkspacePublisher(listeners), callbacks=[];
  const sourceFor = workspaceId => db.select().from(schema.workspaces).innerJoin(schema.sources,eq(schema.workspaces.sourceId,schema.sources.id))
    .where(eq(schema.workspaces.id,workspaceId)).get()?.sources;
  function legacyProjectList(workspaceId, suppliedSource, suppliedScan) {
    const source=suppliedSource??sourceFor(workspaceId);
    if(!source)return {ok:false,error:{code:'invalid_input',message:'Choose a saved workspace.'}};
    const mode=source.discoveryMode;
    const scan=suppliedScan??(mode==='grouped'?scanGroupedSource:scanDirectSource)(source.canonicalRoot,source.archiveRelativePath,
      projectExclusions(JSON.parse(source.excludedRelativePaths),mode==='grouped'?'grouped':'direct').effective);
    let state=scan.state;
    if(scan.snapshot&&(!reliableIdentity(scan.snapshot.root.identity)||source.appliedRootIdentity&&!sameIdentity(JSON.parse(source.appliedRootIdentity),scan.snapshot.root.identity)))state='root_identity_conflict';
    const projects=db.select().from(schema.projects).where(eq(schema.projects.sourceId,source.id)).all().sort((a,b)=>a.id.localeCompare(b.id));
    const categories=db.select().from(schema.categories).where(eq(schema.categories.sourceId,source.id)).all().sort((a,b)=>a.id.localeCompare(b.id));
    const plan=scan.snapshot&&state!=='root_identity_conflict'?planDiscovery(scan,categories,projects,readProjectReservations(db,source.id)):null;
    const archived=new Set(db.select().from(schema.projectArchives).where(eq(schema.projectArchives.sourceId,source.id)).all().map(row=>row.projectId));
    const rows=projects.filter(row=>!archived.has(row.id)).map(row=>({projectId:row.id,relativePath:row.relativePath,name:row.relativePath.split('/').at(-1),
      categoryId:row.categoryId,categoryName:categories.find(c=>c.id===row.categoryId)?.relativePath??null,retentionReason:row.modeInactive?'mode_change':null,
      associationState:row.associationState,resolution:row.modeInactive?modeRetainedResolution(plan?scan:{...scan,snapshot:null},row,JSON.parse(source.excludedRelativePaths),source.archiveRelativePath):plan?.projects.retained.find(p=>p.id===row.id)?.associationState??null})).sort((a,b)=>a.relativePath.localeCompare(b.relativePath,'en'));
    const active=rows.filter(row=>row.retentionReason===null&&row.associationState==='active'&&(row.resolution==='active'||row.resolution===null));
    const retained=rows.filter(row=>!active.includes(row));
    const property=db.select().from(schema.categoryProperties).where(eq(schema.categoryProperties.sourceId,source.id)).get();
    return {workspaceId,sourceId:source.id,revision:source.discoveryRevision,configured:mode!==null,mode,categories:categories.filter(c=>mode==='grouped'&&!c.modeInactive&&c.associationState==='active'&&(!plan||plan.categories.retained.find(p=>p.id===c.id)?.associationState==='active'))
      .map(c=>({categoryId:c.id,relativePath:c.relativePath,name:c.relativePath})).sort((a,b)=>a.relativePath.localeCompare(b.relativePath,'en')),
      categoryProperty:mode==='grouped'&&property?{propertyId:property.id,sourceId:source.id,name:property.name}:null,categoryPropertyRevision:source.categoryPropertyRevision,state,projects:active,retainedProjects:retained,retainedCount:retained.length};
  }
  function invalidateSourceReviews(sourceId){for(const engine of engines)engine.invalidateSource?.(sourceId);}
  function committed(sourceId,revision,workspaceIds,presentation=false){
    const ids=workspaceIds??db.select().from(schema.workspaces).where(eq(schema.workspaces.sourceId,sourceId)).all().sort((a,b)=>a.position-b.position).map(w=>w.id);
    callbacks.push({type:'committed',sourceId,revision,workspaceIds:ids,presentation});
    if(presentation){publish([{type:'workspace.categoryPresentationChanged',sourceId,workspaceIds:ids}]);return;}
    invalidateSourceReviews(sourceId);
    publish([{type:'workspace.projectsChanged',sourceId,revision,workspaceIds:ids}]);
  }
  function install(){
    const hooks={invalidateSourceReviews,committed,settled(sourceId){callbacks.push({type:'settled',sourceId});}};
    const creation=createProjectCreationService(db,hooks,filesystem),rename=createProjectRenameService(db,hooks,filesystem,native),move=createProjectCategoryMoveService(db,hooks,filesystem,native);
    const options=createCategoryOptionsService(db,committed,filesystem,native),removal=createCategoryRemovalService(db,move,committed,filesystem);
    const archive=createProjectArchiveService(db,hooks,filesystem),archiveMutations=createProjectArchiveMutations(db,hooks,filesystem,native);
    const recovery=createProjectRecoveryService(db,{...hooks,projectList:legacyProjectList}),reveal=createProjectRevealService(db,filesystem),files=createProjectFilesService(reveal.authorizeProject);
    engines=[creation,rename,move,options,removal,archive,archiveMutations,recovery,reveal,files];
    requests=Object.assign({},...engines.map(engine=>Object.fromEntries(Object.entries(engine).filter(([key])=>!['close','removeWorkspace','invalidateSource','authorizeProject','listCategoryPresentation','setCategoryPresentation'].includes(key)))));
  }
  install();
  let enginesClosed=false,databaseClosed=false;
  function closeEngines(){if(enginesClosed)return;enginesClosed=true;for(const engine of engines)engine.close?.();application.workspaces.close();}
  const workspace=new Proxy({}, {get(_target,key){
    if(key==='close')return closeEngines;
    if(key==='remove')return input=>{const result=application.workspaces.remove(input);if(result.ok)for(const engine of engines)engine.removeWorkspace?.(input.workspaceId);return result;};
    if(key==='subscribe')return listener=>{listeners.add(listener);const stop=application.workspaces.subscribe(listener);return()=>{listeners.delete(listener);stop();};};
    if(key==='assignProjectGroup')return input=>assignProjectGroup(workspace,input);
    if(key in requests)return requests[key];
    const method=application.workspaces[key];return typeof method==='function'?method.bind(application.workspaces):method;
  }});
  function dispatch(input,kind){
    const method=typeof input?.type==='string'&&input.type.startsWith('workspace.')?input.type.slice('workspace.'.length):null;
    if(method==='assignProjectGroup')return assignProjectGroup(workspace,input);
    if(method&&requests[method])return requests[method](input);
    const result=application[kind](input);
    if(input?.type==='data.restore'&&result.ok){for(const engine of engines)engine.close?.();install();}
    return result;
  }
  const engineService={...application,...Object.fromEntries(Object.keys(requests).map(key=>[key,(...args)=>requests[key](...args)])),application,callbacks,invalidateSource:invalidateSourceReviews,get workspaces(){return workspace;},handleQuery:input=>dispatch(input,'handleQuery'),handleCommand:input=>dispatch(input,'handleCommand'),
    renameProject:input=>requests.renameProject(input),moveProjectCategory:input=>requests.moveProjectCategory(input),
    revealProject:(...args)=>requests.revealProject(...args),projectFileCommand:(...args)=>requests.projectFileCommand(...args),
    close(){if(databaseClosed)return;databaseClosed=true;closeEngines();listeners.clear();sqlite.close();application.close();}};
  return {application,engines:engineService,callbacks};
}
