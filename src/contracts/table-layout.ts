export interface TableColumn { propertyId: string; hidden: boolean; width: number; wrap: boolean }
export interface TableLayoutConfig { columns: TableColumn[]; rowOrder: string[] }
export interface TableLayoutSnapshot { workspaceId: string; viewId: string; config: TableLayoutConfig }
export type TableLayoutQuery = { type: "workspace.getTableLayout"; workspaceId: string; viewId: string };
export type TableLayoutCommand = { type: "workspace.setTableLayout"; workspaceId: string; viewId: string; config: TableLayoutConfig };
export const defaultTableLayout = (): TableLayoutConfig => ({ columns: [], rowOrder: [] });
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const uuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export function isTableLayoutConfig(v: unknown): v is TableLayoutConfig {
  return record(v) && exact(v, ["columns", "rowOrder"]) && Array.isArray(v.columns) && v.columns.length <= 1000 &&
    new Set(v.columns.map(c => record(c) ? c.propertyId : null)).size === v.columns.length && Array.from(v.columns).every(c => record(c) &&
      exact(c, ["propertyId", "hidden", "width", "wrap"]) && (c.propertyId === "name" || uuid(c.propertyId)) && typeof c.hidden === "boolean" &&
      !(c.propertyId === "name" && c.hidden) && typeof c.wrap === "boolean" && typeof c.width === "number" && Number.isInteger(c.width) && c.width >= 120 && c.width <= 800) &&
    Array.isArray(v.rowOrder) && v.rowOrder.length <= 100000 && Array.from(v.rowOrder).every(uuid) && new Set(v.rowOrder).size === v.rowOrder.length;
}
export function isTableLayoutRequest(v: unknown): v is TableLayoutQuery | TableLayoutCommand {
  return record(v) && uuid(v.workspaceId) && uuid(v.viewId) && (v.type === "workspace.getTableLayout" ? exact(v, ["type", "workspaceId", "viewId"]) :
    v.type === "workspace.setTableLayout" && exact(v, ["type", "workspaceId", "viewId", "config"]) && isTableLayoutConfig(v.config));
}
// Missing/filtered identities retain their positions; previously unseen identities append.
export function orderedProjectIds(saved: string[], current: string[]): string[] {
  const available = new Set(current), seen = new Set(saved);
  return [...saved.filter(id => available.has(id)), ...current.filter(id => !seen.has(id))];
}
