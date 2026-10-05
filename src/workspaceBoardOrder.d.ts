export function completeBoardColumnOrder(saved?: readonly string[], statusIds?: readonly string[]): string[];
export function reorderBoardColumns(order: readonly string[], visibleIds: readonly string[], activeId: string, targetIndex: number): string[] | null;
export type BoardOrderSnapshot = { headers: string[]; bodies: string[]; activeId: string | null; pending: number | null };
export function createBoardOrderSession(order?: readonly string[], visibleIds?: readonly string[]): {
 reset(order: readonly string[], visibleIds?: readonly string[]): void;
 snapshot(): BoardOrderSnapshot;
 start(id: string): boolean;
 preview(index: number): void;
 cancel(): void;
 drop(valid: boolean): { token: number; order: string[] } | null;
 settle(token: number, success: boolean): boolean;
};
export function boardOrderPointerActivated(startX: number, startY: number, x: number, y: number): boolean;
export function boardOrderPointerInside(rect: { left: number; right: number; top: number; bottom: number } | null | undefined, x: number, y: number): boolean;
export function boardOrderScrollSpeed(rect: { left: number; right: number }, x: number): number;
export function boardOrderPointerIndex(x: number, scrollLeft: number, firstCenter: number, step: number): number;

export type BoardOrderDragOrigin = { startX: number; startY: number; scrollLeft: number; scrollTop: number; sourceIndex: number; step: number; slotOffsets?: readonly number[] };
export function boardOrderDragGeometry(origin: BoardOrderDragOrigin, x: number, y: number, scrollLeft: number, scrollTop: number): { x: number; y: number; index: number };
