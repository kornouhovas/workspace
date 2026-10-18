const stages = ["service_open", "service_port", "service_subscribe", "service_start", "process_start", "process_error", "process_exit", "readiness_timeout"] as const;
const codes = ["BACKUP_FAILED", "MIGRATION_FAILED", "SQLITE_BUSY", "SQLITE_LOCKED", "SQLITE_CORRUPT", "SQLITE_NOTADB", "SQLITE_CANTOPEN", "SQLITE_IOERR", "SQLITE_ERROR", "SQLITE_CONSTRAINT", "EACCES", "EPERM", "ENOENT", "EIO", "ENOSPC", "unknown"] as const;
export type StartupDiagnostic = { stage: typeof stages[number]; code: typeof codes[number]; exitCode?: number };

// Error messages, SQL, paths, stacks and native process reports are deliberately
// excluded. This finite diagnostic is safe to retain in disposable smoke evidence.
export function startupDiagnostic(stage: StartupDiagnostic["stage"], error?: unknown): StartupDiagnostic {
  // Drizzle wraps SQLite migration failures in a cause; inspect only bounded
  // error codes, retaining none of the enclosing query text or messages.
  for (let depth = 0; depth < 4 && typeof error === "object" && error !== null; depth++) {
    const rawCode = "code" in error ? error.code : undefined;
    const code = codes.find((candidate) => candidate === rawCode);
    if (code) return { stage, code };
    error = "cause" in error ? error.cause : undefined;
  }
  return { stage, code: "unknown" };
}

export function readStartupDiagnostic(value: unknown): StartupDiagnostic | undefined {
  if (typeof value !== "object" || value === null) return;
  const input = value as Record<string, unknown>;
  const stage = stages.find((candidate) => candidate === input.stage);
  const code = codes.find((candidate) => candidate === input.code);
  if (!stage || !code) return;
  return { stage, code, ...(stage === "process_exit" && Number.isSafeInteger(input.exitCode) && Math.abs(input.exitCode as number) <= 2147483648 ? { exitCode: input.exitCode as number } : {}) };
}
