import { randomUUID } from "node:crypto";
import { and, asc, eq, max } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { ServiceResult } from "../contracts/settings.js";
import type { TextPropertySnapshot, TextPropertyMutation } from "../contracts/text-properties.js";
import type { WorkspaceChangeEvent } from "../contracts/workspaces.js";
import * as schema from "./db/schema.js";

type Database = BetterSQLite3Database<typeof schema>;
export function createTextPropertyService(db: Database, publish: (events: WorkspaceChangeEvent[]) => void) {
  function sourceFor(database: Pick<Database, "select">, workspaceId: string) {
    return database.select().from(schema.workspaces).innerJoin(schema.sources, eq(schema.workspaces.sourceId, schema.sources.id))
      .where(eq(schema.workspaces.id, workspaceId)).get()?.sources;
  }
  function snapshot(database: Pick<Database, "select">, workspaceId: string, sourceId: string): TextPropertySnapshot {
    const source = database.select().from(schema.sources).where(eq(schema.sources.id, sourceId)).get()!;
    if (!Number.isSafeInteger(source.propertyRevision) || source.propertyRevision < 0) throw new Error("Invalid property revision");
    return {
      workspaceId, sourceId, revision: source.propertyRevision,
      definitions: database.select().from(schema.propertyDefinitions).where(eq(schema.propertyDefinitions.sourceId, sourceId))
        .orderBy(asc(schema.propertyDefinitions.position)).all().map((row) => ({ propertyId: row.id, sourceId, name: row.name, propertyType: row.propertyType })),
      values: database.select().from(schema.textPropertyValues).where(eq(schema.textPropertyValues.sourceId, sourceId))
        .orderBy(asc(schema.textPropertyValues.projectId), asc(schema.textPropertyValues.propertyId)).all()
        .map(({ projectId, propertyId, value }) => ({ projectId, propertyId, value })),
    };
  }
  function mutate(input: unknown, creating: boolean): ServiceResult<TextPropertyMutation> {
    const type = creating ? "workspace.createProperty" : "workspace.renameProperty";
    const keys = creating ? ["type", "workspaceId", "name", "propertyType"] : ["type", "workspaceId", "propertyId", "name"];
    if (!payload(input, type, keys) || typeof input.name !== "string" || !input.name.trim() ||
      (creating ? input.propertyType !== "text" : !uuid(input.propertyId))) return invalid();
    const workspaceId = input.workspaceId as string, name = input.name;
    try {
      const committed = db.transaction((tx) => {
        const source = sourceFor(tx, workspaceId);
        if (!source) return invalid();
        const property = creating ? undefined : tx.select().from(schema.propertyDefinitions)
          .where(eq(schema.propertyDefinitions.id, input.propertyId as string)).get();
        if (!creating && (!property || property.sourceId !== source.id)) return invalid();
        const propertyId = property?.id ?? randomUUID();
        const changed = creating || property!.name !== name;
        if (changed) {
          if (creating) {
            const last = tx.select({ value: max(schema.propertyDefinitions.position) }).from(schema.propertyDefinitions)
              .where(eq(schema.propertyDefinitions.sourceId, source.id)).get()?.value;
            tx.insert(schema.propertyDefinitions).values({ id: propertyId, sourceId: source.id, name, propertyType: "text", position: (last ?? -1) + 1 }).run();
          } else tx.update(schema.propertyDefinitions).set({ name }).where(eq(schema.propertyDefinitions.id, propertyId)).run();
          if (!Number.isSafeInteger(source.propertyRevision + 1)) throw new Error("Property revision exhausted");
          tx.update(schema.sources).set({ propertyRevision: source.propertyRevision + 1 }).where(eq(schema.sources.id, source.id)).run();
        }
        const value = snapshot(tx, workspaceId, source.id);
        const workspaceIds = tx.select({ id: schema.workspaces.id }).from(schema.workspaces).where(eq(schema.workspaces.sourceId, source.id))
          .orderBy(asc(schema.workspaces.position), asc(schema.workspaces.id)).all().map((row) => row.id);
        return { ok: true as const, value, workspaceIds, changed, propertyId };
      });
      if (!committed.ok) return committed;
      if (committed.changed) publish([{ type: "workspace.propertiesChanged", sourceId: committed.value.sourceId, workspaceIds: committed.workspaceIds, revision: committed.value.revision }]);
      return { ok: true, value: { snapshot: committed.value, propertyId: committed.propertyId, projectId: null } };
    } catch { return storage(); }
  }
  return {
    listTextProperties(input: unknown): ServiceResult<TextPropertySnapshot> {
      if (!payload(input, "workspace.listTextProperties", ["type", "workspaceId"])) return invalid();
      try {
        return db.transaction((tx) => {
          const source = sourceFor(tx, input.workspaceId as string);
          return source ? { ok: true as const, value: snapshot(tx, input.workspaceId as string, source.id) } : invalid();
        });
      } catch { return storage(); }
    },
    setTextValue(input: unknown): ServiceResult<TextPropertyMutation> {
      if (!payload(input, "workspace.setTextValue", ["type", "workspaceId", "projectId", "propertyId", "value"]) ||
        !uuid(input.projectId) || !uuid(input.propertyId) || (input.value !== null && typeof input.value !== "string")) return invalidValue();
      const workspaceId = input.workspaceId as string, projectId = input.projectId, propertyId = input.propertyId, text = input.value;
      try {
        const committed = db.transaction((tx) => {
          const source = sourceFor(tx, workspaceId);
          const property = tx.select().from(schema.propertyDefinitions).where(eq(schema.propertyDefinitions.id, propertyId)).get();
          const project = tx.select().from(schema.projects).where(eq(schema.projects.id, projectId)).get();
          if (!source || !property || !project || property.propertyType !== "text" || property.sourceId !== source.id || project.sourceId !== source.id) return invalidValue();
          const key = and(eq(schema.textPropertyValues.projectId, projectId), eq(schema.textPropertyValues.propertyId, propertyId));
          const existing = tx.select().from(schema.textPropertyValues).where(key).get();
          const changed = (existing?.value ?? null) !== text;
          if (changed) {
            if (text === null) tx.delete(schema.textPropertyValues).where(key).run();
            else if (existing) tx.update(schema.textPropertyValues).set({ value: text }).where(key).run();
            else tx.insert(schema.textPropertyValues).values({ projectId, propertyId, sourceId: source.id, value: text }).run();
            if (!Number.isSafeInteger(source.propertyRevision + 1)) throw new Error("Property revision exhausted");
            tx.update(schema.sources).set({ propertyRevision: source.propertyRevision + 1 }).where(eq(schema.sources.id, source.id)).run();
          }
          const value = snapshot(tx, workspaceId, source.id);
          const workspaceIds = tx.select({ id: schema.workspaces.id }).from(schema.workspaces).where(eq(schema.workspaces.sourceId, source.id))
            .orderBy(asc(schema.workspaces.position), asc(schema.workspaces.id)).all().map((row) => row.id);
          return { ok: true as const, value, workspaceIds, changed };
        });
        if (!committed.ok) return committed;
        if (committed.changed) publish([{ type: "workspace.propertiesChanged", sourceId: committed.value.sourceId, workspaceIds: committed.workspaceIds, revision: committed.value.revision }]);
        return { ok: true, value: { snapshot: committed.value, projectId, propertyId } };
      } catch { return storage(); }
    },
    createProperty: (input: unknown) => mutate(input, true),
    renameProperty: (input: unknown) => mutate(input, false),
  };
}
function uuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function payload(input: unknown, type: string, keys: string[]): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input) &&
    Object.keys(input).length === keys.length && keys.every((key) => Object.hasOwn(input, key)) &&
    (input as Record<string, unknown>).type === type && uuid((input as Record<string, unknown>).workspaceId);
}
function invalid() { return { ok: false as const, error: { code: "invalid_input" as const, message: "Choose a saved workspace and Text property, and enter a nonblank name." } }; }
function storage() { return { ok: false as const, error: { code: "storage" as const, message: "Text properties could not be read or saved." } }; }

function invalidValue() { return { ok: false as const, error: { code: "invalid_input" as const, message: "Choose a saved workspace, its project and Text property, and submit text or null to clear." } }; }
