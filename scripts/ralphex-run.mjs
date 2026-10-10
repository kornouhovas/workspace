import { execFileSync, spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync, appendFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const templates = fileURLToPath(new URL('../.ralphex/prompts/', import.meta.url));
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const required = (value, label) => { if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required`); return value; };

export function readState(dir) {
  return JSON.parse(readFileSync(join(dir, 'current.json'), 'utf8'));
}

function save(dir, state, event) {
  state.updatedAt = new Date().toISOString();
  appendFileSync(join(dir, 'events.jsonl'), JSON.stringify({ at: state.updatedAt, event, ...state }) + '\n');
  const temporary = join(dir, 'current.json.tmp');
  writeFileSync(temporary, JSON.stringify(state, null, 2) + '\n');
  renameSync(temporary, join(dir, 'current.json'));
  return state;
}

export function initialize(dir, { cwd = process.cwd(), issue, beads, base }) {
  if (existsSync(join(dir, 'current.json'))) throw new Error('Run already initialized; read current.json');
  const worktree = realpathSync(git(cwd, 'rev-parse', '--show-toplevel'));
  const issueBaseSha = git(worktree, 'rev-parse', '--verify', `${required(base, 'base')}^{commit}`);
  git(worktree, 'merge-base', '--is-ancestor', issueBaseSha, 'HEAD');
  required(issue, 'issue'); required(beads, 'beads');
  mkdirSync(dir, { recursive: true });
  return unlocked(dir, () => {
    if (existsSync(join(dir, 'current.json'))) throw new Error('Run already initialized');
    return save(dir, { version: 1, issue, beads, worktree, issueBaseSha, lastReviewedSha: null,
    status: 'ready', phase: null, plan: null, headSha: git(worktree, 'rev-parse', 'HEAD'),
      nextAction: 'Execute the reviewed bounded plan', evidence: [], lastExit: null }, 'initialized');
  });
}

function unlocked(dir, action) {
  const lock = join(dir, 'executor.lock');
  const fd = openSync(lock, 'wx');
  try { writeFileSync(fd, JSON.stringify({ pid: process.pid })); return action(); }
  finally { closeSync(fd); rmSync(lock); }
}

function config(dir, state) {
  const target = join(dir, 'config'); mkdirSync(join(target, 'prompts'), { recursive: true });
  // This is a run-local profile; machine/global settings are never rewritten.
  writeFileSync(join(target, 'config'), 'executor = codex\nplans_dir = docs/plans\n' +
    'codex_model = gpt-6.1-sol\ncodex_reasoning_effort = high\ncodex_sandbox = danger-full-access\n' +
    'plan_model = gpt-6.1-sol:high\ntask_model = gpt-6.1-sol:high\nreview_model = gpt-6.1-sol:high\n' +
    'finalize_enabled = false\nnotify_channels =\nnotify_on_error = false\nnotify_on_complete = false\n');
  for (const [destination, source] of [['task', 'task'], ['review_first', state.lastReviewedSha ? 'review_followup' : 'review_initial'], ['review_second', 'review_followup']]) {
    const prompt = readFileSync(join(templates, `${source}.txt`), 'utf8');
    writeFileSync(join(target, 'prompts', `${destination}.txt`), prompt +
      `\nCoordinator snapshot: ${join(dir, 'current.json')}\nRead this snapshot first; history in events.jsonl is conditional evidence. Executor must not edit coordinator files.\n`);
  }
  return target;
}

export function phase(dir, name, { plan, invoke = spawnSync } = {}) {
  dir = resolve(dir);
  if (!['execute', 'review'].includes(name)) throw new Error('Phase must be execute or review');
  return unlocked(dir, () => {
    const state = readState(dir);
    if (['waiting', 'running'].includes(state.status)) throw new Error(`Run is ${state.status}; inspect the snapshot and owned executor first`);
    const cwd = state.worktree;
    if (git(cwd, 'status', '--porcelain')) throw new Error('Commit or preserve outstanding changes before launching a phase');
    const head = git(cwd, 'rev-parse', 'HEAD');
    const base = name === 'review' ? state.lastReviewedSha ?? state.issueBaseSha : state.issueBaseSha;
    git(cwd, 'merge-base', '--is-ancestor', base, head);
    if (name === 'review' && state.lastReviewedSha === head) return state;
    const selectedPlan = plan ?? state.plan;
    if (name === 'execute' && !selectedPlan) throw new Error('execute requires --plan');
    if (selectedPlan) {
      let file = isAbsolute(selectedPlan) ? selectedPlan : join(cwd, selectedPlan);
      if (!existsSync(file)) file = join(dirname(file), 'completed', basename(file));
      if (!existsSync(file)) throw new Error('Plan does not exist');
      state.plan = file;
    }
    const args = ['--codex', '--base-ref', base, '--config-dir', config(dir, state), '--skip-finalize',
      name === 'execute' ? '--tasks-only' : '--review'];
    if (state.plan) args.push(state.plan);
    state.status = 'running'; state.phase = name; state.headSha = head; state.lastExit = null;
    state.nextAction = `Wait for the owned ${name} process`; save(dir, state, 'started');
    let result;
    try { result = invoke('ralphex', args, { cwd, stdio: 'inherit', env: process.env }); }
    catch { result = { status: null }; }
    const clean = !git(cwd, 'status', '--porcelain');
    state.headSha = git(cwd, 'rev-parse', 'HEAD'); state.lastExit = result.status ?? null;
    let ancestry = true;
    try { git(cwd, 'merge-base', '--is-ancestor', base, state.headSha); }
    catch { ancestry = false; }
    if (state.plan && !existsSync(state.plan)) {
      const archived = join(dirname(state.plan), 'completed', basename(state.plan));
      if (existsSync(archived)) state.plan = archived;
    }
    const succeeded = result.status === 0 && !result.error && clean && ancestry;
    state.status = succeeded ? (name === 'execute' ? 'awaiting_review' : 'awaiting_verification') : 'failed';
    if (succeeded && name === 'review') state.lastReviewedSha = state.headSha;
    state.nextAction = succeeded ? (name === 'execute' ? 'Run the separate review phase' : 'Obtain required platform evidence and coordinator verification') : 'Inspect phase failure; no automatic retry';
    return save(dir, state, 'finished');
  });
}

export function checkpoint(dir, reason, next) {
  required(reason, 'reason'); required(next, 'next action');
  return unlocked(dir, () => {
    const state = readState(dir); state.status = 'waiting'; state.phase = null;
    state.nextAction = `${reason}: ${next}`; return save(dir, state, 'checkpoint');
  });
}

export function resume(dir, evidence, next) {
  required(evidence, 'evidence'); required(next, 'next action');
  return unlocked(dir, () => {
    const state = readState(dir);
    if (state.status !== 'waiting') throw new Error('resume requires a waiting checkpoint');
    state.evidence = [...state.evidence, evidence].slice(-10); state.status = 'ready'; state.nextAction = next;
    return save(dir, state, 'resumed');
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [command, ...args] = process.argv.slice(2); const options = {};
    for (let i = 0; i < args.length; i += 2) {
      if (!/^--(dir|issue|beads|base|plan|reason|next|evidence)$/.test(args[i]) || args[i + 1] === undefined) throw new Error('Expected named option and value');
      options[args[i].slice(2)] = args[i + 1];
    }
    const dir = resolve(required(options.dir, 'dir')); let state;
    if (command === 'init') state = initialize(dir, options);
    else if (['execute', 'review'].includes(command)) state = phase(dir, command, options);
    else if (command === 'wait') state = checkpoint(dir, options.reason, options.next);
    else if (command === 'resume') state = resume(dir, options.evidence, options.next);
    else if (command === 'show') state = readState(dir);
    else throw new Error('Use init, execute, review, wait, resume or show');
    process.stdout.write(JSON.stringify(state, null, 2) + '\n');
    if (state.status === 'failed') process.exitCode = 1;
  } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
