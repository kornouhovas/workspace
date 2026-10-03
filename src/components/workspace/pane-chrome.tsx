import { retainViewPreview } from "@/workspaceViewPreview.js";
import { useEffect, useRef, useState, type ReactNode, type PointerEvent } from "react";
import { ContextMenu } from "radix-ui";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import Cancel01Icon from "@hugeicons/core-free-icons/Cancel01Icon";
import ArrowLeft01Icon from "@hugeicons/core-free-icons/ArrowLeft01Icon";
import ArrowRight01Icon from "@hugeicons/core-free-icons/ArrowRight01Icon";
import SidebarRightIcon from "@hugeicons/core-free-icons/SidebarRightIcon";
import ExpandIcon from "@hugeicons/core-free-icons/ExpandIcon";
import CollapseIcon from "@hugeicons/core-free-icons/CollapseIcon";
import Navigation03Icon from "@hugeicons/core-free-icons/Navigation03Icon";
import File01Icon from "@hugeicons/core-free-icons/File01Icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";
import type { PaneAction, PaneLayout } from "@/workspacePaneLayout";
import { workspaceMenuContentClassName, workspaceMenuItemClassName } from "./menu-styles";

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
  layout,
  suppressed = false,
  send,
  navigation,
  project,
  projectName,
  onCloseProject,
  onMaximizeProject,
}: {
  previewIdentity: string;
  layout: PaneLayout;
  suppressed?: boolean;
  send: (action: PaneAction) => void;
  navigation: ReactNode;
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
  const list = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState({ left: false, right: false });
  const showProject = !!project && layout.activeRightTab === "navigation";
  const hasNew = layout.activeRightTab !== "navigation";
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    const update = () =>
      setScroll({
        left: el.scrollLeft > 1,
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
      });
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    el.addEventListener("scroll", update);
    return () => {
      obs.disconnect();
      el.removeEventListener("scroll", update);
    };
  }, [layout.rightTabs.length, layout.rightWidth, projectName]);
  useEffect(() => {
    list.current
      ?.querySelector<HTMLElement>('[aria-selected="true"]')
      ?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [layout.activeRightTab]);
  const visible = layout.rightVisible && !suppressed;
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
      inert={!visible}
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
        <div
          className="bb-tab-overflow"
          ref={list}
          role="tablist"
          aria-label={t("chrome.rightViews")}
        >
          <ChromeTab
            label={contentProject ? (visible ? projectName : previousName.current) || "Project" : t("chrome.navigation")}
            active={!hasNew}
            icon={contentProject ? File01Icon : Navigation03Icon}
            onSelect={() => send({ type: "rightSelect", id: "navigation" })}
          />
          {layout.rightTabs.map((id, index) => (
            <ContextMenu.Root key={id} modal={false}>
              <ContextMenu.Trigger asChild>
                <div>
                  <ChromeTab
                    label={t("chrome.newTab") + (index ? ` ${index + 1}` : "")}
                    active={id === layout.activeRightTab}
                    onSelect={() => send({ type: "rightSelect", id })}
                    onClose={() => send({ type: "rightClose", id })}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("application/x-workspace-tab", id)}
                    onDrop={(e) => {
                      e.preventDefault();
                      const source = e.dataTransfer.getData("application/x-workspace-tab");
                      if (!layout.rightTabs.includes(source)) return;
                      const ids = layout.rightTabs.filter((t) => t !== source);
                      ids.splice(ids.indexOf(id), 0, source);
                      send({ type: "rightReorder", ids });
                    }}
                  />
                </div>
              </ContextMenu.Trigger>
              <ContextMenu.Portal>
                <ContextMenu.Content className={workspaceMenuContentClassName}>
                  <ContextMenu.Item
                    className={workspaceMenuItemClassName}
                    onSelect={() => send({ type: "rightClose", id })}
                  >
                    {t("chrome.closeTab")}
                  </ContextMenu.Item>
                  <ContextMenu.Separator className="my-1 h-px bg-border" />
                  <ContextMenu.Item
                    className={workspaceMenuItemClassName}
                    disabled={layout.rightTabs.length < 2}
                    onSelect={() => send({ type: "rightCloseOthers", id })}
                  >
                    {t("chrome.closeOthers")}
                  </ContextMenu.Item>
                  <ContextMenu.Item
                    className={workspaceMenuItemClassName}
                    disabled={index === layout.rightTabs.length - 1}
                    onSelect={() => send({ type: "rightCloseAfter", id })}
                  >
                    {t("chrome.closeAfter")}
                  </ContextMenu.Item>
                </ContextMenu.Content>
              </ContextMenu.Portal>
            </ContextMenu.Root>
          ))}
        </div>
        {(scroll.left || scroll.right) && (
          <>
            <ChromeAction
              disabled={!scroll.left}
              label={t("chrome.previousTabs")}
              onClick={() => list.current?.scrollBy({ left: -180, behavior: "smooth" })}
            >
              <ChromeIcon icon={ArrowLeft01Icon} />
            </ChromeAction>
            <ChromeAction
              disabled={!scroll.right}
              label={t("chrome.nextTabs")}
              onClick={() => list.current?.scrollBy({ left: 180, behavior: "smooth" })}
            >
              <ChromeIcon icon={ArrowRight01Icon} />
            </ChromeAction>
          </>
        )}
        <ChromeAction
          label={t(layout.maximized === "right" ? "chrome.restoreSplit" : "chrome.maximize")}
          onClick={
            showProject ? onMaximizeProject : () => send({ type: "maximize", pane: "right" })
          }
        >
          <ChromeIcon icon={layout.maximized === "right" ? CollapseIcon : ExpandIcon} className="size-[13px]" />
        </ChromeAction>
        <ChromeAction
          label={t("chrome.hideRight")}
          onClick={() => {
            if (showProject) onCloseProject();
            else if (layout.rightVisible) send({ type: "rightToggle" });
          }}
        >
          <ChromeIcon icon={SidebarRightIcon} />
        </ChromeAction>
      </header>
      <div className="bb-pane-content">
        {hasNew ? (
          <div className="bb-new-tab">
            <p>{t("chrome.actions")}</p>
            {navigation}
          </div>
        ) : contentProject ? (
          contentProject
        ) : (
          navigation
        )}
      </div>
    </aside>
  );
}
