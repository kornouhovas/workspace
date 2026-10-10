import { createRequire } from "node:module";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Private adapter outcomes. No OS messages or paths cross this boundary. */
export type ProjectRenameFilesystemResult = "renamed" | "occupied" | "invalid_argument" | "source_unavailable" |
  "permission_denied" | "busy" | "cross_device" | "unsupported" | "filesystem_error" | "native_unavailable";

type NativeAdapter = { renameNoReplace(fromPath: string, toPath: string): unknown };
const results = new Set<ProjectRenameFilesystemResult>(["renamed", "occupied", "invalid_argument", "source_unavailable",
  "permission_denied", "busy", "cross_device", "unsupported", "filesystem_error"]);
// esbuild preserves __dirname in CJS; ESM uses its own emitted module URL.
// Neither process cwd, PATH, environment overrides nor client input selects a module.
const moduleDirectory = typeof __dirname === "string" ? __dirname : dirname(fileURLToPath(import.meta.url));
const requireNative = createRequire(join(moduleDirectory, "project-rename-filesystem.cjs"));
let adapter: NativeAdapter | undefined;

function validPath(value: unknown): value is string {
  return typeof value === "string" && isAbsolute(value) && !value.includes("\0") &&
    Buffer.from(value, "utf8").toString("utf8") === value;
}

/** Call only after service-owned policy/identity checks and durable intent.
 * This primitive protects the destination, not ancestor/source confinement. */
export function renameNoReplace(fromPath: string, toPath: string): ProjectRenameFilesystemResult {
  if (arguments.length !== 2 || !validPath(fromPath) || !validPath(toPath)) return "invalid_argument";
  if (process.platform !== "darwin" && process.platform !== "win32") return "unsupported";
  if (!adapter) {
    try {
      const loaded: unknown = requireNative(join(moduleDirectory, process.versions.electron ?
        "native/project-rename.node" : "../service-test-native/project-rename.node"));
      if (typeof loaded !== "object" || loaded === null || !("renameNoReplace" in loaded) ||
        typeof loaded.renameNoReplace !== "function") return "native_unavailable";
      adapter = loaded as NativeAdapter;
    } catch { return "native_unavailable"; }
  }
  try {
    const outcome = adapter.renameNoReplace(fromPath, toPath);
    return typeof outcome === "string" && results.has(outcome as ProjectRenameFilesystemResult) ?
      outcome as ProjectRenameFilesystemResult : "filesystem_error";
  } catch { return "filesystem_error"; }
}
