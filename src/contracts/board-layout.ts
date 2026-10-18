export interface BoardColumnWidth { propertyId: string; key: string; width: number }
export interface BoardCardProperty { propertyId: string; hidden: boolean }
export interface BoardLayoutConfig { widths: BoardColumnWidth[]; properties: BoardCardProperty[]; wrap: boolean }
export interface BoardLayoutSnapshot { workspaceId: string; viewId: string; config: BoardLayoutConfig }
export type BoardLayoutQuery = { type: "workspace.getBoardLayout"; workspaceId: string; viewId: string };
export type BoardLayoutCommand = { type: "workspace.setBoardLayout"; workspaceId: string; viewId: string; config: BoardLayoutConfig };
export const defaultBoardLayout = (): BoardLayoutConfig => ({ widths: [], properties: [], wrap: true });
export const defaultBoardColumnWidth = 384;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const uuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const property = (v: unknown): v is string => v === "name" || uuid(v);
function groupKey(v: unknown): v is string {
  if (typeof v !== "string") return false;
  try { const parsed: unknown = JSON.parse(v); return (parsed === null || typeof parsed === "string" || (typeof parsed === "number" && Number.isFinite(parsed))) && JSON.stringify(parsed) === v; }
  catch { return false; }
}
export function isBoardLayoutConfig(v: unknown): v is BoardLayoutConfig {
  return record(v) && exact(v, ["widths", "properties", "wrap"]) && typeof v.wrap === "boolean" &&
    Array.isArray(v.widths) && v.widths.length <= 10000 && Array.from(v.widths).every(c => record(c) && exact(c, ["propertyId", "key", "width"]) && property(c.propertyId) && groupKey(c.key) && typeof c.width === "number" && Number.isInteger(c.width) && c.width >= 180 && c.width <= 800) &&
    new Set(v.widths.map(c => JSON.stringify([c.propertyId, c.key]))).size === v.widths.length &&
    Array.isArray(v.properties) && v.properties.length <= 1000 && Array.from(v.properties).every(p => record(p) && exact(p, ["propertyId", "hidden"]) && property(p.propertyId) && typeof p.hidden === "boolean" && !(p.propertyId === "name" && p.hidden)) && new Set(v.properties.map(p => p.propertyId)).size === v.properties.length;
}
export function isBoardLayoutRequest(v: unknown): v is BoardLayoutQuery | BoardLayoutCommand {
  return record(v) && uuid(v.workspaceId) && uuid(v.viewId) && (v.type === "workspace.getBoardLayout" ? exact(v, ["type", "workspaceId", "viewId"]) :
    v.type === "workspace.setBoardLayout" && exact(v, ["type", "workspaceId", "viewId", "config"]) && isBoardLayoutConfig(v.config));
}
