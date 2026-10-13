// Read-only, bounded observation of one graphical rename request/response.
// Serialized by ElectronApplication.evaluate; keep its state inside the callback.
export function installRenameSubmissionReceipt({ MessageChannelMain, app }, { draft }) {
  globalThis.renameSubmissionReceipt?.dispose();
  const probe = new MessageChannelMain(), prototype = Object.getPrototypeOf(probe.port1);
  probe.port1.close(); probe.port2.close();
  const receipt = { requests: 0, requestMatchesDraft: null, responseSeen: false, serviceOk: null,
    outcome: "unknown", originalMatchesRequested: null, responseMatchesDraft: null, observerFailed: false };
  let pending, timer;
  const wrappers = [];
  function dispose() {
    clearTimeout(timer);
    for (const { name, original, wrapper } of wrappers) {
      try {
        if (prototype[name] !== wrapper) continue;
        if (original) Object.defineProperty(prototype, name, original);
        else delete prototype[name];
      } catch { receipt.observerFailed = true; }
    }
    wrappers.length = 0;
    app.removeListener("will-quit", dispose);
    pending = undefined;
  }
  function observe(port, direction, value) {
    if (!value || typeof value !== "object") return;
    if (direction === "outgoing" && value.input?.type === "workspace.renameProject") {
      receipt.requests++;
      if (pending) return;
      pending = { port, id: value.id };
      receipt.requestMatchesDraft = value.input.name === draft;
    } else if (direction === "incoming" && pending?.port === port && value.id === pending.id) {
      receipt.responseSeen = true;
      receipt.serviceOk = typeof value.result?.ok === "boolean" ? value.result.ok : null;
      const result = value.result?.value;
      if (["completed", "unchanged", "rejected", "recoverable"].includes(result?.outcome)) receipt.outcome = result.outcome;
      if (result?.operation) {
        receipt.originalMatchesRequested = result.operation.originalName === result.operation.name;
        receipt.responseMatchesDraft = result.operation.name === draft;
      }
      dispose();
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
  timer = setTimeout(dispose, 15000);
  app.once("will-quit", dispose);
  globalThis.renameSubmissionReceipt = { snapshot: () => ({ ...receipt }), dispose };
}
