import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';
import { parseScript } from '../scripts/debug/windows-rename-etw.mjs';
import { resolveWindowsPowerShell } from '../src/desktop/windows-project-reveal.ts';

test('Windows owned ETW filter retires reused identifiers and preserves rename events against postrename floods', {
  skip: process.platform !== 'win32',
}, async () => {
  const fixture = String.raw`C:\Temp\workspace-rename-diagnostic-abc123`;
  const child = fixture + String.raw`\root\Category\Project`;
  const events = [
    { id: 12, delta: -2, FileName: child, FileObject: '0x1', Irp: '0x1', ShareAccess: '7', IssuingThreadId: '71' },
    { id: 24, delta: -2, Irp: '0x1', Status: '0' },
    { id: 22, delta: -1, FileObject: '0x2', Irp: '0x1' },
    { id: 24, delta: -1, Irp: '0x1', Status: '3221225506' },
    { id: 12, delta: -1, FileName: String.raw`C:\unrelated\private`, FileObject: '0x1', Irp: '0x5' },
    { id: 22, delta: -1, FileObject: '0x1', Irp: '0x6' },
    { id: 12, delta: -1, FileName: child, FileObject: '0x0', Irp: '0x0' },
    { id: 22, delta: -1, FileObject: '0x0', Irp: '0x0' },
    { id: 12, delta: 0, FileName: child, FileObject: '0x3', Irp: '0x3' },
    { id: 19, delta: 0, FileObject: '0x3', Irp: '0x4', InfoClass: '10' },
    { id: 24, delta: 1, Irp: '0x4', Status: '3221225506', IssuingThreadId: '72' },
    ...Array.from({ length: 300 }, (_, i) => ({ id: 22, delta: 2, FileObject: '0x3', Irp: String(1000 + i) })),
  ];
  const control = String.raw`
$ErrorActionPreference = 'Stop'
$script:controlled = [Collections.Generic.List[object]]::new()
foreach ($row in ($env:WORKSPACE_ETW_CONTROL_EVENTS | ConvertFrom-Json)) {
  $data = ''
  foreach ($property in $row.PSObject.Properties) {
    if ($property.Name -in @('id','delta')) { continue }
    $data += '<Data Name="' + $property.Name + '">' + [Security.SecurityElement]::Escape([string]$property.Value) + '</Data>'
  }
  $record = [pscustomobject]@{ ProviderName = 'Microsoft-Windows-Kernel-File'; Id = [int]$row.id;
    TimeCreated = [DateTimeOffset]::FromUnixTimeMilliseconds([long]$env:WORKSPACE_ETW_RENAME_START + $row.delta).UtcDateTime;
    Xml = '<Event><System><Execution ProcessID="700" ThreadID="7" /></System><EventData>' + $data + '</EventData></Event>' }
  $record | Add-Member ScriptMethod ToXml { return $this.Xml }
  $script:controlled.Add($record)
}
function Get-WinEvent { return $script:controlled.ToArray() }
`;
  async function run(script) {
    const { stdout, stderr } = await promisify(execFile)(resolveWindowsPowerShell(),
      ['-NoProfile', '-NonInteractive', '-STA', '-Command', control + script], {
        timeout: 10000, maxBuffer: 65536, windowsHide: true,
        env: { ...process.env, WORKSPACE_ETW_FIXTURE: fixture, WORKSPACE_ETW_RENAME_START: '1700000000100',
          WORKSPACE_ETW_RENAME_END: '1700000000101', WORKSPACE_ETW_TRACE: 'controlled-no-file-read',
          WORKSPACE_ETW_CONTROL_EVENTS: JSON.stringify(events) },
      });
    assert.equal(stderr, '');
    return JSON.parse(stdout.trim());
  }
  // Replay the reviewed defect at the same actual interpreter/filter seam;
  // verify each mutation landed rather than trusting a synthetic result.
  let unretired = parseScript;
  for (const line of ["    if ($event.Id -ne 24) { $irps.Remove([string]$irp) }", "    if ($event.Id -eq 24) { $irps.Remove([string]$irp) }"]) {
    assert.ok(unretired.includes(line)); unretired = unretired.replace(line, '');
  }
  const red = await run(unretired);
  assert.equal(red.status, 'observed');
  assert.ok(red.events.some(e => e.Irp === '0x1' && e.Status === '3221225506'), 'Unretired IRP must reproduce false owned attribution');
  const green = await run(parseScript);
  assert.equal(green.status, 'observed'); assert.equal(green.lossVerified, false); assert.equal(green.truncated, true);
  assert.ok(green.events.length <= 256);
  assert.equal(green.events.some(e => e.Irp === '0x1' && e.Status === '3221225506'), false);
  assert.equal(green.events.some(e => e.eventId === 22 && ['0x1','0x2','0x0'].includes(e.FileObject)), false);
  assert.ok(green.events.some(e => e.eventId === 19 && e.Irp === '0x4'));
  assert.ok(green.events.some(e => e.eventId === 24 && e.Irp === '0x4' && e.Status === '3221225506' && e.IssuingThreadId === '72'));
  assert.ok(green.events.some(e => e.ShareAccess === '7' && e.IssuingThreadId === '71'));
  assert.doesNotMatch(JSON.stringify(green), /private|Category|Project|workspace-rename-diagnostic/);
});
