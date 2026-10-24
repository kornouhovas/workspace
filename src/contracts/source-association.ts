export type FolderIdentityReason = "verified" | "review_required" | "scope_unverified" | "different_volume" | "folder_changed" | "evidence_unavailable" | "unsafe";
export interface FolderMapping { kind: "category" | "project"; id: string; relativePath: string }
export type SourceAssociationQuery = { type: "workspace.previewSourceAssociation"; workspaceId: string; mappings: FolderMapping[] };
export type SourceAssociationCommand = { type: "workspace.applySourceAssociation" | "workspace.cancelSourceAssociation"; workspaceId: string; previewToken: string };
export interface SourceAssociationPreview {
  workspaceId: string;
  sourceId: string;
  canonicalRoot: string;
  reason: FolderIdentityReason;
  targets: {kind:"category" | "project";relativePath:string;archivedProjectId?:string;archivedParentCategoryId?:string}[];
  candidates: (FolderMapping & { savedPath: string; archived?:boolean; archivedParent?:boolean; eligible: boolean; selected: boolean; reason: FolderIdentityReason })[];
  mappings: FolderMapping[];
  retainedCount: number;
  pendingOperations: number;
  previewToken: string | null;
}
export type SourceAssociationResult = { sourceId: string; generation: number } | { canceled: true };
