export type WorkspaceDragTargetEdge = "before" | "after";

export function reorderWorkspaceIdsForDrag(
  workspaceIds: readonly string[],
  draggedWorkspaceId: string,
  targetWorkspaceId: string,
  targetEdge: WorkspaceDragTargetEdge,
) {
  if (draggedWorkspaceId === targetWorkspaceId) {
    return [...workspaceIds];
  }

  if (!workspaceIds.includes(draggedWorkspaceId) || !workspaceIds.includes(targetWorkspaceId)) {
    return [...workspaceIds];
  }

  const nextWorkspaceIds = workspaceIds.filter((workspaceId) => workspaceId !== draggedWorkspaceId);
  const targetIndex = nextWorkspaceIds.indexOf(targetWorkspaceId);
  const insertionIndex = targetEdge === "after" ? targetIndex + 1 : targetIndex;
  nextWorkspaceIds.splice(insertionIndex, 0, draggedWorkspaceId);

  return nextWorkspaceIds;
}
