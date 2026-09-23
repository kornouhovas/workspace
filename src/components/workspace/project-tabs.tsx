import { useEffect, useRef } from "react";
import { ContextMenu } from "radix-ui";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type Modifier } from "@dnd-kit/core";
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileIcon, PanelsTopLeftIcon, XIcon } from "@/lib/lucide-icons";
import { useI18n } from "@/i18n";
import type { ProjectTab as ProjectTabState } from "@/workspaceProjectTabs";
import { workspaceMenuContentClassName, workspaceMenuItemClassName, workspaceMenuDangerItemClassName } from "./menu-styles";

type ProjectTabsProps = {
  projects: readonly ProjectTabState[];
  activeProjectId: string;
  onSelect: (id: string) => void;
  onDuplicate: (id: string) => void;
  onRestore: (id: string) => void;
  onClose: (id: string) => void;
  onReorder: (ids: readonly string[]) => void;
};

function ProjectTab({ project, onDuplicate, onRestore, onClose }: {
  project: ProjectTabState;
  onDuplicate: (id: string) => void;
  onRestore: (id: string) => void;
  onClose: (id: string) => void;
}) {
  const { t } = useI18n();
  const { setNodeRef, transform, transition, listeners, isDragging } = useSortable({ id: project.tabId });
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const focusDuplicate = useRef(false);
  return (
    <ContextMenu.Root modal={false}>
      <ContextMenu.Trigger asChild>
        <span className="contents">
        <TabsTrigger
          ref={(node) => { setNodeRef(node); triggerRef.current = node; }}
          value={project.tabId}
          data-project-tab-id={project.tabId}
          title={project.name}
          aria-label={project.name}
          {...listeners}
          style={{ transform: CSS.Translate.toString(transform), transition, zIndex: isDragging ? 30 : undefined }}
          className="h-8 w-36 max-w-40 min-w-20 flex-none cursor-grab touch-none rounded-md px-2 text-sm font-normal text-muted-foreground transition-transform ease-out active:cursor-grabbing data-active:border-transparent data-active:bg-accent data-active:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <FileIcon className="size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 truncate">{project.name}</span>
        </TabsTrigger>
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
              list?.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')?.focus({ preventScroll: true });
            });
          }}
        >
          <ContextMenu.Item className={workspaceMenuItemClassName} onSelect={() => { focusDuplicate.current = true; onDuplicate(project.tabId); }}>
            <FileIcon className="size-4" aria-hidden="true" />{t("detail.duplicateTab")}
          </ContextMenu.Item>
          <ContextMenu.Item className={workspaceMenuItemClassName} onSelect={() => onRestore(project.tabId)}>
            <PanelsTopLeftIcon className="size-4" aria-hidden="true" />{t("detail.restoreTab")}
          </ContextMenu.Item>
          <ContextMenu.Item className={workspaceMenuDangerItemClassName} onSelect={() => onClose(project.tabId)}>
            <XIcon className="size-4" aria-hidden="true" />{t("detail.closeTab")}
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

export function WorkspaceProjectTabs({ projects, activeProjectId, onSelect, onDuplicate, onRestore, onClose, onReorder }: ProjectTabsProps) {
  const { t } = useI18n();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const dragging = useRef(false);
  const tabListRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = tabListRef.current;
    const scroller = list?.parentElement;
    if (!scroller) return;
    const revealActiveTab = () => {
      list?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
    };
    revealActiveTab();
    const resizeObserver = new ResizeObserver(revealActiveTab);
    resizeObserver.observe(scroller);
    return () => resizeObserver.disconnect();
  }, [activeProjectId, projects.length]);
  const restrictToTabList: Modifier = ({ transform, draggingNodeRect }) => {
    const list = tabListRef.current;
    if (!list || !draggingNodeRect) return transform;
    const bounds = list.getBoundingClientRect();
    const padding = parseFloat(getComputedStyle(list).paddingLeft) || 0;
    const minX = bounds.left + padding - draggingNodeRect.left;
    const maxX = bounds.right - padding - draggingNodeRect.right;
    return { ...transform, x: Math.max(minX, Math.min(maxX, transform.x)), y: 0, scaleX: 1, scaleY: 1 };
  };
  if (!projects.length) return null;
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToTabList]}
      autoScroll={false}
      onDragStart={() => { dragging.current = true; }}
      onDragCancel={() => { dragging.current = false; }}
      onDragEnd={({ active, over }) => {
        dragging.current = false;
        if (over && active.id !== over.id) {
          const ids = projects.map(project => project.tabId);
          onReorder(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
        }
      }}
    >
      <Tabs value={activeProjectId} onValueChange={(id) => { if (!dragging.current) onSelect(id); }} className="workspace-tab-scroll min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
        <TabsList ref={tabListRef} aria-label={t("detail.projectTabs")} className="!h-10 w-max max-w-none flex-nowrap justify-start gap-1 rounded-none bg-transparent p-0 shadow-none">
          <SortableContext items={projects.map(project => project.tabId)} strategy={horizontalListSortingStrategy}>
            {projects.map(project => <ProjectTab key={project.tabId} project={project} onDuplicate={onDuplicate} onRestore={onRestore} onClose={onClose} />)}
          </SortableContext>
        </TabsList>
      </Tabs>
    </DndContext>
  );
}
