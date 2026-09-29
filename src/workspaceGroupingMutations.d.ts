import type { WorkspaceGroupingState } from './workspaceAppState';
export type GroupingMutation = WorkspaceGroupingState | null | ((current: WorkspaceGroupingState | null) => WorkspaceGroupingState | null);
export type GroupingTarget = {workspaceId:string;viewId:string};
export function createGroupingMutationQueue(save:(target:GroupingTarget,grouping:WorkspaceGroupingState|null)=>Promise<unknown>): {enqueue(target:GroupingTarget,initial:WorkspaceGroupingState|null|undefined,mutation:GroupingMutation):Promise<unknown>};
