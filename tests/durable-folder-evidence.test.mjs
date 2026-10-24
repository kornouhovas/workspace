import {rootOwnershipConflict} from '../src/service/source-identity.ts';
import fs from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, realpathSync, renameSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { observeFolder, sameDurableFolder, validateEvidence } from '../src/service/folder-evidence.ts';

test('native evidence identifies a contained folder independently of device numbers and rejects links', () => {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'workspace-evidence-')));
  try {
    const child = join(root, 'Project'); mkdirSync(child);
    const first = observeFolder(child, 'installation-test');
    assert.equal(first.ok, true, JSON.stringify(first));
    assert.equal(validateEvidence(first.evidence), true);
    assert.equal(sameDurableFolder(first.evidence, {...first.evidence}), true);
    assert.equal(sameDurableFolder(first.evidence, {...first.evidence, volume: 'another-volume'}), false);
    assert.equal(sameDurableFolder(first.evidence, {...first.evidence, scope: 'another-installation'}), false);
    assert.equal(validateEvidence({...first.evidence, version: 2}), false);
    assert.equal(validateEvidence({...first.evidence, fileId: '0'}), false);
    assert.equal(validateEvidence({...first.evidence, unexpected: true}), false);
    symlinkSync(child, join(root, 'Alias'));
    assert.equal(observeFolder(join(root, 'Alias'), 'installation-test').ok, false);
    assert.equal(observeFolder(join(root, 'Missing'), 'installation-test').reason, 'disconnected');
  } finally { rmSync(root, {recursive: true, force: true}); }
});


test('native evidence rejects a partial current-mount observation even when durable attributes are available',()=>{
 const root=realpathSync.native(mkdtempSync(join(tmpdir(),'workspace-partial-mount-'))),original=fs.lstatSync;
 try{
  assert.equal(observeFolder(root,'installation-test').ok,true);
  fs.lstatSync=(path,...args)=>{const stat=original(path,...args);if(path===root)stat.birthtimeNs=0n;return stat;};syncBuiltinESMExports();
  assert.deepEqual(observeFolder(root,'installation-test'),{ok:false,reason:'missing_attributes'});
 }finally{fs.lstatSync=original;syncBuiltinESMExports();rmSync(root,{recursive:true,force:true});}
});


test('NTFS GUID casing cannot conceal duplicate root ownership and different GUID aliases stay distinct',()=>{
 const slash=String.fromCharCode(92),volume=`${slash}${slash}?${slash}Volume{aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee}${slash}`;
 const evidence={version:1,provider:'ntfs',scope:'installation-test',volume,serial:'1',fileId:'1234567890abcdef1234567890abcdef',created:'1'};
 const observed={ok:true,evidence,mount:{dev:'1',ino:'2',birthtimeNs:'3'}};
 const peer={canonicalRoot:'unavailable-peer',durableEvidence:JSON.stringify({...evidence,volume:volume.toUpperCase()}),appliedRootIdentity:null};
 assert.equal(validateEvidence(evidence),true);assert.equal(validateEvidence(JSON.parse(peer.durableEvidence)),true);
 assert.equal(rootOwnershipConflict(observed,[peer],evidence.scope,()=>({ok:false,reason:'disconnected'})),true);
 assert.equal(rootOwnershipConflict(observed,[{...peer,durableEvidence:JSON.stringify({...evidence,volume:volume.replace('aaaaaaaa','ffffffff')})}],evidence.scope,()=>({ok:false,reason:'disconnected'})),false);
});

test('native evidence supports long Unicode category and project descendants on the same volume',()=>{
 const root=realpathSync.native(mkdtempSync(join(tmpdir(),'workspace-long-evidence-')));
 try{
  const category=join(root,'Категория-'+'long-category-'.repeat(14));
  const project=join(category,'日本語-проект-'+'long-project-'.repeat(14));mkdirSync(project,{recursive:true});
  const observed=[root,category,project].map(path=>observeFolder(path,'installation-test'));
  for(const item of observed)assert.equal(item.ok,true,JSON.stringify(item));
  for(const item of observed.slice(1)){assert.equal(item.evidence.volume,observed[0].evidence.volume);assert.equal(item.evidence.serial,observed[0].evidence.serial);}
  const alias=join(category,'Alias');symlinkSync(project,alias,process.platform==='win32'?'junction':'dir');
  assert.equal(observeFolder(alias,'installation-test').ok,false,'Long-path support never authorizes a link');
 }finally{rmSync(root,{recursive:true,force:true});}
});

test('evidence route checks retain Windows non-exclusive realpath policy',()=>{
 const root=realpathSync.native(mkdtempSync(join(tmpdir(),'workspace-evidence-sharing-'))),child=join(root,'Project');mkdirSync(child);
 const original=fs.realpathSync.native;let childNativeCalls=0;
 try{
  fs.realpathSync.native=(path,...args)=>{if(path===child)childNativeCalls++;return original(path,...args);};
  const observed=observeFolder(child,'installation-test');assert.equal(observed.ok,true,JSON.stringify(observed));
  assert.equal(childNativeCalls,process.platform==='win32'?0:2,'Windows evidence must not reopen descendants through native realpath');
 }finally{fs.realpathSync.native=original;rmSync(root,{recursive:true,force:true});}
});

// Model the Windows route policy on every host, while the preceding actual-host
// controls retain sufficient native evidence coverage. A foreign host's adapter
// cannot supply NTFS evidence; that finite failure still must not open the child.
test('Windows evidence avoids native descendant opens even when provider evidence is unavailable',()=>{
 const root=realpathSync.native(mkdtempSync(join(tmpdir(),'workspace-evidence-route-'))),child=join(root,'Project');mkdirSync(child);
 const platform=Object.getOwnPropertyDescriptor(process,'platform'),host=process.platform,original=fs.realpathSync,originalNative=original.native;
 let childNativeCalls=0,legacyCalls=0;
 const replacement=(path,...args)=>{if(path===child)legacyCalls++;return original(path,...args);};
 replacement.native=(path,...args)=>{if(path===child){childNativeCalls++;throw new Error('Native descendant open would contend with external rename');}return originalNative(path,...args);};
 try{
  Object.defineProperty(process,'platform',{value:'win32'});fs.realpathSync=replacement;syncBuiltinESMExports();
  const observed=observeFolder(child,'installation-test');
  assert.equal(childNativeCalls,0,'Windows evidence must not enter the non-DELETE-sharing native realpath API');
  assert.ok(legacyCalls>0);if(host==='win32')assert.equal(observed.ok,true,JSON.stringify(observed));
 }finally{fs.realpathSync=original;syncBuiltinESMExports();Object.defineProperty(process,'platform',platform);rmSync(root,{recursive:true,force:true});}
});

for(const link of [false,true])test(`evidence route resolution rejects an in-flight ${link?'link':'folder identity'} substitution`,()=>{
 const root=realpathSync.native(mkdtempSync(join(tmpdir(),'workspace-evidence-route-swap-'))),child=join(root,'Project'),external=join(root,'External');mkdirSync(child);mkdirSync(external);
 const original=fs.realpathSync,originalNative=original.native;let swapped=false;
 const wrap=resolve=>(path,...args)=>{const resolved=resolve(path,...args);if(path===child&&!swapped){swapped=true;renameSync(child,join(root,'Held'));if(link)symlinkSync(external,child,process.platform==='win32'?'junction':'dir');else mkdirSync(child);}return resolved;};
 const replacement=wrap(original);replacement.native=wrap(originalNative);
 try{
  fs.realpathSync=replacement;syncBuiltinESMExports();const observed=observeFolder(child,'installation-test');
  assert.equal(swapped,true);assert.equal(observed.ok,false,JSON.stringify(observed));if(!link)assert.equal(observed.reason,'changed');
 }finally{fs.realpathSync=original;syncBuiltinESMExports();rmSync(root,{recursive:true,force:true});}
});
