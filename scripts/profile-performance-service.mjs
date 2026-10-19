import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { Session } from "node:inspector";
import { cpus, release, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { createPerformanceFixture } from "./performance-fixture.mjs";

// Separate public-service diagnostics. This is not the packaged Electron
// acceptance route and cannot establish an interaction or startup target pass.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const evidence = resolve(process.env.WORKSPACE_SMOKE_EVIDENCE_DIR ?? "work/issue-41-performance/service-profile");
await mkdir(evidence, { recursive: true });
const fixture = await mkdtemp(join(tmpdir(), "workspace-performance-service-"));
const report = { diagnostic: true, sha: execFileSync("git", ["rev-parse", "HEAD"], {cwd:root,encoding:"utf8"}).trim(),
  run: process.env.GITHUB_RUN_ID, attempt: process.env.GITHUB_RUN_ATTEMPT,
  platform: process.platform, kernel: release(), arch: process.arch, cpu: cpus()[0]?.model,
  harnessSha256: createHash("sha256").update(await readFile(fileURLToPath(import.meta.url))).digest("hex"),
  backendSha256: createHash("sha256").update(await readFile(join(root, "dist/service/settings.mjs"))).digest("hex"),
  measurements: [], status: "running" };
const session = new Session(); session.connect();
const post = promisify(session.post.bind(session));
let service, failure;
const unwrap = result => { assert.equal(result.ok, true, result.ok ? undefined : JSON.stringify(result)); return result.value; };
async function profile(name, operation) {
  await post("Profiler.start");
  const started = performance.now(), cpu = process.cpuUsage();
  try { return await operation(); }
  finally {
    const ms = performance.now() - started, used = process.cpuUsage(cpu);
    const result = await post("Profiler.stop");
    await writeFile(join(evidence, `${name}.cpuprofile`), JSON.stringify(result.profile));
    report.measurements.push({ name, ms, cpuMicroseconds: used });
    console.log(`${name}: ${ms.toFixed(1)} ms (diagnostic public service, no UI)`);
  }
}
try {
  const { openSettingsService } = await import(pathToFileURL(join(root, "dist/service/settings.mjs")));
  console.log("Preparing public-service fixture (excluded from profiles)");
  const dataset = await createPerformanceFixture(fixture, openSettingsService);
  await post("Profiler.enable");
  await profile("open-configured-sources", () => { service = openSettingsService(join(dataset.data, "workspace.sqlite")); });
  for (const source of dataset.sources) {
    const { workspaceId, viewId } = source;
    const list = await profile(`${source.mode}-list-projects`, () => unwrap(service.handleQuery({type:"workspace.listProjects",workspaceId})));
    assert.deepEqual(list.projects.map(p => p.projectId).sort(), source.projects.map(p => p.projectId).sort());
    const projection = {revision:list.revision,projectIds:list.projects.map(p => p.projectId)};
    const result = await profile(`${source.mode}-displayed-view`, () => unwrap(service.handleQuery({type:"workspace.queryView",workspaceId,viewId,archived:false,projection})));
    assert.deepEqual(result.projectIds, projection.projectIds);
    await profile(`${source.mode}-refresh-source`, () => unwrap(service.handleCommand({type:"workspace.refreshSource",workspaceId})));
  }
  // Let the unchanged native observer execute its ordinary health pass. This
  // wait is diagnostic, not a fabricated user interaction or target sample.
  await profile("native-observer-interval", () => new Promise(done => setTimeout(done, 6500)));
  report.status = "diagnostic-complete";
} catch (error) { failure = error; report.status = "failed"; report.error = error.stack; }
finally {
  session.disconnect();
  try { service?.close(); report.serviceClosed = true; }
  catch (error) { failure ??= error; report.closeError = error.message; }
  if (report.serviceClosed) {
    try { await rm(fixture, {recursive:true,force:true,maxRetries:5,retryDelay:100}); report.cleanup = "passed"; }
    catch (error) { failure ??= error; report.cleanup = "failed"; report.cleanupError = error.message; }
  } else report.cleanup = "skipped: service close unverified";
  if (failure) report.status = "failed";
  await writeFile(join(evidence, "report.json"), JSON.stringify(report, null, 2));
}
if (failure) throw failure;
