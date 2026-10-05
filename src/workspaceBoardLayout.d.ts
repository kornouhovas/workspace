export const BOARD_COLUMN_WIDTH_MIN: number;
export const BOARD_COLUMN_WIDTH_DEFAULT: number;
export const BOARD_COLUMN_WIDTH_PERSISTED_MAX: number;

export function normalizeBoardColumnWidth(value: unknown, fallback?: number): number;
export function getBoardColumnWidthMax(workspaceWidth: unknown): number;

export type BoardCardPacking = { positions: {segment: number; top: number}[]; segments: number; height: number; oversized: boolean };
export function packBoardCards(heights: readonly number[], availableHeight: number, gap?: number): BoardCardPacking;
