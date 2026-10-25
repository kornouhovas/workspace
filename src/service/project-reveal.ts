import { scanRoleSource, scanConfiguredSource, planRoleDiscovery, rolePlacement, savedFolderRoles } from "./folder-roles.js";
import {isDeepStrictEqual} from 'node:util';
import {parseArchiveAuthorizationV1,parseArchiveParents,archiveParentPathsMatch} from './archive-proof.js';
import {parseArchivedFolderAssociation,archivedAssociationMatchesRecord} from './archive-association.js';
import {join} from 'node:path';
import {createFilesystemAuthorization} from './filesystem-authorization.js';
import {rootOwnershipConflict,continuityRecords,storedEvidence,reservationOwnsFolder,type EvidenceReader} from './source-identity.js';
import {durableOwnershipKey,sameDurableFolder} from './folder-evidence.js';
import { readProjectRelocationReservations, readProjectReservations } from "./project-rename-reservations.js";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { isProjectRevealRequest, type ProjectRevealProblem, type ProjectRevealResult } from "../contracts/project-reveal.js";
import type { ServiceResult } from "../contracts/settings.js";
import type { NativeProjectReveal, NativeProjectRevealValidation, TrustedProjectRevealTarget } from "../contracts/service-protocol.js";
import { isChildName, planDiscovery, projectExclusions, sameIdentity, scanDirectSource, scanGroupedSource, validArchive, validExclusions } from "./discovery.js";
import { nativeProjectFilesystem, verifyTrustedProjectRevealTarget, RevealFailure, type ProjectFilesystem } from "./project-filesystem.js";
import * as schema from "./db/schema.js";
import { filesystemAlias } from "./path-alias.js";

export function createProjectRevealService(db: BetterSQLite3Database<typeof schema>, filesystem: ProjectFilesystem = nativeProjectFilesystem, policy?:{scope:string;read:EvidenceReader}) {
  let closed = false;
  // A request-local receipt can acknowledge an already completed native call
  // across a dirty scan only while every persisted authorization input is unchanged.
  function authorizationFor(workspaceId: string, projectId: string): string {
    const workspace = db.select().from(schema.workspaces).where(eq(schema.workspaces.id, workspaceId)).get();
    const source = workspace && db.select().from(schema.sources).where(eq(schema.sources.id, workspace.sourceId)).get();
    const project = db.select().from(schema.projects).where(eq(schema.projects.id, projectId)).get();
    if (!source || !project || project.sourceId !== source.id) throw new InvalidReveal();
    const ordered = <T extends { id: string }>(rows: T[]) => rows.sort((a, b) => a.id.localeCompare(b.id));
    return JSON.stringify([workspace, source, ordered(db.select().from(schema.projects).where(eq(schema.projects.sourceId, source.id)).all()),
      ordered(db.select().from(schema.categories).where(eq(schema.categories.sourceId, source.id)).all()),
      readProjectReservations(db, source.id), readProjectRelocationReservations(db, source.id),
      ordered(db.select().from(schema.projectArchives).where(eq(schema.projectArchives.sourceId, source.id)).all().map(row => ({ ...row, id: row.projectId }))),
      ordered(db.select().from(schema.archivedFolderAssociations).where(eq(schema.archivedFolderAssociations.sourceId,source.id)).all()),
      ordered(db.select().from(schema.sources).all().filter(peer=>peer.id!==source.id))]);
  }
  function verifyPeerProject(sourceId:string,path:string,proof:import('./filesystem-authorization.js').VerifiedFolder) {
    const peers=db.select().from(schema.sources).all().filter(peer=>peer.id!==sourceId);
    if(rootOwnershipConflict(proof,peers,policy!.scope,policy!.read) || peers.some(peer=>{
      if(filesystemAlias(peer.canonicalRoot)===filesystemAlias(path))return true;
      if(peer.durableEvidence!==null)return !storedEvidence(peer.durableEvidence);
      try{const native=JSON.parse(peer.appliedRootIdentity??"null");return native&&native.ino===proof.mount.ino&&native.birthtimeNs===proof.mount.birthtimeNs;}catch{return true;}
    }))throw new RevealFailure("unresolved");
  }
  function durableArchivedTarget(source:typeof schema.sources.$inferSelect,project:typeof schema.projects.$inferSelect,archive:typeof schema.projectArchives.$inferSelect):TrustedProjectRevealTarget {
    if(!source.archiveRelativePath || !validArchive(source.archiveRelativePath) || archive.sourceId!==source.id || archive.originalRelativePath!==project.relativePath ||
      !project.modeInactive || !archive.relativePath.startsWith(source.archiveRelativePath+'/'))throw new RevealFailure("unresolved");
    const authorizer=createFilesystemAuthorization(policy!.scope,policy!.read,db),frame=authorizer.capture(source,"",source.durableEvidence),saved=storedEvidence(project.durableEvidence);
    if(!saved)throw new RevealFailure("unresolved");
    const receipts=db.select().from(schema.archivedFolderAssociations).where(eq(schema.archivedFolderAssociations.projectId,project.id)).all().map(row=>{
      const value=parseArchivedFolderAssociation(row.authorization);
      if(!value||!archivedAssociationMatchesRecord(row,row.id,value)||value.sourceId!==source.id||row.generation>source.evidenceGeneration)throw new RevealFailure("unresolved");return value;
    });
    const approved=receipts.find(value=>isDeepStrictEqual(value.archive,archive)&&sameDurableFolder(value.root.root.evidence,frame.root.evidence)&&sameDurableFolder(value.project.evidence,saved));
    const old=parseArchiveAuthorizationV1(archive.authorization),parents=parseArchiveParents(JSON.parse(archive.parents),archive.authorization!==null);
    if(archive.authorization!==null&&(!old || old.root.generation>source.evidenceGeneration) || !parents || !archiveParentPathsMatch(parents,archive.relativePath) || !approved&&(!old || !sameDurableFolder(old.root.root.evidence,frame.root.evidence) || !sameDurableFolder(old.project.evidence,saved)))throw new RevealFailure("unresolved");
    const parts=archive.relativePath.split('/');
    if(!parts.every(isChildName))throw new RevealFailure("unresolved");
    const folders=[{relativePath:"",evidence:frame.root.evidence,mount:frame.root.mount}];
    for(const [index,name] of parts.entries()) {
      const relativePath=parts.slice(0,index+1).join('/'),parent=join(source.canonicalRoot,...parts.slice(0,index));
      if(filesystem.names(parent).some(entry=>entry!==name&&filesystemAlias(entry)===filesystemAlias(name)))throw new RevealFailure("unresolved");
      const expected=index===parts.length-1?saved:(approved?.parents[index].observation??parents![index].observation)?.evidence;
      if(!expected)throw new RevealFailure("unresolved");
      const observed=authorizer.observe(join(source.canonicalRoot,relativePath),frame.root,filesystem.inspect(join(source.canonicalRoot,relativePath)).identity,expected);
      folders.push({relativePath,evidence:observed.evidence,mount:observed.mount});
    }
    const projectProof=folders.at(-1)!;verifyPeerProject(source.id,join(source.canonicalRoot,archive.relativePath),{ok:true,...projectProof});
    const reservations=readProjectReservations(db,source.id);
    if(reservations.some(row=>row.projectId===project.id || folders.some(folder=>row.relativePath===folder.relativePath||reservationOwnsFolder(row,{ok:true,...folder}))))throw new RevealFailure("unresolved");
    const records=[...db.select().from(schema.projects).where(eq(schema.projects.sourceId,source.id)).all(),...db.select().from(schema.categories).where(eq(schema.categories.sourceId,source.id)).all()];
    for(const row of records.filter(row=>row.id!==project.id)) {
      const proof=storedEvidence(row.durableEvidence),native=JSON.parse(row.nativeIdentity);
      if(source.folderRoles && row.modeInactive && ["active","excluded"].includes(row.associationState) && (row.relativePath===project.relativePath || !("categoryId" in row)) && proof && sameDurableFolder(proof,saved))continue;
      if(row.durableEvidence!==null&&!proof)throw new RevealFailure("unresolved");
      for(const folder of folders)if(row.relativePath===folder.relativePath || (proof?durableOwnershipKey(proof)===durableOwnershipKey(folder.evidence):native.ino===folder.mount.ino&&native.birthtimeNs===folder.mount.birthtimeNs)) {
        if(!("categoryId" in row) && folder.relativePath!==archive.relativePath && !row.modeInactive && row.associationState==="active" && proof&&sameDurableFolder(proof,folder.evidence))continue;
        throw new RevealFailure("unresolved");
      }
    }
    const base=join(source.canonicalRoot,source.archiveRelativePath),scan=source.folderRoles ? scanRoleSource(base,null,[],savedFolderRoles(source)!,"grouped") : (archive.mode==="grouped"?scanGroupedSource:scanDirectSource)(base,null,[]),baseProof=folders.find(folder=>folder.relativePath===source.archiveRelativePath);
    if(!scan.snapshot || !baseProof || !sameIdentity(scan.snapshot.root.identity,baseProof.mount))throw new RevealFailure("unresolved");
    const ordinary=scanConfiguredSource(source,projectExclusions(JSON.parse(source.excludedRelativePaths),source.discoveryMode==="grouped"?"grouped":"direct").effective);
    if(!ordinary.snapshot || !sameIdentity(ordinary.snapshot.root.identity,frame.root.mount))throw new RevealFailure("unresolved");
    for(const inventory of [{scan,base,prefix:source.archiveRelativePath},{scan:ordinary,base:source.canonicalRoot,prefix:""}])for(const entry of inventory.scan.entries.filter(entry=>entry.reason===null)) {
      const relativePath=[inventory.prefix,entry.relativePath].filter(Boolean).join('/');
      const observed=policy!.read(join(inventory.base,entry.relativePath),policy!.scope);
      if(observed.ok&&folders.some(folder=>folder.relativePath!==relativePath&&durableOwnershipKey(observed.evidence)===durableOwnershipKey(folder.evidence)))throw new RevealFailure("unresolved");
    }
    const ancestors=folders.slice(1,-1).map(folder=>({relativePath:folder.relativePath,identity:JSON.stringify(folder.mount)}));
    const target:TrustedProjectRevealTarget={canonicalRoot:source.canonicalRoot,relativePath:archive.relativePath,parentRelativePath:parts.slice(0,-1).join('/'),rootIdentity:JSON.stringify(frame.root.mount),parentIdentity:JSON.stringify(folders.at(-2)!.mount),nativeIdentity:JSON.stringify(projectProof.mount),ancestors,authorization:{version:1,generation:source.evidenceGeneration,folders}};
    verifyTrustedProjectRevealTarget(target,filesystem);return target;
  }
  function roleTarget(source: typeof schema.sources.$inferSelect, project: typeof schema.projects.$inferSelect): TrustedProjectRevealTarget {
    if(project.modeInactive || project.associationState!=="active")throw new RevealFailure("mode_retained");
    const roles=savedFolderRoles(source)!;
    const placement=rolePlacement(project.relativePath,roles,source.discoveryMode === "grouped" ? "grouped":"direct");
    if(!placement.recognized)throw new RevealFailure("mode_retained");
    const projects=db.select().from(schema.projects).where(eq(schema.projects.sourceId,source.id)).all();
    const categories=db.select().from(schema.categories).where(eq(schema.categories.sourceId,source.id)).all();
    const category=categories.find(row=>row.id===project.categoryId);
    if(placement.categoryPath===null ? project.categoryId!==null : !category || category.modeInactive || category.associationState!=="active" || category.relativePath!==placement.categoryPath)throw new RevealFailure("category_unavailable");
    const reservations=readProjectReservations(db,source.id);
    const authorizer=createFilesystemAuthorization(policy!.scope,policy!.read,db),frame=authorizer.capture(source,"",source.durableEvidence);
    const scan=scanConfiguredSource(source,JSON.parse(source.excludedRelativePaths));
    if(!scan.snapshot || !sameIdentity(scan.snapshot.root.identity,frame.root.mount))throw new RevealFailure("unavailable");
    const planned=planRoleDiscovery(scan,continuityRecords(source,scan,categories,policy!.scope,policy!.read),continuityRecords(source,scan,projects,policy!.scope,policy!.read),reservations);
    if(planned.projects.retained.find(row=>row.id===project.id)?.associationState!=="active")throw new RevealFailure("unresolved");
    if(category && planned.categories.retained.find(row=>row.id===category.id)?.associationState!=="active")throw new RevealFailure("category_unavailable");
    const folders=[{relativePath:"",evidence:frame.root.evidence,mount:frame.root.mount}];
    const parts=project.relativePath.split("/");
    for(let index=0;index<parts.length;index++) {
      const relativePath=parts.slice(0,index+1).join("/"),child=scan.snapshot.children.find(row=>row.relativePath===relativePath);
      if(child?.kind!=="directory")throw new RevealFailure("unresolved");
      const expected=index===parts.length-1 ? storedEvidence(project.durableEvidence) : categories.find(row=>!row.modeInactive&&row.associationState==="active"&&row.relativePath===relativePath)?.durableEvidence;
      const saved=typeof expected==="string" ? storedEvidence(expected) : expected;
      if(index===parts.length-1&&!saved)throw new RevealFailure("unresolved");
      const proof=authorizer.observe(join(source.canonicalRoot,relativePath),frame.root,child.identity,saved??undefined);
      verifyPeerProject(source.id,join(source.canonicalRoot,relativePath),proof);
      if(reservations.some(row=>row.projectId===project.id || row.relativePath===relativePath || reservationOwnsFolder(row,proof)))throw new RevealFailure("unresolved");
      if(folders.some(folder=>durableOwnershipKey(folder.evidence)===durableOwnershipKey(proof.evidence)))throw new RevealFailure("unresolved");
      if(index===parts.length-1 && [...projects,...categories].some(row=>row.id!==project.id && (()=>{const other=storedEvidence(row.durableEvidence),native=JSON.parse(row.nativeIdentity);return other ? durableOwnershipKey(other)===durableOwnershipKey(proof.evidence) : native.ino===proof.mount.ino&&native.birthtimeNs===proof.mount.birthtimeNs;})()))throw new RevealFailure("unresolved");
      folders.push({relativePath,evidence:proof.evidence,mount:proof.mount});
    }
    const ancestors=folders.slice(1,-1).map(folder=>({relativePath:folder.relativePath,identity:JSON.stringify(folder.mount)}));
    const target:TrustedProjectRevealTarget={canonicalRoot:source.canonicalRoot,relativePath:project.relativePath,parentRelativePath:parts.slice(0,-1).join("/"),rootIdentity:JSON.stringify(frame.root.mount),parentIdentity:JSON.stringify(folders.at(-2)!.mount),nativeIdentity:JSON.stringify(folders.at(-1)!.mount),...(ancestors.length?{ancestors}:{}),authorization:{version:1,generation:source.evidenceGeneration,folders}};
    verifyTrustedProjectRevealTarget(target,filesystem);
    return target;
  }
  function durableTargetFor(workspaceId:string,projectId:string,includeArchived:boolean):{target:TrustedProjectRevealTarget;authorization:string} {
    const authorization=authorizationFor(workspaceId,projectId);
    const source=db.select().from(schema.workspaces).innerJoin(schema.sources,eq(schema.workspaces.sourceId,schema.sources.id)).where(eq(schema.workspaces.id,workspaceId)).get()?.sources;
    const project=db.select().from(schema.projects).where(eq(schema.projects.id,projectId)).get();
    if(!source || !project || project.sourceId!==source.id)throw new InvalidReveal();
    if(source.discoveryMode!=="direct"&&source.discoveryMode!=="grouped")throw new RevealFailure("unconfigured");
    const archive=includeArchived?db.select().from(schema.projectArchives).where(eq(schema.projectArchives.projectId,projectId)).get():undefined;
    if(archive){const target=durableArchivedTarget(source,project,archive);if(authorizationFor(workspaceId,projectId)!==authorization)throw new RevealFailure("unresolved");return {target,authorization};}
    if(source.folderRoles){const target=roleTarget(source,project);if(authorizationFor(workspaceId,projectId)!==authorization)throw new RevealFailure("unresolved");return {target,authorization};}
    if(project.modeInactive)throw new RevealFailure("mode_retained");
    if(project.associationState!=="active")throw new RevealFailure(project.associationState);
    const parts=project.relativePath.split('/');
    if(parts.length!==(source.discoveryMode==="direct"?1:2)||!parts.every(isChildName))throw new RevealFailure("unresolved");
    const categories=db.select().from(schema.categories).where(eq(schema.categories.sourceId,source.id)).all(),projects=db.select().from(schema.projects).where(eq(schema.projects.sourceId,source.id)).all();
    const category=project.categoryId?categories.find(row=>row.id===project.categoryId):null;
    if(source.discoveryMode==="grouped"&&(!category||category.modeInactive||category.associationState!=="active"||category.relativePath!==parts[0]) || source.discoveryMode==="direct"&&project.categoryId!==null)throw new RevealFailure("category_unavailable");
    const authorizer=createFilesystemAuthorization(policy!.scope,policy!.read,db);
    const parentRelativePath=category?.relativePath??"",frame=authorizer.capture(source,parentRelativePath,category?.durableEvidence??source.durableEvidence);
    const saved=storedEvidence(project.durableEvidence);
    if(!saved)throw new RevealFailure("unresolved");
    let proof:import('./filesystem-authorization.js').VerifiedFolder;
    try {
      const entry=filesystem.inspect(join(source.canonicalRoot,project.relativePath));
      if(entry.kind!=="directory")throw new RevealFailure("replaced");
      try{proof=authorizer.observe(join(source.canonicalRoot,project.relativePath),frame.root,entry.identity,saved);}
      catch{throw new RevealFailure("replaced");}
    }catch(error){
      if(error instanceof RevealFailure)throw error;
      const code=(error as NodeJS.ErrnoException).code;
      throw new RevealFailure(code==="ENOENT"||code==="ENOTDIR"?"missing":"unavailable");
    }
    verifyPeerProject(source.id,join(source.canonicalRoot,project.relativePath),proof);
    const reservations=readProjectReservations(db,source.id);
    if(reservations.some(row=>row.projectId===projectId || row.relativePath===project.relativePath || reservationOwnsFolder(row,proof)))throw new RevealFailure("unresolved");
    const exclusions:unknown=JSON.parse(source.excludedRelativePaths);
    if(!validExclusions(exclusions,"grouped",!!source.folderRoles)||!validArchive(source.archiveRelativePath))throw new RevealFailure("unresolved");
    const scan=(source.discoveryMode==="grouped"?scanGroupedSource:scanDirectSource)(source.canonicalRoot,source.archiveRelativePath,projectExclusions(exclusions,source.discoveryMode).effective);
    if(!scan.snapshot){if(scan.state==="changed")throw new UnstableRevealScan();throw new RevealFailure("unavailable");}
    if(!sameIdentity(scan.snapshot.root.identity,frame.root.mount))throw new RevealFailure("root_replaced");
    const planned=planDiscovery(scan,continuityRecords(source,scan,categories,policy!.scope,policy!.read),continuityRecords(source,scan,projects,policy!.scope,policy!.read),reservations);
    if(planned.projects.retained.find(row=>row.id===projectId)?.associationState!=="active" || category&&planned.categories.retained.find(row=>row.id===category.id)?.associationState!=="active")throw new RevealFailure("unresolved");
    const key=durableOwnershipKey(proof.evidence);
    if([...categories,...projects].some(row=>row.id!==projectId && (()=>{const other=storedEvidence(row.durableEvidence);if(other)return durableOwnershipKey(other)===key;
      const native=JSON.parse(row.nativeIdentity);return row.durableEvidence!==null || native.ino===proof.mount.ino&&native.birthtimeNs===proof.mount.birthtimeNs;})()))throw new RevealFailure("unresolved");
    for(const entry of scan.entries.filter(entry=>entry.reason===null && entry.relativePath!==project.relativePath)) {
      const other=policy!.read(join(source.canonicalRoot,entry.relativePath),policy!.scope);
      const protectedFolders=[{path:"",proof:frame.root},{path:parentRelativePath,proof:frame.parent},{path:project.relativePath,proof}];
      if(other.ok&&protectedFolders.some(folder=>folder.path!==entry.relativePath&&durableOwnershipKey(other.evidence)===durableOwnershipKey(folder.proof.evidence)))throw new RevealFailure("unresolved");
    }
    const folders=[{relativePath:"",evidence:frame.root.evidence,mount:frame.root.mount},...(parentRelativePath?[{relativePath:parentRelativePath,evidence:frame.parent.evidence,mount:frame.parent.mount}]:[]),{relativePath:project.relativePath,evidence:proof.evidence,mount:proof.mount}];
    const target:TrustedProjectRevealTarget={canonicalRoot:source.canonicalRoot,parentRelativePath,relativePath:project.relativePath,rootIdentity:JSON.stringify(frame.root.mount),parentIdentity:JSON.stringify(frame.parent.mount),nativeIdentity:JSON.stringify(proof.mount),authorization:{version:1,generation:source.evidenceGeneration,folders}};
    verifyTrustedProjectRevealTarget(target,filesystem);
    if(authorizationFor(workspaceId,projectId)!==authorization)throw new RevealFailure("unresolved");
    return {target,authorization};
  }
  function targetFor(workspaceId: string, projectId: string, includeArchived = false): { target: TrustedProjectRevealTarget; authorization: string } {
    if(policy)return durableTargetFor(workspaceId,projectId,includeArchived);
    const authorization = authorizationFor(workspaceId, projectId);
    const source = db.select().from(schema.workspaces).innerJoin(schema.sources, eq(schema.workspaces.sourceId, schema.sources.id))
      .where(eq(schema.workspaces.id, workspaceId)).get()?.sources;
    const project = db.select().from(schema.projects).where(eq(schema.projects.id, projectId)).get();
    if (!source || !project || project.sourceId !== source.id) throw new InvalidReveal();
    if (source.discoveryMode !== "direct" && source.discoveryMode !== "grouped" || source.appliedRootIdentity === null) throw new RevealFailure("unconfigured");
    if (readProjectRelocationReservations(db, source.id).some((row) => row.projectId === projectId)) throw new RevealFailure("unresolved");
    const archived = includeArchived && db.select().from(schema.projectArchives).where(eq(schema.projectArchives.projectId, projectId)).get();
    if (archived) {
      if (archived.sourceId !== source.id || !source.archiveRelativePath || !validArchive(source.archiveRelativePath) ||
        !archived.relativePath.startsWith(`${source.archiveRelativePath}/`)) throw new RevealFailure("unresolved");
      const parents: { path: string; identity: unknown }[] = JSON.parse(archived.parents);
      const ancestors = parents.map(parent => ({ relativePath: parent.path, identity: JSON.stringify(parent.identity) }));
      const target: TrustedProjectRevealTarget = { canonicalRoot: source.canonicalRoot, rootIdentity: source.appliedRootIdentity,
        relativePath: archived.relativePath, parentRelativePath: archived.relativePath.split("/").slice(0, -1).join("/"),
        parentIdentity: ancestors.at(-1)?.identity ?? source.appliedRootIdentity, nativeIdentity: project.nativeIdentity, ancestors };
      if (readProjectReservations(db, source.id).some(row => row.projectId === projectId ||
        filesystemAlias(row.relativePath) === filesystemAlias(archived.relativePath))) throw new RevealFailure("unresolved");
      verifyTrustedProjectRevealTarget(target, filesystem);
      if (authorizationFor(workspaceId, projectId) !== authorization) throw new RevealFailure("unresolved");
      return { target, authorization };
    }
    if (project.modeInactive) throw new RevealFailure("mode_retained");
    if (project.associationState !== "active") throw new RevealFailure(project.associationState);
    const components = project.relativePath.split("/");
    if (components.length !== (source.discoveryMode === "direct" ? 1 : 2) || !components.every(isChildName) ||
      (source.discoveryMode === "direct" && project.categoryId !== null)) throw new RevealFailure("unresolved");
    let parentRelativePath = "", parentIdentity = source.appliedRootIdentity;
    if (source.discoveryMode === "grouped") {
      const category = project.categoryId ? db.select().from(schema.categories).where(eq(schema.categories.id, project.categoryId)).get() : undefined;
      if (!category || category.sourceId !== source.id || category.modeInactive || category.associationState !== "active" ||
        category.relativePath !== components[0]) throw new RevealFailure("category_unavailable");
      parentRelativePath = category.relativePath; parentIdentity = category.nativeIdentity;
    }
    const target = { canonicalRoot: source.canonicalRoot, parentRelativePath, relativePath: project.relativePath,
      rootIdentity: source.appliedRootIdentity, parentIdentity, nativeIdentity: project.nativeIdentity };
    verifyTrustedProjectRevealTarget(target, filesystem);
    const exclusions: unknown = JSON.parse(source.excludedRelativePaths);
    if (!validExclusions(exclusions, "grouped", !!source.folderRoles) || !validArchive(source.archiveRelativePath)) throw new Error("Invalid source policy");
    const scan = (source.discoveryMode === "grouped" ? scanGroupedSource : scanDirectSource)(source.canonicalRoot,
      source.archiveRelativePath, projectExclusions(exclusions, source.discoveryMode).effective);
    if (!scan.snapshot) {
      if (scan.state === "changed") throw new UnstableRevealScan();
      throw new RevealFailure(scan.state === "root_identity_conflict" ? "root_replaced" : "unavailable");
    }
    if (!sameIdentity(scan.snapshot.root.identity, JSON.parse(source.appliedRootIdentity))) throw new RevealFailure("root_replaced");
    const entry = scan.entries.find((row) => row.kind === "project" && row.relativePath === project.relativePath);
    if (!entry || entry.reason !== null) throw new RevealFailure(entry?.reason === "link" ? "replaced" : "excluded");
    // Outstanding intents/evidence cannot be opened through another logical ID.
    const reservations = readProjectReservations(db, source.id);
    if (reservations.some((row) => !["completed", "failed"].includes(row.stage) &&
      (filesystemAlias(row.relativePath) === filesystemAlias(project.relativePath) ||
        row.nativeIdentity && nativeAlias(row.nativeIdentity, project.nativeIdentity)))) throw new RevealFailure("unresolved");
    const projects = db.select().from(schema.projects).where(eq(schema.projects.sourceId, source.id)).all();
    const identity = JSON.parse(project.nativeIdentity);
    const categories = db.select().from(schema.categories).where(eq(schema.categories.sourceId, source.id)).all();
    const interpretation = planDiscovery(scan, categories, projects, reservations.filter((row) => !["completed", "failed"].includes(row.stage)));
    if (project.categoryId && interpretation.categories.retained.find((row) => row.id === project.categoryId)?.associationState !== "active") throw new RevealFailure("category_unavailable");
    const resolution = interpretation.projects.retained.find((row) => row.id === projectId)?.associationState;
    if (resolution !== "active") throw new RevealFailure(resolution ?? "unresolved");
    if (projects.some((row) => row.id !== projectId && row.associationState !== "replaced" &&
      sameIdentity(JSON.parse(row.nativeIdentity), identity)) || scan.snapshot.children.some((row) => row.kind === "directory" &&
        row.relativePath !== project.relativePath && sameIdentity(row.identity, identity))) throw new RevealFailure("unresolved");
    verifyTrustedProjectRevealTarget(target, filesystem);
    if (authorizationFor(workspaceId, projectId) !== authorization) throw new RevealFailure("unresolved");
    return { target, authorization };
  }
  return {
    close() { closed = true; },
    authorizeProject(workspaceId: string, projectId: string): TrustedProjectRevealTarget {
      if (closed) throw new RevealFailure("request_expired");
      return targetFor(workspaceId, projectId, true).target;
    },
    async revealProject(input: unknown, native?: NativeProjectReveal): Promise<ServiceResult<ProjectRevealResult>> {
      if (!isProjectRevealRequest(input)) return invalid();
      const rejected = (problem: ProjectRevealProblem): ServiceResult<ProjectRevealResult> => ({ ok: true,
        value: { outcome: "rejected", workspaceId: input.workspaceId, projectId: input.projectId, problem } });
      try {
        if (closed) return rejected("request_expired");
        const initial = targetFor(input.workspaceId, input.projectId);
        const target = initial.target;
        let authorization = initial.authorization;
        if (!native) return rejected("native_unavailable");
        const revalidate = (): NativeProjectRevealValidation => {
          if (closed) return { outcome: "rejected", problem: "request_expired" };
          try {
            const current = targetFor(input.workspaceId, input.projectId);
            if (JSON.stringify(current.target) !== JSON.stringify(target)) return { outcome: "rejected", problem: "unresolved" };
            authorization = current.authorization;
            return { outcome: "verified" };
          } catch (error) { return { outcome: "rejected", problem: error instanceof RevealFailure ? error.problem : "request_expired" }; }
        };
        let result;
        try { result = await native(target, revalidate); } catch { return rejected("native_error"); }
        if (closed) return rejected("request_expired");
        if (result.outcome === "rejected") return rejected(result.problem);
        try {
          const current = targetFor(input.workspaceId, input.projectId);
          if (JSON.stringify(current.target) !== JSON.stringify(target)) return rejected("unresolved");
        } catch (error) {
          // This cannot authorize a native effect: that already returned dispatched.
          // Retain policy/ownership and physical target checks without demanding
          // that unrelated file-manager metadata stop changing after the effect.
          if (!(error instanceof UnstableRevealScan) || authorizationFor(input.workspaceId, input.projectId) !== authorization) throw error;
          verifyTrustedProjectRevealTarget(target, filesystem);
          if (authorizationFor(input.workspaceId, input.projectId) !== authorization) return rejected("unresolved");
        }
        return { ok: true, value: { outcome: "dispatched", workspaceId: input.workspaceId, projectId: input.projectId } };
      } catch (error) {
        if (error instanceof InvalidReveal) return invalid();
        if (error instanceof RevealFailure) return rejected(error.problem);
        return { ok: false, error: { code: "storage", message: "The selected project folder could not be verified." } };
      }
    },
  };
}
export class InvalidReveal extends Error {}
class UnstableRevealScan extends RevealFailure {
  constructor() { super("unavailable"); }
}
function invalid(): ServiceResult<never> {
  return { ok: false, error: { code: "invalid_input", message: "Choose a saved workspace and one of its projects." } };
}

function nativeAlias(a: string, b: string): boolean {
  const left = JSON.parse(a), right = JSON.parse(b);
  return left.dev === right.dev && left.ino === right.ino;
}
