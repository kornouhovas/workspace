import type { ProjectTabsState } from "./workspaceProjectTabs";
export type WorkspaceScreen = { viewId: string | null; tabId: string | null; fullScreen?: boolean };
export function readProjectSession(storage: Pick<Storage, "getItem">): { tabs: ProjectTabsState; screens: Record<string, WorkspaceScreen> };
export function writeProjectSession(storage: Pick<Storage, "setItem">, tabs: ProjectTabsState, screens: Record<string, WorkspaceScreen>): boolean;
