import * as fs from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolveSystemExplorer } from "./windows-explorer-selection.mjs";

const evidenceDirectory = fileURLToPath(new URL("../work/issue-18/windows-resolver-diagnosis/read-only-series/", import.meta.url));
const sampleRecord = (index, status = "unreached", observation = null) => Object.freeze({ version: 1, index, status, observation });

// Dependency seams are for controlled tests only; the CLI accepts no overrides.
export async function runResolverDiagnosisSeries({ platform = process.platform, filesystem = fs,
  evidenceDirectory: directory = evidenceDirectory, runResolver,
  clock = { now: () => performance.now(), setTimeout, clearTimeout },
} = {}) {
  const started = clock.now();
  // Reserve fifteen seconds for bounded artifact persistence. Neither budget
  // changes execFile's ten-second timeout or attempts to terminate its child.
  const executionDeadline = started + 45000, totalDeadline = started + 60000;
  const expired = Symbol("deadline");
  const withinBudget = async (operation, deadline) => {
    const remaining = deadline - clock.now();
    if (!Number.isFinite(remaining) || remaining <= 0) throw expired;
    let timer;
    try {
      const timeout = new Promise((_resolve, reject) => { timer = clock.setTimeout(() => reject(expired), remaining); });
      const value = await Promise.race([Promise.resolve().then(() => {
        if (clock.now() >= deadline) throw expired;
        return operation();
      }), timeout]);
      if (clock.now() >= deadline) throw expired;
      return value;
    } finally { clock.clearTimeout(timer); }
  };
  const result = { version: 1, status: "failed", deadlineMs: 60000, executionDeadlineMs: 45000, elapsedMs: 0,
    failure: null, samples: [1, 2, 3].map((index) => sampleRecord(index)), persistence: "not_attempted" };
  if (platform !== "win32") result.failure = "unsupported_host";
  else {
    for (let index = 0; index < 3; index++) {
      // Never begin a call without its full unchanged per-call budget.
      if (executionDeadline - clock.now() < 10000) { result.failure = "deadline_expired"; break; }
      let observation, resolved = false;
      try {
        const completed = await withinBudget(async () => {
          let snapshot, success = false;
          try { await resolveSystemExplorer(runResolver, (value) => { snapshot = value; }); success = true; }
          catch { /* Each invocation retains its own failure. */ }
          return { observation: snapshot, resolved: success };
        }, executionDeadline);
        ({ observation, resolved } = completed);
      } catch {
        result.samples[index] = sampleRecord(index + 1, "incomplete");
        result.failure = "deadline_expired"; break;
      }
      const passed = resolved && observation?.outcome === "resolved" && observation.termination === "confirmed" &&
        observation.exitCode === 0 && observation.signal === null && observation.errorCode === null &&
        typeof observation.killed === "boolean" && Number.isInteger(observation.elapsedMs) &&
        observation.stdout.expectedShape === true && observation.stdout.overflow === false &&
        observation.stderr.expectedShape === true && observation.stderr.overflow === false;
      result.samples[index] = sampleRecord(index + 1, passed ? "passed" : "failed", observation ?? null);
      if (!passed) result.failure ??= "sample_failed";
      if (!observation || observation.termination === "unknown") { result.failure ??= "termination_unknown"; break; }
    }
  }
  const elapsed = clock.now() - started;
  result.elapsedMs = Number.isFinite(elapsed) && elapsed >= 0 ? Math.min(Math.round(elapsed), 60000) : null;
  if (result.elapsedMs === null) result.failure ??= "clock_unknown";
  result.status = result.failure ? "failed" : "passed";
  try {
    await withinBudget(() => filesystem.mkdir(directory, { recursive: true }), totalDeadline);
    for (const sample of result.samples) await withinBudget(() => filesystem.writeFile(join(directory, `sample-${sample.index}.json`), JSON.stringify(sample, null, 2) + "\n", "utf8"), totalDeadline);
    result.persistence = "completed";
    await withinBudget(() => filesystem.writeFile(join(directory, "result.json"), JSON.stringify(result, null, 2) + "\n", "utf8"), totalDeadline);
  } catch { result.persistence = "failed"; result.failure ??= "persistence_failed"; result.status = "failed"; }
  return result;
}

export async function runResolverDiagnosisCli({ args = process.argv.slice(2), stdout = process.stdout,
  stderr = process.stderr, series = runResolverDiagnosisSeries,
} = {}) {
  if (args.length) { stderr.write("Windows resolver diagnosis failed (arguments).\n"); return 1; }
  try {
    const result = await series();
    if (result.status === "passed") { stdout.write("Windows resolver diagnosis passed.\n"); return 0; }
  } catch { /* Emit only the fixed failure message. */ }
  stderr.write("Windows resolver diagnosis failed.\n"); return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  // A pending child or filesystem operation must not extend this diagnostic
  // CLI beyond its aggregate budget. Its recorded termination stays unknown;
  // this does not assert child/descendant cleanup or change execFile's policy.
  process.exit(await runResolverDiagnosisCli());
}
