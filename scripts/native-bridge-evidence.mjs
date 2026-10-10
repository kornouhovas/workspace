// Main-only finite lifecycle evidence. An uncertain child must never authorize
// fixture/window cleanup, even if it closes later or native command output passed.
export function nativeBridgeCleanupEvidence(value) {
  const count = (value) => Number.isInteger(value) && value >= 0 && value <= 1 ? value : null;
  const started = count(value?.started), stopped = count(value?.stopped), active = count(value?.active);
  const unknown = value?.unknown !== false;
  const verified = started === 1 && stopped === 1 && active === 0 && !unknown;
  return { status: verified ? 'passed' : 'unverified', started, stopped, active, unknown };
}
