import type { WorkspaceGroupingState } from './workspaceAppState';
export function normalizeGrouping(value: unknown): WorkspaceGroupingState | null;
export function moveGroupingGroup(setting:WorkspaceGroupingState|null,groupIds:readonly string[],groupId:string,direction:number): WorkspaceGroupingState|null;

export function reorderGroupingGroup(setting:WorkspaceGroupingState|null,groupIds:readonly string[],groupId:string,beforeId:string|null): WorkspaceGroupingState|null;

export function groupingMenuOrder<T extends { readonly hidden?: boolean }>(groups: readonly T[]): T[];
