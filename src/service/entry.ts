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
        const result = isLoadQuery(request.input)
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
  return typeof input === "object" && input !== null &&
    ["settings.load", "workspace.load"].includes(String((input as { type?: unknown }).type));
}

const parentPort = process.parentPort as unknown as ParentPort | null;
if (parentPort) startServiceProcess(parentPort, openSettingsService, (code) => process.exit(code));
