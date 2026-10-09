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
