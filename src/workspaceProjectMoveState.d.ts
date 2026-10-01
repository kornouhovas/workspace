export type ProjectStatusMoveOption = {
  readonly id: string;
  readonly name: string;
  readonly source: string;
  readonly relativePath: string | null;
  readonly color?: string;
  readonly current: boolean;
  readonly from: string;
  readonly to: string | null;
  readonly disabledReason?: string | null;
};
export type ProjectMoveInput = {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly statusValueId: string;
  readonly from: string;
  readonly to: string;
};
export type ProjectMovePending = ProjectMoveInput & { readonly state: 'pending' };
export function createProjectMoveController(client: { moveProjectStatus(payload: Record<string, unknown>): Promise<unknown> }, onPending: (pending: ProjectMovePending | null) => void): { move(input: ProjectMoveInput): Promise<unknown> };
