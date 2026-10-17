import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { isTableLayoutConfig, isTableLayoutRequest, type TableLayoutSnapshot } from "../contracts/table-layout.js";
import type { ServiceResult } from "../contracts/settings.js";
import * as schema from "./db/schema.js";
type Database = BetterSQLite3Database<typeof schema>;
export function createTableLayoutService(db: Database) {
  return (input: unknown): ServiceResult<TableLayoutSnapshot> => {
    if (!isTableLayoutRequest(input)) return invalid();
    try {
      return db.transaction(tx => {
        const workspace = tx.select().from(schema.workspaces).where(eq(schema.workspaces.id, input.workspaceId)).get();
        const view = tx.select().from(schema.views).where(eq(schema.views.id, input.viewId)).get();
        if (!workspace || !view || view.workspaceId !== workspace.id) return invalid();
        const config: unknown = input.type === "workspace.setTableLayout" ? input.config : JSON.parse(view.tableConfig);
        if (!isTableLayoutConfig(config)) return { ok: false as const, error: { code: "storage" as const, message: "Invalid saved Table layout. Reset explicitly to repair it." } };
        if (input.type === "workspace.setTableLayout") {
          const definitions = tx.select().from(schema.propertyDefinitions).where(eq(schema.propertyDefinitions.sourceId, workspace.sourceId)).all();
          const category = tx.select().from(schema.categoryProperties).where(eq(schema.categoryProperties.sourceId, workspace.sourceId)).get();
          const properties = new Map<string, string>([["name", "name"], ...definitions.map(p => [p.id, p.propertyType] as [string, string]), ...(category ? [[category.id, "category"] as [string, string]] : [])]);
          const projects = new Set(tx.select().from(schema.projects).where(eq(schema.projects.sourceId, workspace.sourceId)).all().map(p => p.id));
          if (config.columns.some(c => !properties.has(c.propertyId) || (c.wrap && properties.get(c.propertyId) !== "text")) || config.rowOrder.some(id => !projects.has(id))) return invalid();
          tx.update(schema.views).set({ tableConfig: JSON.stringify(config) }).where(eq(schema.views.id, view.id)).run();
        }
        return { ok: true as const, value: { workspaceId: workspace.id, viewId: view.id, config } };
      });
    } catch { return { ok: false, error: { code: "storage", message: "Table layout could not be read or saved." } }; }
  };
}
function invalid(): ServiceResult<never> { return { ok: false, error: { code: "invalid_input", message: "Choose valid Table properties, widths and source project identities." } }; }
