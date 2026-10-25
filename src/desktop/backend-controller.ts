import { isProjectFilesRequest } from "../contracts/project-files.js";
import { isProjectRevealRequest } from "../contracts/project-reveal.js";
import { readStartupDiagnostic, startupDiagnostic, type StartupDiagnostic } from "../contracts/startup-diagnostic.js";
import type { BackendStatus } from "../contracts/desktop-api.js";
import { isServiceEvent, isServiceResponse, isNativeProjectRevealVerified, isNativeProjectRevealRequest, isNativeProjectRevealCancel, type NativeProjectRevealRequest, type TrustedProjectRevealTarget, type NativeProjectRevealResult, type NativeProjectRevealValidation, type ServicePayload, type ServicePort } from "../contracts/service-protocol.js";
import type { WorkspaceChangeEvent } from "../contracts/workspaces.js";
import type { ServiceResult } from "../contracts/settings.js";

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
  private changeListeners = new Set<(event: WorkspaceChangeEvent) => void>();
  onWorkspaceChange(listener: (event: WorkspaceChangeEvent) => void): () => void {
    this.changeListeners.add(listener);
    return () => { this.changeListeners.delete(listener); };
  }
  private child?: ChildProcess;
  private port?: ServicePort;
  private status: BackendStatus = { state: "starting" };
  private nextId = 1;
  private generation = 0;
  private nativeActive = new Map<number, string>();
  private nativeAbort = new Map<number, AbortController>();
  private nativeTasks = new Set<Promise<void>>();
  private nativeVerifications = new Map<string, { requestId: number; resolve(value: NativeProjectRevealValidation): void }>();
  private pending = new Map<number, { input: unknown; nativeStarted: boolean; resolve: (value: ServiceResult<ServicePayload>) => void; timer: Timer }>();
  private readiness?: { resolve: (ready: boolean) => void; timer: Timer };
  private onStatus: (status: BackendStatus) => void;

  constructor(onStatus: (status: BackendStatus) => void = () => undefined,
    private readonly nativeReveal?: (target: TrustedProjectRevealTarget, isCurrent: () => boolean, authorize: () => Promise<NativeProjectRevealValidation>, signal?: AbortSignal) => Promise<NativeProjectRevealResult>,
  ) {
    this.onStatus = onStatus;
  }

  get currentStatus(): BackendStatus { return this.status; }

  markStartupFailure(error?: unknown): void {
    this.failStartup(undefined, startupDiagnostic("process_start", error));
  }

  start(
    child: ChildProcess,
    port: ServicePort,
    databasePath: string,
    transferPort: unknown,
    timeoutMs = 8000,
  ): Promise<boolean> {
    const generation = ++this.generation;
    this.rejectPending("The local service was replaced.");
    this.nativeActive.clear();
    if (this.readiness) {
      clearTimeout(this.readiness.timer); this.readiness.resolve(false); this.readiness = undefined;
    }
    this.port?.close();
    this.child = child;
    this.port = port;
    this.setStatus({ state: "starting" });
    port.on("message", ({ data }) => { if (generation === this.generation) this.onResponse(data); });
    port.start?.();
    child.on("message", (message) => { if (generation === this.generation) this.onChildMessage(message); });
    child.on("exit", (code) => { if (generation === this.generation) this.onExit(code); });
    child.on("error", () => { if (generation === this.generation) this.onProcessError(); });
    child.on("spawn", () => undefined);

    const ready = new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => this.failStartup(resolve, startupDiagnostic("readiness_timeout")), timeoutMs);
      this.readiness = { resolve, timer };
    });
    child.postMessage({ type: "connect", databasePath }, [transferPort]);
    return ready;
  }

  request(input: unknown, timeoutMs = 10000): Promise<ServiceResult<ServicePayload>> {
    if (this.status.state !== "ready" || !this.port) {
      return Promise.resolve({ ok: false, error: { code: "service_unavailable", message: "The local service is unavailable." } });
    }
    const id = this.nextId++;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.cancelNative(id);
        this.pending.delete(id);
        resolve({ ok: false, error: { code: "service_unavailable", message: "The local service did not respond." } });
      }, timeoutMs);
      this.pending.set(id, { input, nativeStarted: false, resolve, timer });
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
    this.changeListeners.clear();
    this.rejectPending("The local service is stopping.");
    this.nativeActive.clear();
    const child = this.child;
    if (!child) { await this.waitForNativeTasks(); return; }
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
    // Cancellation stops only owned native bridges. Their bounded termination
    // confirmation participates in shutdown before app.quit may exit main.
    await this.waitForNativeTasks();
    this.port?.close();
    this.port = undefined;
    this.child = undefined;
    this.rejectPending("The local service stopped.");
  }

  private async waitForNativeTasks(): Promise<void> {
    if (this.nativeTasks.size === 0) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        Promise.allSettled([...this.nativeTasks]),
        new Promise<void>((resolve) => { timer = setTimeout(resolve, 1200); }),
      ]);
    } finally { if (timer) clearTimeout(timer); }
  }

  private onChildMessage(message: unknown): void {
    if (!isRecord(message)) return;
    if (message.type === "ready") {
      if (!this.readiness || this.status.state !== "starting") return;
      clearTimeout(this.readiness.timer);
      this.readiness.resolve(true);
      this.readiness = undefined;
      this.setStatus({ state: "ready" });
    } else if (message.type === "startup-error") {
      this.failStartup(this.readiness?.resolve, readStartupDiagnostic(message.diagnostic) ?? startupDiagnostic("service_open"));
    }
  }

  private onResponse(value: unknown): void {
    if (!this.port || this.status.state !== "ready") return;
    if (isNativeProjectRevealVerified(value)) {
      const pending = this.nativeVerifications.get(value.dispatchId);
      if (pending?.requestId === value.requestId && this.nativeActive.get(value.requestId) === value.dispatchId) {
        this.nativeVerifications.delete(value.dispatchId); pending.resolve(value.result);
      }
      return;
    }
    if (isNativeProjectRevealRequest(value)) {
      const task = this.onNativeReveal(value);
      this.nativeTasks.add(task);
      void task.finally(() => this.nativeTasks.delete(task));
      return;
    }
    if (isNativeProjectRevealCancel(value)) {
      if (this.nativeActive.get(value.requestId) === value.dispatchId) this.cancelNative(value.requestId, false);
      return;
    }
    if (isServiceEvent(value)) {
      for (const listener of [...this.changeListeners]) {
        try { listener(value.change); } catch { /* Isolate subscribers from request routing. */ }
      }
      return;
    }
    if (!isServiceResponse(value)) return;
    const pending = this.pending.get(value.id);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.cancelNative(value.id);
    this.pending.delete(value.id);
    pending.resolve(value.result);
  }

  private async onNativeReveal(message: NativeProjectRevealRequest): Promise<void> {
    const pending = this.pending.get(message.requestId);
    if (!pending || pending.nativeStarted || !message.target.authorization) return;
    const input = pending.input;
    if (isProjectRevealRequest(input)) { if (message.target.item || message.target.ancestors) return; }
    else if (isProjectFilesRequest(input) && input.type !== "workspace.listProjectFiles") {
      if (message.target.item?.relativePath !== input.relativePath || message.target.item.action !==
        (input.type === "workspace.openProjectFile" ? "open" : "reveal")) return;
    } else return;
    pending.nativeStarted = true;
    const generation = this.generation, port = this.port;
    this.nativeActive.set(message.requestId, message.dispatchId);
    const abort = new AbortController();
    this.nativeAbort.set(message.requestId, abort);
    const isCurrent = () => generation === this.generation && this.status.state === "ready" && this.port === port &&
      this.pending.get(message.requestId) === pending && this.nativeActive.get(message.requestId) === message.dispatchId;
    const authorize = (): Promise<NativeProjectRevealValidation> => {
      if (!isCurrent()) return Promise.resolve({ outcome: "rejected", problem: "request_expired" });
      return new Promise((resolve) => {
        this.nativeVerifications.set(message.dispatchId, { requestId: message.requestId, resolve });
        try { port?.postMessage({ type: "project.reveal.verify", requestId: message.requestId, dispatchId: message.dispatchId }); }
        catch {
          this.nativeVerifications.delete(message.dispatchId); resolve({ outcome: "rejected", problem: "native_unavailable" });
        }
      });
    };
    let result: NativeProjectRevealResult;
    try { result = this.nativeReveal ? await this.nativeReveal(message.target, isCurrent, authorize, abort.signal) : { outcome: "rejected", problem: "native_unavailable" }; }
    catch { result = { outcome: "rejected", problem: "native_error" }; }
    if (!isCurrent()) return;
    this.cancelNative(message.requestId, false);
    try { port?.postMessage({ type: "project.reveal.reply", requestId: message.requestId, dispatchId: message.dispatchId, result }); }
    catch { /* Request timeout/exit settles the caller if the port closed. */ }
  }

  private cancelNative(requestId: number, notifyService = true): void {
    const dispatchId = this.nativeActive.get(requestId);
    if (!dispatchId) return;
    this.nativeActive.delete(requestId);
    this.nativeAbort.get(requestId)?.abort();
    this.nativeAbort.delete(requestId);
    const verification = this.nativeVerifications.get(dispatchId);
    this.nativeVerifications.delete(dispatchId); verification?.resolve({ outcome: "rejected", problem: "request_expired" });
    if (!notifyService) return;
    try { this.port?.postMessage({ type: "project.reveal.cancel", requestId, dispatchId }); } catch { /* Closed transport. */ }
  }

  private onExit(code?: number): void {
    this.changeListeners.clear();
    if (this.readiness) this.failStartup(this.readiness.resolve, readStartupDiagnostic({ ...startupDiagnostic("process_exit"), exitCode: code }));
    this.rejectPending("The local service exited.");
    if (this.child) {
      const startupFailed = this.status.state === "unavailable";
      this.child = undefined;
      this.port?.close();
      this.port = undefined;
      if (!startupFailed) {
        this.setStatus({ state: "unavailable", message: "The local service stopped unexpectedly." });
      }
    }
  }

  private onProcessError(): void {
    if (this.readiness) this.failStartup(this.readiness.resolve, startupDiagnostic("process_error"));
    else this.onExit();
  }

  private failStartup(resolve = this.readiness?.resolve, diagnostic: StartupDiagnostic = startupDiagnostic("process_start")): void {
    if (this.readiness) clearTimeout(this.readiness.timer);
    this.readiness = undefined;
    resolve?.(false);
    this.setStatus({ state: "unavailable", message: "Workspace could not start its local service. Close and reopen the app to try again.", diagnostic });
    this.child?.kill();
  }

  private rejectPending(message: string): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      this.cancelNative(id);
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
