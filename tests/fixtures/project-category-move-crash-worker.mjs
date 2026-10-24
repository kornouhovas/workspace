import fs from "node:fs";
import Database from "better-sqlite3";
import { openSettingsService } from "../../dist/service/settings.mjs";
import { openUnconvertedEngineFixture } from "../support/unconverted-command-engines.mjs";
const openEngineService = (...args) => openUnconvertedEngineFixture(...args).engines;
import { renameNoReplace } from "../../dist/service/project-rename-filesystem.mjs";

const [databasePath, checkpoint, serializedRequest, cleanupMarker, policy] = process.argv.slice(2);
const request = JSON.parse(serializedRequest), sql = new Database(databasePath);
const stage = () => sql.prepare("SELECT stage FROM project_category_move_operations WHERE operation_id = ?").get(request.operationId)?.stage;
const stop = () => {
  process.send({ checkpoint, operationId: request.operationId, stage: stage() });
  // Keep the command on its stack until the parent acknowledges the checkpoint
  // by killing this owned process. Neither finally nor service close can run.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
};
const filesystem = {
  platform: process.platform,
  inspect(path) {
    if (checkpoint === "destination_evidence" && stage() === "destination_recorded") stop();
    const stat = fs.lstatSync(path, { bigint: true });
    return { kind: stat.isSymbolicLink() ? "link" : stat.isDirectory() ? "directory" : "other",
      identity: { dev: String(stat.dev), ino: String(stat.ino), birthtimeNs: String(stat.birthtimeNs) } };
  },
  names: (path) => fs.readdirSync(path),
  realpath: (path) => (process.platform === "win32" ? fs.realpathSync : fs.realpathSync.native)(path),
  mkdir: (path) => fs.mkdirSync(path),
  assertAccessible(path) { fs.accessSync(path, fs.constants.R_OK | fs.constants.X_OK); const dir = fs.opendirSync(path); dir.closeSync(); },
};
const dependencies = { watch() { return { close() {} }; }, schedule() { return { cancel() {} }; } };
const service = (policy === "production" ? openSettingsService : openEngineService)(databasePath, undefined, undefined, dependencies, filesystem, (from, to) => {
  if (checkpoint === "intent") stop();
  const outcome = renameNoReplace(from, to);
  if (outcome !== "renamed") throw new Error("Required native effect did not occur");
  if (checkpoint === "native_effect") stop();
  return outcome;
});
try {
  service.workspaces.subscribe((event) => {
    if (checkpoint === "commit" && event.type === "workspace.projectsChanged" && stage() === "completed") stop();
  });
  process.send({ unexpectedResult: service.moveProjectCategory(request) });
} finally {
  fs.writeFileSync(cleanupMarker, "cleanup executed");
  service.close(); sql.close();
}
