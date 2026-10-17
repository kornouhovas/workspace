export type FilterType = "name" | "category" | "text" | "number" | "date" | "single_select" | "multi_select";
export type FilterOperator = "equals" | "not_equals" | "contains" | "not_contains" | "gt" | "gte" | "lt" | "lte" | "any" | "none" | "all" | "empty" | "not_empty";
export interface FilterRule { propertyId: string; operator: FilterOperator; operand: string | number | (string | null)[] | null }
export interface ViewFilterConfig { search: string; rules: FilterRule[] }
export interface ViewFilterSnapshot { workspaceId: string; viewId: string; config: ViewFilterConfig }
export interface ViewFilterResult { workspaceId: string; viewId: string; archived: boolean; projectIds: string[] }
export type ViewFilterQuery =
  | { type: "workspace.getViewFilter"; workspaceId: string; viewId: string }
  | { type: "workspace.queryView"; workspaceId: string; viewId: string; archived: boolean };
export type ViewFilterCommand = { type: "workspace.setViewFilter"; workspaceId: string; viewId: string; config: ViewFilterConfig };
export type ViewFilterPayload = ViewFilterSnapshot | ViewFilterResult;
export const viewFilterRequests = ["workspace.getViewFilter", "workspace.queryView", "workspace.setViewFilter"];
export function filterOperators(type: FilterType): FilterOperator[] {
  if (["category", "single_select", "multi_select"].includes(type)) return ["any", "none", ...(type === "multi_select" ? ["all" as const] : []), "empty", "not_empty"];
  return ["equals", "not_equals", ...(type === "name" || type === "text" ? ["contains" as const, "not_contains" as const] : ["gt" as const, "gte" as const, "lt" as const, "lte" as const]), "empty", "not_empty"];
}
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export function isViewFilterConfig(v: unknown): v is ViewFilterConfig {
  return record(v) && exact(v, ["search", "rules"]) && typeof v.search === "string" && v.search.length <= 1000 && Array.isArray(v.rules) && v.rules.length <= 100 && Array.from(v.rules).every(rule =>
    record(rule) && exact(rule, ["propertyId", "operator", "operand"]) && (rule.propertyId === "name" || uuid(rule.propertyId)) &&
    typeof rule.operator === "string" && ["equals", "not_equals", "contains", "not_contains", "gt", "gte", "lt", "lte", "any", "none", "all", "empty", "not_empty"].includes(rule.operator) &&
    (rule.operand === null || (typeof rule.operand === "string" && rule.operand.length <= 10000) || (typeof rule.operand === "number" && Number.isFinite(rule.operand)) ||
      (Array.isArray(rule.operand) && rule.operand.length <= 1000 && Array.from(rule.operand).every(id => id === null || uuid(id)) && new Set(rule.operand).size === rule.operand.length)));
}
export function isViewFilterRequest(v: unknown): v is ViewFilterQuery | ViewFilterCommand {
  if (!record(v) || !uuid(v.workspaceId) || !uuid(v.viewId)) return false;
  if (v.type === "workspace.getViewFilter") return exact(v, ["type", "workspaceId", "viewId"]);
  if (v.type === "workspace.queryView") return exact(v, ["type", "workspaceId", "viewId", "archived"]) && typeof v.archived === "boolean";
  return v.type === "workspace.setViewFilter" && exact(v, ["type", "workspaceId", "viewId", "config"]) && isViewFilterConfig(v.config);
}
