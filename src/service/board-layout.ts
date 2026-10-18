import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { isBoardLayoutConfig, isBoardLayoutRequest, type BoardLayoutSnapshot } from "../contracts/board-layout.js";
import { defaultGroupSettings } from "../contracts/view-grouping.js";
import { validateGrouping } from "./view-grouping.js";
import type { ServiceResult } from "../contracts/settings.js";
import * as schema from "./db/schema.js";
type Database = BetterSQLite3Database<typeof schema>;
export function createBoardLayoutService(db: Database) {
  return (input: unknown): ServiceResult<BoardLayoutSnapshot> => {
    if (!isBoardLayoutRequest(input)) return invalid();
    try {
      return db.transaction(tx => {
        const workspace = tx.select().from(schema.workspaces).where(eq(schema.workspaces.id, input.workspaceId)).get();
        const view = tx.select().from(schema.views).where(eq(schema.views.id, input.viewId)).get();
        if (!workspace || !view || view.workspaceId !== workspace.id) return invalid();
        const config: unknown = input.type === "workspace.setBoardLayout" ? input.config : JSON.parse(view.boardConfig);
        if (!isBoardLayoutConfig(config)) return { ok: false as const, error: { code: "storage" as const, message: "Invalid saved Board layout. Reset explicitly to repair it." } };
        {
          const definitions = tx.select().from(schema.propertyDefinitions).where(eq(schema.propertyDefinitions.sourceId, workspace.sourceId)).all();
          const category = tx.select().from(schema.categoryProperties).where(eq(schema.categoryProperties.sourceId, workspace.sourceId)).get();
          const properties = new Set(["name", ...definitions.map(p => p.id), ...(category ? [category.id] : [])]);
          const validProperties = !config.properties.some(p => !properties.has(p.propertyId));
          // Reuse the exact grouping-key policy, including source ownership. Dormant
          // category presentation survives a mode switch without becoming a destination.
          const validWidths = validateGrouping(tx, workspace.sourceId, {propertyId: null, settings: config.widths.map(c => ({...defaultGroupSettings(c.propertyId), manualOrder:[c.key]}))}, true);
          if (!validProperties || !validWidths) return input.type === "workspace.setBoardLayout" ? invalid() : { ok: false as const, error: { code: "storage" as const, message: "Invalid saved Board references. Reset explicitly to repair them." } };
          if (input.type === "workspace.setBoardLayout") tx.update(schema.views).set({ boardConfig: JSON.stringify(config) }).where(eq(schema.views.id, view.id)).run();
        }
        return { ok: true as const, value: { workspaceId: workspace.id, viewId: view.id, config } };
      });
    } catch { return { ok: false, error: { code: "storage", message: "Board layout could not be read or saved." } }; }
  };
}
function invalid(): ServiceResult<never> { return { ok: false, error: { code: "invalid_input", message: "Choose valid Board properties, group identities and widths." } }; }
