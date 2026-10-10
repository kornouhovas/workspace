import assert from 'node:assert/strict';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { scanDirectSource, scanGroupedSource } from '../src/service/discovery.ts';

const hostPlatform = process.platform;
function fixture(t) {
  const directory = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), 'scan-canonical-')));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const root = join(directory, 'Root-Mixed-日本語');
  const category = join(root, 'Category-Микс'), project = join(category, 'Project-秘密');
  fs.mkdirSync(project, { recursive: true });
  fs.writeFileSync(join(project, 'sentinel'), 'unchanged\0bytes');
  return { directory, root, category, project };
}
function withResolvers(platform, run, { legacy, native } = {}) {
  const descriptor = Object.getOwnPropertyDescriptor(process, 'platform');
  const original = fs.realpathSync, originalNative = original.native;
  const calls = { legacy: [], native: [] };
  const replacement = (path) => { calls.legacy.push(path); return (legacy ?? original)(path); };
  replacement.native = (path) => { calls.native.push(path); return (native ?? originalNative)(path); };
  Object.defineProperty(process, 'platform', { value: platform });
  fs.realpathSync = replacement; syncBuiltinESMExports();
  try { return run(calls); }
  finally { fs.realpathSync = original; syncBuiltinESMExports(); Object.defineProperty(process, 'platform', descriptor); }
}

for (const [mode, scan] of [['direct', scanDirectSource], ['grouped', scanGroupedSource]]) {
  test(`Windows ${mode} discovery avoids native descendant opens and keeps native root checks`, (t) => {
    const { root, category, project } = fixture(t);
    const originalNative = fs.realpathSync.native;
    withResolvers('win32', (calls) => {
      const result = scan(root, null, []);
      assert.equal(result.state, 'ready');
      assert.ok(result.snapshot);
      assert.ok(calls.native.length > 1);
      assert.ok(calls.native.every(path => path === root));
      assert.ok(calls.legacy.includes(category));
      if (mode === 'grouped') assert.ok(calls.legacy.includes(project));
      assert.deepEqual(result.entries.map(entry => entry.relativePath), mode === 'direct'
        ? ['Category-Микс'] : ['Category-Микс', 'Category-Микс/Project-秘密']);
    }, { native: path => {
      if (path !== root) throw Object.assign(new Error('native descendant contention'), { code: 'EPERM' });
      return originalNative(path);
    } });
    assert.equal(fs.readFileSync(join(project, 'sentinel'), 'utf8'), 'unchanged\0bytes');
  });
  test(`${mode} discovery keeps native descendants outside Windows`, (t) => {
    const { root, category } = fixture(t);
    withResolvers(hostPlatform === 'win32' ? 'darwin' : hostPlatform, calls => {
      assert.equal(scan(root, null, []).state, 'ready');
      assert.ok(calls.native.includes(category)); assert.deepEqual(calls.legacy, []);
    });
  });
  test(`Windows ${mode} discovery rejects a changed canonical root and escaped descendant`, (t) => {
    const { directory, root, category } = fixture(t);
    withResolvers('win32', () => {
      assert.deepEqual(scan(root, null, []), { state: 'root_identity_conflict', entries: [], snapshot: null });
    }, { native: () => directory });
    const original = fs.realpathSync;
    withResolvers('win32', () => {
      assert.deepEqual(scan(root, null, []), { state: 'changed', entries: [], snapshot: null });
    }, { legacy: path => path === category ? directory : original(path) });
  });
  for (const link of [false, true]) test(`Windows ${mode} discovery rejects a descendant ${link ? 'junction/link' : 'identity'} swap during resolution`, (t) => {
    const { directory, root, category, project } = fixture(t);
    const external = join(directory, 'External'); fs.mkdirSync(external);
    const original = fs.realpathSync;
    const target = mode === 'direct' ? category : project;
    let swapped = false;
    withResolvers('win32', () => {
      assert.deepEqual(scan(root, null, []), { state: 'changed', entries: [], snapshot: null });
      assert.equal(swapped, true);
    }, { legacy: path => {
      const resolved = original(path);
      if (path === target && !swapped) {
        swapped = true; fs.renameSync(target, join(directory, 'Held'));
        if (link) fs.symlinkSync(external, target, hostPlatform === 'win32' ? 'junction' : 'dir');
        else fs.mkdirSync(target);
      }
      return resolved;
    } });
  });
  test(`Windows ${mode} discovery excludes links before either resolver`, (t) => {
    const { directory, root, category } = fixture(t);
    const external = join(directory, 'External'); fs.mkdirSync(external);
    const link = join(mode === 'direct' ? root : category, 'Linked');
    fs.symlinkSync(external, link, hostPlatform === 'win32' ? 'junction' : 'dir');
    withResolvers('win32', calls => {
      const result = scan(root, null, []);
      assert.equal(result.state, 'ready');
      assert.equal(result.entries.find(entry => entry.name === 'Linked').reason, 'link');
      assert.ok(![...calls.legacy, ...calls.native].some(path => path === link || path === external));
    });
  });
}
