import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {instrumentNativeCreation} from '../scripts/profile-native-creation.mjs';

test('native creation profiling changes only pinned generated read boundaries and fails closed on drift',async()=>{
 const names=['windows-binding.ps1','windows-view.ps1','windows-project-reveal.ps1'];
 const sources=Object.fromEntries(await Promise.all(names.map(async name=>[name,await readFile(new URL(`../src/desktop/native/${name}`,import.meta.url),'utf8')])));
 const result=instrumentNativeCreation(sources);
 assert.match(result['windows-binding.ps1'],/Get-WorkspaceProfileProcessName \$owner/);
 assert.match(result['windows-view.ps1'],/Invoke-WorkspaceNativeReadProfile 'root'/);
 assert.match(result['windows-view.ps1'],/Invoke-WorkspaceNativeReadProfile 'assemblies'/);
 assert.match(result['windows-project-reveal.ps1'],/Invoke-WorkspaceNativeReadProfile 'assemblies'/);
 assert.match(result['windows-binding.ps1'],/workspaceNativeProfileCount -lt 64/);
 for(const name of names)assert.notEqual(result[name],sources[name]);
 for(const name of names)assert.throws(()=>instrumentNativeCreation({...sources,[name]:''}),/marker/);
 for(const text of Object.values(result))assert.doesNotMatch(text,/10000\s*\+|12000\s*\+|Start-Sleep -Milliseconds [1-9][0-9]{3}/);
 assert.ok(result['windows-project-reveal.ps1'].includes("[void]$anchor.document.SelectItem($anchor.item, 5)"));
});
