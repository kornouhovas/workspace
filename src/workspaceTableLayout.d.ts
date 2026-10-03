export const TABLE_COLUMN_WIDTH_MIN: number;
export type TableWidthTarget = { readonly workspaceId: string; readonly viewId: string };
export function normalizeTableColumnWidth(width: unknown, fallback?: number): number;
export function normalizeTableColumnWidths(value: unknown): Record<string, number>;
export function createTableColumnWidthQueue(save: (target: TableWidthTarget, widths: Record<string, number>) => Promise<unknown>): {
 read(target: TableWidthTarget, persisted: unknown): Record<string, number>;
 preview(target: TableWidthTarget, propertyId: string, width: number): void;
 commit(target: TableWidthTarget, propertyId: string, width: number, previousWidth: number): Promise<unknown>;
};
