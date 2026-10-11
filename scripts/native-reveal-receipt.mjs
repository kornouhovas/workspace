import { withDeadline } from "./runtime-lifecycle.mjs";

// Serialized verbatim by ElectronApplication.evaluate. Keep all capture logic
// inside this callback; it must not depend on this module's lexical scope.
export function installNativeRevealReceipt({ MessageChannelMain, app }, options) {
  if (globalThis.creationRevealReceipt) return globalThis.creationRevealReceipt.snapshot();
  const problems = ["unconfigured", "mode_retained", "excluded", "missing", "replaced", "unresolved", "root_unavailable", "root_replaced", "category_unavailable", "unavailable", "native_unavailable", "native_error", "request_expired"];
  const errors = ["invalid_input", "filesystem", "storage", "service_unavailable", "stale_preview"];
  const record = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
  const exact = (value, keys) => record(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
  const uuid = (value) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  const id = (value) => Number.isSafeInteger(value) && value > 0;
  const target = (value) => exact(value, ["canonicalRoot", "parentRelativePath", "relativePath", "rootIdentity", "parentIdentity", "nativeIdentity"]) &&
    [value.canonicalRoot, value.parentRelativePath, value.relativePath].every((path) => typeof path === "string" && !path.includes("\0")) && value.canonicalRoot !== "" && value.relativePath !== "" &&
    [value.rootIdentity, value.parentIdentity, value.nativeIdentity].every((encoded) => {
      if (typeof encoded !== "string" || encoded.length > 256) return false;
      try {
        const identity = JSON.parse(encoded);
        return exact(identity, ["dev", "ino", "birthtimeNs"]) && typeof identity.dev === "string" && /^[0-9]+$/.test(identity.dev) &&
          [identity.ino, identity.birthtimeNs].every((part) => typeof part === "string" && /^[0-9]+$/.test(part) && BigInt(part) > 0n);
      } catch { return false; }
    });
  let state = "unarmed", supported = false, armed = false, pending, expectedWorkspace;
  let start, lastAt = 0, timer, truncated = false, observerFailed = false;
  let nativeBoundaryLatencyMs = "unknown";
  const emptyReceipt = () => ({ classification: "missing", serviceOk: "unknown", outcome: "unknown", problem: "unknown", errorCode: "unknown", workspaceMatched: "unknown", projectMatched: "unknown" });
  let receipt = emptyReceipt();
  const records = [], wrappers = [];
  const at = () => {
    const elapsed = performance.now() - start;
    if (!Number.isFinite(elapsed)) throw new Error("Capture clock unavailable");
    lastAt = Math.max(lastAt, Math.min(60000, Math.max(0, elapsed)));
    return lastAt;
  };
  const add = (boundary, fields = {}) => {
    if (records.length < 64) records.push({ boundary, atMs: at(), ...fields });
    else truncated = true;
  };
  const restore = () => {
    for (const { prototype, name, originalDescriptor, wrapper } of wrappers) {
      try {
        // A later owner must never be overwritten by our disposal.
        if (prototype[name] !== wrapper) continue;
        if (originalDescriptor) Object.defineProperty(prototype, name, originalDescriptor);
        else delete prototype[name];
      } catch { observerFailed = true; }
    }
    wrappers.length = 0;
  };
  const release = () => {
    pending = undefined; expectedWorkspace = undefined;
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    restore();
    try { app?.removeListener("will-quit", dispose); } catch { observerFailed = true; }
  };
  const expire = () => {
    if (state !== "armed" && state !== "pending") return;
    try { add("expired"); } catch { observerFailed = true; }
    finally { state = "expired"; release(); }
  };
  function dispose() {
    try { if (state === "armed" || state === "pending") add("disposed"); }
    catch { observerFailed = true; }
    finally {
      if (state !== "settled" && state !== "expired" && state !== "unsupported") state = "disposed";
      release();
    }
  }
  const active = () => {
    if (state !== "armed" && state !== "pending") return false;
    if (at() >= 60000) { expire(); return false; }
    return true;
  };
  const classifyOutcome = (value, verification = false, binding = false) => {
    const result = { classification: "malformed", outcome: "unknown", problem: "unknown" };
    if (!record(value)) return result;
    result.outcome = ["dispatched", "rejected", ...(verification ? ["verified"] : [])].includes(value.outcome) ? value.outcome : "unknown";
    result.problem = problems.includes(value.problem) ? value.problem : "unknown";
    const keys = ["outcome", ...(binding ? ["workspaceId", "projectId"] : []), ...(result.outcome === "rejected" ? ["problem"] : [])];
    result.classification = result.outcome === "unknown" || (result.outcome === "rejected" && result.problem === "unknown") ? "unknown" : exact(value, keys) ? "valid" : "malformed";
    return result;
  };
  const observe = (port, direction, message) => {
    if (!active()) return;
    if (!record(message)) { add("malformed"); return; }
    if (direction === "outgoing" && message.input?.type === "workspace.revealProject") {
      if (pending) { add("request_ignored"); return; }
      if (!exact(message, ["id", "input"]) || !id(message.id) || !exact(message.input, ["type", "workspaceId", "projectId"]) || !uuid(message.input.workspaceId) || !uuid(message.input.projectId)) { add("request_malformed"); return; }
      if (message.input.workspaceId !== expectedWorkspace) { add("request_binding_mismatch"); return; }
      pending = { port, id: message.id, workspaceId: message.input.workspaceId, projectId: message.input.projectId };
      state = "pending"; add("request"); return;
    }
    const nativeTypes = ["project.reveal.native", "project.reveal.verify", "project.reveal.verified", "project.reveal.reply", "project.reveal.cancel"];
    if (nativeTypes.includes(message.type)) {
      if (!pending || port !== pending.port || message.requestId !== pending.id || !uuid(message.dispatchId)) { add("native_binding_mismatch"); return; }
      const boundary = message.type;
      const incoming = ["project.reveal.native", "project.reveal.verified"].includes(boundary);
      if (boundary !== "project.reveal.cancel" && incoming !== (direction === "incoming")) { add("native_direction_mismatch"); return; }
      if (boundary === "project.reveal.native") {
        if (pending.dispatchId) { add("native_duplicate"); return; }
        if (!exact(message, ["type", "requestId", "dispatchId", "target"]) || !target(message.target)) { add("native_malformed"); return; }
        pending.dispatchId = message.dispatchId; pending.nativeAt = at(); add(boundary); return;
      }
      if (message.dispatchId !== pending.dispatchId) { add("native_binding_mismatch"); return; }
      const hasResult = ["project.reveal.verified", "project.reveal.reply"].includes(boundary);
      if (!exact(message, ["type", "requestId", "dispatchId", ...(hasResult ? ["result"] : [])])) { add("native_malformed"); return; }
      if (boundary === "project.reveal.reply") {
        if (pending.replied) { add("native_duplicate"); return; }
        pending.replied = true;
        nativeBoundaryLatencyMs = Math.max(0, at() - pending.nativeAt);
      }
      add(boundary, hasResult ? classifyOutcome(message.result, boundary === "project.reveal.verified") : {});
      return;
    }
    if (direction !== "incoming" || !Object.hasOwn(message, "id")) return;
    if (!pending || message.id !== pending.id || port !== pending.port) { add("response_binding_mismatch"); return; }
    const result = message.result;
    receipt = { ...emptyReceipt(), classification: "malformed" };
    if (record(result)) {
      receipt.serviceOk = result.ok === true || result.ok === false ? result.ok : "unknown";
      if (result.ok === true) {
        receipt = { ...receipt, ...classifyOutcome(result.value, false, true) };
        const value = result.value;
        receipt.workspaceMatched = typeof value?.workspaceId === "string" ? value.workspaceId === pending.workspaceId : "unknown";
        receipt.projectMatched = typeof value?.projectId === "string" ? value.projectId === pending.projectId : "unknown";
        if (receipt.workspaceMatched !== true || receipt.projectMatched !== true) receipt.classification = "invalid_binding";
        if (!exact(result, ["ok", "value"])) receipt.classification = "malformed";
      } else if (result.ok === false) {
        receipt.errorCode = errors.includes(result.error?.code) ? result.error.code : "unknown";
        receipt.classification = receipt.errorCode === "unknown" ? "unknown" : exact(result, ["ok", "error"]) && exact(result.error, ["code", "message"]) && typeof result.error.message === "string" ? "valid" : "malformed";
      } else receipt.classification = "unknown";
    }
    if (!exact(message, ["id", "result"])) receipt.classification = "malformed";
    add("service_response", receipt);
    // Match the public service envelope guard. A malformed envelope is ignored
    // by the real controller, so it cannot end our pending correlation either.
    const acceptedEnvelope = exact(message, ["id", "result"]) &&
      ((result?.ok === true && exact(result, ["ok", "value"])) ||
       (result?.ok === false && exact(result, ["ok", "error"]) && exact(result.error, ["code", "message"]) && errors.includes(result.error.code) && typeof result.error.message === "string"));
    if (acceptedEnvelope) { state = "settled"; release(); }
  };
  const safelyObserve = (...args) => {
    try { observe(...args); }
    catch { observerFailed = true; try { add("observer_failure"); } catch { /* Forwarding remains unconditional. */ } }
  };
  let inspection;
  try {
    inspection = new MessageChannelMain();
    const prototype = Object.getPrototypeOf(inspection.port1);
    if (!prototype || Object.getPrototypeOf(inspection.port2) !== prototype || typeof prototype.postMessage !== "function" || typeof prototype.emit !== "function" || typeof app?.once !== "function" || typeof app?.removeListener !== "function") throw new Error("Unsupported capture boundary");
    for (const name of ["postMessage", "emit"]) {
      const original = prototype[name], originalDescriptor = Object.getOwnPropertyDescriptor(prototype, name);
      const wrapper = name === "postMessage" ? function (...args) {
        safelyObserve(this, "outgoing", args[0]);
        return Reflect.apply(original, this, args);
      } : function (...args) {
        if (args[0] === "message") {
          try { safelyObserve(this, "incoming", args[1]?.data); } catch { observerFailed = true; }
        } else if (args[0] === "close" && pending?.port === this) {
          try { add("port_closed"); } catch { observerFailed = true; }
          finally { state = "disposed"; release(); }
        }
        return Reflect.apply(original, this, args);
      };
      wrappers.push({ prototype, name, originalDescriptor, wrapper });
      Object.defineProperty(prototype, name, { configurable: true, writable: true, value: wrapper });
    }
    supported = true;
  } catch { state = "unsupported"; release(); }
  finally {
    for (const port of [inspection?.port1, inspection?.port2]) {
      try { port?.close(); } catch { observerFailed = true; }
    }
    inspection = undefined;
  }
  globalThis.creationRevealReceipt = {
    arm(workspaceId) {
      if (!supported || armed || state !== "unarmed") return false;
      if (!uuid(workspaceId)) { state = "unsupported"; release(); return false; }
      try {
        armed = true; expectedWorkspace = workspaceId; start = performance.now(); state = "armed";
        add("armed");
        timer = setTimeout(expire, 60000); timer.unref?.();
        app.once("will-quit", dispose);
        return true;
      } catch { state = "unsupported"; observerFailed = true; release(); return false; }
    },
    snapshot() {
      active();
      return { supported, state, truncated, observerFailed, pending: Boolean(pending), receipt: { ...receipt }, nativeBoundaryLatencyMs,
        timing: "native request to reply boundary latency; not shell-call duration", records: records.map((entry) => ({ ...entry })) };
    },
    dispose,
  };
  globalThis.creationRevealReceipt.arm(options?.workspaceId);
  options = undefined;
  return globalThis.creationRevealReceipt.snapshot();
}

// Both normal and failure paths retain a finite snapshot before persistence.
// A capture/write error must fail acceptance, but never replace an earlier
// scenario failure or stop its caller's finally block from attempting cleanup.
export async function retainNativeRevealReceipt({ electron, retain, persist, primaryFailure, timeoutMs = 1000 }) {
  let snapshot, captureFailure;
  try {
    if (!electron) throw new Error("Native receipt application unavailable");
    snapshot = await withDeadline(electron.evaluate(() => globalThis.creationRevealReceipt?.snapshot() ?? { state: "unsupported" }), timeoutMs, "Native receipt snapshot");
    if (!snapshot?.supported || snapshot.observerFailed || !["settled", "pending", "armed"].includes(snapshot.state)) throw new Error("Native receipt capture incomplete");
  } catch (error) {
    captureFailure = error;
    snapshot ??= { state: electron ? "collection_failed" : "app_unavailable", receipt: { classification: "missing" } };
  }
  try { retain(snapshot); await withDeadline(persist(), timeoutMs, "Native receipt persistence"); }
  catch (error) { captureFailure ??= error; }
  if (captureFailure && !primaryFailure) throw captureFailure;
  return snapshot;
}
