import {sourceFolderRolePolicy,scanRoleSource,savedFolderRoles,rolePlacement,relocatedFolderRoles} from "./folder-roles.js";
import {archivedAssociationMatchesRecord,parseArchivedFolderAssociation} from "./archive-association.js";
import {isDeepStrictEqual} from "node:util";
import {legacyArchiveRenewalMatches,parseArchiveAttestation,parseArchiveAuthorization,parseArchiveParents,parseArchiveBindingAuthorization,type ArchiveAuthorization,type ArchiveParent} from "./archive-authorization.js";
import {type VerifiedFolder,type FilesystemAuthorizer,type FilesystemAuthorization} from "./filesystem-authorization.js";
import {storedEvidence} from "./source-identity.js";
import {durableOwnershipKey,sameDurableFolder} from "./folder-evidence.js";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { asc,desc,eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./db/schema.js";
import type { ServiceResult } from "../contracts/settings.js";
import { isArchiveRequest, type ProjectArchivePreview, type ProjectArchiveOperation, type ProjectArchiveResult, type ProjectArchiveRecoveryPreview, type ProjectArchiveOperationList } from "../contracts/project-archive.js";
import { nativeProjectFilesystem, verifyCreationDirectory, validProjectBasename, filesystemCode, assertCreationDestinationFree, type ProjectFilesystem } from "./project-filesystem.js";
import { readProjectReservations } from "./project-rename-reservations.js";
import { filesystemAlias } from "./path-alias.js";
import { scanDirectSource,scanGroupedSource,projectExclusions,reliableIdentity, sameIdentity, type NativeIdentity } from "./discovery.js";
import { renameNoReplace } from "./project-rename-filesystem.js";
import type { ProjectRenameNative } from "./project-rename.js";

type Database = BetterSQLite3Database<typeof schema>;
type Source = typeof schema.sources.$inferSelect;
type Project = typeof schema.projects.$inferSelect;
type Archive = typeof schema.projectArchives.$inferSelect;
type Category = typeof schema.categories.$inferSelect;
type Operation = typeof schema.projectArchiveOperations.$inferSelect;
type Parent = ArchiveParent;
type Binding = { authorization?:ArchiveAuthorization; source: Source; project: Project; archive: Archive | null; category: typeof schema.categories.$inferSelect | null;
  sourceParents: Parent[]; destinationParents: Parent[]; createParent: boolean; mode: "direct" | "grouped"; categoryName: string | null; targetFolderRoles?:string };
class ArchiveFailure extends Error {}
const fail = (reason: string): never => { throw new ArchiveFailure(reason); };
const problem = (e: unknown) => e instanceof ArchiveFailure ? e.message : filesystemCode(e) === "ENOENT" ? "source_unavailable"
  : ["EACCES", "EPERM", "EROFS"].includes(String(filesystemCode(e))) ? "permission_denied" : "filesystem_changed";
const invalid = (): ServiceResult<never> => ({ ok: false, error: { code: "invalid_input", message: "Invalid or stale archive request. Review again." } });
const storage = (): ServiceResult<never> => ({ ok: false, error: { code: "storage", message: "Archive state could not be read or saved." } });
const view = (r: Operation): ProjectArchiveOperation => ({ operationId: r.operationId, sourceId: r.sourceId, projectId: r.projectId, action: r.action,
  originalRelativePath: r.originalRelativePath, requestedRelativePath: r.requestedRelativePath, stage: r.stage, problem: r.problem, completedRevision: r.completedRevision });
export function createProjectArchiveMutations(db: Database, integration: {
  invalidateSourceReviews(sourceId: string): void;
  settled?(sourceId:string):void;
  committed(sourceId: string, revision: number, workspaceIds: string[]): void;
}, filesystem: ProjectFilesystem = nativeProjectFilesystem, native: ProjectRenameNative = renameNoReplace,authorizer?:FilesystemAuthorizer) {
  const reviews = new Map<string, { sourceId: string; workspaceId: string; token: string; preview: ProjectArchivePreview; binding: Binding }>();
  type RecoveryFrame={binding:Binding;parents:Parent[];legacy?:boolean};
  const activeRecovery=new Map<string,RecoveryFrame>();
  const recoveryReviews = new Map<string, { sourceId: string; token: string; fingerprint: string }>();
  const bindingFor=(row:Operation):Binding=>activeRecovery.get(row.operationId)?.binding??JSON.parse(row.binding);
  const parentFrames=(row:Operation):Parent[]=>activeRecovery.get(row.operationId)?.parents??JSON.parse(row.parents);
  const sourceFor = (id: string) => db.select().from(schema.workspaces).innerJoin(schema.sources, eq(schema.workspaces.sourceId, schema.sources.id))
    .where(eq(schema.workspaces.id, id)).get()?.sources;
  const operationFor = (id: string) => db.select().from(schema.projectArchiveOperations).where(eq(schema.projectArchiveOperations.operationId, id)).get();
  const projectFor = (id: string) => db.select().from(schema.projects).where(eq(schema.projects.id, id)).get();
  const archiveFor = (id: string) => db.select().from(schema.projectArchives).where(eq(schema.projectArchives.projectId, id)).get() ?? null;
  const eqJSON = isDeepStrictEqual;
  const sourcePolicy=(source:Source)=>({...sourceFolderRolePolicy(source),propertyRevision:0,categoryPropertyRevision:0});
  function authority(binding:Binding):ArchiveAuthorization|undefined {
    if(!authorizer)return undefined;
    const value=parseArchiveBindingAuthorization(binding);
    if(!value)fail("ownership_uncertain");
    if(value!.version===2 && !archivedAssociationMatchesRecord(db.select().from(schema.archivedFolderAssociations).where(eq(schema.archivedFolderAssociations.id,value!.associationId)).get(),value!.associationId,value!.association))fail("ownership_uncertain");
    return value!;
  }
  function verifyPeerRoots(binding:Binding,original:string,requested:string,recorded:Parent[]=binding.destinationParents) {
    const auth=authority(binding);
    if(!auth)return;
    const key=(path:string)=>filesystemAlias(path.replaceAll("\\","/"));
    const rootKey=key(binding.source.canonicalRoot),from=key(join(binding.source.canonicalRoot,original)),to=key(join(binding.source.canonicalRoot,requested));
    const archiveKey=key(join(binding.source.canonicalRoot,binding.source.archiveRelativePath!));
    // Existing parents are observed, not reassigned or relocated. Only new
    // restore parents and archive destination containers need peer ownership vetoes.
    const protectedParents=binding.archive
      ? recorded.filter(parent=>binding.destinationParents.some(planned=>planned.path===parent.path && planned.identity===null))
      : recorded;
    const proofs=[auth.project,...protectedParents.flatMap(p=>p.observation?[p.observation]:[])];
    for(const peer of db.select().from(schema.sources).all().filter(source=>source.id!==binding.source.id)) {
      const saved=peer.durableEvidence?JSON.parse(peer.durableEvidence):null,native=peer.appliedRootIdentity?JSON.parse(peer.appliedRootIdentity):null;
      if(proofs.some(proof=>saved ? durableOwnershipKey(saved)===durableOwnershipKey(proof.evidence) : native && native.ino===proof.mount.ino && native.birthtimeNs===proof.mount.birthtimeNs))fail("native_conflict");
      const locator=key(peer.canonicalRoot),properAncestor=rootKey.startsWith(locator+"/");
      const movedRoot=locator===from || locator.startsWith(from+"/") || locator===to || locator.startsWith(to+"/");
      const archiveDestination=!binding.archive && (to.startsWith(locator+"/") || locator===archiveKey || locator.startsWith(archiveKey+"/"));
      const newParent=protectedParents.some(parent=>locator===key(join(binding.source.canonicalRoot,parent.path)));
      if(locator===rootKey || !properAncestor && (movedRoot || archiveDestination || newParent))fail("owned_location");
    }
  }
  function verifyNamespace(binding:Binding,original:string,requested:string,recorded:Parent[]=binding.destinationParents,completionCategoryId?:string|null) {
    const auth=authority(binding);if(!auth)return;
    const folders=new Map<string,VerifiedFolder>([["",auth.root.root]]);
    const put=(path:string,proof:VerifiedFolder)=>{
      const before=folders.get(path);
      if(before && (!sameDurableFolder(before.evidence,proof.evidence) || !sameIdentity(before.mount,proof.mount)))fail("filesystem_changed");
      folders.set(path,proof);
    };
    for(const parent of [...binding.sourceParents,...recorded])if(parent.observation) {
      authorizer!.observe(join(binding.source.canonicalRoot,parent.path),auth.root.root,parent.observation.mount,parent.observation.evidence);
      put(parent.path,parent.observation);
    }
    const scan=(base:string,relative:string,expected:VerifiedFolder,archive:string|null,exclusions:string[])=>{
      const observed=binding.source.folderRoles ? scanRoleSource(base,archive,exclusions,savedFolderRoles(binding.source)!,binding.mode) : (binding.mode==="grouped"?scanGroupedSource:scanDirectSource)(base,archive,exclusions);
      if(!observed.snapshot || !sameIdentity(observed.snapshot.root.identity,expected.mount))fail("filesystem_changed");
      for(const entry of observed.entries.filter(e=>e.reason===null)) {
        const child=observed.snapshot!.children.find(c=>c.relativePath===entry.relativePath);
        if(child?.kind!=="directory")continue;
        let proof:VerifiedFolder;
        try{proof=authorizer!.observe(join(base,entry.relativePath),auth.root.root,child.identity);}catch{continue;}
        put([relative,entry.relativePath].filter(Boolean).join("/"),proof);
      }
    };
    root(binding.source,auth.root);
    scan(binding.source.canonicalRoot,"",auth.root.root,binding.source.archiveRelativePath,projectExclusions(JSON.parse(binding.source.excludedRelativePaths),binding.mode).effective);
    const archive=folders.get(binding.source.archiveRelativePath!);
    if(archive)scan(join(binding.source.canonicalRoot,binding.source.archiveRelativePath!),binding.source.archiveRelativePath!,archive,null,[]);
    for(const path of new Set([original,requested])) {
      let entry;try{entry=filesystem.inspect(join(binding.source.canonicalRoot,path));}catch(error){if(filesystemCode(error)==="ENOENT")continue;throw error;}
      if(entry.kind==="directory")put(path,authorizer!.observe(join(binding.source.canonicalRoot,path),auth.root.root,entry.identity));
    }
    const keys=new Map<string,VerifiedFolder[]>();
    for(const proof of folders.values()) {const key=durableOwnershipKey(proof.evidence);keys.set(key,[...(keys.get(key)??[]),proof]);}
    for(const expected of [auth.root.root,auth.project,...binding.sourceParents.flatMap(p=>p.observation?[p.observation]:[]),...recorded.flatMap(p=>p.observation?[p.observation]:[])]) {
      const found=keys.get(durableOwnershipKey(expected.evidence));
      if(found?.length!==1 || !sameDurableFolder(found[0].evidence,expected.evidence) || !sameIdentity(found[0].mount,expected.mount))fail("native_conflict");
    }
    const parents=[...binding.sourceParents,...recorded];
    const records=[...db.select().from(schema.categories).where(eq(schema.categories.sourceId,binding.source.id)).all(),
      ...db.select().from(schema.projects).where(eq(schema.projects.sourceId,binding.source.id)).all().filter(p=>p.id!==binding.project.id)];
    for(const record of records) {
      const saved=storedEvidence(record.durableEvidence),native:NativeIdentity=JSON.parse(record.nativeIdentity);
      if(record.durableEvidence!==null&&!saved)fail("ownership_uncertain");
      if(binding.source.folderRoles && record.modeInactive && ["active","excluded"].includes(record.associationState) && (record.relativePath===binding.project.relativePath || !("categoryId" in record)) &&
        saved && sameDurableFolder(saved,auth.project.evidence))continue;
      const allowed=(parent:Parent)=>{
        if(binding.source.folderRoles && record.modeInactive && record.relativePath===parent.path && parent.identity && parent.observation &&
          explicitlyRecreatedParent(binding.source.id,binding.project.categoryId,parent.path,parent.identity,parent.observation,auth.root))return true;
        if(binding.source.folderRoles && binding.createParent && record.modeInactive && ["active","excluded"].includes(record.associationState) && record.relativePath===parent.path &&
          binding.destinationParents.some(planned=>planned.path===parent.path&&planned.identity===null) &&
          rolePlacement(binding.project.relativePath,savedFolderRoles(binding.source)!,binding.mode).recognized)return true;
        if(binding.source.folderRoles && record.relativePath===parent.path && parent.observation && saved && sameDurableFolder(saved,parent.observation.evidence) &&
          (record.modeInactive && ["active","excluded"].includes(record.associationState) || !("categoryId" in record) && !record.modeInactive && record.associationState==="active"))return true;
        if("categoryId" in record) {
          // A direct-mode project can be retained history for this same grouped
          // category. Its full physical proof must match the explicitly enrolled
          // current parent; this exception grants no authority to that project.
          const category=binding.category;
          return !!category && record.categoryId===null && record.modeInactive && ["active","excluded"].includes(record.associationState) &&
            !archiveFor(record.id) && record.relativePath===category.relativePath && category.relativePath===parent.path &&
            !!saved && !!parent.observation && !!category.durableEvidence &&
            sameDurableFolder(saved,parent.observation.evidence,false) && sameDurableFolder(JSON.parse(category.durableEvidence),parent.observation.evidence);
        }
        if(record.relativePath!==parent.path)return false;
        const same=!!parent.observation && !!saved && sameDurableFolder(saved,parent.observation.evidence);
        if(same && (record.id===binding.category?.id || record.id===completionCategoryId))return true;
        if([...activeRecovery.values()].some(frame=>frame.legacy&&frame.binding===binding) && record.id===binding.category?.id && record.durableEvidence===null &&
          parent.observation && parent.identity && sameIdentity(native,parent.identity))return true;
        const recreated=!!parent.observation && explicitlyRecreatedParent(binding.source.id,binding.project.categoryId,parent.path,parent.identity!,parent.observation,auth.root);
        if(recreated && (binding.source.folderRoles && record.modeInactive || record.id===binding.category?.id || same && !record.modeInactive && record.associationState==="active"))return true;
        return record.id===binding.category?.id && !!binding.archive && binding.createParent && parent.path===parentPath(requested) &&
          binding.destinationParents.some(planned=>planned.path===parent.path&&planned.identity===null);
      };
      for(const parent of parents)if(filesystemAlias(record.relativePath)===filesystemAlias(parent.path) && !allowed(parent))fail("reserved_destination");
      if(record.associationState!=="replaced" && filesystemAlias(record.relativePath)===filesystemAlias(requested))fail("reserved_destination");
      for(const proof of [auth.root.root,auth.project,...parents.flatMap(p=>p.observation?[p.observation]:[])]) {
        const conflict=saved ? durableOwnershipKey(saved)===durableOwnershipKey(proof.evidence) : native.ino===proof.mount.ino&&(native.dev===proof.mount.dev||native.birthtimeNs===proof.mount.birthtimeNs);
        if(conflict && !parents.some(parent=>parent.observation && sameDurableFolder(parent.observation.evidence,proof.evidence) && allowed(parent)))fail("native_conflict");
      }
    }
    root(binding.source,auth.root);
  }
  function root(source: Source,frame?:FilesystemAuthorization) {
    if (!source.appliedRootIdentity) fail("unconfigured");
    if(authorizer) {
      if(!frame)fail("ownership_uncertain");
      authorizer.verify(frame!,source,"",source.durableEvidence);
    }
    verifyCreationDirectory(filesystem, source.canonicalRoot, frame?.root.mount??JSON.parse(source.appliedRootIdentity!));
    filesystem.assertAccessible?.(source.canonicalRoot);
  }
  function validPath(path: string) {
    return path.split("/").every(p => validProjectBasename(p, filesystem.platform) && !p.startsWith(".") && !/^(\$RECYCLE.BIN|System Volume Information)$/i.test(p));
  }
  function parents(source: Source, path: string,frame?:FilesystemAuthorization): Parent[] {
    root(source,frame);
    const parts = path.split("/").slice(0, -1), entries: Parent[] = [];
    let parent = source.canonicalRoot, missing = false;
    for (let i = 0; i < parts.length; i++) {
      const relative = parts.slice(0, i + 1).join("/");
      if (missing) { entries.push({ path: relative, identity: null,...(authorizer?{observation:null}:{}) }); continue; }
      const names = filesystem.names(parent);
      if (names.some(n => n !== parts[i] && filesystemAlias(n) === filesystemAlias(parts[i]))) fail("occupied");
      const path = join(parent, parts[i]);
      try {
        const entry = filesystem.inspect(path);
        if (entry.kind !== "directory" || !reliableIdentity(entry.identity) || filesystem.realpath(path) !== path) fail("unsafe_parent");
        verifyCreationDirectory(filesystem, path, entry.identity);
        filesystem.assertAccessible?.(path);
        entries.push({ path: relative, identity: entry.identity,...(authorizer?{observation:authorizer.observe(path,frame!.root,entry.identity)}:{}) }); parent = path;
      } catch (e) { if (filesystemCode(e) !== "ENOENT") throw e; missing = true; entries.push({ path: relative, identity: null,...(authorizer?{observation:null}:{}) }); }
    }
    root(source,frame); return entries;
  }
  function verifyParents(source: Source, entries: Parent[],frame?:FilesystemAuthorization) {
    root(source,frame);
    if(!parseArchiveParents(entries,!!authorizer))fail("unsafe_parent");
    for (const entry of entries) {
      if (!entry.identity) fail("missing_parent");
      const path = join(source.canonicalRoot, entry.path);
      if(authorizer)authorizer.observe(path,frame!.root,entry.observation!.mount,entry.observation!.evidence);
      verifyCreationDirectory(filesystem, path, entry.observation?.mount??entry.identity!);
      filesystem.assertAccessible?.(path);
    }
    root(source,frame);
  }
  function verifyProject(source: Source, path: string, entries: Parent[], identity: string,auth?:ArchiveAuthorization) {
    if(authorizer&&!auth)fail("ownership_uncertain");
    verifyParents(source, entries,auth?.root);
    verifyCreationDirectory(filesystem, join(source.canonicalRoot, path), auth?.project.mount??JSON.parse(identity));
    if(authorizer)authorizer.observe(join(source.canonicalRoot,path),auth!.root.root,auth!.project.mount,auth!.project.evidence);
    verifyParents(source, entries,auth?.root);
  }
  const parentPath = (path: string) => path.split("/").slice(0, -1).join("/");
  function free(source: Source, path: string, entries: Parent[],frame?:FilesystemAuthorization) {
    verifyParents(source, entries,frame);
    assertCreationDestinationFree(filesystem, join(source.canonicalRoot, parentPath(path)), path.split("/").at(-1)!);
    verifyParents(source, entries,frame);
  }
  function policy(source: Source, path: string) {
    const exclusions: string[] = JSON.parse(source.excludedRelativePaths);
    const alias = filesystemAlias(path);
    if (exclusions.some(p => alias === filesystemAlias(p) || alias.startsWith(`${filesystemAlias(p)}/`))) fail("excluded");
    if (source.archiveRelativePath && (alias === filesystemAlias(source.archiveRelativePath) || alias.startsWith(`${filesystemAlias(source.archiveRelativePath)}/`))) fail("archive");
  }
  function explicitlyRecreatedParent(sourceId: string, categoryId: string | null, path: string, identity: NativeIdentity,proof?:VerifiedFolder,frame?:FilesystemAuthorization) {
    return db.select().from(schema.projectArchiveOperations).where(eq(schema.projectArchiveOperations.sourceId, sourceId)).all().some(row => {
      if (row.action !== "restore" || row.stage !== "completed") return false;
      const binding: Binding = JSON.parse(row.binding), recorded: Parent[] = parentFrames(row);
      const reviewed=binding.authorization?parseArchiveBindingAuthorization(binding,row):null;
      const parent = binding.source.folderRoles ? recorded.find(parent=>parent.path===path) : recorded.at(-1);
      if(binding.source.folderRoles) return binding.createParent && binding.destinationParents.some(parent=>parent.path===path&&parent.identity===null) &&
        !!proof && !!parent?.observation && !!reviewed && !!frame && sameDurableFolder(parent.observation.evidence,proof.evidence) && sameDurableFolder(reviewed.root.root.evidence,frame.root.evidence);
      return categoryId!==null && parentPath(row.requestedRelativePath)===path && binding.project.categoryId === categoryId && binding.createParent && binding.destinationParents.at(-1)?.identity === null &&
        parent?.path === path && !!parent.identity && (authorizer ? !!proof && !!parent.observation && !!reviewed &&
          sameDurableFolder(parent.observation.evidence,proof.evidence) && sameDurableFolder(reviewed.root.root.evidence,frame!.root.evidence) : sameIdentity(parent.identity, identity));
    });
  }
  function associatedPlacement(source:Source,project:Project,archive:Archive|null,frame:FilesystemAuthorization) {
    if(project.sourceId!==source.id || archive&&(archive.sourceId!==source.id||archive.projectId!==project.id))fail("ownership_uncertain");
    const associations=db.select().from(schema.archivedFolderAssociations).where(eq(schema.archivedFolderAssociations.projectId,project.id)).orderBy(desc(schema.archivedFolderAssociations.generation)).all().map(row=>{
      const value=parseArchivedFolderAssociation(row.authorization);
      if(!value || !archivedAssociationMatchesRecord(row,row.id,value) || value.sourceId!==source.id || value.projectId!==project.id || row.generation>source.evidenceGeneration)fail("ownership_uncertain");
      return {id:row.id,value:value!};
    });
    const saved=storedEvidence(project.durableEvidence);
    return archive&&saved?associations.find(({value})=>eqJSON(value.archive,archive) && sameDurableFolder(value.root.root.evidence,frame.root.evidence) && sameDurableFolder(value.project.evidence,saved)):undefined;
  }
  function inspect(input: Extract<import("../contracts/project-archive.js").ArchiveQuery, { type: "workspace.previewProjectArchive" }>) {
    const source = sourceFor(input.workspaceId), project = projectFor(input.projectId);
    if (!source || !project || project.sourceId !== source.id || !source.discoveryMode || !source.archiveRelativePath || !validPath(source.archiveRelativePath)) return null;
    if (source.discoveryMode !== "direct" && source.discoveryMode !== "grouped") return null;
    const frame=authorizer?.capture(source,"",source.durableEvidence);
    root(source,frame);
    const archive = archiveFor(project.id), category = project.categoryId ? db.select().from(schema.categories).where(eq(schema.categories.id, project.categoryId)).get() ?? null : null;
    if (input.action === "archive" && (archive || project.modeInactive || project.associationState !== "active" || input.name !== null || input.createParent)) return null;
    if (input.action === "restore" && (!archive || (input.name !== null && !validProjectBasename(input.name, filesystem.platform)))) return null;
    const original = archive?.relativePath ?? project.relativePath;
    const restoreOriginal = archive?.originalRelativePath ?? project.relativePath;
    const destination = input.action === "archive" ? `${source.archiveRelativePath}/${project.relativePath}`
      : [...restoreOriginal.split("/").slice(0, -1), input.name ?? restoreOriginal.split("/").at(-1)!].join("/");
    if (!validPath(original) || !validPath(destination)) return null;
    const targetFolderRoles=source.folderRoles && input.action==="restore" ? relocatedFolderRoles(source.folderRoles,project.relativePath,destination) : null;
    if(source.folderRoles && input.action==="restore" && targetFolderRoles===null)fail("reserved_destination");
    const sourceParents = parents(source, original,frame), destinationParents = parents(source, destination,frame);
    let auth:ArchiveAuthorization|undefined;
    if(authorizer) {
      const saved=storedEvidence(project.durableEvidence);
      if(!saved)fail("ownership_uncertain");
      const target=authorizer.observe(join(source.canonicalRoot,original),frame!.root,filesystem.inspect(join(source.canonicalRoot,original)).identity,saved!);
      const recorded=archive?.authorization?parseArchiveAuthorization(archive.authorization):null;
      if(archive?.authorization && (!recorded || recorded.version!==1))fail("ownership_uncertain");
      const accepted=associatedPlacement(source,project,archive,frame!);
      const association=accepted?.value;
      if(recorded && (!sameDurableFolder(recorded.root.root.evidence,frame!.root.evidence, !association) || !sameDurableFolder(recorded.project.evidence,target.evidence, !association)))fail("filesystem_changed");
      if(association) {
        if(association.parents.length!==sourceParents.length || association.parents.some((parent,index)=>parent.path!==sourceParents[index].path || !sourceParents[index].observation || !sameDurableFolder(parent.observation!.evidence,sourceParents[index].observation!.evidence)))fail("parent_replaced");
        auth={version:2,root:frame!,project:target,originalParent:recorded?.version===1?recorded.originalParent:null,association,associationId:accepted!.id};
      }else {
      let originalParent=sourceParents.at(-1)?.observation??frame!.root;
      if(archive) {
        if(recorded?.version===1)originalParent=recorded.originalParent;
        else if(archive.mode==="grouped") {
          const evidence=category?storedEvidence(category.durableEvidence):null;
          if(!evidence)fail("ownership_uncertain");
          originalParent={ok:true,evidence:evidence!,mount:JSON.parse(archive.parentIdentity)};
        }else originalParent={...frame!.root,mount:JSON.parse(archive.parentIdentity)};
        const recordedParents=parseArchiveParents(JSON.parse(archive.parents),!!recorded);
        if(!recordedParents || recordedParents.length!==sourceParents.length)fail("unsafe_parent");
        for(const [index,parent] of recordedParents!.entries()) {
          const now=sourceParents[index];
          if(parent.path!==now.path || !parent.identity || (recorded ? !sameDurableFolder(parent.observation!.evidence,now.observation!.evidence) : !sameIdentity(parent.identity,now.identity!)))fail("parent_replaced");
        }
      }
      auth={version:1,root:frame!,project:target,originalParent};
      }
      if(!parseArchiveAuthorization(JSON.stringify(auth)))fail("ownership_uncertain");
    }
    verifyProject(source, original, sourceParents, project.nativeIdentity,auth);
    const blockers: string[] = [];
    if (readProjectReservations(db, source.id).length) blockers.push("busy");
    const mode = source.folderRoles ? source.discoveryMode : archive?.mode ?? source.discoveryMode;
    if (input.action === "restore" && source.discoveryMode !== mode) blockers.push("incompatible_mode");
    if (input.action === "archive") {
      policy(source, original);
      if (category && (category.modeInactive || category.associationState !== "active" || !sourceParents.find(p=>p.path===category.relativePath)?.identity || !(auth ? category.durableEvidence && sameDurableFolder(sourceParents.find(p=>p.path===category.relativePath)!.observation!.evidence,JSON.parse(category.durableEvidence)) : sameIdentity(sourceParents.find(p=>p.path===category.relativePath)!.identity!, JSON.parse(category.nativeIdentity))))) blockers.push("category_unavailable");
    } else {
      policy(source, destination);
      // New role archives retain the whole original route in their immutable
      // archive intent. A familiar immediate parent cannot hide a changed Group.
      if(source.folderRoles && archive?.authorization) {
        const archivedAuthority=parseArchiveAuthorization(archive.authorization);
        if(archivedAuthority?.root.version===2) {
          const receipt=db.select().from(schema.projectArchiveOperations).where(eq(schema.projectArchiveOperations.projectId,project.id)).all().find(row=>row.sourceId===source.id&&row.action==="archive"&&row.stage==="completed"&&row.originalRelativePath===archive.originalRelativePath&&row.requestedRelativePath===archive.relativePath&&JSON.stringify((JSON.parse(row.binding) as Binding).authorization)===archive.authorization);
          if(!receipt)fail("ownership_uncertain");
          const originalBinding=JSON.parse(receipt!.binding) as Binding;
          if(!parseArchiveBindingAuthorization(originalBinding,receipt!))fail("ownership_uncertain");
          for(const parent of destinationParents.filter(parent=>parent.identity!==null)) {
            const saved=originalBinding.sourceParents.find(saved=>saved.path===parent.path)?.observation;
            if(!saved || !parent.observation || !sameDurableFolder(saved.evidence,parent.observation.evidence,auth?.version!==2) && !explicitlyRecreatedParent(source.id,project.categoryId,parent.path,parent.identity!,parent.observation,frame))fail("parent_replaced");
          }
        }
      }
      if(!authorizer)verifyParents(source, JSON.parse(archive!.parents));
      const existingParent = destinationParents.at(-1)?.identity;
      const parentProof=destinationParents.at(-1)?.observation;
      const originalMatches=source.folderRoles && parentPath(destination)==="" ? !!auth && (auth.originalParent===null || sameDurableFolder(auth.originalParent.evidence,frame!.root.evidence,false)) : auth?.version===2 ? !!parentProof && (source.folderRoles || !!category?.durableEvidence && category.relativePath===parentPath(destination) &&
        sameDurableFolder(JSON.parse(category.durableEvidence),parentProof.evidence)) && (auth.originalParent===null||sameDurableFolder(auth.originalParent.evidence,parentProof.evidence,false))
        : auth?!!parentProof&&sameDurableFolder(parentProof.evidence,auth.originalParent.evidence):!!existingParent&&sameIdentity(existingParent,JSON.parse(archive!.parentIdentity));
      if (existingParent && !originalMatches &&
        !explicitlyRecreatedParent(source.id, project.categoryId, parentPath(destination), existingParent,destinationParents.at(-1)?.observation??undefined,frame)) blockers.push("parent_replaced");
    }
    const missingParents = destinationParents.filter(p => !p.identity).map(p => p.path);
    if (input.action === "restore" && missingParents.length && !input.createParent) blockers.push("missing_parent");
    if (!missingParents.length) {
      try { free(source, destination, destinationParents,frame); } catch (e) { blockers.push(problem(e)); }
    }
    const others = db.select().from(schema.projects).where(eq(schema.projects.sourceId, source.id)).all();
    if (others.some(p => p.id !== project.id && p.associationState !== "replaced" && filesystemAlias(p.relativePath) === filesystemAlias(destination))) blockers.push("reserved_destination");
    const allArchives = db.select().from(schema.projectArchives).where(eq(schema.projectArchives.sourceId, source.id)).all();
    // Unrelated archived branches may be unavailable. Only their common
    // designation ancestors authorize reuse of this archive root.
    for (const existing of allArchives) {
      const recorded=parseArchiveParents(JSON.parse(existing.parents),!!existing.authorization);
      if(!recorded || existing.authorization && !parseArchiveAuthorization(existing.authorization))fail("unsafe_parent");
      const owner=projectFor(existing.projectId);
      const approved=authorizer&&owner?associatedPlacement(source,owner,existing,frame!)?.value:undefined;
      const common=recorded!.filter(parent=>source.archiveRelativePath===parent.path || source.archiveRelativePath!.startsWith(parent.path+"/"));
      const observed=authorizer ? common.map(parent=>{
        const path=join(source.canonicalRoot,parent.path),entry=filesystem.inspect(path);
        const grant=approved?.parents.find(proof=>proof.path===parent.path)?.observation;
        if(!parent.identity || !parent.observation && !grant && !sameIdentity(parent.identity,entry.identity))fail("parent_replaced");
        const proof=authorizer.observe(path,frame!.root,entry.identity,grant?.evidence??parent.observation?.evidence);
        if(parent.observation && !sameDurableFolder(parent.observation.evidence,proof.evidence,!grant))fail("parent_replaced");
        return {path:parent.path,identity:entry.identity,observation:proof};
      }) : common;
      verifyParents(source,observed,frame);
    }
    if (others.some(p => p.id !== project.id && p.associationState !== "replaced" && (() => {
      const identity = JSON.parse(p.nativeIdentity), current = JSON.parse(project.nativeIdentity);
      return identity.dev === current.dev && identity.ino === current.ino;
    })())) blockers.push("native_conflict");
    if (allArchives.some(p => p.projectId !== project.id && filesystemAlias(p.relativePath) === filesystemAlias(destination))) blockers.push("reserved_destination");
    const binding: Binding = { ...(auth?{authorization:auth}:{}),source, project, archive, category, sourceParents, destinationParents, createParent: input.createParent,
      mode, categoryName: archive?.categoryName ?? category?.relativePath ?? null,...(targetFolderRoles?{targetFolderRoles}:{}) };
    authority(binding);verifyPeerRoots(binding,original,destination);verifyNamespace(binding,original,destination);
    const preview: ProjectArchivePreview = { workspaceId: input.workspaceId, sourceId: source.id, projectId: project.id, action: input.action,
      originalRelativePath: original, requestedRelativePath: destination, revision: source.discoveryRevision, missingParents, blockers, previewToken: null };
    return { binding, preview };
  }
  function previewProjectArchive(input: unknown): ServiceResult<ProjectArchivePreview> {
    if (!isArchiveRequest(input) || input.type !== "workspace.previewProjectArchive") return invalid();
    reviews.delete(input.workspaceId);
    try {
      const inspected = inspect(input); if (!inspected) return invalid();
      if (!inspected.preview.blockers.length) {
        const token = randomUUID();
        reviews.set(input.workspaceId, { sourceId: inspected.binding.source.id, workspaceId: input.workspaceId, token, ...structuredClone(inspected) });
        inspected.preview.previewToken = token;
      }
      return { ok: true, value: inspected.preview };
    } catch (e) {
      const source = sourceFor(input.workspaceId);
      if (!source) return invalid();
      return { ok: true, value: { workspaceId: input.workspaceId, sourceId: source.id, projectId: input.projectId, action: input.action,
        originalRelativePath: "", requestedRelativePath: "", revision: source.discoveryRevision, missingParents: [], blockers: [problem(e)], previewToken: null } };
    }
  }
  const comparableBinding=(binding:Binding)=>({...binding,source:{...sourceFolderRolePolicy(binding.source),propertyRevision:0,categoryPropertyRevision:0}});
  function sourceBinding(source: Source) {
    const { id, canonicalRoot, discoveryMode, discoveryRevision, excludedRelativePaths, archiveRelativePath, appliedRootIdentity } = source;
    return { id, canonicalRoot, discoveryMode, discoveryRevision, excludedRelativePaths, archiveRelativePath, appliedRootIdentity };
  }
  function authorization(row: Operation, workspaceId: string) {
    const b: Binding = bindingFor(row), current = sourceFor(workspaceId);
    const equalRecord=(actual:Project|Category|undefined,expected:Project|Category)=>activeRecovery.get(row.operationId)?.legacy && actual?.durableEvidence===null
      ? eqJSON({...actual,durableEvidence:null},{...expected,durableEvidence:null}):eqJSON(actual,expected);
    if (!current || current.id !== row.sourceId || !eqJSON(sourceBinding(current), sourceBinding(b.source)) || !equalRecord(projectFor(row.projectId), b.project) || !eqJSON(archiveFor(row.projectId), b.archive) || b.category && !equalRecord(db.select().from(schema.categories).where(eq(schema.categories.id,b.category.id)).get(),b.category)) fail("stale_configuration");
    if (readProjectReservations(db, row.sourceId).some(r => r.operationKind !== "project_archive" || r.operationId !== row.operationId)) fail("busy");
    if (!eqJSON(operationFor(row.operationId), row)) fail("stale_operation");
    root(current!,authority(b)?.root);verifyPeerRoots(b,row.originalRelativePath,row.requestedRelativePath,parentFrames(row));verifyNamespace(b,row.originalRelativePath,row.requestedRelativePath,parentFrames(row)); return b;
  }
  function ensureParents(row: Operation, workspaceId: string) {
    const b = authorization(row, workspaceId);
    const entries: Parent[] = structuredClone(parentFrames(row));
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      verifyParents(b.source, entries.slice(0, i),authority(b)?.root);
      if (entry.identity) verifyCreationDirectory(filesystem, join(b.source.canonicalRoot, entry.path), entry.identity);
      else {
        free(b.source, entry.path, entries.slice(0, i),authority(b)?.root);
        verifyProject(b.source, row.originalRelativePath, b.sourceParents, row.nativeIdentity,authority(b));
        authorization(row,workspaceId);
        filesystem.mkdir(join(b.source.canonicalRoot, entry.path));
        const created = filesystem.inspect(join(b.source.canonicalRoot, entry.path));
        if (created.kind !== "directory" || !reliableIdentity(created.identity)) fail("filesystem_changed");
        verifyCreationDirectory(filesystem, join(b.source.canonicalRoot, entry.path), created.identity);
        entries[i] = { ...entry, identity: created.identity,...(authorizer?{observation:authorizer.observe(join(b.source.canonicalRoot,entry.path),authority(b)!.root.root,created.identity)}:{}) };
        authorization(row, workspaceId);
        verifyPeerRoots(b,row.originalRelativePath,row.requestedRelativePath,entries);verifyNamespace(b,row.originalRelativePath,row.requestedRelativePath,entries);
        const raw:Parent[]=JSON.parse(row.parents);
        // Only newly created slots append to the original journal. Renewed
        // observations of existing slots live exclusively in the attestation.
        raw[i]=entries[i];
        db.update(schema.projectArchiveOperations).set({ parents: JSON.stringify(raw) }).where(eq(schema.projectArchiveOperations.operationId, row.operationId)).run();
        row = operationFor(row.operationId)!;
        const frame=activeRecovery.get(row.operationId);if(frame)frame.parents=structuredClone(entries);
      }
    }
    verifyParents(b.source, entries,authority(b)?.root); return row;
  }
  function destinationEvidence(row: Operation, workspaceId: string) {
    const b = authorization(row, workspaceId);
    verifyProject(b.source, row.requestedRelativePath, parentFrames(row), row.nativeIdentity,authority(b));
    free(b.source, row.originalRelativePath, b.sourceParents,authority(b)?.root);
    authorization(row, workspaceId);
  }
  function complete(row: Operation, workspaceId: string) {
    const b: Binding = bindingFor(row);
    const revision = b.source.discoveryRevision + 1;
    if (!Number.isSafeInteger(revision)) fail("stale_configuration");
    let completionCategoryId=b.project.categoryId;
    const expectedArchive:Archive|null=row.action==="archive" ? {projectId:row.projectId,sourceId:row.sourceId,relativePath:row.requestedRelativePath,
      originalRelativePath:b.project.relativePath,mode:b.mode,categoryName:b.categoryName,parentIdentity:JSON.stringify(b.sourceParents.at(-1)?.identity??b.authorization?.originalParent?.mount??JSON.parse(b.source.appliedRootIdentity!)),
      parents:JSON.stringify(parentFrames(row)),authorization:b.authorization?JSON.stringify(b.authorization):null}:null;
    db.transaction(tx => {
      destinationEvidence(row, workspaceId);
      const expectedCategories=new Map(tx.select().from(schema.categories).where(eq(schema.categories.sourceId,row.sourceId)).all().map(category=>[category.id,category]));
      if (row.stage !== "destination_recorded") {
        tx.update(schema.projectArchiveOperations).set({ stage: "destination_recorded", problem: null }).where(eq(schema.projectArchiveOperations.operationId, row.operationId)).run();
        row = operationFor(row.operationId)!;
      }
      if (row.action === "archive") {
        tx.update(schema.projects).set({ modeInactive: true }).where(eq(schema.projects.id, row.projectId)).run();
        tx.insert(schema.projectArchives).values(expectedArchive!).run();
      } else {
        const currentStatus=b.source.folderRoles ? rolePlacement(b.project.relativePath,savedFolderRoles(b.source)!,b.mode).categoryPath : parentPath(row.requestedRelativePath);
        let categoryId = b.source.folderRoles ? currentStatus===null ? null : tx.select().from(schema.categories).where(eq(schema.categories.sourceId,row.sourceId)).all().find(c=>c.relativePath===currentStatus&&!c.modeInactive&&c.associationState==="active")?.id ?? (b.category?.relativePath===currentStatus ? b.project.categoryId : null) : b.project.categoryId;
        if (b.mode === "grouped" && (!b.source.folderRoles || currentStatus!==null)) {
          const parent = parentFrames(row) as Parent[];
          const statusPath=currentStatus;
          const statusParent=parent.find(p=>p.path===statusPath);
          if(!statusParent?.identity)fail("category_unavailable");
          const identity = JSON.stringify(statusParent!.identity);
          const current = categoryId ? tx.select().from(schema.categories).where(eq(schema.categories.id, categoryId)).get() : null;
          const proof=statusParent!.observation;
          const matches=(category:typeof schema.categories.$inferSelect)=>authorizer ? !!category.durableEvidence && !!proof && sameDurableFolder(JSON.parse(category.durableEvidence),proof.evidence) : category.nativeIdentity===identity;
          if (!current || !matches(current)) {
            if (current && current.relativePath===statusPath) {
              tx.update(schema.categories).set({ modeInactive: true, associationState: "replaced" }).where(eq(schema.categories.id, current.id)).run();
              expectedCategories.set(current.id,{...current,modeInactive:true,associationState:"replaced"});
            }
            const associated = tx.select().from(schema.categories).where(eq(schema.categories.sourceId, row.sourceId)).all().find(c =>
              c.associationState === "active" && !c.modeInactive && c.relativePath === statusPath && matches(c));
            categoryId = associated?.id ?? randomUUID();
            if (!associated) {
              const category:Category={id:categoryId,sourceId:row.sourceId,relativePath:statusPath!,nativeIdentity:identity,
                associationState:"active",modeInactive:false,durableEvidence:proof?JSON.stringify(proof.evidence):null};
              tx.insert(schema.categories).values(category).run();expectedCategories.set(category.id,category);
            }
          } else {
            tx.update(schema.categories).set({ associationState: "active", modeInactive: false }).where(eq(schema.categories.id, current.id)).run();
            expectedCategories.set(current.id,{...current,associationState:"active",modeInactive:false});
          }
        }
        completionCategoryId=categoryId;
        tx.delete(schema.projectArchives).where(eq(schema.projectArchives.projectId, row.projectId)).run();
        tx.update(schema.projects).set({ relativePath: row.requestedRelativePath, categoryId, associationState: "active", modeInactive: false }).where(eq(schema.projects.id, row.projectId)).run();
      }
      tx.update(schema.sources).set({ discoveryRevision: revision,...(b.source.folderRoles && row.action==="restore" ? {folderRoles:b.targetFolderRoles!} : {}) }).where(eq(schema.sources.id, row.sourceId)).run();
      tx.update(schema.projectArchiveOperations).set({ stage: "completed", completedRevision: revision, problem: null }).where(eq(schema.projectArchiveOperations.operationId, row.operationId)).run();
      verifyProject(b.source, row.requestedRelativePath, parentFrames(row), row.nativeIdentity,authority(b));
      free(b.source, row.originalRelativePath, b.sourceParents,authority(b)?.root);
      verifyPeerRoots(b,row.originalRelativePath,row.requestedRelativePath,parentFrames(row));verifyNamespace(b,row.originalRelativePath,row.requestedRelativePath,parentFrames(row),completionCategoryId);
      const actualSource=sourceFor(workspaceId),expectedSource=sourcePolicy({...b.source,discoveryRevision:revision,...(b.targetFolderRoles?{folderRoles:b.targetFolderRoles}:{})});
      if(!actualSource || !eqJSON(sourcePolicy(actualSource),expectedSource))fail("stale_configuration");
      root(actualSource!,authority(b)?.root);
      const expectedProject:Project=row.action==="archive" ? {...b.project,modeInactive:true} : {...b.project,relativePath:row.requestedRelativePath,categoryId:completionCategoryId,modeInactive:false,associationState:"active"};
      const ordered=(categories:Category[])=>categories.sort((a,b)=>a.id.localeCompare(b.id));
      if(!eqJSON(projectFor(row.projectId),expectedProject) || !eqJSON(archiveFor(row.projectId),expectedArchive) ||
        !eqJSON(ordered(tx.select().from(schema.categories).where(eq(schema.categories.sourceId,row.sourceId)).all()),ordered([...expectedCategories.values()])))fail("storage_error");
      if(!eqJSON(sourcePolicy(sourceFor(workspaceId)!),expectedSource))fail("stale_configuration");
    }, { behavior: "immediate" });
    integration.invalidateSourceReviews(row.sourceId);
    integration.committed(row.sourceId, revision, db.select().from(schema.workspaces).where(eq(schema.workspaces.sourceId, row.sourceId)).all().map(w => w.id));
    return operationFor(row.operationId)!;
  }
  function execute(row: Operation, workspaceId: string) {
    row = ensureParents(row, workspaceId);
    const b = authorization(row, workspaceId);
    verifyProject(b.source, row.originalRelativePath, b.sourceParents, row.nativeIdentity,authority(b));
    free(b.source, row.requestedRelativePath, parentFrames(row),authority(b)?.root);
    authorization(row, workspaceId);
    const outcome = native(join(b.source.canonicalRoot, row.originalRelativePath), join(b.source.canonicalRoot, row.requestedRelativePath));
    if (outcome !== "renamed") fail(outcome);
    destinationEvidence(row, workspaceId);
    db.update(schema.projectArchiveOperations).set({ stage: "destination_recorded", problem: null }).where(eq(schema.projectArchiveOperations.operationId, row.operationId)).run();
    return complete(operationFor(row.operationId)!, workspaceId);
  }
  function retain(row: Operation, e: unknown): ServiceResult<ProjectArchiveResult> {
    try {
      const current = operationFor(row.operationId)!;
      if (current.stage !== "completed" && current.stage !== "failed") db.update(schema.projectArchiveOperations).set({ problem: problem(e) }).where(eq(schema.projectArchiveOperations.operationId, row.operationId)).run();
    } catch { /* The durable intent remains authoritative if this write fails. */ }
    try { row = operationFor(row.operationId) ?? row; } catch { /* Keep last durable receipt. */ }
    return { ok: true, value: { operation: view(row) } };
  }
  function applyProjectArchive(input: unknown): ServiceResult<ProjectArchiveResult> {
    if (!isArchiveRequest(input) || input.type !== "workspace.applyProjectArchive") return invalid();
    let row: Operation | undefined, accepted = false;
    try {
      const source = sourceFor(input.workspaceId), prior = operationFor(input.operationId);
      if (!source) return invalid();
      if (prior) return prior.workspaceId === input.workspaceId && prior.sourceId === source.id && prior.previewToken === input.previewToken
        ? { ok: true, value: { operation: view(prior) } } : invalid();
      const review = reviews.get(input.workspaceId);
      if (!review || review.token !== input.previewToken) return invalid();
      reviews.delete(input.workspaceId);
      const p = review.preview, b = review.binding;
      const request = { type: "workspace.previewProjectArchive" as const, workspaceId: input.workspaceId, projectId: p.projectId, action: p.action,
        name: p.action === "restore" ? p.requestedRelativePath.split("/").at(-1)! : null, createParent: b.createParent };
      const current = inspect(request);
      if (!current || !eqJSON(comparableBinding(current.binding), comparableBinding(b)) || current.preview.blockers.length) return invalid();
      row = { operationId: input.operationId, sourceId: source.id, workspaceId: input.workspaceId, projectId: p.projectId, action: p.action,
        originalRelativePath: p.originalRelativePath, requestedRelativePath: p.requestedRelativePath, nativeIdentity: b.project.nativeIdentity,
        binding: JSON.stringify(b), previewToken: input.previewToken, parents: JSON.stringify(b.destinationParents), stage: "intent", problem: null, completedRevision: null };
      const intent = row;
      db.transaction(tx => {
        const latest = inspect(request);
        if (!latest || !eqJSON(comparableBinding(latest.binding), comparableBinding(b)) || latest.preview.blockers.length) fail("stale_configuration");
        tx.insert(schema.projectArchiveOperations).values(intent).run();
      }, { behavior: "immediate" });
      accepted = true;
      integration.invalidateSourceReviews(row.sourceId);
      return { ok: true, value: { operation: view(execute(row, input.workspaceId)) } };
    } catch (e) { return accepted && row ? retain(row, e) : storage(); }
  }
  function inspectRecovery(row: Operation, workspaceId: string) {
    const result: ProjectArchiveRecoveryPreview = { workspaceId, sourceId: row.sourceId, operation: view(row), actions: [], problem: null, previewToken: null };
    const observations: unknown[] = [];
    if (row.stage === "completed" || row.stage === "failed") return { result, fingerprint: JSON.stringify([row, result]) };
    try {
      const b = authorization(row, workspaceId);
      const status = (path: string, entries: Parent[]) => {
        try {
          verifyProject(b.source, path, entries, row.nativeIdentity,authority(b)); return "matching";
        } catch (e) { if (filesystemCode(e) === "ENOENT") return "missing"; throw e; }
      };
      const original = status(row.originalRelativePath, b.sourceParents);
      const entries: Parent[] = parentFrames(row);
      let destination: string;
      if (entries.some(p => !p.identity)) {
        const now = parents(b.source, row.requestedRelativePath,authority(b)?.root);
        if (!eqJSON(entries, now)) fail("unrecorded_parent");
        destination = "missing";
      } else destination = status(row.requestedRelativePath, entries);
      observations.push(original, destination, parents(b.source, row.requestedRelativePath,authority(b)?.root));
      if (original === "matching" && destination === "missing") result.actions = ["retry_original", "keep_original"];
      else if (original === "missing" && destination === "matching") {
        destinationEvidence(row, workspaceId); result.actions = ["complete_destination"];
      } else fail("ambiguous_placement");
    } catch (e) {
      result.problem = problem(e);
      // Abandon only when the original project is still fully verified. This
      // does not adopt, remove or alter an unrecorded/replaced destination parent.
      try {
        const b = authorization(row, workspaceId);
        verifyProject(b.source, row.originalRelativePath, b.sourceParents, row.nativeIdentity,authority(b));
        result.actions = ["keep_original"];
      } catch { /* Ambiguous original placement stays reserved. */ }
    }
    return { result, fingerprint: JSON.stringify([row, result, observations]) };
  }
  function legacyRecoveryFrame(row:Operation,workspaceId:string):RecoveryFrame {
    const original:Binding=JSON.parse(row.binding),source=sourceFor(workspaceId),project=projectFor(row.projectId),archive=archiveFor(row.projectId);
    if(!source || !project || source.id!==row.sourceId || !legacyArchivePolicy(original,source))fail("ownership_uncertain");
    const rootFrame=authorizer!.capture(source!,"",source!.durableEvidence);
    const sourceParents=parents(source!,row.originalRelativePath,rootFrame),destination=parents(source!,row.requestedRelativePath,rootFrame),recorded:Parent[]=JSON.parse(row.parents);
    const parentFrames=recorded.map((parent,index)=>parent.identity===null?{...parent,observation:null}:destination[index]);
    const proofs:VerifiedFolder[]=[];
    for(const path of [row.originalRelativePath,row.requestedRelativePath])try {
      const entry=filesystem.inspect(join(source!.canonicalRoot,path));
      if(entry.kind!=="directory" || !sameIdentity(entry.identity,JSON.parse(row.nativeIdentity)))continue;
      const proof=authorizer!.observe(join(source!.canonicalRoot,path),rootFrame.root,entry.identity);
      if(project!.durableEvidence!==null && !sameDurableFolder(JSON.parse(project!.durableEvidence),proof.evidence))fail("ownership_uncertain");
      proofs.push(proof);
    }catch(error){if(filesystemCode(error)!=="ENOENT")throw error;}
    if(proofs.length!==1)fail("ambiguous_placement");
    const origin=original.archive ? original.mode==="direct"?rootFrame.root:destination.at(-1)?.observation : sourceParents.at(-1)?.observation??rootFrame.root;
    if(!origin)fail("ownership_uncertain");
    const category=original.category?db.select().from(schema.categories).where(eq(schema.categories.id,original.category.id)).get():null;
    if(original.category && (!category || category.durableEvidence!==null && !sameDurableFolder(JSON.parse(category.durableEvidence),origin!.evidence)))fail("ownership_uncertain");
    const binding:Binding={...original,source:source!,project:{...project!,durableEvidence:JSON.stringify(proofs[0].evidence)},archive,
      category:category?{...category,durableEvidence:JSON.stringify(origin!.evidence)}:null,sourceParents,
      destinationParents:original.destinationParents.map((planned,index)=>planned.identity===null?{...planned,observation:null}:destination[index]),
      authorization:{version:1,root:rootFrame,project:proofs[0],originalParent:origin!}};
    if(!legacyArchiveRenewalMatches(original,binding,parentFrames,recorded))fail("ownership_uncertain");
    return {binding,parents:parentFrames,legacy:true};
  }
  function legacyArchivePolicy(original:Binding,source:Source) {
    const policy=(s:Source)=>({...sourcePolicy(s),durableEvidence:null,evidenceGeneration:0,discoveryRevision:0});
    return !Object.hasOwn(original,"authorization") && source.discoveryRevision>=original.source.discoveryRevision && eqJSON(policy(original.source),policy(source));
  }
  function recoveryFrame(row:Operation,workspaceId:string):RecoveryFrame {
    const raw:Binding=JSON.parse(row.binding),source=sourceFor(workspaceId);
    let prior:NonNullable<ReturnType<typeof parseArchiveAttestation>>|undefined;
    for(const proof of db.select().from(schema.projectArchiveAttestations).where(eq(schema.projectArchiveAttestations.operationId,row.operationId)).orderBy(asc(schema.projectArchiveAttestations.sequence)).all()) {
      const parsed=parseArchiveAttestation(proof,row,prior);
      if(!parsed || !source || parsed.binding.authorization!.root.generation>source.evidenceGeneration)fail("ownership_uncertain");
      prior=parsed!;
    }
    if(!Object.hasOwn(raw,"authorization") && !prior)return legacyRecoveryFrame(row,workspaceId);
    const original:Binding=prior?.binding??raw,old=authority(original);
    if(!old || !source || source.id!==row.sourceId)fail("ownership_uncertain");
    const policy=(s:Source)=>({...sourcePolicy(s),discoveryRevision:0,evidenceGeneration:0,appliedRootIdentity:null});
    if(!eqJSON(policy(source!),policy(original.source)) || source!.discoveryRevision<original.source.discoveryRevision ||
      source!.evidenceGeneration<old!.root.generation || !eqJSON(projectFor(row.projectId),original.project) ||
      !eqJSON(archiveFor(row.projectId),original.archive) || original.category && !eqJSON(db.select().from(schema.categories).where(eq(schema.categories.id,original.category.id)).get(),original.category))fail("stale_configuration");
    const rootFrame=authorizer!.capture(source!,"",source!.durableEvidence);
    if(!sameDurableFolder(old!.root.root.evidence,rootFrame.root.evidence))fail("ownership_uncertain");
    const renew=(saved:Parent[],path:string)=>{
      const current=parents(source!,path,rootFrame);
      if(!parseArchiveParents(saved,true) || current.length!==saved.length)fail("ownership_uncertain");
      for(const [i,parent] of current.entries()) {
        const previous=saved[i];
        // An unrecorded directory grants no authority. Keep the planned missing
        // slot so inspection can offer only Keep original, without adopting it.
        if(previous.identity===null){current[i]={...previous};continue;}
        if(previous.path!==parent.path || (previous.identity===null ? parent.identity!==null : !parent.observation || !previous.observation || !sameDurableFolder(previous.observation.evidence,parent.observation.evidence)))fail("unrecorded_parent");
      }
      return current;
    };
    const sourceParents=renew(original.sourceParents,row.originalRelativePath),destinationParents=renew((JSON.parse(row.parents) as Parent[]).map((parent,index)=>parent.identity!==null&&!parent.observation&&prior?.parents[index]?.observation?prior.parents[index]:parent),row.requestedRelativePath);
    const projectProofs:VerifiedFolder[]=[];
    for(const path of [row.originalRelativePath,row.requestedRelativePath]) {
      try {const entry=filesystem.inspect(join(source!.canonicalRoot,path));if(entry.kind!=="directory")continue;
        const proof=authorizer!.observe(join(source!.canonicalRoot,path),rootFrame.root,entry.identity);
        if(sameDurableFolder(proof.evidence,old!.project.evidence))projectProofs.push(proof);
      }catch{ /* No authority for an unavailable/conflicting placement. Inspection
                 may still offer Keep original for the separately proven original. */ }
    }
    if(projectProofs.length!==1)fail("ambiguous_placement");
    const authorization:ArchiveAuthorization=old!.version===2?{...old!,root:rootFrame,project:projectProofs[0]}:{...old!,root:rootFrame,project:projectProofs[0],originalParent:original.archive?old!.originalParent:sourceParents.at(-1)?.observation??rootFrame.root};
    const binding:Binding={...original,source:source!,sourceParents,destinationParents,authorization};
    // A planned missing parent may have been exclusively created and recorded.
    // Its original plan remains missing; current evidence is a separate frame.
    binding.destinationParents=original.destinationParents.map((planned,i)=>planned.identity===null?{...planned}:destinationParents[i]);
    authority(binding);return {binding,parents:destinationParents};
  }
  function inspectCurrentRecovery(row:Operation,workspaceId:string) {
    if(!authorizer || row.stage==="completed" || row.stage==="failed")return {...inspectRecovery(row,workspaceId),frame:undefined};
    let frame:RecoveryFrame;
    try {frame=recoveryFrame(row,workspaceId);}catch(error) {
      const result:ProjectArchiveRecoveryPreview={workspaceId,sourceId:row.sourceId,operation:view(row),actions:[],problem:problem(error),previewToken:null};
      return {result,fingerprint:JSON.stringify([row,result]),frame:undefined};
    }
    activeRecovery.set(row.operationId,frame);
    try {const inspected=inspectRecovery(row,workspaceId);return {...inspected,frame,fingerprint:JSON.stringify([inspected.fingerprint,{...frame,binding:comparableBinding(frame.binding)},db.select().from(schema.projectArchiveAttestations).where(eq(schema.projectArchiveAttestations.operationId,row.operationId)).all()])};}
    finally {activeRecovery.delete(row.operationId);}
  }
  function previewProjectArchiveRecovery(input: unknown): ServiceResult<ProjectArchiveRecoveryPreview> {
    if (!isArchiveRequest(input) || input.type !== "workspace.previewProjectArchiveRecovery") return invalid();
    const key = `${input.workspaceId}:${input.operationId}`; recoveryReviews.delete(key);
    try {
      const source = sourceFor(input.workspaceId), row = operationFor(input.operationId);
      if (!source || !row || row.sourceId !== source.id) return invalid();
      const inspected = inspectCurrentRecovery(row, input.workspaceId);
      if (inspected.result.actions.length) {
        const token = randomUUID(); recoveryReviews.set(key, { sourceId: row.sourceId, token, fingerprint: inspected.fingerprint }); inspected.result.previewToken = token;
      }
      return { ok: true, value: inspected.result };
    } catch { return storage(); }
  }
  function recoverProjectArchive(input: unknown): ServiceResult<ProjectArchiveResult> {
    if (!isArchiveRequest(input) || input.type !== "workspace.recoverProjectArchive") return invalid();
    const key = `${input.workspaceId}:${input.operationId}`, review = recoveryReviews.get(key);
    if (!review || review.token !== input.previewToken) return invalid();
    recoveryReviews.delete(key);
    let row: Operation | undefined, accepted = false;
    try {
      row = operationFor(input.operationId);
      if (!row || sourceFor(input.workspaceId)?.id !== row.sourceId) return invalid();
      const inspected = inspectCurrentRecovery(row, input.workspaceId);
      if (inspected.fingerprint !== review.fingerprint || !inspected.result.actions.includes(input.action)) return invalid();
      if(authorizer) {
        db.transaction(tx=>{
          const current=inspectCurrentRecovery(row!,input.workspaceId);
          if(current.fingerprint!==review.fingerprint || !current.frame || !current.result.actions.includes(input.action))fail("stale_configuration");
          const frame=current.frame!;
          const previous=tx.select().from(schema.projectArchiveAttestations).where(eq(schema.projectArchiveAttestations.operationId,row!.operationId)).all();
          tx.insert(schema.projectArchiveAttestations).values({id:randomUUID(),operationId:row!.operationId,sequence:previous.length,journal:JSON.stringify(row),binding:JSON.stringify(frame.binding),parents:JSON.stringify(frame.parents)}).run();
          if(frame.legacy) {
            tx.update(schema.projects).set({durableEvidence:frame.binding.project.durableEvidence}).where(eq(schema.projects.id,row!.projectId)).run();
            if(frame.binding.category)tx.update(schema.categories).set({durableEvidence:frame.binding.category.durableEvidence}).where(eq(schema.categories.id,frame.binding.category.id)).run();
            frame.legacy=false;
          }
          activeRecovery.set(row!.operationId,frame);
          authorization(row!,input.workspaceId);
          if(input.action==="keep_original") {
            tx.update(schema.projectArchiveOperations).set({stage:"failed",problem:"kept_original"}).where(eq(schema.projectArchiveOperations.operationId,row!.operationId)).run();
            const b=frame.binding;
            verifyProject(b.source,row!.originalRelativePath,b.sourceParents,row!.nativeIdentity,authority(b));
            verifyPeerRoots(b,row!.originalRelativePath,row!.requestedRelativePath,frame.parents);
            verifyNamespace(b,row!.originalRelativePath,row!.requestedRelativePath,frame.parents);
            const currentSource=sourceFor(input.workspaceId);
            if(!currentSource || !eqJSON(sourcePolicy(currentSource),sourcePolicy(b.source)) || !eqJSON(projectFor(row!.projectId),b.project) || !eqJSON(archiveFor(row!.projectId),b.archive) ||
              b.category && !eqJSON(tx.select().from(schema.categories).where(eq(schema.categories.id,b.category.id)).get(),b.category))fail("stale_configuration");
            root(currentSource!,authority(b)?.root);
            if(!eqJSON(sourcePolicy(sourceFor(input.workspaceId)!),sourcePolicy(b.source)))fail("stale_configuration");
          }
        },{behavior:"immediate"});
      }
      accepted = true;
      integration.invalidateSourceReviews(row.sourceId);
      if (input.action === "keep_original") {
        if(!authorizer)db.update(schema.projectArchiveOperations).set({ stage: "failed", problem: "kept_original" }).where(eq(schema.projectArchiveOperations.operationId, row.operationId)).run();
        row = operationFor(row.operationId)!;
        integration.settled?.(row.sourceId);
      } else row = input.action === "retry_original" ? execute(row, input.workspaceId) : complete(row, input.workspaceId);
      return { ok: true, value: { operation: view(row) } };
    } catch (e) { return accepted && row ? retain(row, e) : storage(); }
    finally {activeRecovery.delete(input.operationId);}
  }
  function listProjectArchiveOperations(input: unknown): ServiceResult<ProjectArchiveOperationList> {
    if (!isArchiveRequest(input) || input.type !== "workspace.listProjectArchiveOperations") return invalid();
    try {
      const source = sourceFor(input.workspaceId); if (!source) return invalid();
      return { ok: true, value: { workspaceId: input.workspaceId, sourceId: source.id, operations: db.select().from(schema.projectArchiveOperations)
        .where(eq(schema.projectArchiveOperations.sourceId, source.id)).all().filter(r => r.stage === "intent" || r.stage === "destination_recorded").map(view) } };
    } catch { return storage(); }
  }
  function getProjectArchiveOperation(input: unknown): ServiceResult<ProjectArchiveResult> {
    if (!isArchiveRequest(input) || input.type !== "workspace.getProjectArchiveOperation") return invalid();
    try {
      const row = operationFor(input.operationId); return row && sourceFor(input.workspaceId)?.id === row.sourceId ? { ok: true, value: { operation: view(row) } } : invalid();
    } catch { return storage(); }
  }
  return { previewProjectArchive, applyProjectArchive, listProjectArchiveOperations, getProjectArchiveOperation, previewProjectArchiveRecovery, recoverProjectArchive,
    invalidateSource(sourceId: string) {
      for (const [key, r] of reviews) if (r.sourceId === sourceId) reviews.delete(key);
      for (const [key, r] of recoveryReviews) if (r.sourceId === sourceId) recoveryReviews.delete(key);
    }, removeWorkspace(workspaceId: string) { reviews.delete(workspaceId); for (const key of recoveryReviews.keys()) if (key.startsWith(`${workspaceId}:`)) recoveryReviews.delete(key); },
    close() { reviews.clear(); recoveryReviews.clear(); } };
}
