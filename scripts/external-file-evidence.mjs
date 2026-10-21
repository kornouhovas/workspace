import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile);

// Observe/close only the exact disposable document opened by this fixture.
export async function observeExternalFile(target) {
  if(process.platform==='darwin') {
    const {stdout}=await run('osascript',['-e',`on run argv
      tell application "TextEdit"
        repeat with candidate in documents
          if path of candidate is (item 1 of argv) then return "observed"
        end repeat
      end tell
      return "missing"
    end run`,target],{timeout:5000});
    return {status:stdout.trim()==='observed'?'passed':'failed',application:'TextEdit',exactDocumentObserved:stdout.trim()==='observed'};
  }
  if(process.platform==='win32') {
    const {stdout}=await run('powershell.exe',['-NoProfile','-NonInteractive','-Command',String.raw`
      $ErrorActionPreference='Stop'
      $target=$env:WORKSPACE_EXTERNAL_TARGET
      $name=[IO.Path]::GetFileNameWithoutExtension($target)
      $matches=@(Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($target) } | ForEach-Object {
        $process=Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue
        if($process -and $process.MainWindowTitle.Contains($name)){[int]$process.Id}
      })
      [ordered]@{status=$(if($matches.Count -gt 0){'passed'}else{'failed'});exactDocumentObserved=($matches.Count -gt 0);processIds=$matches} | ConvertTo-Json -Compress
    `],{timeout:5000,windowsHide:true,env:{...process.env,WORKSPACE_EXTERNAL_TARGET:target}});
    return JSON.parse(stdout);
  }
  return {status:'failed',reason:'Unsupported OS'};
}
export async function closeExternalFile(target,observation) {
  if(!observation?.exactDocumentObserved)return;
  if(process.platform==='darwin')await run('osascript',['-e',`on run argv
    tell application "TextEdit"
      repeat with candidate in documents
        if path of candidate is (item 1 of argv) then close candidate saving no
      end repeat
    end tell
  end run`,target],{timeout:5000});
  if(process.platform==='win32')await run('powershell.exe',['-NoProfile','-NonInteractive','-Command',String.raw`
    $target=$env:WORKSPACE_EXTERNAL_TARGET
    $name=[IO.Path]::GetFileNameWithoutExtension($target)
    Get-CimInstance Win32_Process | Where-Object {$_.CommandLine -and $_.CommandLine.Contains($target)} | ForEach-Object {
      $process=Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue
      if($process -and $process.MainWindowTitle.Contains($name)){[void]$process.CloseMainWindow()}
    }
  `],{timeout:5000,windowsHide:true,env:{...process.env,WORKSPACE_EXTERNAL_TARGET:target}});
}
