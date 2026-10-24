import {rootOwnershipConflict} from '../src/service/source-identity.ts';
import fs from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, realpathSync, symlinkSync } from 'node:fs';
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
