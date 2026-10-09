import { openSettingsService, type SettingsService } from "./settings.js";
import { isServiceRequest, type ServicePort } from "../contracts/service-protocol.js";
import { join } from "node:path";

type ParentPort = {
  on(event: "message", listener: (event: { data: unknown; ports: ServicePort[] }) => void): void;
  postMessage(message: unknown): void;
};

export function startServiceProcess(
  parentPort: ParentPort,
  openService: (databasePath: string, migrationFolder?: string) => SettingsService = openSettingsService,
  exitProcess: (code: number) => void = () => undefined,
): void {
  let service: SettingsService | undefined;
  let requestPort: ServicePort | undefined;
  let stopping = false;
  let unsubscribe: (() => void) | undefined;

  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    unsubscribe?.();
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

    try {
      service = openService(data.databasePath, join(__dirname, "db/migrations"));
      requestPort = event.ports[0];
      if (!requestPort) throw new Error("Missing service message port");
      unsubscribe = service.workspaces.subscribe((change) => {
        if (!stopping) requestPort?.postMessage({ type: "workspace.change", change });
      });
      requestPort.on("message", ({ data: request }) => {
        if (stopping || !service || !isServiceRequest(request)) return;
        const result = isMalformedWorkspaceRequest(request.input)
          ? { ok: false, error: { code: "invalid_input", message: "The workspace request is invalid." } }
          : isLoadQuery(request.input)
            ? service.handleQuery(request.input)
            : service.handleCommand(request.input);
        requestPort?.postMessage({ id: request.id, result });
      });
      requestPort.start?.();
      parentPort.postMessage({ type: "ready" });
    } catch {
      shutdown();
      parentPort.postMessage({ type: "startup-error", message: "The local service could not open its database." });
    }
  });
}

function isLoadQuery(input: unknown): boolean {
  return isRecord(input) && (input.type === "settings.load" || input.type === "workspace.load" || input.type === "workspace.previewDiscovery" || input.type === "workspace.listProjects" || input.type === "workspace.listTextProperties" || input.type === "workspace.previewProjectRecovery");
}

function isMalformedWorkspaceRequest(input: unknown): boolean {
  if (!isRecord(input) || typeof input.type !== "string" || !input.type.startsWith("workspace.")) return false;
  if (input.type === "workspace.previewProjectRecovery" || input.type === "workspace.reassociateProject") {
    const keys = ["type", "workspaceId", "projectId", ...(input.type === "workspace.reassociateProject" ? ["previewToken", "relativePath"] : [])];
    return !hasExactKeys(input, keys) || keys.some((key) => typeof input[key] !== "string");
  }
  if (input.type === "workspace.createProperty") {
    return !hasExactKeys(input, ["type", "workspaceId", "name", "propertyType"]) ||
      typeof input.workspaceId !== "string" || typeof input.name !== "string" || input.propertyType !== "text";
  }
  if (input.type === "workspace.setTextValue") {
    return !hasExactKeys(input, ["type", "workspaceId", "projectId", "propertyId", "value"]) ||
      typeof input.workspaceId !== "string" || typeof input.projectId !== "string" || typeof input.propertyId !== "string" ||
      (input.value !== null && typeof input.value !== "string");
  }
  if (input.type === "workspace.renameProperty" || input.type === "workspace.renameCategoryProperty") {
    return !hasExactKeys(input, ["type", "workspaceId", "propertyId", "name"]) ||
      typeof input.workspaceId !== "string" || typeof input.propertyId !== "string" || typeof input.name !== "string";
  }
  if (input.type === "workspace.listTextProperties") return !hasExactKeys(input, ["type", "workspaceId"]) || typeof input.workspaceId !== "string";
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
  if (input.type === "workspace.listProjects") return !hasExactKeys(input, ["type", "workspaceId"]) || typeof input.workspaceId !== "string";
  if (input.type === "workspace.load") return !hasExactKeys(input, ["type"]);
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
