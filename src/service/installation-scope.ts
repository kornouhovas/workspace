import { randomUUID } from "node:crypto";
import { linkSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Local installation authority is deliberately separate from every SQLite payload. */
export function installationScope(directory: string): string {
  mkdirSync(directory, {recursive: true});
  const path = join(directory, "installation-scope.json");
  try {
    const value: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (value && typeof value === "object" && Object.keys(value).length === 2 && "version" in value && value.version === 1 &&
      "id" in value && typeof value.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.id)) return value.id;
    throw new Error("Corrupt installation scope");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      // Preserve corrupt evidence; never reconstruct authority from the database.
      try { renameSync(path, `${path}.invalid-${randomUUID()}`); }
      catch (renameError) { if ((renameError as NodeJS.ErrnoException).code !== "ENOENT") throw renameError; }
    }
  }
  const id = randomUUID(), temporary = `${path}.${id}.tmp`;
  try {
    writeFileSync(temporary, JSON.stringify({version: 1, id}), {flag: "wx", mode: 0o600, flush: true});
    try { linkSync(temporary, path); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "EEXIST") return installationScope(directory); throw error; }
    return id;
  } finally { rmSync(temporary, {force: true}); }
}
