import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, constants } from 'node:fs';
import { chmod, open, lutimes, lstat, mkdir, readdir, readFile, readlink, rename, rm, rmdir, symlink, utimes, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative } from 'node:path';
import { resolveWorkspacePath } from './localOpen.js';
import { readWorkspaceSettings, writeWorkspaceSettings } from './workspaceBackend.js';

const noStatus = { id: 'statusValue:no-status', name: 'No status', relativePath: null, source: 'no-status', moveDisabledReason: 'no-status-target' };
const slug = value => String(value).normalize('NFKD').toLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, '-').replace(/^-|-$/g, '') || 'untitled';
const error = (code, message) => Object.assign(new Error(message), { code });
const within = (path, parent) => path === parent || path.startsWith(`${parent}/`);

// Keep existing unique-name status IDs/colors, while disambiguating actual paths.
export function deriveFolderStatusValues(sourceId, tree) {
  const statuses = [];
  let hasUnassignedProject = false;
  function visit(nodes, parentStatus = false) {
    for (const node of nodes) {
      if (node.access === false) continue;
      if (node.role === 'card') { if (!parentStatus) hasUnassignedProject = true; continue; }
      if (node.role === 'status') statuses.push({ name: node.name, relativePath: node.path, source: 'folderRole', ...(parentStatus ? { moveDisabledReason: 'nested-status-target' } : {}) });
      visit(node.children || [], parentStatus || node.role === 'status');
    }
  }
  visit(tree);
  const counts = new Map();
  for (const status of statuses) counts.set(slug(status.name), (counts.get(slug(status.name)) || 0) + 1);
  return [...statuses.map(status => {
    const legacyId = `statusValue:${slug(sourceId)}:${slug(status.name)}`;
    return { ...status, id: counts.get(slug(status.name)) > 1 ? `${legacyId}:${createHash('sha256').update(status.relativePath).digest('hex').slice(0, 16)}` : legacyId, legacyId };
  }), ...(statuses.length && !hasUnassignedProject ? [] : [{ ...noStatus }])];
}

export function statusForProject(path, statuses) {
  return statuses.filter(status => status.relativePath && within(path, status.relativePath))
    .sort((a, b) => b.relativePath.length - a.relativePath.length)[0] || statuses.find(status => status.id === noStatus.id) || { ...noStatus };
}

async function statOrNull(path) {
  try { return await lstat(path); } catch (cause) { if (cause.code === 'ENOENT') return null; throw cause; }
}

async function safeDirectory(root, path) {
  const full = path ? resolveWorkspacePath(root, path) : root;
  let current = root;
  const rootStat = await lstat(root);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) throw error('MOVE_INVALID_PATH', 'Source folder must be a real directory.');
  for (const part of path ? path.split('/') : []) {
    if (!part || part === '.' || part === '..' || part.includes('\\')) throw error('MOVE_INVALID_PATH', 'Invalid project folder locator.');
    current = join(current, part);
    const stat = await lstat(current);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw error('MOVE_INVALID_PATH', 'Move paths must be real directories, without symlinks.');
  }
  return full;
}

async function fingerprint(path, marker) {
  const result = {};
  async function visit(base, prefix = '') {
    for (const entry of await readdir(base, { withFileTypes: true })) {
      if (!prefix && entry.name === marker) continue;
      const key = prefix ? `${prefix}/${entry.name}` : entry.name;
      const full = join(base, entry.name), stat = await lstat(full);
      const mode = stat.mode & 0o777;
      if (stat.isSymbolicLink()) result[key] = { kind: 'link', link: await readlink(full) };
      else if (stat.isDirectory()) { result[key] = { kind: 'directory', mode }; await visit(full, key); }
      else if (stat.isFile()) {
        const hash = createHash('sha256');
        for await (const chunk of createReadStream(full, { flags: constants.O_RDONLY | constants.O_NOFOLLOW })) hash.update(chunk);
        result[key] = { kind: 'file', mode, hash: hash.digest('hex') };
      } else throw error('MOVE_UNSUPPORTED_ENTRY', `Unsupported filesystem entry: ${key}`);
    }
  }
  await visit(path);
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
}
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function copyContents(from, to) {
  for (const entry of await readdir(from, { withFileTypes: true })) {
    const source = join(from, entry.name), target = join(to, entry.name), stat = await lstat(source);
    if (stat.isSymbolicLink()) { await symlink(await readlink(source), target); await lutimes(target, stat.atime, stat.mtime); }
    else if (stat.isDirectory()) {
      await mkdir(target); // EEXIST is a conflict even for an empty directory.
      await copyContents(source, target);
      await chmod(target, stat.mode & 0o777); await utimes(target, stat.atime, stat.mtime);
    } else if (stat.isFile()) {
      const input = await open(source, constants.O_RDONLY | constants.O_NOFOLLOW);
      let output;
      try {
        const actual = await input.stat();
        if (actual.dev !== stat.dev || actual.ino !== stat.ino) throw error('MOVE_SOURCE_CHANGED', 'Source file changed during copy.');
        output = await open(target, 'wx');
        for await (const chunk of input.createReadStream({ autoClose: false })) await output.writeFile(chunk);
      } finally { await input.close(); await output?.close(); }
      await chmod(target, stat.mode & 0o777); await utimes(target, stat.atime, stat.mtime);
    } else throw error('MOVE_UNSUPPORTED_ENTRY', `Unsupported filesystem entry: ${entry.name}`);
  }
}

async function ownedTarget(root, journal) {
  const target = resolveWorkspacePath(root, journal.to);
  const stat = await statOrNull(target);
  if (!stat) return null;
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw error('MOVE_RECOVERY_REQUIRED', 'Move target changed. Both locations were retained for recovery.');
  if (journal.targetIno && (stat.ino !== journal.targetIno || stat.dev !== journal.targetDev))
    throw error('MOVE_RECOVERY_REQUIRED', 'Move target identity changed. Both locations were retained for recovery.');
  const marker = await readFile(join(target, journal.marker), 'utf8').catch(() => null);
  if (marker !== journal.id) {
    // A crash or marker-write failure may follow successful exclusive mkdir.
    // Without recorded ownership, an existing target is ambiguous, not foreign.
    if (!journal.targetIno) throw error('MOVE_RECOVERY_REQUIRED', 'Move target ownership was not recorded. The target and journal were retained.');
    if (journal.phase !== 'committed') throw error('MOVE_RECOVERY_REQUIRED', 'Move ownership marker is missing. Both locations were retained.');
  }
  return target;
}

async function removeCopiedTarget(root, journal) {
  const target = await ownedTarget(root, journal);
  if (!target) return;
  const actual = await fingerprint(target, journal.marker);
  for (const [key, value] of Object.entries(actual)) {
    if (!equal(value, journal.manifest[key])) throw error('MOVE_RECOVERY_REQUIRED', 'Move target has new or changed contents. Both locations were retained for recovery.');
  }
  await rm(target, { recursive: true });
}

async function ownedHoldingContainer(root, journal) {
  const container = dirname(resolveWorkspacePath(root, journal.holding));
  const stat = await statOrNull(container);
  if (!stat) return null;
  if (!stat.isDirectory() || stat.isSymbolicLink() || !journal.holdingIno ||
      stat.dev !== journal.holdingDev || stat.ino !== journal.holdingIno)
    throw error('MOVE_RECOVERY_REQUIRED', 'Holding container ownership is unknown or changed; all folders and the journal were retained.');
  return container;
}

function remapRules(rules, from, to) {
  const next = { ...rules };
  for (const [path, rule] of Object.entries(rules || {})) {
    if (within(path, from)) { delete next[path]; next[to + path.slice(from.length)] = rule; }
  }
  return next;
}

function commitLocations(settings, journal) {
  const { rootPath, from, to, sourceId, projectId } = journal;
  const workspaceSources = structuredClone(settings.workspaceSources || {});
  for (const binding of Object.values(workspaceSources)) {
    if (binding.rulesByRoot?.[rootPath]) binding.rulesByRoot[rootPath] = remapRules(binding.rulesByRoot[rootPath], from, to);
  }
  return {
    ...settings,
    ...(settings.rootPath === rootPath ? { folderRules: remapRules(settings.folderRules, from, to) } : {}),
    workspaceSources,
    projectLocators: { ...settings.projectLocators, [sourceId]: { ...settings.projectLocators?.[sourceId], [projectId]: { path: to, dev: journal.targetDev, ino: journal.targetIno } } },
    projectMove: { ...journal, phase: 'committed' },
  };
}

// One journal in the existing atomic JSON settings file. Caller holds the main
// mutation/read barrier. Recovery is run before any discovery publication.
export function createProjectStatusMover({ configPath, testHooks = {}, writeSettings = writeWorkspaceSettings }) {
  async function saveJournal(journal) {
    const settings = await readWorkspaceSettings(configPath);
    await writeSettings(configPath, { ...settings, projectMove: journal });
  }
  async function clearJournal() {
    const settings = await readWorkspaceSettings(configPath);
    const { projectMove: _move, ...rest } = settings;
    await writeSettings(configPath, rest);
  }
  async function removeHoldingContainer(root, journal) {
    const container = await ownedHoldingContainer(root, journal);
    if (container) await rmdir(container).catch(() => { throw error('MOVE_RECOVERY_REQUIRED', 'Holding container is not empty or unavailable; the journal was retained.'); });
  }
  async function recover() {
    const settings = await readWorkspaceSettings(configPath), journal = settings.projectMove;
    if (!journal) return;
    const root = journal.rootPath;
    const sourceParent = dirname(journal.from) === '.' ? '' : dirname(journal.from);
    const expectedHolding = [sourceParent, `.workspace-move-${journal.id}`, basename(journal.from)].filter(Boolean).join('/');
    if (journal.version !== 1 || journal.holding !== expectedHolding || journal.marker !== `.workspace-move-${journal.id}` || !journal.manifest)
      throw error('MOVE_RECOVERY_REQUIRED', 'Move journal is invalid; files were retained.');
    await safeDirectory(root, sourceParent);
    const from = resolveWorkspacePath(root, journal.from), holding = resolveWorkspacePath(root, journal.holding);
    await safeDirectory(root, dirname(journal.to) === '.' ? '' : dirname(journal.to));
    // Validate container ownership before restoring or deleting any copies.
    // Interrupted creation before the inode journal is deliberately ambiguous.
    await ownedHoldingContainer(root, journal);
    const held = await statOrNull(holding);
    if (held) {
      await safeDirectory(root, journal.holding);
      if (held.dev !== journal.sourceDev || held.ino !== journal.sourceIno)
        throw error('MOVE_RECOVERY_REQUIRED', 'Holding folder identity changed; all folders and the journal were retained.');
    }
    if (journal.phase === 'committed') {
      const target = await ownedTarget(root, journal);
      if (!target || !equal(await fingerprint(target, journal.marker), journal.manifest)) throw error('MOVE_RECOVERY_REQUIRED', 'Committed move target changed; holding copy was retained.');
      if (held) {
        if (!equal(await fingerprint(holding), journal.manifest)) throw error('MOVE_RECOVERY_REQUIRED', 'Source changed during the move; holding copy was retained.');
        await rm(holding, { recursive: true });
      }
      await rm(join(target, journal.marker), { force: true });
      await removeHoldingContainer(root, journal);
      await clearJournal(); return;
    }
    if (held) {
      if (await statOrNull(from)) throw error('MOVE_RECOVERY_REQUIRED', 'Original location is occupied; holding and target copies were retained.');
      // Exclusive recreation never replaces an external directory. The holding
      // copy is authoritative, including writes detected after the first copy.
      await mkdir(from);
      await copyContents(holding, from);
      const stat = await lstat(holding); await chmod(from, stat.mode & 0o777); await utimes(from, stat.atime, stat.mtime);
      if (!equal(await fingerprint(from), await fingerprint(holding))) throw error('MOVE_RECOVERY_REQUIRED', 'Restoration could not be verified; all copies were retained.');
      // Restoring our verified copy changes the inode. Refresh only the existing
      // explicit-move alias, so a second failed move keeps its original ID.
      const current = await readWorkspaceSettings(configPath);
      const locator = current.projectLocators?.[journal.sourceId]?.[journal.projectId];
      if (locator?.path === journal.from) {
        const restored = await lstat(from);
        await writeSettings(configPath, { ...current, projectLocators: { ...current.projectLocators,
          [journal.sourceId]: { ...current.projectLocators[journal.sourceId], [journal.projectId]: { path: journal.from, dev: restored.dev, ino: restored.ino } } } });
      }
      await rm(holding, { recursive: true });
    }
    await removeCopiedTarget(root, journal);
    await removeHoldingContainer(root, journal);
    await clearJournal();
  }

  async function move({ rootPath, sourceId, project, status }) {
    if (project.status.id === status.id) return { state: 'unchanged', projectId: project.id, from: project.currentRelativePath, to: project.currentRelativePath };
    if (!status.relativePath || status.moveDisabledReason) throw error('STATUS_MOVE_UNAVAILABLE', 'This status has no unambiguous physical destination.');
    const fromPath = project.currentRelativePath;
    const from = await safeDirectory(rootPath, fromPath), parent = await safeDirectory(rootPath, status.relativePath);
    const toPath = `${status.relativePath}/${basename(from)}`, to = resolveWorkspacePath(rootPath, toPath);
    if (within(status.relativePath, fromPath) || within(fromPath, toPath) || within(toPath, fromPath)) throw error('MOVE_INVALID_PATH', 'Move destination overlaps the project folder.');
    if (await statOrNull(to)) throw error('MOVE_TARGET_EXISTS', 'A folder with this project name already exists in the destination.');
    const sourceStat = await lstat(from);
    const id = randomUUID(), marker = `.workspace-move-${id}`;
    const holdingParentPath = [dirname(fromPath) === '.' ? '' : dirname(fromPath), `.workspace-move-${id}`].filter(Boolean).join('/');
    let journal = { version: 1, id, rootPath, sourceId, sourceDev: sourceStat.dev, sourceIno: sourceStat.ino, projectId: project.id, from: fromPath, to: toPath, holding: `${holdingParentPath}/${basename(from)}`, marker, phase: 'prepared', manifest: await fingerprint(from) };
    const holding = resolveWorkspacePath(rootPath, journal.holding);
    await saveJournal(journal); // Durable intent precedes any filesystem mutation.
    try {
      await testHooks.beforeTargetCreate?.({ from, to, journal });
      try { await mkdir(to); } catch (cause) {
        if (cause.code === 'EEXIST') {
          // This mkdir result proves we never reserved the foreign target. Clear
          // only our prepared intent; recovery must not inspect or remove it.
          const current = await readWorkspaceSettings(configPath);
          if (current.projectMove?.id !== id || current.projectMove.phase !== 'prepared')
            throw error('MOVE_RECOVERY_REQUIRED', 'Move intent changed; the target and journal were retained.');
          await clearJournal();
          throw error('MOVE_TARGET_EXISTS', 'A folder with this project name already exists in the destination.');
        }
        throw cause;
      }
      await testHooks.afterTargetCreate?.({ from, to, journal });
      await writeFile(join(to, marker), id, { flag: 'wx' });
      const targetStat = await lstat(to);
      journal = { ...journal, phase: 'copying', targetIno: targetStat.ino, targetDev: targetStat.dev };
      await saveJournal(journal);
      await testHooks.beforeCopy?.({ from, to, journal });
      await copyContents(from, to);
      await chmod(to, sourceStat.mode & 0o777); await utimes(to, sourceStat.atime, sourceStat.mtime);
      if (!equal(await fingerprint(to, marker), journal.manifest) || !equal(await fingerprint(from), journal.manifest)) throw error('MOVE_SOURCE_CHANGED', 'Project contents changed during the move. The original was retained.');
      journal = { ...journal, phase: 'copied' }; await saveJournal(journal);
      await testHooks.afterCopy?.({ from, to, journal });
      await safeDirectory(rootPath, fromPath); await safeDirectory(rootPath, status.relativePath);
      const currentStat = await lstat(from);
      if (currentStat.ino !== sourceStat.ino || currentStat.dev !== sourceStat.dev) throw error('MOVE_SOURCE_CHANGED', 'Project folder changed during the move.');
      await mkdir(dirname(holding)); // Unique private parent; never rename over a supplied target.
      await testHooks.afterHoldingContainerCreate?.({ from, to, holding, journal });
      const containerStat = await lstat(dirname(holding));
      journal = { ...journal, holdingDev: containerStat.dev, holdingIno: containerStat.ino };
      await saveJournal(journal); // Durable container ownership precedes source rename.
      await ownedHoldingContainer(rootPath, journal);
      if (await statOrNull(holding)) throw error('MOVE_RECOVERY_REQUIRED', 'Holding location is occupied.');
      await rename(from, holding);
      journal = { ...journal, phase: 'held' }; await saveJournal(journal);
      await testHooks.afterHolding?.({ from, to, holding, journal });
      if (!equal(await fingerprint(holding), journal.manifest) || !equal(await fingerprint(to, marker), journal.manifest)) throw error('MOVE_SOURCE_CHANGED', 'Project contents changed before commit. The original contents were retained.');
      await testHooks.beforeMetadataCommit?.({ from, to, holding, journal });
      // Recheck after the last awaited hook; no production delay is introduced.
      if (!equal(await fingerprint(holding), journal.manifest) || !equal(await fingerprint(to, marker), journal.manifest)) throw error('MOVE_SOURCE_CHANGED', 'Project contents changed before commit.');
      const heldStat = await lstat(holding);
      if (heldStat.dev !== journal.sourceDev || heldStat.ino !== journal.sourceIno) throw error('MOVE_RECOVERY_REQUIRED', 'Holding folder identity changed.');
      await ownedHoldingContainer(rootPath, journal);
      await ownedTarget(rootPath, journal);
      const settings = await readWorkspaceSettings(configPath);
      await writeSettings(configPath, commitLocations(settings, journal));
      journal = { ...journal, phase: 'committed' };
      await testHooks.afterMetadataCommit?.({ from, to, holding, journal });
      await recover();
      return { state: 'completed', projectId: project.id, from: fromPath, to: toPath, statusValueId: status.id };
    } catch (cause) {
      if (cause.simulateCrash === true) throw cause; // Only injectable backend test hooks can suspend recovery.
      try { await recover(); } catch (recovery) {
        const current = await readWorkspaceSettings(configPath).catch(() => null);
        if (current?.projectMove?.phase === 'committed') return { state: 'recovery-required', committed: true,
          projectId: project.id, from: fromPath, to: toPath,
          project: { ...project, currentRelativePath: toPath, status, propertyValues: { ...project.propertyValues, 'property:status': status.id }, fileTree: [] },
          error: { code: 'MOVE_RECOVERY_REQUIRED', message: `${cause.message} Files are at ${toPath}. Holding copy: ${journal.holding}. ${recovery.message}` } };
        throw error('MOVE_RECOVERY_REQUIRED', `${cause.message} Recovery requires attention: ${recovery.message} Original: ${fromPath}; target: ${toPath}; holding: ${journal.holding}`);
      }
      // A verified recovery after durable publication completed the move. The
      // renderer must refresh the new location instead of reporting a rollback.
      if (journal.phase === 'committed') return { state: 'completed', projectId: project.id,
        from: fromPath, to: toPath, statusValueId: status.id, recovered: true };
      throw cause;
    }
  }
  return { move, recover };
}
