import { mkdtemp,mkdir,writeFile } from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createWorkspaceIpcHandler} from "../../electron/workspaceIpc.js";
const fixture = await mkdtemp(join(tmpdir(), "workspace-fixes-ars-"));
const root = join(fixture, "projects");
const metadata = join(fixture, "metadata");
for (const path of ["Active/Project Alpha/docs", "Active/Project Beta", "Done/Project Gamma", "Active/Project with an exceptionally long title for overflow and tab reorder verification", "Waiting/Empty project"])
  await mkdir(join(root, path), { recursive: true });
await writeFile(
  join(root, "Active/Project Alpha/README.md"),
  "# Alpha\nTemporary desktop verification fixture.\n",
);
await writeFile(join(root, "Active/Project Alpha/docs/notes.txt"), "Temporary file\n");
export const handler = createWorkspaceIpcHandler({
  configPath: join(metadata, "settings.json"),
  viewStorePath: join(metadata, "views.json"),
  propertyStorePath: join(metadata, "properties.json"),
  chooseRoot: async () => root,
});
const initial = await handler(null, "workspace.setRoot");
const workspaceId = initial.root.workspaceId;
const property = (
  await handler(null, "workspace.createProperty", { workspaceId, name: "Notes", type: "text" })
).property;
const table = { id: "view:default-table" };
await handler(null, "workspace.updateView", {
  workspaceId,
  viewId: table.id,
  patch: { visiblePropertyIds: ["property:name", "property:status", property.id] },
});
const board = "view:default-board";
await handler(null, "workspace.updateView", {
  workspaceId,
  viewId: board,
  patch: { visiblePropertyIds: ["property:name", "property:status", property.id] },
});
await handler(null, "workspace.setActiveView", { workspaceId, viewId: board });

console.log(JSON.stringify({fixture,metadata,workspaceId}));
