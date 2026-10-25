export type ScalarGroupValue = string | number | null;
export type GroupOrder = "default" | "ascending" | "descending" | "manual";
export interface GroupSettings {
    propertyId: string;
    order: GroupOrder;
    manualOrder: string[];
    hidden: string[];
    collapsed: string[];
    hideEmpty: boolean;
}
export interface ViewGroupingConfig {
    propertyId: string | null;
    settings: GroupSettings[];
}
export interface ViewGroupingSnapshot {
    workspaceId: string;
    viewId: string;
    config: ViewGroupingConfig;
}
export interface ViewGroup {
    assignmentUnavailable?: "no_status" | "nested_status" | "status_unavailable";
    key: string;
    value: ScalarGroupValue;
    // Option/category identity stays in value/key; labels may change independently.
    label?: string;
    projectIds: string[];
    hidden: boolean;
    collapsed: boolean;
    empty: boolean;
}
export type ViewGroupingQuery = {
    type: "workspace.getViewGrouping";
    workspaceId: string;
    viewId: string;
};
export type ViewGroupingCommand = {
    type: "workspace.setViewGrouping";
    workspaceId: string;
    viewId: string;
    config: ViewGroupingConfig;
};
export const groupKey = (value: ScalarGroupValue): string => JSON.stringify(value);
export const defaultGroupSettings = (propertyId: string): GroupSettings => ({ propertyId, order: "default", manualOrder: [], hidden: [], collapsed: [], hideEmpty: false });
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const uuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const property = (v: unknown): v is string => v === "name" || uuid(v);
const keys = (v: unknown): v is string[] => Array.isArray(v) && v.length <= 10000 && new Set(v).size === v.length && Array.from(v).every(key => {
    if (typeof key !== "string")
        return false;
    try {
        const value: unknown = JSON.parse(key);
        return (value === null || typeof value === "string" || (typeof value === "number" && Number.isFinite(value))) && JSON.stringify(value) === key;
    }
    catch {
        return false;
    }
});
export function isViewGroupingConfig(v: unknown): v is ViewGroupingConfig {
    return record(v) && exact(v, ["propertyId", "settings"]) && (v.propertyId === null || property(v.propertyId)) && Array.isArray(v.settings) && v.settings.length <= 1000 &&
        new Set(v.settings.map(s => record(s) ? s.propertyId : null)).size === v.settings.length && Array.from(v.settings).every(s => record(s) &&
        exact(s, ["propertyId", "order", "manualOrder", "hidden", "collapsed", "hideEmpty"]) && property(s.propertyId) &&
        typeof s.order === "string" && ["default", "ascending", "descending", "manual"].includes(s.order) && keys(s.manualOrder) && keys(s.hidden) && keys(s.collapsed) && typeof s.hideEmpty === "boolean");
}
export function isViewGroupingRequest(v: unknown): v is ViewGroupingQuery | ViewGroupingCommand {
    return record(v) && uuid(v.workspaceId) && uuid(v.viewId) && (v.type === "workspace.getViewGrouping" ? exact(v, ["type", "workspaceId", "viewId"]) :
        v.type === "workspace.setViewGrouping" && exact(v, ["type", "workspaceId", "viewId", "config"]) && isViewGroupingConfig(v.config));
}
