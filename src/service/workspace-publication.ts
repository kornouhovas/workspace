import type { WorkspaceChangeEvent } from "../contracts/workspaces.js";

/** Post-commit delivery is ordered across reentrant publications and isolates subscribers. */
export function createWorkspacePublisher(listeners: ReadonlySet<(event: WorkspaceChangeEvent) => void>) {
  const queue: WorkspaceChangeEvent[] = [];
  let publishing = false;
  return (events: WorkspaceChangeEvent[]) => {
    queue.push(...events);
    if (publishing) return;
    publishing = true;
    try {
      let event: WorkspaceChangeEvent | undefined;
      while ((event = queue.shift())) {
        for (const listener of [...listeners]) {
          try { listener(event); } catch { /* A listener cannot change a committed command's result. */ }
        }
      }
    } finally { publishing = false; }
  };
}
