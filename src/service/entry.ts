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

  const shutdown = () => {
    if (stopping) return;
    stopping = true;
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
      requestPort.on("message", ({ data: request }) => {
        if (!service || !isServiceRequest(request)) return;
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
  return isRecord(input) && (input.type === "settings.load" || input.type === "workspace.load");
}

function isMalformedWorkspaceRequest(input: unknown): boolean {
  if (!isRecord(input) || typeof input.type !== "string" || !input.type.startsWith("workspace.")) return false;
  if (input.type === "workspace.load") return !hasExactKeys(input, ["type"]);
  if (input.type === "workspace.create") {
    return !hasExactKeys(input, ["type", "name", "rootPath"]) ||
      typeof input.name !== "string" || typeof input.rootPath !== "string";
  }
  if (input.type === "workspace.rename") {
    return !hasExactKeys(input, ["type", "workspaceId", "name"]) ||
      typeof input.workspaceId !== "string" || typeof input.name !== "string";
  }
  if (input.type === "workspace.activate") {
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
