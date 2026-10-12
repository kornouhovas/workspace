import { withDeadline } from './runtime-lifecycle.mjs';

// Main-only finite lifecycle evidence. An uncertain child must never authorize
// fixture/window cleanup, even if it closes later or native command output passed.
export function nativeBridgeCleanupEvidence(value) {
  const count = (value) => Number.isInteger(value) && value >= 0 && value <= 1 ? value : null;
  const started = count(value?.started), stopped = count(value?.stopped), active = count(value?.active);
  const unknown = value?.unknown !== false;
  const verified = started === 1 && stopped === 1 && active === 0 && !unknown;
  return { status: verified ? 'passed' : 'unverified', started, stopped, active, unknown };
}
// Read-only fixture polling. Exhaustion preserves the last observed selection,
// including select without done; it never retries the product intent.
export async function pollNativeInvocation({ read, target, attempts, timeoutMs = 10000,
  pause = () => new Promise((done) => setTimeout(done, 100)) }) {
  let stopped = false;
  let result = { completion: 'unavailable', attempts: 0, readStatus: 'unavailable',
    navigationCount: null, selectionCount: null, returnedCount: null,
    exactTarget: null, exactNavigationTarget: null, response: 'unavailable',
    bridgeCleanup: nativeBridgeCleanupEvidence(null) };
  try {
    return await withDeadline((async () => {
      for (let attempt = 0; attempt < attempts; attempt++) {
        const value = await read();
        if (stopped) return result;
        if (!Array.isArray(value?.calls) || !Array.isArray(value?.opens) ||
          value.calls.length > 1000 || value.opens.length > 1000 ||
          value.calls.some((call) => typeof call?.path !== 'string' || typeof call.returned !== 'boolean') ||
          value.opens.some((path) => typeof path !== 'string')) {
          return { ...result, completion: 'unavailable', readStatus: 'unavailable', response: 'unavailable' };
        }
        const returnedCount = value.calls.filter((call) => call.returned).length;
        result = { completion: 'exhausted', attempts: attempt + 1, readStatus: 'available',
          navigationCount: value.opens.length, selectionCount: value.calls.length, returnedCount,
          exactTarget: value.calls.length === 1 && value.calls[0].path === target,
          exactNavigationTarget: value.opens.length === 1 && value.opens[0] === target,
          response: value.calls.length > 1 ? 'duplicate' : returnedCount === 1 ? 'completed' : value.calls.length ? 'incomplete' : 'absent',
          bridgeCleanup: nativeBridgeCleanupEvidence(value.bridge) };
        if (returnedCount || value.calls.length > 1) return { ...result, completion: 'observed' };
        await pause();
        if (stopped) return result;
      }
      return result;
    })(), timeoutMs, 'Real native invocation');
  } catch (error) {
    return { ...result, completion: error?.message === `Real native invocation timed out after ${timeoutMs}ms` ? 'deadline' : 'unavailable',
      readStatus: 'unavailable', response: 'unavailable' };
  } finally { stopped = true; }
}

// Runs in the renderer and emits only finite UI state, never status text.
export function nativeInvocationRendererState({ label, dispatched }) {
  const button = Array.from(globalThis.document.querySelectorAll('.project-reveal button'))
    .find((node) => node.getAttribute('aria-label') === label);
  if (!button) return 'absent';
  if (button.disabled) return 'pending';
  const status = button.parentElement.querySelector('.bb-status');
  if (!status) return 'idle';
  if (status.classList.contains('bb-status--error')) return 'error';
  return status.textContent === dispatched ? 'acknowledged' : 'unknown';
}

// Reconstruct the terminal document when publishing strict product snapshots.
// Unknown fields, raw paths, errors and UI text never cross this boundary.
export function nativeInvocationOutcomeSnapshot(value) {
  if (!value) return null;
  const allowed = (input, values, fallback) => values.includes(input) ? input : fallback;
  const count = (input, max = 1000) => Number.isInteger(input) && input >= 0 && input <= max ? input : null;
  const flag = (input) => typeof input === 'boolean' ? input : null;
  return {
    completion: allowed(value.completion, ['observed', 'exhausted', 'deadline', 'unavailable'], 'unavailable'),
    attempts: count(value.attempts, 150),
    readStatus: allowed(value.readStatus, ['available', 'unavailable'], 'unavailable'),
    navigationCount: count(value.navigationCount), selectionCount: count(value.selectionCount), returnedCount: count(value.returnedCount),
    exactTarget: flag(value.exactTarget), exactNavigationTarget: flag(value.exactNavigationTarget),
    response: allowed(value.response, ['absent', 'incomplete', 'completed', 'duplicate', 'unavailable'], 'unavailable'),
    renderer: allowed(value.renderer, ['absent', 'pending', 'idle', 'error', 'acknowledged', 'unknown', 'unavailable'], 'unavailable'),
    bridgeCleanup: nativeBridgeCleanupEvidence(value.bridgeCleanup),
  };
}
