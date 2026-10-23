import type { ProjectAssociationSummary } from "../../contracts/workspaces.js";
import type { TranslationKey } from "../localization.js";

const labels = { excluded: "projectExcluded", missing: "projectMissing", unresolved: "projectUnresolved", replaced: "projectReplaced" } as const;

/** Presentation eligibility only; the service still owns target/token validation. */
export function retainedProjectAvailability(project: ProjectAssociationSummary, sourceAvailable: boolean) {
  const modeInactive = project.retentionReason === "mode_change";
  const reason = !sourceAvailable ? (project.associationState === "excluded" && !modeInactive ? "excluded" : null)
    : project.associationState === "excluded" && !modeInactive ? "excluded" : project.resolution ?? project.associationState;
  const identityLabels = {review_required:"associationReviewRequired",scope_unverified:"associationReviewRequired",different_volume:"associationDifferentVolume",
    folder_changed:"discoveryRootConflict",evidence_unavailable:"associationUnverified",unsafe:"discoveryChanged"} as const;
  const identityLabel = project.identityReason && project.identityReason !== "verified" ? identityLabels[project.identityReason] : null;
  const label: TranslationKey | null = identityLabel ?? (modeInactive ? "projectModeRetained" : reason && reason !== "active" ? labels[reason] : null);
  return { label, excluded: modeInactive && sourceAvailable && reason === "excluded",
    canLocate: sourceAvailable && reason !== null && (["missing", "unresolved", "replaced"].includes(reason) || modeInactive && reason !== "excluded") };
}
