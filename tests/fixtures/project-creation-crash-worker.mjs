import fs from "node:fs";
import Database from "better-sqlite3";
import { openUnconvertedEngineFixture } from "../support/unconverted-command-engines.mjs";
import {openSettingsService} from '../../dist/service/settings.mjs';
// Existing historical engine tests retain their legacy fixture. Runtime consumer
// renewal explicitly selects the compiled current application factory.
const openEngineService = process.env.WORKSPACE_CRASH_ENGINE==='application'?openSettingsService:(...args) => openUnconvertedEngineFixture(...args).engines;

const [databasePath, checkpoint, serializedRequest, cleanupMarker, serializedSetup] = process.argv.slice(2);
let request = JSON.parse(serializedRequest);
let setupResult;
const migrations = process.env.WORKSPACE_CRASH_MIGRATIONS ?? "src/service/db/migrations";
if (serializedSetup) {
  const setup = JSON.parse(serializedSetup);
  const seed = openEngineService(databasePath, migrations);
  const unwrap = (result) => { if (!result.ok) throw new Error(JSON.stringify(result)); return result.value; };
  try {
    const workspace = unwrap(seed.workspaces.create({ type: "workspace.create", name: setup.mode, rootPath: setup.root }));
    const preview = unwrap(seed.workspaces.previewDiscovery({ type: "workspace.previewDiscovery", workspaceId: workspace.workspaceId, mode: setup.mode }));
    unwrap(seed.workspaces.applyDiscovery({ type: "workspace.applyDiscovery", workspaceId: workspace.workspaceId, previewToken: preview.previewToken }));
    const sibling = unwrap(seed.workspaces.create({ type: "workspace.create", name: `${setup.mode} sibling`, rootPath: setup.root }));
    const other = unwrap(seed.workspaces.create({ type: "workspace.create", name: "Unrelated", rootPath: setup.otherRoot }));
    const projects = unwrap(seed.workspaces.listProjects({ type: "workspace.listProjects", workspaceId: workspace.workspaceId }));
    const definition = unwrap(seed.workspaces.createProperty({ type: "workspace.createProperty", workspaceId: workspace.workspaceId, name: "  Notes  ", propertyType: "text" }));
    const existing = projects.projects.find((project) => project.name === "Existing");
    if (!existing) throw new Error("Missing existing seed project");
    unwrap(seed.workspaces.setTextValue({ type: "workspace.setTextValue", workspaceId: workspace.workspaceId, projectId: existing.projectId, propertyId: definition.propertyId, value: "  Retained 日本語\n  " }));
    request = { ...request, workspaceId: workspace.workspaceId, mode: setup.mode, expectedRevision: projects.revision, ...(setup.mode === "grouped" ? { categoryId: projects.categories[0].categoryId } : {}) };
    setupResult = { workspace, sibling, other, projects, properties: unwrap(seed.workspaces.listTextProperties({ type: "workspace.listTextProperties", workspaceId: workspace.workspaceId })) };
  } finally { seed.close(); }
}
const sql = new Database(databasePath);
const stop = () => {
  const message = { checkpoint, request, setup: setupResult, operation: sql.prepare("SELECT * FROM project_creation_operations WHERE operation_id = ?").get(request.operationId) };
  if (process.send) process.send(message); else console.log(JSON.stringify(message));
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
  realpath: (path) => process.platform==='win32'?fs.realpathSync(path):fs.realpathSync.native(path),
  names: (path) => fs.readdirSync(path),
  mkdir(path) {
    if (checkpoint === "after_intent") stop();
    fs.mkdirSync(path, { recursive: false });
    if (checkpoint === "after_mkdir") stop();
  },
};
const service = openEngineService(databasePath, migrations, undefined, undefined, native);
try {
  service.workspaces.subscribe((event) => {
    if (checkpoint === "after_commit" && event.type === "workspace.projectsChanged" &&
      sql.prepare("SELECT stage FROM project_creation_operations WHERE operation_id = ?").get(request.operationId)?.stage === "completed") stop();
  });
  const result = service.handleCommand(request);
  if (process.send) process.send({ unexpectedResult: result }); else console.log(JSON.stringify({ unexpectedResult: result }));
} finally {
  fs.writeFileSync(cleanupMarker, "cleanup executed");
  service.close(); sql.close();
}
