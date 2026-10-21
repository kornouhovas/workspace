import assert from 'node:assert/strict';
import test from 'node:test';
import {observeExternalFile,ownedExternalProcess} from '../scripts/external-file-evidence.mjs';

test('native window observation requires the unique document in the OS default application process',async()=>{
 const target='/private/owned fixture — Text.txt';let calls=0;
 const runCommand=async(program,args)=>{
  calls++;
  if(program==='/bin/ps')return {stdout:' 200 /System/Applications/TextEdit.app/Contents/MacOS/TextEdit\n 201 /other/Fake.app/Contents/MacOS/TextEdit\n'};
  assert.equal(program,'/usr/bin/osascript');assert.equal(args.at(-1),target);assert.equal(args[3].includes(target),false);
  return {stdout:JSON.stringify({application:'com.apple.TextEdit',bundlePath:'/System/Applications/TextEdit.app',windows:[
   {pid:201,id:1,visible:true,hasName:true,matches:true},
   {pid:200,id:2,visible:true,hasName:true,matches:true},
  ]})};
 };
 const result=await observeExternalFile(target,{platform:'darwin',runCommand});
 assert.equal(result.exactDocumentObserved,true);assert.equal(result.pid,200);assert.equal(result.windowId,2);assert.equal(calls,2);
 assert.equal(ownedExternalProcess(result,{application:'com.apple.TextEdit',processIds:[]}),200);
 assert.equal(ownedExternalProcess(result,{application:'com.apple.TextEdit',processIds:[200]}),null);
 assert.equal(ownedExternalProcess({...result,otherWindows:1},{application:'com.apple.TextEdit',processIds:[]}),null);
});

test('missing/redacted or hidden native document cannot pass or grant cleanup ownership',async()=>{
 for(const window of [{pid:200,id:2,visible:true,hasName:false,matches:false},{pid:200,id:2,visible:false,hasName:true,matches:true}]) {
  const runCommand=async program=>({stdout:program==='/bin/ps'?'200 /System/Applications/TextEdit.app/Contents/MacOS/TextEdit\n':JSON.stringify({application:'com.apple.TextEdit',bundlePath:'/System/Applications/TextEdit.app',windows:[window]})});
  const result=await observeExternalFile('/private/owned.txt',{platform:'darwin',runCommand});
  assert.equal(result.status,'pending');assert.equal(result.exactDocumentObserved,false);assert.equal(ownedExternalProcess(result,{application:'com.apple.TextEdit',processIds:[]}),null);
 }
});
