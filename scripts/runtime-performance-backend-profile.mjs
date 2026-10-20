import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, rm, access, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { extractAll } from '@electron/asar';

// Serialized only into a disposable diagnostic copy. Preserve synchronous
// service results/errors and flush bounded, payload-free observations on close.
export function observePerformanceService(service, writeBatch, records=[]) {
  const observed=new Set(['workspace.setViewGrouping','workspace.queryView','workspace.getViewGrouping','workspace.getTableLayout',
    'workspace.assignProjectGroup','workspace.setViewFilter','workspace.setTextValue','workspace.refreshSource','workspace.listTextProperties']);
  const invoke=(method,input)=>{
    if(!observed.has(input?.type)) return service[method](input);
    const started=Date.now(),clock=performance.now(),cpu=process.cpuUsage();
    try {return service[method](input);}
    finally {
      records.push({type:input.type,started,finished:Date.now(),durationMs:performance.now()-clock,cpuMicroseconds:process.cpuUsage(cpu)});
      if(records.length>256)records.shift();
    }
  };
  return new Proxy(service,{get(target,key,receiver){
    if(key==='handleCommand'||key==='handleQuery')return input=>invoke(key,input);
    if(key==='close')return ()=>{service.close();writeBatch(records);};
    return Reflect.get(target,key,receiver);
  }});
}

// Fixed internal phase labels only; no arguments, results or errors are recorded.
export function observePerformancePhase(type, operation, records) {
  return function(...args) {
    const started=Date.now(),clock=performance.now(),cpu=process.cpuUsage();
    try{return operation.apply(this,args);}
    finally {
      records.push({type,started,finished:Date.now(),durationMs:performance.now()-clock,cpuMicroseconds:process.cpuUsage(cpu)});
      if(records.length>256)records.shift();
    }
  };
}

export async function instrumentPerformanceBackend(resources, output) {
  const archive=join(resources,'app.asar'),directory=join(resources,'app');
  await assert.rejects(access(directory),{code:'ENOENT'},'A diagnostic extraction cannot overwrite an existing application directory');
  extractAll(archive,directory);
  const backend=join(directory,'dist/service/entry.cjs');
  const source=await readFile(backend,'utf8');
  const marker='if (parentPort) startServiceProcess(parentPort, openSettingsService, (code) => process.exit(code));';
  assert.equal(source.split(marker).length,2,'The pinned backend entry must have exactly one known service factory');
  const phases=['reconcileSource','scanDirectSource','scanGroupedSource','readWorkspaceLoad'];
  for(const name of phases)assert.ok(source.includes(`\nfunction ${name}(`),`The pinned backend must provide ${name}`);
  const wrappers=phases.map(name=>`${name}=(${observePerformancePhase.toString()})('internal.${name}',${name},performanceBackendRecords);`).join('\n');
  const replacement=`const performanceBackendRecords=[];\n${wrappers}\nif (parentPort) startServiceProcess(parentPort, (...args) => (${observePerformanceService.toString()})(openSettingsService(...args), records => require('node:fs').appendFileSync(${JSON.stringify(output)}, JSON.stringify(records) + '\\n'), performanceBackendRecords), (code) => process.exit(code));`;
  const instrumented=source.replace(marker,replacement);
  await writeFile(output,'',{flag:'wx'});
  await writeFile(backend,instrumented);
  await rm(archive);
  return {diagnosticOnly:true,backendSha256:createHash('sha256').update(instrumented).digest('hex'),originalBackendSha256:createHash('sha256').update(source).digest('hex')};
}

export async function inspectPerformanceBackendBatches(output, expectedCount) {
  const batches=(await readFile(output,'utf8')).trim().split('\n').map(line=>JSON.parse(line));
  assert.equal(batches.length,expectedCount,'Every owned diagnostic backend must flush its normal-close batch');
  assert.ok(batches.every(batch=>Array.isArray(batch)&&batch.length<=256));
  return {completedBatches:batches.length,requestCount:batches.reduce((sum,batch)=>sum+batch.length,0)};
}
