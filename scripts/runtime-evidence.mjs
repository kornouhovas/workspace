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
