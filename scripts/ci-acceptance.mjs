import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertCategoryMoveAcceptance, assertRenameAcceptance, createRuntimeStages } from "./runtime-evidence.mjs";
import { checkAcceptanceScreenshot } from "./acceptance-screenshot.mjs";

const modes = ["dev", "release"];
const platforms = { macos: "darwin", windows: "win32", "windows-2022": "win32" };
const files = modes.flatMap(mode => [
  ...["observations", "rename-observations", "category-move-observations"].map(tail => `ci-runtime-${mode}/${mode}-${tail}.json`),
  ...["crash-matrix", "direct", "grouped"].map(route => `ci-creation-${mode}-${route}/${mode}-creation-observations.json`),
  `ci-category-options-${mode}/evidence.json`,
  ...["en", "ru"].flatMap(language => [1024, 1440].map(width => `ci-category-options-${mode}/removal-${language}-${width}-${mode}.png`)),
]).concat(["ci-creation-layouts/ladle-observations.json", "ci-category-move-layouts/ladle-observations.json"]);
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const passed = value => assert.equal(value, true);
function cleanup(value) {
  assert.equal(value.status, "passed"); passed(value.asserted); passed(value.processesStopped);
}
function asserted(value) { assert.equal(value.status, "passed"); passed(value.asserted); }
function identity(sha, runId, attempt, platform) {
  assert.match(sha, /^[a-f0-9]{40}$/);
  assert.match(runId, /^[1-9]\d*$/); assert.match(attempt, /^[1-9]\d*$/);
  assert.ok(Object.hasOwn(platforms, platform), "Unknown acceptance platform");
  return { sha, runId, attempt, platform };
}
function read(root, name) {
  // Fixed inventories never follow caller-authored paths or symlinks.
  let path = resolve(root);
  assert.ok(lstatSync(path).isDirectory() && !lstatSync(path).isSymbolicLink());
  for (const component of name.split("/")) {
    path = resolve(path, component);
    assert.ok(!lstatSync(path).isSymbolicLink(), "Acceptance evidence cannot be a symlink");
  }
  assert.ok(lstatSync(path).isFile());
  return readFileSync(path);
}
function checkReports(root, expected) {
  const json = name => {
    const report = JSON.parse(read(root, name));
    assert.deepEqual(report.provenance, expected, `Stale or unbound report: ${name}`);
    return report;
  };
  for (const mode of modes) {
    const runtime = json(`ci-runtime-${mode}/${mode}-observations.json`);
    assert.equal(runtime.status, "passed");
    assert.equal(runtime.mode, mode); assert.equal(runtime.platform, platforms[expected.platform]);
    for (const stage of Object.keys(createRuntimeStages())) passed(runtime.stages[stage]);
    assert.ok(runtime.shutdowns.length > 0); runtime.shutdowns.forEach(shutdown => passed(shutdown.passed));
    cleanup(runtime.fixtureCleanup);

    const rename = json(`ci-runtime-${mode}/${mode}-rename-observations.json`);
    assert.equal(rename.status, "passed"); assert.equal(rename.sourceRevision, expected.sha);
    assert.equal(rename.mode, mode); assert.equal(rename.platform, platforms[expected.platform]);
    assertRenameAcceptance(rename.evidence);
    assert.ok(rename.shutdowns.length > 0); rename.shutdowns.forEach(shutdown => passed(shutdown.passed));
    const move = json(`ci-runtime-${mode}/${mode}-category-move-observations.json`);
    assert.equal(move.status, "passed"); assert.equal(move.inputs.sourceRevision, expected.sha);
    assert.equal(move.inputs.mode, mode); assert.equal(move.inputs.platform, platforms[expected.platform]);
    assertCategoryMoveAcceptance(move.evidence, move.inputs);
    assert.ok(move.shutdowns.length > 0); move.shutdowns.forEach(shutdown => passed(shutdown.passed));

    for (const route of ["crash-matrix", "direct", "grouped"]) {
      const creation = json(`ci-creation-${mode}-${route}/${mode}-creation-observations.json`);
      assert.equal(creation.mode, mode); assert.equal(creation.platform, platforms[expected.platform]);
      cleanup(creation.fixtureCleanup);
      const expectedRuns = route === "crash-matrix"
        ? ["direct", "grouped"].flatMap(discovery => ["after_intent", "after_mkdir", "after_evidence", "after_commit"].map(checkpoint => `${discovery}/${checkpoint}`))
        : [`${route}/after_evidence`];
      assert.deepEqual(creation.runs.map(run => `${run.discoveryMode}/${run.checkpoint}`).sort(), expectedRuns.sort());
      for (const run of creation.runs) {
        const evidence = run.evidence, selected = evidence[run.discoveryMode];
        asserted(selected.creation);
        if (run.checkpoint === "after_commit") {
          assert.equal(selected.interruptionRecovery.status, "skipped");
          assert.equal(selected.interruptionRecovery.reason, "Committed before response loss; status reconciliation verified, no recovery mutation required");
        } else asserted(selected.interruptionRecovery);
        asserted(evidence.normalShutdown); passed(evidence.normalShutdown.backendStopped);
        asserted(evidence.restartPersistence);
        assert.equal(run.shutdowns.length, 2);
        run.shutdowns.forEach(shutdown => { assert.equal(shutdown.status, "passed"); passed(shutdown.backendStopped); });
        if (route === "crash-matrix") {
          assert.equal(selected.nativeInvocation.status, "skipped");
          assert.equal(selected.nativeInvocation.reason, "Explicit recovery-only run; no native API invoked");
          assert.equal(selected.fileManagerOutcome.status, "skipped");
          assert.equal(selected.fileManagerOutcome.reason, "Explicit recovery-only run");
          assert.equal(selected.nativeAcknowledgment.status, "unreached");
        } else {
          for (const stage of ["nativeInvocation", "nativeAcknowledgment", "fileManagerOutcome"]) asserted(selected[stage]);
          passed(selected.fileManagerOutcome.exactTargetObserved);
        }
      }
    }
    const options = json(`ci-category-options-${mode}/evidence.json`);
    assert.equal(options.sha, expected.sha); assert.equal(options.status, "passed");
    assert.equal(options.mode, mode); assert.equal(options.platform, platforms[expected.platform]);
    const expectedChecks = ["explicit-create-empty-and-associate-existing-ui", "removal-empty-no-destination-ui", "production-ipc-exact-validation", "electron-restart-persistence"];
    for (const language of ["en", "ru"]) {
      for (const scenario of ["preview-layout", "removal-preview-layout"]) for (const width of [1024, 1440]) expectedChecks.push(`${scenario}/${language}/${width}`);
      for (const scenario of ["rename-cancel-apply-identity-values-presentation-siblings", "removal-collision-cancel-apply-identity-values-siblings"]) expectedChecks.push(`${scenario}/${language}`);
    }
    assert.deepEqual(options.checks.map(check => [check.scenario, check.language, check.width].filter(value => value !== undefined).join("/")).sort(), expectedChecks.sort());
    options.checks.forEach(check => passed(check.passed));
    assert.equal(options.shutdowns.length, 2);
    options.shutdowns.forEach(shutdown => { passed(shutdown.normalQuit); passed(shutdown.backendExited); });
    cleanup(options.cleanup);
  }
  for (const [route, stories] of [["creation", 36], ["category-move", 50]]) {
    const layout = json(`ci-${route}-layouts/ladle-observations.json`);
    passed(layout.featurePassed); passed(layout.shutdownPassed); assert.equal(layout.completedStories, stories);
  }
  for (const name of files.filter(name => name.endsWith(".png"))) {
    checkAcceptanceScreenshot(read(root, name), Number(name.match(/-(1024|1440)-/)[1]));
  }
}

export function validateAcceptance(root, expected) {
  const manifest = JSON.parse(read(root, "manifest.json"));
  assert.equal(manifest.formatVersion, 1); assert.equal(manifest.status, "passed");
  for (const key of Object.keys(expected)) assert.equal(manifest[key], expected[key], `Acceptance ${key} mismatch`);
  assert.deepEqual(manifest.files.map(file => file.path).sort(), [...files].sort());
  for (const file of manifest.files) assert.equal(digest(read(root, file.path)), file.sha256, `Corrupt acceptance file: ${file.path}`);
  checkReports(root, expected);
  return manifest;
}
export function collectAcceptance(input, output, expected) {
  assert.ok(!existsSync(output), "Acceptance output must be new");
  mkdirSync(output, { recursive: true });
  const manifest = { formatVersion: 1, ...expected, status: "failed", files: [] };
  // Even failed/incomplete runs retain available reports for diagnosis. They
  // cannot pass validation or replace the complete original evidence artifact.
  try {
    for (const name of files) {
      if (!existsSync(resolve(input, name))) continue;
      const bytes = read(input, name), target = resolve(output, name);
      mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, bytes);
      manifest.files.push({ path: name, sha256: digest(bytes) });
    }
    checkReports(output, expected);
    manifest.status = "passed";
  } finally { writeFileSync(resolve(output, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n"); }
  return manifest;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [command, ...args] = process.argv.slice(2);
    assert.ok(["collect", "validate"].includes(command), "Expected collect or validate");
    assert.equal(args.length, command === "collect" ? 6 : 5, "Invalid acceptance arguments");
    const offset = command === "collect" ? 2 : 1;
    const expected = identity(...args.slice(offset));
    const result = command === "collect" ? collectAcceptance(args[0], args[1], expected) : validateAcceptance(args[0], expected);
    console.info(`Acceptance passed: ${result.platform}, ${result.sha}, run ${result.runId}/${result.attempt}, ${result.files.length} files`);
  } catch (error) { console.error(`Acceptance failed: ${error.message}`); process.exitCode = 1; }
}
