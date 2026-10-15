// Throwaway, opt-in Windows handle investigation. Never product acceptance.
// Microsoft provider/collector references:
// https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/logman-create-trace
// https://github.com/microsoft/perfview/blob/main/src/TraceEvent/Parsers/Microsoft-Windows-Kernel-File.cs
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, win32 } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { resolveWindowsPowerShell } from '../../src/desktop/windows-project-reveal.ts';
import { invokeExternalRename, runBoundedProcess, runRenameFixture } from '../windows-rename-diagnostics.mjs';

export const parseScript = String.raw`
$ErrorActionPreference = 'Stop'
$phase = 'input'
try {
  $root = $env:WORKSPACE_ETW_FIXTURE
  $start = [long]$env:WORKSPACE_ETW_RENAME_START
  $end = [long]$env:WORKSPACE_ETW_RENAME_END
  if ([IO.Path]::GetFileName($root) -notmatch '^workspace-rename-diagnostic-[A-Za-z0-9]{6}$' -or $end -lt $start) { throw 'input' }
  # Kernel names may have a device prefix. Match the complete owned fixture
  # suffix, never a common child basename or a host-wide process/path filter.
  $suffix = $root.Substring([IO.Path]::GetPathRoot($root).Length - 1).TrimEnd('\') + '\'
  $objects = @{}; $irps = @{}
  $before = [Collections.Generic.List[object]]::new(); $during = [Collections.Generic.List[object]]::new(); $after = [Collections.Generic.List[object]]::new()
  $inspected = 0; $truncated = $false
  $phase = 'query'
  foreach ($event in (Get-WinEvent -Path $env:WORKSPACE_ETW_TRACE -Oldest -ErrorAction Stop)) {
    if (++$inspected -gt 200000) { $truncated = $true; break }
    if ($event.ProviderName -ne 'Microsoft-Windows-Kernel-File') { continue }
    $phase = 'decode'
    [xml]$xml = $event.ToXml()
    $fields = @{}
    foreach ($item in $xml.Event.EventData.Data) { $fields[[string]$item.Name] = [string]$item.'#text' }
    $phase = 'filter'
    $target = $null
    foreach ($name in @('FileName','OpenPath')) {
      $path = $fields[$name]
      if ($null -ne $path -and $path.IndexOf($suffix, [StringComparison]::OrdinalIgnoreCase) -ge 0) {
        $relative = $path.Substring($path.IndexOf($suffix, [StringComparison]::OrdinalIgnoreCase) + $suffix.Length)
        if ($relative.StartsWith('root\', [StringComparison]::OrdinalIgnoreCase)) {
          $parts = $relative.Split('\')
          $target = $(if ($parts.Count -eq 2) { 'category' } elseif ($parts.Count -eq 3) { 'child' } else { 'fixture_descendant' })
        } else { $target = 'fixture_other' }
      }
    }
    $object = $fields['FileObject']; $irp = $fields['Irp']
    if ($event.Id -ne 24) { $irps.Remove([string]$irp) }
    # Kernel identifiers may be reused. A new unrelated Create cannot inherit
    # an earlier owned-path association at the same numeric address.
    if ($event.Id -eq 12 -and $null -eq $target) { $objects.Remove([string]$object); $irps.Remove([string]$irp) }
    if ($null -ne $target -and $object -match '^(0x[0-9a-fA-F]{1,16}|[0-9]{1,20})$' -and $object -notmatch '^(0x)?0+$') { $objects[$object] = $target }
    if ($null -eq $target -and $objects.ContainsKey([string]$object)) { $target = $objects[[string]$object] }
    if ($null -ne $target -and $irp -match '^(0x[0-9a-fA-F]{1,16}|[0-9]{1,20})$' -and $irp -notmatch '^(0x)?0+$') { $irps[$irp] = $target }
    if ($null -eq $target -and $irps.ContainsKey([string]$irp)) { $target = $irps[[string]$irp] }
    if ($event.Id -eq 24) { $irps.Remove([string]$irp) }
    if ($event.Id -eq 14) { $objects.Remove([string]$object) }
    if ($null -eq $target) { continue }
    $at = ([DateTimeOffset]$event.TimeCreated.ToUniversalTime()).ToUnixTimeMilliseconds()
    if ($at -lt $start - 1000 -or $at -gt $end + 25) { continue }
    $record = [ordered]@{ eventId = [int]$event.Id; pid = [int]$xml.Event.System.Execution.ProcessID;
      threadId = [int]$xml.Event.System.Execution.ThreadID; target = $target; relativeMs = $at - $start }
    foreach ($name in @('FileObject','Irp','FileKey','ThreadId','IssuingThreadId','ShareAccess','CreateOptions','CreateAttributes','InfoClass','Status','NtStatus')) {
      if ($fields[$name] -match '^(0x[0-9a-fA-F]{1,16}|[0-9]{1,20})$') { $record[$name] = $fields[$name] }
    }
    if ($at -lt $start) {
      if ($before.Count -ge 128) { $before.RemoveAt(0); $truncated = $true }
      $before.Add($record)
    } elseif ($at -le $end) {
      if ($during.Count -ge 96) { $truncated = $true } else { $during.Add($record) }
    } else {
      if ($after.Count -ge 32) { $truncated = $true } else { $after.Add($record) }
    }
  }
  $phase = 'serialize'
  [ordered]@{ status = 'observed'; inspected = $inspected; truncated = $truncated;
    lossVerified = $false; events = @($before.ToArray() + $during.ToArray() + $after.ToArray()) } | ConvertTo-Json -Depth 6 -Compress
} catch {
  $kind = $_.Exception.GetType().Name
  if ($kind -notin @('CommandNotFoundException','RuntimeException','EventLogException','EventLogNotFoundException','FileNotFoundException')) { $kind = 'unknown' }
  [ordered]@{ status = 'unavailable'; phase = $phase; kind = $kind; code = [int]$_.Exception.HResult } | ConvertTo-Json -Compress
}
`;

async function runOwnedKernelFileProbe() {
const evidenceDirectory = process.env.WORKSPACE_RENAME_EVIDENCE_DIR;
if (process.platform !== 'win32' || !evidenceDirectory) throw new Error('Windows diagnostic environment required');
const program = resolveWindowsPowerShell();
if (!program) throw new Error('System PowerShell unavailable');
const logman = win32.resolve(win32.dirname(program), '../..', 'logman.exe');
const output = { kind: 'debug-owned-fixture-kernel-file', sha: process.env.GITHUB_SHA ?? null,
  limits: { operations: 4, circularMegabytes: 16, collectorRunForSeconds: 15, collectorCommandMs: 5000, parseMs: 10000, exportedEvents: 256 },
  attribution: 'positive owned-path events only; missing events never prove absence of handles', operations: [] };
fs.mkdirSync(evidenceDirectory, { recursive: true });
for (let index = 0; index < 4; index++) {
  const fixture = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), 'workspace-rename-diagnostic-')));
  const traceDirectory = fs.mkdtempSync(join(tmpdir(), 'workspace-rename-etw-'));
  const tracePath = join(traceDirectory, 'trace.etl');
  const scriptPath = join(traceDirectory, 'filter.ps1');
  fs.writeFileSync(scriptPath, parseScript);
  const session = 'workspace-owned-rename-' + randomUUID();
  const observation = { index: index + 1, collectorId: session, collector: 'not_started', stopped: false, deleted: false, commands: {}, workerPids: [], kernel: null, fixture: null };
  output.operations.push(observation);
  let started = false, attempted = false, created = false;
  async function command(phase, args) {
    const result = await runBoundedProcess(logman, args, { timeoutMs: 5000, maxBytes: 4096 });
    observation.commands[phase] = { status: result.status, termination: result.termination, exitCode: result.exitCode,
      errorHex: result.stdout.match(/\b0x[0-9a-fA-F]{1,8}\b/g)?.at(-1) ?? null };
    return result;
  }
  try {
    observation.fixture = await runRenameFixture(fixture, 'stress_legacy', { rename: async (directory, scenario, options) => {
      attempted = true;
      const create = await command('create', ['create', 'trace', session, '-o', tracePath, '-f', 'bincirc', '-max', '16',
        '-nb', '2', '16', '-bs', '64', '-ct', 'system', '-rf', '00:00:15', '-p', 'Microsoft-Windows-Kernel-File', '0x8f0', '5']);
      created = create.status === 'completed';
      const start = created ? await command('start', ['start', session]) : null;
      started = start?.status === 'completed';
      observation.collector = started ? 'started' : 'unavailable';
      let result;
      try { result = await invokeExternalRename(directory, scenario, { ...options, runProcess: (workerProgram, args, settings) =>
        runBoundedProcess(workerProgram, args, { ...settings, spawnProcess: (...spawnArgs) => {
          const child = spawn(...spawnArgs);
          if (Number.isInteger(child.pid)) observation.workerPids.push({ pid: child.pid,
            role: args.at(-1).endsWith('realpath-worker.mjs') ? 'resolver' : 'rename' });
          return child;
        } }) }); }
      finally {
        if (attempted) {
          const stop = await command('stop', ['stop', session]);
          observation.stopped = stop.status === 'completed';
          if (observation.stopped || !started) {
            const deleted = await command('delete', ['delete', session]);
            observation.deleted = deleted.status === 'completed';
          }
        }
      }
      if (observation.stopped && result.response?.startedUnixMs != null) {
        try {
        const traces = fs.readdirSync(traceDirectory, { recursive: true }).filter(name => /\.etl$/i.test(name));
        const actualTrace = traces.length === 1 ? join(traceDirectory, traces[0]) : tracePath;
        const parsed = await runBoundedProcess(program, ['-NoProfile', '-NonInteractive', '-STA', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
          { timeoutMs: 10000, maxBytes: 65536, env: { ...process.env, WORKSPACE_ETW_FIXTURE: directory,
            WORKSPACE_ETW_TRACE: actualTrace, WORKSPACE_ETW_RENAME_START: String(result.response.startedUnixMs),
            WORKSPACE_ETW_RENAME_END: String(result.response.endedUnixMs) } });
        try { observation.kernel = parsed.status === 'completed' ? JSON.parse(parsed.stdout) : { status: 'unavailable' }; }
        catch { observation.kernel = { status: 'protocol_error' }; }
        } catch { observation.kernel = { status: 'unavailable', phase: 'trace_discovery' }; }
      }
      return result;
    } });
  } finally {
    // Never publish ETL, exception text or unrelated host paths. A failed stop
    // leaves the trace-local directory on the disposable runner for investigation.
    const commandsTerminated = Object.values(observation.commands).every(value => value.termination === 'confirmed');
    observation.traceCleanup = 'unverified';
    if (!attempted || (commandsTerminated && observation.stopped && observation.deleted)) {
      try { fs.rmSync(traceDirectory, { recursive: true, force: true }); observation.traceCleanup = 'completed'; }
      catch { observation.traceCleanup = 'failed'; process.exitCode = 1; }
    }
    const terminated = observation.fixture?.rename?.process?.termination === 'confirmed' &&
      observation.fixture?.rename?.stress?.process?.termination === 'confirmed';
    observation.fixtureCleanup = 'unverified';
    if (terminated) {
      try { fs.rmSync(fixture, { recursive: true, force: true }); observation.fixtureCleanup = 'completed'; }
      catch { observation.fixtureCleanup = 'failed'; process.exitCode = 1; }
    }
    fs.writeFileSync(join(evidenceDirectory, 'owned-kernel-file.json'), JSON.stringify(output, null, 2));
  }
  if (attempted && (observation.traceCleanup !== 'completed' || observation.fixtureCleanup !== 'completed' ||
    !observation.stopped || !observation.deleted || observation.kernel?.status !== 'observed' || !observation.kernel.events?.length)) {
    process.exitCode = 1; break;
  }
}
console.info('Owned fixture kernel-file investigation retained; this is not rename acceptance.');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runOwnedKernelFileProbe().catch(() => {
  console.error('Owned kernel-file investigation failed; inspect finite retained evidence.');
  process.exitCode = 1;
});
