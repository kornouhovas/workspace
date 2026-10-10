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
  return { direct: { creation: stage(), interruptionRecovery: stage(), nativeInvocation: stage(), fileManagerOutcome: stage() },
    grouped: { creation: stage(), interruptionRecovery: stage(), nativeInvocation: stage(), fileManagerOutcome: stage() },
    normalShutdown: stage(), restartPersistence: stage() };
}
export function recordCreationEvidence(evidence, mode, stage, result) {
  const target = mode === null ? evidence : evidence[mode];
  if (!target || !(stage in target)) throw new Error(`Unknown creation evidence stage: ${mode}/${stage}`);
  if (!["passed", "failed", "skipped", "pending", "unreached"].includes(result.status)) throw new Error("Invalid evidence status");
  if (result.status === "passed") {
    if (result.asserted !== true) throw new Error("Passed evidence requires a completed assertion");
    if (stage === "fileManagerOutcome" && (target.nativeInvocation.status !== "passed" || result.exactTargetObserved !== true)) {
      throw new Error("Observed opening requires a passed native invocation and exact target observation");
    }
    if (stage === "restartPersistence" && evidence.normalShutdown.status !== "passed") throw new Error("Restart persistence requires normal shutdown");
  }
  target[stage] = { ...result };
}
