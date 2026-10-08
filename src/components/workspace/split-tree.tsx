import { type ReactNode, type PointerEvent } from "react";
import { ChromeAction, ChromeIcon } from "./pane-chrome";
import ExpandIcon from "@hugeicons/core-free-icons/ExpandIcon";
import CollapseIcon from "@hugeicons/core-free-icons/CollapseIcon";
import Cancel01Icon from "@hugeicons/core-free-icons/Cancel01Icon";
import { useI18n } from "@/i18n";
import {
  workspaceSplitDrop,
  listWorkspacePanes,
  type WorkspaceLayoutNode,
  type WorkspacePaneNode,
} from "@/workspaceSplitTree.js";
import type { PaneLayout, PaneAction } from "@/workspacePaneLayout";

function TreeResize({
  node,
  path,
  index,
  send,
}: {
  node: Extract<WorkspaceLayoutNode, { type: "split" }>;
  path: number[];
  index: number;
  send: (action: PaneAction) => void;
}) {
  const { t } = useI18n();
  const row = node.dir === "row";
  const fraction = node.sizes[index] / (node.sizes[index] + node.sizes[index + 1]);
  const resize = (value: number) =>
    send({ type: "resizeTree", path, index, fraction: Math.max(0.15, Math.min(0.85, value)) });
  function begin(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const parent = event.currentTarget.closest(".bb-tree-split")?.getBoundingClientRect();
    if (!parent) return;
    const pairSize =
      (row ? parent.width : parent.height) * (node.sizes[index] + node.sizes[index + 1]);
    const start = row ? event.clientX : event.clientY;
    const move = (event: globalThis.PointerEvent) =>
      resize(fraction + ((row ? event.clientX : event.clientY) - start) / pairSize);
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end, { once: true });
    window.addEventListener("pointercancel", end, { once: true });
  }
  return (
    <div
      className={row ? "bb-pane-resize" : "bb-pane-resize bb-pane-resize-horizontal"}
      role="separator"
      aria-label={t("chrome.resizeSplit")}
      aria-orientation={row ? "vertical" : "horizontal"}
      aria-valuenow={Math.round(fraction * 100)}
      aria-valuemin={15}
      aria-valuemax={85}
      tabIndex={0}
      onPointerDown={begin}
      onKeyDown={(event) => {
        const negative = row ? "ArrowLeft" : "ArrowUp",
          positive = row ? "ArrowRight" : "ArrowDown";
        if ([negative, positive, "Home", "End"].includes(event.key)) {
          event.preventDefault();
          resize(
            event.key === "Home"
              ? 0.15
              : event.key === "End"
                ? 0.85
                : fraction + (event.key === positive ? 0.02 : -0.02),
          );
        }
      }}
    />
  );
}
export function WorkspaceSplitTree({
  layout,
  send,
  primary,
  renderProject,
  renderProjectActions,
  titleForPane,
  onClosePane,
  onPaneFocus,
}: {
  layout: PaneLayout;
  send: (action: PaneAction) => void;
  primary: ReactNode;
  renderProject: (pane: WorkspacePaneNode) => ReactNode;
  renderProjectActions?: (pane: WorkspacePaneNode) => ReactNode;
  titleForPane: (pane: WorkspacePaneNode) => string;
  onClosePane: (id: string) => void;
  onPaneFocus: (pane: WorkspacePaneNode) => void;
}) {
  const { t } = useI18n();
  const panes = listWorkspacePanes(layout.tree);
  const maximized = panes.find((p) => p.paneId === layout.maximized);
  function beginPaneDrag(event: PointerEvent<HTMLElement>, source: string) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    if (panes.length < 2) return;
    const restoreMaximize = layout.maximized === source;
    const start = { x: event.clientX, y: event.clientY };
    let moved = false;
    const move = (event: globalThis.PointerEvent) => {
      if (!moved && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 7) {
        moved = true;
        if (restoreMaximize) send({ type: "maximize", pane: source });
      }
    };
    const end = (event: globalThis.PointerEvent) => {
      cleanup();
      if (!moved) return;
      if (event.type === "pointercancel") {
        if (restoreMaximize) send({ type: "maximize", pane: source });
        return;
      }
      for (const pane of document.querySelectorAll<HTMLElement>("[data-pane-id]")) {
        const side = workspaceSplitDrop(pane.getBoundingClientRect(), event.clientX, event.clientY);
        if (side) {
          send({ type: "dropPane", source, target: pane.dataset.paneId!, side });
          break;
        }
      }
      if (restoreMaximize) send({ type: "maximize", pane: source });
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end, { once: true });
    window.addEventListener("pointercancel", end, { once: true });
  }
  function leaf(pane: WorkspacePaneNode) {
    return (
      <section
        className="bb-tree-pane"
        tabIndex={-1}
        data-pane-id={pane.paneId}
        data-leading={maximized ? maximized.paneId === pane.paneId : panes[0].paneId === pane.paneId}
        key={pane.paneId}
        onFocusCapture={() => {
          send({ type: "focus", pane: pane.paneId });
          onPaneFocus(pane);
        }}
        onPointerDownCapture={(event) => {
          if (
            pane.tabId === null &&
            event.target instanceof Element &&
            event.target.closest("header") &&
            !event.target.closest("button,input,textarea,select,[role=tab],[role=separator]")
          )
            beginPaneDrag(event, pane.paneId);
          send({ type: "focus", pane: pane.paneId });
          onPaneFocus(pane);
        }}
      >
        {pane.tabId === null ? (
          primary
        ) : (
          <>
            <header className="bb-pane-header electron-window-drag">
              <span
                className="truncate flex-1 text-sm electron-window-no-drag cursor-grab touch-none select-none"
                onPointerDown={(event) => beginPaneDrag(event, pane.paneId)}
              >
                {titleForPane(pane)}
              </span>
              {renderProjectActions?.(pane)}
              <ChromeAction
                label={t(
                  layout.maximized === pane.paneId ? "chrome.restoreSplit" : "chrome.maximize",
                )}
                onClick={() => send({ type: "maximize", pane: pane.paneId })}
              >
                <ChromeIcon icon={layout.maximized === pane.paneId ? CollapseIcon : ExpandIcon} className="size-[13px]" />
              </ChromeAction>
              {panes.length > 1 && (
                <ChromeAction
                  label={t("chrome.closePane")}
                  onClick={() => onClosePane(pane.paneId)}
                >
                  <ChromeIcon icon={Cancel01Icon} />
                </ChromeAction>
              )}
            </header>
            {renderProject(pane)}
          </>
        )}
      </section>
    );
  }
  function render(node: WorkspaceLayoutNode, path: number[] = []): ReactNode {
    if (node.type === "pane") return leaf(node);
    return (
      <div
        className="bb-tree-split"
        style={{ flexDirection: node.dir === "row" ? "row" : "column" }}
      >
        {node.children.map((child, index) => (
          <div
            className="bb-tree-child-pair"
            key={child.type === "pane" ? child.paneId : index}
            style={{ display: "contents" }}
          >
            <div className="bb-tree-child" style={{ flex: `${node.sizes[index]} 1 0` }}>
              {render(child, [...path, index])}
            </div>
            {index < node.children.length - 1 && (
              <TreeResize node={node} path={path} index={index} send={send} />
            )}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="bb-split-tree" data-split={panes.length > 1}>
      {maximized ? leaf(maximized) : render(layout.tree)}
    </div>
  );
}
