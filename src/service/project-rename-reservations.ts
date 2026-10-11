import { asc, eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./db/schema.js";

type Reader = Pick<BetterSQLite3Database<typeof schema>, "select">;

// Read from SQLite on every authorization, including startup and transaction
// rechecks. No in-memory registration window can hide a committed intent.
export function readProjectRenameReservations(db: Reader, sourceId: string) {
  return db.select().from(schema.projectRenameOperations).where(eq(schema.projectRenameOperations.sourceId, sourceId))
    .orderBy(asc(schema.projectRenameOperations.operationId)).all().filter((row) => row.stage !== "completed" && row.stage !== "failed");
}

export function hasUnfinishedProjectRename(db: Reader, sourceId: string): boolean {
  return readProjectRenameReservations(db, sourceId).length > 0;
}

// Keep the entire immutable binding and mutable evidence on each placement so
// existing review snapshots also detect stage/evidence changes without a source
// discovery revision. Terminal receipts supply no extra path reservations.
export function readProjectReservations(db: Reader, sourceId: string) {
  const creations = db.select().from(schema.projectCreationOperations).where(eq(schema.projectCreationOperations.sourceId, sourceId))
    .orderBy(asc(schema.projectCreationOperations.operationId)).all().filter((row) => row.stage !== "completed" && row.stage !== "failed");
  const renames = readProjectRenameReservations(db, sourceId).flatMap((row) =>
    [...new Set([row.originalRelativePath, row.requestedRelativePath, row.stagingRelativePath])]
      .filter((relativePath): relativePath is string => relativePath !== null)
      .map((relativePath) => ({ ...row, relativePath })));
  return [...creations, ...renames];
}
