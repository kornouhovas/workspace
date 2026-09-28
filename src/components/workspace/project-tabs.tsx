import { useEffect, useRef, useState } from "react";
import { ContextMenu } from "radix-ui";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Modifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileIcon, PanelRightCloseIcon, XIcon } from "@/lib/workspace-icons";
import { useI18n } from "@/i18n";
import { workspaceSplitDrop, type SplitSide } from "@/workspaceSplitTree.js";
import type { ProjectTab as ProjectTabState } from "@/workspaceProjectTabs";
import {
  workspaceMenuContentClassName,
  workspaceMenuItemClassName,
  workspaceMenuDangerItemClassName,
} from "./menu-styles";

type ProjectTabsProps = {
  projects: readonly ProjectTabState[];
  activeProjectId: string;
  onSelect: (id: string) => void;
  onDuplicate: (id: string) => void;
  onRestore: (id: string) => void;
  onClose: (id: string) => void;
  onReorder: (ids: readonly string[]) => void;
  onSplit?: (id: string, target?: string, side?: SplitSide | "center") => void;
  onCloseOthers?: (id: string) => void;
  onCloseAfter?: (id: string) => void;
  onReopen?: () => void;
  canReopen?: boolean;
};

function ProjectTab({
  project,
  onDuplicate,
  onRestore,
  onClose,
  onSplit,
  onCloseOthers,
  onCloseAfter,
  onReopen,
  canReopen,
  index,
  count,
}: {
  project: ProjectTabState;
  onDuplicate: (id: string) => void;
  onRestore: (id: string) => void;
  onClose: (id: string) => void;
  onSplit?: (id: string, target?: string, side?: SplitSide | "center") => void;
  onCloseOthers?: (id: string) => void;
  onCloseAfter?: (id: string) => void;
  onReopen?: () => void;
  canReopen?: boolean;
  index: number;
  count: number;
}) {
  const { t } = useI18n();
  const { setNodeRef, transform, transition, listeners, isDragging } = useSortable({
    id: project.tabId,
  });
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const focusDuplicate = useRef(false);
  return (
    <ContextMenu.Root modal={false}>
      <ContextMenu.Trigger asChild>
        <span
          className="bb-project-tab group/tab-pill relative flex shrink-0 items-center"
          onAuxClick={(event) => {
            if (event.button === 1) {
              event.preventDefault();
              onClose(project.tabId);
            }
          }}
        >
          <TabsTrigger
            ref={(node) => {
              setNodeRef(node);
              triggerRef.current = node;
            }}
            value={project.tabId}
            data-project-tab-id={project.tabId}
            title={project.name}
            aria-label={project.name}
            {...listeners}
            style={{
              transform: CSS.Translate.toString(transform),
              transition,
              zIndex: isDragging ? 30 : undefined,
            }}
            className="h-7 max-w-[210px] min-w-0 flex-none cursor-grab touch-none rounded-md pl-1.5 pr-2 text-sm font-normal text-muted-foreground transition-transform ease-out active:cursor-grabbing data-active:border-transparent data-active:bg-accent data-active:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <FileIcon className="bb-tab-closable-icon size-3.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 max-w-[180px] truncate">{project.name}</span>
          </TabsTrigger>
          <button
            type="button"
            className="bb-tab-close"
            aria-label={`${t("detail.closeTab")}: ${project.name}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onClose(project.tabId);
            }}
          >
            <XIcon className="size-3.5" aria-hidden="true" />
          </button>
        </span>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content
          data-project-tab-menu="true"
          className={`electron-window-no-drag z-50 min-w-56 ${workspaceMenuContentClassName}`}
          onEscapeKeyDown={(event) => event.stopPropagation()}
          onCloseAutoFocus={(event) => {
            if (!focusDuplicate.current) return;
            focusDuplicate.current = false;
            event.preventDefault();
            const list = triggerRef.current?.closest('[role="tablist"]');
            requestAnimationFrame(() => {
              list
                ?.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')
                ?.focus({ preventScroll: true });
            });
          }}
        >
          <ContextMenu.Item
            className={workspaceMenuItemClassName}
            onSelect={() => {
              focusDuplicate.current = true;
              onDuplicate(project.tabId);
            }}
          >
            <FileIcon className="size-4" aria-hidden="true" />
            {t("detail.duplicateTab")}
          </ContextMenu.Item>
          <ContextMenu.Item
            className={workspaceMenuItemClassName}
            onSelect={() => onRestore(project.tabId)}
          >
            <PanelRightCloseIcon className="size-4" aria-hidden="true" />
            {t("detail.restoreTab")}
          </ContextMenu.Item>
          {onCloseOthers && (
            <ContextMenu.Item
              className={workspaceMenuItemClassName}
              disabled={count < 2}
              onSelect={() => onCloseOthers(project.tabId)}
            >
              {t("chrome.closeOthers")}
            </ContextMenu.Item>
          )}
          {onCloseAfter && (
            <ContextMenu.Item
              className={workspaceMenuItemClassName}
              disabled={index === count - 1}
              onSelect={() => onCloseAfter(project.tabId)}
            >
              {t("chrome.closeAfter")}
            </ContextMenu.Item>
          )}
          {onReopen && (
            <ContextMenu.Item
              className={workspaceMenuItemClassName}
              disabled={!canReopen}
              onSelect={onReopen}
            >
              {t("chrome.reopenClosed")}
            </ContextMenu.Item>
          )}
          <ContextMenu.Item
            className={workspaceMenuDangerItemClassName}
            onSelect={() => onClose(project.tabId)}
          >
            <XIcon className="size-4" aria-hidden="true" />
            {t("detail.closeTab")}
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

export function WorkspaceProjectTabs({
  projects,
  activeProjectId,
  onSelect,
  onDuplicate,
  onRestore,
  onClose,
  onReorder,
  onSplit,
  onCloseOthers,
  onCloseAfter,
  onReopen,
  canReopen,
}: ProjectTabsProps) {
  const { t } = useI18n();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  function dropTarget(x: number, y: number) {
    for (const pane of document.querySelectorAll<HTMLElement>("[data-pane-id]")) {
      const side = workspaceSplitDrop(pane.getBoundingClientRect(), x, y);
      if (side) return { id: pane.dataset.paneId!, side };
    }
    return null;
  }
  const dragging = useRef(false);
  const [splitDrag, setSplitDrag] = useState(false);
  const [dropStyle, setDropStyle] = useState<React.CSSProperties>();
  const tabListRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = tabListRef.current;
    const scroller = list?.parentElement;
    if (!scroller) return;
    const revealActiveTab = () => {
      list
        ?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
        ?.scrollIntoView({ block: "nearest", inline: "nearest" });
    };
    revealActiveTab();
    const resizeObserver = new ResizeObserver(revealActiveTab);
    resizeObserver.observe(scroller);
    return () => resizeObserver.disconnect();
  }, [activeProjectId, projects.length]);
  const restrictToTabList: Modifier = ({ transform, draggingNodeRect }) => {
    const list = tabListRef.current;
    if (!list || !draggingNodeRect || Math.abs(transform.y) > 32) return transform;
    const bounds = list.getBoundingClientRect();
    const padding = parseFloat(getComputedStyle(list).paddingLeft) || 0;
    const minX = bounds.left + padding - draggingNodeRect.left;
    const maxX = bounds.right - padding - draggingNodeRect.right;
    return { ...transform, x: Math.max(minX, Math.min(maxX, transform.x)), scaleX: 1, scaleY: 1 };
  };
  if (!projects.length) return null;
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={splitDrag ? [] : [restrictToTabList]}
      autoScroll={false}
      onDragStart={() => {
        dragging.current = true;
      }}
      onDragMove={({ delta, activatorEvent }) => {
        const event = activatorEvent as PointerEvent;
        const target = dropTarget(event.clientX + delta.x, event.clientY + delta.y);
        setSplitDrag(Boolean(target));
        const rect = target
          ? document
              .querySelector<HTMLElement>(`[data-pane-id="${window.CSS.escape(target.id)}"]`)
              ?.getBoundingClientRect()
          : null;
        if (target && rect) {
          const side = target.side;
          setDropStyle({
            inset: "auto",
            left: rect.left + (side === "right" ? rect.width / 2 : 0),
            top: rect.top + (side === "bottom" ? rect.height / 2 : 0),
            width: side === "left" || side === "right" ? rect.width / 2 : rect.width,
            height: side === "top" || side === "bottom" ? rect.height / 2 : rect.height,
          });
        }
      }}
      onDragCancel={() => {
        dragging.current = false;
        setSplitDrag(false);
      }}
      onDragEnd={({ active, over, delta, activatorEvent }) => {
        dragging.current = false;
        setSplitDrag(false);
        const event = activatorEvent as PointerEvent;
        const target = dropTarget(event.clientX + delta.x, event.clientY + delta.y);
        if (onSplit && target) {
          onSplit(String(active.id), target.id, target.side);
          return;
        }
        if (over && active.id !== over.id) {
          const ids = projects.map((project) => project.tabId);
          onReorder(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
        }
      }}
    >
      {splitDrag && (
        <div className="bb-split-drop-indicator" style={dropStyle} aria-hidden="true">
          {t("chrome.movePane")}
        </div>
      )}
      <Tabs
        value={activeProjectId}
        onValueChange={(id) => {
          if (!dragging.current) onSelect(id);
        }}
        className="workspace-tab-scroll min-w-0 flex-1 overflow-x-auto overflow-y-hidden"
      >
        <TabsList
          ref={tabListRef}
          aria-label={t("detail.projectTabs")}
          className="!h-7 w-max max-w-none flex-nowrap justify-start gap-1 rounded-none bg-transparent p-0 shadow-none"
        >
          <SortableContext
            items={projects.map((project) => project.tabId)}
            strategy={horizontalListSortingStrategy}
          >
            {projects.map((project, index) => (
              <ProjectTab
                key={project.tabId}
                project={project}
                onDuplicate={onDuplicate}
                onRestore={onRestore}
                onClose={onClose}
                onSplit={onSplit}
                onCloseOthers={onCloseOthers}
                onCloseAfter={onCloseAfter}
                onReopen={onReopen}
                canReopen={canReopen}
                index={index}
                count={projects.length}
              />
            ))}
          </SortableContext>
        </TabsList>
      </Tabs>
    </DndContext>
  );
}
