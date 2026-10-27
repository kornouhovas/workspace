import type { BoardLayoutConfig } from "../../contracts/board-layout.js";
import type { TableLayoutConfig } from "../../contracts/table-layout.js";
import type { ViewFilterConfig, ViewFilterResult } from "../../contracts/view-filters.js";

/** A validated, workspace-owned projection prepared for one view transition. */
export interface PreparedView {
  valid: boolean;
  workspaceId: string;
  viewId: string;
  archived: boolean;
  filter: ViewFilterConfig;
  result: ViewFilterResult;
  layout: { kind: "board"; config: BoardLayoutConfig } | { kind: "table"; config: TableLayoutConfig };
}
