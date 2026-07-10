export const BOARD_COLUMN_WIDTH_MIN = 288;
export const BOARD_COLUMN_WIDTH_DEFAULT = 384;
export const BOARD_COLUMN_WIDTH_PERSISTED_MAX = 1600;

export function normalizeBoardColumnWidth(value, fallback = BOARD_COLUMN_WIDTH_DEFAULT) {
  const width = Number(value);
  const fallbackWidth = Number.isFinite(Number(fallback)) ? Number(fallback) : BOARD_COLUMN_WIDTH_DEFAULT;
  const normalizedWidth = Number.isFinite(width) ? Math.round(width) : Math.round(fallbackWidth);

  return Math.min(
    Math.max(normalizedWidth, BOARD_COLUMN_WIDTH_MIN),
    BOARD_COLUMN_WIDTH_PERSISTED_MAX,
  );
}

export function getBoardColumnWidthMax(workspaceWidth) {
  const width = Number(workspaceWidth);
  if (!Number.isFinite(width) || width <= 0) {
    return BOARD_COLUMN_WIDTH_DEFAULT;
  }

  return Math.min(
    Math.max(Math.floor(width / 3), BOARD_COLUMN_WIDTH_MIN),
    BOARD_COLUMN_WIDTH_PERSISTED_MAX,
  );
}
