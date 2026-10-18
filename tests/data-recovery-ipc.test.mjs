import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtempSync,mkdirSync,rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { startServiceProcess } from '../dist/service/entry.cjs';

test('real IPC exports/restores settings, rejects malformed requests and rebinds workspace events after restore',()=>{
 const dir=mkdtempSync(join(tmpdir(),'data-ipc-')),parent=new EventEmitter(),port=new EventEmitter(),sent=[];
 parent.postMessage=()=>{};port.postMessage=m=>sent.push(m);port.close=()=>{};
 startServiceProcess(parent);let id=0;
 const send=input=>{const requestId=++id;port.emit('message',{data:{id:requestId,input}});return sent.findLast(m=>m.id===requestId)?.result;};
 try{
  parent.emit('message',{data:{type:'connect',databasePath:join(dir,'app.sqlite')},ports:[port]});
  assert.equal(send({type:'settings.setLanguage',language:'ru'}).ok,true);
  const backup=send({type:'data.backupNow'}).value.backups;
  assert.equal(backup.state,'ready');
  assert.ok(backup.snapshots.length>=2);
  const {content}=send({type:'data.backupExport',backupId:backup.snapshots[0].id}).value;
  send({type:'settings.setLanguage',language:'en'});
  assert.equal(send({type:'data.restore',content}).ok,true);
  assert.equal(send({type:'settings.load'}).value.language,'ru');
  for(const input of [{type:'data.backups',extra:1},{type:'data.backupNow',extra:1},{type:'data.backupExport',backupId:'../app.sqlite'},{type:'data.export',extra:1},{type:'data.restore'},{type:'data.restore',content,extra:1},{type:'data.restore',content:42}])assert.equal(send(input).error.code,'invalid_input');
  const root=join(dir,'root');mkdirSync(root);sent.length=0;
  assert.equal(send({type:'workspace.create',name:'After restore',rootPath:root}).ok,true);
  assert.ok(sent.some(m=>m.type==='workspace.change'&&m.change.type==='workspace.listChanged'));
 }finally{parent.emit('message',{data:{type:'shutdown'},ports:[]});rmSync(dir,{recursive:true,force:true});}
});
