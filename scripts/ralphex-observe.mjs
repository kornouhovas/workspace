import { command as defaultCommand, ciIdentity, observeCi, heartbeatConfig, heartbeat as renewHeartbeat } from './ralphex-observe-sources.mjs';
import { randomUUID, createHash } from 'node:crypto';
import { open, readFile, lstat, readlink, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const sleep = (ms, signal) => new Promise(resolve => {
  const finish = () => { clearTimeout(timer); signal?.removeEventListener('abort', finish); resolve(); };
  const timer = setTimeout(finish, ms); signal?.addEventListener('abort', finish, { once: true });
  if (signal?.aborted) finish();
});
const json = async file => JSON.parse(await readFile(file, 'utf8'));
const fingerprint = value => JSON.stringify(value);
const timestampPrefix = /^\[\d{2}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\] /;

async function canonicalPath(file) {
  try { return await realpath(file); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    let info;
    try { info = await lstat(file); } catch (missing) { if (missing.code !== 'ENOENT') throw missing; }
    if (info?.isSymbolicLink()) return canonicalPath(resolve(dirname(file),await readlink(file)));
    return join(await canonicalPath(dirname(file)),basename(file));
  }
}

async function validateOutputs(paths,source) {
  if (source.kind !== 'runner') return;
  const reserved = [join(source.dir,'current.json'),join(source.dir,'current.json.tmp'),join(source.dir,'events.jsonl'),join(source.dir,'executor.lock'),source.log];
  const describe = async file => {
    const path = await canonicalPath(file); let identity;
    try { const info = await stat(file); identity = `${info.dev}:${info.ino}`; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    return {path:process.platform === 'win32' || process.platform === 'darwin' ? path.toLowerCase() : path,identity};
  };
  const inputs = await Promise.all(reserved.map(describe));
  for (const file of Object.values(paths)) {
    const output = await describe(file);
    if (inputs.some(input => input.path === output.path || (input.identity && input.identity === output.identity))) throw new Error('Cursor and all derived paths must be observer-owned');
  }
}

// Scan all newly consumed bytes, retaining only a bounded partial line/tail.
// A coalesced progress chunk returns early; later bytes remain unread in cursor.
async function scanLog(file,{offset,size,deadline,signal,pending,task}) {
  const start = offset, buffer = Buffer.alloc(16384), tasks = [], records = [];
  let line = Buffer.from(pending?.line ?? '', 'base64'), discard = pending?.discard ?? false;
  let marker = pending?.marker;
  let lineStart = pending?.from ?? offset, tail = Buffer.alloc(0), count = 0;
  while (offset < size && Date.now() < deadline && !signal.aborted) {
    const requested = Math.min(buffer.length,size-offset), read = await file.read(buffer,0,requested,offset);
    if (read.bytesRead !== requested) throw new Error('Log truncated during stream read');
    const chunk = buffer.subarray(0,read.bytesRead), chunkStart = offset;
    for (let position = 0; position < chunk.length;) {
      const newline = chunk.indexOf(10,position), end = newline < 0 ? chunk.length : newline;
      const part = chunk.subarray(position,end);
      if (!discard) {
        if (line.length + part.length > 4096) { discard = true; line = Buffer.alloc(0); }
        else line = Buffer.concat([line,part]);
      }
      if (newline >= 0) {
        const text = discard ? '' : line.toString('utf8');
        const prefix = timestampPrefix.exec(text)?.[0], content = prefix ? text.slice(prefix.length) : text;
        if (content.startsWith('RALPHEX_PROGRESS ')) marker = {text:content.slice(17),prefix,from:lineStart};
        else if (marker?.prefix && prefix === marker.prefix && !discard) marker.text += ` ${content}`;
        else marker = undefined;
        // Ralphex wraps one message into lines sharing a timestamp. Retain only
        // bounded advisory JSON; neither formatted nor raw text sets run status.
        if (marker && Buffer.byteLength(marker.text) > 4096) marker = undefined;
        if (marker) {
          try {
            const value = JSON.parse(marker.text);
            if (typeof value?.task === 'string' && value.task.length > 0 && value.task.length <= 200 && value.task !== task) {
              task = value.task; tasks.push(task); if (tasks.length > 10) tasks.shift(); count++;
              records.push({task,from:marker.from,to:chunkStart+newline+1});
            }
            marker = undefined;
          } catch { if (!marker.prefix) marker = undefined; }
        }
        line = Buffer.alloc(0); discard = false; lineStart = chunkStart+newline+1;
      }
      position = newline < 0 ? end : end+1;
    }
    tail = Buffer.concat([tail,chunk]).subarray(-2048); offset += chunk.length;
    if (count) break;
  }
  const anchorBytes = Buffer.alloc(Math.min(offset,64));
  if (offset > 0) {
    const read = await file.read(anchorBytes,0,anchorBytes.length,offset-anchorBytes.length);
    if (read.bytesRead !== anchorBytes.length) throw new Error('Log truncated before cursor publication');
  }
  return {offset,task,tasks,count,records,pending:{line:line.toString('base64'),discard,from:lineStart,marker},
    excerpt:tail.toString('utf8'),omittedBytes:Math.max(0,offset-start-tail.length),
    anchor:offset ? {length:anchorBytes.length,hash:createHash('sha256').update(anchorBytes).digest('hex')} : undefined};
}

async function runner(source) {
  let state;
  for (let retry = 0; retry < 3; retry++) {
    try { state = await json(join(source.dir, 'current.json')); break; }
    catch (error) { if (retry === 2) throw error; await sleep(5); }
  }
  if (state.version !== 1) throw new Error('Unsupported runner snapshot version');
  const identity = { kind: 'runner', dir: source.dir, log: source.log, runId: state.runId ?? null, executionId: state.executionId ?? null, worktree: state.worktree };
  let ownership = state.runId && state.executionId ? 'identified' : 'legacy_limited';
  let reason;
  if (state.runDirectory && state.runDirectory !== source.dir) reason = 'ownership_unknown';
  if (state.status === 'running') {
    let lock;
    try { lock = await json(join(source.dir, 'executor.lock')); } catch { reason = 'ownership_unknown'; }
    if (lock) {
      if (state.runId && (!lock.token || lock.runId !== state.runId || lock.executionId !== state.executionId || lock.runDirectory !== source.dir || lock.worktree !== state.worktree)) reason = 'ownership_unknown';
      if (!Number.isSafeInteger(lock.pid) || lock.pid <= 0) reason = 'ownership_unknown';
      else try { process.kill(lock.pid, 0); } catch { reason = 'ownership_unknown'; }
    }
  }
  if (reason) ownership = 'unknown';
  return { identity, state, ownership, reason };
}

async function assertCursorOwner(lockPath,token) {
  if ((await json(lockPath)).token !== token) throw new Error('Observer cursor ownership lost');
}

async function releaseCursor(lock, lockPath, token) {
  await lock.close();
  await assertCursorOwner(lockPath,token);
  await rm(lockPath);
}

// A finite read-only observation. The cursor belongs only to this observer.
export async function observe({ source, cursor, budgetMs = 50000, pollMs, signal, command = defaultCommand, heartbeat } = {}) {
  if (!Number.isFinite(budgetMs) || budgetMs < 1 || budgetMs > 55000) throw new Error('budgetMs must be 1..55000');
  pollMs ??= source?.kind === 'ci' ? 10000 : 250;
  if (!Number.isFinite(pollMs) || pollMs < 1) throw new Error('pollMs must be positive');
  if (!['runner','ci'].includes(source?.kind)) throw new Error('source kind must be runner or ci');
  source = source.kind === 'runner' ? { ...source, dir: await realpath(source.dir), log: await canonicalPath(resolve(source.log)) } : ciIdentity(source);
  cursor = await canonicalPath(resolve(cursor));
  const lockPath = `${cursor}.lock`, token = randomUUID();
  const paths = {cursor,lock:lockPath,temporary:`${cursor}.${token}.tmp`,diagnostic:`${cursor}.diagnostic-${token}.txt`,details:`${cursor}.details-${token}.json`,progress:`${cursor}.progress-${token}.jsonl`};
  await validateOutputs(paths,source);
  const lock = await open(lockPath, 'wx'); await lock.writeFile(JSON.stringify({ token, pid: process.pid }));
  const start = Date.now(), deadline = start + budgetMs;
  let previous, cursorError, leaseError, leaseTask;
  const leaseController = new AbortController(), wake = new AbortController(), leaseEvidence = [];
  const cancel = () => wake.abort(); signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) cancel();
  let leaseFailure; const lostLease = new Promise(resolve => { leaseFailure = resolve; });
  try {
    try { previous = await json(cursor);
      if (previous.pendingLog && (typeof previous.pendingLog.line !== 'string' || previous.pendingLog.line.length > 5464 || typeof previous.pendingLog.discard !== 'boolean' || !Number.isSafeInteger(previous.pendingLog.from) || previous.pendingLog.from < 0 || previous.pendingLog.from > previous.offset)) throw new Error('Malformed observer stream cursor');
      const marker = previous.pendingLog?.marker;
      if (marker && (typeof marker.text !== 'string' || Buffer.byteLength(marker.text) > 4096 || typeof marker.prefix !== 'string' || timestampPrefix.exec(marker.prefix)?.[0] !== marker.prefix || !Number.isSafeInteger(marker.from) || marker.from < 0 || marker.from > previous.offset)) throw new Error('Malformed observer progress cursor');
      if (previous.anchor && (!Number.isSafeInteger(previous.anchor.length) || previous.anchor.length < 1 || previous.anchor.length > 64 || !/^[a-f0-9]{64}$/.test(previous.anchor.hash))) throw new Error('Malformed observer byte anchor');
      if (previous.version !== 1 || !previous.source || !Number.isSafeInteger(previous.offset) || previous.offset < 0 || typeof previous.fingerprint !== 'string') throw new Error('Unsupported or malformed observer cursor');
    } catch (error) { if (error.code !== 'ENOENT') { cursorError = error; previous = undefined; } }
    let observedIdentity = previous?.source;
    let current, log, from = previous?.offset ?? 0, offset = from, excerpt = '', lastActivityAt = previous?.lastActivityAt ?? null, polls = 0, task = previous?.task ?? null, anchor = previous?.anchor, progressTasks = [], progressTotal = 0, progressRecords = [], pendingLog = previous?.pendingLog, observedLogSize = offset, excerptOmittedBytes = 0;
    const finish = async (reason, diagnostic = current?.diagnostic) => {
      await assertCursorOwner(lockPath,token);
      if (progressRecords.length) await writeFile(paths.progress,progressRecords.map(record=>JSON.stringify(record)+'\n').join(''),{flag:'wx'});
      if (diagnostic?.message?.length > 1024) {
        const evidence = paths.diagnostic;
        await writeFile(evidence,diagnostic.message); diagnostic = {...diagnostic,message:diagnostic.message.slice(0,1024),evidence};
      }
      const result = { schemaVersion: 1, source: current?.identity ?? source, observedAt: new Date().toISOString(), reason,
        progressTasks, progressTotal, progressEvidence:progressTotal ? paths.progress : undefined, jobs: current?.jobs, artifacts: current?.artifacts, candidate: current?.candidate, task, status: current?.state.status ?? 'unavailable', phase: current?.state.phase ?? null, exit: current?.state.lastExit ?? null,
        signal: current?.state.lastSignal ?? null, ownership: current?.ownership ?? 'unknown', diagnostic,
        log: { path: source.log, from, to: offset, excerpt, excerptOmittedBytes, unreadBytes:Math.max(0,observedLogSize-offset) }, activity: { kind: offset > from ? 'output' : 'quiet', lastObservedAt: lastActivityAt },
        evidence: source.kind === 'runner' ? [join(source.dir, 'current.json'), source.log] : [current?.state.url].filter(Boolean), nextAction: (current?.state.nextAction ?? 'Inspect source evidence').slice(0,500), polls, elapsedMs: Date.now() - start, lease: leaseEvidence, acceptance: 'not_established' };
      if (source.kind === 'ci' && Buffer.byteLength(JSON.stringify(result)) > 12000) {
        result.detailEvidence = paths.details;
        await writeFile(result.detailEvidence,JSON.stringify(result));
        result.jobsTotal = result.jobs?.length ?? 0; result.artifactsTotal = result.artifacts?.length ?? 0;
        result.jobs = result.jobs?.slice(0,10).map(job => ({
          ...job, steps:job.steps.filter(step => step.outcome !== 'success').slice(0,3).map(step => ({...step,name:step.name?.slice(0,200)})),
          stepsTotal:job.steps.length, stepOutcomeCounts:job.steps.reduce((counts,step) => ({...counts,[step.outcome]:(counts[step.outcome] ?? 0)+1}),{}),
          stepsEvidence:result.detailEvidence
        }));
        result.artifacts = result.artifacts?.slice(0,10);
        if (Buffer.byteLength(JSON.stringify(result)) > 12000) {
          result.source = {...result.source,jobs:undefined,artifacts:undefined,steps:undefined,requirementsEvidence:result.detailEvidence};
          result.jobs = []; result.artifacts = [];
        }
      }
      if (current && !['source_mismatch','access_lost','log_discontinuity','cursor_invalid'].includes(diagnostic?.code)) {
        const saved = { version: 1, source: current.identity, logIdentity: log?.identity, offset, fingerprint: fingerprint(current.state), lastActivityAt, task, anchor, pendingLog };
        const temp = paths.temporary; await writeFile(temp, JSON.stringify(saved)); await assertCursorOwner(lockPath,token); await rename(temp, cursor);
      }
      return result;
    };
    if (heartbeat && !signal?.aborted) {
      const lease = await heartbeatConfig(heartbeat);
      try { current = source.kind === 'runner' ? await runner(source) : await observeCi(source,{transport:command,deadline,signal}); }
      catch (error) { return await finish('access_lost',{code:'access_lost',message:error.message}); }
      if (cursorError) return await finish(current.state.status === 'failed' ? 'failed' : 'needs_decision',{code:'cursor_invalid',message:cursorError.message});
      if (observedIdentity && fingerprint(observedIdentity) !== fingerprint(current.identity)) return await finish(current.state.status === 'failed' ? 'failed' : 'needs_decision',{code:'source_mismatch',message:'Cursor belongs to another source; choose a fresh cursor'});
      observedIdentity ??= current.identity;
      if (current.diagnostic?.code === 'ci_identity_mismatch' || current.ownership === 'unknown') return await finish(current.reason,current.diagnostic);
      if (source.kind === 'runner' && (current.state.beads !== lease.task || current.state.worktree !== lease.repo)) throw new Error('Heartbeat task/repository must match the selected runner');
      const renew = async verify => {
        const renewalDeadline = Math.min(deadline, Date.now() + Math.max(1,Math.min(lease.intervalMs,lease.ttlMs-lease.intervalMs-1)));
        const receipt = await renewHeartbeat(lease,{transport:command,deadline:renewalDeadline,signal:leaseController.signal,verify});
        leaseEvidence.push(receipt); if (leaseEvidence.length > 20) leaseEvidence.shift();
      };
      try { await renew(true); }
      catch (error) { return await finish('lease_lost',{code:'lease_lost',message:error.message}); }
      leaseTask = (async () => {
        while (!leaseController.signal.aborted && Date.now() < deadline) {
          await sleep(Math.min(lease.intervalMs,Math.max(0,deadline-Date.now())),leaseController.signal);
          if (leaseController.signal.aborted || Date.now() >= deadline) return;
          try { await renew(false); }
          catch (error) {
            if (!leaseController.signal.aborted) { leaseError = error; leaseEvidence.push({at:new Date().toISOString(),status:'failed',message:error.message.slice(0,512)}); leaseFailure(); wake.abort(); }
            return;
          }
        }
      })();
    }
    while (true) {
      if (leaseError) return await finish('lease_lost', {code:'lease_lost',message:leaseError.message});
      if (signal?.aborted) return await finish('cancelled');
      if (source.kind === 'ci' && current && deadline - Date.now() < 100) { await sleep(Math.max(0,deadline-Date.now()),wake.signal); return await finish(leaseError ? 'lease_lost' : signal?.aborted ? 'cancelled' : 'deadline'); }
      try { current = await Promise.race([source.kind === 'runner' ? runner(source) : observeCi(source, { transport: command, deadline, signal:wake.signal }), lostLease.then(() => { throw leaseError; })]); polls++; }
      catch (error) { return await finish(leaseError ? 'lease_lost' : signal?.aborted ? 'cancelled' : 'access_lost', { code: leaseError ? 'lease_lost' : 'access_lost', message: error.message }); }
      const runnerTerminal = source.kind === 'runner' && current.state.status !== 'running' ? (current.state.status === 'failed' ? 'failed' : ['awaiting_review','awaiting_verification'].includes(current.state.status) ? 'completed' : 'transition') : null;
      if (cursorError) return await finish(runnerTerminal ?? 'needs_decision', {code:'cursor_invalid',message:cursorError.message});
      if (observedIdentity && fingerprint(observedIdentity) !== fingerprint(current.identity)) return await finish(runnerTerminal ?? 'needs_decision', { code: 'source_mismatch', message: 'Cursor belongs to a different source or execution; select a fresh cursor' });
      observedIdentity ??= current.identity;
      if (current.reason && (source.kind === 'runner' || previous?.fingerprint !== fingerprint(current.state))) return await finish(current.reason, current.diagnostic);
      const changed = previous?.fingerprint !== fingerprint(current.state);
      const terminalReason = source.kind === 'runner' && changed && current.state.status !== 'running' ? (current.state.status === 'failed' ? 'failed' : ['awaiting_review','awaiting_verification'].includes(current.state.status) ? 'completed' : 'transition') : null;
      if (source.kind === 'runner') try {
        const info = await stat(source.log), identity = `${info.dev}:${info.ino}`;
        if (log && log.identity !== identity) return await finish(terminalReason ?? 'diagnostic', { code: 'log_discontinuity', message: 'Log replaced during observation' });
        log = { identity }; observedLogSize = info.size;
        if ((previous?.logIdentity && previous.logIdentity !== log.identity) || info.size < offset) return await finish(terminalReason ?? 'diagnostic', { code: 'log_discontinuity', message: 'Log replaced or truncated; select a fresh cursor' });
        const file = await open(source.log, 'r');
        try {
          const opened = await file.stat();
          if (`${opened.dev}:${opened.ino}` !== identity || opened.size < offset) return await finish(terminalReason ?? 'diagnostic', { code: 'log_discontinuity', message: 'Log changed while opening' });
          if (anchor && offset > 0) {
            const bytes = Buffer.alloc(anchor.length), read = await file.read(bytes,0,bytes.length,offset-bytes.length);
            if (read.bytesRead !== bytes.length || createHash('sha256').update(bytes).digest('hex') !== anchor.hash) return await finish(terminalReason ?? 'diagnostic', { code:'log_discontinuity',message:'Previously observed log bytes were rewritten' });
          }
          if (info.size > offset) {
            let delta;
            try { delta = await scanLog(file,{offset,size:info.size,deadline,signal:wake.signal,pending:pendingLog,task}); }
            catch (error) { return await finish(terminalReason ?? 'diagnostic',{code:'log_discontinuity',message:error.message}); }
            if (delta.offset > offset) lastActivityAt = new Date().toISOString();
            offset = delta.offset; task = delta.task; progressTasks = delta.tasks; progressTotal = delta.count; progressRecords = delta.records;
            pendingLog = delta.pending; anchor = delta.anchor;
            excerpt = (excerpt+delta.excerpt).slice(-2048); excerptOmittedBytes = Math.max(0,offset-from-Buffer.byteLength(excerpt));
          }
        } finally { await file.close(); }
      } catch (error) { return await finish(terminalReason ?? 'access_lost', { code: 'access_lost', message: error.message }); }
      if (leaseError) return await finish('lease_lost',{code:'lease_lost',message:leaseError.message});
      if (signal?.aborted) return await finish('cancelled');
      if (terminalReason) return await finish(terminalReason);
      if (previous && changed) return await finish('transition');
      if (progressTasks.length) return await finish('progress');
      if (Date.now() >= deadline) return await finish('deadline');
      await sleep(Math.min(pollMs, deadline - Date.now()), wake.signal);
    }
  } finally {
    leaseController.abort(); wake.abort(); await leaseTask; signal?.removeEventListener('abort',cancel);
    await releaseCursor(lock,lockPath,token);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [kind, ...args] = process.argv.slice(2), options = {};
    for (let i = 0; i < args.length; i += 2) {
      if (!['--dir','--log','--cursor','--budget-ms','--poll-ms','--host','--repo','--run','--attempt','--sha','--jobs','--artifacts','--steps','--heartbeat'].includes(args[i]) || args[i+1] === undefined) throw new Error('Expected named option and value');
      options[args[i].slice(2)] = args[i+1];
    }
    const controller = new AbortController();
    process.once('SIGINT', () => controller.abort()); process.once('SIGTERM', () => controller.abort());
    const result = await observe({ source: kind === 'runner' ? { kind, dir: options.dir, log: options.log } : { kind,host:options.host,repo:options.repo,run:Number(options.run),attempt:Number(options.attempt),sha:options.sha,jobs:JSON.parse(options.jobs),artifacts:JSON.parse(options.artifacts),steps:options.steps ? JSON.parse(options.steps) : undefined }, cursor: options.cursor,
      budgetMs: options['budget-ms'] === undefined ? undefined : Number(options['budget-ms']), pollMs: options['poll-ms'] === undefined ? undefined : Number(options['poll-ms']), signal: controller.signal, heartbeat: options.heartbeat ? JSON.parse(options.heartbeat) : undefined });
    process.stdout.write(JSON.stringify(result) + '\n');
    if (['access_lost','ownership_unknown','needs_decision','failed','cancelled','diagnostic','lease_lost'].includes(result.reason)) process.exitCode = 1;
  } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
