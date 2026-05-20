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

export function reorderIdsByDropIndex(
  ids: readonly string[],
  sourceId: string,
  dropIndex: number,
) {
  const remainingIds = ids.filter((id) => id !== sourceId);
  const boundedDropIndex = Math.min(Math.max(dropIndex, 0), remainingIds.length);

  return [
    ...remainingIds.slice(0, boundedDropIndex),
    sourceId,
    ...remainingIds.slice(boundedDropIndex),
  ];
}

export function mergeFixedIdsWithReorderedIds(
  allIds: readonly string[],
  fixedIds: readonly string[],
  reorderedMovableIds: readonly string[],
) {
  const fixedIdSet = new Set(fixedIds);
  const movableIds = [...reorderedMovableIds];
  let movableIndex = 0;

  return allIds.map((id) => {
    if (fixedIdSet.has(id)) {
      return id;
    }

    const movableId = movableIds[movableIndex];
    movableIndex += 1;

    return movableId ?? id;
  });
}
