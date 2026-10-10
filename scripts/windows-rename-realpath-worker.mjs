import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setImmediate as yieldTurn, setTimeout as delay } from 'node:timers/promises';
import { ownedRenamePaths, renameStressBounds, renameStressModes } from './windows-rename-node-worker.mjs';

const errorCodes = ['ENOENT', 'EPERM', 'EACCES', 'EBUSY', 'ENOTDIR', 'unknown'];

// A separate, finite worker repeatedly resolves only this owned CHILD. The
// legacy/native comparison changes one API; service observation is closed in
// all three modes. Timing overlap is not evidence of an individual OS handle.
export async function runChildRealpathStress(env = process.env) {
  const mode = Object.hasOwn(renameStressModes, env.WORKSPACE_RENAME_SCENARIO) ? renameStressModes[env.WORKSPACE_RENAME_SCENARIO] : null;
  const result = { version: 1, mode, target: 'child', stage: 'input', iterations: 0, successes: 0,
    errors: Object.fromEntries(errorCodes.map(key => [key, 0])), afterRenameSignalEnoent: 0,
    renameCompletedSignal: false, startedUnixMs: null, readyUnixMs: null, endedUnixMs: null };
  try {
    if (!mode) return result;
    const { child } = ownedRenamePaths(env.WORKSPACE_RENAME_FIXTURE);
    let input = '', invalidInput = false;
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => {
      input += chunk;
      if (input.length > 9 || (input.includes('\n') && input !== 'finished\n')) invalidInput = true;
      if (input === 'finished\n') { result.renameCompletedSignal = true; process.stdin.destroy(); }
    });
    result.startedUnixMs = Date.now();
    result.readyUnixMs = Date.now();
    process.stdout.write('WORKSPACE_REALPATH_READY\n');
    while (Date.now() - result.startedUnixMs < renameStressBounds.stressMs &&
      result.iterations < renameStressBounds.stressIterations && !invalidInput) {
      if (mode === 'idle') await delay(5);
      else {
        for (let index = 0; index < 128 && result.iterations < renameStressBounds.stressIterations &&
          Date.now() - result.startedUnixMs < renameStressBounds.stressMs; index++) {
          result.iterations++;
          try { (mode === 'native' ? realpathSync.native : realpathSync)(child); result.successes++; }
          catch (error) {
            const code = errorCodes.includes(error.code) ? error.code : 'unknown';
            result.errors[code]++;
            if (code === 'ENOENT' && result.renameCompletedSignal) result.afterRenameSignalEnoent++;
          }
        }
        await yieldTurn();
      }
    }
    result.endedUnixMs = Date.now();
    result.stage = invalidInput ? 'input' : 'completed';
  } catch { /* No raw errors or paths leave the worker. */ }
  finally { process.stdin.destroy(); }
  return result;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  if (process.argv.length !== 2) process.exitCode = 1;
  else process.stdout.write(JSON.stringify(await runChildRealpathStress()));
}
