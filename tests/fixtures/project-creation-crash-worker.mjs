import fs from "node:fs";
import Database from "better-sqlite3";
import { openSettingsService } from "../../dist/service/settings.mjs";

const [databasePath, checkpoint, serializedRequest, cleanupMarker] = process.argv.slice(2);
const request = JSON.parse(serializedRequest);
const sql = new Database(databasePath);
const stop = () => {
  process.send({ checkpoint });
  // The parent terminates this process while the command is still executing.
  // Neither catch nor finally can disguise the persisted crash boundary.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
};
const native = {
  platform: process.platform,
  inspect(path) {
    if (checkpoint === "after_evidence" && sql.prepare("SELECT stage FROM project_creation_operations WHERE operation_id = ?").get(request.operationId)?.stage === "evidence_recorded") stop();
    const stat = fs.lstatSync(path, { bigint: true });
    return { kind: stat.isSymbolicLink() ? "link" : stat.isDirectory() ? "directory" : "other",
      identity: { dev: String(stat.dev), ino: String(stat.ino), birthtimeNs: String(stat.birthtimeNs) } };
  },
  realpath: (path) => fs.realpathSync.native(path),
  names: (path) => fs.readdirSync(path),
  mkdir(path) {
    if (checkpoint === "after_intent") stop();
    fs.mkdirSync(path, { recursive: false });
    if (checkpoint === "after_mkdir") stop();
  },
};
const service = openSettingsService(databasePath, "src/service/db/migrations", undefined, undefined, native);
try {
  service.workspaces.subscribe((event) => {
    if (checkpoint === "after_commit" && event.type === "workspace.projectsChanged" &&
      sql.prepare("SELECT stage FROM project_creation_operations WHERE operation_id = ?").get(request.operationId)?.stage === "completed") stop();
  });
  const result = service.handleCommand(request);
  process.send({ unexpectedResult: result });
} finally {
  fs.writeFileSync(cleanupMarker, "cleanup executed");
  service.close(); sql.close();
}
