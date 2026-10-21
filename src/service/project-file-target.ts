import { spawnSync } from "node:child_process";
import { accessSync, constants, lstatSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import type { ProjectFileTarget } from '../contracts/project-files.js';
import { isTrustedProjectRevealTarget, type TrustedProjectRevealTarget } from '../contracts/service-protocol.js';
import { sameIdentity, reliableIdentity } from './discovery.js';
import { RevealFailure, validProjectBasename, verifyTrustedProjectRevealTarget } from './project-filesystem.js';

// Private backend/main target: no paths or native evidence are supplied by renderer.
export function inspectProjectItem(base: string, relativePath: string): { path: string; components: ProjectFileTarget['components'] } {
  const names = relativePath === '' ? [] : relativePath.split('/');
  if (names.some(name => !validProjectBasename(name, process.platform))) throw new RevealFailure('unresolved');
  let path = base;
  const components: ProjectFileTarget['components'] = [];
  for (const [index, name] of names.entries()) {
    path = join(path, name);
    const stat = lstatSync(path, { bigint: true });
    const identity = { dev: String(stat.dev), ino: String(stat.ino), birthtimeNs: String(stat.birthtimeNs) };
    if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile()) || !reliableIdentity(identity) ||
      (!stat.isDirectory() && (index !== names.length - 1 || stat.nlink !== 1n)) || realpathSync.native(path) !== path) throw new RevealFailure('replaced');
    accessSync(path, constants.R_OK | (stat.isDirectory() ? constants.X_OK : 0));
    components.push({ identity: JSON.stringify(identity), kind: stat.isDirectory() ? 'directory' : 'file' });
  }
  return { path, components };
}
export function verifyProjectFileTarget(target: TrustedProjectRevealTarget): string {
  if (!isTrustedProjectRevealTarget(target)) throw new RevealFailure("unresolved");
  const { item, ...project } = target;
  const base = verifyTrustedProjectRevealTarget(project);
  if (!item) return base;
  try {
    const current = inspectProjectItem(base, item.relativePath);
    if (current.components.length !== item.components.length || current.components.some((component, index) =>
      component.kind !== item.components[index].kind || !sameIdentity(JSON.parse(component.identity), JSON.parse(item.components[index].identity))) ||
      (item.action === 'open' && current.components.at(-1)?.kind !== 'file')) throw new RevealFailure('replaced');
    if (item.action === 'open') assertExternalFile(current.path);
    verifyTrustedProjectRevealTarget(project);
    return current.path;
  } catch (error) {
    if (error instanceof RevealFailure) throw error;
    throw new RevealFailure(typeof error === 'object' && error !== null && 'code' in error && ['ENOENT', 'ENOTDIR'].includes(String(error.code)) ? 'missing' : 'unavailable');
  }
}

function assertExternalFile(path: string): void {
  // Shell links are ordinary files to lstat, but Open activates a different target.
  if (/\.(lnk|url|webloc|alias)$/i.test(path)) throw new RevealFailure('replaced');
  if (process.platform !== 'darwin') return;
  // Finder aliases may have no extension or data fork. Read the OS alias flag
  // only for Open, with a fixed executable and bounded hex output. `-s` avoids
  // following a symlink substituted while this extra check is in progress.
  const result = spawnSync('/usr/bin/xattr', ['-s', '-p', '-x', 'com.apple.FinderInfo', path], { timeout: 1000, maxBuffer: 4096 });
  if (result.error) throw new RevealFailure('unavailable');
  if (result.status === 0) {
    const encoded = result.stdout.toString('ascii').replace(/\s/g, '');
    if (!/^[a-f0-9]{64}$/i.test(encoded)) throw new RevealFailure('unavailable');
    if ((Buffer.from(encoded, 'hex').readUInt16BE(8) & 0x8000) !== 0) throw new RevealFailure('replaced');
  } else if (result.status !== 1 || !result.stderr.toString('utf8').endsWith('No such xattr: com.apple.FinderInfo\n')) {
    throw new RevealFailure('unavailable');
  }
}
