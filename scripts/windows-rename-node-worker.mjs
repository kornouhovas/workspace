import fs from 'node:fs/promises';
import { lstatSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Same category/project lengths and Unicode prefixes as smoke-runtime.mjs.
export const renameFixtureNames = Object.freeze({
  category: 'Категория-' + 'long-category-'.repeat(14),
  project: '日本語-проект-' + 'long-project-'.repeat(14),
  target: 'Renamed 文-' + 'long-category-'.repeat(14),
});
const allowedCodes = ['EPERM', 'EACCES', 'ENOENT', 'ENOTEMPTY', 'EEXIST', 'EBUSY', 'EINVAL', 'ENAMETOOLONG', 'UNKNOWN'];
export const renameStressModes = Object.freeze({ stress_idle: 'idle', stress_native: 'native', stress_legacy: 'legacy', stress_scan: 'scan' });
export const renameStressBounds = Object.freeze({ stressMs: 1000, stressIterations: 100000, stressOperationsPerScenario: 4 });
const nodeScenarios = ['idle', 'observation', 'concurrent_scan', 'injected_conflict', 'delete_shared_control',
  'child_injected_conflict', 'child_delete_shared_control', 'quiescent_restore', ...Object.keys(renameStressModes)];

// Fixed descendants only; a caller path, alias or reparse component cannot
// authorize either the rename or the child realpath worker.
export function ownedRenamePaths(directory, restore = false) {
  if (!directory || dirname(directory) !== realpathSync.native(tmpdir()) ||
    !/^workspace-rename-diagnostic-[A-Za-z0-9]{6}$/.test(basename(directory)) || realpathSync.native(directory) !== directory) throw new Error('input');
  const root = join(directory, 'root'), source = join(root, restore ? renameFixtureNames.target : renameFixtureNames.category);
  const child = join(source, renameFixtureNames.project), destination = join(root, restore ? renameFixtureNames.category : renameFixtureNames.target);
  for (const path of [directory, root, source, child]) {
    const stat = lstatSync(path);
    // Match the previous external worker: canonicalize its owned fixture root,
    // then lstat fixed descendants. A realpath(source/child) here would add a
    // competing native open while a sharing-control holder is already alive.
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('input');
  }
  return { root, source, child, destination };
}

// One external Node operation; no retries or Win32-code guesses. Only this
// generated disposable fixture's fixed paths can reach fs.promises.rename.
export async function runExternalNodeRename(env = process.env) {
  const result = { version: 1, api: 'node_fs_rename', stage: 'input', invocationCount: 0, renamed: false,
    win32Code: null, nodeCode: null, syscall: null, lockOpened: false, lockReleased: false,
    startedUnixMs: null, endedUnixMs: null };
  try {
    const directory = env.WORKSPACE_RENAME_FIXTURE;
    if (!nodeScenarios.includes(env.WORKSPACE_RENAME_SCENARIO)) return result;
    const { source, destination } = ownedRenamePaths(directory, env.WORKSPACE_RENAME_SCENARIO === 'quiescent_restore');
    try { await fs.lstat(destination); return result; } catch (error) { if (error.code !== 'ENOENT') return result; }
    if (env.WORKSPACE_RENAME_SCENARIO === 'concurrent_scan') {
      process.stdout.write('WORKSPACE_RENAME_READY\n');
      const command = await new Promise(resolveCommand => {
        process.stdin.setEncoding('utf8'); let text = '';
        process.stdin.on('data', chunk => { text += chunk; if (text.length > 16 || text.includes('\n')) resolveCommand(text); });
        process.stdin.once('end', () => resolveCommand(text));
      });
      process.stdin.destroy();
      if (command !== 'rename\n') return result;
    }
    result.stage = 'rename'; result.startedUnixMs = Date.now(); result.invocationCount = 1;
    try { await fs.rename(source, destination); result.renamed = true; }
    catch (error) { result.nodeCode = allowedCodes.includes(error.code) ? error.code : 'unknown'; result.syscall = error.syscall === 'rename' ? 'rename' : null; }
    result.endedUnixMs = Date.now(); result.stage = 'completed';
  } catch { /* Input/setup exceptions never enter the finite native result. */ }
  return result;
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  if (process.argv.length !== 2) process.exitCode = 1;
  else process.stdout.write(JSON.stringify(await runExternalNodeRename()));
}
