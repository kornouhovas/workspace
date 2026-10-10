import { independentSelectionResult, windowsObservationResult } from './file-manager-evidence.mjs';

// Opt-in evidence only; the existing product scenario and acceptance stay intact.
export function validateProductDiagnostic({ enabled, platform, mode, selectedMode, selectedCheckpoint, args }) {
  if (!enabled) return;
  if (platform !== 'win32' || mode !== 'dev' || selectedMode !== 'direct' || selectedCheckpoint !== 'after_evidence' ||
    args.some((arg) => !['dev', '--creation', '--discovery-mode=direct', '--checkpoint=after_evidence'].includes(arg))) {
    throw new Error('Windows product diagnostic requires the single direct development scenario');
  }
}

const allowed = (value, values, fallback = 'unknown') => values.includes(value) ? value : fallback;
const count = (value, max = 100000) => Number.isInteger(value) && value >= 0 && value <= max ? value : null;
const duration = (value) => Number.isFinite(value) && value >= 0 && value <= 60000 ? value : null;
const status = (value) => allowed(value?.status, ['passed', 'failed', 'skipped', 'pending', 'unreached'], 'unreached');
const stage = (value) => ({ status: status(value) });
const version = (value) => typeof value === 'string' && /^\d{1,10}(?:\.\d{1,10}){1,3}$/.test(value) ? value : null;
const forcedCleanup = (value) => value ? { ...stage(value), processStopped: value.processStopped === true,
  code: count(value.errorCode, 2147483647) ?? allowed(value.errorCode, ['ENOENT', 'EPERM', 'EACCES', 'ESRCH', 'ETIMEDOUT'], null),
  exitTimedOut: value.exitTimedOut === true } : null;

function observation(value = {}) {
  const d = value.diagnostics;
  const com = d && typeof d.exactParentFound === 'boolean'
    ? windowsObservationResult(JSON.stringify(d))
    : { status: 'pending', unavailable: true, diagnostics: { stage: allowed(d?.stage,
      ['protocol_error', 'command_error', 'timeout', 'output_limit'], 'unreached') } };
  const boundUi = com.diagnostics?.exactParentCount === 1 || value.independentSelection?.windowVerified === false;
  const ui = independentSelectionResult(boundUi ? value.independentSelection : null,
    com.diagnostics?.exactParentFound && com.diagnostics?.targetPresent && com.diagnostics?.errorCount === 0
      ? com.diagnostics.selectedTargetMatch : null);
  return { com: { status: com.status, unavailable: com.unavailable === true, ...com.diagnostics }, ...ui };
}

// Reconstruct finite data rather than serializing runtime assertions/messages,
// paths, environment or UI text. Unknown, negative and unavailable stay distinct.
export function productDiagnosticSnapshot({ metadata, runtime, evidence, invocationCount, targetMatched,
  fileManagerCleanup, fixtureCleanup, failureCleanup, nativeBridgeCleanup, shutdowns = [], failed = false, finished = false }) {
  const native = evidence.direct;
  const outcome = native.fileManagerOutcome;
  const observed = observation(outcome);
  const cleanupFailed = finished && ['failed', 'skipped'].includes(fixtureCleanup?.status);
  return {
    version: 1, kind: 'production-direct-dev-creation-reveal',
    metadata: {
      codeSha: /^[a-f0-9]{40}$/.test(metadata?.codeSha) ? metadata.codeSha : null,
      platform: allowed(metadata?.platform, ['win32', 'darwin', 'linux'], null),
      architecture: allowed(metadata?.architecture, ['x64', 'arm64', 'ia32'], null),
      osRelease: version(metadata?.osRelease), nodeVersion: version(metadata?.nodeVersion),
      electronVersion: version(runtime?.electron), electronNodeVersion: version(runtime?.node),
    },
    scenario: { mode: 'dev', discoveryMode: 'direct', checkpoint: 'after_evidence', observationSource: 'shell_com_and_ui_automation' },
    status: failed || cleanupFailed ? 'failed' : finished && fixtureCleanup?.status === 'passed' ? 'completed' : 'pending',
    errorCode: failed ? 'scenario_failed' : cleanupFailed ? 'fixture_cleanup_failed' : null,
    creation: stage(native.creation), recovery: stage(native.interruptionRecovery),
    invocation: { ...stage(native.nativeInvocation),
      api: allowed(native.nativeInvocation.api, ['Electron shell.showItemInFolder', 'Windows ready FolderView.SelectItem'], 'unknown'),
      navigationCount: count(native.nativeInvocation.navigationCount, 1),
      selectionCount: count(native.nativeInvocation.selectionCount, 1),
      count: count(invocationCount), exactOwnedTarget: typeof targetMatched === 'boolean' ? targetMatched : null },
    nativeBridgeCleanup: {
      status: allowed(nativeBridgeCleanup?.status, ['passed', 'unverified', 'not_required'], 'unverified'),
      started: count(nativeBridgeCleanup?.started, 1), stopped: count(nativeBridgeCleanup?.stopped, 1),
      active: count(nativeBridgeCleanup?.active, 1), unknown: nativeBridgeCleanup?.unknown !== false,
    },
    acknowledgment: stage(native.nativeAcknowledgment),
    observation: { status: status(outcome), exactTargetObserved: outcome.exactTargetObserved === true,
      completion: allowed(outcome.completion, ['exact_target', 'deadline', 'unavailable', 'unsupported'], 'unreached'),
      deadlineMs: 10000, elapsedMs: duration(outcome.elapsedMs), ...observed,
      attempts: (outcome.attempts ?? []).slice(0, 100).map((attempt) => ({
        attempt: count(attempt.attempt, 100), elapsedMs: duration(attempt.elapsedMs),
        timeoutMs: count(attempt.timeoutMs, 5000), ...observation(attempt),
      })) },
    normalShutdown: stage(evidence.normalShutdown), restartPersistence: stage(evidence.restartPersistence),
    shutdowns: shutdowns.slice(0, 2).map((s) => ({ ...stage(s), backendStopped: s.backendStopped === true,
      forcedCleanup: forcedCleanup(s.forcedCleanup) })),
    failureCleanup: { ...stage(failureCleanup), forcedCleanup: forcedCleanup(failureCleanup?.forcedCleanup) },
    windowCleanup: { status: allowed(fileManagerCleanup?.status, ['completed', 'pending', 'skipped'], 'unreached'),
      matched: count(fileManagerCleanup?.matched), closed: count(fileManagerCleanup?.closed),
      errorCount: count(fileManagerCleanup?.errorCount), closure: 'unverified' },
    fixtureCleanup: { ...stage(fixtureCleanup), processesStopped: fixtureCleanup?.processesStopped === true,
      code: allowed(fixtureCleanup?.code, ['EPERM', 'EACCES', 'ENOENT', 'EBUSY', 'ENOTEMPTY', 'EIO'], null) },
  };
}
