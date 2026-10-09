import { asc, eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { ServiceResult } from "../contracts/settings.js";
import type { CategoryPropertySnapshot, WorkspaceChangeEvent } from "../contracts/workspaces.js";
import * as schema from "./db/schema.js";

type Database = BetterSQLite3Database<typeof schema>;
export function createCategoryPropertyService(db: Database, publish: (events: WorkspaceChangeEvent[]) => void) {
  return {
    renameCategoryProperty(input: unknown): ServiceResult<CategoryPropertySnapshot> {
      if (typeof input !== "object" || input === null || Array.isArray(input)) return invalid();
      const value = input as Record<string, unknown>;
      const keys = ["type", "workspaceId", "propertyId", "name"];
      if (Object.keys(value).length !== keys.length || !keys.every((key) => Object.hasOwn(value, key)) ||
        value.type !== "workspace.renameCategoryProperty" || !uuid(value.workspaceId) || !uuid(value.propertyId) ||
        typeof value.name !== "string" || !value.name.trim()) return invalid();
      const { workspaceId, propertyId, name } = value;
      try {
        const committed = db.transaction((tx) => {
          const source = tx.select().from(schema.workspaces).innerJoin(schema.sources, eq(schema.workspaces.sourceId, schema.sources.id))
            .where(eq(schema.workspaces.id, workspaceId)).get()?.sources;
          const property = tx.select().from(schema.categoryProperties).where(eq(schema.categoryProperties.id, propertyId)).get();
          if (!source || source.discoveryMode !== "grouped" || !property || property.sourceId !== source.id) return invalid();
          if (!Number.isSafeInteger(source.categoryPropertyRevision) || source.categoryPropertyRevision < 0) throw new Error("Invalid category property revision");
          const changed = property.name !== name;
          const revision = source.categoryPropertyRevision + (changed ? 1 : 0);
          if (!Number.isSafeInteger(revision)) throw new Error("Category property revision exhausted");
          if (changed) {
            tx.update(schema.categoryProperties).set({ name }).where(eq(schema.categoryProperties.id, propertyId)).run();
            tx.update(schema.sources).set({ categoryPropertyRevision: revision }).where(eq(schema.sources.id, source.id)).run();
          }
          const snapshot: CategoryPropertySnapshot = { workspaceId, sourceId: source.id, propertyId, name, revision };
          const workspaceIds = tx.select({ id: schema.workspaces.id }).from(schema.workspaces).where(eq(schema.workspaces.sourceId, source.id))
            .orderBy(asc(schema.workspaces.position), asc(schema.workspaces.id)).all().map((row) => row.id);
          return { ok: true as const, value: snapshot, changed, workspaceIds };
        });
        if (!committed.ok) return committed;
        if (committed.changed) publish([{ type: "workspace.categoryPropertyChanged", sourceId: committed.value.sourceId, workspaceIds: committed.workspaceIds, revision: committed.value.revision }]);
        return { ok: true, value: committed.value };
      } catch { return { ok: false, error: { code: "storage", message: "The category property name could not be saved." } }; }
    },
  };
}
function uuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function invalid() {
  return { ok: false as const, error: { code: "invalid_input" as const, message: "Choose a saved grouped workspace and its category property, and enter a nonblank name." } };
}
