import { useRef } from "react";
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
  return (
    <ContextMenu.Root modal={false}>
      <ContextMenu.Trigger asChild>
        <span className="contents">
        <TabsTrigger
          ref={setNodeRef}
          value={project.tabId}
          data-project-tab-id={project.tabId}
          title={project.name}
          aria-label={project.name}
          {...listeners}
          style={{ transform: CSS.Translate.toString(transform), transition, zIndex: isDragging ? 30 : undefined }}
          className="@container h-7 min-w-10 max-w-44 flex-1 basis-44 cursor-grab touch-none rounded-lg px-2.5 text-sm font-normal text-muted-foreground transition-transform ease-out active:cursor-grabbing data-active:border-border data-active:bg-background data-active:text-foreground dark:data-active:border-border dark:data-active:bg-background/60"
        >
          <FileIcon className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 truncate @max-[3rem]:hidden">{project.name}</span>
        </TabsTrigger>
        </span>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content
          data-project-tab-menu="true"
          className={`electron-window-no-drag z-50 min-w-56 ${workspaceMenuContentClassName}`}
          onEscapeKeyDown={(event) => event.stopPropagation()}
        >
          <ContextMenu.Item className={workspaceMenuItemClassName} onSelect={() => onDuplicate(project.tabId)}>
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
      <Tabs value={activeProjectId} onValueChange={(id) => { if (!dragging.current) onSelect(id); }} className="min-w-0 flex-1 overflow-hidden">
        <TabsList ref={tabListRef} aria-label={t("detail.projectTabs")} style={{ width: projects.length * 176 + 4 }} className="max-w-full justify-start overflow-x-auto rounded-xl bg-muted/80 p-0.5 ring-1 ring-border/40 group-data-horizontal/tabs:!h-9">
          <SortableContext items={projects.map(project => project.tabId)} strategy={horizontalListSortingStrategy}>
            {projects.map(project => <ProjectTab key={project.tabId} project={project} onDuplicate={onDuplicate} onRestore={onRestore} onClose={onClose} />)}
          </SortableContext>
        </TabsList>
      </Tabs>
    </DndContext>
  );
}
