export function consumeDragEscape(event: { key: string; preventDefault(): void }, dragging: boolean): boolean;
export function shouldClosePaneOnEscape(event: {
  key: string;
  defaultPrevented: boolean;
  editing: boolean;
  dragging?: boolean;
  active: boolean;
}): boolean;
import type { PaneLayout } from "./workspacePaneLayout";
export function focusedPaneCloseCommand(
  layout: PaneLayout,
  projectTabId?: string | null,
  projectExpanded?: boolean,
): { kind: "projectTab" | "pane"; id: string } | { kind: "preview" } | null;
