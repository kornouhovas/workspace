import {openSettingsService} from "../../dist/service/settings.mjs";
import { openUnconvertedEngineFixture } from "../support/unconverted-command-engines.mjs";
const openEngineService = (...args) => openUnconvertedEngineFixture(...args).engines;
import { renameNoReplace } from "../../dist/service/project-rename-filesystem.mjs";
import { nativeProjectFilesystem } from "../../src/service/project-filesystem.ts";
import Database from "better-sqlite3";
const [database, workspaceId, categoryId, destinationCategoryId, operationId, phase,policy] = process.argv.slice(2);
const sql = new Database(database);
const filesystem = { ...nativeProjectFilesystem, inspect(path) {
  const row = sql.prepare("SELECT stage FROM category_removal_operations WHERE operation_id = ?").get(operationId);
  if (phase === "batch_intent" && row?.stage === "moving") process.exit(71);
  if (phase === "recorded" && sql.prepare("SELECT 1 FROM project_category_move_operations WHERE stage = 'destination_recorded'").get()) process.exit(71);
  return nativeProjectFilesystem.inspect(path);
}, removeEmptyDirectory(path) {
  if (phase === "cleanup_intent") process.exit(71);
  nativeProjectFilesystem.removeEmptyDirectory(path);
  if (phase === "cleanup_effect") process.exit(71);
} };
let calls = 0;
const native = (from, to) => {
  calls++;
  if (phase === "intent" || phase === "first_completed" && calls === 2) process.exit(71);
  const result = renameNoReplace(from, to);
  if (result !== "renamed") throw new Error("Crash fixture native move failed");
  if (phase === "effect") process.exit(71);
  return result;
};
const observer = { watch() { return { close() {} }; }, schedule() { return { cancel() {} }; } };
const service = (policy==="application"?openSettingsService:openEngineService)(database, undefined, undefined, observer, filesystem, native);
const preview = service.handleQuery({ type: "workspace.previewCategoryRemoval", workspaceId, categoryId, destinationCategoryId });
if (!preview.ok) throw new Error("Crash fixture preview failed");
service.handleCommand({ type: "workspace.applyCategoryRemoval", workspaceId, operationId, previewToken: preview.value.previewToken });
service.close(); sql.close();
throw new Error("Crash fixture did not interrupt");
