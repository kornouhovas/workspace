/* global Buffer */
// Shared only by the native-fixture supervisor and its stream regressions.
const MAX_BYTES = 16384;
const MAX_MESSAGES = 64;
// Each accepted message can produce at most one additional handshake event;
// leave room for the fixed supervisor launch/exit/timeout/cleanup stages.
const MAX_EVENTS = MAX_MESSAGES * 2 + 8;
const stages = new Set(["main_ready", "utility_started", "worker_started", "missing_loading", "missing_verified",
  "corrupt_loading", "corrupt_verified", "fixed_loading", "fixed_loaded", "result", "ack_sent", "ack_received",
  "exit_sent", "utility_exit", "utility_timeout", "startup_failed"]);

function createProtocol(onMessage) {
  let pending = Buffer.alloc(0), bytes = 0, messages = 0, failed = false, limited = false;
  const diagnostics = { ignoredWhitespaceRecords: 0, ignoredWhitespaceTailBytes: 0,
    malformedJsonRecords: 0, unknownStageRecords: 0, incompleteTrailingBytes: 0, outputLimits: 0 };
  const rejectLimit = () => {
    failed = true;
    if (!limited) diagnostics.outputLimits++;
    limited = true; pending = Buffer.alloc(0);
  };
  return {
    rejectLimit,
    write(data) {
      // Saturate accounting and discard excess input without retaining it.
      bytes = Math.min(MAX_BYTES + 1, bytes + data.length);
      if (bytes > MAX_BYTES) rejectLimit();
      if (limited) return;
      pending = Buffer.concat([pending, data]);
      let newline;
      while ((newline = pending.indexOf(10)) >= 0) {
        const line = pending.subarray(0, newline).toString("utf8");
        pending = pending.subarray(newline + 1);
        if (line.trim() === "") { diagnostics.ignoredWhitespaceRecords++; continue; }
        let message;
        try { message = JSON.parse(line); }
        catch { diagnostics.malformedJsonRecords++; failed = true; continue; }
        if (!stages.has(message?.stage)) { diagnostics.unknownStageRecords++; failed = true; continue; }
        if (messages === MAX_MESSAGES) { rejectLimit(); return; }
        messages++; onMessage(message);
        if (limited) return;
      }
    },
    finish() {
      if (pending.length) {
        if (pending.toString("utf8").trim() === "") diagnostics.ignoredWhitespaceTailBytes = pending.length;
        else { diagnostics.incompleteTrailingBytes = pending.length; failed = true; }
      }
      pending = Buffer.alloc(0);
    },
    snapshot: () => ({ failed, bytes, messageCount: messages, pendingBytes: pending.length, diagnostics: { ...diagnostics } }),
  };
}

module.exports = { createProtocol, MAX_BYTES, MAX_MESSAGES, MAX_EVENTS };
