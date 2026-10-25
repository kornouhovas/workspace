import type {FolderObservation} from './folder-evidence.js';
import { isProjectRevealRequest, type ProjectRevealProblem } from './project-reveal.js';

export type ProjectFilesQuery = { type: 'workspace.listProjectFiles'; workspaceId: string; projectId: string; relativePath: string };
export type ProjectFileCommand = { type: 'workspace.openProjectFile' | 'workspace.revealProjectFile'; workspaceId: string; projectId: string; relativePath: string };
export type ProjectFileEntry = { name: string; relativePath: string; kind: 'directory' | 'file' | 'unavailable' };
export type ProjectFilesResult = { workspaceId: string; projectId: string; relativePath: string } & (
  | { outcome: 'listed'; entries: ProjectFileEntry[] }
  | { outcome: 'rejected'; problem: ProjectRevealProblem }
);
export type ProjectFileResult = { workspaceId: string; projectId: string; relativePath: string } & (
  | { outcome: 'dispatched' } | { outcome: 'rejected'; problem: ProjectRevealProblem }
);
export function isProjectFilesRequest(value: unknown): value is ProjectFilesQuery | ProjectFileCommand {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  if (Object.keys(row).length !== 4 || !['workspace.listProjectFiles', 'workspace.openProjectFile', 'workspace.revealProjectFile'].includes(String(row.type))) return false;
  if (!isProjectRevealRequest({ type: 'workspace.revealProject', workspaceId: row.workspaceId, projectId: row.projectId })) return false;
  return typeof row.relativePath === 'string' && row.relativePath.length <= 16384 &&
    (row.relativePath === '' ? row.type === 'workspace.listProjectFiles' : row.relativePath.split('/').every(component =>
      component !== '' && component !== '.' && component !== '..' && !/[\0]/.test(component)));
}

// Private service/main evidence; never part of a renderer response.
export type ProjectFileTarget = { relativePath: string; action: 'open' | 'reveal'; components: { identity: string; kind: 'directory' | 'file';observation?:Extract<FolderObservation,{ok:true}> }[] };
