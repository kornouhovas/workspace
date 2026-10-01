import { _electron as electron } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { createWorkspaceIpcHandler } from "../../electron/workspaceIpc.js";

const evidence = resolve("work/workspace-bk1/before");
await mkdir(evidence, { recursive: true });
const fixture = process.env.WORKSPACE_BK1_REUSE ? JSON.parse(await readFile(resolve("work/workspace-bk1/runtime.json"),"utf8")).fixture : await mkdtemp(join(tmpdir(), "workspace-bk1-desktop-"));
const root = join(fixture, "projects");
const metadata = join(fixture, "metadata");
for (const path of ["Active/Project Alpha/docs", "Active/Project Beta", "Done/Project Gamma"])
  await mkdir(join(root, path), { recursive: true });
await writeFile(
  join(root, "Active/Project Alpha/README.md"),
  "# Alpha\nTemporary desktop verification fixture.\n",
);
await writeFile(join(root, "Active/Project Alpha/docs/notes.txt"), "Temporary file\n");
const handler = createWorkspaceIpcHandler({
  configPath: join(metadata, "settings.json"),
  viewStorePath: join(metadata, "views.json"),
  propertyStorePath: join(metadata, "properties.json"),
  chooseRoot: async () => root,
});
const initial = await handler(null, "workspace.setRoot");
const workspaceId = initial.root.workspaceId;
const catalog = await handler(null,"workspace.listProperties",{workspaceId});
const property = catalog.properties.find(p=>p.name==="Notes") || (await handler(null, "workspace.createProperty", { workspaceId, name: "Notes", type: "text" })).property;
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
const app = await electron.launch({
  executablePath: "/tmp/Workspace-bk1.app/Contents/MacOS/Electron",
  args: ["electron/main.js", "--remote-debugging-port=9266"],
  cwd: process.cwd(),
  env: { ...process.env, WORKSPACE_DEV: "1", WORKSPACE_DEV_DATA: metadata, WORKSPACE_DEV_URL: "" },
});
const page = await app.firstWindow();
await page.waitForLoadState("networkidle");
const pid = app.process().pid;
console.log(JSON.stringify({pid,fixture,metadata,root,evidence}));
await writeFile(resolve("work/workspace-bk1/runtime.json"),JSON.stringify({pid,fixture,metadata,root,evidence},null,2));
const {createServer}=await import('node:http');
const server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://127.0.0.1');if(url.pathname==='/size'){await app.evaluate(({app,BrowserWindow},size)=>{const w=BrowserWindow.getAllWindows()[0];w.setSize(...size);app.focus({steal:true});w.moveTop();w.show();w.focus()},[Number(url.searchParams.get('width')),Number(url.searchParams.get('height'))]);}if(url.pathname==='/front')await app.evaluate(({app,BrowserWindow})=>{app.focus({steal:true});const w=BrowserWindow.getAllWindows()[0];w.show();w.moveTop();w.focus()});if(url.pathname==='/mode'){await app.evaluate(({ipcMain},params)=>{globalThis.__workspaceFixtureHandler ||= ipcMain._invokeHandlers.get('workspace:request');const handler=globalThis.__workspaceFixtureHandler;globalThis.__workspaceFixtureCalls=[];ipcMain.removeHandler('workspace:request');ipcMain.handle('workspace:request',async(event,method,payload)=>{globalThis.__workspaceFixtureCalls.push(method);if(params.delay)await new Promise(resolve=>setTimeout(resolve,params.delay));if(method===params.failMethod)throw new Error('Isolated fixture storage unavailable');return handler(event,method,payload)});},{delay:Number(url.searchParams.get('delay')||0),failMethod:url.searchParams.get('failMethod')||''});}if(url.pathname==='/calls'){res.end(JSON.stringify(await app.evaluate(()=>globalThis.__workspaceFixtureCalls||[])));return;}const state=await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];return {bounds:w.getBounds(),contentBounds:w.getContentBounds(),security:w.webContents.getLastWebPreferences()}});res.end(JSON.stringify(state));}catch(e){res.statusCode=500;res.end(String(e));}});
server.listen(9267,'127.0.0.1');
await new Promise(resolve => setTimeout(resolve,3600000));
server.close();
await app.close();
