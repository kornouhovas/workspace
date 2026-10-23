import { isWorkspaceSessionRequest } from "../contracts/workspace-sessions.js";
import { isProjectFilesRequest } from "../contracts/project-files.js";
import { isDataRecoveryRequest } from "../contracts/data-recovery.js";
import { isMetadataRemovalRequest, metadataRemovalRequests } from "../contracts/metadata-removal.js";
import { isAssignProjectGroupCommand } from "../contracts/group-assignment.js";
import { isBoardLayoutRequest } from "../contracts/board-layout.js";
import { isTableLayoutRequest } from "../contracts/table-layout.js";
import { isViewGroupingRequest } from "../contracts/view-grouping.js";
import { isViewFilterRequest, viewFilterRequests } from "../contracts/view-filters.js";
import { isViewRequest, viewCommands } from "../contracts/views.js";
import { isSelectCommand, selectCommands } from "../contracts/text-properties.js";
import { archiveQueries, archiveCommands, isArchiveRequest } from "../contracts/project-archive.js";
import { categoryRemovalQueries, categoryRemovalCommands, isCategoryRemovalRequest } from "../contracts/category-removal.js";
import { categoryOptionsQueries, categoryOptionsCommands, isCategoryOptionsRequest } from "../contracts/category-options.js";
import { isProjectCategoryMoveRequest } from "../contracts/project-category-move.js";
import { isProjectRenameRequest } from "../contracts/project-rename.js";
import { randomUUID } from "node:crypto";
import { startupDiagnostic, type StartupDiagnostic } from "../contracts/startup-diagnostic.js";
import { isProjectCreationRequest } from "../contracts/project-creation.js";
import { isProjectRevealRequest } from "../contracts/project-reveal.js";
import { openSettingsService, type SettingsService } from "./settings.js";
import { isServiceRequest, isNativeProjectRevealVerify, isNativeProjectRevealReply, isNativeProjectRevealCancel, type TrustedProjectRevealTarget, type NativeProjectRevealResult, type NativeProjectRevealValidation, type ServicePort } from "../contracts/service-protocol.js";
import { join } from "node:path";

type ParentPort = {
  on(event: "message", listener: (event: { data: unknown; ports: ServicePort[] }) => void): void;
  postMessage(message: unknown): void;
};

export function startServiceProcess(
  parentPort: ParentPort,
  openService: (databasePath: string, migrationFolder?: string) => SettingsService = openSettingsService,
  exitProcess: (code: number) => void = () => undefined,
  nativeTimeoutMs = process.platform === "win32" ? 15000 : 8000,
): void {
  let service: SettingsService | undefined;
  let requestPort: ServicePort | undefined;
  let stopping = false;
  let unsubscribe: (() => void) | undefined;
  const activeRequests = new Set<number>();
  const nativePending = new Map<string, { requestId: number; verify(): NativeProjectRevealValidation; timer: ReturnType<typeof setTimeout>; resolve(result: NativeProjectRevealResult): void }>();
  function settleNative(dispatchId: string, result: NativeProjectRevealResult) {
    const pending = nativePending.get(dispatchId);
    if (!pending) return;
    clearTimeout(pending.timer); nativePending.delete(dispatchId); pending.resolve(result);
  }
  function dispatchNative(requestId: number, target: TrustedProjectRevealTarget, verify: () => NativeProjectRevealValidation): Promise<NativeProjectRevealResult> {
    if (stopping || !requestPort || !activeRequests.has(requestId)) return Promise.resolve({ outcome: "rejected", problem: "request_expired" });
    const dispatchId = randomUUID();
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        settleNative(dispatchId, { outcome: "rejected", problem: "native_unavailable" });
        try { requestPort?.postMessage({ type: "project.reveal.cancel", requestId, dispatchId }); } catch { /* Closed transport. */ }
      }, nativeTimeoutMs);
      nativePending.set(dispatchId, { requestId, verify, timer, resolve });
      try { requestPort?.postMessage({ type: "project.reveal.native", requestId, dispatchId, target }); }
      catch { settleNative(dispatchId, { outcome: "rejected", problem: "native_unavailable" }); }
    });
  }

  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    unsubscribe?.();
    for (const dispatchId of nativePending.keys()) settleNative(dispatchId, { outcome: "rejected", problem: "request_expired" });
    activeRequests.clear();
    requestPort?.close();
    service?.close();
  };

  parentPort.on("message", (event) => {
    const message = event.data;
    if (typeof message !== "object" || message === null) return;
    const data = message as { type?: unknown; databasePath?: unknown };

    if (data.type === "shutdown") {
      shutdown();
      parentPort.postMessage({ type: "stopped" });
      exitProcess(0);
      return;
    }
    if (data.type !== "connect" || service || typeof data.databasePath !== "string") return;

    let startupStage: StartupDiagnostic["stage"] = "service_open";
    try {
      service = openService(data.databasePath, join(__dirname, "db/migrations"));
      startupStage = "service_port";
      requestPort = event.ports[0];
      if (!requestPort) throw new Error("Missing service message port");
      startupStage = "service_subscribe";
      unsubscribe = service.workspaces.subscribe((change) => {
        if (!stopping) requestPort?.postMessage({ type: "workspace.change", change });
      });
      requestPort.on("message", ({ data: request }) => {
        if (stopping || !service) return;
        if (isNativeProjectRevealVerify(request)) {
          const pending = nativePending.get(request.dispatchId);
          if (pending?.requestId === request.requestId) {
            requestPort?.postMessage({ type: "project.reveal.verified", requestId: request.requestId, dispatchId: request.dispatchId, result: pending.verify() });
          }
          return;
        }
        if (isNativeProjectRevealReply(request) || isNativeProjectRevealCancel(request)) {
          if (nativePending.get(request.dispatchId)?.requestId === request.requestId) {
            settleNative(request.dispatchId, request.type === "project.reveal.reply" ? request.result : { outcome: "rejected", problem: "request_expired" });
          }
          return;
        }
        if (!isServiceRequest(request) || activeRequests.has(request.id)) return;
        if (isProjectFilesRequest(request.input) && request.input.type !== "workspace.listProjectFiles") {
          activeRequests.add(request.id);
          void service.projectFileCommand(request.input, (target, verify) => dispatchNative(request.id, target, verify)).then(result => {
            if (!stopping) { try { requestPort?.postMessage({ id: request.id, result }); } catch { /* Closed port. */ } }
          }).finally(() => activeRequests.delete(request.id));
          return;
        }
        if (isProjectRevealRequest(request.input)) {
          activeRequests.add(request.id);
          void service.revealProject(request.input, (target, verify) => dispatchNative(request.id, target, verify)).then((result) => {
            if (!stopping) {
              try { requestPort?.postMessage({ id: request.id, result }); } catch { /* Request port closed. */ }
            }
          }).finally(() => { activeRequests.delete(request.id); });
          return;
        }
        const restoring = isDataRecoveryRequest(request.input) && request.input.type === "data.restore";
        if (restoring && activeRequests.size) {
          requestPort?.postMessage({ id: request.id, result: { ok: false, error: { code: "storage", message: "Wait for pending operations before restoring." } } });
          return;
        }
        const result = isMalformedWorkspaceRequest(request.input)
          ? { ok: false, error: { code: "invalid_input", message: "The workspace request is invalid." } }
          : isLoadQuery(request.input)
            ? service.handleQuery(request.input)
            : service.handleCommand(request.input);
        if (restoring && result.ok) {
          unsubscribe?.();
          unsubscribe = service.workspaces.subscribe((change) => {
            if (!stopping) requestPort?.postMessage({ type: "workspace.change", change });
          });
        }
        requestPort?.postMessage({ id: request.id, result });
      });
      startupStage = "service_start";
      requestPort.start?.();
      parentPort.postMessage({ type: "ready" });
    } catch (error) {
      const diagnostic = startupDiagnostic(startupStage, error);
      try { shutdown(); }
      finally { parentPort.postMessage({ type: "startup-error", message: "The local service could not open its database.", diagnostic }); }
    }
  });
}

function isLoadQuery(input: unknown): boolean {
  return isRecord(input) && ((typeof input.type === "string" && [...archiveQueries, ...categoryOptionsQueries, ...categoryRemovalQueries].includes(input.type)) || input.type === "workspace.listProjectCategoryMoves" || input.type === "workspace.getProjectCategoryMove" || input.type === "workspace.previewProjectCategoryMoveRecovery" || input.type === "workspace.listProjectRenames" || input.type === "workspace.getProjectRename" || input.type === "workspace.previewProjectRenameRecovery" || input.type === "workspace.getBoardLayout" || input.type === "workspace.getTableLayout" || input.type === "workspace.getViewGrouping" || input.type === "workspace.getViewFilter" || input.type === "workspace.queryView" || input.type === "workspace.getSession" || input.type === "workspace.listViews" || input.type === "workspace.previewMetadataRemoval" || input.type === "data.export" || input.type === "data.backups" || input.type === "data.backupExport" || input.type === "settings.load" || input.type === "workspace.listProjectFiles" || input.type === "workspace.listSources" || input.type === "workspace.load" || input.type === "workspace.previewSourceAssociation" || input.type === "workspace.previewDiscovery" || input.type === "workspace.getSourceObservation" || input.type === "workspace.listProjects" || input.type === "workspace.listTextProperties" || input.type === "workspace.previewProjectRecovery" || input.type === "workspace.listProjectCreations" || input.type === "workspace.getProjectCreation" || input.type === "workspace.previewProjectCreationRecovery");
}

function isMalformedWorkspaceRequest(input: unknown): boolean {
  if (!isRecord(input) || typeof input.type !== "string" || !input.type.startsWith("workspace.")) return false;
  if ([...archiveQueries, ...archiveCommands].includes(input.type)) return !isArchiveRequest(input);
  if ([...categoryRemovalQueries, ...categoryRemovalCommands].includes(input.type)) return !isCategoryRemovalRequest(input);
  if ([...categoryOptionsQueries, ...categoryOptionsCommands].includes(input.type)) return !isCategoryOptionsRequest(input);
  if (["workspace.moveProjectCategory", "workspace.listProjectCategoryMoves", "workspace.getProjectCategoryMove", "workspace.previewProjectCategoryMoveRecovery", "workspace.recoverProjectCategoryMove"].includes(input.type)) return !isProjectCategoryMoveRequest(input);
  if (["workspace.renameProject", "workspace.listProjectRenames", "workspace.getProjectRename", "workspace.previewProjectRenameRecovery", "workspace.recoverProjectRename"].includes(input.type)) return !isProjectRenameRequest(input);
  if (["workspace.createProject", "workspace.listProjectCreations", "workspace.getProjectCreation", "workspace.previewProjectCreationRecovery", "workspace.recoverProjectCreation"].includes(input.type)) return !isProjectCreationRequest(input);
  if (["workspace.listProjectFiles", "workspace.openProjectFile", "workspace.revealProjectFile"].includes(input.type)) return !isProjectFilesRequest(input);
  if (["workspace.getSession", "workspace.setSession"].includes(input.type)) return !isWorkspaceSessionRequest(input);
  if (input.type === "workspace.revealProject") return !isProjectRevealRequest(input);
  if (input.type === "workspace.previewProjectRecovery" || input.type === "workspace.reassociateProject") {
    const keys = ["type", "workspaceId", "projectId", ...(input.type === "workspace.reassociateProject" ? ["previewToken", "relativePath"] : [])];
    return !hasExactKeys(input, keys) || keys.some((key) => typeof input[key] !== "string");
  }
  if (input.type === "workspace.assignProjectGroup") return !isAssignProjectGroupCommand(input);
  if (["workspace.getBoardLayout", "workspace.setBoardLayout"].includes(input.type)) return !isBoardLayoutRequest(input);
  if (["workspace.getTableLayout", "workspace.setTableLayout"].includes(input.type)) return !isTableLayoutRequest(input);
  if (["workspace.getViewGrouping", "workspace.setViewGrouping"].includes(input.type)) return !isViewGroupingRequest(input);
  if (viewFilterRequests.includes(input.type)) return !isViewFilterRequest(input);
  if (["workspace.listViews", ...viewCommands].includes(input.type)) return !isViewRequest(input);
  if (metadataRemovalRequests.includes(input.type)) return !isMetadataRemovalRequest(input);
  if (selectCommands.includes(input.type)) return !isSelectCommand(input);
  if (input.type === "workspace.createProperty") {
    return !hasExactKeys(input, ["type", "workspaceId", "name", "propertyType"]) ||
      typeof input.workspaceId !== "string" || typeof input.name !== "string" || (input.propertyType !== "text" && input.propertyType !== "number" && input.propertyType !== "date" && input.propertyType !== "single_select" && input.propertyType !== "multi_select");
  }
  if (input.type === "workspace.setNumberValue") {
    return !hasExactKeys(input, ["type", "workspaceId", "projectId", "propertyId", "expression"]) ||
      typeof input.workspaceId !== "string" || typeof input.projectId !== "string" || typeof input.propertyId !== "string" ||
      (input.expression !== null && typeof input.expression !== "string");
  }
  if (input.type === "workspace.setTextValue" || input.type === "workspace.setDateValue") {
    return !hasExactKeys(input, ["type", "workspaceId", "projectId", "propertyId", "value"]) ||
      typeof input.workspaceId !== "string" || typeof input.projectId !== "string" || typeof input.propertyId !== "string" ||
      (input.value !== null && typeof input.value !== "string");
  }
  if (input.type === "workspace.renameProperty" || input.type === "workspace.renameCategoryProperty") {
    return !hasExactKeys(input, ["type", "workspaceId", "propertyId", "name"]) ||
      typeof input.workspaceId !== "string" || typeof input.propertyId !== "string" || typeof input.name !== "string";
  }
  if (input.type === "workspace.listTextProperties") return !hasExactKeys(input, ["type", "workspaceId"]) || typeof input.workspaceId !== "string";
  if (input.type === "workspace.previewSourceAssociation") return !hasExactKeys(input, ["type", "workspaceId", "mappings"]) || typeof input.workspaceId !== "string" || !Array.isArray(input.mappings);
  if (["workspace.applySourceAssociation", "workspace.cancelSourceAssociation"].includes(input.type)) return !hasExactKeys(input, ["type", "workspaceId", "previewToken"]) || typeof input.workspaceId !== "string" || typeof input.previewToken !== "string";
  if (input.type === "workspace.previewDiscovery") {
    const keys = ["type", "workspaceId", ...(Object.hasOwn(input, "excludedRelativePaths") ? ["excludedRelativePaths"] : []),
      ...(Object.hasOwn(input, "mode") ? ["mode"] : [])];
    return !hasExactKeys(input, keys) || typeof input.workspaceId !== "string" ||
      (Object.hasOwn(input, "mode") && input.mode !== "direct" && input.mode !== "grouped") ||
      (Object.hasOwn(input, "excludedRelativePaths") &&
        (!Array.isArray(input.excludedRelativePaths) || !input.excludedRelativePaths.every((path) => typeof path === "string")));
  }
  if (input.type === "workspace.applyDiscovery") {
    return !hasExactKeys(input, ["type", "workspaceId", "previewToken"]) ||
      typeof input.workspaceId !== "string" || typeof input.previewToken !== "string";
  }
  if (input.type === "workspace.listProjects") return !hasExactKeys(input, Object.hasOwn(input, "observed") ? ["type", "workspaceId", "observed"] : ["type", "workspaceId"]) || typeof input.workspaceId !== "string" || Object.hasOwn(input, "observed") && input.observed !== true;
  if (input.type === "workspace.getSourceObservation") return !hasExactKeys(input, ["type", "workspaceId"]) || typeof input.workspaceId !== "string";
  if (input.type === "workspace.load" || input.type === "workspace.listSources") return !hasExactKeys(input, ["type"]);
  if (input.type === "workspace.create") {
    return !hasExactKeys(input, ["type", "name", "rootPath"]) ||
      typeof input.name !== "string" || typeof input.rootPath !== "string";
  }
  if (input.type === "workspace.rename") {
    return !hasExactKeys(input, ["type", "workspaceId", "name"]) ||
      typeof input.workspaceId !== "string" || typeof input.name !== "string";
  }
  if (input.type === "workspace.reorder") {
    return !hasExactKeys(input, ["type", "workspaceIds"]) ||
      !Array.isArray(input.workspaceIds) || !input.workspaceIds.every((id) => typeof id === "string");
  }
  if (input.type === "workspace.activate" || input.type === "workspace.remove" || input.type === "workspace.refreshSource") {
    return !hasExactKeys(input, ["type", "workspaceId"]) || typeof input.workspaceId !== "string";
  }
  return true;
}

function hasExactKeys(value: Record<string, unknown>, expected: string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length && expected.every((key) => Object.hasOwn(value, key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const parentPort = process.parentPort as unknown as ParentPort | null;
if (parentPort) startServiceProcess(parentPort, openSettingsService, (code) => process.exit(code));
