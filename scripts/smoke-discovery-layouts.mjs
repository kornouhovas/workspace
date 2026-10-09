import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron } from "playwright-core";
import { closeElectron } from "./runtime-lifecycle.mjs";

// Static Ladle presentation fixtures complement, rather than replace, runtime smoke.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const built = join(root, "dist", "ladle");
const evidence = process.env.WORKSPACE_SMOKE_EVIDENCE_DIR ?? join(root, "work", "discovery-layouts");
await mkdir(evidence, { recursive: true });
const fixture = await mkdtemp(join(tmpdir(), "workspace-ladle-"));
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };
const server = createServer(async (request, response) => {
  try {
    const path = resolve(built, "." + decodeURIComponent(new URL(request.url, "http://localhost").pathname));
    assert.ok(path === built || path.startsWith(built + sep));
    const target = path === built ? join(built, "index.html") : path;
    response.setHeader("Content-Type", mime[extname(target)] ?? "application/octet-stream");
    response.end(await readFile(target));
  } catch { response.writeHead(404); response.end(); }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}`;
const results = { fixture: "production components with typed disposable Ladle data", screenshots: [], featurePassed: false, shutdownPassed: false };
const save = () => writeFile(join(evidence, "ladle-observations.json"), JSON.stringify(results, null, 2) + "\n");
let electron;
let failure;
try {
  await writeFile(join(fixture, "main.cjs"), `const {app, BrowserWindow} = require('electron');
app.setPath('userData', ${JSON.stringify(join(fixture, "data"))});
app.whenReady().then(() => { const window = new BrowserWindow({width:1440,height:960,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}}); window.loadURL(${JSON.stringify(url)}); });
app.on('window-all-closed', () => app.quit());`);
  electron = await _electron.launch({ executablePath: createRequire(import.meta.url)("electron"), args: [join(fixture, "main.cjs")], timeout: 30000 });
  const page = await electron.firstWindow();
  page.setDefaultTimeout(15000);
  const meta = JSON.parse(await readFile(join(built, "meta.json"), "utf8"));
  const stories = Object.keys(meta.stories).filter((name) => /--(discovery-|applied-)/.test(name));
  assert.equal(stories.length, 16, "Expected all eight EN/RU discovery presentation states");
  for (const story of stories) {
    await page.goto(`${url}/?story=${story}&mode=preview`);
    await page.locator(".discovery-panel, .table-view").waitFor();
    if (story.includes("applied-")) await page.waitForFunction(() => globalThis.document.querySelector(".table-view")?.getAttribute("aria-busy") === "false");
    for (const size of [{ width: 1440, height: 960 }, { width: 1024, height: 720 }, { width: 420, height: 800 }]) {
      await page.setViewportSize(size);
      const layout = await page.evaluate(() => ({
        overflow: globalThis.document.documentElement.scrollWidth > globalThis.innerWidth,
        elements: Array.from(globalThis.document.querySelectorAll(".discovery-panel, .discovery-entries li, .project-table, .project-table td, .workspace-root, .workspace-form-actions"))
          .filter((node) => node.scrollWidth > node.clientWidth + 1).map((node) => node.className || node.tagName),
        wrapped: Array.from(globalThis.document.querySelectorAll(".discovery-name, .project-table td, .workspace-root"))
          .filter((node) => node.textContent.length > 150).every((node) => {
            const range = globalThis.document.createRange(); range.selectNodeContents(node);
            return new Set(Array.from(range.getClientRects(), (rect) => Math.round(rect.top))).size > 1;
          }),
      }));
      assert.equal(layout.overflow, false, `${story} ${size.width} document overflow`);
      assert.deepEqual(layout.elements, [], `${story} ${size.width} element overflow`);
      if (size.width === 420) assert.equal(layout.wrapped, true, `${story} long authored text did not wrap`);
      const screenshot = `${story}-${size.width}x${size.height}.png`;
      await page.screenshot({ path: join(evidence, screenshot), fullPage: true });
      results.screenshots.push({ story, ...size, screenshot, layout });
    }
  }
  results.featurePassed = true; await save();
  console.info(`Verified ${results.screenshots.length} EN/RU Ladle screenshots, including wrapping and no horizontal overflow`);
} catch (error) { results.error = error.message; failure = error; await save(); }
finally {
  try {
    if (electron) { await closeElectron(electron); results.shutdownPassed = true; await save(); }
  } catch (error) {
    results.shutdownError = error.message;
    failure = failure ? new AggregateError([failure, error], "Layout checks and shutdown failed") : error;
    await save();
  }
  finally { server.close(); await rm(fixture, { recursive: true, force: true }); }
}
if (failure) throw failure;
