import type { BackendStatus } from "../contracts/desktop-api.js";
import type { ServicePort, ServiceResponse } from "../contracts/service-protocol.js";
import type { ServiceResult, Settings } from "../contracts/settings.js";

type ChildProcess = {
  postMessage(message: unknown, transfer?: unknown[]): void;
  kill(): boolean;
  on(event: "spawn", listener: () => void): void;
  on(event: "exit", listener: (code: number) => void): void;
  on(event: "message", listener: (message: unknown) => void): void;
  on(event: "error", listener: (type: string, location: string, report: string) => void): void;
};

type Timer = ReturnType<typeof setTimeout>;

export class BackendController {
  private child?: ChildProcess;
  private port?: ServicePort;
  private status: BackendStatus = { state: "starting" };
  private nextId = 1;
  private pending = new Map<number, { resolve: (value: ServiceResult<Settings>) => void; timer: Timer }>();
  private readiness?: { resolve: (ready: boolean) => void; timer: Timer };
  private onStatus: (status: BackendStatus) => void;

  constructor(onStatus: (status: BackendStatus) => void = () => undefined) {
    this.onStatus = onStatus;
  }

  get currentStatus(): BackendStatus { return this.status; }

  start(
    child: ChildProcess,
    port: ServicePort,
    databasePath: string,
    transferPort: unknown,
    timeoutMs = 8000,
  ): Promise<boolean> {
    this.child = child;
    this.port = port;
    this.setStatus({ state: "starting" });
    port.on("message", ({ data }) => this.onResponse(data));
    port.start?.();
    child.on("message", (message) => this.onChildMessage(message));
    child.on("exit", () => this.onExit());
    child.on("error", () => this.onProcessError());
    child.on("spawn", () => undefined);

    const ready = new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => this.failStartup(resolve), timeoutMs);
      this.readiness = { resolve, timer };
    });
    child.postMessage({ type: "connect", databasePath }, [transferPort]);
    return ready;
  }

  request(input: unknown, timeoutMs = 10000): Promise<ServiceResult<Settings>> {
    if (this.status.state !== "ready" || !this.port) {
      return Promise.resolve({ ok: false, error: { code: "service_unavailable", message: "The local service is unavailable." } });
    }
    const id = this.nextId++;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve({ ok: false, error: { code: "service_unavailable", message: "The local service did not respond." } });
      }, timeoutMs);
      this.pending.set(id, { resolve, timer });
      try {
        this.port?.postMessage({ id, input });
      } catch {
        clearTimeout(timer);
        this.pending.delete(id);
        resolve({ ok: false, error: { code: "service_unavailable", message: "The local service request failed." } });
      }
    });
  }

  async stop(timeoutMs = 1500): Promise<void> {
    const child = this.child;
    if (!child) return;
    if (this.status.state === "ready") {
      try {
        child.postMessage({ type: "shutdown" });
      } catch {
        child.kill();
      }
    }
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => { child.kill(); resolve(); }, timeoutMs);
      child.on("exit", () => { clearTimeout(timer); resolve(); });
    });
    this.port?.close();
    this.port = undefined;
    this.child = undefined;
    this.rejectPending("The local service stopped.");
  }

  private onChildMessage(message: unknown): void {
    if (!isRecord(message)) return;
    if (message.type === "ready") {
      if (this.readiness) {
        clearTimeout(this.readiness.timer);
        this.readiness.resolve(true);
        this.readiness = undefined;
      }
      this.setStatus({ state: "ready" });
    } else if (message.type === "startup-error") {
      this.failStartup(this.readiness?.resolve);
    }
  }

  private onResponse(value: unknown): void {
    if (!isServiceResponse(value)) return;
    const pending = this.pending.get(value.id);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending.delete(value.id);
    pending.resolve(value.result);
  }

  private onExit(): void {
    if (this.readiness) this.failStartup(this.readiness.resolve);
    this.rejectPending("The local service exited.");
    if (this.child) {
      this.child = undefined;
      this.port?.close();
      this.port = undefined;
      this.setStatus({ state: "unavailable", message: "The local service stopped unexpectedly." });
    }
  }

  private onProcessError(): void {
    if (this.readiness) this.failStartup(this.readiness.resolve);
    else this.onExit();
  }

  private failStartup(resolve = this.readiness?.resolve): void {
    if (this.readiness) clearTimeout(this.readiness.timer);
    this.readiness = undefined;
    resolve?.(false);
    this.setStatus({ state: "unavailable", message: "Workspace could not start its local service. Close and reopen the app to try again." });
    this.child?.kill();
  }

  private rejectPending(message: string): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.resolve({ ok: false, error: { code: "service_unavailable", message } });
      this.pending.delete(id);
    }
  }

  private setStatus(status: BackendStatus): void {
    this.status = status;
    this.onStatus(status);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isServiceResponse(value: unknown): value is ServiceResponse {
  return isRecord(value) && typeof value.id === "number" && isRecord(value.result) && typeof value.result.ok === "boolean";
}
