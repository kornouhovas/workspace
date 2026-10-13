import { openSettingsService } from "../../dist/service/settings.mjs";
import { renameNoReplace } from "../../dist/service/project-rename-filesystem.mjs";
import { nativeProjectFilesystem } from "../../src/service/project-filesystem.ts";
import Database from "better-sqlite3";
const [database, workspaceId, projectId, operationId, action, phase] = process.argv.slice(2);
const sql = new Database(database);
const filesystem = { ...nativeProjectFilesystem,
  inspect(path) {
    const row = sql.prepare("SELECT stage FROM project_archive_operations WHERE operation_id=?").get(operationId);
    if (phase === "recorded" && row?.stage === "destination_recorded") process.exit(71);
    if (phase === "completed" && row?.stage === "completed") process.exit(71);
    return nativeProjectFilesystem.inspect(path);
  },
  mkdir(path) {
    nativeProjectFilesystem.mkdir(path);
    if (phase === "parent_effect") process.exit(71);
  },
};
const native = (from, to) => {
  if (phase === "intent") process.exit(71);
  const outcome = renameNoReplace(from, to);
  if (outcome !== "renamed") throw new Error("Crash fixture native rename failed");
  if (phase === "effect") process.exit(71);
  return outcome;
};
const observer = { watch() { return { close() {} }; }, schedule() { return { cancel() {} }; } };
const service = openSettingsService(database, undefined, undefined, observer, filesystem, native);
const preview = service.handleQuery({ type: "workspace.previewProjectArchive", workspaceId, projectId, action, name: null, createParent: action === "restore" });
if (!preview.ok || !preview.value.previewToken) throw new Error("Crash fixture preview failed");
const result = service.handleCommand({ type: "workspace.applyProjectArchive", workspaceId, operationId, previewToken: preview.value.previewToken });
if (phase === "committed" && result.ok && result.value.operation.stage === "completed") process.exit(71);
throw new Error(`Crash fixture did not reach checkpoint: ${JSON.stringify(result)}`);
