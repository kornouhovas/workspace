import { execFile } from 'node:child_process';
import { realpathSync } from 'node:fs';

// Only fixed read-only gh commands and the explicitly configured bd heartbeat use
// this transport. No shell, hooks, default repository, or tracker discovery.
export function command(file, args, { timeoutMs, signal } = {}) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { timeout: timeoutMs, signal, maxBuffer: 2 * 1024 * 1024, encoding: 'utf8', windowsHide: true }, (error, stdout, stderr) => {
      if (error) { error.message = `${file} command unavailable: ${stderr || error.message}`; reject(error); }
      else resolve({ status: 0, stdout });
    });
  });
}

export async function request(transport, file, args, deadline, signal) {
  const remaining = Math.floor(deadline - Date.now());
  if (remaining <= 0) throw new Error('Observation deadline reached before command');
  const timeoutMs = Math.min(5000, remaining);
  const controller = new AbortController();
  const cancel = () => controller.abort(); signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) cancel();
  let timer, onAbort;
  try {
    const result = await Promise.race([
      transport(file, args, { timeoutMs, signal: controller.signal }),
      new Promise((_,reject) => { onAbort = () => reject(new Error(`${file} command cancelled`)); controller.signal.addEventListener('abort',onAbort,{once:true}); if(controller.signal.aborted) onAbort(); }),
      new Promise((_, reject) => { timer = setTimeout(() => { reject(new Error(`${file} command timed out`)); controller.abort(); }, timeoutMs); })
    ]);
    if (result?.status !== 0 || typeof result.stdout !== 'string') throw new Error(`${file} command failed (${result?.status ?? 'unknown'})`);
    if (result.stdout.length > 2 * 1024 * 1024) throw new Error(`${file} command output exceeded bound`);
    return result.stdout;
  } finally { clearTimeout(timer); controller.signal.removeEventListener('abort',onAbort); signal?.removeEventListener('abort', cancel); }
}

const strings = (value, label) => {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || !item.trim()) || new Set(value).size !== value.length) throw new Error(`${label} must be a distinct JSON string array`);
  return value;
};
export function ciIdentity(source) {
  if (!/^[a-zA-Z0-9.-]+$/.test(source.host ?? '') || !/^[\w.-]+\/[\w.-]+$/.test(source.repo ?? '')) throw new Error('Explicit CI host/repository required');
  if (!Number.isSafeInteger(source.run) || source.run <= 0 || !Number.isSafeInteger(source.attempt) || source.attempt <= 0 || !/^[a-fA-F0-9]{40}$/.test(source.sha ?? '')) throw new Error('CI requires numeric run, positive attempt and full SHA');
  strings(source.jobs,'jobs'); strings(source.artifacts,'artifacts');
  if (!source.jobs.length) throw new Error('CI requires expected jobs');
  const steps = source.steps ?? {};
  if (!steps || typeof steps !== 'object' || Array.isArray(steps)) throw new Error('steps must be a job-to-step-array JSON object');
  for (const [job,names] of Object.entries(steps)) { if (!source.jobs.includes(job)) throw new Error('Required steps must name an expected job'); strings(names,'steps'); }
  return { kind:'ci',host:source.host,repo:source.repo,run:source.run,attempt:source.attempt,sha:source.sha.toLowerCase(),jobs:source.jobs,artifacts:source.artifacts,steps };
}
const outcome = value => value.status === 'completed' ? (value.conclusion ?? 'unknown') : value.status === 'queued' || value.status === 'waiting' || value.status === 'in_progress' ? value.status : 'unknown';

export async function observeCi(source, { transport = command, deadline, signal } = {}) {
  const identity = ciIdentity(source);
  const get = async args => JSON.parse(await request(transport,'gh',args,deadline,signal));
  const metadata = await get(['api','--hostname',identity.host,'--method','GET',`/repos/${identity.repo}/actions/runs/${identity.run}/attempts/${identity.attempt}`]);
  const view = {databaseId:metadata.id,attempt:metadata.run_attempt,headSha:metadata.head_sha,url:metadata.html_url,status:metadata.status,conclusion:metadata.conclusion};
  const expectedUrl = `https://${identity.host}/${identity.repo}/actions/runs/${identity.run}`;
  if (view.databaseId !== identity.run || view.attempt !== identity.attempt || view.headSha?.toLowerCase() !== identity.sha || (view.url !== expectedUrl && !view.url?.startsWith(`${expectedUrl}/`))) return { identity,state:{status:'unavailable'},reason:'needs_decision',diagnostic:{code:'ci_identity_mismatch'},ownership:'exact_selection',jobs:[],artifacts:[] };
  const pages = async (endpoint, key) => {
    const data = await get(['api','--hostname',identity.host,'--method','GET','--paginate','--slurp',endpoint]);
    if (!Array.isArray(data) || !data.length || data.some(page => !Array.isArray(page[key]))) throw new Error(`Invalid paginated ${key} response`);
    return data.flatMap(page => page[key]);
  };
  const jobsData = await pages(`/repos/${identity.repo}/actions/runs/${identity.run}/attempts/${identity.attempt}/jobs`,'jobs');
  if (jobsData.some(job => !job || !Number.isSafeInteger(job.id) || job.id <= 0 || typeof job.name !== 'string' || !['completed','in_progress','queued','waiting','pending','requested'].includes(job.status) || job.run_id !== identity.run || job.head_sha?.toLowerCase() !== identity.sha || (job.run_attempt !== undefined && job.run_attempt !== identity.attempt))) throw new Error('Job source identity mismatch');
  const jobs = identity.jobs.map(name => {
    const matches = jobsData.filter(job => job.name === name);
    if (matches.length !== 1) return { name,outcome:matches.length ? 'ambiguous' : 'unreached',steps:[],stepsAvailable:false };
    const job = matches[0], steps = Array.isArray(job.steps) ? job.steps.map(step => ({ name:step.name,status:step.status,conclusion:step.conclusion ?? null,outcome:outcome(step) })) : [];
    for (const required of identity.steps[name] ?? []) if (!steps.some(step => step.name === required)) steps.push({name:required,status:'missing',conclusion:null,outcome:'unreached'});
    return { id:job.id,name,status:job.status,conclusion:job.conclusion ?? null,outcome:outcome(job),steps,stepsAvailable:Array.isArray(job.steps) };
  });
  const artifactsData = await pages(`/repos/${identity.repo}/actions/runs/${identity.run}/artifacts`,'artifacts');
  const artifacts = identity.artifacts.map(name => {
    const attemptName = `${name}-run-${identity.run}-attempt-${identity.attempt}`;
    const matches = artifactsData.filter(artifact => artifact.name === attemptName);
    const artifact = matches.length === 1 ? matches[0] : artifactsData.find(item => item.name === name);
    const provenance = artifact?.name === attemptName && artifact.workflow_run?.id === identity.run && artifact.workflow_run?.head_sha?.toLowerCase() === identity.sha;
    return { required:name,id:artifact?.id ?? null,name:artifact?.name ?? null,digest:artifact?.digest ?? null,expired:artifact?.expired ?? null,
      outcome:!artifact ? 'missing' : matches.length > 1 ? 'ambiguous' : typeof artifact.expired !== 'boolean' || !Number.isSafeInteger(artifact.id) || artifact.id <= 0 ? 'invalid_metadata' : artifact.expired ? 'expired' : provenance ? 'verified_metadata' : 'artifact_attempt_unverified' };
  });
  const candidate = view.status === 'completed' && view.conclusion === 'success' && jobs.every(job => job.outcome === 'success' && (identity.steps[job.name] ?? []).every(name => job.steps.filter(step=>step.name===name).length === 1 && job.steps.find(step=>step.name===name).outcome==='success')) && artifacts.every(artifact=>artifact.outcome==='verified_metadata');
  return { identity,state:{status:view.status,conclusion:view.conclusion ?? null,url:view.url,jobs,artifacts,candidate},jobs,artifacts,candidate,ownership:'exact_selection',
    reason:view.status === 'completed' ? (candidate ? 'completed' : 'needs_decision') : undefined };
}

export async function heartbeatConfig(value) {
  if (!value || typeof value.task !== 'string' || !value.task.trim() || typeof value.actor !== 'string' || !value.actor.trim() || !Number.isFinite(value.ttlMs) || value.ttlMs <= 0 || !Number.isFinite(value.intervalMs) || value.intervalMs <= 0 || value.intervalMs >= value.ttlMs) throw new Error('Heartbeat requires explicit task, actor, repository, TTL and interval shorter than TTL');
  return { ...value,repo:realpathSync(value.repo) };
}
export async function heartbeat(value, { transport = command,deadline,signal,verify = false } = {}) {
  const prefix = ['--actor',value.actor,'-C',value.repo,'--sandbox'];
  if (verify) {
    const help = await request(transport,'bd',[...prefix,'heartbeat','--help'],deadline,signal);
    if (!/heartbeat\s+(?:<id>|\[id\]|<issue-id>)/i.test(help) || !/in_progress/.test(help) || !/owner/i.test(help)) throw new Error('Installed bd heartbeat capability unverified');
  }
  await request(transport,'bd',[...prefix,'heartbeat',value.task],deadline,signal);
  return {at:new Date().toISOString(),task:value.task,actor:value.actor,repo:value.repo,status:'renewed'};
}
