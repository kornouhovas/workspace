// Stage flags describe completed assertions; false also covers unreached stages.
export function createRuntimeStages() {
  return { modeChangeCancel: false, modeChangeApply: false, modeChangeRecovery: false, modeChangeFeatures: false, modeChangeRestart: false, modeChangeSourceReuse: false,
    nativeReconciliation: false, explicitRefresh: false, shutdownMissed: false, recoveryFeatures: false,
    preQuitFeatures: false, firstShutdown: false, restartPersistence: false, retainedSourceReuse: false, startupFailure: false };
}

export function completeRuntimeStage(stages, stage) {
  const prerequisites = {
    modeChangeRestart: ["modeChangeFeatures", "firstShutdown", "restartPersistence"],
    modeChangeSourceReuse: ["modeChangeRestart", "retainedSourceReuse"],
  };
  if (!(stage in stages)) throw new Error(`Unknown runtime stage: ${stage}`);
  for (const prerequisite of prerequisites[stage] ?? []) {
    if (!stages[prerequisite]) throw new Error(`${stage} requires ${prerequisite}`);
  }
  stages[stage] = true;
}

// Issue 17 evidence is separate from the earlier milestones. A written harness,
// API acknowledgment or failure cleanup cannot establish an observed OS outcome.
export function createCreationEvidence() {
  const stage = () => ({ status: "unreached" });
  return { direct: { creation: stage(), interruptionRecovery: stage(), nativeInvocation: stage(), nativeAcknowledgment: stage(), fileManagerOutcome: stage() },
    grouped: { creation: stage(), interruptionRecovery: stage(), nativeInvocation: stage(), nativeAcknowledgment: stage(), fileManagerOutcome: stage() },
    normalShutdown: stage(), restartPersistence: stage() };
}
export function recordCreationEvidence(evidence, mode, stage, result) {
  const target = mode === null ? evidence : evidence[mode];
  if (!target || !(stage in target)) throw new Error(`Unknown creation evidence stage: ${mode}/${stage}`);
  if (!["passed", "failed", "skipped", "pending", "unreached"].includes(result.status)) throw new Error("Invalid evidence status");
  if (result.status === "passed") {
    if (result.asserted !== true) throw new Error("Passed evidence requires a completed assertion");
    if (stage === "nativeAcknowledgment" && target.nativeInvocation.status !== "passed") throw new Error("Dispatch acknowledgment requires a passed native invocation");
    if (stage === "fileManagerOutcome" && (target.nativeInvocation.status !== "passed" || result.exactTargetObserved !== true)) {
      throw new Error("Observed opening requires a passed native invocation and exact target observation");
    }
    if (stage === "restartPersistence" && evidence.normalShutdown.status !== "passed") throw new Error("Restart persistence requires normal shutdown");
  }
  target[stage] = { ...result };
}

// Every rename assertion starts unreached. A later cleanup or retry cannot
// promote a failed/skipped assertion into acceptance for this invocation.
export function createRenameEvidence() {
  const stages = names => Object.fromEntries(names.map(name => [name, { status: "unreached" }]));
  const mode = () => ({ ...stages(["submission", "rejections", "caseOnly", "sibling", "revealInvocation", "revealAcknowledgment", "fileManagerOutcome", "fileManagerCleanup", "restartPersistence"]),
    recovery: Object.fromEntries(["intent", "keep_original", "first_effect", "staged_evidence", "final_effect", "destination_evidence", "commit"].map(checkpoint => [checkpoint,
      stages(["seed", "restartNoReplay", "resolution", "preservation", "restartPersistence"])])) });
  return { direct: mode(), grouped: mode(), ...stages(["isolation", "normalShutdown", "fixtureCleanup"]) };
}
export function recordRenameEvidence(target, stage, result) {
  if (!target || !Object.hasOwn(target, stage) || !Object.hasOwn(target[stage], "status")) throw new Error(`Unknown rename evidence stage: ${stage}`);
  if (!["passed", "failed", "skipped", "pending", "unreached"].includes(result.status)) throw new Error("Invalid rename evidence status");
  if (["failed", "skipped"].includes(target[stage].status) && result.status !== target[stage].status) throw new Error(`Cannot promote ${target[stage].status} rename evidence`);
  if (result.status === "passed") {
    if (result.asserted !== true) throw new Error("Passed rename evidence requires a completed assertion");
    if (["failed", "skipped"].includes(target[stage].status)) throw new Error(`Cannot promote ${target[stage].status} rename evidence`);
    if (stage === "fileManagerOutcome" && (target.revealInvocation.status !== "passed" || result.exactTargetObserved !== true)) throw new Error("Rename file-manager evidence requires an exact observed target after invocation");
    if (stage === "revealAcknowledgment" && target.revealInvocation.status !== "passed") throw new Error("Rename acknowledgment requires native invocation");
  }
  target[stage] = { ...result };
}
export function assertRenameAcceptance(evidence) {
  const inspect = (target, expected, path) => {
    if (!target || typeof target !== "object" || Object.keys(target).sort().join() !== Object.keys(expected).sort().join()) throw new Error(`Rename acceptance missing assertion or invalid shape: ${path}`);
    for (const [name, value] of Object.entries(target)) {
      const current = `${path}/${name}`;
      if (Object.hasOwn(expected[name], "status")) {
        if (!value || value.status !== "passed" || value.asserted !== true) throw new Error(`Rename acceptance ${current}: ${value?.status ?? "missing"}`);
      } else inspect(value, expected[name], current);
    }
  };
  inspect(evidence, createRenameEvidence(), "rename");
}

// This first graphical slice covers grouped moves/rejections only. Recovery is
// a separate required contract in the next bounded task, never implied here.
export function createCategoryMoveEvidence(inputs) {
  const stages = names => Object.fromEntries(names.map(name => [name, { status: "unreached" }]));
  const scenario = () => stages(["seed", "readOnlyReopen", "submission", "currentCategory", "occupied", "unavailable", "sibling", "preservation", "restartPersistence", "layout"]);
  return { inputs: structuredClone(inputs), en: scenario(), ru: scenario(), ...stages(["isolation", "normalShutdown", "fixtureCleanup"]) };
}
export function recordCategoryMoveEvidence(target, stage, result) {
  if (!target || !Object.hasOwn(target, stage) || !target[stage] || !Object.hasOwn(target[stage], "status")) throw new Error(`Unknown category move evidence stage: ${stage}`);
  if (!["passed", "failed", "skipped", "pending", "unreached"].includes(result.status)) throw new Error("Invalid category move evidence status");
  if (["failed", "skipped"].includes(target[stage].status) && result.status !== target[stage].status) throw new Error("Cannot promote failed or skipped category move evidence");
  if (result.status === "passed" && result.asserted !== true) throw new Error("Passed category move evidence requires a completed assertion");
  target[stage] = { ...result };
}
export function assertCategoryMoveAcceptance(evidence, expectedInputs) {
  const keys = ["sourceRevision", "inputDigest", "mode", "platform", "arch", "node"].sort();
  for (const inputs of [evidence?.inputs, expectedInputs]) {
    if (!inputs || Object.keys(inputs).sort().join() !== keys.join() || !/^[a-f0-9]{40}$/.test(inputs.sourceRevision) ||
      !/^[a-f0-9]{64}$/.test(inputs.inputDigest) || !["dev", "release"].includes(inputs.mode) ||
      !["darwin", "win32", "linux"].includes(inputs.platform) || !["arm64", "x64"].includes(inputs.arch) || !/^v\d+\.\d+\.\d+$/.test(inputs.node)) throw new Error("Invalid category move input identity");
  }
  if (keys.some(key => evidence.inputs[key] !== expectedInputs[key])) throw new Error("Category move input identity mismatch");
  const inspect = (actual, expected, path) => {
    if (!actual || Object.keys(actual).sort().join() !== Object.keys(expected).sort().join()) throw new Error(`Category move acceptance missing assertion or invalid shape: ${path}`);
    for (const [name, template] of Object.entries(expected)) {
      if (name === "inputs") continue;
      const value = actual[name];
      if (Object.hasOwn(template, "status")) {
        if (!value || value.status !== "passed" || value.asserted !== true) throw new Error(`Category move acceptance ${path}/${name}: ${value?.status ?? "missing"}`);
      } else inspect(value, template, `${path}/${name}`);
    }
  };
  inspect(evidence, createCategoryMoveEvidence(expectedInputs), "categoryMove");
  if (evidence.normalShutdown.normalQuit !== true || evidence.normalShutdown.backendExit !== true || evidence.normalShutdown.forcedCleanup !== false ||
    !Number.isSafeInteger(evidence.normalShutdown.invocations) || evidence.normalShutdown.invocations < 4) throw new Error("Category move requires normal shutdown and backend exit");
  if (evidence.fixtureCleanup.processesStopped !== true || evidence.fixtureCleanup.removed !== true) throw new Error("Category move requires independently confirmed owned cleanup");
}
