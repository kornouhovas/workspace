import { validArchive, validExclusions } from "./discovery.js";
import { isTableLayoutConfig, orderedProjectIds } from "../contracts/table-layout.js";
import { readGrouping, projectGroups } from "./view-grouping.js";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { filterOperators, isViewFilterConfig, isViewFilterRequest, type FilterType, type FilterRule, type ViewFilterPayload } from "../contracts/view-filters.js";
import { isCalendarDate } from "../contracts/date-value.js";
import type { ServiceResult } from "../contracts/settings.js";
import type { ProjectList, ProjectSummary } from "../contracts/workspaces.js";
import type { ArchiveSnapshot } from "../contracts/project-archive.js";
import type { PropertySnapshot } from "../contracts/text-properties.js";
import * as schema from "./db/schema.js";

type Database = BetterSQLite3Database<typeof schema>;
type ViewProject = Pick<ProjectSummary, "projectId" | "name" | "categoryId">;
interface ReadModel {
  listProjects(input: unknown): ServiceResult<ProjectList>;
  listArchivedProjects(input: unknown): ServiceResult<ArchiveSnapshot>;
  listTextProperties(input: unknown): ServiceResult<PropertySnapshot>;
}
export function createViewFilterService(db: Database, model: ReadModel) {
  return (input: unknown, membership?: "stored", propertySnapshot?: PropertySnapshot): ServiceResult<ViewFilterPayload> => {
    if (!isViewFilterRequest(input)) return invalid();
    try {
      return db.transaction(tx => {
        const workspace = tx.select().from(schema.workspaces).where(eq(schema.workspaces.id, input.workspaceId)).get();
        const view = tx.select().from(schema.views).where(eq(schema.views.id, input.viewId)).get();
        if (!workspace || !view || view.workspaceId !== workspace.id) return invalid();
        // An explicit replacement can repair corrupt configuration. Reads never normalize or rewrite it.
        const config: unknown = input.type === "workspace.setViewFilter" ? input.config : JSON.parse(view.filterConfig);
        if (!isViewFilterConfig(config)) return storage();
        if (input.type === "workspace.getViewFilter") return { ok: true as const, value: { workspaceId: workspace.id, viewId: view.id, config } };
        const source = tx.select().from(schema.sources).where(eq(schema.sources.id, workspace.sourceId)).get()!;
        const category = source.discoveryMode === "grouped" ? tx.select().from(schema.categoryProperties).where(eq(schema.categoryProperties.sourceId, source.id)).get() : undefined;
        const definitions = tx.select().from(schema.propertyDefinitions).where(eq(schema.propertyDefinitions.sourceId, source.id)).all();
        const categories = tx.select().from(schema.categories).where(eq(schema.categories.sourceId, source.id)).all();
        const options = tx.select().from(schema.selectOptions).where(eq(schema.selectOptions.sourceId, source.id)).all();
        const types = new Map<string, FilterType>([["name", "name"], ...definitions.map(p => [p.id, p.propertyType] as [string, FilterType])]);
        if (category) types.set(category.id, "category");
        for (const rule of config.rules) {
          const type = types.get(rule.propertyId);
          if (!type || !filterOperators(type).includes(rule.operator)) return invalid();
          if (rule.operator === "empty" || rule.operator === "not_empty") { if (rule.operand !== null) return invalid(); continue; }
          if (type === "name" || type === "text") { if (typeof rule.operand !== "string") return invalid(); }
          else if (type === "number") { if (typeof rule.operand !== "number" || !Number.isFinite(rule.operand)) return invalid(); }
          else if (type === "date") { if (!isCalendarDate(rule.operand)) return invalid(); }
          else if (!Array.isArray(rule.operand) || !rule.operand.length || rule.operand.some(id => id !== null && !(type === "category" ? categories.some(c => c.id === id) : options.some(o => o.id === id && o.propertyId === rule.propertyId)))) return invalid();
        }
        if (input.type === "workspace.setViewFilter") {
          tx.update(schema.views).set({ filterConfig: JSON.stringify(config) }).where(eq(schema.views.id, view.id)).run();
          return { ok: true as const, value: { workspaceId: workspace.id, viewId: view.id, config } };
        }
        let projects: ViewProject[];
        if (input.projection || membership === "stored" && !input.archived) {
          // This is an explicitly requested read of the displayed source, never
          // a filesystem command's authorization. All IDs must still be the
          // complete current non-archived membership of this source.
          if (input.projection && input.projection.revision !== source.discoveryRevision) return invalid();
          if (!validExclusions(JSON.parse(source.excludedRelativePaths), "grouped", !!source.folderRoles) || !validArchive(source.archiveRelativePath) ||
            !Number.isSafeInteger(source.discoveryRevision) || source.discoveryRevision < 0 ||
            !Number.isSafeInteger(source.categoryPropertyRevision) || source.categoryPropertyRevision < 0 ||
            ![null, "direct", "grouped"].includes(source.discoveryMode) || source.discoveryMode === "grouped" && !category) return storage();
          if (source.appliedRootIdentity !== null) JSON.parse(source.appliedRootIdentity);
          const archivedIds = new Set(tx.select().from(schema.projectArchives).where(eq(schema.projectArchives.sourceId, source.id)).all().map(row => row.projectId));
          const records = tx.select().from(schema.projects).where(eq(schema.projects.sourceId, source.id)).all().filter(row => !archivedIds.has(row.id));
          const byId = new Map(records.map(row => [row.id, row]));
          const ids = input.projection?.projectIds ?? records.map(row => row.id);
          if (ids.length !== records.length || ids.some(id => !byId.has(id))) return invalid();
          projects = ids.map(id => {
            const row = byId.get(id)!;
            const parent = categories.find(c => c.id === row.categoryId && !c.modeInactive && c.associationState === "active");
            if (!source.folderRoles && !row.modeInactive && row.associationState === "active" && (source.discoveryMode === "grouped"
              ? !parent || row.relativePath.split("/").length !== 2 || row.relativePath.split("/")[0] !== parent.relativePath : row.categoryId !== null)) throw new Error("Invalid required category");
            return { projectId: row.id, name: row.relativePath.split("/").at(-1)!, categoryId: row.categoryId };
          });
        } else {
          const list = input.archived ? model.listArchivedProjects({ type: "workspace.listArchivedProjects", workspaceId: workspace.id }) : model.listProjects({ type: "workspace.listProjects", workspaceId: workspace.id });
          if (!list.ok) return list;
          projects = [...list.value.projects, ...("retainedProjects" in list.value ? list.value.retainedProjects : [])];
        }
        // Only an owning backend command supplies this request-local snapshot.
        // Revalidate its identity and revision inside the current read transaction.
        const properties: ServiceResult<PropertySnapshot> = membership === "stored" && propertySnapshot?.workspaceId === workspace.id &&
          propertySnapshot.sourceId === source.id && propertySnapshot.revision === source.propertyRevision
          ? { ok: true, value: propertySnapshot }
          : model.listTextProperties({ type: "workspace.listTextProperties", workspaceId: workspace.id });
        if (!properties.ok) return properties;
        const search = config.search.trim().toLowerCase();
        const tableConfig: unknown = view.kind === "table" ? JSON.parse(view.tableConfig) : {columns:[],rowOrder:[]};
        if (!isTableLayoutConfig(tableConfig)) return storage();
        const projectById = new Map(projects.map(p => [p.projectId, p]));
        const orderedIds = view.kind === "table" ? orderedProjectIds(tableConfig.rowOrder, projects.map(p => p.projectId)) : projects.map(p => p.projectId);
        const projectIds = orderedIds.filter(id => { const project = projectById.get(id)!; return project.name.toLowerCase().includes(search) && config.rules.every(rule =>
          matches(rule, valueFor(project, rule.propertyId, types.get(rule.propertyId)!, properties.value))); });
        const grouping = readGrouping(tx,workspace.id,view.id);
        if (!grouping.ok) return grouping;
        const grouped = projectGroups(tx,source.id,grouping.value.config,orderedIds.map(id => projectById.get(id)!),properties.value,projectIds);
        if (!grouped.ok) return grouped;
        return { ok: true as const, value: { workspaceId: workspace.id, viewId: view.id, archived: input.archived, projectIds,
          ...(grouped.value ? { groups: grouped.value, groupPropertyId: grouping.value.config.propertyId } : {}) } };
      });
    } catch { return storage(); }
  };
}
function valueFor(project: ViewProject, propertyId: string, type: FilterType, values: PropertySnapshot): string | number | string[] | null {
  if (type === "name") return project.name;
  if (type === "category") return project.categoryId ?? null;
  const owned = (row: { projectId: string; propertyId: string }) => row.projectId === project.projectId && row.propertyId === propertyId;
  if (type === "multi_select") return (values.multiSelectValues ?? []).filter(owned).map(v => v.optionId);
  if (type === "single_select") return values.selectValues?.find(owned)?.optionId ?? null;
  if (type === "number") return values.numberValues?.find(owned)?.value ?? null;
  if (type === "date") return values.dateValues?.find(owned)?.value ?? null;
  return values.values.find(owned)?.value ?? null;
}
function matches(rule: FilterRule, value: string | number | string[] | null): boolean {
  const empty = value === null || value === "" || (Array.isArray(value) && !value.length);
  if (rule.operator === "empty") return empty;
  if (rule.operator === "not_empty") return !empty;
  if (Array.isArray(rule.operand)) {
    const actual = empty ? [null] : Array.isArray(value) ? value : [value];
    if (rule.operator === "all") return rule.operand.every(id => actual.includes(id));
    const any = rule.operand.some(id => actual.includes(id));
    return rule.operator === "none" ? !any : any;
  }
  // Missing values are selected only by explicit empty rules (including selection operands).
  if (empty) return false;
  const operand = rule.operand;
  if (typeof value === "string" && typeof operand === "string") {
    value = value.toLowerCase();
    if (rule.operator === "contains") return value.includes(operand.toLowerCase());
    if (rule.operator === "not_contains") return !value.includes(operand.toLowerCase());
  }
  const expected = typeof operand === "string" ? operand.toLowerCase() : operand;
  if (rule.operator === "equals") return value === expected;
  if (rule.operator === "not_equals") return value !== expected;
  if ((typeof value !== "number" && typeof value !== "string") || (typeof expected !== "number" && typeof expected !== "string")) return false;
  switch (rule.operator) {
    case "gt": return value > expected;
    case "gte": return value >= expected;
    case "lt": return value < expected;
    case "lte": return value <= expected;
    default: return false;
  }
}
function invalid(): ServiceResult<never> { return { ok: false, error: { code: "invalid_input", message: "Choose valid filter properties, operators and operands. A saved reference may no longer be available." } }; }
function storage(): ServiceResult<never> { return { ok: false, error: { code: "storage", message: "View filters could not be read or saved." } }; }
