export const BOARD_COLUMN_WIDTH_MIN: number;
export const BOARD_COLUMN_WIDTH_DEFAULT: number;
export const BOARD_COLUMN_WIDTH_PERSISTED_MAX: number;

export function normalizeBoardColumnWidth(value: unknown, fallback?: number): number;
export function getBoardColumnWidthMax(workspaceWidth: unknown): number;
