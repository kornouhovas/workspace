export type WorkspaceRevealProjectCommand = {
  type: "workspace.revealProject";
  workspaceId: string;
  projectId: string;
};
export type ProjectRevealProblem = "unconfigured" | "mode_retained" | "excluded" | "missing" | "replaced" |
  "unresolved" | "root_unavailable" | "root_replaced" | "category_unavailable" | "unavailable" |
  "native_unavailable" | "native_error" | "request_expired";
export type ProjectRevealResult = { workspaceId: string; projectId: string } & (
  // API acknowledgment only; it does not establish an observed Finder/Explorer window.
  | { outcome: "dispatched" }
  | { outcome: "rejected"; problem: ProjectRevealProblem }
);
export function isProjectRevealRequest(value: unknown): value is WorkspaceRevealProjectCommand {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  const uuid = (id: unknown) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  return Object.keys(input).length === 3 && input.type === "workspace.revealProject" && uuid(input.workspaceId) && uuid(input.projectId);
}
