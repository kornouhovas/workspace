import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { initialize, phase, checkpoint, resume, readState } from '../scripts/ralphex-run.mjs';

function assertSameFile(actual, expected) {
  const identity = (path) => { const { dev, ino } = statSync(path, { bigint: true }); return { dev, ino }; };
  assert.deepEqual(identity(actual), identity(expected));
}

function fixture(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'workspace-ralphex-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-q'); git('config', 'user.email', 'fixture@example.invalid'); git('config', 'user.name', 'Fixture');
  writeFileSync(join(root, '.gitignore'), 'work/\n');
  mkdirSync(join(root, 'docs')); writeFileSync(join(root, 'docs/plan.md'), '### Task 1: Example\n- [ ] Implement\n');
  git('add', '.'); git('commit', '-qm', 'fixture');
  const dir = join(root, 'work/run');
  const state = initialize(dir, { cwd: root, issue: 'https://github.com/example/project/issues/1', beads: 'example-1', base: git('rev-parse', 'HEAD') });
  return { root, dir, git, state };
}

test('execute runs only tasks and a failed executor never advances review evidence', (t) => {
  const f = fixture(t); let calls = 0; let captured;
  const result = phase(f.dir, 'execute', { plan: 'docs/plan.md', invoke(command, args, options) {
    calls++; captured = { command, args, cwd: options.cwd }; return { status: 1 };
  } });
  assert.equal(captured.command, 'ralphex'); assert.ok(captured.args.includes('--tasks-only')); assert.ok(!captured.args.includes('--review'));
  assert.equal(captured.args[captured.args.indexOf('--base-ref') + 1], f.state.issueBaseSha); assertSameFile(captured.cwd, f.root);
  assert.equal(result.status, 'failed'); assert.equal(calls, 1);
  assert.equal(readState(f.dir).lastReviewedSha, null);
});

test('successful review records its actual commit; follow-up compares only the new delta', (t) => {
  const f = fixture(t); let base;
  phase(f.dir, 'execute', { plan: 'docs/plan.md', invoke: () => ({ status: 0 }) });
  phase(f.dir, 'review', { invoke(command, args) {
    assert.ok(args.includes('--review')); assert.ok(!args.includes('--tasks-only'));
    base = args[args.indexOf('--base-ref') + 1]; return { status: 0 };
  } });
  const reviewed = readState(f.dir).lastReviewedSha; assert.equal(reviewed, f.git('rev-parse', 'HEAD')); assert.equal(base, f.state.issueBaseSha);
  phase(f.dir, 'review', { invoke: () => assert.fail('unchanged reviewed HEAD must reuse its receipt') });
  writeFileSync(join(f.root, 'change.txt'), 'new delta'); f.git('add', '.'); f.git('commit', '-qm', 'change');
  phase(f.dir, 'review', { invoke(command, args) {
    assert.equal(args[args.indexOf('--base-ref') + 1], reviewed);
    const config = args[args.indexOf('--config-dir') + 1];
    const prompt = readFileSync(join(config, 'prompts/review_first.txt'), 'utf8');
    assert.ok(prompt.includes('{{agent:quality}}')); assert.ok(!prompt.includes('{{agent:testing}}'));
    return { status: 0 };
  } });
  assert.equal(readState(f.dir).issueBaseSha, f.state.issueBaseSha);
  assert.equal(readState(f.dir).lastReviewedSha, f.git('rev-parse', 'HEAD'));
});

test('Ralphex plan archival is retained in the snapshot for the separate review phase', (t) => {
  const f = fixture(t);
  phase(f.dir, 'execute', { plan: 'docs/plan.md', invoke() {
    mkdirSync(join(f.root, 'docs/completed')); f.git('mv', 'docs/plan.md', 'docs/completed/plan.md');
    f.git('commit', '-qm', 'archive'); return { status: 0 };
  } });
  assertSameFile(readState(f.dir).plan, join(f.root, 'docs/completed/plan.md'));
  let captured;
  phase(f.dir, 'review', { invoke(command, args) { captured = args; return { status: 0 }; } });
  assert.ok(captured.includes(readState(f.dir).plan));
});

test('a signaled executor or rewritten Git ancestry cannot advance the review receipt', (t) => {
  const f = fixture(t);
  const interrupted = phase(f.dir, 'review', { invoke: () => ({ status: null, signal: 'SIGTERM' }) });
  assert.equal(interrupted.status, 'failed'); assert.equal(interrupted.lastExit, null);
  assert.equal(interrupted.lastReviewedSha, null);
  const rewritten = phase(f.dir, 'review', { invoke() {
    f.git('checkout', '--orphan', 'rewritten');
    f.git('commit', '-qm', 'unrelated root'); return { status: 0 };
  } });
  assert.equal(rewritten.status, 'failed'); assert.equal(rewritten.lastReviewedSha, null);
  assert.equal(rewritten.issueBaseSha, f.state.issueBaseSha);
});

test('waiting is a coordinator state: no executor, no automatic retry, explicit evidence to resume', (t) => {
  const f = fixture(t);
  checkpoint(f.dir, 'Await Windows receipt', 'Inspect CI result');
  assert.equal(readState(f.dir).status, 'waiting');
  assert.throws(() => phase(f.dir, 'review', { invoke: () => assert.fail('must not launch') }), /waiting/);
  assert.throws(() => resume(f.dir, '', 'Inspect result'), /evidence/);
  resume(f.dir, 'https://example.invalid/ci/1', 'Review the corrected delta');
  const state = readState(f.dir); assert.equal(state.status, 'ready'); assert.equal(state.evidence.length, 1);
  assert.equal(state.lastReviewedSha, null);
  assert.equal(readFileSync(join(f.dir, 'events.jsonl'), 'utf8').trim().split('\n').length, 3);
});

test('dirty review results, concurrent executor locks and foreign bases cannot produce a clean review receipt', (t) => {
  const f = fixture(t);
  const result = phase(f.dir, 'review', { invoke() { writeFileSync(join(f.root, 'uncommitted.txt'), 'dirty'); return { status: 0 }; } });
  assert.equal(result.status, 'failed'); assert.equal(result.lastReviewedSha, null);
  rmSync(join(f.root, 'uncommitted.txt'));
  writeFileSync(join(f.dir, 'executor.lock'), 'owned');
  assert.throws(() => phase(f.dir, 'review', { invoke: () => assert.fail('locked') }), /EEXIST/);
  rmSync(join(f.dir, 'executor.lock'));
  assert.throws(() => initialize(join(f.root, 'work/other'), { cwd: f.root, issue: 'x', beads: 'y', base: '0'.repeat(40) }));
});

test('launch identities remain distinct and a replaced lock is never removed or accepted', (t) => {
  const f = fixture(t); let first;
  assert.match(f.state.runId, /^[a-f0-9-]{36}$/);
  phase(f.dir, 'execute', { plan: 'docs/plan.md', invoke() {
    const state = readState(f.dir), lock = JSON.parse(readFileSync(join(f.dir, 'executor.lock')));
    first = state.executionId; assert.equal(lock.executionId, first); assert.equal(lock.runId, f.state.runId);
    assert.equal(lock.runDirectory, f.dir); return { status: 0 };
  } });
  assert.throws(() => phase(f.dir, 'review', { invoke() {
    assert.notEqual(readState(f.dir).executionId, first);
    writeFileSync(join(f.dir, 'executor.lock'), JSON.stringify({ pid: process.pid, token: 'foreign' })); return { status: 0 };
  } }), /ownership/);
  assert.equal(JSON.parse(readFileSync(join(f.dir, 'executor.lock'))).token, 'foreign');
  assert.equal(readState(f.dir).status, 'running');
});

test('a fresh launch does not carry an earlier phase signal or launch error',t=>{
  const f=fixture(t);phase(f.dir,'review',{invoke:()=>({status:null,signal:'SIGTERM',error:new Error('earlier launch')})});
  phase(f.dir,'review',{invoke(){const running=readState(f.dir);assert.equal(running.lastSignal,null);assert.equal(running.lastError,null);return{status:0};}});
  assert.equal(readState(f.dir).status,'awaiting_verification');
});

for (const failure of [{status:9},{status:null,signal:'SIGTERM',error:new Error('launch failed')}]) test(`unchanged reviewed HEAD cannot erase subsequent failed execution (${failure.status ?? failure.signal})`,t=>{
  const f=fixture(t);
  phase(f.dir,'execute',{plan:'docs/plan.md',invoke:()=>({status:0})});phase(f.dir,'review',{invoke:()=>({status:0})});
  const failed=phase(f.dir,'execute',{invoke:()=>failure}),state=readFileSync(join(f.dir,'current.json'),'utf8'),history=readFileSync(join(f.dir,'events.jsonl'),'utf8');
  const reused=phase(f.dir,'review',{invoke:()=>assert.fail('receipt reuse must not launch')});
  assert.equal(reused.status,'failed');assert.equal(reused.lastExit,failure.status);assert.equal(reused.executionId,failed.executionId);
  assert.equal(reused.lastSignal,failure.signal ?? null);assert.equal(reused.lastError,failure.error?.message ?? null);
  assert.equal(readFileSync(join(f.dir,'current.json'),'utf8'),state);assert.equal(readFileSync(join(f.dir,'events.jsonl'),'utf8'),history);
});
