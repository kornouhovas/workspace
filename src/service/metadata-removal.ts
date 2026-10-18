import { createHash, randomUUID } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { isMetadataRemovalRequest, type PreviewMetadataRemoval, type MetadataRemovalPreview, type MetadataRemovalResult } from "../contracts/metadata-removal.js";
import { isViewFilterConfig } from "../contracts/view-filters.js";
import { isViewGroupingConfig } from "../contracts/view-grouping.js";
import { isTableLayoutConfig } from "../contracts/table-layout.js";
import { isBoardLayoutConfig } from "../contracts/board-layout.js";
import type { ServiceResult } from "../contracts/settings.js";
import type { WorkspaceChangeEvent } from "../contracts/workspaces.js";
import * as schema from "./db/schema.js";

type Database = BetterSQLite3Database<typeof schema>;
export function createMetadataRemovalService(db: Database, publish: (events: WorkspaceChangeEvent[]) => void) {
  const reviews = new Map<string, { token: string; input: PreviewMetadataRemoval; fingerprint: string }>();
  function inspect(tx: Database, input: PreviewMetadataRemoval) {
    const workspace = tx.select().from(schema.workspaces).where(eq(schema.workspaces.id, input.workspaceId)).get();
    const property = tx.select().from(schema.propertyDefinitions).where(eq(schema.propertyDefinitions.id, input.propertyId)).get();
    if (!workspace || !property || workspace.sourceId !== property.sourceId) return null;
    const options = tx.select().from(schema.selectOptions).where(eq(schema.selectOptions.propertyId, property.id)).orderBy(asc(schema.selectOptions.id)).all();
    const option = options.find(o => o.id === input.optionId), replacement = options.find(o => o.id === input.replacementOptionId);
    if (input.optionId !== null && (!option || !["single_select", "multi_select"].includes(property.propertyType))) return null;
    if (input.replacementOptionId !== null && !replacement) return null;
    const propertyRemoval = input.optionId === null;
    const oldKey = JSON.stringify(input.optionId), newKey = JSON.stringify(input.replacementOptionId);
    const remapKeys = (keys: string[]) => [...new Set(keys.flatMap(key => key !== oldKey ? [key] : replacement ? [newKey] : []))];
    const source = tx.select().from(schema.sources).where(eq(schema.sources.id, workspace.sourceId)).get()!;
    const workspaces = tx.select().from(schema.workspaces).where(eq(schema.workspaces.sourceId, source.id)).orderBy(asc(schema.workspaces.position), asc(schema.workspaces.id)).all();
    const views = tx.select().from(schema.views).where(inArray(schema.views.workspaceId, workspaces.map(w => w.id))).orderBy(asc(schema.views.id)).all();
    const projects = tx.select().from(schema.projects).where(eq(schema.projects.sourceId, source.id)).orderBy(asc(schema.projects.id)).all();
    const values = [schema.textPropertyValues, schema.numberPropertyValues, schema.datePropertyValues].flatMap(table =>
      tx.select().from(table).where(eq(table.propertyId, property.id)).all().map(v => ({ projectId: v.projectId, value: String(v.value) })));
    for (const table of [schema.selectPropertyValues, schema.multiSelectPropertyValues]) {
      for (const v of tx.select().from(table).where(eq(table.propertyId, property.id)).all()) {
        if (propertyRemoval || v.optionId === input.optionId) values.push({ projectId: v.projectId, value: options.find(o => o.id === v.optionId)!.name });
      }
    }
    const visibility = options.length ? tx.select().from(schema.selectOptionVisibility).where(inArray(schema.selectOptionVisibility.optionId, options.map(o => o.id))).all() : [];
    const changes = views.map(view => {
      const filter: unknown = JSON.parse(view.filterConfig), grouping: unknown = JSON.parse(view.groupingConfig);
      const table: unknown = JSON.parse(view.tableConfig), board: unknown = JSON.parse(view.boardConfig);
      if (!isViewFilterConfig(filter) || !isViewGroupingConfig(grouping) || !isTableLayoutConfig(table) || !isBoardLayoutConfig(board)) throw new Error("Invalid saved view");
      let filterCount = 0;
      const filterConfig = { ...filter, rules: filter.rules.flatMap(rule => {
        if (rule.propertyId !== property.id) return [rule];
        if (propertyRemoval) { filterCount++; return []; }
        if (!Array.isArray(rule.operand) || !rule.operand.includes(input.optionId)) return [rule];
        filterCount++;
        const operand = [...new Set(rule.operand.flatMap(id => id !== input.optionId ? [id] : replacement ? [replacement.id] : []))];
        return operand.length ? [{ ...rule, operand }] : [];
      }) };
      const groupingConfig = { propertyId: propertyRemoval && grouping.propertyId === property.id ? null : grouping.propertyId,
        settings: grouping.settings.flatMap(setting => setting.propertyId !== property.id ? [setting] : propertyRemoval ? [] :
          [{ ...setting, manualOrder: remapKeys(setting.manualOrder), hidden: remapKeys(setting.hidden), collapsed: remapKeys(setting.collapsed) }]) };
      const tableConfig = { ...table, columns: table.columns.filter(c => !propertyRemoval || c.propertyId !== property.id) };
      const boardConfig = { ...board, properties: board.properties.filter(p => !propertyRemoval || p.propertyId !== property.id),
        widths: board.widths.flatMap(width => {
          if (width.propertyId !== property.id) return [width];
          if (propertyRemoval) return [];
          if (width.key !== oldKey) return [width];
          return replacement && !board.widths.some(w => w.propertyId === property.id && w.key === newKey) ? [{ ...width, key: newKey }] : [];
        }) };
      return { view, filterConfig: JSON.stringify(filterConfig), groupingConfig: JSON.stringify(groupingConfig), tableConfig: JSON.stringify(tableConfig), boardConfig: JSON.stringify(boardConfig),
        usage: { workspaceId: view.workspaceId, workspaceName: workspaces.find(w => w.id === view.workspaceId)!.name, viewId: view.id, viewName: view.name,
          filters: filterCount, grouping: JSON.stringify(grouping) !== JSON.stringify(groupingConfig),
          table: JSON.stringify(table) !== JSON.stringify(tableConfig), board: JSON.stringify(board) !== JSON.stringify(boardConfig) } };
    });
    const fingerprint = createHash("sha256").update(JSON.stringify({ source, property, options, visibility, workspaces, views, projects, values })).digest("hex");
    return { source, property, options, workspaces, changes, fingerprint, preview: {
      workspaceId: input.workspaceId, sourceId: source.id, propertyId: property.id, propertyName: property.name, optionId: input.optionId, optionName: option?.name ?? null,
      replacementOptionId: input.replacementOptionId, replacementName: replacement?.name ?? null,
      projects: projects.filter(p => values.some(v => v.projectId === p.id)).map(p => ({ projectId: p.id, relativePath: p.relativePath, values: values.filter(v => v.projectId === p.id).map(v => v.value) })),
      views: changes.map(c => c.usage).filter(u => u.filters || u.grouping || u.table || u.board),
    } };
  }
  return (input: unknown): ServiceResult<MetadataRemovalPreview | MetadataRemovalResult> => {
    if (!isMetadataRemovalRequest(input)) return invalid();
    try {
      if (input.type === "workspace.previewMetadataRemoval") {
        return db.transaction(tx => {
          const state = inspect(tx, input);
          if (!state) return invalid();
          const previewToken = randomUUID();
          reviews.set(input.workspaceId, { token: previewToken, input: { ...input }, fingerprint: state.fingerprint });
          return { ok: true as const, value: { ...state.preview, previewToken } };
        });
      }
      const review = reviews.get(input.workspaceId);
      if (!review || review.token !== input.previewToken) return stale();
      const committed = db.transaction(tx => {
        const state = inspect(tx, review.input);
        if (!state || state.fingerprint !== review.fingerprint) return stale();
        for (const change of state.changes) tx.update(schema.views).set({ filterConfig: change.filterConfig, groupingConfig: change.groupingConfig, tableConfig: change.tableConfig, boardConfig: change.boardConfig }).where(eq(schema.views.id, change.view.id)).run();
        const propertyId = state.property.id;
        const selectedOptions = review.input.optionId === null ? state.options.map(o => o.id) : [review.input.optionId];
        if (selectedOptions.length) tx.delete(schema.selectOptionVisibility).where(inArray(schema.selectOptionVisibility.optionId, selectedOptions)).run();
        for (const table of [schema.selectPropertyValues, schema.multiSelectPropertyValues]) {
          const rows = tx.select().from(table).where(eq(table.propertyId, propertyId)).all();
          if (review.input.optionId === null) tx.delete(table).where(eq(table.propertyId, propertyId)).run();
          else {
            for (const row of rows.filter(v => v.optionId === review.input.optionId)) {
              tx.delete(table).where(and(eq(table.projectId, row.projectId), eq(table.propertyId, propertyId), eq(table.optionId, row.optionId))).run();
              if (review.input.replacementOptionId !== null) tx.insert(table).values({ ...row, optionId: review.input.replacementOptionId }).onConflictDoNothing().run();
            }
          }
        }
        if (selectedOptions.length) tx.delete(schema.selectOptions).where(inArray(schema.selectOptions.id, selectedOptions)).run();
        if (review.input.optionId !== null) {
          state.options.filter(o => o.id !== review.input.optionId).sort((a, b) => a.position - b.position).forEach((option, position) =>
            tx.update(schema.selectOptions).set({ position }).where(eq(schema.selectOptions.id, option.id)).run());
        }
        if (review.input.optionId === null) {
          for (const table of [schema.textPropertyValues, schema.numberPropertyValues, schema.datePropertyValues]) tx.delete(table).where(eq(table.propertyId, propertyId)).run();
          tx.delete(schema.propertyDefinitions).where(eq(schema.propertyDefinitions.id, propertyId)).run();
        }
        const revision = state.source.propertyRevision + 1;
        if (!Number.isSafeInteger(revision)) throw new Error("Revision exhausted");
        tx.update(schema.sources).set({ propertyRevision: revision }).where(eq(schema.sources.id, state.source.id)).run();
        return { ok: true as const, value: { workspaceId: input.workspaceId, sourceId: state.source.id, revision }, workspaceIds: state.workspaces.map(w => w.id) };
      });
      if (!committed.ok) return committed;
      reviews.delete(input.workspaceId);
      publish([{ type: "workspace.propertiesChanged", sourceId: committed.value.sourceId, workspaceIds: committed.workspaceIds, revision: committed.value.revision }]);
      return { ok: true, value: committed.value };
    } catch { return { ok: false, error: { code: "storage", message: "Metadata deletion could not be reviewed or saved." } }; }
  };
}
function invalid() { return { ok: false as const, error: { code: "invalid_input" as const, message: "Choose an ordinary property or option belonging to this source." } }; }
function stale() { return { ok: false as const, error: { code: "stale_preview" as const, message: "Usages changed. Review a fresh preview before deleting." } }; }
