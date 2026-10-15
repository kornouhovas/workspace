// Throwaway, opt-in comparison on four disposable Explorer parents. This does
// not replace product acceptance or change the shipped native bridge.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { spawn } from 'node:child_process';
import { runWindowsProjectReveal } from '../../src/desktop/windows-project-reveal.ts';
import { closeDisposableFileManagerTarget, waitForFileManagerTarget } from '../file-manager-evidence.mjs';

const sourceDirectory = fileURLToPath(new URL('../../src/desktop/native/', import.meta.url));
const reflection = String.raw`
function Get-WorkspaceComProperty($value, [string]$name) {
    return ,([System.__ComObject].InvokeMember($name, [Reflection.BindingFlags]::GetProperty, $null, $value, $null))
}
function Invoke-WorkspaceComMethod($value, [string]$name, [object[]]$arguments) {
    return ,([System.__ComObject].InvokeMember($name, [Reflection.BindingFlags]::InvokeMethod, $null, $value, $arguments))
}
`;

export function reflectionPrototype(source) {
  // Replace full expressions first; every guard and the one selection remain.
  const expressions = [
    ['$document.Folder.Self.Path', "(Get-WorkspaceComProperty (Get-WorkspaceComProperty (Get-WorkspaceComProperty $document 'Folder') 'Self') 'Path')"],
    ['$document.Folder.ParseName([IO.Path]::GetFileName($expected))', "(Invoke-WorkspaceComMethod (Get-WorkspaceComProperty $document 'Folder') 'ParseName' @([IO.Path]::GetFileName($expected)))"],
    ['$windows.Item($i)', "(Invoke-WorkspaceComMethod $windows 'Item' @($i))"],
    ['$candidate.Document', "(Get-WorkspaceComProperty $candidate 'Document')"],
    ['$window.Document', "(Get-WorkspaceComProperty $window 'Document')"],
    ['$anchor.item.Path', "(Get-WorkspaceComProperty $anchor.item 'Path')"],
    ...['Count'].map(name => [`$windows.${name}`, `(Get-WorkspaceComProperty $windows '${name}')`]),
    ...['HWND', 'Busy', 'ReadyState'].map(name => [`$window.${name}`, `(Get-WorkspaceComProperty $window '${name}')`]),
    ['$item.Path', "(Get-WorkspaceComProperty $item 'Path')"],
  ];
  for (const [from, to] of expressions) source = source.replaceAll(from, to);
  return reflection + source;
}

export function assertComparisonReachedRead(report) {
  assert.equal(report.opens, 1, 'Comparison must reach navigation exactly once');
  assert.ok(report.trace.some(event => event.phase === 'enumeration'), 'Comparison must reach the actual COM read');
}

async function run() {
  assert.equal(process.platform, 'win32');
  const output = process.env.WORKSPACE_COM_PROFILE_OUTPUT;
  assert.ok(output, 'An explicit evidence destination is required');
  const root = await realpath(await mkdtemp(join(tmpdir(), 'workspace-com-profile-')));
  const prototype = join(root, 'native');
  const evidence = { kind: 'isolated-com-dispatch-comparison', acceptance: false, runs: [] };
  let safeToRemove = true;
  try {
    await mkdir(prototype);
    for (const name of ['windows-project-reveal.ps1', 'windows-binding.ps1', 'windows-view.ps1']) {
      const source = await readFile(join(sourceDirectory, name), 'utf8');
      await writeFile(join(prototype, name), name === 'windows-view.ps1' ? source : reflectionPrototype(source));
    }
    // Reflection must be the first Explorer caller on this fresh diagnostic VM.
    // Later original success is warmed evidence, never cold product acceptance.
    for (const [index, variant] of ['reflection', 'original', 'original', 'reflection'].entries()) {
      const parent = join(root, `case-${index}`);
      await mkdir(join(parent, 'Project 日本語'), { recursive: true });
      const target = await realpath(join(parent, 'Project 日本語'));
      const report = { variant, outcome: 'failed', permits: 0, opens: 0, selections: 0, stopped: 0, unknown: false, trace: [] };
      evidence.runs.push(report);
      const started = performance.now();
      try {
        await runWindowsProjectReveal(target, { isCurrent: () => true, permit: dispatch => { report.permits++; dispatch(); } }, {
          nativeDirectory: variant === 'original' ? sourceDirectory : prototype,
          spawnProcess: (program, args, options) => spawn(program, args, { ...options, env: { ...options.env, WORKSPACE_REVEAL_TRACE: '1' } }),
          onEvent: event => {
            if (event.stage === 'open') report.opens++;
            if (event.stage === 'select') report.selections++;
            if (event.stage === 'stopped') report.stopped++;
            if (event.stage === 'unknown') report.unknown = true;
            if (event.stage === 'trace') report.trace.push({ phase: event.phase, elapsedMs: event.elapsedMs });
            if (event.stage === 'failure') report.failure = { phase: event.phase, reason: event.reason };
          },
        });
        report.outcome = 'dispatched';
      } catch { /* Expected comparison failure; retain finite operands only. */ }
      report.elapsedMs = performance.now() - started;
      if (report.unknown || report.stopped !== 1) { safeToRemove = false; throw new Error('Owned bridge termination unconfirmed'); }
      if (report.outcome === 'dispatched') {
        const observation = await waitForFileManagerTarget(target, 'win32');
        report.exactTargetObserved = observation.status === 'passed' && observation.exactTargetObserved === true;
      }
      const cleanup = await closeDisposableFileManagerTarget(target, 'win32', undefined, { ownedParent: true });
      report.cleanup = { status: cleanup.status, matched: cleanup.matched, closed: cleanup.closed, errorCount: cleanup.errorCount };
      if (cleanup.status !== 'completed') { safeToRemove = false; throw new Error('Owned Explorer cleanup unconfirmed'); }
      assertComparisonReachedRead(report);
    }
  } finally {
    evidence.fixtureRemoval = safeToRemove ? 'completed' : 'preserved';
    if (safeToRemove) {
      try { await rm(root, { recursive: true, force: true }); }
      catch { evidence.fixtureRemoval = 'failed'; }
    }
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, JSON.stringify(evidence, null, 2) + '\n');
    assert.equal(evidence.fixtureRemoval, 'completed');
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await run();
