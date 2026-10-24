import {openSettingsService} from "../../dist/service/settings.mjs";
import { openUnconvertedEngineFixture } from "../support/unconverted-command-engines.mjs";
const openEngineService = (...args) => openUnconvertedEngineFixture(...args).engines;
import { renameNoReplace } from "../../dist/service/project-rename-filesystem.mjs";
import { nativeProjectFilesystem } from "../../src/service/project-filesystem.ts";
import Database from "better-sqlite3";
const [database, workspaceId, categoryId, operationId, phase,policy] = process.argv.slice(2);
const sql = new Database(database);
const filesystem = { ...nativeProjectFilesystem, inspect(path) {
  if (phase === "recorded" && sql.prepare("SELECT stage FROM category_folder_operations WHERE operation_id = ?").get(operationId)?.stage === "destination_recorded") process.exit(71);
  return nativeProjectFilesystem.inspect(path);
} };
const native = (from, to) => {
  if (phase === "intent") process.exit(71);
  const result = renameNoReplace(from, to);
  if (result !== "renamed") throw new Error("Native crash fixture failed");
  if (phase === "effect") process.exit(71);
  return result;
};
const observer = { watch() { return { close() {} }; }, schedule() { return { cancel() {} }; } };
const service = (policy==="production"?openSettingsService:openEngineService)(database, undefined, undefined, observer, filesystem, native);
const preview = service.handleQuery({ type: "workspace.previewCategoryFolder", workspaceId, action: "rename", categoryId, name: "Crash target" });
if (!preview.ok) throw new Error("Crash preview failed");
service.handleCommand({ type: "workspace.applyCategoryFolder", workspaceId, operationId, previewToken: preview.value.previewToken });
service.close(); sql.close();
throw new Error("Crash fixture did not interrupt");
