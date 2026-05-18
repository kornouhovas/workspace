import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { WorkspaceDateValueEditor } from "@/components/workspace/date-value-editor";
import { WorkspaceSelectValueEditor } from "@/components/workspace/select-value-editor";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FileIcon,
  FolderIcon,
  GripVerticalIcon,
  XIcon,
} from "@/lib/lucide-icons";
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
  readonly onColorSelectValue: (selectValueId: string, color: string) => void;
  readonly onDeleteSelectValue: (selectValueId: string) => void;
  readonly onRenameProperty: (propertyId: string, name: string) => void;
  readonly onHideProperty: (propertyId: string, hidden: boolean) => void;
  readonly onDeleteProperty: (propertyId: string) => void;
};

type CardPropertyDragPreviewRow = {
  readonly propertyId: string;
  readonly top: number;
  readonly height: number;
};

type CardPropertyDragState = {
  readonly propertyId: string;
  readonly startY: number;
  readonly currentY: number;
  readonly dropIndex: number;
  readonly rows: readonly CardPropertyDragPreviewRow[];
};

type CardPropertyDragOptions = {
  readonly openActionsOnClick?: boolean;
};

const projectDetailPanelWidthStorageKey = "workspace.projectDetailPanelWidth";
const defaultProjectDetailPanelWidth = 480;
const minProjectDetailPanelWidth = 360;
const maxProjectDetailPanelWidth = 760;
const projectDetailPanelAnimationMs = 360;
const projectDetailPanelUnmountBufferMs = 80;
const cardPropertyOrderStorageKey = "workspace.cardDetailPropertyOrder";
const projectDetailPropertiesGridTemplateColumns = "minmax(8.5rem, 9.25rem) minmax(0, 1fr)";
const projectDetailPlainValueClassName =
  "flex min-h-8 w-full min-w-0 items-center truncate rounded-md px-0 py-0.5 text-left text-[13px] font-medium text-foreground";
const projectDetailPlainTriggerClassName =
  "h-8 w-full min-w-0 justify-start gap-2 px-0 py-0.5 text-[13px] font-medium text-foreground hover:bg-transparent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30";
const projectDetailPropertyMenuItemClassName =
  "flex h-8 w-full cursor-default items-center rounded-md px-2 text-left text-sm text-popover-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground";
const projectDetailPropertyMenuDangerItemClassName =
  "flex h-8 w-full cursor-default items-center rounded-md px-2 text-left text-sm text-destructive outline-none hover:bg-destructive/10 hover:text-destructive focus-visible:bg-destructive/10 focus-visible:text-destructive";
const spreadsheetFileExtensions = new Set(["csv", "numbers", "ods", "xls", "xlsm", "xlsx"]);

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

function getCardPropertyDragOrder(
  orderedPropertyIds: readonly string[],
  sourcePropertyId: string,
  dropIndex: number,
) {
  const remainingPropertyIds = orderedPropertyIds.filter((propertyId) => propertyId !== sourcePropertyId);
  const boundedDropIndex = Math.min(Math.max(dropIndex, 0), remainingPropertyIds.length);
  return [
    ...remainingPropertyIds.slice(0, boundedDropIndex),
    sourcePropertyId,
    ...remainingPropertyIds.slice(boundedDropIndex),
  ];
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

function isProtectedCardProperty(property: WorkspacePropertyDefinitionState) {
  return property.system || property.id === "property:name" || property.id === "property:status";
}

function getFileExtension(fileName: string) {
  const extensionMatch = /\.([^.]+)$/.exec(fileName);
  return extensionMatch ? extensionMatch[1].toLowerCase() : "";
}

function getFileTreeNodeIconClassName(node: WorkspaceMockFileTreeNode) {
  if (node.kind === "folder") {
    return "size-4 text-amber-300";
  }

  const extension = getFileExtension(node.name);

  if (extension === "pdf") {
    return "size-4 text-rose-300";
  }

  if (spreadsheetFileExtensions.has(extension)) {
    return "size-4 text-emerald-300";
  }

  if (extension === "md" || extension === "markdown") {
    return "size-4 text-sky-300";
  }

  return "size-4 text-muted-foreground";
}

function getFileTreeNodeNameClassName(node: WorkspaceMockFileTreeNode) {
  return node.kind === "folder"
    ? "min-w-0 truncate text-sm font-normal leading-5 text-foreground"
    : "min-w-0 truncate text-sm font-normal leading-5 text-foreground/90";
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

function getSelectedSelectValueItems(
  value: unknown,
  property: WorkspacePropertyDefinitionState,
  selectValues: readonly WorkspaceSelectValueState[],
) {
  const values = getSelectValuesForProperty(selectValues, property.id);

  if (property.propertyType === "multi-select") {
    const selectedValues = Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];

    return selectedValues.map((valueId) => (
      values.find((selectValue) => selectValue.id === valueId) || {
        id: valueId,
        propertyId: property.id,
        name: valueId,
        color: "gray",
      }
    ));
  }

  if (typeof value !== "string" || !value) {
    return [];
  }

  return [
    values.find((selectValue) => selectValue.id === value) || {
      id: value,
      propertyId: property.id,
      name: value,
      color: "gray",
    },
  ];
}

function ProjectSelectValuePills({
  value,
  property,
  selectValues,
}: {
  readonly value: unknown;
  readonly property: WorkspacePropertyDefinitionState;
  readonly selectValues: readonly WorkspaceSelectValueState[];
}) {
  const selectedItems = getSelectedSelectValueItems(value, property, selectValues);

  if (selectedItems.length === 0) {
    return (
      <span className="flex min-h-7 min-w-0 items-center gap-2 text-[13px] font-medium text-muted-foreground">
        <span className="size-2 rounded-full bg-muted-foreground/50" aria-hidden="true" />
        <span className="truncate">Empty</span>
      </span>
    );
  }

  return (
    <span className="flex min-h-7 min-w-0 flex-wrap items-center gap-1.5 py-0.5">
      {selectedItems.map((selectValue) => (
        <span
          key={selectValue.id}
          className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-secondary/80 px-2 py-0.5 text-xs font-medium text-secondary-foreground"
        >
          <span className="size-2 rounded-full" data-color={selectValue.color || "gray"} aria-hidden="true" />
          <span className="truncate">{selectValue.name}</span>
        </span>
      ))}
    </span>
  );
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
  if (property.id === "property:status") {
    const label = stringifyPropertyValue(value);
    return label
      ? (
        <Badge variant="secondary" className="h-6 gap-1.5 rounded-md border border-border/50 bg-secondary/70 px-2 text-[13px] font-medium">
          <span className="size-2 rounded-full bg-muted-foreground/70" aria-hidden="true" />
          <span className="truncate">{label}</span>
        </Badge>
      )
      : <span className={projectDetailPlainValueClassName} />;
  }

  if (property.id === "property:name" || property.system) {
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
    return (
      <ProjectSelectValuePills
        value={value}
        property={property}
        selectValues={selectValues}
      />
    );
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
        className="h-8 w-full justify-start px-1.5 py-0 text-left text-muted-foreground hover:bg-accent/30 hover:text-foreground"
        title={node.relativePath}
        aria-expanded={isFolder ? isExpanded : undefined}
        onClick={() => {
          if (hasChildren) {
            onToggleFolder(node.id);
          }
        }}
      >
        <span className="grid min-w-0 grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-2" style={{ paddingLeft: `${depth * 0.9}rem` }}>
          {hasChildren ? (
            isExpanded ? (
              <ChevronDownIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
            ) : (
              <ChevronRightIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
            )
          ) : (
            <span className="size-3.5" aria-hidden="true" />
          )}
          {isFolder ? (
            <FolderIcon className={getFileTreeNodeIconClassName(node)} aria-hidden="true" />
          ) : (
            <FileIcon className={getFileTreeNodeIconClassName(node)} aria-hidden="true" />
          )}
          <span className={getFileTreeNodeNameClassName(node)}>{node.name}</span>
          {!node.available ? <Badge variant="destructive">Missing</Badge> : null}
        </span>
      </Button>
      {isFolder && isExpanded && node.children && node.children.length > 0 ? (
        <ul className="grid gap-0">
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
  onColorSelectValue,
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
  readonly onColorSelectValue: (selectValueId: string, color: string) => void;
  readonly onDeleteSelectValue: (selectValueId: string) => void;
}) {
  const value = getPropertyValue(project, property);

  if (isProtectedCardProperty(property)) {
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
        className="h-7 border-border bg-background px-2 text-[13px] shadow-none"
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
        className="workspace-number-input h-7 border-border bg-background px-2 text-[13px] shadow-none"
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
        onColorSelectValue={onColorSelectValue}
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
  onColorSelectValue,
  onDeleteSelectValue,
  onRenameProperty,
  onHideProperty,
  onDeleteProperty,
}: WorkspaceProjectDetailPanelProps) {
  const [projectDetailPanelWidth, setProjectDetailPanelWidth] = useState(readSavedProjectDetailPanelWidth);
  const [panelProject, setPanelProject] = useState<WorkspaceMockProject | null>(null);
  const [panelVisible, setPanelVisible] = useState(false);
  const [expandedFolderIds, setExpandedFolderIds] = useState<ReadonlySet<string>>(() => new Set());
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);
  const [propertyActionsId, setPropertyActionsId] = useState<string | null>(null);
  const [renamingPropertyId, setRenamingPropertyId] = useState<string | null>(null);
  const [renamingPropertyName, setRenamingPropertyName] = useState("");
  const [hiddenPropertiesExpanded, setHiddenPropertiesExpanded] = useState(true);
  const [cardPropertyOrder, setCardPropertyOrder] = useState<readonly string[]>(readSavedCardPropertyOrder);
  const [cardPropertyDrag, setCardPropertyDrag] = useState<CardPropertyDragState | null>(null);
  const renamingPropertyInputRef = useRef<HTMLInputElement | null>(null);
  const panelWidthRef = useRef(projectDetailPanelWidth);
  const panelMountedRef = useRef(false);
  const cardPropertyOrderRef = useRef<readonly string[]>(cardPropertyOrder);
  const cardPropertyPressMoved = useRef(false);
  const suppressCardPropertyClickRef = useRef(false);
  const isOpen = open && project !== null;
  const orderedCardProperties = useMemo(
    () => createOrderedCardProperties(visibleProperties, cardPropertyOrder),
    [visibleProperties, cardPropertyOrder],
  );
  const orderedVisibleProperties = useMemo(
    () => orderedCardProperties.filter((property) => !property.hidden),
    [orderedCardProperties],
  );
  const hiddenCardProperties = useMemo(
    () => orderedCardProperties.filter((property) => property.hidden),
    [orderedCardProperties],
  );

  useEffect(() => {
    panelMountedRef.current = panelProject !== null;
  }, [panelProject]);

  useEffect(() => {
    cardPropertyOrderRef.current = cardPropertyOrder;
  }, [cardPropertyOrder]);

  useEffect(() => {
    if (renamingPropertyId) {
      renamingPropertyInputRef.current?.focus();
      renamingPropertyInputRef.current?.select();
    }
  }, [renamingPropertyId]);

  useEffect(() => {
    if (isOpen) {
      setExpandedFolderIds(new Set());
      setEditingPropertyId(null);
      setPropertyActionsId(null);
      setRenamingPropertyId(null);
      setRenamingPropertyName("");
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

  function beginRenameProperty(property: WorkspacePropertyDefinitionState) {
    if (isProtectedCardProperty(property)) {
      return;
    }

    setPropertyActionsId(null);
    setRenamingPropertyId(property.id);
    setRenamingPropertyName(property.name);
  }

  function commitRenameProperty(property: WorkspacePropertyDefinitionState) {
    const nextName = renamingPropertyName.trim();
    setRenamingPropertyId(null);
    setRenamingPropertyName("");

    if (nextName && nextName !== property.name) {
      onRenameProperty(property.id, nextName);
    }
  }

  function cancelRenameProperty() {
    setRenamingPropertyId(null);
    setRenamingPropertyName("");
  }

  function hideProperty(property: WorkspacePropertyDefinitionState) {
    if (!isProtectedCardProperty(property)) {
      onHideProperty(property.id, true);
    }
  }

  function showProperty(property: WorkspacePropertyDefinitionState) {
    if (!isProtectedCardProperty(property)) {
      onHideProperty(property.id, false);
    }
  }

  function deleteProperty(property: WorkspacePropertyDefinitionState) {
    if (!isProtectedCardProperty(property) && window.confirm(`Delete property "${property.name}"?`)) {
      onDeleteProperty(property.id);
    }
  }

  function onReorderCardProperties(nextPropertyIds: readonly string[]) {
    setCardPropertyOrder(nextPropertyIds);
    cardPropertyOrderRef.current = nextPropertyIds;

    if (typeof window !== "undefined") {
      window.localStorage.setItem(cardPropertyOrderStorageKey, JSON.stringify(nextPropertyIds));
    }
  }

  function getCardPropertyDragPreviewRows() {
    return Array.from(document.querySelectorAll<HTMLElement>("[data-card-property-row-id]"))
      .map((row) => {
        const propertyId = row.dataset.cardPropertyRowId;
        const rect = row.getBoundingClientRect();

        if (!propertyId) {
          return null;
        }

        return {
          propertyId,
          top: rect.top,
          height: rect.height,
        };
      })
      .filter((row): row is CardPropertyDragPreviewRow => row !== null);
  }

  function findCardPropertyDragTarget(clientY: number, rows: readonly CardPropertyDragPreviewRow[]) {
    let dropIndex = 0;

    for (const row of rows) {
      if (clientY >= row.top + row.height / 2) {
        dropIndex += 1;
      }
    }

    return dropIndex;
  }

  function findCardPropertyDropIndex(
    clientY: number,
    rows: readonly CardPropertyDragPreviewRow[],
    sourcePropertyId: string,
  ) {
    return findCardPropertyDragTarget(
      clientY,
      rows.filter((row) => row.propertyId !== sourcePropertyId),
    );
  }

  function getCardPropertyDragTops(
    orderedPropertyIds: readonly string[],
    rows: readonly CardPropertyDragPreviewRow[],
  ) {
    const tops = new Map<string, number>();

    orderedPropertyIds.forEach((propertyId, index) => {
      const row = rows[index];
      if (row) {
        tops.set(propertyId, row.top);
      }
    });

    return tops;
  }

  function getCardPropertyDragStyle(propertyId: string): CSSProperties | undefined {
    if (!cardPropertyDrag) {
      return undefined;
    }

    const orderedPropertyIds = orderedVisibleProperties.map((property) => property.id);
    const currentRow = cardPropertyDrag.rows.find((row) => row.propertyId === propertyId);

    if (!currentRow || !orderedPropertyIds.includes(propertyId)) {
      return undefined;
    }

    if (propertyId === cardPropertyDrag.propertyId) {
      return {
        transform: `translateY(${cardPropertyDrag.currentY - cardPropertyDrag.startY}px)`,
        transitionDuration: "0ms",
        pointerEvents: "none",
        zIndex: 30,
      };
    }

    const previewOrder = getCardPropertyDragOrder(
      orderedPropertyIds,
      cardPropertyDrag.propertyId,
      cardPropertyDrag.dropIndex,
    );
    const previewTops = getCardPropertyDragTops(previewOrder, cardPropertyDrag.rows);
    const previewTop = previewTops.get(propertyId);

    if (previewTop === undefined) {
      return undefined;
    }

    const offset = previewTop - currentRow.top;

    if (Math.abs(offset) < 0.5) {
      return undefined;
    }

    return {
      transform: `translateY(${offset}px)`,
      transitionDuration: "180ms",
    };
  }

  function closePropertyMenuBeforeAction(
    event: ReactPointerEvent<HTMLElement> | ReactMouseEvent<HTMLElement>,
  ) {
    if (!propertyActionsId) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();
    setPropertyActionsId(null);
    return true;
  }

  function openCardPropertyMenu(propertyId: string) {
    setPropertyActionsId(propertyId);
  }

  function startCardPropertyDrag(
    event: ReactPointerEvent<HTMLElement>,
    propertyId: string,
    options: CardPropertyDragOptions = {},
  ) {
    if (event.button !== 0) {
      return;
    }

    if (closePropertyMenuBeforeAction(event)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const cardPropertyDragPreviewRows = getCardPropertyDragPreviewRows();
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    cardPropertyPressMoved.current = false;

    let frameId = 0;
    let pendingClientX = event.clientX;
    let pendingClientY = event.clientY;
    let dragActive = false;

    function beginCardPropertyDrag() {
      if (dragActive) {
        return;
      }

      dragActive = true;
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";
      setEditingPropertyId(null);
      setPropertyActionsId(null);
      setCardPropertyDrag({
        propertyId,
        startY: event.clientY,
        currentY: pendingClientY,
        dropIndex: findCardPropertyDropIndex(pendingClientY, cardPropertyDragPreviewRows, propertyId),
        rows: cardPropertyDragPreviewRows,
      });
    }

    function updateDraggedCardProperty() {
      frameId = 0;

      const dropIndex = findCardPropertyDropIndex(
        pendingClientY,
        cardPropertyDragPreviewRows,
        propertyId,
      );

      setCardPropertyDrag((currentDrag) => {
        if (!currentDrag || currentDrag.propertyId !== propertyId) {
          return currentDrag;
        }

        return {
          ...currentDrag,
          currentY: pendingClientY,
          dropIndex,
        };
      });
    }

    function moveCardProperty(pointerEvent: PointerEvent) {
      pendingClientX = pointerEvent.clientX;
      pendingClientY = pointerEvent.clientY;
      cardPropertyPressMoved.current = Math.hypot(
        pendingClientX - event.clientX,
        pendingClientY - event.clientY,
      ) > 4;

      if (!cardPropertyPressMoved.current) {
        return;
      }

      pointerEvent.preventDefault();
      beginCardPropertyDrag();

      if (frameId === 0) {
        frameId = window.requestAnimationFrame(updateDraggedCardProperty);
      }
    }

    function finishCardPropertyDrag(pointerEvent: PointerEvent) {
      const dropIndex = findCardPropertyDropIndex(
        pointerEvent.clientY,
        cardPropertyDragPreviewRows,
        propertyId,
      );
      const orderedPropertyIds = cardPropertyDragPreviewRows.map((row) => row.propertyId);
      const nextPropertyIds = getCardPropertyDragOrder(orderedPropertyIds, propertyId, dropIndex);
      const moved = cardPropertyPressMoved.current || Math.hypot(
        pointerEvent.clientX - event.clientX,
        pointerEvent.clientY - event.clientY,
      ) > 4;

      window.removeEventListener("pointermove", moveCardProperty);
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("pointerup", finishCardPropertyDrag);

      if (dragActive) {
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
        setCardPropertyDrag(null);
      }

      if (moved) {
        suppressCardPropertyClickRef.current = true;
        window.setTimeout(() => {
          suppressCardPropertyClickRef.current = false;
        }, 0);
        onReorderCardProperties(nextPropertyIds);
      } else if (options.openActionsOnClick) {
        openCardPropertyMenu(propertyId);
      }

      cardPropertyPressMoved.current = false;
    }

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
          "electron-window-no-drag pointer-events-auto relative flex h-full max-w-[calc(100vw-6rem)] flex-col gap-0 border-l border-border bg-popover bg-clip-padding text-sm text-popover-foreground shadow-lg will-change-transform transition-transform duration-[360ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
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
          <header className="border-b border-border/60 px-6 pb-5 pr-12 pt-6">
            <h2 id="project-detail-title" className="text-[22px] font-semibold leading-8 tracking-normal text-foreground">
              {displayedProject.name}
            </h2>
          </header>
          <div className="min-h-0 flex-1 overflow-auto px-6 pb-6 pt-3">
            <div className="grid gap-5">
              <section className="grid gap-2.5" aria-labelledby="project-properties-heading">
                <h3 id="project-properties-heading" className="text-sm font-medium text-muted-foreground">
                  Properties
                </h3>
                <dl className="overflow-hidden rounded-md border border-border/45 bg-background/15">
                  {orderedVisibleProperties.map((property) => {
                    const propertyProtected = isProtectedCardProperty(property);
                    const renamingProperty = renamingPropertyId === property.id;

                    return (
                      <Popover
                        key={property.id}
                        open={propertyActionsId === property.id}
                        onOpenChange={(open) => setPropertyActionsId(open ? property.id : null)}
                      >
                        <div
                          data-card-property-row-id={property.id}
                          className={[
                            "group/card-property grid min-h-10 items-stretch gap-0 border-b border-border/45 transition-colors duration-150 last:border-b-0 hover:bg-accent/15",
                            cardPropertyDrag ? "transition-transform ease-out" : "",
                            cardPropertyDrag?.propertyId === property.id ? "bg-muted/40 shadow-sm" : "",
                          ].filter(Boolean).join(" ")}
                          style={{
                            gridTemplateColumns: projectDetailPropertiesGridTemplateColumns,
                            ...getCardPropertyDragStyle(property.id),
                          }}
                          onContextMenu={(event) => {
                            if (propertyProtected) {
                              return;
                            }

                            if (closePropertyMenuBeforeAction(event)) {
                              return;
                            }

                            event.preventDefault();
                            openCardPropertyMenu(property.id);
                          }}
                        >
                          <dt className="grid min-w-0 grid-cols-[2rem_minmax(0,1fr)] items-stretch border-r border-border/45">
                            {renamingProperty ? (
                              <span className="col-span-2 flex min-w-0 items-center px-2">
                                <Input
                                  ref={renamingPropertyInputRef}
                                  value={renamingPropertyName}
                                  aria-label="Rename property"
                                  className="h-7 min-w-0 flex-1 border-ring bg-background px-1.5 text-sm text-foreground shadow-none"
                                  onChange={(event) => setRenamingPropertyName(event.target.value)}
                                  onBlur={() => commitRenameProperty(property)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      event.currentTarget.blur();
                                    }
                                    if (event.key === "Escape") {
                                      event.preventDefault();
                                      cancelRenameProperty();
                                    }
                                  }}
                                />
                              </span>
                            ) : !propertyProtected ? (
                              <PopoverAnchor asChild>
                                <button
                                  type="button"
                                  aria-label={`Open ${property.name} property menu`}
                                  className="col-span-2 grid min-h-10 min-w-0 cursor-grab select-none grid-cols-[2rem_minmax(0,1fr)] items-center text-left text-[13px] font-medium text-muted-foreground outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-ring/30"
                                  onPointerDown={(event) => (
                                    startCardPropertyDrag(event, property.id, { openActionsOnClick: true })
                                  )}
                                  onClick={(event) => {
                                    event.preventDefault();
                                    if (suppressCardPropertyClickRef.current) {
                                      event.stopPropagation();
                                      suppressCardPropertyClickRef.current = false;
                                      return;
                                    }

                                    openCardPropertyMenu(property.id);
                                  }}
                                  onContextMenu={(event) => {
                                    if (closePropertyMenuBeforeAction(event)) {
                                      return;
                                    }

                                    event.preventDefault();
                                    openCardPropertyMenu(property.id);
                                  }}
                                >
                                  <span className="flex h-full items-center justify-center text-muted-foreground/70">
                                    <GripVerticalIcon className="size-3.5" aria-hidden="true" />
                                  </span>
                                  <span className="min-w-0 truncate pr-3">{property.name}</span>
                                </button>
                              </PopoverAnchor>
                            ) : (
                              <button
                                type="button"
                                aria-label={`Reorder ${property.name} card property order`}
                                className="col-span-2 grid min-h-10 min-w-0 cursor-grab select-none grid-cols-[2rem_minmax(0,1fr)] items-center text-left text-[13px] font-medium text-muted-foreground outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-ring/30"
                                onPointerDown={(event) => startCardPropertyDrag(event, property.id)}
                              >
                                <span className="flex h-full items-center justify-center text-muted-foreground/70">
                                  <GripVerticalIcon className="size-3.5" aria-hidden="true" />
                                </span>
                                <span className="min-w-0 truncate pr-3">{property.name}</span>
                              </button>
                            )}
                          </dt>
                          <dd className="flex min-w-0 items-center px-4 py-1 text-[13px]">
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
                              onColorSelectValue={onColorSelectValue}
                              onDeleteSelectValue={onDeleteSelectValue}
                            />
                          </dd>
                        </div>
                        {!propertyProtected ? (
                          <PopoverContent
                            align="start"
                            className="w-44 p-1"
                            onOpenAutoFocus={(event) => event.preventDefault()}
                          >
                            <div role="menu" aria-label={`${property.name} property menu`} className="grid gap-0.5">
                              <button
                                type="button"
                                role="menuitem"
                                className={projectDetailPropertyMenuItemClassName}
                                onClick={() => beginRenameProperty(property)}
                              >
                                Rename property
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                className={projectDetailPropertyMenuItemClassName}
                                onClick={() => {
                                  setPropertyActionsId(null);
                                  hideProperty(property);
                                }}
                              >
                                Hide property
                              </button>
                              <div className="-mx-1 my-1 h-px bg-border" />
                              <button
                                type="button"
                                role="menuitem"
                                className={projectDetailPropertyMenuDangerItemClassName}
                                onClick={() => {
                                  setPropertyActionsId(null);
                                  deleteProperty(property);
                                }}
                              >
                                Delete property
                              </button>
                            </div>
                          </PopoverContent>
                        ) : null}
                      </Popover>
                    );
                  })}
                </dl>
                {hiddenCardProperties.length > 0 ? (
                  <div className="grid gap-2">
                    <button
                      type="button"
                      className="flex h-8 w-full items-center justify-between rounded-md px-1 text-left text-sm text-muted-foreground hover:bg-accent/60 hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring/40"
                      onClick={() => setHiddenPropertiesExpanded((expanded) => !expanded)}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        {hiddenPropertiesExpanded ? (
                          <ChevronDownIcon className="size-4 shrink-0" aria-hidden="true" />
                        ) : (
                          <ChevronRightIcon className="size-4 shrink-0" aria-hidden="true" />
                        )}
                        <span className="truncate">Hidden properties</span>
                      </span>
                      <Badge variant="secondary">{hiddenCardProperties.length}</Badge>
                    </button>
                    {hiddenPropertiesExpanded ? (
                      <dl className="overflow-hidden rounded-md border border-border/45 bg-background/15">
                        {hiddenCardProperties.map((property) => (
                          <div
                            key={property.id}
                            className="grid min-h-10 items-stretch gap-0 border-b border-border/45 opacity-75 transition-colors duration-150 last:border-b-0 hover:bg-accent/15"
                            style={{ gridTemplateColumns: projectDetailPropertiesGridTemplateColumns }}
                          >
                            <dt className="grid min-w-0 grid-cols-[2rem_minmax(0,1fr)] items-stretch border-r border-border/45">
                              <span className="flex h-full items-center justify-center text-muted-foreground/40">
                                <GripVerticalIcon className="size-3.5" aria-hidden="true" />
                              </span>
                              <span className="flex min-w-0 items-center truncate pr-3 text-[13px] font-medium text-muted-foreground">
                                {property.name}
                              </span>
                            </dt>
                            <dd className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-1 text-[13px] text-muted-foreground">
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
                                onColorSelectValue={onColorSelectValue}
                                onDeleteSelectValue={onDeleteSelectValue}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2"
                                onClick={() => showProperty(property)}
                              >
                                Show
                              </Button>
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                  </div>
                ) : null}
              </section>
              <section className="grid gap-2" aria-labelledby="project-file-tree-heading">
                <div className="flex items-center justify-between gap-3">
                  <h3 id="project-file-tree-heading" className="text-sm font-medium text-muted-foreground">
                    File tree
                  </h3>
                  <Badge variant="secondary" className="h-6 px-2 text-xs">{displayedProject.fileTree.length} items</Badge>
                </div>
                <ul className="grid gap-0">
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
