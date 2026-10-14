import { spawn, type ChildProcessWithoutNullStreams, type SpawnOptionsWithoutStdio } from "node:child_process";
import { realpathSync, statSync } from "node:fs";
import { join, win32 } from "node:path";
import { performance } from "node:perf_hooks";
import { RevealFailure } from "../service/project-filesystem.js";
import type { NativeRevealContext } from "./project-reveal.js";

type ResolverOptions = {
  platform?: NodeJS.Platform;
  report?: () => unknown;
  realpath?: (path: string) => string;
  isFile?: (path: string) => boolean;
};

// The Windows loader's already loaded system modules supply the directory.
// Never search PATH or trust a SystemRoot/WINDIR override to choose executable code.
export function resolveWindowsPowerShell(options: ResolverOptions = {}): string | undefined {
  if ((options.platform ?? process.platform) !== "win32") return undefined;
  try {
    const report = (options.report ?? (() => process.report.getReport()))();
    if (typeof report !== "object" || report === null || !("sharedObjects" in report) || !Array.isArray(report.sharedObjects)) return undefined;
    const modules = report.sharedObjects;
    const find = (name: string) => modules.filter((value): value is string =>
      typeof value === "string" && win32.basename(value).toLowerCase() === name);
    const kernels = find("kernel32.dll"), natives = find("ntdll.dll");
    if (kernels.length !== 1 || natives.length !== 1) return undefined;
    const kernel = kernels[0], native = natives[0];
    const local = (path: string) => /^[a-z]:\\/i.test(path) && !path.includes("\0") && win32.normalize(path) === path;
    if (!local(kernel) || !local(native)) return undefined;
    const system = win32.dirname(kernel);
    if (win32.basename(system).toLowerCase() !== "system32" || win32.dirname(native).toLowerCase() !== system.toLowerCase()) return undefined;
    const realpath = options.realpath ?? realpathSync.native;
    const isFile = options.isFile ?? ((path: string) => statSync(path).isFile());
    const canonical = (path: string) => realpath(path).toLowerCase() === path.toLowerCase();
    if (!canonical(kernel) || !canonical(native) || !isFile(kernel) || !isFile(native)) return undefined;
    const program = win32.join(system, "WindowsPowerShell", "v1.0", "powershell.exe");
    if (!canonical(program) || !isFile(program)) return undefined;
    return program;
  } catch { return undefined; }
}

type NativeEvent = { stage: "started" | "open" | "select" | "done" | "stopped" | "unknown" | "failure" | "trace"; path: string; phase?: string; reason?: string; elapsedMs?: number };
type BridgeOptions = {
  nativeDirectory: string;
  // Resolved once by trusted main; never accepted over renderer IPC or env.
  program?: string;
  // Internal desktop/testing seams; no renderer or preload controls these.
  resolveProgram?: () => string | undefined;
  spawnProcess?: (program: string, args: string[], options: SpawnOptionsWithoutStdio) => ChildProcessWithoutNullStreams;
  onEvent?: (event: NativeEvent) => void;
  timeoutMs?: number;
  killConfirmationMs?: number;
  pollMs?: number;
};

export function createWindowsProjectReveal(options: BridgeOptions) {
  const program = Object.hasOwn(options, "program") ? options.program : (options.resolveProgram ?? resolveWindowsPowerShell)();
  return (path: string, context: NativeRevealContext): Promise<void> =>
    runWindowsProjectReveal(path, context, { ...options, resolveProgram: () => program });
}

export async function runWindowsProjectReveal(path: string, context: NativeRevealContext, options: BridgeOptions): Promise<void> {
  const current = () => !context.signal?.aborted && context.isCurrent();
  if (!current()) throw new RevealFailure("request_expired");
  const program = Object.hasOwn(options, "program") ? options.program : (options.resolveProgram ?? resolveWindowsPowerShell)();
  if (!program) throw new RevealFailure("native_unavailable");
  if (!win32.isAbsolute(path) || path.includes("\0")) throw new RevealFailure("native_error");
  const started = performance.now(), timeoutMs = options.timeoutMs ?? 12000;
  const deadline = started + timeoutMs;
  const spawnProcess = options.spawnProcess ?? ((executable, args, settings) => spawn(executable, args, { ...settings, stdio: "pipe" }));
  let child: ChildProcessWithoutNullStreams;
  try {
    // Only this owned application-script session uses Bypass; persistent policy
    // and enforced MachinePolicy/UserPolicy remain untouched and authoritative.
    child = spawnProcess(program, ["-NoProfile", "-NonInteractive", "-STA", "-ExecutionPolicy", "Bypass", "-File", join(options.nativeDirectory, "windows-project-reveal.ps1")], {
      shell: false, windowsHide: true, stdio: "pipe",
      env: { ...process.env, WORKSPACE_PROJECT_REVEAL_TARGET: path },
    });
  } catch { throw new RevealFailure("native_unavailable"); }
  return new Promise<void>((resolve, reject) => {
    let state: "initial" | "opened" | "authorizing" | "permitted" | "selected" | "done" = "initial";
    let buffer = "", bytes = 0, closed = false, settled = false;
    const tracePhases = new Set<string>();
    let failure: RevealFailure | undefined;
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    const emit = (stage: NativeEvent["stage"], details: Pick<NativeEvent, "phase" | "reason" | "elapsedMs"> = {}) => {
      const event = { stage, path, ...details };
      try {
        if (options.onEvent) options.onEvent(event);
        else process.emit("workspace:native-reveal" as never, event);
      } catch { /* Instrumentation cannot change native command behavior. */ }
    };
    const cleanup = () => {
      clearTimeout(timer); clearInterval(poll);
      if (killTimer) clearTimeout(killTimer);
      context.signal?.removeEventListener("abort", abort);
      child.stdout.removeListener("data", stdout);
      child.stderr.removeListener("data", stderr);
      // A failed kill can leave an owned child alive. Retain harmless error/close
      // listeners until its eventual close instead of causing unhandled errors.
      if (closed) {
        child.stdin.removeListener("error", pipeError);
        child.stdout.removeListener("error", pipeError);
        child.stderr.removeListener("error", pipeError);
        child.removeListener("error", processError);
        child.removeListener("close", close);
      }
    };
    const finish = () => {
      if (settled) return;
      settled = true; cleanup();
      if (failure) reject(failure); else { emit("done"); resolve(); }
    };
    const expired = () => {
      if (!failure && !settled) emit("failure", { phase: state, reason: "owner_deadline" });
      return new RevealFailure("native_unavailable");
    };
    const fail = (problem: "native_error" | "native_unavailable" | "request_expired", error?: unknown) => {
      if (settled || failure) return;
      failure = error instanceof RevealFailure ? error : new RevealFailure(problem);
      // Cancel only the process this bridge spawned. Never terminate Explorer.
      try { child.stdin.destroy(); } catch { /* A broken pipe is already terminal. */ }
      if (closed) { finish(); return; }
      killTimer = setTimeout(() => {
        emit("unknown");
        child.stdout.destroy(); child.stderr.destroy();
        child.unref?.();
        finish();
      }, options.killConfirmationMs ?? 1000);
      try { child.kill("SIGKILL"); } catch { /* Unknown termination remains a rejection. */ }
    };
    const live = () => {
      if (!current()) { fail("request_expired"); return false; }
      if (performance.now() >= deadline) { fail("native_unavailable", expired()); return false; }
      return !failure && !settled;
    };
    const permit = async () => {
      try {
        await context.permit(() => {
          if (!live()) return;
          if (state !== "authorizing") { fail("native_error"); return; }
          // Main calls this synchronously after final filesystem validation;
          // there is no extra promise continuation before the sole GO write.
          // Cancellation after this write cannot undo a COM call already starting.
          state = "permitted";
          child.stdin.end("GO\n", (error?: Error | null) => { if (error) fail("native_error"); });
        });
        if (state === "authorizing" && !failure) fail("native_error");
      } catch (error) { fail("native_error", error); }
    };
    const line = (value: string) => {
      if (!live()) return;
      const trace = /^TRACE:(assemblies|compile|shell|open|enumeration|collection|window_item|document|parent|owner|uia_root|uia_properties|uia_tabs|readiness|item|document_recheck|readiness_recheck)$/.exec(value);
      if (trace) {
        if (tracePhases.has(trace[1]) || (state !== "initial" && state !== "opened")) { fail("native_error"); return; }
        tracePhases.add(trace[1]);
        emit("trace", { phase: trace[1], elapsedMs: Math.max(0, performance.now() - started) });
        return;
      }
      if (value === "OPEN" && state === "initial") { state = "opened"; emit("open"); }
      else if (value === "READY" && state === "opened") { state = "authorizing"; void permit(); }
      else if (value === "SELECT" && state === "permitted") { state = "selected"; emit("select"); }
      else if (value === "DONE" && state === "selected") { state = "done"; }
      else {
        const diagnostic = /^FAIL:(input|navigation|readiness|permit|precommand|selection|postcheck):(input|deadline|binding|unready|permit|exception)$/.exec(value);
        if (diagnostic) emit("failure", { phase: diagnostic[1], reason: diagnostic[2] });
        fail("native_error");
      }
    };
    const stdout = (chunk: Buffer | string) => {
      if (settled || failure) return;
      bytes += Buffer.byteLength(chunk);
      if (bytes > 1024) { fail("native_error"); return; }
      const value = Buffer.isBuffer(chunk) ? chunk.toString("ascii") : chunk;
      // Buffer ASCII decoding masks high bits, so inspect original bytes too.
      if ((Buffer.isBuffer(chunk) && chunk.some((byte) => byte > 127)) || Array.from(value).some((character) => character.charCodeAt(0) > 127)) { fail("native_error"); return; }
      buffer += value;
      let index: number;
      while (!failure && (index = buffer.indexOf("\n")) !== -1) {
        const value = buffer.slice(0, index).replace(/\r$/, "");
        buffer = buffer.slice(index + 1); line(value);
      }
    };
    const stderr = (chunk: Buffer | string) => { if (Buffer.byteLength(chunk)) fail("native_error"); };
    const abort = () => fail("request_expired");
    const pipeError = () => fail("native_error");
    const processError = () => fail("native_unavailable");
    const close = (code: number | null, signal: NodeJS.Signals | null) => {
      if (closed) return;
      closed = true;
      emit("stopped");
      if (settled) { cleanup(); return; }
      if (!failure) {
        if (!current()) failure = new RevealFailure("request_expired");
        else if (performance.now() >= deadline) failure = expired();
        else if (code !== 0 || signal !== null || state !== "done" || buffer !== "") failure = new RevealFailure("native_error");
      }
      finish();
    };
    const timer = setTimeout(() => fail("native_unavailable", expired()), timeoutMs);
    const poll = setInterval(() => { live(); }, options.pollMs ?? 10);
    child.stdout.on("data", stdout); child.stderr.on("data", stderr);
    child.stdin.on("error", pipeError); child.stdout.on("error", pipeError); child.stderr.on("error", pipeError);
    child.on("error", processError); child.on("close", close);
    context.signal?.addEventListener("abort", abort, { once: true });
    emit("started");
    // Handles cancellation synchronous with spawn, before the listener attached.
    live();
  });
}
