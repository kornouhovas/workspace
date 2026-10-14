import { randomUUID } from "node:crypto";
import { and, asc, eq, max } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { ServiceResult } from "../contracts/settings.js";
import type { TextPropertySnapshot, TextPropertyMutation } from "../contracts/text-properties.js";
import type { WorkspaceChangeEvent } from "../contracts/workspaces.js";
import * as schema from "./db/schema.js";

import { isCalendarDate } from "../contracts/date-value.js";
import { evaluateNumberExpression } from "./number-expression.js";

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
      ...(database.select().from(schema.propertyDefinitions).where(and(eq(schema.propertyDefinitions.sourceId, sourceId), eq(schema.propertyDefinitions.propertyType, "number"))).get()
        ? { numberValues: database.select().from(schema.numberPropertyValues).where(eq(schema.numberPropertyValues.sourceId, sourceId))
          .orderBy(asc(schema.numberPropertyValues.projectId), asc(schema.numberPropertyValues.propertyId)).all()
          .map(({ projectId, propertyId, value }) => ({ projectId, propertyId, value })) } : {}),
      ...(database.select().from(schema.propertyDefinitions).where(and(eq(schema.propertyDefinitions.sourceId, sourceId), eq(schema.propertyDefinitions.propertyType, "date"))).get()
        ? { dateValues: database.select().from(schema.datePropertyValues).where(eq(schema.datePropertyValues.sourceId, sourceId))
          .orderBy(asc(schema.datePropertyValues.projectId), asc(schema.datePropertyValues.propertyId)).all()
          .map(({ projectId, propertyId, value }) => ({ projectId, propertyId, value })) } : {}),
      values: database.select().from(schema.textPropertyValues).where(eq(schema.textPropertyValues.sourceId, sourceId))
        .orderBy(asc(schema.textPropertyValues.projectId), asc(schema.textPropertyValues.propertyId)).all()
        .map(({ projectId, propertyId, value }) => ({ projectId, propertyId, value })),
    };
  }
  function mutate(input: unknown, creating: boolean): ServiceResult<TextPropertyMutation> {
    const type = creating ? "workspace.createProperty" : "workspace.renameProperty";
    const keys = creating ? ["type", "workspaceId", "name", "propertyType"] : ["type", "workspaceId", "propertyId", "name"];
    if (!payload(input, type, keys) || typeof input.name !== "string" || !input.name.trim() ||
      (creating ? (input.propertyType !== "text" && input.propertyType !== "number" && input.propertyType !== "date") : !uuid(input.propertyId))) return invalid();
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
            tx.insert(schema.propertyDefinitions).values({ id: propertyId, sourceId: source.id, name, propertyType: input.propertyType as "text" | "number" | "date", position: (last ?? -1) + 1 }).run();
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
  function setValue(input: unknown, propertyType: "text" | "number" | "date"): ServiceResult<TextPropertyMutation> {
      const numeric = propertyType === "number";
      const field = numeric ? "expression" : "value";
      if (!payload(input, numeric ? "workspace.setNumberValue" : propertyType === "date" ? "workspace.setDateValue" : "workspace.setTextValue", ["type", "workspaceId", "projectId", "propertyId", field]) ||
        !uuid(input.projectId) || !uuid(input.propertyId) || (input[field] !== null && typeof input[field] !== "string")) return invalidValue();
      const workspaceId = input.workspaceId as string, projectId = input.projectId, propertyId = input.propertyId;
      let value: string | number | null = input[field] as string | null;
      if (numeric && value !== null) {
        try { value = evaluateNumberExpression(value as string); } catch { return invalidValue(); }
      }
      if (propertyType === "date" && value !== null) {
        if (!(value as string).trim()) value = null;
        else if (!isCalendarDate(value)) return invalidValue();
      }
      const table = numeric ? schema.numberPropertyValues : propertyType === "date" ? schema.datePropertyValues : schema.textPropertyValues;
      try {
        const committed = db.transaction((tx) => {
          const source = sourceFor(tx, workspaceId);
          const property = tx.select().from(schema.propertyDefinitions).where(eq(schema.propertyDefinitions.id, propertyId)).get();
          const project = tx.select().from(schema.projects).where(eq(schema.projects.id, projectId)).get();
          if (!source || !property || !project || property.propertyType !== propertyType || property.sourceId !== source.id || project.sourceId !== source.id) return invalidValue();
          const key = and(eq(table.projectId, projectId), eq(table.propertyId, propertyId));
          const existing = tx.select().from(table).where(key).get();
          const changed = (existing?.value ?? null) !== value;
          if (changed) {
            if (value === null) tx.delete(table).where(key).run();
            else if (numeric) tx.insert(schema.numberPropertyValues).values({ projectId, propertyId, sourceId: source.id, value: value as number })
              .onConflictDoUpdate({ target: [schema.numberPropertyValues.projectId, schema.numberPropertyValues.propertyId], set: { value: value as number } }).run();
            else if (propertyType === "date") tx.insert(schema.datePropertyValues).values({ projectId, propertyId, sourceId: source.id, value: value as string })
              .onConflictDoUpdate({ target: [schema.datePropertyValues.projectId, schema.datePropertyValues.propertyId], set: { value: value as string } }).run();
            else tx.insert(schema.textPropertyValues).values({ projectId, propertyId, sourceId: source.id, value: value as string })
              .onConflictDoUpdate({ target: [schema.textPropertyValues.projectId, schema.textPropertyValues.propertyId], set: { value: value as string } }).run();
            if (!Number.isSafeInteger(source.propertyRevision + 1)) throw new Error("Property revision exhausted");
            tx.update(schema.sources).set({ propertyRevision: source.propertyRevision + 1 }).where(eq(schema.sources.id, source.id)).run();
          }
          const result = snapshot(tx, workspaceId, source.id);
          const workspaceIds = tx.select({ id: schema.workspaces.id }).from(schema.workspaces).where(eq(schema.workspaces.sourceId, source.id))
            .orderBy(asc(schema.workspaces.position), asc(schema.workspaces.id)).all().map((row) => row.id);
          return { ok: true as const, value: result, workspaceIds, changed };
        });
        if (!committed.ok) return committed;
        if (committed.changed) publish([{ type: "workspace.propertiesChanged", sourceId: committed.value.sourceId, workspaceIds: committed.workspaceIds, revision: committed.value.revision }]);
        return { ok: true, value: { snapshot: committed.value, projectId, propertyId } };
      } catch { return storage(); }
  }
  return {
    setDateValue: (input: unknown) => setValue(input, "date"),
    setNumberValue: (input: unknown) => setValue(input, "number"),
    setTextValue: (input: unknown) => setValue(input, "text"),
    listTextProperties(input: unknown): ServiceResult<TextPropertySnapshot> {
      if (!payload(input, "workspace.listTextProperties", ["type", "workspaceId"])) return invalid();
      try {
        return db.transaction((tx) => {
          const source = sourceFor(tx, input.workspaceId as string);
          return source ? { ok: true as const, value: snapshot(tx, input.workspaceId as string, source.id) } : invalid();
        });
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
function invalid() { return { ok: false as const, error: { code: "invalid_input" as const, message: "Choose a saved workspace and property, and enter a nonblank name." } }; }
function storage() { return { ok: false as const, error: { code: "storage" as const, message: "Properties could not be read or saved." } }; }

function invalidValue() { return { ok: false as const, error: { code: "invalid_input" as const, message: "Choose a saved workspace, its project and matching property, and submit valid text/arithmetic/calendar date or null to clear." } }; }
