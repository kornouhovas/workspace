const allowanceMs = 15000;
const unknown = () => ({ inputCount: "unknown", visible: null, enabled: null, editable: null, focused: null, labels: "unknown" });

// Serializable, read-only observation in the real renderer. No element handles,
// manual focus, DOM writes or caller-supplied predicate/source are involved.
export function observeRenameEditor({ deadline }) {
  function snapshot() {
    const inputs = globalThis.document.querySelectorAll("#project-rename-name");
    const inputCount = inputs.length === 0 ? "none" : inputs.length === 1 ? "one" : "multiple";
    const node = inputs.length === 1 ? inputs[0] : null;
    if (!(node instanceof globalThis.HTMLInputElement)) {
      return { inputCount, visible: false, enabled: false, editable: false, focused: false, labels: "unknown" };
    }
    const rect = node.getBoundingClientRect(), style = globalThis.getComputedStyle(node);
    const focused = node === globalThis.document.activeElement;
    const labels = node.labels?.length;
    return {
      inputCount,
      visible: rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.visibility !== "collapse",
      enabled: !node.matches(":disabled"),
      editable: !node.readOnly && node.type === "text",
      focused,
      labels: labels === 0 ? "none" : labels === 1 ? "one" : labels > 1 ? "multiple" : "unknown",
    };
  }
  function ready(value) {
    return value.inputCount === "one" && value.visible && value.enabled && value.editable && value.focused && value.labels === "one";
  }
  const initial = snapshot();
  if (Date.now() < deadline && ready(initial)) return { status: "passed", initial, final: initial };
  return new Promise((resolve, reject) => {
    let frame, timer, finished = false;
    const cleanup = () => {
      globalThis.cancelAnimationFrame(frame);
      globalThis.clearTimeout(timer);
    };
    const finish = (status, final) => {
      if (finished) return;
      finished = true;
      cleanup();
      resolve({ status, initial, final });
    };
    const fail = error => { finished = true; cleanup(); reject(error); };
    const remaining = Math.max(0, deadline - Date.now());
    // A single deadline includes transport time. Leave a small part of that
    // allowance for returning finite evidence before the host deadline fires.
    timer = globalThis.setTimeout(() => {
      try { finish("timed_out", snapshot()); } catch (error) { fail(error); }
    }, remaining);
    const poll = () => {
      try {
        const final = snapshot();
        if (Date.now() >= deadline) finish("timed_out", final);
        else if (ready(final)) finish("passed", final);
        else frame = globalThis.requestAnimationFrame(poll);
      } catch (error) { fail(error); }
    };
    frame = globalThis.requestAnimationFrame(poll);
  });
}

function classification(outcome) {
  if (outcome.status === "passed") return "ready";
  const final = outcome.final;
  if (final.inputCount === "unknown") return "unknown";
  if (final.inputCount !== "one") return "input_count";
  if (!final.visible) return "hidden";
  if (!final.enabled) return "disabled";
  if (!final.editable) return "not_editable";
  if (final.labels !== "one") return "label_count";
  if (!final.focused) return "unfocused";
  return "unknown";
}

export async function waitForRenameEditor(page, { timeoutMs = allowanceMs, record = () => {} } = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > allowanceMs) throw new RangeError("Invalid rename readiness allowance");
  const deadline = Date.now() + timeoutMs;
  let timer, outcome, primary, failure = null;
  try {
    outcome = await Promise.race([
      page.evaluate(observeRenameEditor, { deadline: deadline - Math.min(50, timeoutMs / 4) }),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          failure = "timeout";
          reject(new Error("Rename editor readiness deadline exceeded"));
        }, Math.max(0, deadline - Date.now()));
      }),
    ]);
    if (outcome.status !== "passed") {
      failure = "timeout";
      throw new Error("Rename editor readiness timed out");
    }
  } catch (error) {
    primary = error;
    failure ??= "observation_error";
  } finally {
    clearTimeout(timer);
  }
  outcome ??= { status: "observation_failed", initial: unknown(), final: unknown() };
  const evidence = { ...outcome, failure, classification: classification(outcome) };
  // Recording is synchronous and adds no I/O budget. It must never replace a
  // readiness/transport failure with a secondary evidence failure.
  try { record(evidence); } catch (error) { if (!primary) primary = error; }
  if (primary) throw primary;
  return evidence;
}
