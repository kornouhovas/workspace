import { createRequire } from "node:module";
import { dirname, join, toNamespacedPath } from "node:path";
import { fileURLToPath } from "node:url";
import { lstatSync, realpathSync } from "node:fs";

import {validateEvidence,type FolderObservation,type EvidenceFailure} from '../contracts/folder-evidence.js';
export {validateEvidence,durableOwnershipKey,sameDurableFolder,type FolderEvidence,type FolderObservation,type EvidenceFailure} from '../contracts/folder-evidence.js';
const reasons = new Set<EvidenceFailure>(["unsupported", "missing_attributes", "permission_denied", "disconnected", "changed"]);
const directory = typeof __dirname === "string" ? __dirname : dirname(fileURLToPath(import.meta.url));
const requireNative = createRequire(join(directory, "folder-evidence.cjs"));
let native: { observeFolder(path: string): unknown } | undefined;

export function observeFolder(path: string, scope: string): FolderObservation {
  try {
    // Match discovery's Windows route policy: native realpath briefly opens a
    // descendant without DELETE sharing. Canonical roots remain established by
    // the source boundary; legacy resolution still rejects redirected routes.
    const routeRealpath = process.platform === "win32" ? realpathSync : realpathSync.native;
    const before = lstatSync(path, { bigint: true });
    if (!before.isDirectory() || routeRealpath(path) !== path) return {ok: false, reason: "changed"};
    if (before.ino <= 0n || before.birthtimeNs <= 0n) return {ok:false,reason:"missing_attributes"};
    if (process.platform !== "darwin" && process.platform !== "win32") return {ok: false, reason: "unsupported"};
    if (!native) {
      // Source imports are used by host tests; emitted modules use the same fixed artifact provenance.
      const separator=process.platform==="win32"?"\\":"/";
      const root = directory.endsWith(`${separator}src${separator}service`) ? join(directory,"../../dist/service")
        : directory.endsWith(`${separator}dist${separator}desktop`) ? join(directory,"../service") : directory;
      try { native = requireNative(join(root, process.versions.electron ? "native/project-rename.node" : "../service-test-native/project-rename.node")); }
      catch { return {ok: false, reason: "unsupported"}; }
    }
    // Node fs uses long-path namespacing internally; raw Win32 calls do not.
    // Keep the canonical locator for validation/storage and qualify only this
    // private syscall operand, including long Unicode descendants.
    const raw = native!.observeFolder(process.platform === "win32" ? toNamespacedPath(path) : path);
    if (typeof raw === "string") return {ok: false, reason: reasons.has(raw as EvidenceFailure) ? raw as EvidenceFailure : "missing_attributes"};
    const evidence = { ...(raw as object), version: 1, scope, provider: process.platform === "darwin" ? "apfs" : "ntfs" };
    if (!validateEvidence(evidence)) return {ok: false, reason: "missing_attributes"};
    const after = lstatSync(path, {bigint: true});
    if (!after.isDirectory() || before.dev !== after.dev || before.ino !== after.ino || before.birthtimeNs !== after.birthtimeNs ||
      routeRealpath(path) !== path) return {ok: false, reason: "changed"};
    return {ok: true, evidence, mount: {dev: after.dev.toString(), ino: after.ino.toString(), birthtimeNs: after.birthtimeNs.toString()}};
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return {ok: false, reason: code === "ENOENT" || code === "ENOTDIR" ? "disconnected" : code === "EACCES" || code === "EPERM" ? "permission_denied" : "missing_attributes"};
  }
}
