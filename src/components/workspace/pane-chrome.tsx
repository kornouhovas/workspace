import { retainViewPreview } from "@/workspaceViewPreview.js";
import { useEffect, useRef, useState, type ReactNode, type PointerEvent } from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import Cancel01Icon from "@hugeicons/core-free-icons/Cancel01Icon";
import SidebarRightIcon from "@hugeicons/core-free-icons/SidebarRightIcon";
import ExpandIcon from "@hugeicons/core-free-icons/ExpandIcon";
import CollapseIcon from "@hugeicons/core-free-icons/CollapseIcon";
import File01Icon from "@hugeicons/core-free-icons/File01Icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";
import type { PaneAction, PaneLayout } from "@/workspacePaneLayout";

export function ChromeIcon({
  icon,
  className = "size-4",
}: {
  icon: IconSvgElement;
  className?: string;
}) {
  return <HugeiconsIcon icon={icon} strokeWidth={1.5} className={className} aria-hidden="true" />;
}
export function ChromeAction({
  label,
  children,
  onClick,
  disabled = false,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="bb-chrome-action electron-window-no-drag"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent sideOffset={6}>{label}</TooltipContent>
    </Tooltip>
  );
}
export function PaneResize({
  label,
  value,
  min,
  max,
  onResize,
  ratio = false,
  growDirection = -1,
  onResizeStart,
  onReachMax,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onResize: (value: number) => void;
  ratio?: boolean;
  growDirection?: 1 | -1;
  onResizeStart?: () => void;
  onReachMax?: () => void;
}) {
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);
  function begin(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    cleanup.current?.();
    const target = event.currentTarget;
    const pointerId = event.pointerId;
    target.setPointerCapture(pointerId);
    document.documentElement.dataset.paneResizing = "true";
    onResizeStart?.();
    const start = event.clientX;
    const initial = value;
    const width = target.parentElement?.getBoundingClientRect().width || 1;
    const move = (e: globalThis.PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      const next = Math.max(min, Math.min(max, initial + (e.clientX - start) * (ratio ? 1 / width : growDirection)));
      if (next >= max && onReachMax) {
        end();
        onReachMax();
      } else onResize(next);
    };
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      target.removeEventListener("lostpointercapture", end);
      if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId);
      delete document.documentElement.dataset.paneResizing;
      cleanup.current = null;
    };
    cleanup.current = end;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    target.addEventListener("lostpointercapture", end);
  }
  return (
    <div
      role="separator"
      aria-label={label}
      aria-orientation="vertical"
      aria-valuenow={Math.round(value * (ratio ? 100 : 1))}
      aria-valuemin={Math.round(min * (ratio ? 100 : 1))}
      aria-valuemax={Math.round(max * (ratio ? 100 : 1))}
      tabIndex={0}
      className="bb-pane-resize"
      onPointerDown={begin}
      onKeyDown={(e) => {
        if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
          e.preventDefault();
          onResize(
            e.key === "Home"
              ? min
              : e.key === "End"
                ? max
                : Math.max(
                    min,
                    Math.min(max, value + (e.key === "ArrowRight" ? 1 : -1) * (ratio ? 0.02 : 16)),
                  ),
          );
        }
      }}
    />
  );
}
export function ChromeTab({
  label,
  active,
  icon = File01Icon,
  onSelect,
  onClose,
  children,
  draggable = false,
  onDragStart,
  onDrop,
}: {
  label: string;
  active: boolean;
  icon?: IconSvgElement;
  onSelect: () => void;
  onClose?: () => void;
  children?: ReactNode;
  draggable?: boolean;
  onDragStart?: (event: React.DragEvent) => void;
  onDrop?: (event: React.DragEvent) => void;
}) {
  return (
    <div
      className={cn("bb-tab-pill", active && "bb-tab-active")}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={(e) => {
        if (onDrop) e.preventDefault();
      }}
      onDrop={onDrop}
      onAuxClick={(e) => {
        if (e.button === 1 && onClose) {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <button
        type="button"
        role="tab"
        aria-selected={active}
        aria-label={label}
        onClick={onSelect}
        className="bb-tab-select"
      >
        <span className={cn("bb-tab-icon", onClose && "bb-tab-closable-icon")}>
          <ChromeIcon icon={icon} className="size-3.5" />
        </span>
        <span className="bb-tab-label" title={label}>
          {label}
        </span>
      </button>
      {onClose && (
        <button
          type="button"
          className="bb-tab-close"
          aria-label={`Close ${label}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          <ChromeIcon icon={Cancel01Icon} className="size-3.5" />
        </button>
      )}
      {children}
    </div>
  );
}
export function WorkspaceRightPanel({
  previewIdentity,
  interactionDisabled = false,
  layout,
  suppressed = false,
  send,
  project,
  projectName,
  onCloseProject,
  onMaximizeProject,
}: {
  previewIdentity: string;
  interactionDisabled?: boolean;
  layout: PaneLayout;
  suppressed?: boolean;
  send: (action: PaneAction) => void;
  project?: ReactNode;
  projectName?: string;
  onCloseProject: () => void;
  onMaximizeProject: () => void;
}) {
  const { t } = useI18n();
  const [viewportWidth, setViewportWidth] = useState(window.innerWidth);
  useEffect(() => {
    const resize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  const availableWidth = viewportWidth - (layout.sidebarCollapsed ? 0 : layout.sidebarWidth);
  const rightWidth =
    !layout.rightWidthManual
      ? availableWidth / 2
      : Math.min(layout.rightWidth, availableWidth);
  const resizeStartWidth = useRef(rightWidth);
  const showProject = !!project;
  const visible = layout.rightVisible && !suppressed && showProject;
  const previousProject = useRef<{ identity: string; project: ReactNode | undefined } | undefined>(undefined);
  const identityChanged = previousProject.current?.identity !== previewIdentity;
  previousProject.current = retainViewPreview(previousProject.current, previewIdentity, showProject ? project : undefined, visible);
  const previousName = useRef(projectName);
  if (visible || identityChanged) previousName.current = visible ? projectName : undefined;
  const [exitComplete, setExitComplete] = useState(!visible);
  useEffect(() => {
    if (visible) { setExitComplete(false); return; }
    const timer = window.setTimeout(() => {
      previousProject.current = { identity: previewIdentity, project: undefined };
      setExitComplete(true);
    }, 240);
    return () => window.clearTimeout(timer);
  }, [visible, previewIdentity]);
  const contentProject = suppressed ? undefined : visible ? (showProject ? project : undefined) : exitComplete ? undefined : previousProject.current?.project;
  return (
    <aside
      className="bb-right-panel"
      inert={!visible || interactionDisabled}
      onClickCapture={event => { if (interactionDisabled) { event.preventDefault(); event.stopPropagation(); } }}
      onPointerDownCapture={event => { if (interactionDisabled) { event.preventDefault(); event.stopPropagation(); } }}
      onKeyDownCapture={event => { if (interactionDisabled) { event.preventDefault(); event.stopPropagation(); } }}
      aria-hidden={!visible}
      data-open={visible}
      data-suppressed={suppressed}
      data-testid="workspace-right-panel"
      data-leading={layout.maximized === "right"}
      style={{
        width: visible ? (layout.maximized === "right" ? availableWidth : rightWidth) : 0,
        maxWidth: undefined,
      }}
      onFocusCapture={() => send({ type: "focus", pane: "right" })}
    >
      <PaneResize
        label={t("chrome.resizeRight")}
        value={rightWidth}
        min={280}
        max={availableWidth}
        onResizeStart={() => { resizeStartWidth.current = rightWidth; }}
        onReachMax={showProject ? () => {
          send({ type: "resizeRight", width: resizeStartWidth.current });
          onMaximizeProject();
        } : undefined}
        onResize={(width) => send({ type: "resizeRight", width })}
      />
      <header className={cn("bb-pane-header", visible && "electron-window-drag")}>
        <div className="bb-tab-overflow" role="tablist" aria-label={t("chrome.rightViews")}>
          <ChromeTab
            label={(visible ? projectName : previousName.current) || "Project"}
            active
            icon={File01Icon}
            onSelect={() => send({ type: "focus", pane: "right" })}
          />
        </div>
        <ChromeAction
          label={t(layout.maximized === "right" ? "chrome.restoreSplit" : "chrome.maximize")}
          onClick={onMaximizeProject}
        >
          <ChromeIcon icon={layout.maximized === "right" ? CollapseIcon : ExpandIcon} className="size-[13px]" />
        </ChromeAction>
        <ChromeAction
          label={t("chrome.hideRight")}
          onClick={onCloseProject}
        >
          <ChromeIcon icon={SidebarRightIcon} />
        </ChromeAction>
      </header>
      <div className="bb-pane-content">{contentProject}</div>
    </aside>
  );
}
