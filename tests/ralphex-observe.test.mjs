import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { initialize, readState } from '../scripts/ralphex-run.mjs';
import { mkdtempSync, mkdirSync, openSync, closeSync, ftruncateSync, writeFileSync, readFileSync, rmSync, appendFileSync, renameSync, realpathSync, symlinkSync, linkSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import fsPromises, { readFile as builtinReadFile, realpath as builtinRealpath } from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { observe } from '../scripts/ralphex-observe.mjs';

function fixture(t, { cleanup = true } = {}) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'ralphex-observe-')));
  if (cleanup) t.after(() => rmSync(dir, { recursive: true, force: true }));
  const state = { version: 1, runId: 'fixture-run', executionId: 'fixture-execution', runDirectory: dir, worktree: dir, status: 'running', phase: 'execute', lastExit: null, nextAction: 'Wait' };
  const lock = { pid: process.pid, token: 'fixture-token', runId: state.runId, executionId: state.executionId, runDirectory: dir, worktree: dir };
  writeFileSync(join(dir, 'current.json'), JSON.stringify(state));
  writeFileSync(join(dir, 'executor.lock'), JSON.stringify(lock));
  const log = join(dir, 'full.log'); writeFileSync(log, '');
  const options = { source: { kind: 'runner', dir, log }, cursor: join(dir, 'observer.json'), budgetMs: 90, pollMs: 10 };
  return { dir, state, lock, log, options, save() { const temp = join(dir, 'snapshot.tmp'); writeFileSync(temp, JSON.stringify(state)); renameSync(temp, join(dir, 'current.json')); } };
}

// Return the same controlled identities through either stat representation, so
// public observe regressions expose Number rounding without a private hook.
async function withStatIdentities(identities, check) {
  const original = fsPromises.stat, seen = new Set();
  fsPromises.stat = async (file, options) => {
    const info = await original(file, options), identity = identities.get(file);
    if (!identity) return info;
    seen.add(file);
    const copy = Object.assign(Object.create(Object.getPrototypeOf(info)), info);
    for (const key of ['dev', 'ino']) copy[key] = options?.bigint ? identity[key] : Number(identity[key]);
    return copy;
  };
  try { syncBuiltinESMExports(); await check(); }
  finally {
    fsPromises.stat = original; syncBuiltinESMExports();
    assert.deepEqual(seen, new Set(identities.keys()), 'both controlled stat identities were read');
  }
}

test('distinct full-width inode IDs preserve foreign cursor-lock EEXIST refusal', async t => {
  const f = fixture(t), foreign = `${f.options.cursor}.lock`, snapshot = join(f.dir, 'current.json');
  writeFileSync(foreign, 'retained foreign observer lock');
  const paths = [snapshot, join(f.dir, 'executor.lock'), f.log, foreign];
  const before = paths.map(file => readFileSync(file)), entries = readdirSync(f.dir).sort();
  const first = 9007199254740992n, second = 9007199254740993n;
  assert.notEqual(first, second); assert.equal(Number(first), Number(second));
  await withStatIdentities(new Map([
    [snapshot, { dev: 1n, ino: first }], [foreign, { dev: 1n, ino: second }],
  ]), async () => {
    await assert.rejects(observe(f.options), { code: 'EEXIST' });
    assert.deepEqual(paths.map(file => readFileSync(file)), before);
    assert.deepEqual(readdirSync(f.dir).sort(), entries);
  });
});

for (const key of ['runId', 'executionId', 'dir', 'worktree', 'log']) {
  test(`distinct full-width inode IDs reach terminal publication with foreign cursor ${key}`, async t => {
    const f = fixture(t); f.state.beads = 'fixture-task'; f.save(); await observe(f.options);
    writeFileSync(join(f.dir, 'events.jsonl'), 'retained runner events\n');
    const saved = JSON.parse(readFileSync(f.options.cursor)); saved.source[key] = 'foreign';
    writeFileSync(f.options.cursor, JSON.stringify(saved));
    const before = readFileSync(f.options.cursor), foreign = join(f.dir, 'foreign-observer.json.lock');
    writeFileSync(foreign, 'retained foreign observer lock');
    const foreignBefore = readFileSync(foreign);
    await withStatIdentities(new Map([
      [join(f.dir, 'current.json'), { dev: 1n, ino: 9007199254740992n }],
      [f.options.cursor, { dev: 1n, ino: 9007199254740993n }],
    ]), async () => {
      await withSnapshotPublication(f, () => {
        f.state.status = 'failed'; f.state.lastExit = 9; f.save(); rmSync(join(f.dir, 'executor.lock'));
      }, async reads => {
        let calls = 0;
        const result = await observe({ ...f.options,
          heartbeat: { task: 'fixture-task', actor: 'fixture-owner', repo: f.dir, ttlMs: 400, intervalMs: 100 },
          command: async () => { calls++; throw new Error('Foreign cursor must never reach transport'); } });
        assert.equal(result.reason, 'needs_decision'); assert.equal(result.diagnostic.code, 'source_mismatch');
        assert.equal(reads(), 1); assert.equal(calls, 0);
        assert.deepEqual(readFileSync(f.options.cursor), before);
        assert.deepEqual(readFileSync(foreign), foreignBefore);
        assert.throws(() => readFileSync(`${f.options.cursor}.lock`), { code: 'ENOENT' });
      });
    });
  });
}

for (const differentDevice of [false, true]) {
  test(`equal full-width inode IDs require complete device identity (differentDevice=${differentDevice})`, async t => {
    const f = fixture(t), snapshot = join(f.dir, 'current.json');
    writeFileSync(f.options.cursor, 'retained output');
    const paths = [snapshot, f.options.cursor, join(f.dir, 'executor.lock'), f.log];
    const before = paths.map(file => readFileSync(file)), entries = readdirSync(f.dir).sort();
    await withStatIdentities(new Map([
      [snapshot, { dev: 9007199254740992n, ino: 9007199254740993n }],
      [f.options.cursor, { dev: differentDevice ? 9007199254740993n : 9007199254740992n, ino: 9007199254740993n }],
    ]), async () => {
      if (differentDevice) {
        const result = await observe(f.options);
        assert.equal(result.reason, 'needs_decision'); assert.equal(result.diagnostic.code, 'cursor_invalid');
      } else await assert.rejects(observe(f.options), /observer-owned/);
      assert.deepEqual(paths.map(file => readFileSync(file)), before);
      assert.deepEqual(readdirSync(f.dir).sort(), entries);
    });
  });
}

test('output validation propagates non-ENOENT stat errors before creating observer outputs', async t => {
  for (const target of ['current.json', 'observer.json']) for (const code of ['EACCES', 'EIO']) {
    const f = fixture(t), original = fsPromises.stat, failure = Object.assign(new Error('Controlled stat failure'), { code });
    const paths = [join(f.dir, 'current.json'), join(f.dir, 'executor.lock'), f.log];
    const before = paths.map(file => readFileSync(file)), entries = readdirSync(f.dir).sort();
    fsPromises.stat = async (...args) => { if (args[0] === join(f.dir, target)) throw failure; return original(...args); };
    try { syncBuiltinESMExports(); await assert.rejects(observe(f.options), error => error === failure); }
    finally { fsPromises.stat = original; syncBuiltinESMExports(); }
    assert.deepEqual(paths.map(file => readFileSync(file)), before);
    assert.deepEqual(readdirSync(f.dir).sort(), entries);
  }
});

test('real file symlinks cannot alias reserved inputs through cursor or derived lock', async t => {
  for (const derived of [false, true]) {
    const f = fixture(t), snapshot = join(f.dir, 'current.json'), output = `${f.options.cursor}${derived ? '.lock' : ''}`;
    symlinkSync(snapshot, output, 'file');
    const before = readFileSync(snapshot), entries = readdirSync(f.dir).sort();
    await assert.rejects(observe(f.options), /observer-owned/);
    assert.deepEqual(readFileSync(snapshot), before); assert.deepEqual(readdirSync(f.dir).sort(), entries);
  }
});

test('version-1 cursor continuation retains Number log stat and file.stat identity semantics', async t => {
  const f = fixture(t), originalStat = fsPromises.stat, originalOpen = fsPromises.open;
  let validations = 0, logStats = 0, handleStats = 0;
  const logInfo = info => Object.assign(Object.create(Object.getPrototypeOf(info)), info,
    { dev: 1, ino: Number(9007199254740993n) });
  fsPromises.stat = async (file, options) => {
    const info = await originalStat(file, options);
    if (file !== f.log) return info;
    if (options?.bigint) { validations++; return info; }
    assert.equal(options, undefined); logStats++; return logInfo(info);
  };
  fsPromises.open = async (...args) => {
    const handle = await originalOpen(...args);
    if (args[0] === f.log) {
      const original = handle.stat.bind(handle);
      handle.stat = async options => {
        assert.equal(options, undefined); handleStats++; return logInfo(await original(options));
      };
    }
    return handle;
  };
  try {
    syncBuiltinESMExports();
    appendFileSync(f.log, 'RALPHEX_PROGRESS {"task":"Before continuation"}\n');
    const first = await observe(f.options);
    assert.equal(first.reason, 'progress');
    const saved = JSON.parse(readFileSync(f.options.cursor));
    assert.equal(saved.version, 1); assert.equal(saved.logIdentity, '1:9007199254740992');
    appendFileSync(f.log, 'RALPHEX_PROGRESS {"task":"After continuation"}\n');
    const second = await observe(f.options);
    assert.equal(second.reason, 'progress'); assert.equal(second.task, 'After continuation');
    assert.equal(second.log.from, first.log.to); assert.equal(second.log.to, readFileSync(f.log).length);
    assert.equal(JSON.parse(readFileSync(f.options.cursor)).logIdentity, saved.logIdentity);
    assert.equal(validations, 2); assert.equal(logStats, 2); assert.equal(handleStats, 2);
  } finally { fsPromises.stat = originalStat; fsPromises.open = originalOpen; syncBuiltinESMExports(); }
});

// Publish between the snapshot read and the ownership read, without a private
// observer hook. All other filesystem reads still use the real implementation.
// Freeze host time before observe establishes its deadline; only the expiration
// control advances it. These global mocks are scoped to sequential tests.
async function withSnapshotPublication(f, publish, check, { advanceMs = 0 } = {}) {
  const original = fsPromises.readFile, snapshot = join(f.dir, 'current.json');
  const originalNow = Date.now;
  let now = originalNow();
  let reads = 0, reached = false, published;
  fsPromises.readFile = async (...args) => {
    const selected = args[0] === snapshot;
    if (selected) reads++;
    const bytes = await original(...args);
    if (selected && reads === 1) {
      assert.equal(JSON.parse(bytes).status, 'running');
      publish(); reached = true;
      now += advanceMs;
      published = ['current.json', 'events.jsonl', 'full.log', 'executor.lock'].map(file => {
        try { return readFileSync(join(f.dir, file)); } catch (error) { if (error.code !== 'ENOENT') throw error; return null; }
      });
    }
    return bytes;
  };
  try {
    Date.now = () => now;
    syncBuiltinESMExports();
    await check(() => reads);
  }
  finally {
    Date.now = originalNow; fsPromises.readFile = original; syncBuiltinESMExports();
    assert.ok(reached, 'snapshot/lock publication interleaving was reached');
    assert.deepEqual(['current.json', 'events.jsonl', 'full.log', 'executor.lock'].map(file => {
      try { return readFileSync(join(f.dir, file)); } catch (error) { if (error.code !== 'ENOENT') throw error; return null; }
    }), published, 'observer preserves published runner inputs and never performs cleanup');
  }
}

test('same-execution terminal publication after a retained running read reports failure', async t => {
  const f = fixture(t);
  writeFileSync(join(f.dir, 'events.jsonl'), 'retained runner events\n');
  await withSnapshotPublication(f, () => {
    f.state.status = 'failed'; f.state.lastExit = 9; f.state.lastSignal = 'SIGTERM'; f.save();
    rmSync(join(f.dir, 'executor.lock'));
  }, async reads => {
    const result = await observe(f.options);
    assert.equal(result.reason, 'failed'); assert.equal(result.status, 'failed');
    assert.equal(result.exit, 9); assert.equal(result.signal, 'SIGTERM');
    assert.equal(result.ownership, 'identified'); assert.equal(result.acceptance, 'not_established');
    assert.deepEqual(result.source, { kind: 'runner', dir: f.dir, log: f.log,
      runId: 'fixture-run', executionId: 'fixture-execution', worktree: f.dir });
    assert.equal(reads(), 2, 'one bounded consistency reread');
  });
});

test('expired publication budget retains running ownership uncertainty without reread or heartbeat', async t => {
  const f = fixture(t); f.state.beads = 'fixture-task'; f.save();
  writeFileSync(join(f.dir, 'events.jsonl'), 'retained runner events\n');
  const unrelatedLock = join(f.dir, 'unrelated-observer.json.lock');
  writeFileSync(unrelatedLock, 'retained foreign observer lock');
  const before = readFileSync(unrelatedLock);
  await withSnapshotPublication(f, () => {
    f.state.status = 'failed'; f.state.lastExit = 9; f.save();
    rmSync(join(f.dir, 'executor.lock'));
  }, async reads => {
    let calls = 0;
    const result = await observe({ ...f.options,
      heartbeat: { task: 'fixture-task', actor: 'fixture-owner', repo: f.dir, ttlMs: 400, intervalMs: 100 },
      command: async () => { calls++; throw new Error('Expired ownership must never reach transport'); } });
    assert.equal(reads(), 1); assert.equal(calls, 0);
    assert.equal(result.reason, 'ownership_unknown'); assert.equal(result.status, 'running');
    assert.equal(result.ownership, 'unknown'); assert.equal(result.acceptance, 'not_established');
    assert.deepEqual(result.source, { kind: 'runner', dir: f.dir, log: f.log,
      runId: 'fixture-run', executionId: 'fixture-execution', worktree: f.dir });
    assert.equal(result.elapsedMs, 1000);
    const cursor = JSON.parse(readFileSync(f.options.cursor));
    assert.deepEqual(cursor.source, result.source);
    assert.equal(JSON.parse(cursor.fingerprint).status, 'running');
    assert.throws(() => readFileSync(`${f.options.cursor}.lock`), { code: 'ENOENT' });
    assert.deepEqual(readFileSync(unrelatedLock), before);
  }, { advanceMs: 1000 });
});

test('publication mocks restore host time and filesystem reads after a failed check', async t => {
  const f = fixture(t), originalNow = Date.now, originalRead = fsPromises.readFile;
  const failure = new Error('Fixture check failure');
  await assert.rejects(withSnapshotPublication(f, () => {
    f.state.status = 'failed'; f.save(); rmSync(join(f.dir, 'executor.lock'));
  }, async () => { await observe(f.options); throw failure; }), error => error === failure);
  assert.equal(Date.now, originalNow); assert.equal(fsPromises.readFile, originalRead);
  assert.equal((await observe({ ...f.options, cursor: join(f.dir, 'restored-observer.json') })).reason, 'failed');
});

test('identified running ownership does not trigger a terminal consistency reread', async t => {
  const f = fixture(t); writeFileSync(join(f.dir, 'events.jsonl'), 'retained runner events\n');
  appendFileSync(f.log, 'RALPHEX_PROGRESS {"task":"Identified control"}\n');
  await withSnapshotPublication(f, () => {}, async reads => {
    const result = await observe(f.options);
    assert.equal(result.reason, 'progress'); assert.equal(result.ownership, 'identified');
    assert.equal(reads(), 1);
  });
});

test('denied PID probes retain uncertain running ownership after the bounded reread', async t => {
  const f = fixture(t); f.state.beads = 'fixture-task'; f.save();
  writeFileSync(join(f.dir, 'events.jsonl'), 'retained runner events\n');
  const original = process.kill;
  process.kill = (pid, signal) => {
    if (pid === f.lock.pid && signal === 0) throw Object.assign(new Error('Fixture probe denied'), { code: 'EPERM' });
    return original(pid, signal);
  };
  try {
    await withSnapshotPublication(f, () => {}, async reads => {
      let calls = 0;
      const result = await observe({ ...f.options,
        heartbeat: { task: 'fixture-task', actor: 'fixture-owner', repo: f.dir, ttlMs: 400, intervalMs: 100 },
        command: async () => { calls++; throw new Error('Denied probe must never reach transport'); } });
      assert.equal(result.reason, 'ownership_unknown'); assert.equal(result.ownership, 'unknown');
      assert.equal(reads(), 2); assert.equal(calls, 0);
    });
  } finally { process.kill = original; }
});

test('same-execution terminal publication preserves bound cursor and selected alias byte continuity', async t => {
  const f = fixture(t), alias = join(f.dir, 'terminal-alias');
  symlinkSync(f.dir, alias, process.platform === 'win32' ? 'junction' : 'dir');
  writeFileSync(join(f.dir, 'events.jsonl'), 'retained runner events\n');
  appendFileSync(f.log, 'before terminal\n');
  const first = await observe(f.options), from = readFileSync(f.log).length;
  appendFileSync(f.log, 'terminal output\n');
  await withSnapshotPublication(f, () => {
    f.state.status = 'failed'; f.state.lastExit = null; f.state.lastSignal = 'SIGKILL'; f.save();
    rmSync(join(f.dir, 'executor.lock'));
  }, async reads => {
    const result = await observe({ ...f.options, source: { kind: 'runner', dir: alias, log: join(alias, 'full.log') } });
    assert.equal(result.reason, 'failed'); assert.equal(result.exit, null); assert.equal(result.signal, 'SIGKILL');
    assert.deepEqual(result.source, first.source); assert.equal(result.log.path, f.log);
    assert.equal(result.log.from, from); assert.equal(result.log.to, readFileSync(f.log).length);
    assert.equal(reads(), 2);
    assert.equal(JSON.parse(readFileSync(f.options.cursor)).source.executionId, 'fixture-execution');
    assert.throws(() => readFileSync(`${f.options.cursor}.lock`), { code: 'ENOENT' });
  });
});

test('terminal consistency reread rejects foreign and invalid publications without heartbeat or runner cleanup', async t => {
  for (const [key, value] of [
    ['executionId', 'foreign-execution'], ['runId', 'foreign-run'],
    ['runDirectory', 'foreign-directory'], ['worktree', 'foreign-worktree'],
    ['runDirectory', undefined], ['version', 99], ['status', 'running'],
    ['status', 'unknown'], ['status', undefined], ['malformed', true], ['removed', true],
  ]) {
    const f = fixture(t); f.state.beads = 'fixture-task'; f.save();
    writeFileSync(join(f.dir, 'events.jsonl'), 'retained runner events\n');
    await withSnapshotPublication(f, () => {
      f.state.status = 'failed'; f.state.lastExit = 9; f.state[key] = value; f.save();
      if (key === 'malformed') writeFileSync(join(f.dir, 'current.json'), '{');
      if (key === 'removed') rmSync(join(f.dir, 'current.json'));
      rmSync(join(f.dir, 'executor.lock'));
    }, async reads => {
      let calls = 0;
      const result = await observe({ ...f.options,
        heartbeat: { task: 'fixture-task', actor: 'fixture-owner', repo: f.dir, ttlMs: 400, intervalMs: 100 },
        command: async () => { calls++; throw new Error('Unresolved ownership must never reach transport'); } });
      assert.equal(result.reason, 'ownership_unknown', `${key}=${value}`);
      assert.equal(result.status, 'running'); assert.equal(result.ownership, 'unknown');
      assert.equal(result.source.runId, 'fixture-run'); assert.equal(result.source.executionId, 'fixture-execution');
      assert.equal(calls, 0); assert.equal(reads(), 2);
      assert.throws(() => readFileSync(`${f.options.cursor}.lock`), { code: 'ENOENT' });
    });
  }
});

test('terminal consistency reread keeps invocation and cursor identity mismatch fail closed', async t => {
  for (const key of ['runId', 'executionId', 'dir', 'worktree', 'log']) {
    const f = fixture(t); f.state.beads = 'fixture-task'; f.save(); await observe(f.options);
    writeFileSync(join(f.dir, 'events.jsonl'), 'retained runner events\n');
    const saved = JSON.parse(readFileSync(f.options.cursor)); saved.source[key] = 'foreign';
    writeFileSync(f.options.cursor, JSON.stringify(saved));
    const before = readFileSync(f.options.cursor);
    await withSnapshotPublication(f, () => {
      f.state.status = 'failed'; f.state.lastExit = 9; f.save(); rmSync(join(f.dir, 'executor.lock'));
    }, async reads => {
      let calls = 0;
      const result = await observe({ ...f.options,
        heartbeat: { task: 'fixture-task', actor: 'fixture-owner', repo: f.dir, ttlMs: 400, intervalMs: 100 },
        command: async () => { calls++; throw new Error('Foreign cursor must never reach transport'); } });
      assert.equal(result.reason, 'needs_decision'); assert.equal(result.diagnostic.code, 'source_mismatch');
      assert.equal(reads(), 1); assert.equal(calls, 0);
      assert.deepEqual(readFileSync(f.options.cursor), before);
    });
  }
});

test('uncertain still-running ownership gets one reread and preserves lock with zero heartbeat transport', async t => {
  const child = spawn(process.execPath, ['-e', 'process.exit(0)'], { stdio: 'ignore' }), deadPid = child.pid;
  await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
  for (const [key, value] of [
    ['lock', undefined], ['pid', undefined], ['pid', deadPid], ['pid', 0], ['pid', 'invalid'],
    ['token', undefined], ['token', ''], ['runId', 'foreign'], ['executionId', 'foreign'],
    ['runDirectory', 'foreign'], ['worktree', 'foreign'],
  ]) {
    const f = fixture(t); f.state.beads = 'fixture-task'; f.save();
    writeFileSync(join(f.dir, 'events.jsonl'), 'retained runner events\n');
    await withSnapshotPublication(f, () => {
      if (key === 'lock') rmSync(join(f.dir, 'executor.lock'));
      else { f.lock[key] = value; writeFileSync(join(f.dir, 'executor.lock'), JSON.stringify(f.lock)); }
    }, async reads => {
      let calls = 0;
      const result = await observe({ ...f.options,
        heartbeat: { task: 'fixture-task', actor: 'fixture-owner', repo: f.dir, ttlMs: 400, intervalMs: 100 },
        command: async () => { calls++; throw new Error('Uncertain ownership must never reach transport'); } });
      assert.equal(result.reason, 'ownership_unknown', `${key}=${value}`);
      assert.equal(result.status, 'running'); assert.equal(result.ownership, 'unknown');
      assert.equal(calls, 0); assert.equal(reads(), 2);
      assert.throws(() => readFileSync(`${f.options.cursor}.lock`), { code: 'ENOENT' });
    });
  }
});

test('synchronously published runner identities retain ownership and byte continuation through selected directory aliases', async t => {
  const f = fixture(t), alias = join(f.dir, 'selected-alias');
  symlinkSync(f.dir, alias, process.platform === 'win32' ? 'junction' : 'dir');
  const files = ['current.json', 'executor.lock', 'full.log'];
  const before = files.map(file => readFileSync(join(f.dir, file)));
  const options = { ...f.options, source: { kind: 'runner', dir: alias, log: join(alias, 'full.log') }, cursor: join(alias, 'observer.json') };
  const quiet = await observe(options);
  assert.equal(quiet.reason, 'deadline'); assert.equal(quiet.ownership, 'identified');
  assert.equal(quiet.source.dir, f.state.runDirectory);
  assert.equal(quiet.source.log, realpathSync(f.log));
  assert.equal(quiet.log.path, realpathSync(f.log));
  assert.deepEqual(files.map(file => readFileSync(join(f.dir, file))), before);
  const saved = JSON.parse(readFileSync(f.options.cursor, 'utf8'));
  assert.deepEqual(saved.source, quiet.source);
  assert.equal(saved.offset, 0);
  appendFileSync(f.log, 'RALPHEX_PROGRESS {"task":"Task canonical control"}\n');
  const log = readFileSync(f.log), progress = await observe(f.options);
  assert.equal(progress.reason, 'progress'); assert.equal(progress.ownership, 'identified');
  assert.equal(progress.task, 'Task canonical control');
  assert.deepEqual(progress.source, quiet.source);
  assert.equal(progress.log.from, 0); assert.equal(progress.log.to, log.length);
  const continued = await observe(options);
  assert.equal(continued.reason, 'deadline'); assert.equal(continued.ownership, 'identified');
  assert.equal(continued.progressTotal, 0); assert.equal(continued.log.from, log.length);
  assert.equal(continued.log.to, log.length);
  assert.deepEqual(files.slice(0, 2).map(file => readFileSync(join(f.dir, file))), before.slice(0, 2));
  assert.deepEqual(readFileSync(f.log), log);
});

// Scope global mocks to sequential public-observer tests. Read real snapshot
// bytes before advancing time, so setup/help/renewal never consume host time.
async function withHeartbeatAlias(f, check, { helpAdvanceMs = 0, renewalStatus = 0 } = {}) {
  const alias = join(f.dir, 'heartbeat-alias');
  symlinkSync(f.dir, alias, process.platform === 'win32' ? 'junction' : 'dir');
  f.state.beads = 'fixture-task'; f.save();
  writeFileSync(join(f.dir, 'events.jsonl'), 'retained runner events\n');
  const files = ['current.json', 'executor.lock', 'events.jsonl', 'full.log'];
  const before = files.map(file => readFileSync(join(f.dir, file)));
  const originalNow = Date.now, originalRead = fsPromises.readFile, originalRealpath = fsPromises.realpath;
  const start = originalNow(), calls = [];
  let now = start, snapshots = 0;
  try {
    Date.now = () => now;
    fsPromises.readFile = async (...args) => {
      const bytes = await originalRead(...args);
      if (args[0] === join(f.dir, 'current.json') && ++snapshots === 2) now = start + f.options.budgetMs;
      return bytes;
    };
    // Model the retained Windows sync/async string inequality for this alias only.
    fsPromises.realpath = async (...args) => args[0] === alias ? (await originalRealpath(...args), alias) : originalRealpath(...args);
    syncBuiltinESMExports();
    assert.equal(await fsPromises.realpath(alias), alias);
    assert.equal(realpathSync(alias), f.state.worktree);
    assert.notEqual(await fsPromises.realpath(alias), realpathSync(alias));
    assert.equal(f.options.budgetMs, 90, 'retain the original observation budget');
    const command = async (file, args, { timeoutMs }) => {
      assert.equal(Date.now(), start, 'capability verification and renewal run before controlled expiry');
      assert.equal(timeoutMs, 90, 'retain the production request deadline');
      assert.equal(file, 'bd');
      assert.deepEqual(args.slice(0, 5), ['--actor', 'fixture-owner', '-C', f.state.worktree, '--sandbox']);
      const help = args.at(-1) === '--help';
      assert.deepEqual(args.slice(5), ['heartbeat', help ? '--help' : 'fixture-task']);
      calls.push(args);
      if (help) now += helpAdvanceMs;
      return { status: help ? 0 : renewalStatus, stdout: 'Usage: bd heartbeat <id> Only the current in_progress owner may refresh.' };
    };
    const options = { ...f.options,
      source: { kind: 'runner', dir: alias, log: join(alias, 'full.log') }, command,
      heartbeat: { task: 'fixture-task', actor: 'fixture-owner', repo: alias, ttlMs: 400, intervalMs: 100 } };
    return await check({ options, calls, reads: () => snapshots });
  } finally {
    Date.now = originalNow; fsPromises.readFile = originalRead; fsPromises.realpath = originalRealpath;
    syncBuiltinESMExports();
    assert.deepEqual(files.map(file => readFileSync(join(f.dir, file))), before);
  }
}

test('heartbeat selects the synchronously published physical repository through a directory alias', async t => {
  const f = fixture(t);
  await withHeartbeatAlias(f, async ({ options, calls, reads }) => {
    const result = await observe(options);
    assert.equal(result.reason, 'deadline'); assert.equal(result.ownership, 'identified');
    assert.deepEqual(result.source, { kind: 'runner', dir: f.dir, log: f.log,
      runId: f.state.runId, executionId: f.state.executionId, worktree: f.state.worktree });
    assert.equal(result.elapsedMs, 90); assert.equal(reads(), 2);
    assert.deepEqual(calls.map(args => args.at(-1)), ['--help', 'fixture-task']);
    assert.equal(result.lease.length, 1);
    assert.deepEqual(result.lease[0], { at: result.lease[0].at, task: 'fixture-task',
      actor: 'fixture-owner', repo: f.state.worktree, status: 'renewed' });
    assert.equal(result.acceptance, 'not_established');
  });
});

test('heartbeat alias expiry after valid help loses the lease without renewal', async t => {
  const f = fixture(t);
  await withHeartbeatAlias(f, async ({ options, calls, reads }) => {
    const result = await observe(options);
    assert.equal(result.reason, 'lease_lost'); assert.equal(result.ownership, 'identified');
    assert.equal(result.source.worktree, f.state.worktree);
    assert.equal(result.diagnostic.code, 'lease_lost');
    assert.match(result.diagnostic.message, /deadline reached before command/);
    assert.equal(result.elapsedMs, 120); assert.equal(reads(), 1);
    assert.deepEqual(calls.map(args => args.at(-1)), ['--help']);
    assert.deepEqual(result.lease, []); assert.equal(result.acceptance, 'not_established');
  }, { helpAdvanceMs: 120 });
});

test('heartbeat alias renewal failure remains lease_lost before the second snapshot', async t => {
  const f = fixture(t);
  await withHeartbeatAlias(f, async ({ options, calls, reads }) => {
    const result = await observe(options);
    assert.equal(result.reason, 'lease_lost'); assert.equal(result.ownership, 'identified');
    assert.equal(result.source.worktree, f.state.worktree);
    assert.equal(result.diagnostic.code, 'lease_lost');
    assert.match(result.diagnostic.message, /command failed \(7\)/);
    assert.equal(result.elapsedMs, 0); assert.equal(reads(), 1);
    assert.deepEqual(calls.map(args => args.at(-1)), ['--help', 'fixture-task']);
    assert.deepEqual(result.lease, []); assert.equal(result.acceptance, 'not_established');
  }, { renewalStatus: 7 });
});

for (const outcome of ['success', 'rejection', 'thrown assertion']) test(`heartbeat alias mocks restore after ${outcome} and leave subsequent observations independent`, async t => {
  const f = fixture(t), originalNow = Date.now, originalRead = fsPromises.readFile, originalRealpath = fsPromises.realpath;
  const check = async ({ options, calls }) => {
    if (outcome === 'rejection') return await observe({ ...options, heartbeat: { ...options.heartbeat, task: 'foreign-task' } });
    const result = await observe(options);
    assert.equal(result.reason, 'deadline'); assert.equal(calls.length, 2);
    if (outcome === 'thrown assertion') assert.equal(result.reason, 'deliberate assertion failure');
  };
  if (outcome === 'success') await withHeartbeatAlias(f, check);
  else await assert.rejects(withHeartbeatAlias(f, check), outcome === 'rejection' ? /must match/ : { code: 'ERR_ASSERTION' });
  assert.equal(Date.now, originalNow); assert.equal(fsPromises.readFile, originalRead);
  assert.equal(fsPromises.realpath, originalRealpath);
  assert.equal(builtinReadFile, originalRead); assert.equal(builtinRealpath, originalRealpath);
  assert.throws(() => readFileSync(`${f.options.cursor}.lock`), { code: 'ENOENT' });
  appendFileSync(f.log, 'RALPHEX_PROGRESS {"task":"Independent heartbeat control"}\n');
  const result = await observe({ ...f.options, cursor: join(f.dir, 'independent-observer.json') });
  assert.equal(result.reason, 'progress'); assert.equal(result.ownership, 'identified');
  assert.equal(result.task, 'Independent heartbeat control'); assert.equal(result.source.worktree, f.state.worktree);
  assert.deepEqual(result.lease, []);
});

test('canonical selection never authorizes foreign or aliased recorded ownership metadata', async t => {
  for (const [target, key, value] of [
    ['state', 'runDirectory', 'foreign'], ['lock', 'runDirectory', 'foreign'],
    ['lock', 'token', undefined], ['lock', 'runId', 'foreign'],
    ['lock', 'executionId', 'foreign'], ['lock', 'worktree', 'foreign'],
    ['lock', 'pid', 0], ['lock', 'pid', 'invalid'],
    ['state', 'runDirectory', 'alias'], ['lock', 'runDirectory', 'alias'],
  ]) {
    const f = fixture(t), alias = join(f.dir, 'metadata-alias');
    symlinkSync(f.dir, alias, process.platform === 'win32' ? 'junction' : 'dir');
    f.state.beads = 'fixture-task';
    f[target][key] = value === 'alias' ? alias : value;
    f.save(); writeFileSync(join(f.dir, 'executor.lock'), JSON.stringify(f.lock));
    const files = ['current.json', 'executor.lock', 'full.log'], before = files.map(file => readFileSync(join(f.dir, file)));
    let calls = 0;
    const result = await observe({ ...f.options,
      heartbeat: { task: 'fixture-task', actor: 'fixture-owner', repo: alias, ttlMs: 400, intervalMs: 100 },
      command: async () => { calls++; throw new Error('Foreign ownership must never reach transport'); } });
    assert.equal(calls, 0);
    assert.equal(result.reason, 'ownership_unknown', `${target}.${key}=${value}`);
    assert.equal(result.ownership, 'unknown');
    assert.deepEqual(files.map(file => readFileSync(join(f.dir, file))), before);
  }
});

test('a stopped owned PID remains ownership uncertainty with matching canonical identities', async t => {
  const f = fixture(t), child = spawn(process.execPath, ['-e', 'process.exit(0)'], { stdio: 'ignore' });
  const pid = child.pid;
  await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
  f.lock.pid = pid; writeFileSync(join(f.dir, 'executor.lock'), JSON.stringify(f.lock));
  const before = readFileSync(join(f.dir, 'executor.lock'));
  const result = await observe(f.options);
  assert.equal(result.reason, 'ownership_unknown'); assert.equal(result.ownership, 'unknown');
  assert.deepEqual(readFileSync(join(f.dir, 'executor.lock')), before);
});

test('canonical cursor continuation rejects foreign directory and log identities without rewriting evidence', async t => {
  for (const key of ['dir', 'log', 'runId', 'executionId', 'worktree']) {
    const f = fixture(t); await observe(f.options);
    const cursor = JSON.parse(readFileSync(f.options.cursor, 'utf8'));
    cursor.source[key] = 'foreign'; writeFileSync(f.options.cursor, JSON.stringify(cursor));
    const before = readFileSync(f.options.cursor);
    const result = await observe(f.options);
    assert.equal(result.reason, 'needs_decision'); assert.equal(result.diagnostic.code, 'source_mismatch');
    assert.deepEqual(readFileSync(f.options.cursor), before);
  }
});

test('reserved runner inputs reject canonical directory aliases and hard-linked cursor outputs', async t => {
  for (const name of ['current.json', 'current.json.tmp', 'events.jsonl', 'executor.lock', 'full.log']) {
    const f = fixture(t), alias = join(f.dir, 'input-alias');
    symlinkSync(f.dir, alias, process.platform === 'win32' ? 'junction' : 'dir');
    if (['current.json.tmp', 'events.jsonl'].includes(name)) writeFileSync(join(f.dir, name), 'runner-owned');
    const linked = join(f.dir, 'linked-output'); linkSync(join(f.dir, name), linked);
    const before = readFileSync(join(f.dir, name)), entries = readdirSync(f.dir).sort();
    for (const cursor of [join(alias, name), linked]) {
      await assert.rejects(observe({ ...f.options, cursor }), /observer-owned/);
      assert.deepEqual(readFileSync(join(f.dir, name)), before);
      assert.deepEqual(readdirSync(f.dir).sort(), entries);
    }
    rmSync(linked); linkSync(join(f.dir, name), `${linked}.lock`);
    const derivedEntries = readdirSync(f.dir).sort();
    await assert.rejects(observe({ ...f.options, cursor: linked }), /observer-owned/);
    assert.deepEqual(readFileSync(join(f.dir, name)), before);
    assert.deepEqual(readdirSync(f.dir).sort(), derivedEntries);
  }
});

test('missing reserved outputs remain protected through existing canonical ancestors', async t => {
  for (const name of ['current.json.tmp', 'events.jsonl', 'executor.lock', 'full.log']) {
    const f = fixture(t), alias = join(f.dir, 'missing-output-alias');
    symlinkSync(f.dir, alias, process.platform === 'win32' ? 'junction' : 'dir');
    rmSync(join(f.dir, name), { force: true });
    const before = readFileSync(join(f.dir, 'current.json')), entries = readdirSync(f.dir).sort();
    await assert.rejects(observe({ ...f.options, cursor: join(alias, name) }), /observer-owned/);
    assert.deepEqual(readFileSync(join(f.dir, 'current.json')), before);
    assert.deepEqual(readdirSync(f.dir).sort(), entries);
  }
});

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

test('captured Ralphex timestamped and wrapped output delivers advisory review transitions', async t => {
  const f = fixture(t);
  // Captured from Ralphex v1.7.0 stdout, not raw executor output.
  const captured = readFileSync(new URL('./fixtures/ralphex-progress-formatted.txt', import.meta.url));
  writeFileSync(f.log, captured);
  const result = await observe(f.options);
  assert.equal(result.reason, 'progress');
  assert.deepEqual(result.progressTasks, [
    'Follow-up review: reading coordinator snapshot and project rules',
    'Follow-up review: collecting two independent perspectives'
  ]);
  assert.equal(result.progressTotal, 2);
  assert.equal(result.status, 'running');
  assert.equal(result.acceptance, 'not_established');
  const records = readFileSync(result.progressEvidence, 'utf8').trim().split('\n').map(line => JSON.parse(line));
  assert.equal(records[0].from, 0);
  assert.equal(records.at(-1).to, captured.length);
  const repeat = await observe(f.options);
  assert.equal(repeat.progressTotal, 0);
  assert.equal(repeat.log.from, captured.length);
});

test('physical CRLF wrapped progress delivers both advisory tasks with original byte offsets', async t => {
  const f = fixture(t);
  const captured = Buffer.from(readFileSync(new URL('./fixtures/ralphex-progress-formatted.txt', import.meta.url), 'utf8').replace(/\r?\n/g, '\r\n'));
  writeFileSync(f.log, captured);
  const result = await observe(f.options);
  assert.equal(result.reason, 'progress');
  assert.deepEqual(result.progressTasks, [
    'Follow-up review: reading coordinator snapshot and project rules',
    'Follow-up review: collecting two independent perspectives'
  ]);
  assert.equal(result.progressTotal, 2); assert.equal(result.status, 'running');
  assert.equal(result.acceptance, 'not_established');
  const secondStart = captured.indexOf('[26-10-12 00:49:35]');
  const records = readFileSync(result.progressEvidence, 'utf8').trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(records.map(({ from, to }) => ({ from, to })), [
    { from: 0, to: secondStart }, { from: secondStart, to: captured.length }
  ]);
  assert.equal(result.log.from, 0); assert.equal(result.log.to, captured.length);
  assert.deepEqual(readFileSync(f.log), captured);
  const repeat = await observe(f.options);
  assert.equal(repeat.reason, 'deadline'); assert.equal(repeat.progressTotal, 0);
  assert.equal(repeat.log.from, captured.length); assert.equal(repeat.log.to, captured.length);
});

test('wrapped Ralphex progress survives observer restart in a partial continuation line', async t => {
  const f = fixture(t);
  const captured = readFileSync(new URL('./fixtures/ralphex-progress-formatted.txt', import.meta.url));
  const split = captured.indexOf(10) + 12;
  writeFileSync(f.log, captured.subarray(0, split));
  const first = await observe(f.options);
  assert.equal(first.reason, 'deadline');
  assert.equal(first.progressTotal, 0);
  appendFileSync(f.log, captured.subarray(split));
  const resumed = await observe(f.options);
  assert.equal(resumed.reason, 'progress');
  assert.equal(resumed.progressTotal, 2);
  assert.equal(resumed.task, 'Follow-up review: collecting two independent perspectives');
  assert.equal(resumed.log.from, split);
  const records = readFileSync(resumed.progressEvidence, 'utf8').trim().split('\n').map(line => JSON.parse(line));
  assert.equal(records[0].from, 0);
  assert.equal(records.at(-1).to, captured.length);
  assert.equal((await observe(f.options)).progressTotal, 0);
});

test('physical CRLF wrapped progress survives restart during a partial continuation', async t => {
  const f = fixture(t);
  const captured = Buffer.from(readFileSync(new URL('./fixtures/ralphex-progress-formatted.txt', import.meta.url), 'utf8').replace(/\r?\n/g, '\r\n'));
  const split = captured.indexOf(10) + 12;
  writeFileSync(f.log, captured.subarray(0, split));
  const first = await observe(f.options);
  assert.equal(first.reason, 'deadline'); assert.equal(first.progressTotal, 0);
  assert.equal(first.log.to, split);
  appendFileSync(f.log, captured.subarray(split));
  const resumed = await observe(f.options);
  assert.equal(resumed.reason, 'progress'); assert.equal(resumed.progressTotal, 2);
  assert.deepEqual(resumed.progressTasks, [
    'Follow-up review: reading coordinator snapshot and project rules',
    'Follow-up review: collecting two independent perspectives'
  ]);
  assert.equal(resumed.status, 'running'); assert.equal(resumed.acceptance, 'not_established');
  assert.equal(resumed.log.from, split); assert.equal(resumed.log.to, captured.length);
  const records = readFileSync(resumed.progressEvidence, 'utf8').trim().split('\n').map(line => JSON.parse(line));
  const secondStart = captured.indexOf('[26-10-12 00:49:35]');
  assert.deepEqual(records.map(({ from, to }) => ({ from, to })), [
    { from: 0, to: secondStart }, { from: secondStart, to: captured.length }
  ]);
  assert.deepEqual(readFileSync(f.log), captured);
  assert.equal((await observe(f.options)).progressTotal, 0);
});

for (const restart of [false, true]) test(`physical CRLF framing spans a read boundary with byte continuity (restart=${restart})`, async t => {
  const f = fixture(t), prefix = '[26-10-12 00:49:20] ';
  const firstLine = Buffer.from(prefix + 'RALPHEX_PROGRESS {"task":"Task boundary\r\n');
  const padding = Buffer.from('n'.repeat(16384 - firstLine.length - 1) + '\r\n');
  const bytes = Buffer.concat([padding, firstLine, Buffer.from(prefix + 'continued"}\r\n')]);
  assert.equal(bytes[16383], 13); assert.equal(bytes[16384], 10);
  if (restart) {
    writeFileSync(f.log, bytes.subarray(0, 16384));
    const first = await observe(f.options);
    assert.equal(first.reason, 'deadline'); assert.equal(first.log.to, 16384);
    const saved = JSON.parse(readFileSync(f.options.cursor, 'utf8'));
    assert.deepEqual(Buffer.from(saved.pendingLog.line, 'base64'), firstLine.subarray(0, -1));
    appendFileSync(f.log, bytes.subarray(16384));
  } else writeFileSync(f.log, bytes);
  const result = await observe(f.options);
  assert.equal(result.reason, 'progress'); assert.equal(result.task, 'Task boundary continued');
  assert.equal(result.status, 'running'); assert.equal(result.acceptance, 'not_established');
  assert.equal(result.log.from, restart ? 16384 : 0); assert.equal(result.log.to, bytes.length);
  const records = readFileSync(result.progressEvidence, 'utf8').trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(records, [{ task: 'Task boundary continued', from: padding.length, to: bytes.length }]);
  assert.deepEqual(readFileSync(f.log), bytes);
  const repeat = await observe(f.options);
  assert.equal(repeat.progressTotal, 0); assert.equal(repeat.log.from, bytes.length);
});

test('physical CRLF wrapped UTF-8 continuity survives restart inside a multibyte character', async t => {
  const f = fixture(t), prefix = '[26-10-12 00:49:20] ';
  const bytes = Buffer.from(prefix + 'RALPHEX_PROGRESS {"task":"Task\r\n' + prefix + '🧭 continued"}\r\n');
  const split = bytes.indexOf(Buffer.from('🧭')) + 2;
  writeFileSync(f.log, bytes.subarray(0, split));
  const first = await observe(f.options);
  assert.equal(first.reason, 'deadline'); assert.equal(first.progressTotal, 0); assert.equal(first.log.to, split);
  appendFileSync(f.log, bytes.subarray(split));
  const result = await observe(f.options);
  assert.equal(result.reason, 'progress'); assert.equal(result.task, 'Task 🧭 continued');
  assert.equal(result.log.from, split); assert.equal(result.log.to, bytes.length);
  assert.deepEqual(JSON.parse(readFileSync(result.progressEvidence, 'utf8').trim()), { task: 'Task 🧭 continued', from: 0, to: bytes.length });
  assert.deepEqual(readFileSync(f.log), bytes);
});

test('physical CRLF retains 4096-byte bounds and embedded CR rejection with marker recovery', async t => {
  const f = fixture(t), prefix = '[26-10-12 00:49:20] ';
  const raw = task => 'RALPHEX_PROGRESS {"task":"' + task + '"}';
  const bounded = raw('Physical bound');
  const atBound = bounded + ' '.repeat(4095 - Buffer.byteLength(bounded)) + '\r\n';
  const overBound = raw('Rejected physical') + ' '.repeat(4096 - Buffer.byteLength(raw('Rejected physical'))) + '\r\n';
  const wrapped = (task, size) => {
    const first = '{"task":' + ' '.repeat(2000), last = '"' + task + '"}';
    return prefix + 'RALPHEX_PROGRESS ' + first + '\r\n' + prefix + ' '.repeat(size - Buffer.byteLength(first + ' ' + last)) + last + '\r\n';
  };
  const pieces = [atBound, overBound, wrapped('Wrapped bound', 4096), wrapped('Rejected wrapped', 4097),
    prefix + 'RALPHEX_PROGRESS {"task":"Embedded\rCR\r\n' + prefix + 'rejected"}\r\n',
    raw('Recovery') + '\r\n'];
  const bytes = Buffer.from(pieces.join('')); writeFileSync(f.log, bytes);
  const records = []; let offset = 0;
  for (let window = 0; window < 3; window++) {
    const result = await observe(f.options);
    assert.equal(result.reason, 'progress'); assert.equal(result.status, 'running'); assert.equal(result.acceptance, 'not_established');
    assert.equal(result.log.from, offset); offset = result.log.to;
    assert.ok(result.progressTasks.length <= 10); assert.ok(JSON.stringify(result).length < 6000);
    records.push(...readFileSync(result.progressEvidence, 'utf8').trim().split('\n').map(line => JSON.parse(line)));
    if (!result.log.unreadBytes) break;
  }
  assert.deepEqual(records.map(record => record.task), ['Physical bound', 'Wrapped bound', 'Recovery']);
  const offsets = [0]; for (const piece of pieces) offsets.push(offsets.at(-1) + Buffer.byteLength(piece));
  assert.deepEqual(records.map(({ from, to }) => ({ from, to })), [
    { from: offsets[0], to: offsets[1] }, { from: offsets[2], to: offsets[3] }, { from: offsets[5], to: offsets[6] }
  ]);
  assert.equal(offset, bytes.length); assert.ok(readFileSync(f.options.cursor).length < 6500);
  assert.deepEqual(readFileSync(f.log), bytes);
});

test('malformed formatted messages stay bounded and cannot swallow the next valid marker', async t => {
  const f = fixture(t), prefix = '[26-10-12 00:49:20] ';
  writeFileSync(f.log, prefix + 'RALPHEX_PROGRESS {"task":"unfinished\n' +
    Array.from({length:100}, () => prefix + 'x'.repeat(100) + '\n').join('') +
    prefix + 'RALPHEX_PROGRESS {"task":"Next task"}\n');
  const result = await observe(f.options);
  assert.equal(result.reason, 'progress');
  assert.deepEqual(result.progressTasks, ['Next task']);
  assert.equal(result.status, 'running');
  assert.ok(readFileSync(f.options.cursor).length < 6500);
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

async function runningFixture(t,mode = 'quiet',duration = 600,{ startupDelayMs = 0, startupTimeoutMs = 10000, executable = process.execPath } = {}) {
  const f=fixture(t, { cleanup: false });
  let stopWorker = async () => {};
  t.after(async () => { await stopWorker(); rmSync(f.dir, { recursive: true, force: true }); });
  rmSync(join(f.dir,'current.json')); rmSync(join(f.dir,'executor.lock'));
  const git=(...args)=>execFileSync('git',args,{cwd:f.dir,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  git('init','-q'); git('config','user.email','fixture@example.invalid'); git('config','user.name','Fixture');
  writeFileSync(join(f.dir,'.gitignore'),'run/\nfull.log\nobserver.json*\n'); mkdirSync(join(f.dir,'docs')); writeFileSync(join(f.dir,'docs/plan.md'),'Fixture plan'); git('add','.'); git('commit','-qm','fixture');
  const dir=join(f.dir,'run'); initialize(dir,{cwd:f.dir,issue:'fixture',beads:'fixture-task',base:'HEAD'});
  const fd=openSync(f.log,'a'); let worker;
  try { worker=spawn(executable,[fileURLToPath(new URL('./fixtures/ralphex-observer-worker.mjs',import.meta.url)),dir,mode,String(duration),String(startupDelayMs)],{stdio:['ignore',fd,fd]}); }
  finally { closeSync(fd); }
  let launchError, closed = false;
  worker.once('error', error => { launchError = error; });
  const exited=new Promise(resolve=>worker.once('exit',(code,signal)=>resolve({code,signal})));
  const completion = new Promise(resolve => worker.once('close', () => { closed = true; resolve(); }));
  async function stop() {
    if (!closed && worker.pid && worker.exitCode === null && worker.signalCode === null) worker.kill('SIGKILL');
    let timer;
    try { await Promise.race([completion, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Fixture worker cleanup timed out')), 1500); })]); }
    finally { clearTimeout(timer); }
  }
  stopWorker = stop;
  const started = Date.now(), until = started + startupTimeoutMs;
  while(readState(dir).status==='ready' && !launchError && !closed && Date.now()<until) await new Promise(resolve=>setTimeout(resolve,10));
  if (launchError || readState(dir).status === 'ready') {
    const diagnostic = { elapsedMs: Date.now() - started, state: readState(dir).status, exitCode: worker.exitCode, signal: worker.signalCode,
      launchError: launchError?.code ?? null, log: readFileSync(f.log, 'utf8').slice(-2048) };
    await stop();
    throw new Error(`Fixture worker startup failed: ${JSON.stringify(diagnostic)}`);
  }
  return {...f,dir,worker,exited,options:{...f.options,source:{kind:'runner',dir,log:f.log}}};
}

async function fixtureExit(f) {
  let timer;
  try {
    return await Promise.race([f.exited, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Fixture worker terminal exit timed out')), 10000);
    })]);
  } finally { clearTimeout(timer); }
}

test('real runner fixture observes healthy startup beyond the former readiness budget', async t => {
  const f = await runningFixture(t, 'quiet', 100, { startupDelayMs: 2800 });
  const exit = await fixtureExit(f);
  const result = await observe({ ...f.options, budgetMs: 2000 });
  assert.equal(result.reason, 'completed');
  assert.equal(exit.code, 0);
  assert.equal(readState(f.dir).status, 'awaiting_review');
});

test('real runner fixture rejects an exit before startup with actual exit evidence', async t => {
  await assert.rejects(runningFixture(t, 'startup-exit', 100), /"state":"ready","exitCode":23/);
});

test('real runner fixture bounds stalled readiness and reaps the delayed worker', async t => {
  await assert.rejects(runningFixture(t, 'quiet', 100, { startupDelayMs: 2800, startupTimeoutMs: 100 }), /Fixture worker startup failed:.*"state":"ready"/);
});

test('real runner fixture observes OS launch errors without waiting for an exit event', async t => {
  await assert.rejects(runningFixture(t, 'quiet', 100, { executable: join(tmpdir(), 'missing-workspace-fixture-executable') }), /"launchError":"ENOENT"/);
});

for(const mode of ['quiet','noisy','failure','throw']) test(`real runner/process ${mode} preserves terminal source and real CLI exit`,async t=>{
  const f=await runningFixture(t,mode,100);
  // This is terminal evidence, not a promise that live ownership is readable.
  // Running uncertainty and dead launchers have separate strict controls.
  const exit=await fixtureExit(f); const result=await observe({...f.options,budgetMs:2000});
  assert.equal(result.reason,['failure','throw'].includes(mode)?'failed':'completed');
  assert.equal(exit.code,['failure','throw'].includes(mode)?1:0);
  assert.equal(result.exit,mode==='failure'?9:mode==='throw'?null:0);
  if(mode==='noisy') { assert.ok(readFileSync(f.log).length>100000); assert.ok(result.log.excerpt.length<=2048); }
});

test('real running PID probe denial stays uncertain until the actual worker exits', async t => {
  const f = await runningFixture(t, 'gated', 100);
  const original = process.kill;
  let denied = 0;
  let exit, failure;
  process.kill = (pid, signal) => {
    if (pid === f.worker.pid && signal === 0) {
      denied++;
      throw Object.assign(new Error('Controlled real worker probe denial'), { code: 'EPERM' });
    }
    return original(pid, signal);
  };
  try {
    const result = await observe({ ...f.options, budgetMs: 2000 });
    assert.equal(result.reason, 'ownership_unknown');
    assert.equal(result.status, 'running');
    assert.ok(denied > 0);
  } catch (error) { failure = error; }
  finally {
    process.kill = original;
    try {
      writeFileSync(join(f.dir, 'fixture-release'), 'release\n');
      exit = await fixtureExit(f);
    } catch (error) { failure ??= error; }
  }
  if (failure) throw failure;
  assert.equal(exit.code, 0);
  const terminal = await observe({ ...f.options, budgetMs: 2000 });
  assert.equal(terminal.reason, 'completed');
  assert.equal(terminal.exit, 0);
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
  const other=fixture(t);
  await assert.rejects(observe({...f.options,command,heartbeat:{...config,repo:other.dir}}),/match/);assert.equal(calls,0);
  const alias=join(f.dir,'recorded-worktree-alias');symlinkSync(f.dir,alias,process.platform==='win32'?'junction':'dir');
  rmSync(f.options.cursor);
  f.state.worktree=alias;f.lock.worktree=alias;f.save();writeFileSync(join(f.dir,'executor.lock'),JSON.stringify(f.lock));
  const before=['current.json','executor.lock','full.log'].map(file=>readFileSync(join(f.dir,file)));
  await assert.rejects(observe({...f.options,command,heartbeat:{...config,repo:alias}}),/match/);assert.equal(calls,0);
  assert.deepEqual(['current.json','executor.lock','full.log'].map(file=>readFileSync(join(f.dir,file))),before);
  f.state.worktree=f.dir;f.lock.worktree=f.dir;f.save();writeFileSync(join(f.dir,'executor.lock'),JSON.stringify(f.lock));
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

// Intervene at the public filesystem boundary only after the actual owner has
// published its token. These builtin mocks stay scoped to sequential tests.
async function withCursorOwnership(t, f, check, { takeover = true } = {}) {
  const lockPath = `${f.options.cursor}.lock`, foreign = JSON.stringify({ token: 'foreign', pid: process.pid });
  const files = ['current.json', 'executor.lock', 'full.log'].map(name => join(f.dir, name));
  const before = files.map(file => readFileSync(file)), originalRead = fsPromises.readFile;
  const boundary = { reached: false, ownedTokenRead: false, foreignWritten: false };
  let observation;
  try {
    fsPromises.readFile = async (...args) => {
      if (args[0] === lockPath && !boundary.reached) {
        boundary.reached = true;
        const owner = JSON.parse(await originalRead(...args));
        assert.match(owner.token, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
        assert.equal(owner.pid, process.pid);
        boundary.ownedTokenRead = true;
        if (takeover) {
          writeFileSync(lockPath, foreign);
          boundary.foreignWritten = true;
        }
      }
      return originalRead(...args);
    };
    syncBuiltinESMExports();
    observation = observe(f.options);
    return await check({ observation, boundary });
  } finally {
    // A check may throw before awaiting observe; never restore a live mock user.
    try { await observation; } catch { /* The check owns the exact expected outcome. */ }
    fsPromises.readFile = originalRead;
    syncBuiltinESMExports();
    assert.equal(fsPromises.readFile, originalRead);
    assert.equal(builtinReadFile, originalRead);
    assert.deepEqual(boundary, { reached: true, ownedTokenRead: true, foreignWritten: takeover });
    assert.deepEqual(files.map(file => readFileSync(file)), before);
    assert.equal(f.options.budgetMs, 90);
    assert.equal(f.options.pollMs, 10);
    if (takeover) {
      assert.throws(() => readFileSync(f.options.cursor), { code: 'ENOENT' });
      assert.equal(readFileSync(lockPath, 'utf8'), foreign);
    } else {
      assert.throws(() => readFileSync(lockPath), { code: 'ENOENT' });
      assert.equal(JSON.parse(readFileSync(f.options.cursor)).source.executionId, f.state.executionId);
    }
    const independent = fixture(t);
    appendFileSync(independent.log, 'RALPHEX_PROGRESS {"task":"Independent cursor ownership control"}\n');
    const result = await observe(independent.options);
    assert.equal(result.reason, 'progress');
    assert.equal(result.ownership, 'identified');
    assert.equal(result.task, 'Independent cursor ownership control');
    assert.equal(result.source.worktree, independent.state.worktree);
    assert.throws(() => readFileSync(`${independent.options.cursor}.lock`), { code: 'ENOENT' });
    if (takeover) assert.equal(readFileSync(lockPath, 'utf8'), foreign);
  }
}

test('losing cursor ownership cannot publish or remove a competing observer cursor', async t => {
  const f = fixture(t);
  await withCursorOwnership(t, f, async ({ observation }) => {
    await assert.rejects(observation, { message: 'Observer cursor ownership lost' });
  });
});

for (const outcome of ['success', 'rejection', 'thrown assertion']) test(`cursor ownership mock restores after ${outcome} and leaves subsequent observations independent`, async t => {
  const f = fixture(t), failure = new assert.AssertionError({ message: 'Deliberate post-observation assertion' });
  const check = async ({ observation }) => {
    if (outcome === 'rejection') {
      await assert.rejects(observation, { message: 'Observer cursor ownership lost' });
      return;
    }
    const result = await observation;
    assert.equal(result.reason, 'deadline');
    assert.equal(result.ownership, 'identified');
    if (outcome === 'thrown assertion') throw failure;
  };
  const control = withCursorOwnership(t, f, check, { takeover: outcome === 'rejection' });
  if (outcome === 'thrown assertion') await assert.rejects(control, error => error === failure);
  else await control;
});

test('large CI step reports keep every outcome in evidence and return a compact envelope',async t=>{
  const f=ciFixture(t);f.jobs[0].steps=Array.from({length:200},(_,i)=>({name:`step ${i} ${'x'.repeat(100)}`,status:'completed',conclusion:i===199?'failure':'success'}));
  const result=await observe(f.options);assert.ok(JSON.stringify(result).length<12000);assert.ok(result.detailEvidence);
  const detailed=JSON.parse(readFileSync(result.detailEvidence,'utf8'));assert.equal(detailed.jobs[0].steps.length,200);assert.equal(detailed.jobs[0].steps.at(-1).outcome,'failure');
  assert.equal(result.jobs[0].stepOutcomeCounts.failure,1);assert.equal(result.acceptance,'not_established');
});

for (const withHeartbeat of [false,true]) test(`fresh observer binds its first execution for the whole invocation (heartbeat=${withHeartbeat})`,async t=>{
  const f=fixture(t);f.state.beads='fixture-task';f.save();
  // Publish only after the first complete snapshot/owner read. A wall timer can
  // fire before that read under suite load, so the observer correctly binds the
  // replacement and reaches its deadline instead of the intended mismatch seam.
  const originalRead = fsPromises.readFile, originalNow = Date.now, start = originalNow();
  let published = false;
  const controller = new AbortController();
  // Independent host timer makes a missed-mismatch regression fail boundedly
  // even while the observer's logical clock is held before its 200ms deadline.
  const timeout = setTimeout(() => controller.abort(), 5000);
  fsPromises.readFile = async (...args) => {
    const bytes = await originalRead(...args);
    if (args[0] === join(f.dir, 'executor.lock') && !published) {
      assert.equal(JSON.parse(bytes).executionId, 'fixture-execution');
      f.state.executionId='second-execution';f.lock.executionId='second-execution';
      writeFileSync(join(f.dir,'executor.lock'),JSON.stringify(f.lock));f.save();published = true;
    }
    return bytes;
  };
  try {
    Date.now = () => start; syncBuiltinESMExports();
    const command=async()=>({status:0,stdout:'Usage: bd heartbeat <id> Only the current in_progress owner'});
    const result=await observe({...f.options,budgetMs:200,pollMs:50,signal:controller.signal,command,heartbeat:withHeartbeat?{task:'fixture-task',actor:'fixture-owner',repo:f.dir,ttlMs:400,intervalMs:100}:undefined});
    assert.equal(published,true);assert.equal(result.reason,'needs_decision');assert.equal(result.diagnostic.code,'source_mismatch');
    assert.equal(result.source.executionId,'second-execution');assert.throws(()=>readFileSync(f.options.cursor),/ENOENT/);
    assert.equal(readFileSync(join(f.dir,'executor.lock'),'utf8'),JSON.stringify(f.lock));
  } finally {
    clearTimeout(timeout); controller.abort();
    Date.now = originalNow; fsPromises.readFile = originalRead; syncBuiltinESMExports();
  }
  assert.equal(Date.now, originalNow); assert.equal(builtinReadFile, originalRead);
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
