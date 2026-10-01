import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, lstat, symlink, readlink, chmod, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWorkspaceIpcHandler } from '../electron/workspaceIpc.js';
import { createFilePropertyStore } from '../src/workspacePropertyStore.js';

async function fixture(t, hooks = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'workspace-status-move-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const root = join(dir, 'source');
  await mkdir(join(root, 'Active', 'Alpha', 'docs'), { recursive: true });
  await mkdir(join(root, 'Done'), { recursive: true });
  await writeFile(join(root, 'Active', 'Alpha', 'docs', 'plan.txt'), 'plan');
  await writeFile(join(root, 'Active', 'Alpha', '.private'), 'hidden');
  await chmod(join(root, 'Active', 'Alpha', 'docs', 'plan.txt'), 0o640);
  await utimes(join(root, 'Active', 'Alpha', 'docs', 'plan.txt'), 1000000000, 1000000000);
  await symlink('docs/plan.txt', join(root, 'Active', 'Alpha', 'plan-link'));
  const configPath = join(dir, 'settings.json');
  const propertyStorePath = join(dir, 'properties.json');
  const options = { configPath, propertyStorePath, viewStorePath: join(dir, 'views.json'), chooseRoot: async () => root, moveTestHooks: hooks };
  const handler = createWorkspaceIpcHandler(options);
  const { root: selected } = await handler(null, 'workspace.setRoot', {});
  const workspaceId = selected.workspaceId;
  const call = (method, payload = {}) => handler(null, `workspace.${method}`, { workspaceId, ...payload });
  const projection = await call('getViewProjection', { viewId: 'view:default-table' });
  const project = projection.projection.rows[0];
  const done = projection.statusValues.find(s => s.name === 'Done');
  return { dir, root, configPath, options, handler, call, workspaceId, project, done, propertyStorePath };
}

const missing = path => assert.rejects(lstat(path), { code: 'ENOENT' });

test('explicit Status move preserves contents, opaque identity, values, history and shared-source roles across restart', async t => {
  const f = await fixture(t);
  assert.ok(f.done, 'empty status folder is selectable');
  await f.call('updateFolderRole', { path: 'Active/Alpha/docs', role: 'group' });
  const sibling = (await f.call('createWorkspace', { name: 'Sibling' })).workspace.id;
  await f.call('createProperty', { propertyId: 'property:notes', name: 'Notes', type: 'text' });
  await f.call('updateProjectPropertyValue', { projectId: f.project.id, propertyId: 'property:notes', value: 'retained' });
  const store = createFilePropertyStore(f.propertyStorePath);
  const before = await readFile(f.propertyStorePath, 'utf8');
  const result = await f.call('moveProjectStatus', { projectId: f.project.id, statusValueId: f.done.id });
  assert.equal(result.projectId, f.project.id);
  assert.equal(result.to, 'Done/Alpha');
  await missing(join(f.root, 'Active', 'Alpha'));
  assert.equal(await readFile(join(f.root, 'Done', 'Alpha', 'docs', 'plan.txt'), 'utf8'), 'plan');
  assert.equal(await readFile(join(f.root, 'Done', 'Alpha', '.private'), 'utf8'), 'hidden');
  assert.equal(await readlink(join(f.root, 'Done', 'Alpha', 'plan-link')), 'docs/plan.txt');
  const stat = await lstat(join(f.root, 'Done', 'Alpha', 'docs', 'plan.txt'));
  assert.equal(stat.mode & 0o777, 0o640);
  assert.equal(stat.mtimeMs, 1000000000000);
  assert.equal(await readFile(f.propertyStorePath, 'utf8'), before, 'metadata/history IDs are never rewritten');
  assert.equal((await store.listPropertyHistory(f.workspaceId, { projectId: f.project.id })).length, 1);
  const restarted = createWorkspaceIpcHandler(f.options);
  for (const workspaceId of [f.workspaceId, sibling]) {
    const { project } = await restarted(null, 'workspace.getProject', { workspaceId, projectId: f.project.id });
    assert.equal(project.currentRelativePath, 'Done/Alpha');
    assert.equal(project.propertyValues['property:notes'], 'retained');
    const scan = await restarted(null, 'workspace.scan', { workspaceId, includeCardChildren: true });
    assert.equal(scan.workspace.objects.find(p => p.id === f.project.id).source.path, 'Done/Alpha');
    const rules = JSON.parse(await readFile(f.configPath, 'utf8')).workspaceSources[workspaceId].rulesByRoot[f.root];
    assert.equal(rules['Done/Alpha/docs'].role, 'group');
    assert.equal(rules['Active/Alpha/docs'], undefined);
  }
  const tree = await f.call('listProjectFileTree', { path: 'Done/Alpha' });
  assert.equal(tree.fileTree[0].children[0].relativePath, 'Done/Alpha/docs/plan.txt');
  const preview = await f.call('previewFile', { path: 'Done/Alpha/docs/plan.txt' });
  assert.equal(preview.filePath, join(f.root, 'Done/Alpha/docs/plan.txt'));
  await mkdir(join(f.root, 'Active', 'Alpha'));
  const fresh = (await f.call('getViewProjection', { viewId: 'view:default-table' })).projection.rows;
  assert.equal(new Set(fresh.map(p => p.id)).size, 2);
  const occupant = fresh.find(p => p.currentRelativePath === 'Active/Alpha');
  assert.notEqual(occupant.id, f.project.id);
  assert.equal(occupant.propertyValues['property:notes'], undefined);
});

test('current Status is no-op; untrusted IDs, No status and occupied destinations fail before moving', async t => {
  const f = await fixture(t);
  assert.equal((await f.call('moveProjectStatus', { projectId: f.project.id, statusValueId: f.project.status.id })).state, 'unchanged');
  for (const statusValueId of ['../Done', '/tmp', 'statusValue:no-status'])
    await assert.rejects(f.call('moveProjectStatus', { projectId: f.project.id, statusValueId }), { code: statusValueId === 'statusValue:no-status' ? 'STATUS_MOVE_UNAVAILABLE' : 'STATUS_NOT_FOUND' });
  await assert.rejects(f.call('moveProjectStatus', { projectId: 'other', statusValueId: f.done.id }), { code: 'PROJECT_NOT_FOUND' });
  await mkdir(join(f.root, 'Done', 'Alpha'));
  const inode = (await lstat(join(f.root, 'Done', 'Alpha'))).ino;
  await assert.rejects(f.call('moveProjectStatus', { projectId: f.project.id, statusValueId: f.done.id }), { code: 'MOVE_TARGET_EXISTS' });
  assert.equal((await lstat(join(f.root, 'Done', 'Alpha'))).ino, inode);
  assert.equal(await readFile(join(f.root, 'Active', 'Alpha', '.private'), 'utf8'), 'hidden');
});

test('exclusive reservation rejects external empty/nonempty target races without replacement or merge', async t => {
  for (const nonempty of [false, true]) {
    let inode;
    const f = await fixture(t, { beforeTargetCreate: async ({ to }) => {
      await mkdir(to); inode = (await lstat(to)).ino;
      if (nonempty) await writeFile(join(to, 'foreign.txt'), 'untouched');
    } });
    await assert.rejects(f.call('moveProjectStatus', { projectId: f.project.id, statusValueId: f.done.id }), { code: 'MOVE_TARGET_EXISTS' });
    assert.equal((await lstat(join(f.root, 'Done', 'Alpha'))).ino, inode);
    if (nonempty) assert.equal(await readFile(join(f.root, 'Done', 'Alpha', 'foreign.txt'), 'utf8'), 'untouched');
    await missing(join(f.root, 'Done', 'Alpha', '.private'));
    assert.equal((await f.call('getProject', { projectId: f.project.id })).project.currentRelativePath, 'Active/Alpha');
  }
});

test('metadata or filesystem failures restore the original folder and clear pending state', async t => {
  for (const hook of ['beforeCopy', 'beforeMetadataCommit']) {
    const f = await fixture(t, { [hook]: async () => { throw new Error(`injected ${hook}`); } });
    await assert.rejects(f.call('moveProjectStatus', { projectId: f.project.id, statusValueId: f.done.id }), /injected/);
    assert.equal(await readFile(join(f.root, 'Active', 'Alpha', 'docs', 'plan.txt'), 'utf8'), 'plan');
    await missing(join(f.root, 'Done', 'Alpha'));
    assert.equal((await f.call('getProject', { projectId: f.project.id })).project.id, f.project.id);
    assert.equal(JSON.parse(await readFile(f.configPath, 'utf8')).projectMove, undefined);
  }
});

test('same-project requests are rejected while source scans await the committed move', async t => {
  let release, entered;
  const gate = new Promise(resolve => release = resolve);
  const ready = new Promise(resolve => entered = resolve);
  const f = await fixture(t, { beforeCopy: async () => { entered(); await gate; } });
  const moving = f.call('moveProjectStatus', { projectId: f.project.id, statusValueId: f.done.id });
  await ready;
  await assert.rejects(f.call('moveProjectStatus', { projectId: f.project.id, statusValueId: f.done.id }), { code: 'PROJECT_MOVE_PENDING' });
  let published = false;
  const scan = f.call('scan').then(result => { published = true; return result; });
  await new Promise(resolve => setTimeout(resolve, 15));
  assert.equal(published, false);
  release(); await moving;
  assert.equal((await scan).workspace.objects.find(p => p.id === f.project.id).source.path, 'Done/Alpha');
});

test('crash recovery before publication rolls back held copies or completes committed locations', async t => {
  for (const phase of ['afterCopy', 'afterHolding', 'afterMetadataCommit']) {
    const crash = Object.assign(new Error('simulated crash'), { simulateCrash: true });
    const f = await fixture(t, { [phase]: async () => { throw crash; } });
    await assert.rejects(f.call('moveProjectStatus', { projectId: f.project.id, statusValueId: f.done.id }), /simulated crash/);
    assert.ok(JSON.parse(await readFile(f.configPath, 'utf8')).projectMove);
    const restarted = createWorkspaceIpcHandler({ ...f.options, moveTestHooks: {} });
    const { project } = await restarted(null, 'workspace.getProject', { workspaceId: f.workspaceId, projectId: f.project.id });
    const expected = phase === 'afterMetadataCommit' ? 'Done/Alpha' : 'Active/Alpha';
    assert.equal(project.currentRelativePath, expected);
    assert.equal(await readFile(join(f.root, expected, 'docs/plan.txt'), 'utf8'), 'plan');
    assert.equal(JSON.parse(await readFile(f.configPath, 'utf8')).projectMove, undefined);
  }
});

test('duplicate status names and slug collisions resolve unique folder IDs, and symlink sources/targets are rejected', async t => {
  const f = await fixture(t);
  await mkdir(join(f.root, 'Team', 'Done'), { recursive: true });
  await f.call('updateFolderRole', { path: 'Team', role: 'group' });
  await f.call('updateFolderRole', { path: 'Team/Done', role: 'status' });
  const statuses = (await f.call('getViewProjection', { viewId: 'view:default-table' })).statusValues.filter(s => s.name === 'Done');
  assert.equal(statuses.length, 2); assert.notEqual(statuses[0].id, statuses[1].id);
  const nestedTarget = statuses.find(s => s.relativePath === 'Team/Done');
  await f.call('moveProjectStatus', { projectId: f.project.id, statusValueId: nestedTarget.id });
  assert.equal((await f.call('getProject', { projectId: f.project.id })).project.currentRelativePath, 'Team/Done/Alpha');
  const other = await fixture(t);
  await rm(join(other.root, 'Done'), { recursive: true });
  await symlink(join(other.root, 'Active'), join(other.root, 'Done'));
  await assert.rejects(other.call('moveProjectStatus', { projectId: other.project.id, statusValueId: other.done.id }));
  assert.equal(await readFile(join(other.root, 'Active/Alpha/.private'), 'utf8'), 'hidden');
});

test('external writes during copy and after holding are retained in the restored source', async t => {
  for (const phase of ['afterCopy', 'afterHolding']) {
    const f = await fixture(t, { [phase]: async ({ from, holding }) => {
      await writeFile(join(holding || from, 'docs/plan.txt'), 'external edit');
      await writeFile(join(holding || from, 'new.txt'), 'new external file');
    } });
    await assert.rejects(f.call('moveProjectStatus', { projectId: f.project.id, statusValueId: f.done.id }), { code: 'MOVE_SOURCE_CHANGED' });
    assert.equal(await readFile(join(f.root, 'Active/Alpha/docs/plan.txt'), 'utf8'), 'external edit');
    assert.equal(await readFile(join(f.root, 'Active/Alpha/new.txt'), 'utf8'), 'new external file');
    await missing(join(f.root, 'Done/Alpha'));
    assert.equal((await f.call('getProject', { projectId: f.project.id })).project.id, f.project.id);
  }
});

test('unknown target changes and occupied original location preserve recovery journal and every copy', async t => {
  for (const occupiedSource of [false, true]) {
    const f = await fixture(t, { afterHolding: async ({ from, to }) => {
      if (occupiedSource) { await mkdir(from); await writeFile(join(from, 'foreign.txt'), 'original occupant'); }
      else await writeFile(join(to, 'foreign.txt'), 'target occupant');
      throw new Error('injected rollback');
    } });
    await assert.rejects(f.call('moveProjectStatus', { projectId: f.project.id, statusValueId: f.done.id }), { code: 'MOVE_RECOVERY_REQUIRED' });
    const settings = JSON.parse(await readFile(f.configPath, 'utf8'));
    assert.ok(settings.projectMove);
    if (occupiedSource) {
      assert.equal(await readFile(join(f.root, 'Active/Alpha/foreign.txt'), 'utf8'), 'original occupant');
      assert.equal(await readFile(join(f.root, settings.projectMove.holding, 'docs/plan.txt'), 'utf8'), 'plan');
    } else {
      assert.equal(await readFile(join(f.root, 'Active/Alpha/docs/plan.txt'), 'utf8'), 'plan');
      assert.equal(await readFile(join(f.root, 'Done/Alpha/foreign.txt'), 'utf8'), 'target occupant');
    }
    const restarted = createWorkspaceIpcHandler({ ...f.options, moveTestHooks: {} });
    await assert.rejects(restarted(null, 'workspace.scan', { workspaceId: f.workspaceId }), { code: 'MOVE_RECOVERY_REQUIRED' });
    assert.ok(JSON.parse(await readFile(f.configPath, 'utf8')).projectMove);
  }
});

test('replacing an explicit move target never inherits moved identity or values', async t => {
  const f = await fixture(t);
  await f.call('createProperty', { propertyId: 'property:notes', name: 'Notes', type: 'text' });
  await f.call('updateProjectPropertyValue', { projectId: f.project.id, propertyId: 'property:notes', value: 'private' });
  await f.call('moveProjectStatus', { projectId: f.project.id, statusValueId: f.done.id });
  // Keep the old directory alive so inode reuse cannot make this test accidental.
  const fs = await import('node:fs/promises');
  await fs.rename(join(f.root, 'Done/Alpha'), join(f.root, 'Done/.saved-original'));
  await mkdir(join(f.root, 'Done/Alpha'));
  assert.equal((await f.call('getProject', { projectId: f.project.id })).project, null);
  const replacement = (await f.call('getViewProjection', { viewId: 'view:default-table' })).projection.rows[0];
  assert.notEqual(replacement.id, f.project.id);
  assert.equal(replacement.propertyValues['property:notes'], undefined);
});

test('a failed second move refreshes the verified restored alias so ID and values survive restart', async t => {
  let fail = false;
  const f = await fixture(t, { beforeMetadataCommit: async () => { if (fail) throw new Error('second move metadata fault'); } });
  await f.call('createProperty', { propertyId: 'property:notes', name: 'Notes', type: 'text' });
  await f.call('updateProjectPropertyValue', { projectId: f.project.id, propertyId: 'property:notes', value: 'keep' });
  await f.call('moveProjectStatus', { projectId: f.project.id, statusValueId: f.done.id });
  fail = true;
  await assert.rejects(f.call('moveProjectStatus', { projectId: f.project.id, statusValueId: f.project.status.id }), /second move/);
  const restarted = createWorkspaceIpcHandler({ ...f.options, moveTestHooks: {} });
  const { project } = await restarted(null, 'workspace.getProject', { workspaceId: f.workspaceId, projectId: f.project.id });
  assert.equal(project.currentRelativePath, 'Done/Alpha');
  assert.equal(project.propertyValues['property:notes'], 'keep');
  const entries = await (await import('node:fs/promises')).readdir(join(f.root, 'Done'));
  assert.deepEqual(entries, ['Alpha']);
});

test('replacement holding with identical bytes is retained and blocks recovery', async t => {
  const f = await fixture(t, { afterHolding: async ({ holding }) => {
    const fs = await import('node:fs/promises');
    await fs.rename(holding, holding + '-original');
    await fs.cp(holding + '-original', holding, { recursive: true, preserveTimestamps: true, dereference: false });
    throw Object.assign(new Error('crash after replacement'), { simulateCrash: true });
  } });
  await assert.rejects(f.call('moveProjectStatus', { projectId: f.project.id, statusValueId: f.done.id }));
  const settings = JSON.parse(await readFile(f.configPath, 'utf8'));
  const restarted = createWorkspaceIpcHandler({ ...f.options, moveTestHooks: {} });
  await assert.rejects(restarted(null, 'workspace.scan', { workspaceId: f.workspaceId }), { code: 'MOVE_RECOVERY_REQUIRED' });
  assert.equal(await readFile(join(f.root, settings.projectMove.holding, 'docs/plan.txt'), 'utf8'), 'plan');
  assert.equal(await readFile(join(f.root, settings.projectMove.holding + '-original', 'docs/plan.txt'), 'utf8'), 'plan');
});

test('legacy status colors and saved value filters survive newly disambiguated physical folders', async t => {
  const f = await fixture(t);
  await f.call('updateStatusValueColor', { statusValueId: f.done.id, color: 'purple' });
  await f.call('updateView', { viewId: 'view:default-table', patch: { valueVisibility: { 'property:status': { valueIds: [f.done.id] } } } });
  const viewsBefore = await readFile(f.options.viewStorePath, 'utf8');
  await mkdir(join(f.root, 'Team', 'Done', 'Beta'), { recursive: true });
  await f.call('updateFolderRole', { path: 'Team', role: 'group' });
  await f.call('updateFolderRole', { path: 'Team/Done', role: 'status' });
  const projection = await f.call('getViewProjection', { viewId: 'view:default-table' });
  const statuses = projection.statusValues.filter(s => s.name === 'Done');
  assert.equal(statuses.length, 2); assert.ok(statuses.every(s => s.color === 'purple'));
  assert.deepEqual(projection.view.valueVisibility['property:status'].valueIds.sort(), statuses.map(s => s.id).sort());
  assert.equal(projection.projection.rows[0].name, 'Beta');
  assert.equal(await readFile(f.options.viewStorePath, 'utf8'), viewsBefore);
});

test('actual metadata writer failure rolls back, and journal creation failure performs no filesystem mutation', async t => {
  const { writeWorkspaceSettings } = await import('../src/workspaceBackend.js');
  for (const failPhase of ['prepared', 'committed']) {
    const f = await fixture(t);
    let injected = false;
    const handler = createWorkspaceIpcHandler({ ...f.options, moveWriteSettings: async (path, data) => {
      if (!injected && data.projectMove?.phase === failPhase) { injected = true; throw Object.assign(new Error('metadata EIO'), { code: 'EIO' }); }
      return writeWorkspaceSettings(path, data);
    } });
    await assert.rejects(handler(null, 'workspace.moveProjectStatus', { workspaceId: f.workspaceId, projectId: f.project.id, statusValueId: f.done.id }), { code: 'EIO' });
    assert.equal(await readFile(join(f.root, 'Active/Alpha/.private'), 'utf8'), 'hidden');
    await missing(join(f.root, 'Done/Alpha'));
    assert.equal((await f.call('getProject', { projectId: f.project.id })).project.id, f.project.id);
  }
});

test('postcommit mismatch returns an honest committed recovery state and preserves authoritative copies', async t => {
  const f = await fixture(t, { afterMetadataCommit: async ({ holding }) => {
    await writeFile(join(holding, 'late-writer.txt'), 'late external write');
    throw new Error('cleanup failed after metadata commit');
  } });
  const result = await f.call('moveProjectStatus', { projectId: f.project.id, statusValueId: f.done.id });
  assert.equal(result.state, 'recovery-required'); assert.equal(result.committed, true);
  assert.equal(result.project.currentRelativePath, 'Done/Alpha');
  assert.equal(result.project.status.id, f.done.id);
  assert.equal(result.project.id, f.project.id);
  const journal = JSON.parse(await readFile(f.configPath, 'utf8')).projectMove;
  assert.equal(journal.phase, 'committed');
  assert.equal(await readFile(join(f.root, journal.holding, 'late-writer.txt'), 'utf8'), 'late external write');
  assert.equal(await readFile(join(f.root, 'Done/Alpha/docs/plan.txt'), 'utf8'), 'plan');
  const restarted = createWorkspaceIpcHandler({ ...f.options, moveTestHooks: {} });
  await assert.rejects(restarted(null, 'workspace.scan', { workspaceId: f.workspaceId }), { code: 'MOVE_RECOVERY_REQUIRED' });
});

test('a transient failure after durable commit reports the completed location after verified cleanup', async t => {
  const f = await fixture(t, { afterMetadataCommit: async () => { throw new Error('transient cleanup fault'); } });
  const result = await f.call('moveProjectStatus', { projectId: f.project.id, statusValueId: f.done.id });
  assert.equal(result.state, 'completed');
  assert.equal(result.to, 'Done/Alpha');
  assert.equal((await f.call('getProject', { projectId: f.project.id })).project.currentRelativePath, 'Done/Alpha');
  await missing(join(f.root, 'Active/Alpha'));
  assert.equal(JSON.parse(await readFile(f.configPath, 'utf8')).projectMove, undefined);
});

test('scan waits for a pending partial-copy failure and publishes only after verified target cleanup', async t => {
  let started, release;
  const copying = new Promise(resolve => { started = resolve; });
  const wait = new Promise(resolve => { release = resolve; });
  const f = await fixture(t, { beforeCopy: async ({ to }) => {
    await mkdir(join(to, 'docs'));
    const { readdir } = await import('node:fs/promises');
    assert.equal((await readdir(join(to, 'docs'))).length, 0);
    started(); await wait;
    throw Object.assign(new Error('partial-copy EIO'), { code: 'EIO' });
  } });
  const moving = f.call('moveProjectStatus', { projectId: f.project.id, statusValueId: f.done.id });
  const failure = assert.rejects(moving, { code: 'EIO' });
  await copying;
  assert.equal(JSON.parse(await readFile(f.configPath, 'utf8')).projectMove.phase, 'copying');
  let published = false;
  const scan = f.call('scan').then(value => { published = true; return value; });
  await new Promise(resolve => setTimeout(resolve, 15));
  assert.equal(published, false);
  release(); await failure;
  assert.equal((await scan).workspace.objects.length, 1);
  await missing(join(f.root, 'Done/Alpha'));
  assert.equal(JSON.parse(await readFile(f.configPath, 'utf8')).projectMove, undefined);
  assert.equal((await f.call('getProject', { projectId: f.project.id })).project.currentRelativePath, 'Active/Alpha');
  assert.equal(await readFile(join(f.root, 'Active/Alpha/docs/plan.txt'), 'utf8'), 'plan');
});

test('projects outside status folders retain the No status color and current no-op choice', async t => {
  const f = await fixture(t);
  await mkdir(join(f.root, 'Loose'));
  await f.call('updateFolderRole', { path: 'Loose', role: 'project' });
  await f.call('updateStatusValueColor', { statusValueId: 'statusValue:no-status', color: 'blue' });
  const projection = await f.call('getViewProjection', { viewId: 'view:default-table' });
  const loose = projection.projection.rows.find(p => p.name === 'Loose');
  assert.equal(loose.status.color, 'blue');
  assert.equal((await f.call('moveProjectStatus', { projectId: loose.id, statusValueId: loose.status.id })).state, 'unchanged');
});

test('marker-write failure and interruption before recorded target ownership retain prepared intent and block discovery', async t => {
  for (const crash of [false, true]) {
    const f = await fixture(t, { afterTargetCreate: async ({ to }) => {
      if (crash) throw Object.assign(new Error('interruption before ownership record'), { simulateCrash: true });
      // The actual marker write fails under the test user's filesystem permissions.
      await chmod(to, 0o000);
    } });
    const moving = f.call('moveProjectStatus', { projectId: f.project.id, statusValueId: f.done.id });
    if (crash) await assert.rejects(moving, /interruption before ownership/);
    else await assert.rejects(moving, { code: 'MOVE_RECOVERY_REQUIRED' });
    await chmod(join(f.root, 'Done/Alpha'), 0o755);
    const before = JSON.parse(await readFile(f.configPath, 'utf8')).projectMove;
    assert.equal(before.phase, 'prepared');
    assert.equal(before.targetIno, undefined);
    const restarted = createWorkspaceIpcHandler({ ...f.options, moveTestHooks: {} });
    await assert.rejects(restarted(null, 'workspace.scan', { workspaceId: f.workspaceId }), { code: 'MOVE_RECOVERY_REQUIRED' });
    assert.equal(JSON.parse(await readFile(f.configPath, 'utf8')).projectMove.id, before.id);
    assert.equal(await readFile(join(f.root, 'Active/Alpha/docs/plan.txt'), 'utf8'), 'plan');
    assert.equal((await lstat(join(f.root, 'Done/Alpha'))).isDirectory(), true);
  }
});

test('foreign holding containers and interrupted container ownership recording are retained and block recovery', async t => {
  for (const crash of [false, true]) {
    let container;
    const f = await fixture(t, crash ? { afterHoldingContainerCreate: async ({ holding }) => {
      container = holding.slice(0, holding.lastIndexOf('/'));
      throw Object.assign(new Error('interruption before container ownership record'), { simulateCrash: true });
    } } : { beforeTargetCreate: async ({ journal }) => {
      container = join(journal.rootPath, journal.holding.slice(0, journal.holding.lastIndexOf('/')));
      await mkdir(container);
    } });
    const moving = f.call('moveProjectStatus', { projectId: f.project.id, statusValueId: f.done.id });
    if (crash) await assert.rejects(moving, /interruption before container ownership/);
    else await assert.rejects(moving, { code: 'MOVE_RECOVERY_REQUIRED' });
    const before = await lstat(container);
    const journal = JSON.parse(await readFile(f.configPath, 'utf8')).projectMove;
    assert.ok(journal); assert.equal(journal.holdingIno, undefined);
    const restarted = createWorkspaceIpcHandler({ ...f.options, moveTestHooks: {} });
    await assert.rejects(restarted(null, 'workspace.scan', { workspaceId: f.workspaceId }), { code: 'MOVE_RECOVERY_REQUIRED' });
    const after = await lstat(container);
    assert.equal(after.dev, before.dev); assert.equal(after.ino, before.ino);
    assert.equal(JSON.parse(await readFile(f.configPath, 'utf8')).projectMove.id, journal.id);
    assert.equal(await readFile(join(f.root, 'Active/Alpha/docs/plan.txt'), 'utf8'), 'plan');
    assert.equal(await readFile(join(f.root, 'Done/Alpha/docs/plan.txt'), 'utf8'), 'plan');
  }
  let container, savedContainer;
  const replaced = await fixture(t, { afterHolding: async ({ holding }) => {
    container = holding.slice(0, holding.lastIndexOf('/'));
    savedContainer = `${container}-saved`;
    const { rename } = await import('node:fs/promises');
    await rename(container, savedContainer);
    await mkdir(container);
  } });
  await assert.rejects(replaced.call('moveProjectStatus', { projectId: replaced.project.id, statusValueId: replaced.done.id }), { code: 'MOVE_RECOVERY_REQUIRED' });
  const foreign = await lstat(container);
  const restarted = createWorkspaceIpcHandler({ ...replaced.options, moveTestHooks: {} });
  await assert.rejects(restarted(null, 'workspace.scan', { workspaceId: replaced.workspaceId }), { code: 'MOVE_RECOVERY_REQUIRED' });
  assert.equal((await lstat(container)).ino, foreign.ino);
  assert.equal(await readFile(join(savedContainer, 'Alpha/docs/plan.txt'), 'utf8'), 'plan');
  assert.equal(await readFile(join(replaced.root, 'Done/Alpha/docs/plan.txt'), 'utf8'), 'plan');
  assert.ok(JSON.parse(await readFile(replaced.configPath, 'utf8')).projectMove);
});
