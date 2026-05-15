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

function createLocalWorkspaceId(workspaces: readonly WorkspaceListItem[], name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "workspace";
  const baseId = `workspace:local:${slug}`;
  const existingIds = new Set(workspaces.map((workspace) => workspace.id));
  let candidateId = baseId;
  let suffix = 2;

  while (existingIds.has(candidateId)) {
    candidateId = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return candidateId;
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

export function addWorkspaceListFallback(current: WorkspaceListState, name: string): WorkspaceListState {
  const nextName = name.trim() || `Workspace ${current.workspaces.length + 1}`;
  const nextOrder = current.workspaces.reduce(
    (highestOrder, workspace) => Math.max(highestOrder, workspace.order),
    0,
  ) + 10;
  const workspace = {
    id: createLocalWorkspaceId(current.workspaces, nextName),
    name: nextName,
    order: nextOrder,
  };

  return {
    activeWorkspaceId: workspace.id,
    workspaces: [...current.workspaces, workspace],
  };
}

export function setActiveWorkspaceListFallback(
  current: WorkspaceListState,
  workspaceId: string,
): WorkspaceListState {
  if (!current.workspaces.some((workspace) => workspace.id === workspaceId)) {
    return current;
  }

  return {
    ...current,
    activeWorkspaceId: workspaceId,
  };
}

export function renameWorkspaceListFallback(
  current: WorkspaceListState,
  workspaceId: string,
  name: string,
): WorkspaceListState {
  const nextName = name.trim();
  if (!nextName) {
    return current;
  }

  return {
    ...current,
    workspaces: current.workspaces.map((workspace) => (
      workspace.id === workspaceId ? { ...workspace, name: nextName } : workspace
    )),
  };
}

export function deleteWorkspaceListFallback(
  current: WorkspaceListState,
  workspaceId: string,
): WorkspaceListState {
  if (current.workspaces.length <= 1) {
    return current;
  }

  const workspaces = current.workspaces.filter((workspace) => workspace.id !== workspaceId);
  const activeWorkspaceId = current.activeWorkspaceId === workspaceId
    ? workspaces[0]?.id ?? null
    : current.activeWorkspaceId;

  return { activeWorkspaceId, workspaces };
}

export function reorderWorkspaceListFallback(
  current: WorkspaceListState,
  orderedWorkspaceIds: readonly string[],
): WorkspaceListState {
  const orderedWorkspaces = orderedWorkspaceIds
    .map((workspaceId, index) => {
      const workspace = current.workspaces.find((item) => item.id === workspaceId);
      return workspace ? { ...workspace, order: (index + 1) * 10 } : null;
    })
    .filter((workspace): workspace is WorkspaceListItem => workspace !== null);

  if (orderedWorkspaces.length !== current.workspaces.length) {
    return current;
  }

  return {
    ...current,
    workspaces: orderedWorkspaces,
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
