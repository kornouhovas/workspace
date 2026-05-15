export type WorkspaceListItem = {
  readonly id: string;
  readonly name: string;
  readonly order: number;
};

export type WorkspaceListState = {
  readonly activeWorkspaceId: string | null;
  readonly workspaces: readonly WorkspaceListItem[];
};

type WorkspaceRootLike = {
  readonly workspaceId: string;
};

type WorkspaceListClient = {
  readonly listWorkspaces: () => Promise<unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? "");
}

export function isUnsupportedWorkspaceMethodError(error: unknown, method: string) {
  return getErrorMessage(error).includes(`Unsupported workspace method: ${method}`);
}

export function createWorkspaceListFallback(root: WorkspaceRootLike): WorkspaceListState {
  return {
    activeWorkspaceId: root.workspaceId,
    workspaces: [{ id: root.workspaceId, name: "Operations", order: 10 }],
  };
}

export function normalizeWorkspacesResponse(response: unknown, fallbackWorkspaceId: string): WorkspaceListState {
  if (!isRecord(response)) {
    return {
      activeWorkspaceId: fallbackWorkspaceId,
      workspaces: [{ id: fallbackWorkspaceId, name: "Operations", order: 10 }],
    };
  }

  const workspaces = Array.isArray(response.workspaces)
    ? response.workspaces
        .filter(isRecord)
        .map((workspace, index) => ({
          id: getString(workspace.id),
          name: getString(workspace.name) || `Workspace ${index + 1}`,
          order: Number.isFinite(Number(workspace.order)) ? Number(workspace.order) : (index + 1) * 10,
        }))
        .filter((workspace) => workspace.id)
    : [];

  return {
    activeWorkspaceId: getString(response.activeWorkspaceId) || fallbackWorkspaceId,
    workspaces: workspaces.length > 0
      ? workspaces
      : [{ id: fallbackWorkspaceId, name: "Operations", order: 10 }],
  };
}

export async function loadWorkspaceList(
  client: WorkspaceListClient,
  root: WorkspaceRootLike,
): Promise<WorkspaceListState> {
  try {
    return normalizeWorkspacesResponse(await client.listWorkspaces(), root.workspaceId);
  } catch (error) {
    if (isUnsupportedWorkspaceMethodError(error, "workspace.listWorkspaces")) {
      return createWorkspaceListFallback(root);
    }

    throw error;
  }
}
