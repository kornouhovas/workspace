import fs from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { openSettingsService } from "../../dist/service/settings.mjs";
import { renameNoReplace } from "../../dist/service/project-rename-filesystem.mjs";

const [databasePath, checkpoint, serializedRequest, cleanupMarker] = process.argv.slice(2);
const request = JSON.parse(serializedRequest), sql = new Database(databasePath);
const row = () => sql.prepare("SELECT * FROM project_rename_operations WHERE operation_id = ?").get(request.operationId);
const project = sql.prepare("SELECT p.relative_path, s.canonical_root FROM projects p JOIN sources s ON p.source_id = s.id WHERE p.id = ?").get(request.projectId);
const original = join(project.canonical_root, project.relative_path);
const requested = join(project.canonical_root, project.relative_path.split("/").slice(0, -1).join("/"), request.name);
const inspect = (path) => {
  const stat = fs.lstatSync(path, { bigint: true });
  return { kind: stat.isSymbolicLink() ? "link" : stat.isDirectory() ? "directory" : "other",
    identity: { dev: String(stat.dev), ino: String(stat.ino), birthtimeNs: String(stat.birthtimeNs) } };
};
const actualSelfAlias = (() => { try { return JSON.stringify(inspect(original)) === JSON.stringify(inspect(requested)); } catch { return false; } })();
const stop = () => {
  process.send({ checkpoint, operation: row(), actualSelfAlias });
  // The parent kills the process while the service command is still executing.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
};
const filesystem = {
  platform: process.platform,
  inspect(path) {
    const current = row();
    if (checkpoint === "staged_evidence" && current?.stage === "staged") stop();
    if (checkpoint === "destination_evidence" && current?.stage === "destination_recorded") stop();
    // Case-sensitive hosts still exercise the durable two-hop protocol. This
    // seam supplies alias policy only; actual mounted-case evidence is separate.
    if (!actualSelfAlias && path === requested && fs.existsSync(original)) return inspect(original);
    return inspect(path);
  },
  names: (path) => fs.readdirSync(path),
  realpath: (path) => fs.realpathSync.native(path),
  mkdir: (path) => fs.mkdirSync(path),
};
let hops = 0;
const service = openSettingsService(databasePath, "src/service/db/migrations", undefined, undefined, filesystem, (from, to) => {
  if (checkpoint === "intent" && hops === 0) stop();
  const result = renameNoReplace(from, to);
  if (result !== "renamed") throw new Error("Native effect did not occur");
  hops++;
  if (checkpoint === "first_effect" && hops === 1 || checkpoint === "final_effect" && hops === 2) stop();
  return result;
});
try {
  service.workspaces.subscribe((event) => {
    if (checkpoint === "commit" && event.type === "workspace.projectsChanged" && row()?.stage === "completed") stop();
  });
  process.send({ unexpectedResult: service.renameProject(request) });
} finally {
  fs.writeFileSync(cleanupMarker, "cleanup executed");
  service.close(); sql.close();
}
