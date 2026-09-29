import type { WorkspaceGroupingState } from './workspaceAppState';
export function normalizeGrouping(value: unknown): WorkspaceGroupingState | null;
export function moveGroupingGroup(setting:WorkspaceGroupingState|null,groupIds:readonly string[],groupId:string,direction:number): WorkspaceGroupingState|null;
