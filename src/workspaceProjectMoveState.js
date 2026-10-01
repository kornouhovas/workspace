// Renderer operation state has no paths-to-filesystem behavior. The backend
// supplies display locators and receives only the validated stable status ID.
export function createProjectMoveController(client, onPending) {
  let pending = false;
  return {
    async move(input) {
      if (pending) return null;
      pending = true;
      onPending({ ...input, state: 'pending' });
      try {
        return await client.moveProjectStatus({ workspaceId: input.workspaceId, projectId: input.projectId, statusValueId: input.statusValueId });
      } finally {
        pending = false;
        onPending(null);
      }
    },
  };
}
