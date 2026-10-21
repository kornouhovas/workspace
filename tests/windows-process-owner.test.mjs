import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import test from 'node:test';

test('Windows process identity reads current owned process and rejects unavailable PIDs without cmdlet loading', {skip:process.platform!=='win32'},async()=>{
 const script=String.raw`
$ErrorActionPreference = 'Stop'
. ./src/desktop/native/windows-view.ps1
# Any accidental return to the expensive cmdlet fails this control.
function Get-Process { throw 'process_cmdlet_forbidden' }
$self = [Diagnostics.Process]::GetCurrentProcess()
try {
    $expected = $self.ProcessName
    if ((Get-WorkspaceNativeProcessName $PID) -cne $expected) { throw 'self_identity' }
    if ((Get-WorkspaceNativeProcessName $PID) -cne $expected) { throw 'fresh_identity' }
} finally { $self.Dispose() }
$rejected = 0
foreach ($invalid in @(-1,[int]::MaxValue)) {
    try { $null = Get-WorkspaceNativeProcessName $invalid }
    catch { $rejected++ }
}
if ($rejected -ne 2) { throw 'unavailable_identity' }
[Console]::Out.WriteLine('VERIFIED')
`;
 const {stdout,stderr}=await promisify(execFile)(String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`,['-STA','-NoProfile','-NonInteractive','-Command',script],{timeout:30000,maxBuffer:1024,windowsHide:true});
 assert.equal(stdout.trim(),'VERIFIED');assert.equal(stderr,'');
});
