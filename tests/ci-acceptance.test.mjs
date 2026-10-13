import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import test from "node:test";
import { acceptanceProvenance } from "../scripts/acceptance-provenance.mjs";
import { checkAcceptanceScreenshot } from "../scripts/acceptance-screenshot.mjs";
import { crc32 } from "node:zlib";

// Reduced actual reports from issue 21, full run 38389584529, attempt 1.
const reports = JSON.parse(readFileSync(new URL("./fixtures/ci-acceptance-reports.json", import.meta.url)));
const sha = "df87b607f0606e85590fe980a3ebd513e1650e9b";
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "workspace-acceptance-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const input = join(root, "input"), output = join(root, "output");
  for (const [name, report] of Object.entries(reports)) {
    mkdirSync(dirname(join(input, name)), { recursive: true });
    writeFileSync(join(input, name), JSON.stringify({ ...report, provenance: { sha, runId: "38389584529", attempt: "1", platform: "macos" } }));
  }
  for (const mode of ["dev", "release"]) for (const language of ["en", "ru"]) for (const width of [1024, 1440]) {
    writeFileSync(join(input, `ci-category-options-${mode}/removal-${language}-${width}-${mode}.png`), readFileSync(new URL(`./fixtures/acceptance-${width}.png`, import.meta.url)));
  }
  const run = (...args) => spawnSync(process.execPath, ["scripts/ci-acceptance.mjs", ...args], { encoding: "utf8" });
  const collect = () => run("collect", input, output, sha, "38389584529", "1", "macos");
  const validate = () => run("validate", output, sha, "38389584529", "1", "macos");
  return { input, output, collect, validate, run };
}

test("compact acceptance artifact retains real report gates and validates offline", t => {
  const f = fixture(t), result = f.collect();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(f.validate().status, 0);
  const manifest = JSON.parse(readFileSync(join(f.output, "manifest.json")));
  assert.equal(manifest.sha, sha);
  assert.equal(manifest.status, "passed");
  assert.equal(manifest.files.length, 24);
});

test("missing and failed evidence retains a failed diagnostic artifact", async t => {
  for (const failure of ["missing", "stale", "stale creation", "unbound", "shutdown", "cleanup", "native", "unexpected skip", "missing stage", "missing layout", "duplicate check"]) {
    await t.test(failure, t => {
      const f = fixture(t);
      const edit = (name, mutate) => {
        const path = join(f.input, name), report = JSON.parse(readFileSync(path));
        mutate(report); writeFileSync(path, JSON.stringify(report));
      };
      if (failure === "missing") rmSync(join(f.input, "ci-category-options-dev/evidence.json"));
      if (failure === "stale") edit("ci-category-options-dev/evidence.json", d => { d.sha = "a".repeat(40); });
      if (failure === "stale creation") edit("ci-creation-dev-direct/dev-creation-observations.json", d => { d.provenance.runId = "1"; });
      if (failure === "unbound") edit("ci-runtime-dev/dev-observations.json", d => { delete d.provenance; });
      if (failure === "shutdown") edit("ci-runtime-dev/dev-observations.json", d => { d.shutdowns[0].passed = false; });
      if (failure === "cleanup") edit("ci-category-options-release/evidence.json", d => { d.cleanup.processesStopped = false; });
      if (failure === "native") edit("ci-creation-dev-direct/dev-creation-observations.json", d => { d.runs[0].evidence.direct.fileManagerOutcome.exactTargetObserved = false; });
      if (failure === "unexpected skip") edit("ci-creation-dev-crash-matrix/dev-creation-observations.json", d => { d.runs[0].evidence.direct.creation.status = "skipped"; });
      if (failure === "missing stage") edit("ci-runtime-release/release-observations.json", d => { delete d.stages.restartPersistence; });
      if (failure === "missing layout") edit("ci-category-move-layouts/ladle-observations.json", d => { d.completedStories--; });
      if (failure === "duplicate check") edit("ci-category-options-dev/evidence.json", d => { d.checks[0] = d.checks[1]; });
      assert.equal(f.collect().status, 1);
      assert.equal(JSON.parse(readFileSync(join(f.output, "manifest.json"))).status, "failed");
      assert.equal(f.validate().status, 1);
    });
  }
});

test("producers retain complete CI provenance and leave local/focused evidence unbound", () => {
  assert.equal(acceptanceProvenance({}), null);
  const env = { WORKSPACE_CI_PLATFORM: "windows-2022", GITHUB_SHA: sha, GITHUB_RUN_ID: "38389584529", GITHUB_RUN_ATTEMPT: "1" };
  assert.deepEqual(acceptanceProvenance(env), { sha, runId: "38389584529", attempt: "1", platform: "windows-2022" });
  for (const key of Object.keys(env)) assert.throws(() => acceptanceProvenance({ ...env, [key]: "wrong" }));
});

test("offline validation rejects corruption, wrong provenance and incomplete manifests", async t => {
  for (const failure of ["corrupt", "run", "attempt", "platform", "sha", "manifest missing file", "manifest duplicate file", "unsafe path"]) {
    await t.test(failure, t => {
      const f = fixture(t); assert.equal(f.collect().status, 0);
      const path = join(f.output, "manifest.json"), manifest = JSON.parse(readFileSync(path));
      if (failure === "corrupt") writeFileSync(join(f.output, "ci-category-options-dev/evidence.json"), "{}");
      if (["run", "attempt", "platform", "sha"].includes(failure)) manifest[{ run: "runId", attempt: "attempt", platform: "platform", sha: "sha" }[failure]] = "wrong";
      if (failure === "manifest missing file") manifest.files.pop();
      if (failure === "manifest duplicate file") manifest.files[0] = manifest.files[1];
      if (failure === "unsafe path") manifest.files[0].path = "../outside";
      writeFileSync(path, JSON.stringify(manifest));
      assert.equal(f.validate().status, 1);
    });
  }
});

test("collector requires a new destination and complete CLI identity", t => {
  const f = fixture(t); assert.equal(f.collect().status, 0);
  assert.equal(f.collect().status, 1);
  assert.equal(f.run("validate", f.output).status, 1);
  assert.equal(f.run("unknown").status, 1);
});


test("collector rejects invalid screenshots before hashing them as acceptance", async t => {
  for (const failure of ["signature only", "truncated", "bad CRC"]) await t.test(failure, t => {
    const f = fixture(t), path = join(f.input, 'ci-category-options-dev/removal-en-1024-dev.png');
    let bytes = readFileSync(path);
    if (failure === 'signature only') bytes = bytes.subarray(0, 8);
    if (failure === 'truncated') bytes = bytes.subarray(0, bytes.length - 5);
    if (failure === 'bad CRC') bytes[29] ^= 1;
    writeFileSync(path, bytes);
    assert.equal(f.collect().status, 1);
    assert.equal(JSON.parse(readFileSync(join(f.output, 'manifest.json'))).status, 'failed');
  });
});

test("screenshot decoder rejects valid-checksum wrong dimensions and broken compressed data", () => {
  const original = readFileSync(new URL("./fixtures/acceptance-1024.png", import.meta.url));
  const narrow = Buffer.from(original);
  narrow.writeUInt32BE(1, 16);
  narrow.writeUInt32BE(crc32(narrow.subarray(12, 29)), 29);
  assert.throws(() => checkAcceptanceScreenshot(narrow, 1024), /width/);
  const broken = Buffer.from(original);
  let offset = 8;
  while (broken.toString("ascii", offset + 4, offset + 8) !== "IDAT") offset += 12 + broken.readUInt32BE(offset);
  const end = offset + 12 + broken.readUInt32BE(offset);
  broken[offset + 8] = 0;
  broken.writeUInt32BE(crc32(broken.subarray(offset + 4, end - 4)), end - 4);
  assert.throws(() => checkAcceptanceScreenshot(broken, 1024));
});
