import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { initialize, readState } from '../scripts/ralphex-run.mjs';
import { mkdtempSync, mkdirSync, openSync, closeSync, ftruncateSync, writeFileSync, readFileSync, rmSync, appendFileSync, renameSync, realpathSync, symlinkSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { observe } from '../scripts/ralphex-observe.mjs';

function fixture(t) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'ralphex-observe-')));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const state = { version: 1, runId: 'fixture-run', executionId: 'fixture-execution', runDirectory: dir, worktree: dir, status: 'running', phase: 'execute', lastExit: null, nextAction: 'Wait' };
  const lock = { pid: process.pid, token: 'fixture-token', runId: state.runId, executionId: state.executionId, runDirectory: dir, worktree: dir };
  writeFileSync(join(dir, 'current.json'), JSON.stringify(state));
  writeFileSync(join(dir, 'executor.lock'), JSON.stringify(lock));
  const log = join(dir, 'full.log'); writeFileSync(log, '');
  const options = { source: { kind: 'runner', dir, log }, cursor: join(dir, 'observer.json'), budgetMs: 90, pollMs: 10 };
  return { dir, state, lock, log, options, save() { const temp = join(dir, 'snapshot.tmp'); writeFileSync(temp, JSON.stringify(state)); renameSync(temp, join(dir, 'current.json')); } };
}

test('unchanged quiet runner is observed until a finite deadline without modifying its files', async t => {
  const f = fixture(t), before = ['current.json','executor.lock','full.log'].map(file => readFileSync(join(f.dir,file)));
  const start = Date.now(), result = await observe(f.options);
  assert.equal(result.reason, 'deadline'); assert.equal(result.status, 'running'); assert.equal(result.activity.kind, 'quiet');
  assert.ok(Date.now()-start >= 70); assert.ok(Date.now()-start < 1000);
  assert.deepEqual(['current.json','executor.lock','full.log'].map(file => readFileSync(join(f.dir,file))), before);
});

test('ordinary noisy bytes coalesce, while a task marker reports progress without forging completion', async t => {
  const f = fixture(t); const timer = setTimeout(() => appendFileSync(f.log, 'noise\n'.repeat(1000) + 'RALPHEX_PROGRESS {"task":"Task 2"}\nRALPHEX_STAGE {"status":"success"}\n'), 20); t.after(() => clearTimeout(timer));
  const result = await observe({ ...f.options, budgetMs: 500 });
  assert.equal(result.reason, 'progress'); assert.equal(result.status, 'running'); assert.equal(result.task, 'Task 2');
  assert.ok(result.log.excerpt.length <= 2048); assert.equal(readFileSync(f.log,'utf8').length, result.log.to);
});

test('terminal source wins over an unavailable log and retains failure exit evidence', async t => {
  const f = fixture(t); f.state.status = 'failed'; f.state.lastExit = 7; f.state.lastSignal = 'SIGTERM'; f.save(); rmSync(f.log);
  const result = await observe(f.options);
  assert.equal(result.reason, 'failed'); assert.equal(result.exit, 7); assert.equal(result.signal, 'SIGTERM');
});

test('CI requires exact identity and preserves skipped, missing and failed step outcomes', async t => {
  const f = fixture(t), sha = 'a'.repeat(40);
  const source = { kind: 'ci', host: 'github.com', repo: 'fixture/project', run: 123, attempt: 2, sha, jobs: ['windows, node 22', 'cleanup'], artifacts: [] };
  const command = async (file,args) => {
    assert.equal(file,'gh');
    if (args.at(-1).endsWith('/attempts/2')) return { status: 0, stdout: JSON.stringify({ id:123,run_attempt:2,head_sha:sha,status:'completed',conclusion:'success',html_url:'https://github.com/fixture/project/actions/runs/123' }) };
    if (args.at(-1).endsWith('/jobs')) return { status:0,stdout:JSON.stringify([{ jobs:[{id:8,name:'windows, node 22',run_id:123,head_sha:sha,status:'completed',conclusion:'skipped',steps:[{name:'build',status:'completed',conclusion:'failure'}]}] }]) };
    return {status:0,stdout:JSON.stringify([{ artifacts:[] }])};
  };
  const result = await observe({ ...f.options, source, command });
  assert.equal(result.reason,'needs_decision'); assert.equal(result.jobs[0].outcome,'skipped'); assert.equal(result.jobs[0].steps[0].outcome,'failure'); assert.equal(result.jobs[1].outcome,'unreached'); assert.equal(result.acceptance,'not_established');
});

test('explicit supported heartbeat keeps renewing in quiet waits and reports ownership failure immediately', async t => {
  const f = fixture(t); f.state.beads = 'fixture-task'; f.save(); let calls = 0;
  const command = async (file,args) => {
    assert.equal(file,'bd'); assert.deepEqual(args.slice(0,5),['--actor','fixture-owner','-C',f.dir,'--sandbox']);
    if (args.at(-1) === '--help') return {status:0,stdout:'Usage: bd heartbeat <id> Only the current in_progress owner may refresh.'};
    assert.deepEqual(args.slice(5),['heartbeat','fixture-task']);
    calls++; return {status:calls===3 ? 1 : 0,stdout:''};
  };
  const start = Date.now(), result = await observe({...f.options,budgetMs:500,heartbeat:{task:'fixture-task',actor:'fixture-owner',repo:f.dir,ttlMs:100,intervalMs:20},command});
  assert.equal(result.reason,'lease_lost'); assert.equal(calls,3); assert.ok(Date.now()-start<250);
  assert.equal(readFileSync(join(f.dir,'executor.lock'),'utf8'),JSON.stringify(f.lock));
});

test('log replacement preserves prior cursor evidence instead of silently accepting a new stream', async t => {
  const f = fixture(t); appendFileSync(f.log,'first bytes'); await observe(f.options);
  const cursor = readFileSync(f.options.cursor,'utf8'); renameSync(f.log,join(f.dir,'retained.log')); writeFileSync(f.log,'different stream that is longer');
  const result = await observe(f.options);
  assert.equal(result.diagnostic.code,'log_discontinuity'); assert.equal(readFileSync(f.options.cursor,'utf8'),cursor);
});

function ciFixture(t, overrides = {}) {
  const f = fixture(t), sha = 'a'.repeat(40);
  const source = {kind:'ci',host:'github.com',repo:'fixture/project',run:123,attempt:2,sha,jobs:['windows'],artifacts:['receipt']};
  const view = {databaseId:123,attempt:2,headSha:sha,status:'completed',conclusion:'success',url:'https://github.com/fixture/project/actions/runs/123',...overrides.view};
  const jobs = overrides.jobs ?? [{id:8,name:'windows',run_id:123,head_sha:sha,status:'completed',conclusion:'success',steps:[{name:'build',status:'completed',conclusion:'success'}]}];
  const artifacts = overrides.artifacts ?? [{id:9,name:'receipt-run-123-attempt-2',digest:'sha256:fixture',expired:false,workflow_run:{id:123,head_sha:sha}}];
  const calls = [];
  const command = async (file,args) => {
    calls.push([file,args]);
    if (/\/attempts\/\d+$/.test(args.at(-1))) return {status:0,stdout:JSON.stringify({id:view.databaseId,run_attempt:view.attempt,head_sha:view.headSha,html_url:view.url,status:view.status,conclusion:view.conclusion})};
    return {status:0,stdout:JSON.stringify(args.at(-1).endsWith('/jobs') ? [{jobs:jobs.slice(0,1)},{jobs:jobs.slice(1)}] : [{artifacts}])};
  };
  return {...f,source,view,jobs,artifacts,calls,command,options:{...f.options,source,command}};
}

test('identical blocked CI observations are suppressed after observer restart', async t => {
  const f = ciFixture(t,{artifacts:[{id:9,name:'receipt',expired:false,workflow_run:{id:123,head_sha:'a'.repeat(40)}}]});
  const first = await observe(f.options); assert.equal(first.artifacts[0].outcome,'artifact_attempt_unverified'); assert.equal(first.reason,'needs_decision');
  const start = Date.now(), repeat = await observe(f.options);
  assert.equal(repeat.reason,'deadline'); assert.ok(Date.now()-start>=70); assert.equal(repeat.candidate,false);
});

test('restarted observation suppresses delivered terminal state and keeps log byte continuity', async t => {
  const f = fixture(t); f.state.status='awaiting_review'; f.state.lastExit=0; f.save(); appendFileSync(f.log,'finished\n');
  const first = await observe(f.options); assert.equal(first.reason,'completed'); assert.equal(first.exit,0);
  const repeat = await observe(f.options); assert.equal(repeat.reason,'deadline'); assert.equal(repeat.log.from,9); assert.equal(repeat.log.to,9);
  rmSync(f.options.cursor); assert.equal((await observe(f.options)).reason,'completed');
});

test('missing or malformed snapshots and removed logs are finite access diagnostics', async t => {
  const f = fixture(t);
  for (const value of ['{',JSON.stringify({...f.state,version:99})]) {
    writeFileSync(join(f.dir,'current.json'),value); const result = await observe(f.options); assert.equal(result.reason,'access_lost');
  }
  f.save(); rmSync(f.log); assert.equal((await observe(f.options)).reason,'access_lost');
  rmSync(join(f.dir,'current.json')); assert.equal((await observe(f.options)).reason,'access_lost');
});

test('cursor cannot write a source file, compete with another observer or follow a new execution', async t => {
  const f = fixture(t);
  await assert.rejects(observe({...f.options,cursor:join(f.dir,'current.json')}),/observer-owned/);
  writeFileSync(`${f.options.cursor}.lock`,'other'); await assert.rejects(observe(f.options),/EEXIST/); rmSync(`${f.options.cursor}.lock`);
  await observe(f.options); const before=readFileSync(f.options.cursor,'utf8'); f.state.executionId='new-launch'; f.save();
  const result = await observe(f.options); assert.equal(result.reason,'needs_decision'); assert.equal(result.diagnostic.code,'source_mismatch'); assert.equal(readFileSync(f.options.cursor,'utf8'),before);
});

test('truncation and mismatched executor ownership preserve locks and evidence', async t => {
  const f = fixture(t); writeFileSync(f.log,'some retained bytes'); await observe(f.options); writeFileSync(f.log,'');
  assert.equal((await observe(f.options)).diagnostic.code,'log_discontinuity'); rmSync(f.options.cursor);
  f.lock.executionId='foreign'; writeFileSync(join(f.dir,'executor.lock'),JSON.stringify(f.lock));
  assert.equal((await observe(f.options)).reason,'ownership_unknown'); assert.equal(readFileSync(join(f.dir,'executor.lock'),'utf8'),JSON.stringify(f.lock));
});

test('legacy snapshot and pid lock are observable with explicitly limited confidence', async t => {
  const f = fixture(t); delete f.state.runId; delete f.state.executionId; delete f.state.runDirectory; f.save(); writeFileSync(join(f.dir,'executor.lock'),JSON.stringify({pid:process.pid}));
  const result=await observe(f.options); assert.equal(result.reason,'deadline'); assert.equal(result.ownership,'legacy_limited');
});

async function runningFixture(t,mode = 'quiet',duration = 600) {
  const f=fixture(t); rmSync(join(f.dir,'current.json')); rmSync(join(f.dir,'executor.lock'));
  const git=(...args)=>execFileSync('git',args,{cwd:f.dir,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  git('init','-q'); git('config','user.email','fixture@example.invalid'); git('config','user.name','Fixture');
  writeFileSync(join(f.dir,'.gitignore'),'run/\nfull.log\nobserver.json*\n'); mkdirSync(join(f.dir,'docs')); writeFileSync(join(f.dir,'docs/plan.md'),'Fixture plan'); git('add','.'); git('commit','-qm','fixture');
  const dir=join(f.dir,'run'); initialize(dir,{cwd:f.dir,issue:'fixture',beads:'fixture-task',base:'HEAD'});
  const fd=openSync(f.log,'a'); const worker=spawn(process.execPath,[fileURLToPath(new URL('./fixtures/ralphex-observer-worker.mjs',import.meta.url)),dir,mode,String(duration)],{stdio:['ignore',fd,fd]}); closeSync(fd);
  const exited=new Promise(resolve=>worker.once('exit',(code,signal)=>resolve({code,signal})));
  t.after(async()=>{ if(worker.exitCode===null && worker.signalCode===null) worker.kill(); await exited; });
  const until=Date.now()+2500; while(readState(dir).status==='ready' && Date.now()<until) await new Promise(resolve=>setTimeout(resolve,10));
  assert.notEqual(readState(dir).status,'ready');
  return {...f,dir,worker,exited,options:{...f.options,source:{kind:'runner',dir,log:f.log}}};
}

for(const mode of ['quiet','noisy','failure','throw']) test(`real runner/process ${mode} preserves terminal source and real CLI exit`,async t=>{
  const f=await runningFixture(t,mode,100);
  const result=await observe({...f.options,budgetMs:2000}); const exit=await f.exited;
  assert.equal(result.reason,['failure','throw'].includes(mode)?'failed':'completed');
  assert.equal(exit.code,['failure','throw'].includes(mode)?1:0);
  assert.equal(result.exit,mode==='failure'?9:mode==='throw'?null:0);
  if(mode==='noisy') { assert.ok(readFileSync(f.log).length>100000); assert.ok(result.log.excerpt.length<=2048); }
});

test('cancelling the actual observer CLI leaves its quiet executor running to successful exit',async t=>{
  const f=await runningFixture(t,'quiet',500);
  const observer=spawn(process.execPath,[fileURLToPath(new URL('../scripts/ralphex-observe.mjs',import.meta.url)),'runner','--dir',f.dir,'--log',f.log,'--cursor',f.options.cursor,'--budget-ms','2000'],{stdio:['ignore','pipe','pipe']});
  let stdout='';observer.stdout.on('data',data=>stdout+=data);const exit=new Promise(resolve=>observer.once('exit',resolve));
  await new Promise(resolve=>setTimeout(resolve,100));observer.kill('SIGTERM'); await exit;
  if (process.platform !== 'win32') assert.equal(JSON.parse(stdout).reason,'cancelled'); assert.equal(readState(f.dir).status,'running');
  assert.equal((await f.exited).code,0); assert.equal(readState(f.dir).status,'awaiting_review');
});

test('a dead launcher retains running evidence and cannot infer executor completion',async t=>{
  const f=await runningFixture(t,'quiet',300); f.worker.kill('SIGKILL'); await f.exited;
  const lock=readFileSync(join(f.dir,'executor.lock'),'utf8'); const result=await observe(f.options);
  assert.equal(result.reason,'ownership_unknown'); assert.equal(readState(f.dir).status,'running'); assert.equal(readFileSync(join(f.dir,'executor.lock'),'utf8'),lock);
  await new Promise(resolve=>setTimeout(resolve,400));
});

for(const field of ['headSha','attempt','databaseId','url']) test(`CI rejects mismatched ${field} before using jobs or artifact evidence`,async t=>{
  const wrong={headSha:'b'.repeat(40),attempt:1,databaseId:124,url:'https://github.com/other/repo/actions/runs/123'};
  const f=ciFixture(t,{view:{[field]:wrong[field]}}); const result=await observe(f.options);
  assert.equal(result.reason,'needs_decision'); assert.equal(result.diagnostic.code,'ci_identity_mismatch'); assert.equal(f.calls.length,1);
});

for(const outcome of ['failure','skipped','cancelled','timed_out','action_required','neutral']) test(`CI retains ${outcome} without turning workflow success into acceptance`,async t=>{
  const f=ciFixture(t);f.jobs[0].conclusion=outcome;const result=await observe(f.options);
  assert.equal(result.reason,'needs_decision');assert.equal(result.jobs[0].outcome,outcome);assert.equal(result.candidate,false);
});

for(const mode of ['missing','expired','wrong-attempt','wrong-sha']) test(`CI artifact ${mode} remains a distinct pending gate`,async t=>{
  const f=ciFixture(t);
  if(mode==='missing')f.artifacts.length=0;
  if(mode==='expired')f.artifacts[0].expired=true;
  if(mode==='wrong-attempt')f.artifacts[0].name='receipt-run-123-attempt-1';
  if(mode==='wrong-sha')f.artifacts[0].workflow_run.head_sha='b'.repeat(40);
  const result=await observe(f.options);assert.equal(result.reason,'needs_decision');assert.equal(result.candidate,false);
  assert.equal(result.artifacts[0].outcome,mode==='expired'?'expired':mode==='wrong-sha'?'artifact_attempt_unverified':'missing');
});

test('CI exact attempt metadata and required steps produce only a candidate; pagination commands use exact repository',async t=>{
  const f=ciFixture(t);f.source.steps={windows:['build']};const result=await observe(f.options);
  assert.equal(result.reason,'completed');assert.equal(result.candidate,true);assert.equal(result.acceptance,'not_established');
  assert.deepEqual(f.calls[0][1],['api','--hostname','github.com','--method','GET','/repos/fixture/project/actions/runs/123/attempts/2']);
  assert.ok(f.calls[1][1].includes('--paginate')); assert.equal(f.calls[1][1].at(-1),'/repos/fixture/project/actions/runs/123/attempts/2/jobs');
  assert.equal(f.calls[2][1].at(-1),'/repos/fixture/project/actions/runs/123/artifacts');
  f.source.steps.windows.push('cleanup');rmSync(f.options.cursor);
  const missing=await observe(f.options);assert.equal(missing.reason,'needs_decision');assert.equal(missing.jobs[0].steps.at(-1).outcome,'unreached');
});

test('CI missing steps, malformed pagination, access errors and bounded transport timeout never indicate success',async t=>{
  const f=ciFixture(t);delete f.jobs[0].steps;f.source.steps={windows:['cleanup']};let result=await observe(f.options);assert.equal(result.jobs[0].stepsAvailable,false);assert.equal(result.reason,'needs_decision');
  rmSync(f.options.cursor);
  result=await observe({...f.options,command:async()=>({status:1,stdout:'auth unavailable'})});assert.equal(result.reason,'access_lost');
  result=await observe({...f.options,command:async(file,args)=>({status:0,stdout:args.at(-1).endsWith('/attempts/2')?JSON.stringify({id:123,run_attempt:2,head_sha:f.source.sha,html_url:f.view.url,status:'completed',conclusion:'success'}):'{}'})});assert.equal(result.reason,'access_lost');
  const start=Date.now();result=await observe({...f.options,command:async()=>new Promise(()=>{})});assert.equal(result.reason,'access_lost');assert.ok(Date.now()-start<500);
});

test('CI pending state waits without treating quiet or expired budget as gate readiness',async t=>{
  const f=ciFixture(t,{view:{status:'in_progress',conclusion:null}});f.jobs[0].status='in_progress';f.jobs[0].conclusion=null;
  const result=await observe(f.options);assert.equal(result.reason,'deadline');assert.equal(result.status,'in_progress');assert.equal(result.candidate,false);
  f.source.attempt=3;const changed=await observe(f.options);assert.equal(changed.diagnostic.code,'source_mismatch');
});

test('API cancellation is finite and does not touch source or executor lock',async t=>{
  const f=fixture(t),controller=new AbortController();const timer=setTimeout(()=>controller.abort(),20);t.after(()=>clearTimeout(timer));
  const before=readFileSync(join(f.dir,'executor.lock'),'utf8');const result=await observe({...f.options,budgetMs:1000,signal:controller.signal});
  assert.equal(result.reason,'cancelled');assert.equal(readFileSync(join(f.dir,'executor.lock'),'utf8'),before);
});

test('heartbeat remains opt-in and unsupported capability or wrong task blocks renewal',async t=>{
  const f=fixture(t);f.state.beads='fixture-task';f.save();let calls=0;
  const config={task:'fixture-task',actor:'fixture-owner',repo:f.dir,ttlMs:100,intervalMs:20};
  const command=async()=>{calls++;return{status:0,stdout:'unsupported command'};};
  await observe({...f.options,command});assert.equal(calls,0);
  await assert.rejects(observe({...f.options,command,heartbeat:{...config,task:'other'}}),/match/);assert.equal(calls,0);
  const result=await observe({...f.options,command,heartbeat:config});assert.equal(result.reason,'lease_lost');assert.equal(calls,1);
});

test('truncation followed by regrowth is diagnosed even when inode and size appear continuous',async t=>{
  const f=fixture(t);writeFileSync(f.log,'retained old bytes');await observe(f.options);const before=readFileSync(f.options.cursor,'utf8');
  writeFileSync(f.log,'new content replacing the old bytes and growing beyond its size');
  const result=await observe(f.options);assert.equal(result.diagnostic.code,'log_discontinuity');assert.equal(readFileSync(f.options.cursor,'utf8'),before);
});

test('heartbeat request cannot outwait the explicitly configured lease renewal margin',async t=>{
  const f=fixture(t);f.state.beads='fixture-task';f.save();
  const command=async(file,args)=>args.at(-1)==='--help'?{status:0,stdout:'Usage: bd heartbeat <id> Only in_progress owner'}:new Promise(()=>{});
  const start=Date.now(),result=await observe({...f.options,budgetMs:500,heartbeat:{task:'fixture-task',actor:'fixture-owner',repo:f.dir,ttlMs:100,intervalMs:20},command});
  assert.equal(result.reason,'lease_lost');assert.ok(Date.now()-start<150);
});

test('large external errors remain a compact diagnostic and retain their full observer evidence',async t=>{
  const f=ciFixture(t);const result=await observe({...f.options,command:async()=>{throw new Error('denied '.repeat(10000));}});
  assert.equal(result.reason,'access_lost');assert.ok(JSON.stringify(result).length<6000);assert.ok(result.diagnostic.evidence);
  assert.ok(readFileSync(result.diagnostic.evidence,'utf8').length>60000);
});

test('artifact metadata without a boolean expiration flag cannot be a verified candidate',async t=>{
  const f=ciFixture(t);delete f.artifacts[0].expired;const result=await observe(f.options);
  assert.equal(result.reason,'needs_decision');assert.equal(result.artifacts[0].outcome,'invalid_metadata');assert.equal(result.candidate,false);
});

test('a foreign cursor is rejected before any enabled heartbeat transport call',async t=>{
  const f=fixture(t);f.state.beads='fixture-task';f.save();await observe(f.options);f.state.executionId='foreign';f.save();let calls=0;
  const result=await observe({...f.options,heartbeat:{task:'fixture-task',actor:'fixture-owner',repo:f.dir,ttlMs:100,intervalMs:20},command:async()=>{calls++;return{status:0,stdout:'Usage: bd heartbeat <id> Only in_progress owner'};}});
  assert.equal(result.diagnostic.code,'source_mismatch');assert.equal(calls,0);
});

test('CI metadata uses the exact-attempt REST endpoint with a bounded request budget',async t=>{
  const f=ciFixture(t);const seen=[];
  const command=async(file,args,options)=>{
    seen.push(args);assert.ok(options.timeoutMs>2000);assert.ok(options.timeoutMs<=5000);
    if(args.at(-1).endsWith('/attempts/2'))return{status:0,stdout:JSON.stringify({id:123,run_attempt:2,head_sha:'a'.repeat(40),status:'completed',conclusion:'success',html_url:'https://github.com/fixture/project/actions/runs/123'})};
    return f.command(file,args);
  };
  const result=await observe({...f.options,budgetMs:6000,command});assert.equal(result.reason,'completed');assert.equal(seen[0].at(-1),'/repos/fixture/project/actions/runs/123/attempts/2');
});

test('required job without its numeric identity remains unavailable even if its conclusion says success',async t=>{
  const f=ciFixture(t);delete f.jobs[0].id;const result=await observe(f.options);assert.equal(result.reason,'access_lost');assert.equal(result.status,'unavailable');
});

test('bounded CI transport timeout is distinguishable from user cancellation',async t=>{
  const f=ciFixture(t);const result=await observe({...f.options,command:async()=>new Promise(()=>{})});
  assert.equal(result.reason,'access_lost');assert.match(result.diagnostic.message,/timed out/);
});

test('losing cursor ownership cannot publish or remove a competing observer cursor',async t=>{
  const f=fixture(t);const timer=setTimeout(()=>writeFileSync(`${f.options.cursor}.lock`,JSON.stringify({token:'foreign',pid:process.pid})),20);t.after(()=>clearTimeout(timer));
  await assert.rejects(observe(f.options),/ownership lost/);assert.throws(()=>readFileSync(f.options.cursor),/ENOENT/);
  assert.equal(JSON.parse(readFileSync(`${f.options.cursor}.lock`)).token,'foreign');
});

test('large CI step reports keep every outcome in evidence and return a compact envelope',async t=>{
  const f=ciFixture(t);f.jobs[0].steps=Array.from({length:200},(_,i)=>({name:`step ${i} ${'x'.repeat(100)}`,status:'completed',conclusion:i===199?'failure':'success'}));
  const result=await observe(f.options);assert.ok(JSON.stringify(result).length<12000);assert.ok(result.detailEvidence);
  const detailed=JSON.parse(readFileSync(result.detailEvidence,'utf8'));assert.equal(detailed.jobs[0].steps.length,200);assert.equal(detailed.jobs[0].steps.at(-1).outcome,'failure');
  assert.equal(result.jobs[0].stepOutcomeCounts.failure,1);assert.equal(result.acceptance,'not_established');
});

for (const withHeartbeat of [false,true]) test(`fresh observer binds its first execution for the whole invocation (heartbeat=${withHeartbeat})`,async t=>{
  const f=fixture(t);f.state.beads='fixture-task';f.save();
  const timer=setTimeout(()=>{f.state.executionId='second-execution';f.lock.executionId='second-execution';writeFileSync(join(f.dir,'executor.lock'),JSON.stringify(f.lock));f.save();},25);t.after(()=>clearTimeout(timer));
  const command=async(file,args)=>{if(args.at(-1)==='--help')await new Promise(resolve=>setTimeout(resolve,40));return{status:0,stdout:'Usage: bd heartbeat <id> Only the current in_progress owner'};};
  const result=await observe({...f.options,budgetMs:200,pollMs:50,command,heartbeat:withHeartbeat?{task:'fixture-task',actor:'fixture-owner',repo:f.dir,ttlMs:400,intervalMs:100}:undefined});
  assert.equal(result.reason,'needs_decision');assert.equal(result.diagnostic.code,'source_mismatch');assert.throws(()=>readFileSync(f.options.cursor),/ENOENT/);
  assert.equal(readFileSync(join(f.dir,'executor.lock'),'utf8'),JSON.stringify(f.lock));
});

for (const alias of [false,true]) test(`derived cursor lock cannot create or remove the runner executor lock (alias=${alias})`,async t=>{
  const f=fixture(t);f.state.status='awaiting_review';f.save();rmSync(join(f.dir,'executor.lock'));
  const dir=alias?join(f.dir,'alias'):f.dir;if(alias)symlinkSync(f.dir,dir,process.platform==='win32'?'junction':'dir');
  const before=readFileSync(join(f.dir,'current.json'),'utf8');
  await assert.rejects(observe({...f.options,cursor:join(dir,'executor')}),/observer-owned/);
  assert.throws(()=>readFileSync(join(f.dir,'executor.lock')),/ENOENT/);assert.throws(()=>readFileSync(join(f.dir,'executor')),/ENOENT/);
  assert.equal(readFileSync(join(f.dir,'current.json'),'utf8'),before);
});

test('a progress marker before a large ordinary burst is delivered once with short output and full byte continuity',async t=>{
  const f=fixture(t);writeFileSync(f.log,'RALPHEX_PROGRESS {"task":"Task before burst"}\n'+'ordinary output\n'.repeat(1000));
  const first=await observe(f.options);assert.equal(first.reason,'progress');assert.equal(first.task,'Task before burst');assert.ok(first.log.excerpt.length<=2048);
  const repeat=await observe(f.options);assert.equal(repeat.reason,'deadline');assert.equal(repeat.log.from,first.log.to);assert.equal(repeat.log.to,readFileSync(f.log).length);
});

test('unfinished UTF-8 progress lines survive a chunk boundary and observer restart',async t=>{
  const f=fixture(t),marker=Buffer.from('RALPHEX_PROGRESS {"task":"Task 🧭 split"}\n'),split=marker.indexOf(Buffer.from('🧭'))+2;
  writeFileSync(f.log,Buffer.concat([Buffer.from('n'.repeat(20000)+'\n'),marker.subarray(0,split)]));
  const first=await observe(f.options);assert.equal(first.reason,'deadline');assert.equal(first.progressTotal,0);
  appendFileSync(f.log,Buffer.concat([marker.subarray(split),Buffer.from('ordinary\n'.repeat(2000))]));
  const second=await observe(f.options);assert.equal(second.reason,'progress');assert.equal(second.task,'Task 🧭 split');assert.equal(second.log.from,first.log.to);
  assert.equal(JSON.parse(readFileSync(second.progressEvidence,'utf8').trim()).task,'Task 🧭 split');
  const repeat=await observe(f.options);assert.equal(repeat.reason,'deadline');assert.equal(repeat.progressTotal,0);
});

test('large progress bursts keep bounded summaries and every ordered marker across byte continuations',async t=>{
  const f=fixture(t);writeFileSync(f.log,Array.from({length:500},(_,i)=>`RALPHEX_PROGRESS {"task":"Task ${i}"}\n`).join(''));
  let offset=0;const delivered=[];
  for(let window=0;window<20;window++){
    const result=await observe(f.options);assert.equal(result.log.from,offset);offset=result.log.to;assert.ok(result.progressTasks.length<=10);assert.ok(JSON.stringify(result).length<6000);
    if(result.progressTotal)delivered.push(...readFileSync(result.progressEvidence,'utf8').trim().split('\n').map(line=>JSON.parse(line).task));
    if(!result.log.unreadBytes)break;
  }
  assert.equal(delivered.length,500);assert.equal(delivered[0],'Task 0');assert.equal(delivered[249],'Task 249');assert.equal(delivered.at(-1),'Task 499');
  const repeat=await observe(f.options);assert.equal(repeat.reason,'deadline');assert.equal(repeat.progressTotal,0);assert.equal(repeat.log.from,offset);
});

test('large logs stop scanning at the observation deadline and retain unread byte ranges for the next call',async t=>{
  const f=fixture(t),size=32*1024*1024,fd=openSync(f.log,'w');ftruncateSync(fd,size);closeSync(fd);
  const first=await observe({...f.options,budgetMs:10});assert.equal(first.reason,'deadline');assert.ok(first.log.to<size);assert.equal(first.log.unreadBytes,size-first.log.to);assert.ok(first.elapsedMs<500);
  const second=await observe({...f.options,budgetMs:10});assert.equal(second.reason,'deadline');assert.equal(second.log.from,first.log.to);assert.ok(second.log.to>=first.log.to);assert.ok(second.log.to<size);
});

test('runner terminal failures remain primary while a large log still has unread bytes',async t=>{
  const f=fixture(t),fd=openSync(f.log,'w');ftruncateSync(fd,32*1024*1024);closeSync(fd);f.state.status='failed';f.state.lastExit=9;f.save();
  const result=await observe({...f.options,budgetMs:10});assert.equal(result.reason,'failed');assert.equal(result.exit,9);assert.ok(result.log.unreadBytes>0);
});

test('stream progress evidence is never written after cursor ownership is replaced',async t=>{
  const f=fixture(t);f.state.beads='fixture-task';f.save();writeFileSync(f.log,'RALPHEX_PROGRESS {"task":"Task marker"}\n');
  const command=async(file,args)=>{if(args.at(-1)!=='--help')writeFileSync(`${f.options.cursor}.lock`,JSON.stringify({token:'foreign',pid:process.pid}));return{status:0,stdout:'Usage: bd heartbeat <id> Only the current in_progress owner'};};
  await assert.rejects(observe({...f.options,command,heartbeat:{task:'fixture-task',actor:'fixture-owner',repo:f.dir,ttlMs:400,intervalMs:100}}),/ownership lost/);
  assert.equal(readdirSync(f.dir).filter(file=>file.includes('.progress-')).length,0);
});


test('runner temporary snapshot is reserved before any observer output, including canonical aliases',async t=>{
  for(const alias of [false,true])for(const existing of [false,true]){
    const f=fixture(t);f.state.status='awaiting_review';f.save();rmSync(join(f.dir,'executor.lock'));
    const dir=alias?join(f.dir,'alias'):f.dir;if(alias)symlinkSync(f.dir,dir,process.platform==='win32'?'junction':'dir');
    const snapshot=join(f.dir,'current.json.tmp');if(existing)writeFileSync(snapshot,'pending runner snapshot');
    const entries=readdirSync(f.dir).sort(),before=readFileSync(join(f.dir,'current.json'),'utf8');
    await assert.rejects(observe({...f.options,cursor:join(dir,'current.json.tmp')}),/observer-owned/);
    assert.deepEqual(readdirSync(f.dir).sort(),entries);assert.equal(readFileSync(join(f.dir,'current.json'),'utf8'),before);
    if(existing)assert.equal(readFileSync(snapshot,'utf8'),'pending runner snapshot');else assert.throws(()=>readFileSync(snapshot),/ENOENT/);
  }
});
