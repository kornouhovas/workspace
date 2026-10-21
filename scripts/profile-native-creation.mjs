// Diagnostic generated-copy instrumentation. Never changes source or accepts a native verdict.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const names=['windows-binding.ps1','windows-view.ps1','windows-project-reveal.ps1'];
const helpers=String.raw`
# Diagnostic copy only: fixed read spans, at most64 scalar records, no target data.
function Invoke-WorkspaceNativeReadProfile($phase, [scriptblock]$read) {
    if ($phase -cnotin @('process','assemblies','root')) { throw 'profile_phase' }
    $watch = [Diagnostics.Stopwatch]::StartNew()
    $self = [Diagnostics.Process]::GetCurrentProcess()
    $cpu = $self.TotalProcessorTime.TotalMilliseconds
    try { return (& $read) }
    finally {
        $wall = $watch.Elapsed.TotalMilliseconds
        $used = $self.TotalProcessorTime.TotalMilliseconds - $cpu
        $self.Dispose()
        if ($script:workspaceNativeProfileCount -lt 64 -and $wall -ge 0 -and $used -ge 0) {
            $script:workspaceNativeProfileCount++
            try {
                $line = [ordered]@{phase=$phase;wallMs=$wall;cpuMs=$used} | ConvertTo-Json -Compress
                [IO.File]::AppendAllText($env:WORKSPACE_NATIVE_PROFILE_FILE,$line+[Environment]::NewLine)
            } catch { }
        }
    }
}
$script:workspaceNativeProfileCount = 0
function Get-WorkspaceProfileProcessName($processId) {
    return (Invoke-WorkspaceNativeReadProfile 'process' { (Get-Process -Id $processId -ErrorAction Stop).ProcessName })
}
`;
function replaceOnce(text,marker,replacement) {
 assert.equal(text.split(marker).length,2,`Pinned native profile marker: ${marker}`);
 return text.replace(marker,replacement);
}
export function instrumentNativeCreation(sources) {
 const result={...sources};
 result['windows-binding.ps1']=helpers+replaceOnce(result['windows-binding.ps1'],'(Get-Process -Id $owner -ErrorAction Stop).ProcessName','(Get-WorkspaceProfileProcessName $owner)');
 result['windows-view.ps1']=replaceOnce(result['windows-view.ps1'],'(Get-Process -Id $root.Current.ProcessId -ErrorAction Stop).ProcessName','(Get-WorkspaceProfileProcessName $root.Current.ProcessId)');
 result['windows-view.ps1']=replaceOnce(result['windows-view.ps1'],'return [System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]$handle)',"return (Invoke-WorkspaceNativeReadProfile 'root' { [System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]$handle) })");
 for(const name of ['windows-view.ps1','windows-project-reveal.ps1']) {
  const marker='Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes'+(name==='windows-project-reveal.ps1'?' -ErrorAction Stop':'');
  result[name]=replaceOnce(result[name],marker,`Invoke-WorkspaceNativeReadProfile 'assemblies' { ${marker} }`);
 }
 return result;
}
async function main() {
 assert.equal(process.platform,'win32','Native owner profile requires Windows');
 assert.equal(process.argv.length,2,'No profile arguments accepted');
 const root=fileURLToPath(new URL('../',import.meta.url));
 const directory=resolve(process.env.WORKSPACE_SMOKE_EVIDENCE_DIR??join(root,'work/ci-native-owner-profile'));
 await mkdir(directory,{recursive:true});
 const sources=Object.fromEntries(await Promise.all(names.map(async name=>[name,await readFile(join(root,'src/desktop/native',name),'utf8')])));
 const copies=instrumentNativeCreation(sources);
 const originals=Object.fromEntries(await Promise.all(names.map(async name=>[name,await readFile(join(root,'dist/desktop/native',name),'utf8')])));
 for(const name of names)assert.equal(originals[name],sources[name],'Generated native input must match source');
 const hash=text=>createHash('sha256').update(text).digest('hex');
 const report={diagnosticOnly:true,sha:process.env.GITHUB_SHA,run:process.env.GITHUB_RUN_ID,attempt:process.env.GITHUB_RUN_ATTEMPT,inputs:Object.fromEntries(names.map(name=>[name,{original:hash(originals[name]),instrumented:hash(copies[name])}])),restored:false,exitCode:null,samples:[]};
 const sampleFile=join(directory,'read-spans.jsonl');
 await writeFile(sampleFile,'');
 try {
  for(const name of names)await writeFile(join(root,'dist/desktop/native',name),copies[name]);
  report.exitCode=await new Promise((done,reject)=>{
   const child=spawn(process.execPath,['scripts/smoke-runtime.mjs','dev','--creation','--discovery-mode=direct','--checkpoint=after_evidence'],{cwd:root,stdio:'inherit',env:{...process.env,WORKSPACE_SMOKE_EVIDENCE_DIR:directory,WORKSPACE_REVEAL_TRACE:'1',WORKSPACE_NATIVE_PROFILE_FILE:sampleFile}});
   child.once('error',reject);child.once('exit',code=>done(code??1));
  });
 } finally {
  for(const name of names)await writeFile(join(root,'dist/desktop/native',name),originals[name]);
  for(const name of names)assert.equal(await readFile(join(root,'dist/desktop/native',name),'utf8'),originals[name]);
  report.restored=true;
  const raw=await readFile(sampleFile,'utf8');
  assert.ok(Buffer.byteLength(raw)<=16384,'Bounded native read span output');
  report.samples=raw.trim().split(/\r?\n/).filter(Boolean).map(line=>{
   const {phase,wallMs,cpuMs}=JSON.parse(line);
   assert.ok(['process','assemblies','root'].includes(phase)&&Number.isFinite(wallMs)&&wallMs>=0&&Number.isFinite(cpuMs)&&cpuMs>=0);
   return {phase,wallMs,cpuMs};
  });
  assert.ok(report.samples.length<=64);
  await writeFile(join(directory,'profile.json'),JSON.stringify(report,null,2)+'\n');
 }
 assert.ok(report.samples.length,'Native read spans must be present');
 process.exitCode=report.exitCode;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
