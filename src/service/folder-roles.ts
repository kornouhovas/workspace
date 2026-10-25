import {filesystemAlias} from "./path-alias.js";
import { lstatSync, opendirSync, realpathSync } from "node:fs";
import { join } from "node:path";
import type { FolderRole, FolderRoleOverride, DiscoveryMode, DiscoveryEntry } from "../contracts/workspaces.js";
import { isChildName, directoryObservation, descendantRealpath, automaticDirectoryReason, sameIdentity, reliableIdentity, reserveProjectPlacements, interpretProjects, type DirectoryObservation, type DiscoveryScan, type ProjectAssociation, type GroupedProjectAssociation, scanDirectSource, scanGroupedSource, planDiscovery } from "./discovery.js";

/** Old immutable journal snapshots predate the additive, null role policy. */
export function sourceFolderRolePolicy<T extends object>(source:T & {folderRoles?:string|null}) {
  return {...source,folderRoles:source.folderRoles??null};
}
export function validRolePath(path: unknown): path is string {
  return typeof path === "string" && path.split("/").length <= 64 && path.split("/").every(isChildName) && !path.includes("\\");
}
export function validFolderRoles(value: unknown): value is FolderRoleOverride[] {
  return Array.isArray(value) && value.length <= 10000 && value.every(row => row && typeof row === "object" &&
    Object.keys(row).length === 2 && validRolePath(row.relativePath) && ["group", "status", "project"].includes(row.role)) &&
    new Set(value.map(row => row.relativePath)).size === value.length;
}
export function folderRole(path: string, roles: FolderRoleOverride[], mode: DiscoveryMode): FolderRole {
  return roles.find(row => row.relativePath === path)?.role ?? (mode === "grouped" && !path.includes("/") ? "status" : "project");
}
export function roleParentPlacement(path: string, roles: FolderRoleOverride[], mode: DiscoveryMode) {
  const parts=path ? path.split("/") : [];
  let categoryPath:string|null=null;
  for(let index=0;index<parts.length;index++) {
    const parent=parts.slice(0,index+1).join("/"),role=folderRole(parent,roles,mode);
    if(role==="project")return {allowed:false,categoryPath};
    if(role==="status")categoryPath=parent;
  }
  return {allowed:true,categoryPath};
}
/** A status below any other status is visible, but is not an assignment destination. */
export function nestedStatus(path: string, roles: FolderRoleOverride[], mode: DiscoveryMode): boolean {
  const parent = path.split("/").slice(0, -1).join("/");
  return roleParentPlacement(parent, roles, mode).categoryPath !== null;
}
export function rolePlacement(path: string, roles: FolderRoleOverride[], mode: DiscoveryMode) {
  const parent=roleParentPlacement(path.split("/").slice(0,-1).join("/"),roles,mode);
  return {recognized:parent.allowed&&folderRole(path,roles,mode)==="project",categoryPath:parent.categoryPath};
}
/** Preserve folder semantics when the user explicitly creates or relocates a project. */
export function relocatedFolderRoles(encoded:string,from:string|null,to:string):string|null {
  if(!validRolePath(to))return null;
  const roles=savedFolderRoles({folderRoles:encoded})!;
  if(from===to)return encoded;
  const moves=(path:string)=>from!==null&&(path===from||path.startsWith(`${from}/`));
  if(roles.some(row=>!moves(row.relativePath)&&(row.relativePath===to||row.relativePath.startsWith(`${to}/`))))return null;
  const result=roles.map(row=>moves(row.relativePath)?{...row,relativePath:to+row.relativePath.slice(from!.length)}:row);
  if(folderRole(to,result,"grouped")!=="project")result.push({relativePath:to,role:"project"});
  if(!validFolderRoles(result))return null;
  return JSON.stringify(result.sort((a,b)=>a.relativePath.localeCompare(b.relativePath)));
}
export function savedFolderRoles(source: {folderRoles: string | null}): FolderRoleOverride[] | null {
  if (source.folderRoles === null) return null;
  const roles: unknown = JSON.parse(source.folderRoles);
  if (!validFolderRoles(roles)) throw new Error("Invalid folder roles");
  return roles;
}

// This scanner never opens project contents. Explicit settings expansion is a
// separate read, so it cannot enroll descendants or change ordinary discovery.
export function scanRoleSource(rootPath: string, archive: string | null, exclusions: string[], roles: FolderRoleOverride[], mode: DiscoveryMode, cancelled?: () => boolean): DiscoveryScan {
  const once = () => {
    const observe = (path: string): DirectoryObservation => {
      return directoryObservation(path,lstatSync(join(rootPath,path),{bigint:true}));
    };
    const root = observe("");
    const verify = (parents: DirectoryObservation[]) => {
      if (cancelled?.()) throw new Error("changed");
      for (const parent of parents) {
        if (JSON.stringify(observe(parent.relativePath)) !== JSON.stringify(parent) ||
          descendantRealpath(join(rootPath,parent.relativePath)) !== join(rootPath,parent.relativePath)) throw new Error("changed");
      }
    };
    if (root.kind !== "directory" || realpathSync.native(rootPath) !== rootPath) throw new Error("root_identity_conflict");
    const children: NonNullable<DiscoveryScan["snapshot"]>["children"] = [], entries: DiscoveryEntry[] = [];
    const visit = (parents: DirectoryObservation[], status: string | null) => {
      verify(parents);
      const parent = parents.at(-1)!;
      if (parent.relativePath.split("/").length > 64 || children.length > 100000) throw new Error("changed");
      const directory = opendirSync(join(rootPath,parent.relativePath));
      const names: {name:string;link:boolean;directory:boolean}[] = [];
      try { verify(parents); let entry; while ((entry=directory.readSync()) !== null) {
        if (cancelled?.()) throw new Error("changed");
        if (entry.isFile()) continue;
        if (!isChildName(entry.name)) throw new Error("changed");
        names.push({name:entry.name,link:entry.isSymbolicLink(),directory:entry.isDirectory()});
      }} finally {directory.closeSync();}
      verify(parents);
      for (const entry of names.sort((a,b)=>a.name.localeCompare(b.name))) {
        const path = parent.relativePath ? `${parent.relativePath}/${entry.name}` : entry.name;
        const role = folderRole(path,roles,mode);
        const reason = entry.link ? "link" : !validRolePath(path) ? "unresolved" : !entry.directory ? null : automaticDirectoryReason(entry.name,null) ?? (path === archive || role === "project" && archive?.startsWith(`${path}/`) ? "archive" : exclusions.includes(path) ? "manual" : null);
        if (!entry.directory && !entry.link) continue;
        if (reason) {children.push({relativePath:path,kind:"excluded",reason});
          entries.push(role === "status" ? {relativePath:path,name:entry.name,reason,kind:"category",empty:true}
            : {relativePath:path,name:entry.name,reason,kind:"project",categoryPath:status});continue;}
        verify(parents);
        const child = observe(path);
        if (child.kind !== "directory") throw new Error("changed");
        verify([...parents,child]);
        const archiveParts=archive?.split("/")??[],depth=path.split("/").length;
        if(depth<=archiveParts.length && (role==="project"||depth===archiveParts.length) && filesystemAlias(path)===filesystemAlias(archiveParts.slice(0,depth).join("/"))) {
          // Case aliases suppress only a proved same object. Walk each archive
          // prefix as lstat-only evidence before inspecting its next component.
          let same=true;
          for(let index=1;index<=depth;index++) {
            let designated:DirectoryObservation;
            try{designated=observe(archiveParts.slice(0,index).join("/"));}catch{same=false;break;}
            const expected=index===depth?child:parents[index];
            if(designated.kind!=="directory" || !expected || !sameIdentity(designated.identity,expected.identity)){same=false;break;}
          }
          if(same){children.push({relativePath:path,kind:"excluded",reason:"archive"});entries.push({relativePath:path,name:entry.name,reason:"archive",kind:"project",categoryPath:status});continue;}
        }
        children.push(child);
        if (!reliableIdentity(child.identity)) {children[children.length-1]={relativePath:path,kind:"excluded",reason:"unresolved"};
          entries.push({relativePath:path,name:entry.name,reason:"unresolved",kind:"project",categoryPath:status});continue;}
        if (role === "project") entries.push({relativePath:path,name:entry.name,reason:null,kind:"project",categoryPath:status});
        else {
          if (role === "status") entries.push({relativePath:path,name:entry.name,reason:null,kind:"category",empty:false});
          visit([...parents,child],role === "status" ? path : status);
        }
        verify(parents);
      }
    };
    visit([root],null);
    return {snapshot:{mode,root,children,archiveChild:archive},entries};
  };
  try {
    const first=once(); if (JSON.stringify(first)!==JSON.stringify(once())) throw new Error("changed");
    return {...first,state:first.entries.some(entry=>entry.reason===null)?"ready":"empty"};
  } catch(error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : null;
    return {snapshot:null,entries:[],state:error instanceof Error && error.message === "root_identity_conflict" ? "root_identity_conflict"
      : error instanceof Error && error.message === "changed" ? "changed" : code === "ENOENT" || code === "ENOTDIR" ? "unavailable":"unreadable"};
  }
}
export function scanConfiguredSource(source: {canonicalRoot:string;archiveRelativePath:string|null;folderRoles:string|null;discoveryMode:string|null}, exclusions:string[], cancelled?:()=>boolean): DiscoveryScan {
  const roles=savedFolderRoles(source), mode=source.discoveryMode === "grouped" ? "grouped":"direct";
  return roles ? scanRoleSource(source.canonicalRoot,source.archiveRelativePath,exclusions,roles,mode,cancelled)
    : (mode === "grouped" ? scanGroupedSource:scanDirectSource)(source.canonicalRoot,source.archiveRelativePath,exclusions,cancelled);
}

export function planRoleDiscovery(scan:DiscoveryScan,categories:ProjectAssociation[],projects:GroupedProjectAssociation[], reservations: import("./discovery.js").ProjectPlacementReservation[] = []):ReturnType<typeof planDiscovery> {
  if (!scan.snapshot) throw new Error("Incomplete role scan");
  scan=reserveProjectPlacements(scan,reservations);
  const atRole = (kind:DiscoveryEntry["kind"], records:ProjectAssociation[]) => {
    const entries=scan.entries.filter(entry=>entry.kind===kind);
    const paths=new Set(entries.map(entry=>entry.relativePath));
    const selected={...scan,entries,snapshot:{...scan.snapshot!,children:scan.snapshot!.children.filter(child=>paths.has(child.relativePath))}};
    const matching=records.filter(row=>paths.has(row.relativePath));
    const result=interpretProjects(selected,matching,records.filter(row=>!matching.includes(row)));
    return {...result,retained:records.map(row=>{
      const target=result.retained.find(target=>target.id===row.id);
      return target ? {...target,modeInactive:target.associationState !== "active" && target.associationState !== "excluded" ? row.modeInactive : false}
        : row.modeInactive ? {...row} : (()=>{
          const child=scan.snapshot!.children.find(child=>child.relativePath===row.relativePath);
          const boundary=scan.entries.find(entry=>row.relativePath.startsWith(`${entry.relativePath}/`) && (entry.reason!==null || entry.kind==="project"));
          if(child?.kind==="directory" || boundary?.reason===null && boundary.kind==="project")return {...row,modeInactive:true};
          if(boundary?.reason && !["unresolved","link"].includes(boundary.reason) && ["active","excluded"].includes(row.associationState))return {...row,associationState:"excluded" as const};
          return {...row,associationState:row.associationState==="replaced"||row.associationState==="unresolved"?row.associationState:"missing" as const};
        })();
    })};
  };
  const categoryPlan=atRole("category",categories);
  scan={...scan,entries:scan.entries.map(entry=>{
    if(entry.kind!=="project" || entry.reason!==null || entry.categoryPath===null)return entry;
    const owner=projects.find(row=>row.relativePath===entry.relativePath && !row.modeInactive && row.associationState==="active");
    const oldParent=owner?.categoryId ? categories.find(row=>row.id===owner.categoryId) : undefined;
    const currentParent=oldParent ? categoryPlan.retained.find(row=>row.id===oldParent.id) : undefined;
    const status=categoryPlan.entries.find(row=>row.relativePath===entry.categoryPath);
    return status?.reason!==null || oldParent?.relativePath===entry.categoryPath && currentParent?.associationState!=="active"
      ? {...entry,reason:"unresolved" as const} : entry;
  })};
  const projectPlan=atRole("project",projects);
  const effects:ReturnType<typeof planDiscovery>["projectEffects"]={added:projectPlan.additions.map(row=>({relativePath:row.relativePath,name:row.relativePath.split("/").at(-1)!,categoryPath:scan.entries.find(entry=>entry.kind==="project"&&entry.relativePath===row.relativePath)?.kind==="project"?(scan.entries.find(entry=>entry.kind==="project"&&entry.relativePath===row.relativePath) as Extract<DiscoveryEntry,{kind:"project"}>).categoryPath:null})),retained:[],noLongerRecognized:[],alreadyRetained:[]};
  for (const row of projects) {
    const target=projectPlan.retained.find(target=>target.id===row.id)!;
    const summary={projectId:row.id,name:row.relativePath.split("/").at(-1)!,relativePath:row.relativePath,categoryId:row.categoryId};
    (row.modeInactive||row.associationState!=="active"?effects.alreadyRetained:target.modeInactive||target.associationState!=="active"?effects.noLongerRecognized:effects.retained).push(summary);
  }
  return {entries:[...categoryPlan.entries,...projectPlan.entries],categories:categoryPlan,projects:projectPlan,projectEffects:effects};
}
