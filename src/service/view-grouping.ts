import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { defaultGroupSettings, groupKey, isViewGroupingConfig, isViewGroupingRequest, type ScalarGroupValue, type ViewGroup, type ViewGroupingConfig, type ViewGroupingSnapshot } from "../contracts/view-grouping.js";
import { isCalendarDate } from "../contracts/date-value.js";
import type { ServiceResult } from "../contracts/settings.js";
import type { PropertySnapshot } from "../contracts/text-properties.js";
import * as schema from "./db/schema.js";
type Database = BetterSQLite3Database<typeof schema>;
function validate(db: Database, sourceId: string, config: ViewGroupingConfig): boolean {
    const definitions = db.select().from(schema.propertyDefinitions).where(eq(schema.propertyDefinitions.sourceId, sourceId)).all();
    const typeFor = (id: string) => id === "name" ? "name" : definitions.find(d => d.id === id)?.propertyType;
    if (config.propertyId !== null && !["name", "text", "number", "date"].includes(typeFor(config.propertyId) ?? ""))
        return false;
    return config.settings.every(setting => {
        const type = typeFor(setting.propertyId);
        if (!type || !["name", "text", "number", "date"].includes(type))
            return false;
        return [...setting.manualOrder, ...setting.hidden, ...setting.collapsed].every(key => {
            const value: unknown = JSON.parse(key);
            if (value === null)
                return type !== "name";
            if (type === "number")
                return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER;
            if (type === "date")
                return isCalendarDate(value);
            return typeof value === "string" && value.length > 0;
        });
    });
}
export function readGrouping(db: Database, workspaceId: string, viewId: string): ServiceResult<ViewGroupingSnapshot> {
    const view = db.select().from(schema.views).where(eq(schema.views.id, viewId)).get();
    if (!view || view.workspaceId !== workspaceId)
        return invalid();
    const config: unknown = JSON.parse(view.groupingConfig);
    if (!isViewGroupingConfig(config))
        return storage();
    const workspace = db.select().from(schema.workspaces).where(eq(schema.workspaces.id, workspaceId)).get();
    if (!workspace || !validate(db, workspace.sourceId, config))
        return invalid();
    return { ok: true, value: { workspaceId, viewId, config } };
}
export function createViewGroupingService(db: Database) {
    return (input: unknown): ServiceResult<ViewGroupingSnapshot> => {
        if (!isViewGroupingRequest(input))
            return invalid();
        try {
            return db.transaction(tx => {
                const workspace = tx.select().from(schema.workspaces).where(eq(schema.workspaces.id, input.workspaceId)).get();
                const view = tx.select().from(schema.views).where(eq(schema.views.id, input.viewId)).get();
                if (!workspace || !view || view.workspaceId !== workspace.id)
                    return invalid();
                if (input.type === "workspace.setViewGrouping") {
                    if (!validate(tx, workspace.sourceId, input.config))
                        return invalid();
                    tx.update(schema.views).set({ groupingConfig: JSON.stringify(input.config) }).where(eq(schema.views.id, view.id)).run();
                }
                return readGrouping(tx, workspace.id, view.id);
            });
        }
        catch {
            return storage();
        }
    };
}
export function projectGroups(db: Database, sourceId: string, config: ViewGroupingConfig, projects: {
    projectId: string;
    name: string;
}[], values: PropertySnapshot, filteredIds: string[]): ServiceResult<ViewGroup[] | null> {
    if (!validate(db, sourceId, config))
        return invalid();
    if (config.propertyId === null)
        return { ok: true, value: null };
    const id = config.propertyId, setting = config.settings.find(s => s.propertyId === id) ?? defaultGroupSettings(id);
    const type = id === "name" ? "name" : values.definitions.find(p => p.propertyId === id)!.propertyType;
    const scalarValues = type === "number" ? values.numberValues ?? [] : type === "date" ? values.dateValues ?? [] : values.values;
    const valuesByProject = new Map(scalarValues.filter(row => row.propertyId === id).map(row => [row.projectId, row.value]));
    const groups = new Map<string, ViewGroup>();
    const add = (value: ScalarGroupValue) => {
        const key = groupKey(value);
        if (!groups.has(key))
            groups.set(key, { key, value, projectIds: [], hidden: setting.hidden.includes(key), collapsed: setting.collapsed.includes(key), empty: true });
        return groups.get(key)!;
    };
    if (type !== "name")
        add(null);
    const visible = new Set(filteredIds);
    for (const project of projects) {
        const stored = valuesByProject.get(project.projectId);
        const value = type === "name" ? project.name : stored === "" || stored === undefined ? null : stored;
        const group = add(value);
        if (visible.has(project.projectId))
            group.projectIds.push(project.projectId);
    }
    const compare = (a: ViewGroup, b: ViewGroup) => {
        if (a.value === null || b.value === null)
            return a.value === b.value ? 0 : a.value === null ? 1 : -1;
        const result = typeof a.value === "number" && typeof b.value === "number" ? a.value - b.value : a.value < b.value ? -1 : a.value > b.value ? 1 : 0;
        return setting.order === "descending" ? -result : result;
    };
    const result = [...groups.values()].sort((a, b) => {
        if (setting.order === "manual") {
            const x = setting.manualOrder.indexOf(a.key), y = setting.manualOrder.indexOf(b.key);
            if (x !== y && (x >= 0 || y >= 0))
                return x < 0 ? 1 : y < 0 ? -1 : x - y;
        }
        return compare(a, b);
    });
    for (const group of result) {
        group.empty = group.projectIds.length === 0;
        group.hidden ||= setting.hideEmpty && group.empty;
    }
    return { ok: true, value: result };
}
function invalid(): ServiceResult<never> { return { ok: false, error: { code: "invalid_input", message: "Choose an available scalar grouping property and valid group settings." } }; }
function storage(): ServiceResult<never> { return { ok: false, error: { code: "storage", message: "Grouping could not be read or saved." } }; }
