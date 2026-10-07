import type { WorkspaceMockProject, WorkspaceMockFileTreeNode } from "./workspaceMockData";
import type { WorkspaceScreen } from "./workspaceProjectSession";
import type { createWorkspaceSession } from "./workspaceSession";
import type { WorkspaceServiceClient } from "./workspaceServiceClient.js";

type Context = { workspaceId: string | null; viewId: string | null };
type Prepared = Context & {
  token: Context & { generation: number };
  project: WorkspaceMockProject | null;
  unavailable: boolean;
};
type WorkspaceRestore = Prepared & { workspaceId: string; viewId: string; viewIds: readonly string[]; tabId: string | null; fullScreen: boolean };
type Acceptance = { accepted: boolean; project?: WorkspaceMockProject | null; unavailable?: boolean };

export function createWorkspaceSessionLifecycle(options: {
  storage: Pick<Storage, "getItem" | "setItem">;
  client: Pick<WorkspaceServiceClient, "getProject" | "listProjectFileTree">;
  normalizeFileTree(response: unknown): readonly WorkspaceMockFileTreeNode[];
}): ReturnType<typeof createWorkspaceSession> & {
  readonly pendingWorkspaceId: string | null;
  getScreen(workspaceId: string): WorkspaceScreen | undefined;
  syncScreen(context: Context & { workspaceId: string; ready: boolean }): void;
  rememberPreview(projectId: string | null, viewId?: string | null, workspaceId?: string): void;
  beginWorkspace(workspaceId: string): void;
  cancelWorkspace(failed?: boolean): void;
  needsWorkspaceRestore(workspaceId: string, pendingView?: boolean): boolean;
  preferredView(workspaceId: string): string | null | undefined;
  invalidatePreview(): void;
  selectView(context: Context & { expanded?: boolean; ready?: boolean }): void;
  restoreReadyView(context: Context): Promise<Acceptance>;
  preparePreview(context: Context & { workspaceId: string; viewId: string }): Promise<Prepared>;
  acceptPreview(prepared: Prepared): Acceptance;
  prepareWorkspace(context: { workspaceId: string; viewId: string; viewIds: readonly string[]; projects: readonly unknown[] }): Promise<WorkspaceRestore>;
  acceptWorkspace(prepared: WorkspaceRestore): Acceptance;
  loadProjectFileTree(project: WorkspaceMockProject, workspaceId?: string | null): Promise<{ accepted: boolean; error?: unknown }>;
  removeView(workspaceId: string, viewId: string): void;
};
