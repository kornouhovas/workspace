import { opendirSync } from 'node:fs';
import type { TrustedProjectRevealTarget, NativeProjectReveal } from '../contracts/service-protocol.js';
import { isProjectFilesRequest, type ProjectFilesResult, type ProjectFileResult, type ProjectFileEntry } from '../contracts/project-files.js';
import type { ServiceResult } from '../contracts/settings.js';
import { InvalidReveal } from './project-reveal.js';
import { RevealFailure, verifyTrustedProjectRevealTarget } from './project-filesystem.js';
import { inspectProjectItem, verifyProjectFileTarget } from './project-file-target.js';

export function createProjectFilesService(authorize: (workspaceId: string, projectId: string) => TrustedProjectRevealTarget) {
  function rejected(input: { workspaceId: string; projectId: string; relativePath: string }, error: unknown): ServiceResult<never> | ServiceResult<Extract<ProjectFilesResult, { outcome: 'rejected' }>> {
    if (error instanceof InvalidReveal) return invalid();
    const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
    return { ok: true, value: { workspaceId: input.workspaceId, projectId: input.projectId, relativePath: input.relativePath,
      outcome: 'rejected', problem: error instanceof RevealFailure ? error.problem : ['ENOENT', 'ENOTDIR'].includes(code) ? 'missing' : 'unavailable' } };
  }
  function current(input: { workspaceId: string; projectId: string; relativePath: string }) {
    const target = authorize(input.workspaceId, input.projectId);
    const base = verifyTrustedProjectRevealTarget(target);
    return { target, ...inspectProjectItem(base, input.relativePath) };
  }
  return {
    listProjectFiles(input: unknown): ServiceResult<ProjectFilesResult> {
      if (!isProjectFilesRequest(input) || input.type !== 'workspace.listProjectFiles') return invalid();
      try {
        const initial = current(input);
        if (initial.components.length && initial.components.at(-1)?.kind !== 'directory') throw new RevealFailure('unavailable');
        const directory = opendirSync(initial.path), entries: ProjectFileEntry[] = [];
        try {
          for (let entry = directory.readSync(); entry; entry = directory.readSync()) {
            const relativePath = input.relativePath ? `${input.relativePath}/${entry.name}` : entry.name;
            let kind: ProjectFileEntry['kind'] = 'unavailable';
            try { kind = inspectProjectItem(verifyTrustedProjectRevealTarget(initial.target), relativePath).components.at(-1)!.kind; } catch { /* Unsafe/disappeared entries remain visible but disabled. */ }
            entries.push({ name: entry.name, relativePath, kind });
          }
        } finally { directory.closeSync(); }
        const after = current(input);
        if (JSON.stringify(after) !== JSON.stringify(initial)) throw new RevealFailure('unresolved');
        entries.sort((a, b) => Number(b.kind === 'directory') - Number(a.kind === 'directory') || a.name.localeCompare(b.name));
        return { ok: true, value: { workspaceId: input.workspaceId, projectId: input.projectId, relativePath: input.relativePath, outcome: 'listed', entries } };
      } catch (error) { return rejected(input, error); }
    },
    async projectFileCommand(input: unknown, native?: NativeProjectReveal): Promise<ServiceResult<ProjectFileResult>> {
      if (!isProjectFilesRequest(input) || input.type === 'workspace.listProjectFiles') return invalid();
      try {
        const initial = current(input);
        const target: TrustedProjectRevealTarget = { ...initial.target, item: { relativePath: input.relativePath,
          action: input.type === 'workspace.openProjectFile' ? 'open' : 'reveal', components: initial.components } };
        verifyProjectFileTarget(target);
        if (!native) throw new RevealFailure('native_unavailable');
        const verify = () => {
          try {
            const latest = current(input);
            if (JSON.stringify(latest) !== JSON.stringify(initial)) throw new RevealFailure('unresolved');
            verifyProjectFileTarget(target);
            return { outcome: 'verified' as const };
          } catch (error) { return { outcome: 'rejected' as const, problem: error instanceof RevealFailure ? error.problem : 'request_expired' as const }; }
        };
        let result;
        try { result = await native(target, verify); } catch { throw new RevealFailure("native_error"); }
        if (result.outcome === 'rejected') throw new RevealFailure(result.problem);
        const final = verify();
        if (final.outcome === 'rejected') throw new RevealFailure(final.problem);
        return { ok: true, value: { workspaceId: input.workspaceId, projectId: input.projectId, relativePath: input.relativePath, outcome: 'dispatched' } };
      } catch (error) { return rejected(input, error); }
    },
  };
}
function invalid(): ServiceResult<never> { return { ok: false, error: { code: 'invalid_input', message: 'Choose an item inside the current project.' } }; }
