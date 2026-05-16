import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { WorkspaceDateValueEditor } from "@/components/workspace/date-value-editor";
import { WorkspaceSelectValueEditor } from "@/components/workspace/select-value-editor";
import { ChevronDownIcon, ChevronRightIcon, FileIcon, FolderIcon, GripVerticalIcon, XIcon } from "@/lib/lucide-icons";
import type {
  WorkspaceMockFileTreeNode,
  WorkspaceMockProject,
} from "@/workspaceMockData";
import type {
  WorkspacePropertyDefinitionState,
  WorkspaceSelectValueState,
} from "@/workspaceAppState";

type WorkspaceProjectDetailPanelProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly project: WorkspaceMockProject | null;
  readonly visibleProperties: readonly WorkspacePropertyDefinitionState[];
  readonly selectValues: readonly WorkspaceSelectValueState[];
  readonly onProjectPropertyValueChange: (projectId: string, propertyId: string, value: unknown) => void;
  readonly onCreateSelectValue: (
    propertyId: string,
    input: { readonly name: string; readonly color: string },
  ) => Promise<WorkspaceSelectValueState | null>;
  readonly onRenameSelectValue: (selectValueId: string, name: string) => void;
  readonly onDeleteSelectValue: (selectValueId: string) => void;
};

const projectDetailPanelWidthStorageKey = "workspace.projectDetailPanelWidth";
const defaultProjectDetailPanelWidth = 480;
const minProjectDetailPanelWidth = 360;
const maxProjectDetailPanelWidth = 760;
const projectDetailPanelAnimationMs = 360;
const projectDetailPanelUnmountBufferMs = 80;
const cardPropertyOrderStorageKey = "workspace.cardDetailPropertyOrder";
const projectDetailPlainValueClassName =
  "flex min-h-7 w-full min-w-0 items-center truncate rounded-md px-0 py-1 text-left text-sm font-medium text-foreground";
const projectDetailPlainTriggerClassName =
  "h-7 w-full min-w-0 justify-start gap-2 px-0 py-1 font-medium text-foreground hover:bg-transparent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30";

function getMaxProjectDetailPanelWidth() {
  if (typeof window === "undefined") {
    return maxProjectDetailPanelWidth;
  }

  return Math.min(
    maxProjectDetailPanelWidth,
    Math.max(minProjectDetailPanelWidth, window.innerWidth - 96),
  );
}

function clampProjectDetailPanelWidth(value: number) {
  const fallbackWidth = Number.isFinite(value) ? value : defaultProjectDetailPanelWidth;
  return Math.min(
    getMaxProjectDetailPanelWidth(),
    Math.max(minProjectDetailPanelWidth, Math.round(fallbackWidth)),
  );
}

function readSavedProjectDetailPanelWidth() {
  if (typeof window === "undefined") {
    return defaultProjectDetailPanelWidth;
  }

  return clampProjectDetailPanelWidth(Number(window.localStorage.getItem(projectDetailPanelWidthStorageKey)));
}

function readSavedCardPropertyOrder() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const parsedValue = JSON.parse(window.localStorage.getItem(cardPropertyOrderStorageKey) || "[]");
    return Array.isArray(parsedValue)
      ? parsedValue.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function createOrderedCardProperties(
  properties: readonly WorkspacePropertyDefinitionState[],
  orderedPropertyIds: readonly string[],
) {
  const propertiesById = new Map(properties.map((property) => [property.id, property]));
  const orderedProperties = orderedPropertyIds
    .map((propertyId) => propertiesById.get(propertyId))
    .filter((property): property is WorkspacePropertyDefinitionState => property !== undefined);
  const orderedPropertyIdSet = new Set(orderedProperties.map((property) => property.id));
  const newProperties = properties.filter((property) => !orderedPropertyIdSet.has(property.id));

  return [...orderedProperties, ...newProperties];
}

function reorderCardPropertyIds(
  orderedPropertyIds: readonly string[],
  draggedPropertyId: string,
  targetPropertyId: string,
) {
  if (draggedPropertyId === targetPropertyId) {
    return orderedPropertyIds;
  }

  const draggedIndex = orderedPropertyIds.indexOf(draggedPropertyId);
  const targetIndex = orderedPropertyIds.indexOf(targetPropertyId);

  if (draggedIndex < 0 || targetIndex < 0) {
    return orderedPropertyIds;
  }

  const nextPropertyIds = [...orderedPropertyIds];
  nextPropertyIds.splice(draggedIndex, 1);
  nextPropertyIds.splice(targetIndex, 0, draggedPropertyId);
  return nextPropertyIds;
}

function getPropertyValue(project: WorkspaceMockProject, property: WorkspacePropertyDefinitionState) {
  if (property.id === "property:name") {
    return project.name;
  }

  if (property.id === "property:status") {
    return project.status.name;
  }

  return project.propertyValues[property.id as keyof typeof project.propertyValues] ?? "";
}

function stringifyPropertyValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string").join(", ");
  }

  if (value == null) {
    return "";
  }

  return String(value);
}

function getSelectValuesForProperty(
  selectValues: readonly WorkspaceSelectValueState[],
  propertyId: string,
) {
  return selectValues
    .filter((selectValue) => selectValue.propertyId === propertyId && !selectValue.hidden)
    .sort((left, right) => (
      Number(left.order || 0) - Number(right.order || 0) || left.id.localeCompare(right.id)
    ));
}

function getSelectValueLabel(
  value: unknown,
  property: WorkspacePropertyDefinitionState,
  selectValues: readonly WorkspaceSelectValueState[],
) {
  const values = getSelectValuesForProperty(selectValues, property.id);

  if (property.propertyType === "multi-select") {
    const selectedValues = Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];

    return selectedValues
      .map((valueId) => values.find((selectValue) => selectValue.id === valueId)?.name || valueId)
      .join(", ");
  }

  if (typeof value !== "string" || !value) {
    return "";
  }

  return values.find((selectValue) => selectValue.id === value)?.name || value;
}

function ProjectPropertyValueDisplay({
  value,
  property,
  selectValues,
  onStartEditing,
}: {
  readonly value: unknown;
  readonly property: WorkspacePropertyDefinitionState;
  readonly selectValues: readonly WorkspaceSelectValueState[];
  readonly onStartEditing: () => void;
}) {
  if (property.id === "property:name" || property.id === "property:status" || property.system) {
    return <span className={projectDetailPlainValueClassName}>{stringifyPropertyValue(value)}</span>;
  }

  if (property.propertyType === "text" || property.propertyType === "number") {
    return (
      <button
        type="button"
        aria-label={`Edit ${property.name}`}
        className={projectDetailPlainValueClassName}
        onClick={onStartEditing}
      >
        <span className="min-w-0 truncate">{stringifyPropertyValue(value)}</span>
      </button>
    );
  }

  if (property.propertyType === "date") {
    return <span className={projectDetailPlainValueClassName}>{stringifyPropertyValue(value)}</span>;
  }

  if (property.propertyType === "select" || property.propertyType === "multi-select") {
    return <span className={projectDetailPlainValueClassName}>{getSelectValueLabel(value, property, selectValues)}</span>;
  }

  return <span className={projectDetailPlainValueClassName}>{stringifyPropertyValue(value)}</span>;
}

type FileTreeNodeProps = {
  readonly node: WorkspaceMockFileTreeNode;
  readonly depth?: number;
  readonly expandedFolderIds: ReadonlySet<string>;
  readonly onToggleFolder: (folderId: string) => void;
};

function FileTreeNode({
  node,
  depth = 0,
  expandedFolderIds,
  onToggleFolder,
}: FileTreeNodeProps) {
  const isFolder = node.kind === "folder";
  const hasChildren = isFolder && node.children !== undefined && node.children.length > 0;
  const isExpanded = isFolder && expandedFolderIds.has(node.id);

  return (
    <li>
      <Button
        type="button"
        variant="ghost"
        disabled={!node.available}
        className="h-7 w-full justify-start px-2 py-1 text-left"
        title={node.relativePath}
        aria-expanded={isFolder ? isExpanded : undefined}
        onClick={() => {
          if (hasChildren) {
            onToggleFolder(node.id);
          }
        }}
      >
        <span className="grid min-w-0 grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-2" style={{ paddingLeft: `${depth * 1}rem` }}>
          {hasChildren ? (
            isExpanded ? (
              <ChevronDownIcon className="size-4 text-muted-foreground" aria-hidden="true" />
            ) : (
              <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden="true" />
            )
          ) : (
            <span className="size-4" aria-hidden="true" />
          )}
          {isFolder ? (
            <FolderIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          ) : (
            <FileIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          )}
          <span className="min-w-0 truncate text-sm">{node.name}</span>
          {!node.available ? <Badge variant="destructive">Missing</Badge> : null}
        </span>
      </Button>
      {isFolder && isExpanded && node.children && node.children.length > 0 ? (
        <ul className="grid gap-0.5">
          {node.children.map((child) => (
            <FileTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedFolderIds={expandedFolderIds}
              onToggleFolder={onToggleFolder}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function ProjectPropertyValueEditor({
  project,
  property,
  selectValues,
  editing,
  onStartEditing,
  onStopEditing,
  onProjectPropertyValueChange,
  onCreateSelectValue,
  onRenameSelectValue,
  onDeleteSelectValue,
}: {
  readonly project: WorkspaceMockProject;
  readonly property: WorkspacePropertyDefinitionState;
  readonly selectValues: readonly WorkspaceSelectValueState[];
  readonly editing: boolean;
  readonly onStartEditing: () => void;
  readonly onStopEditing: () => void;
  readonly onProjectPropertyValueChange: (projectId: string, propertyId: string, value: unknown) => void;
  readonly onCreateSelectValue: (
    propertyId: string,
    input: { readonly name: string; readonly color: string },
  ) => Promise<WorkspaceSelectValueState | null>;
  readonly onRenameSelectValue: (selectValueId: string, name: string) => void;
  readonly onDeleteSelectValue: (selectValueId: string) => void;
}) {
  const value = getPropertyValue(project, property);

  if (property.id === "property:name" || property.id === "property:status" || property.system) {
    return (
      <ProjectPropertyValueDisplay
        value={value}
        property={property}
        selectValues={selectValues}
        onStartEditing={onStartEditing}
      />
    );
  }

  if (property.propertyType === "text") {
    if (!editing) {
      return (
        <ProjectPropertyValueDisplay
          value={value}
          property={property}
          selectValues={selectValues}
          onStartEditing={onStartEditing}
        />
      );
    }

    return (
      <Input
        key={`${project.id}:${property.id}:${stringifyPropertyValue(value)}`}
        autoFocus
        defaultValue={stringifyPropertyValue(value)}
        aria-label={`${property.name} text value`}
        className="h-8 border-border bg-background px-2 shadow-none"
        onBlur={(event) => {
          onProjectPropertyValueChange(project.id, property.id, event.target.value);
          onStopEditing();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
          if (event.key === "Escape") {
            onStopEditing();
          }
        }}
      />
    );
  }

  if (property.propertyType === "number") {
    if (!editing) {
      return (
        <ProjectPropertyValueDisplay
          value={value}
          property={property}
          selectValues={selectValues}
          onStartEditing={onStartEditing}
        />
      );
    }

    return (
      <Input
        key={`${project.id}:${property.id}:${stringifyPropertyValue(value)}`}
        autoFocus
        type="number"
        defaultValue={stringifyPropertyValue(value)}
        aria-label={`${property.name} number value`}
        className="workspace-number-input h-8 border-border bg-background px-2 shadow-none"
        onBlur={(event) => {
          const text = event.target.value.trim();
          onProjectPropertyValueChange(project.id, property.id, text === "" ? null : Number(text));
          onStopEditing();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
          if (event.key === "Escape") {
            onStopEditing();
          }
        }}
      />
    );
  }

  if (property.propertyType === "date") {
    return (
      <WorkspaceDateValueEditor
        value={value}
        triggerClassName={projectDetailPlainTriggerClassName}
        onValueChange={(nextValue) => onProjectPropertyValueChange(project.id, property.id, nextValue)}
      />
    );
  }

  if (property.propertyType === "select" || property.propertyType === "multi-select") {
    return (
      <WorkspaceSelectValueEditor
        property={property}
        value={value}
        selectValues={selectValues}
        triggerClassName={projectDetailPlainTriggerClassName}
        onValueChange={(nextValue) => onProjectPropertyValueChange(project.id, property.id, nextValue)}
        onCreateSelectValue={onCreateSelectValue}
        onRenameSelectValue={onRenameSelectValue}
        onDeleteSelectValue={onDeleteSelectValue}
      />
    );
  }

  return (
    <ProjectPropertyValueDisplay
      value={value}
      property={property}
      selectValues={selectValues}
      onStartEditing={onStartEditing}
    />
  );
}

export function WorkspaceProjectDetailPanel({
  open,
  onOpenChange,
  project,
  visibleProperties,
  selectValues,
  onProjectPropertyValueChange,
  onCreateSelectValue,
  onRenameSelectValue,
  onDeleteSelectValue,
}: WorkspaceProjectDetailPanelProps) {
  const [projectDetailPanelWidth, setProjectDetailPanelWidth] = useState(readSavedProjectDetailPanelWidth);
  const [panelProject, setPanelProject] = useState<WorkspaceMockProject | null>(null);
  const [panelVisible, setPanelVisible] = useState(false);
  const [expandedFolderIds, setExpandedFolderIds] = useState<ReadonlySet<string>>(() => new Set());
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);
  const [cardPropertyOrder, setCardPropertyOrder] = useState<readonly string[]>(readSavedCardPropertyOrder);
  const [draggedCardPropertyId, setDraggedCardPropertyId] = useState<string | null>(null);
  const panelWidthRef = useRef(projectDetailPanelWidth);
  const panelMountedRef = useRef(false);
  const cardPropertyOrderRef = useRef<readonly string[]>(cardPropertyOrder);
  const isOpen = open && project !== null;
  const orderedVisibleProperties = useMemo(
    () => createOrderedCardProperties(visibleProperties, cardPropertyOrder),
    [visibleProperties, cardPropertyOrder],
  );

  useEffect(() => {
    panelMountedRef.current = panelProject !== null;
  }, [panelProject]);

  useEffect(() => {
    cardPropertyOrderRef.current = cardPropertyOrder;
  }, [cardPropertyOrder]);

  useEffect(() => {
    if (isOpen) {
      setExpandedFolderIds(new Set());
      setEditingPropertyId(null);
    }
  }, [isOpen, project?.id]);

  useEffect(() => {
    const visiblePropertyIdSet = new Set(visibleProperties.map((property) => property.id));
    const mergedPropertyIds = [
      ...cardPropertyOrder.filter((propertyId) => visiblePropertyIdSet.has(propertyId)),
      ...visibleProperties.map((property) => property.id).filter((propertyId) => !cardPropertyOrder.includes(propertyId)),
    ];

    if (
      mergedPropertyIds.length !== cardPropertyOrder.length ||
      mergedPropertyIds.some((propertyId, index) => propertyId !== cardPropertyOrder[index])
    ) {
      setCardPropertyOrder(mergedPropertyIds);
    }
  }, [visibleProperties, cardPropertyOrder]);

  useEffect(() => {
    if (!isOpen || !project) {
      setPanelVisible(false);
      return undefined;
    }

    const shouldAnimateOpen = !panelMountedRef.current;
    setPanelProject(project);

    if (!shouldAnimateOpen) {
      setPanelVisible(true);
      return undefined;
    }

    setPanelVisible(false);
    let secondFrameId: number | null = null;
    const firstFrameId = window.requestAnimationFrame(() => {
      secondFrameId = window.requestAnimationFrame(() => {
        setPanelVisible(true);
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrameId);

      if (secondFrameId !== null) {
        window.cancelAnimationFrame(secondFrameId);
      }
    };
  }, [isOpen, project]);

  useEffect(() => {
    if (isOpen || panelVisible || panelProject === null) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setPanelProject(null);
    }, projectDetailPanelAnimationMs + projectDetailPanelUnmountBufferMs);

    return () => window.clearTimeout(timeoutId);
  }, [isOpen, panelProject, panelVisible]);

  useEffect(() => {
    panelWidthRef.current = projectDetailPanelWidth;
  }, [projectDetailPanelWidth]);

  useEffect(() => {
    if (!isOpen || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(projectDetailPanelWidthStorageKey, String(projectDetailPanelWidth));
  }, [isOpen, projectDetailPanelWidth]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    function handleResize() {
      setProjectDetailPanelWidth((currentWidth) => clampProjectDetailPanelWidth(currentWidth));
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onOpenChange]);

  function updatePanelWidth(nextWidth: number) {
    const clampedWidth = clampProjectDetailPanelWidth(nextWidth);
    panelWidthRef.current = clampedWidth;
    setProjectDetailPanelWidth(clampedWidth);
  }

  function startPanelResize(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = panelWidthRef.current;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    function handlePointerMove(pointerEvent: PointerEvent) {
      updatePanelWidth(startWidth + startX - pointerEvent.clientX);
    }

    function handlePointerUp() {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.localStorage.setItem(projectDetailPanelWidthStorageKey, String(panelWidthRef.current));
    }

    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
  }

  function closeProjectDetails(
    event: ReactMouseEvent<HTMLButtonElement> | ReactPointerEvent<HTMLButtonElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();
    onOpenChange(false);
  }

  function finishPanelTransition() {
    if (!panelVisible) {
      setPanelProject(null);
    }
  }

  function toggleProjectFileFolder(folderId: string) {
    setExpandedFolderIds((currentFolderIds) => {
      const nextFolderIds = new Set(currentFolderIds);
      if (nextFolderIds.has(folderId)) {
        nextFolderIds.delete(folderId);
      } else {
        nextFolderIds.add(folderId);
      }

      return nextFolderIds;
    });
  }

  function onReorderCardProperties(nextPropertyIds: readonly string[]) {
    setCardPropertyOrder(nextPropertyIds);
    cardPropertyOrderRef.current = nextPropertyIds;

    if (typeof window !== "undefined") {
      window.localStorage.setItem(cardPropertyOrderStorageKey, JSON.stringify(nextPropertyIds));
    }
  }

  function startCardPropertyDrag(event: ReactPointerEvent<HTMLButtonElement>, propertyId: string) {
    event.preventDefault();
    event.stopPropagation();
    setDraggedCardPropertyId(propertyId);

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    function moveCardProperty(pointerEvent: PointerEvent) {
      const element = document.elementFromPoint(pointerEvent.clientX, pointerEvent.clientY);
      const targetRow = element?.closest("[data-card-property-row-id]");
      const targetPropertyId = targetRow?.getAttribute("data-card-property-row-id");

      if (!targetPropertyId || targetPropertyId === propertyId) {
        return;
      }

      const nextPropertyIds = reorderCardPropertyIds(cardPropertyOrderRef.current, propertyId, targetPropertyId);

      if (nextPropertyIds !== cardPropertyOrderRef.current) {
        setCardPropertyOrder(nextPropertyIds);
        cardPropertyOrderRef.current = nextPropertyIds;
      }
    }

    function finishCardPropertyDrag() {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", moveCardProperty);
      window.removeEventListener("pointerup", finishCardPropertyDrag);
      setDraggedCardPropertyId(null);
      onReorderCardProperties(cardPropertyOrderRef.current);
    }

    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", moveCardProperty);
    window.addEventListener("pointerup", finishCardPropertyDrag, { once: true });
  }

  if (!panelProject) {
    return null;
  }

  const displayedProject = panelProject;

  return (
    <div
      className={[
        "electron-window-no-drag fixed inset-0 z-50 flex justify-end",
        panelVisible ? "pointer-events-auto" : "pointer-events-none",
      ].join(" ")}
      aria-hidden={!panelVisible}
    >
      <button
        type="button"
        aria-label="Close project details backdrop"
        className="electron-window-no-drag absolute inset-0 cursor-default bg-transparent"
        tabIndex={panelVisible ? 0 : -1}
        onClick={closeProjectDetails}
      />
      <aside
        aria-labelledby="project-detail-title"
        aria-modal="false"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
        onTransitionEnd={(event) => {
          if (event.currentTarget === event.target) {
            finishPanelTransition();
          }
        }}
        className={[
          "electron-window-no-drag pointer-events-auto relative flex h-full max-w-[calc(100vw-6rem)] flex-col gap-4 border-l border-border bg-popover bg-clip-padding text-sm text-popover-foreground shadow-lg will-change-transform transition-transform duration-[360ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
          panelVisible ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
        style={{ width: projectDetailPanelWidth }}
      >
        <button
          type="button"
          aria-label="Resize project panel"
          className="electron-window-no-drag absolute inset-y-0 left-0 z-10 w-2 cursor-ew-resize border-l border-transparent hover:border-ring focus-visible:border-ring focus-visible:outline-none"
          onPointerDown={startPanelResize}
        >
          <span className="sr-only">Resize project panel</span>
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="electron-window-no-drag absolute right-3 top-3 z-10"
          aria-label="Close project details"
          onPointerDown={closeProjectDetails}
          onClick={closeProjectDetails}
        >
          <XIcon className="size-4" aria-hidden="true" />
        </Button>
        <>
          <header className="p-4 pr-12">
            <h2 id="project-detail-title" className="font-heading text-xl font-semibold text-foreground">
              {displayedProject.name}
            </h2>
          </header>
          <div className="min-h-0 flex-1 overflow-auto px-4 pb-4">
            <div className="grid gap-4">
              <section className="grid gap-2" aria-labelledby="project-properties-heading">
                <h3 id="project-properties-heading" className="text-xs font-medium text-muted-foreground">
                  Properties
                </h3>
                <dl className="grid gap-1.5">
                  {orderedVisibleProperties.map((property) => (
                    <div
                      key={property.id}
                      data-card-property-row-id={property.id}
                      className={[
                        "group/card-property grid min-h-8 items-center gap-2 rounded-md transition-colors duration-150",
                        draggedCardPropertyId === property.id ? "bg-muted/40" : "",
                      ].filter(Boolean).join(" ")}
                      style={{ gridTemplateColumns: "1.25rem minmax(8rem, 10rem) minmax(0, 1fr)" }}
                    >
                      <dt className="contents">
                        <button
                          type="button"
                          aria-label={`Reorder ${property.name} card property order`}
                          className="flex size-7 cursor-grab items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-accent-foreground active:cursor-grabbing group-hover/card-property:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/30"
                          onPointerDown={(event) => startCardPropertyDrag(event, property.id)}
                        >
                          <GripVerticalIcon className="size-4" aria-hidden="true" />
                        </button>
                        <span className="min-w-0 truncate text-sm font-medium text-muted-foreground">{property.name}</span>
                      </dt>
                      <dd className="min-w-0 text-sm">
                        <ProjectPropertyValueEditor
                          project={displayedProject}
                          property={property}
                          selectValues={selectValues}
                          editing={editingPropertyId === property.id}
                          onStartEditing={() => setEditingPropertyId(property.id)}
                          onStopEditing={() => setEditingPropertyId(null)}
                          onProjectPropertyValueChange={onProjectPropertyValueChange}
                          onCreateSelectValue={onCreateSelectValue}
                          onRenameSelectValue={onRenameSelectValue}
                          onDeleteSelectValue={onDeleteSelectValue}
                        />
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
              <Separator />
              <section className="grid gap-2" aria-labelledby="project-file-tree-heading">
                <div className="flex items-center justify-between gap-3">
                  <h3 id="project-file-tree-heading" className="text-xs font-medium text-muted-foreground">
                    File tree
                  </h3>
                  <Badge variant="secondary">{displayedProject.fileTree.length} items</Badge>
                </div>
                <ul className="grid gap-0.5">
                  {displayedProject.fileTree.map((node) => (
                    <FileTreeNode
                      key={node.id}
                      node={node}
                      expandedFolderIds={expandedFolderIds}
                      onToggleFolder={toggleProjectFileFolder}
                    />
                  ))}
                </ul>
              </section>
            </div>
          </div>
        </>
      </aside>
    </div>
  );
}
