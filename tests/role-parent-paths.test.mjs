import assert from 'node:assert/strict';
import path from 'node:path';
import {syncBuiltinESMExports} from 'node:module';
import test from 'node:test';
import {verifyCreationParents} from '../src/service/project-filesystem.ts';

// Exercise the shared confinement boundary with each host's actual path rules.
// No filesystem or identity comparison is replaced by a path-only permission.
for(const [platform,implementation,root] of [['win32',path.win32,'C:\\Source'],['darwin',path.posix,'/Source']])test(`${platform}: nested role parents use portable journal paths while containment and identity stay exact`,()=>{
 const names=['join','relative','isAbsolute','sep'],saved=Object.fromEntries(names.map(name=>[name,path[name]])),selected=Object.fromEntries(names.map(name=>[name,implementation[name]]));
 const rootIdentity={dev:'1',ino:'2',birthtimeNs:'3'},parentIdentity={dev:'1',ino:'4',birthtimeNs:'5'};
 const physical=implementation.join(root,'Clients/Team');
 const filesystem={platform,inspect(locator){return {kind:'directory',identity:locator===root?rootIdentity:parentIdentity};},realpath:locator=>locator};
 const binding={canonicalRoot:root,parentRelativePath:'Clients/Team',rootIdentity:JSON.stringify(rootIdentity),parentIdentity:JSON.stringify(parentIdentity)};
 try{
  Object.assign(path,selected);syncBuiltinESMExports();
  assert.equal(verifyCreationParents(filesystem,binding),physical);
  for(const parentRelativePath of ['../Outside','Clients/../Team','Clients//Team','Clients/./Team','/Outside'])assert.throws(()=>verifyCreationParents(filesystem,{...binding,parentRelativePath}),error=>error.problem==='filesystem_changed');
  assert.throws(()=>verifyCreationParents({...filesystem,inspect:locator=>({kind:'link',identity:locator===root?rootIdentity:parentIdentity})},binding));
  assert.throws(()=>verifyCreationParents(filesystem,{...binding,parentIdentity:JSON.stringify({...parentIdentity,ino:'999'})}));
 }finally{Object.assign(path,saved);syncBuiltinESMExports();}
});
