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

// Presentation only: preserve every occurrence, including repeated Multi-select cards.
// Oversized cards own a segment and keep their full height for shared scroll access.
export function packBoardCards(heights, availableHeight, gap = 12) {
  const budget = Math.max(0, Number.isFinite(availableHeight) ? availableHeight : 0);
  let segment = 0, top = 0, height = budget, oversized = false;
  const positions = heights.map(rawHeight => {
    const cardHeight = Math.max(0, Number.isFinite(rawHeight) ? rawHeight : 0);
    if (top > 0 && top + cardHeight > budget) { segment++; top = 0; }
    const position = { segment, top };
    height = Math.max(height, top + cardHeight);
    oversized ||= cardHeight > budget;
    top += cardHeight + gap;
    return position;
  });
  return { positions, segments: segment + 1, height, oversized };
}
