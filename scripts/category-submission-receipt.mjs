// Passive evidence for one category-unavailable action. Serialized by Electron
// evaluate: keep state and allowlists inside this callback. Never supplies a command.
export function installCategorySubmissionReceipt({ MessageChannelMain, app }, binding) {
  globalThis.categorySubmissionReceipt?.dispose();
  const probe = new MessageChannelMain(), prototype = Object.getPrototypeOf(probe.port1);
  probe.port1.close(); probe.port2.close();
  const receipt = { requests: 0, requestBindingMatches: null, operationId: null, responses: 0,
    serviceOk: null, responseShapeMatches: null, outcome: "unknown", problem: "unknown", operationAbsent: null,
    observerFailed: false, expired: false };
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const wrappers = [];
  let pending, timer, active = true;
  function dispose() {
    active = false;
    clearTimeout(timer);
    for (const { name, original, wrapper } of wrappers) {
      try {
        if (prototype[name] !== wrapper) continue;
        if (original) Object.defineProperty(prototype, name, original);
        else delete prototype[name];
      } catch { receipt.observerFailed = true; }
    }
    wrappers.length = 0; pending = undefined;
    app.removeListener("will-quit", dispose);
    return { ...receipt };
  }
  function observe(port, direction, value) {
    if (!active) return;
    if (!value || typeof value !== "object") return;
    if (direction === "outgoing" && value.input?.type === "workspace.moveProjectCategory") {
      receipt.requests = Math.min(2, receipt.requests + 1);
      const input = value.input;
      const matches = Number.isSafeInteger(value.id) && value.id > 0 &&
        Reflect.ownKeys(value).sort().join() === "id,input" &&
        Reflect.ownKeys(input).sort().join() === "destinationCategoryId,expectedRevision,operationId,projectId,type,workspaceId" &&
        ["workspaceId", "projectId", "destinationCategoryId", "expectedRevision"].every(key => input[key] === binding[key]);
      receipt.requestBindingMatches = receipt.requestBindingMatches !== false && matches;
      if (pending) return;
      receipt.operationId = typeof input.operationId === "string" && uuid.test(input.operationId) ? input.operationId : null;
      pending = { port, id: value.id };
    } else if (direction === "incoming" && pending?.port === port && value.id === pending.id) {
      receipt.responses = Math.min(2, receipt.responses + 1);
      const result = value.result;
      receipt.serviceOk = typeof result?.ok === "boolean" ? result.ok : null;
      receipt.responseShapeMatches = Reflect.ownKeys(value).sort().join() === "id,result" && !!result &&
        Reflect.ownKeys(result).sort().join() === "ok,value" && !!result.value &&
        Reflect.ownKeys(result.value).sort().join() === "operation,outcome,problem";
      receipt.outcome = ["completed", "unchanged", "rejected", "recoverable"].includes(result?.value?.outcome) ? result.value.outcome : "unknown";
      receipt.problem = ["category_unavailable", "source_unavailable", "stale_configuration", "filesystem_changed"].includes(result?.value?.problem) ? result.value.problem : "unknown";
      receipt.operationAbsent = !!result?.value && Object.hasOwn(result.value, "operation") && result.value.operation === null;
      // Keep observing until inspection finishes: a first reply must not hide
      // a duplicate command or duplicate correlated reply.
    }
  }
  for (const name of ["postMessage", "emit"]) {
    const original = Object.getOwnPropertyDescriptor(prototype, name), forward = prototype[name];
    const wrapper = function (...args) {
      try {
        if (name === "postMessage") observe(this, "outgoing", args[0]);
        else if (args[0] === "message") observe(this, "incoming", args[1]?.data);
      } catch { receipt.observerFailed = true; }
      return Reflect.apply(forward, this, args);
    };
    wrappers.push({ name, original, wrapper });
    Object.defineProperty(prototype, name, { configurable: true, writable: true, value: wrapper });
  }
  timer = setTimeout(() => { receipt.expired = true; dispose(); }, 15000);
  app.once("will-quit", dispose);
  globalThis.categorySubmissionReceipt = { snapshot: () => ({ ...receipt }), dispose };
}
