import {openSettingsService} from "../../dist/service/settings.mjs";
import { openUnconvertedEngineFixture } from "../support/unconverted-command-engines.mjs";
const openEngineService = (...args) => engine==="application"?openSettingsService(...args):openUnconvertedEngineFixture(...args).engines;
import { renameNoReplace } from "../../dist/service/project-rename-filesystem.mjs";
import { nativeProjectFilesystem } from "../../src/service/project-filesystem.ts";
import Database from "better-sqlite3";
const [database, workspaceId, projectId, operationId, action, phase,engine] = process.argv.slice(2);
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
if(phase==="completed") {
  const prepare=Database.prototype.prepare;
  Database.prototype.prepare=function(query,...args){const statement=prepare.call(this,query,...args);
    if(query.trimStart().toLowerCase().startsWith('update "project_archive_operations"')){const run=statement.run;statement.run=function(...values){const result=run.apply(this,values);if(values.flat().includes('completed'))process.exit(71);return result;};}
    return statement;
  };
}
const service = openEngineService(database, undefined, undefined, observer, filesystem, native);
const preview = service.handleQuery({ type: "workspace.previewProjectArchive", workspaceId, projectId, action, name: null, createParent: action === "restore" });
if (!preview.ok || !preview.value.previewToken) throw new Error("Crash fixture preview failed");
const result = service.handleCommand({ type: "workspace.applyProjectArchive", workspaceId, operationId, previewToken: preview.value.previewToken });
if (phase === "committed" && result.ok && result.value.operation.stage === "completed") process.exit(71);
throw new Error(`Crash fixture did not reach checkpoint: ${JSON.stringify(result)}`);
