import { lstatSync, mkdirSync, readdirSync, realpathSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import { reliableIdentity, sameIdentity, type NativeIdentity } from "./discovery.js";
import type { ProjectCreationProblem } from "../contracts/project-creation.js";

export interface ProjectFilesystem {
  platform: NodeJS.Platform;
  inspect(path: string): { kind: "directory" | "link" | "other"; identity: NativeIdentity };
  realpath(path: string): string;
  names(path: string): string[];
  mkdir(path: string): void;
}

export const nativeProjectFilesystem: ProjectFilesystem = {
  platform: process.platform,
  inspect(path) {
    const stat = lstatSync(path, { bigint: true });
    return { kind: stat.isSymbolicLink() ? "link" : stat.isDirectory() ? "directory" : "other",
      identity: { dev: String(stat.dev), ino: String(stat.ino), birthtimeNs: String(stat.birthtimeNs) } };
  },
  realpath: (path) => realpathSync.native(path),
  names: (path) => readdirSync(path),
  mkdir: (path) => { mkdirSync(path, { recursive: false }); },
};

export class CreationFailure extends Error {
  constructor(readonly problem: ProjectCreationProblem) { super(problem); }
}

// Conservatively reject colliding case/Unicode spellings on every supported
// filesystem. Do not normalize the authored name used in mkdir or persistence.
export const creationAlias = (path: string) => path.normalize("NFD").toLowerCase();

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
  if (names.some((entry) => creationAlias(entry) === creationAlias(name))) throw new CreationFailure("case_alias");
  try { filesystem.inspect(join(parent, name)); }
  catch (error) { if (filesystemCode(error) === "ENOENT") return; throw error; }
  throw new CreationFailure("occupied");
}
