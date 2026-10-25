import {observeFolder,sameDurableFolder,durableOwnershipKey} from './folder-evidence.js';
import type {EvidenceReader} from './source-identity.js';
import { spawnSync } from "node:child_process";
import { accessSync, constants, lstatSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import type { ProjectFileTarget } from '../contracts/project-files.js';
import { isTrustedProjectRevealTarget, type TrustedProjectRevealTarget } from '../contracts/service-protocol.js';
import { sameIdentity, reliableIdentity } from './discovery.js';
import { RevealFailure, validProjectBasename, verifyTrustedProjectRevealTarget } from './project-filesystem.js';

// Private backend/main target: no paths or native evidence are supplied by renderer.
export function inspectProjectItem(base: string, relativePath: string,scope?:string,reader:EvidenceReader=observeFolder): { path: string; components: ProjectFileTarget['components'] } {
  const names = relativePath === '' ? [] : relativePath.split('/');
  if (names.some(name => !validProjectBasename(name, process.platform))) throw new RevealFailure('unresolved');
  let path = base;
  const components: ProjectFileTarget['components'] = [];
  for (const [index, name] of names.entries()) {
    path = join(path, name);
    const stat = lstatSync(path, { bigint: true });
    const identity = { dev: String(stat.dev), ino: String(stat.ino), birthtimeNs: String(stat.birthtimeNs) };
    if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile()) || !reliableIdentity(identity) ||
      (!stat.isDirectory() && (index !== names.length - 1 || stat.nlink !== 1n)) || (process.platform==='win32'?realpathSync(path):realpathSync.native(path)) !== path) throw new RevealFailure('replaced');
    accessSync(path, constants.R_OK | (stat.isDirectory() ? constants.X_OK : 0));
    const observation=scope&&stat.isDirectory()?reader(path,scope):undefined;
    if(observation && (!observation.ok || !sameIdentity(observation.mount,identity) || observation.evidence.scope!==scope))throw new RevealFailure('replaced');
    components.push({identity:JSON.stringify(identity),kind:stat.isDirectory()?'directory':'file',...(observation?.ok?{observation}:{})});
  }
  return { path, components };
}
export function verifyProjectFileTarget(target: TrustedProjectRevealTarget): string {
  if (!isTrustedProjectRevealTarget(target)) throw new RevealFailure("unresolved");
  const { item, ...project } = target;
  const base = verifyTrustedProjectRevealTarget(project);
  if (!item) return base;
  try {
    const root=project.authorization?.folders[0];
    const current = inspectProjectItem(base,item.relativePath,root?.evidence.scope);
    if(root) {
      const keys=new Set(project.authorization!.folders.map(folder=>durableOwnershipKey(folder.evidence)));
      for(const [index,component] of item.components.entries()) {
        if(JSON.parse(component.identity).dev!==root.mount.dev)throw new RevealFailure('replaced');
        if(component.kind!=="directory"){if(component.observation)throw new RevealFailure('unresolved');continue;}
        const proof=component.observation,now=current.components[index]?.observation;
        if(!proof || !now || !sameDurableFolder(proof.evidence,now.evidence) || !sameIdentity(proof.mount,now.mount) ||
          proof.evidence.scope!==root.evidence.scope || proof.evidence.volume!==root.evidence.volume || proof.evidence.serial!==root.evidence.serial ||
          proof.evidence.provider!==root.evidence.provider || keys.has(durableOwnershipKey(proof.evidence)))throw new RevealFailure('replaced');
        keys.add(durableOwnershipKey(proof.evidence));
      }
    }
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
