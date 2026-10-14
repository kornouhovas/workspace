const marker = 'WORKSPACE_QUIT_PHASE ';
const events = new Set(['before-quit', 'will-quit', 'quit']);

// Collect only a finite, fixed-shape phase marker from this owned child's stdout.
// Other output, names, paths, PIDs and arbitrary exception text are never retained.
export function collectQuitEvidence(child) {
  const phases = []; let pending = '', stopped = false;
  const record = { status: 'collecting', phases, parentExited: false, captureTruncated: false };
  const onData = bytes => {
    pending += String(bytes);
    if (pending.length > 8192) { pending = ''; record.captureTruncated = true; return; }
    let end;
    while ((end = pending.indexOf('\n')) !== -1) {
      const line = pending.slice(0, end).replace(/\r$/, ''); pending = pending.slice(end + 1);
      if (!line.startsWith(marker)) continue;
      try {
        const value = JSON.parse(line.slice(marker.length));
        if (!value || Object.keys(value).length !== 2 || !events.has(value.event) || typeof value.prevented !== 'boolean') continue;
        if (phases.length < 16) phases.push({ event: value.event, prevented: value.prevented });
        else record.captureTruncated = true;
      } catch { /* Malformed output is not diagnostic evidence. */ }
    }
  };
  const onExit = () => { record.parentExited = true; };
  child.stdout?.on('data', onData); child.on('exit', onExit);
  return {
    record,
    stop() {
      if (stopped) return record;
      stopped = true; child.stdout?.removeListener('data', onData); child.removeListener('exit', onExit);
      record.parentExited = child.exitCode !== null || child.signalCode !== null;
      record.status = 'retained'; pending = ''; return record;
    },
  };
}

export async function installQuitEvidence(electron) {
  // Synthetic phase instrumentation only; it cannot prevent quit or change policy.
  await electron.evaluate(({ app }) => {
    for (const eventName of ['before-quit', 'will-quit', 'quit']) app.on(eventName, event => {
      process.stdout.write('WORKSPACE_QUIT_PHASE ' + JSON.stringify({ event: eventName, prevented: Boolean(event?.defaultPrevented) }) + '\n');
    });
  });
}
