import {observeFolder,sameDurableFolder} from './folder-evidence.js';
import type { ProjectRevealProblem } from "../contracts/project-reveal.js";
import { isTrustedProjectRevealTarget, type TrustedProjectRevealTarget } from "../contracts/service-protocol.js";
import { accessSync, constants, lstatSync, mkdirSync, opendirSync, readdirSync, realpathSync, rmdirSync } from "node:fs";
import { isAbsolute, join, relative, sep } from "node:path";
import { reliableIdentity, sameIdentity, type NativeIdentity } from "./discovery.js";
import type { ProjectCreationProblem } from "../contracts/project-creation.js";
import { filesystemAlias } from "./path-alias.js";

export interface ProjectFilesystem {
  platform: NodeJS.Platform;
  inspect(path: string): { kind: "directory" | "link" | "other"; identity: NativeIdentity };
  realpath(path: string): string;
  names(path: string): string[];
  mkdir(path: string): void;
  removeEmptyDirectory?(path: string): void;
  assertAccessible?(path: string): void;
}

export const nativeProjectFilesystem: ProjectFilesystem = {
  platform: process.platform,
  assertAccessible(path) {
    accessSync(path, constants.R_OK | constants.X_OK);
    const directory = opendirSync(path); directory.closeSync();
  },
  inspect(path) {
    const stat = lstatSync(path, { bigint: true });
    return { kind: stat.isSymbolicLink() ? "link" : stat.isDirectory() ? "directory" : "other",
      identity: { dev: String(stat.dev), ino: String(stat.ino), birthtimeNs: String(stat.birthtimeNs) } };
  },
  // Windows native realpath briefly opens descendants without DELETE sharing.
  // Roots are canonicalized at the source boundary; retain route/link checks
  // through the same non-exclusive resolver used by discovery and evidence.
  realpath: (path) => process.platform === "win32" ? realpathSync(path) : realpathSync.native(path),
  names: (path) => readdirSync(path),
  mkdir: (path) => { mkdirSync(path, { recursive: false }); },
  removeEmptyDirectory: (path) => { rmdirSync(path); },
};

export class CreationFailure extends Error {
  constructor(readonly problem: ProjectCreationProblem) { super(problem); }
}

export function validProjectBasename(name: string, platform: NodeJS.Platform): boolean {
  if (!name || name === "." || name === ".." || name.includes("/") || name.includes("\0") ||
    Buffer.from(name, "utf8").toString("utf8") !== name) return false;
  if (platform === "win32") return name.length <= 255 && !/[<>:"\\|?*]/.test(name) && !Array.from(name).some((char) => char.charCodeAt(0) < 32) && !/[. ]$/.test(name) &&
    !/^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(name);
  // Let the mounted filesystem enforce its component limit. POSIX filesystems
  // differ in byte/Unicode limits; do not silently reject an otherwise valid name.
  return true;
}

export function filesystemProblem(error: unknown): ProjectCreationProblem {
  if (error instanceof CreationFailure) return error.problem;
  const code = filesystemCode(error);
  return code === "EACCES" || code === "EPERM" || code === "EROFS" ? "permission_denied"
    : code === "ENOENT" || code === "ENOTDIR" ? "source_unavailable"
    : code === "EEXIST" ? "occupied" : code === "ENAMETOOLONG" ? "invalid_name" : "filesystem_error";
}

export function filesystemCode(error: unknown): unknown {
  return typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
}

export function verifyCreationDirectory(filesystem: ProjectFilesystem, path: string, expected: NativeIdentity) {
  const before = filesystem.inspect(path);
  if (before.kind !== "directory" || !reliableIdentity(before.identity) || !sameIdentity(before.identity, expected) ||
    filesystem.realpath(path) !== path) throw new CreationFailure("filesystem_changed");
  const after = filesystem.inspect(path);
  if (after.kind !== "directory" || !sameIdentity(before.identity, after.identity)) throw new CreationFailure("filesystem_changed");
}

export function verifyCreationParents(filesystem: ProjectFilesystem, binding: {
  canonicalRoot: string; parentRelativePath: string; rootIdentity: string; parentIdentity: string;
}) {
  const rootIdentity = JSON.parse(binding.rootIdentity) as NativeIdentity;
  const parentIdentity = JSON.parse(binding.parentIdentity) as NativeIdentity;
  verifyCreationDirectory(filesystem, binding.canonicalRoot, rootIdentity);
  const parent = join(binding.canonicalRoot, binding.parentRelativePath);
  const rel = relative(binding.canonicalRoot, parent);
  if (isAbsolute(rel) || rel !== binding.parentRelativePath) throw new CreationFailure("filesystem_changed");
  verifyCreationDirectory(filesystem, parent, parentIdentity);
  verifyCreationDirectory(filesystem, binding.canonicalRoot, rootIdentity);
  return parent;
}

export function assertCreationDestinationFree(filesystem: ProjectFilesystem, parent: string, name: string) {
  const names = filesystem.names(parent);
  if (names.includes(name)) throw new CreationFailure("occupied");
  if (names.some((entry) => filesystemAlias(entry) === filesystemAlias(name))) throw new CreationFailure("case_alias");
  try { filesystem.inspect(join(parent, name)); }
  catch (error) { if (filesystemCode(error) === "ENOENT") return; throw error; }
  throw new CreationFailure("occupied");
}

export class RevealFailure extends Error {
  constructor(readonly problem: ProjectRevealProblem) { super(problem); }
}
// Shared evidence checks, with no SQLite access and no project-content enumeration.
export function verifyTrustedProjectRevealTarget(target: TrustedProjectRevealTarget, filesystem: ProjectFilesystem = nativeProjectFilesystem): string {
  if (!isTrustedProjectRevealTarget(target) || !isAbsolute(target.canonicalRoot)) throw new RevealFailure("unresolved");
  const components = target.relativePath.split("/");
  if (!components.every((name) => validProjectBasename(name, filesystem.platform))) throw new RevealFailure("unresolved");
  if (target.ancestors) {
    if (target.ancestors.length !== components.length - 1 || target.parentRelativePath !== components.slice(0, -1).join("/") ||
      target.ancestors.some((ancestor, index) => ancestor.relativePath !== components.slice(0, index + 1).join("/")) ||
      target.parentIdentity !== target.ancestors.at(-1)?.identity) throw new RevealFailure("unresolved");
  } else if (components.length !== (target.parentRelativePath === "" ? 1 : 2) ||
    (target.parentRelativePath !== "" && target.parentRelativePath !== components[0])) throw new RevealFailure("unresolved");
  const verifyFull=()=>{
    if(!target.authorization)return;
    const expectedPaths=["",...components.map((_,index)=>components.slice(0,index+1).join("/"))];
    const proofs=target.authorization.folders;
    if(proofs.length!==expectedPaths.length || proofs.some((proof,index)=>proof.relativePath!==expectedPaths[index]))throw new RevealFailure("unresolved");
    const root=proofs[0];
    if(!sameIdentity(root.mount,JSON.parse(target.rootIdentity)) || !sameIdentity(proofs.at(-1)!.mount,JSON.parse(target.nativeIdentity)) ||
      !sameIdentity(proofs.at(-2)!.mount,JSON.parse(target.parentIdentity)))throw new RevealFailure("unresolved");
    for(const proof of proofs) {
      const current=observeFolder(join(target.canonicalRoot,proof.relativePath),root.evidence.scope);
      if(!current.ok || !sameDurableFolder(current.evidence,proof.evidence) || !sameIdentity(current.mount,proof.mount) ||
        proof.evidence.scope!==root.evidence.scope || proof.evidence.provider!==root.evidence.provider || proof.evidence.volume!==root.evidence.volume || proof.evidence.serial!==root.evidence.serial)throw new RevealFailure("replaced");
    }
  };
  const path = join(target.canonicalRoot, ...components), parent = join(target.canonicalRoot, target.parentRelativePath);
  const rel = relative(target.canonicalRoot, path);
  if (isAbsolute(rel) || rel === ".." || rel.startsWith(`..${sep}`) || path === target.canonicalRoot) throw new RevealFailure("unresolved");
  const verify = (path: string, identity: string, missing: ProjectRevealProblem, changed: ProjectRevealProblem) => {
    try {
      const expected = JSON.parse(identity), before = filesystem.inspect(path);
      if (before.kind !== "directory" || !reliableIdentity(expected) || !sameIdentity(before.identity, expected) || filesystem.realpath(path) !== path) throw new RevealFailure(changed);
      filesystem.assertAccessible?.(path);
      const after = filesystem.inspect(path);
      if (after.kind !== "directory" || !sameIdentity(after.identity, expected)) throw new RevealFailure(changed);
    } catch (error) {
      if (error instanceof RevealFailure) throw error;
      throw new RevealFailure(["ENOENT", "ENOTDIR"].includes(String(filesystemCode(error))) ? missing : "unavailable");
    }
  };
  const root = () => verify(target.canonicalRoot, target.rootIdentity, "root_unavailable", "root_replaced");
  const category = () => verify(parent, target.parentIdentity, "category_unavailable", "category_unavailable");
  const parents = () => {
    if (target.ancestors) for (const ancestor of target.ancestors) verify(join(target.canonicalRoot, ancestor.relativePath), ancestor.identity, "category_unavailable", "category_unavailable");
    else if (target.parentRelativePath) category();
  };
  verifyFull();root(); parents();
  verify(path, target.nativeIdentity, "missing", "replaced");
  parents(); root();verifyFull();
  return path;
}
