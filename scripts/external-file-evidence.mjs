import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {setTimeout as delay} from 'node:timers/promises';
const run=promisify(execFile);

// WindowServer metadata is readonly and does not request control of TextEdit.
// The caller authors a unique filename for each disposable native fixture.
const macSnapshot = `ObjC.import("AppKit"); ObjC.import("CoreGraphics");
function run(argv) {
 var target=argv[0], file=$.NSString.stringWithString(target).lastPathComponent.js;
 var applicationURL=$.NSWorkspace.sharedWorkspace.URLForApplicationToOpenURL($.NSURL.fileURLWithPath(target));
 var application=$.NSBundle.bundleWithURL(applicationURL), info=ObjC.deepUnwrap(application.infoDictionary);
 var ownerName=info.CFBundleDisplayName||info.CFBundleName;
 var windows=ObjC.deepUnwrap(ObjC.castRefToObject($.CGWindowListCopyWindowInfo(16,0)));
 var shortName=file.replace(/\\.[^.]+$/, "");
 var owned=windows.filter(function(window){return window.kCGWindowOwnerName===ownerName && window.kCGWindowLayer===0;});
 return JSON.stringify({application:application.bundleIdentifier.js,bundlePath:applicationURL.path.js,
  windows:owned.map(function(window){return {pid:window.kCGWindowOwnerPID,id:window.kCGWindowNumber,visible:!!window.kCGWindowIsOnscreen,
   hasName:!!window.kCGWindowName,matches:window.kCGWindowName===file||window.kCGWindowName===shortName};})});
}`;
export async function observeExternalFile(target, {platform=process.platform,runCommand=run,allowLocalAppleEvents=false}={}) {
  if(platform==='darwin') {
    const {stdout}=await runCommand('/usr/bin/osascript',['-l','JavaScript','-e',macSnapshot,target],{timeout:5000});
    const snapshot=JSON.parse(stdout);
    const processes=await runCommand('/bin/ps',['-axo','pid=,comm='],{timeout:5000});
    const processIds=processes.stdout.split(/\r?\n/).flatMap(line=>{
      const match=/^\s*(\d+)\s+(.+)$/.exec(line);
      return match && match[2].startsWith(`${snapshot.bundlePath}/Contents/MacOS/`) ? [Number(match[1])] : [];
    });
    const windows=snapshot.windows.filter(window=>processIds.includes(window.pid));
    const matches=windows.filter(window=>window.visible && window.matches);
    const match=matches.length===1?matches[0]:null;
    const result={status:match?'passed':'pending',method:'window_server',application:snapshot.application,processIds,
      exactDocumentObserved:!!match,pid:match?.pid??null,windowId:match?.id??null,
      windowNamesAvailable:windows.some(window=>window.hasName),visibleWindowCount:windows.filter(window=>window.visible).length,
      otherWindows:windows.filter(window=>window.hasName && window.id!==match?.id).length};
    if(!match && allowLocalAppleEvents && process.env.GITHUB_ACTIONS!=='true' && snapshot.application==='com.apple.TextEdit') {
      const {stdout}=await runCommand('/usr/bin/osascript',['-e',`on run argv
        tell application "TextEdit"
          repeat with candidate in documents
            if path of candidate is (item 1 of argv) then return "observed"
          end repeat
        end tell
        return "missing"
      end run`,target],{timeout:5000});
      if(stdout.trim()==='observed')return {...result,status:'passed',method:'local_document_apple_events',exactDocumentObserved:true};
    }
    return result;
  }
  if(platform==='win32') {
    const {stdout}=await runCommand('powershell.exe',['-NoProfile','-NonInteractive','-Command',String.raw`
      $ErrorActionPreference='Stop'
      $target=$env:WORKSPACE_EXTERNAL_TARGET
      $name=[IO.Path]::GetFileNameWithoutExtension($target)
      $matches=@(Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($target) } | ForEach-Object {
        $process=Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue
        if($process -and $process.MainWindowTitle.Contains($name)){[int]$process.Id}
      })
      [ordered]@{status=$(if($matches.Count -gt 0){'passed'}else{'pending'});exactDocumentObserved=($matches.Count -gt 0);processIds=$matches} | ConvertTo-Json -Compress
    `],{timeout:5000,windowsHide:true,env:{...process.env,WORKSPACE_EXTERNAL_TARGET:target}});
    return JSON.parse(stdout);
  }
  return {status:'failed',reason:'Unsupported OS'};
}
export function ownedExternalProcess(current, before) {
  return current?.exactDocumentObserved===true && current.method==='window_server' &&
    Number.isSafeInteger(current.pid) && current.pid>1 && Number.isSafeInteger(current.windowId) && current.windowId>0 &&
    current.application===before?.application && Array.isArray(current.processIds) && current.processIds.includes(current.pid) &&
    current.otherWindows===0 && Array.isArray(before?.processIds) && !before.processIds.includes(current.pid) ? current.pid : null;
}
export async function closeExternalFile(target,observation,before) {
  if(!observation?.exactDocumentObserved)return;
  if(process.platform==='darwin' && process.env.GITHUB_ACTIONS==='true') {
    const current=await observeExternalFile(target),pid=ownedExternalProcess(current,before);
    if(pid===null)throw new Error('The disposable external application process is not exclusively owned.');
    // Only a newly launched CI process with this one uniquely named document.
    // Existing applications/documents are never terminated by this fixture.
    process.kill(pid,'SIGTERM');
    const deadline=performance.now()+5000;
    while(performance.now()<deadline) {
      try{process.kill(pid,0);}catch(error){if(error.code==='ESRCH')return;throw error;}
      await delay(50);
    }
    throw new Error('The owned external application did not exit.');
  }
  if(process.platform==='darwin')await run('/usr/bin/osascript',['-e',`on run argv
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
