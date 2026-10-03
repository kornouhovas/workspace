import test from 'node:test';
import assert from 'node:assert/strict';
import { projectDirectoryHelperPath, validProjectDirectoryName } from '../src/workspaceProjectCreate.js';

test('helper lookup uses native Windows executable suffix in local and packaged runtime', () => {
 assert.match(projectDirectoryHelperPath({platform:'win32',arch:'x64'}).replaceAll('\\','/'), /sidecar\/local\/workspace-sidecar\.exe$/);
 assert.equal(projectDirectoryHelperPath({resourcesPath:'C:/app/resources',packaged:true,platform:'win32',arch:'x64'}),'C:/app/resources/sidecar/win32-x64/workspace-sidecar.exe');
 assert.match(projectDirectoryHelperPath({platform:'linux',arch:'x64'}).replaceAll('\\','/'), /sidecar\/local\/workspace-sidecar$/);
});

test('Windows rejects reserved names, ADS, wildcards and normalized trailing dots before helper spawn', () => {
 for(const name of ['CON','CON .txt','con.txt','NUL','PRN','AUX','COM1','LPT9.txt','COM¹','LPT².log','CONIN$','CONOUT$','a:b','a?b','a*b','a<b','a>b','a"b','a|b','trailing.']) assert.equal(validProjectDirectoryName(name,'win32'),false,name);
 for(const name of ['Normal Ж','CONSOLE','COM0','COM10','Alpha.txt'])assert.equal(validProjectDirectoryName(name,'win32'),true,name);
 assert.equal(validProjectDirectoryName('CON','darwin'),true);
 for(const name of ['a\\b','a/b','\u0085bad','.hidden','../outside'])assert.equal(validProjectDirectoryName(name,'darwin'),false,name);
});
