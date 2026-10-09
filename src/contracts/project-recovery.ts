import type { DiscoveryMode, DiscoveryPreview } from "./workspaces.js";

export type WorkspacePreviewProjectRecoveryQuery = {
  type: "workspace.previewProjectRecovery";
  workspaceId: string;
  projectId: string;
};
export type WorkspaceReassociateProjectCommand = {
  type: "workspace.reassociateProject";
  workspaceId: string;
  projectId: string;
  previewToken: string;
  relativePath: string;
};
export type ProjectRecoveryTargetStatus = "selectable" | "excluded" | "unresolved" | "reserved_path" | "native_conflict" | "category_unavailable";
export interface ProjectRecoveryCandidate {
  relativePath: string;
  name: string;
  categoryPath: string | null;
  status: ProjectRecoveryTargetStatus;
}
export interface ProjectRecoveryPreview {
  workspaceId: string;
  sourceId: string;
  projectId: string;
  revision: number;
  mode: DiscoveryMode;
  state: DiscoveryPreview["state"];
  previewToken: string | null;
  entries: ProjectRecoveryCandidate[];
}
