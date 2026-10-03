export async function duplicateWorkspaceView(client, workspaceId, sourceId, copyName) {
  const snapshot = await client.listViews({ workspaceId });
  const source = snapshot.views.find(view => view.id === sourceId);
  if (!source) throw new Error("Source view is unavailable.");
  const names = new Set(snapshot.views.map(view => view.name));
  let name = copyName;
  for (let index = 2; names.has(name); index++) name = `${copyName} ${index}`;
  const created = await client.createView({ workspaceId, viewType: source.viewType, name });
  const viewId = created.view.id;
  try {
    const patch = {};
    for (const key of ["visiblePropertyIds", "hiddenPropertyIds", "propertyOrder", "valueVisibility", "propertyLayout", "boardLayout", "tableColumnWidths", "columnOrder", "rowOrder", "grouping", "groupingNotice"]) {
      if (source[key] !== undefined) patch[key] = structuredClone(source[key]);
    }
    await client.updateView({ workspaceId, viewId, patch });
    const orderedViewIds = snapshot.views.map(view => view.id);
    orderedViewIds.splice(orderedViewIds.indexOf(sourceId) + 1, 0, viewId);
    await client.reorderViews({ workspaceId, orderedViewIds });
    await client.setActiveView({ workspaceId, viewId });
    return viewId;
  } catch (error) {
    // Do not leave a partially configured duplicate after a failed copy.
    try {
      await client.deleteView({ workspaceId, viewId });
      if (snapshot.activeViewId) await client.setActiveView({ workspaceId, viewId: snapshot.activeViewId });
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], "View duplication and cleanup failed.");
    }
    throw error;
  }
}
