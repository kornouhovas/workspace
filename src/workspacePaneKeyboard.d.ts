export function shouldClosePaneOnEscape(event: {
  key: string;
  defaultPrevented: boolean;
  editing: boolean;
  active: boolean;
}): boolean;
import type { PaneLayout } from "./workspacePaneLayout";
export function focusedPaneCloseCommand(
  layout: PaneLayout,
  projectTabId?: string | null,
  projectExpanded?: boolean,
): { kind: "rightTab" | "projectTab" | "pane"; id: string } | null;
