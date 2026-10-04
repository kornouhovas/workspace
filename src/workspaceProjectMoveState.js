// Renderer operation state contains display locators only. The backend receives
// stable IDs and, for rename, a single folder name; destination paths stay local.
export function createProjectMoveController(client, onPending) {
  let pending = false;
  async function run(input, request) {
    if (pending) return null;
    pending = true;
    onPending({ ...input, state: 'pending' });
    try { return await request(); }
    finally { pending = false; onPending(null); }
  }
  return {
    move(input) {
      return run(input, () => client.moveProjectStatus({ workspaceId: input.workspaceId, projectId: input.projectId, statusValueId: input.statusValueId }));
    },
    rename(input, name) {
      return run({ ...input, operation: 'rename' }, () => client.renameProject({ workspaceId: input.workspaceId, projectId: input.projectId, name }));
    },
  };
}
