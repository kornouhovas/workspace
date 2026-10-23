import assert from 'node:assert/strict';
import test from 'node:test';
import {observePerformanceService,observePerformancePhase} from '../scripts/runtime-performance-backend-profile.mjs';

test('diagnostic service observation preserves synchronous replies, errors and one invocation without authored data',()=>{
  const failure=new Error('Private failure'),reply={private:'Private value'},calls=[],batches=[];
  const service={get requestCount(){return calls.length;},handleCommand(input){calls.push(input);if(input.fail)throw failure;return reply;},handleQuery(input){calls.push(input);return reply;},close(){calls.push('closed');}};
  const observed=observePerformanceService(service,batch=>batches.push(batch));
  assert.equal(observed.handleCommand({type:'workspace.assignProjectGroup',private:'Private name'}),reply);
  assert.throws(()=>observed.handleCommand({type:'workspace.setViewFilter',fail:true}),error=>error===failure);
  assert.equal(observed.handleQuery({type:'workspace.queryView'}),reply);
  assert.equal(calls.length,3);assert.equal(observed.requestCount,3);
  observed.close();assert.equal(calls.at(-1),'closed');
  assert.deepEqual(batches[0].map(record=>record.type),['workspace.assignProjectGroup','workspace.setViewFilter','workspace.queryView']);
  assert.equal(JSON.stringify(batches).includes('Private'),false);
  for(const record of batches[0])assert.ok(record.durationMs>=0&&record.finished>=record.started&&record.cpuMicroseconds.user>=0&&record.cpuMicroseconds.system>=0);
});

test('diagnostic service history is bounded and a failed close never supplies a completed batch',()=>{
  const batches=[],failure=new Error('close failed');
  const observed=observePerformanceService({handleQuery(){return true;},close(){throw failure;}},batch=>batches.push(batch));
  for(let i=0;i<300;i++)observed.handleQuery({type:'workspace.queryView'});
  assert.throws(()=>observed.close(),error=>error===failure);assert.deepEqual(batches,[]);
  const complete=observePerformanceService({handleQuery(){return true;},close(){}},batch=>batches.push(batch));
  for(let i=0;i<300;i++)complete.handleQuery({type:'workspace.queryView'});
  complete.close();assert.equal(batches[0].length,256);
});

test('backend instrumentation modifies only its copied archive and produces bounded parseable evidence on close',async()=>{
  const {mkdtemp,mkdir,writeFile,copyFile,readFile,rm,access}=await import('node:fs/promises');
  const {tmpdir}=await import('node:os');
  const {join}=await import('node:path');
  const {execFileSync}=await import('node:child_process');
  const {createPackage}=await import('@electron/asar');
  const {instrumentPerformanceBackend,inspectPerformanceBackendBatches}=await import('../scripts/runtime-performance-backend-profile.mjs');
  const directory=await mkdtemp(join(tmpdir(),'backend-probe-'));
  try{
    const source=join(directory,'source'),resources=join(directory,'resources'),original=join(directory,'original.asar'),output=join(directory,'records.jsonl');
    await mkdir(join(source,'dist/service'),{recursive:true});await mkdir(resources);
    const entry=`const parentPort={};
function reconcileSource(){return 3;}
function scanDirectSource(){}
function scanGroupedSource(){}
function nestedScope(){function sourceObservation(){};return sourceObservation;}
function readWorkspaceLoad(){}
const openSettingsService=()=>({handleCommand(input){return input.value;},handleQuery(input){if(reconcileSource()!==3)throw new Error("Phase result changed");return input.value;},close(){}});
function startServiceProcess(port,factory){const service=factory();if(service.handleQuery({type:'workspace.queryView',value:7})!==7)throw new Error('Reply changed');service.close();}
if (parentPort) startServiceProcess(parentPort, openSettingsService, (code) => process.exit(code));`;
    await writeFile(join(source,'dist/service/entry.cjs'),entry);await createPackage(source,original);
    const before=await readFile(original);await copyFile(original,join(resources,'app.asar'));
    const result=await instrumentPerformanceBackend(resources,output);
    assert.equal(result.diagnosticOnly,true);assert.notEqual(result.backendSha256,result.originalBackendSha256);
    assert.deepEqual(await readFile(original),before);await assert.rejects(access(join(resources,'app.asar')),{code:'ENOENT'});
    execFileSync(process.execPath,[join(resources,'app/dist/service/entry.cjs')]);
    const batches=(await readFile(output,'utf8')).trim().split('\n').map(line=>JSON.parse(line));
    assert.equal(batches.length,1);assert.deepEqual(batches[0].map(r=>r.type),['internal.reconcileSource','workspace.queryView']);
    assert.equal(JSON.stringify(batches).includes('value'),false);
    assert.deepEqual(await inspectPerformanceBackendBatches(output,1),{completedBatches:1,requestCount:2});
    await assert.rejects(inspectPerformanceBackendBatches(output,2),/Every owned diagnostic backend/);
  } finally{await rm(directory,{recursive:true,force:true});}
});


test('internal diagnostic phases preserve receiver, result and failure with one bounded payload-free record',()=>{
  const records=[],receiver={value:7},failure=new Error('Private detail');let calls=0;
  const observed=observePerformancePhase('internal.reconcileSource',function(input){calls++;assert.equal(this,receiver);if(input.fail)throw failure;return this.value;},records);
  assert.equal(observed.call(receiver,{private:'Private name'}),7);
  assert.throws(()=>observed.call(receiver,{fail:true}),error=>error===failure);
  assert.equal(calls,2);assert.deepEqual(records.map(r=>r.type),['internal.reconcileSource','internal.reconcileSource']);
  assert.equal(JSON.stringify(records).includes('Private'),false);
  for(let i=0;i<300;i++)observed.call(receiver,{});
  assert.equal(records.length,256);
});


test('phase wrappers execute at module scope in the real bundled backend',async()=>{
  const {mkdtemp,mkdir,copyFile,readFile,rm}=await import('node:fs/promises');
  const {tmpdir}=await import('node:os');const {join,resolve}=await import('node:path');
  const {execFileSync}=await import('node:child_process');const {createPackage}=await import('@electron/asar');
  const {instrumentPerformanceBackend}=await import('../scripts/runtime-performance-backend-profile.mjs');
  const directory=await mkdtemp(join(tmpdir(),'backend-phase-scope-'));
  try{
    const source=join(directory,'source'),resources=join(directory,'resources'),output=join(directory,'records.jsonl');
    await mkdir(join(source,'dist/service'),{recursive:true});await mkdir(resources);
    await copyFile(new URL('../dist/service/entry.cjs',import.meta.url),join(source,'dist/service/entry.cjs'));
    await createPackage(source,join(resources,'app.asar'));
    await instrumentPerformanceBackend(resources,output);
    // Under Node the Electron package has no parentPort; module-level wrappers
    // must still resolve without starting a service or accessing a real database.
    execFileSync(process.execPath,[join(resources,'app/dist/service/entry.cjs')],{env:{...process.env,NODE_PATH:resolve('node_modules')}});
    assert.equal(await readFile(output,'utf8'),'');
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('project preview diagnostics retain only command timing and preserve the public reply',()=>{
  const reply={private:'project names and paths'},records=[];
  const service=observePerformanceService({handleQuery(){return reply;},close(){}},batch=>records.push(...batch));
  assert.equal(service.handleQuery({type:'workspace.listProjectFiles',workspaceId:'private workspace',projectId:'private project',relativePath:'private path'}),reply);
  service.close();
  assert.equal(records.length,1);
  assert.equal(records[0].type,'workspace.listProjectFiles');
  assert.equal(JSON.stringify(records).includes('private'),false);
});
