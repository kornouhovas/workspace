import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { shouldClosePaneOnEscape } from "@/workspacePaneKeyboard.js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  workspaceMenuContentClassName,
  workspaceMenuDangerIconClassName,
  workspaceMenuDangerItemClassName,
  workspaceMenuDescriptionClassName,
  workspaceMenuIconClassName,
  workspaceMenuItemClassName,
  workspaceMenuLabelClassName,
  workspaceMenuOptionItemClassName,
  workspaceMenuSeparatorClassName,
} from "@/components/workspace/menu-styles";
import { blockOutsideWorkspaceMenuPointerDown } from "@/components/workspace/menu-dismissal";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { WorkspaceDateValueEditor } from "@/components/workspace/date-value-editor";
import {
  formatNumberDisplayValue,
  formatNumberEditorValue,
} from "@/components/workspace/number-value";
import { WorkspaceSelectValueEditor } from "@/components/workspace/select-value-editor";
import { WorkspaceTextValueTextarea } from "@/components/workspace/text-value-editor";
import { useI18n } from "@/i18n";
import { getStatusDisplayName } from "@/i18n/status";
import {
  CalendarIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CircleDotIcon,
  EyeIcon,
  EyeOffIcon,
  FileIcon,
  FolderIcon,
  GripVerticalIcon,
  HashIcon,
  ListChecksIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  TypeIcon,
} from "@/lib/workspace-icons";
import type { WorkspaceCustomPropertyType } from "@/components/workspace/property-controls";
import type { WorkspaceMockFileTreeNode, WorkspaceMockProject } from "@/workspaceMockData";
import type {
  WorkspacePropertyDefinitionState,
  WorkspaceSelectValueState,
} from "@/workspaceAppState";

type WorkspaceProjectDetailPanelProps = {
  readonly onOpenLocalItem?: (node: WorkspaceMockFileTreeNode) => void;
  readonly expanded?: boolean;
  readonly inline?: boolean;
  readonly keyboardActive?: boolean;
  readonly sidebarCollapsed?: boolean;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly project: WorkspaceMockProject | null;
  readonly visibleProperties: readonly WorkspacePropertyDefinitionState[];
  readonly selectValues: readonly WorkspaceSelectValueState[];
  readonly onProjectPropertyValueChange: (
    projectId: string,
    propertyId: string,
    value: unknown,
  ) => void;
  readonly onCreateSelectValue: (
    propertyId: string,
    input: { readonly name: string; readonly color: string },
  ) => Promise<WorkspaceSelectValueState | null>;
  readonly onRenameSelectValue: (selectValueId: string, name: string) => void;
  readonly onColorSelectValue: (selectValueId: string, color: string) => void;
  readonly onDeleteSelectValue: (selectValueId: string) => void;
  readonly onCreateProperty: (input: { name: string; type: WorkspaceCustomPropertyType }) => void;
  readonly onRenameProperty: (propertyId: string, name: string) => void;
  readonly onHideProperty: (propertyId: string, hidden: boolean) => void;
  readonly onDeleteProperty: (propertyId: string) => void;
};

type ProjectDetailPropertyTypeOption = {
  readonly value: WorkspaceCustomPropertyType;
  readonly label: string;
  readonly description: string;
};

type CardPropertyDragPreviewRow = {
  readonly propertyId: string;
  readonly top: number;
  readonly height: number;
};

type CardPropertyGroup = "visible" | "hidden";

type CardPropertyDragState = {
  readonly propertyId: string;
  readonly group: CardPropertyGroup;
  readonly startY: number;
  readonly currentY: number;
  readonly dropIndex: number;
  readonly rows: readonly CardPropertyDragPreviewRow[];
};

type CardPropertyDragOptions = {
  readonly group?: CardPropertyGroup;
  readonly openActionsOnClick?: boolean;
};

const projectDetailPanelWidthStorageKey = "workspace.projectDetailPanelWidth";
const defaultProjectDetailPanelWidth = 480;
const minProjectDetailPanelWidth = 360;
const maxProjectDetailPanelWidth = 760;
const projectDetailPanelAnimationMs = 360;
const projectDetailPanelUnmountBufferMs = 80;
const cardPropertyOrderStorageKey = "workspace.cardDetailPropertyOrder";
const cardHiddenPropertyIdsStorageKey = "workspace.cardDetailHiddenPropertyIds";
const projectDetailPropertiesGridTemplateColumns = "minmax(8.5rem, 9.25rem) minmax(0, 1fr)";
const projectDetailPlainValueClassName =
  "flex min-h-8 w-full min-w-0 items-center truncate rounded-md px-0 py-0.5 text-left text-[13px] font-normal text-foreground";
const projectDetailMultilineValueClassName =
  "flex min-h-8 w-full min-w-0 items-start rounded-md px-0 py-1 text-left text-[13px] font-normal leading-5 text-foreground";
const projectDetailPlainTriggerClassName =
  "workspace-project-detail-value-trigger h-8 w-full min-w-0 justify-start gap-2 px-0 py-0.5 text-[13px] font-normal text-foreground hover:bg-transparent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30";
const detailAddPropertyMenuSurfaceSelector = "[data-workspace-detail-add-property-menu='true']";
const spreadsheetFileExtensions = new Set(["csv", "numbers", "ods", "xls", "xlsm", "xlsx"]);
const defaultPropertyNameByType: Readonly<Record<WorkspaceCustomPropertyType, string>> = {
  text: "Text",
  number: "Number",
  date: "Date",
  select: "Select",
  "multi-select": "Multi-select",
};

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

  return clampProjectDetailPanelWidth(
    Number(window.localStorage.getItem(projectDetailPanelWidthStorageKey)),
  );
}

function readSavedCardPropertyOrder() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const parsedValue = JSON.parse(
      window.localStorage.getItem(cardPropertyOrderStorageKey) || "[]",
    );
    return Array.isArray(parsedValue)
      ? parsedValue.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

const cardSectionsStorageKey = "workspace.card-property-sections.v1";

function readSavedCardSections() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(cardSectionsStorageKey) || "null");
    return {
      properties: typeof saved?.properties === "boolean" ? saved.properties : true,
      hidden: typeof saved?.hidden === "boolean" ? saved.hidden : true,
    };
  } catch {
    return { properties: true, hidden: true };
  }
}

function readSavedCardHiddenPropertyIds() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const parsedValue = JSON.parse(
      window.localStorage.getItem(cardHiddenPropertyIdsStorageKey) || "[]",
    );
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
  const remainingPropertyIds = orderedPropertyIds.filter(
    (propertyId) => propertyId !== sourcePropertyId,
  );
  const boundedDropIndex = Math.min(Math.max(dropIndex, 0), remainingPropertyIds.length);
  return [
    ...remainingPropertyIds.slice(0, boundedDropIndex),
    sourcePropertyId,
    ...remainingPropertyIds.slice(boundedDropIndex),
  ];
}

function getPropertyValue(
  project: WorkspaceMockProject,
  property: WorkspacePropertyDefinitionState,
) {
  if (property.id === "property:name") {
    return project.name;
  }

  if (property.id === "property:status") {
    return project.status;
  }

  return project.propertyValues[property.id as keyof typeof project.propertyValues] ?? "";
}

function stringifyPropertyValue(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value) && "name" in value) {
    return String((value as { readonly name?: unknown }).name || "");
  }

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

function isProjectDetailProperty(property: WorkspacePropertyDefinitionState) {
  return property.id !== "property:name";
}

function canRenameCardProperty(property: WorkspacePropertyDefinitionState) {
  return (
    property.id === "property:name" ||
    property.id === "property:status" ||
    !isProtectedCardProperty(property)
  );
}

function canHideCardProperty(property: WorkspacePropertyDefinitionState) {
  return property.id === "property:status" || !isProtectedCardProperty(property);
}

function isCardPropertyHidden(
  property: WorkspacePropertyDefinitionState,
  cardHiddenPropertyIds: readonly string[],
) {
  return property.hidden || cardHiddenPropertyIds.includes(property.id);
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

function renderPropertyTypeIcon(propertyType: WorkspaceCustomPropertyType) {
  const className = "mt-0.5 size-4 text-muted-foreground";

  if (propertyType === "number") {
    return <HashIcon className={className} aria-hidden="true" />;
  }

  if (propertyType === "date") {
    return <CalendarIcon className={className} aria-hidden="true" />;
  }

  if (propertyType === "select") {
    return <CircleDotIcon className={className} aria-hidden="true" />;
  }

  if (propertyType === "multi-select") {
    return <ListChecksIcon className={className} aria-hidden="true" />;
  }

  return <TypeIcon className={className} aria-hidden="true" />;
}

function getSelectValuesForProperty(
  selectValues: readonly WorkspaceSelectValueState[],
  propertyId: string,
) {
  return selectValues
    .filter((selectValue) => selectValue.propertyId === propertyId && !selectValue.hidden)
    .sort(
      (left, right) =>
        Number(left.order || 0) - Number(right.order || 0) || left.id.localeCompare(right.id),
    );
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

    return selectedValues.map(
      (valueId) =>
        values.find((selectValue) => selectValue.id === valueId) || {
          id: valueId,
          propertyId: property.id,
          name: valueId,
          color: "gray",
        },
    );
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
    return <span className="flex min-h-7 min-w-0 items-center" aria-hidden="true" />;
  }

  return (
    <span className="flex min-h-7 min-w-0 flex-wrap items-center gap-1.5 py-0.5">
      {selectedItems.map((selectValue) => (
        <span
          key={selectValue.id}
          className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-secondary/80 px-2 py-0.5 text-xs font-medium text-secondary-foreground"
        >
          <span
            className="size-2 rounded-full"
            data-color={selectValue.color || "gray"}
            aria-hidden="true"
          />
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
  const { t } = useI18n();

  if (property.id === "property:status") {
    const statusValue =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as {
            readonly id?: string;
            readonly name?: string;
            readonly source?: string;
            readonly color?: unknown;
          })
        : null;
    const label = statusValue
      ? getStatusDisplayName(t, statusValue)
      : stringifyPropertyValue(value);
    const color =
      typeof statusValue?.color === "string" && statusValue.color ? statusValue.color : "gray";
    return label ? (
      <Badge
        variant="secondary"
        data-workspace-status-value
        className="h-6 gap-1.5 rounded-md border border-border/50 bg-secondary/70 px-2 text-[13px] font-normal"
      >
        <span
          className="size-2 rounded-full bg-muted-foreground/70"
          data-color={color}
          aria-hidden="true"
        />
        <span className="truncate">{label}</span>
      </Badge>
    ) : (
      <span className={projectDetailPlainValueClassName} />
    );
  }

  if (property.id === "property:name" || property.system) {
    return (
      <span className={projectDetailPlainValueClassName}>{stringifyPropertyValue(value)}</span>
    );
  }

  if (property.propertyType === "text") {
    return (
      <button
        type="button"
        aria-label={t("property.editValue", { name: property.name })}
        className={projectDetailMultilineValueClassName}
        onClick={onStartEditing}
      >
        <span className="min-w-0 whitespace-pre-wrap break-words">
          {stringifyPropertyValue(value)}
        </span>
      </button>
    );
  }

  if (property.propertyType === "number") {
    return (
      <button
        type="button"
        aria-label={t("property.editValue", { name: property.name })}
        className={projectDetailPlainValueClassName}
        onClick={onStartEditing}
      >
        <span className="min-w-0 truncate">{formatNumberDisplayValue(value)}</span>
      </button>
    );
  }

  if (property.propertyType === "date") {
    return (
      <span className={projectDetailPlainValueClassName}>{stringifyPropertyValue(value)}</span>
    );
  }

  if (property.propertyType === "select" || property.propertyType === "multi-select") {
    return (
      <ProjectSelectValuePills value={value} property={property} selectValues={selectValues} />
    );
  }

  return <span className={projectDetailPlainValueClassName}>{stringifyPropertyValue(value)}</span>;
}

type FileTreeNodeProps = {
  readonly node: WorkspaceMockFileTreeNode;
  readonly depth?: number;
  readonly expandedFolderIds: ReadonlySet<string>;
  readonly onToggleFolder: (folderId: string) => void;
  readonly onOpenLocalItem?: (node: WorkspaceMockFileTreeNode) => void;
};

function FileTreeNode({
  node,
  depth = 0,
  expandedFolderIds,
  onToggleFolder,
  onOpenLocalItem,
}: FileTreeNodeProps) {
  const { t } = useI18n();
  const isFolder = node.kind === "folder";
  const hasChildren = isFolder && node.children !== undefined && node.children.length > 0;
  const isExpanded = isFolder && expandedFolderIds.has(node.id);

  return (
    <li>
      <Button
        type="button"
        variant="ghost"
        disabled={!node.available}
        className="h-7 w-full justify-start px-1.5 py-0 text-left text-sm font-normal text-muted-foreground hover:bg-accent/30 hover:text-foreground"
        title={node.relativePath}
        aria-label={`${t(isFolder ? "detail.folder" : "detail.file")}: ${node.name}`}
        aria-expanded={isFolder ? isExpanded : undefined}
        onClick={() => {
          if (hasChildren) {
            onToggleFolder(node.id);
          } else {
            onOpenLocalItem?.(node);
          }
        }}
      >
        <span
          className="grid min-w-0 grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-2"
          style={{ paddingLeft: `${depth * 0.9}rem` }}
        >
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
          {!node.available ? (
            <Badge variant="destructive">{t("detail.fileUnavailable")}</Badge>
          ) : null}
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
              onOpenLocalItem={onOpenLocalItem}
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
  readonly onProjectPropertyValueChange: (
    projectId: string,
    propertyId: string,
    value: unknown,
  ) => void;
  readonly onCreateSelectValue: (
    propertyId: string,
    input: { readonly name: string; readonly color: string },
  ) => Promise<WorkspaceSelectValueState | null>;
  readonly onRenameSelectValue: (selectValueId: string, name: string) => void;
  readonly onColorSelectValue: (selectValueId: string, color: string) => void;
  readonly onDeleteSelectValue: (selectValueId: string) => void;
}) {
  const { t } = useI18n();
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
      <WorkspaceTextValueTextarea
        key={`${project.id}:${property.id}:${stringifyPropertyValue(value)}`}
        autoFocus
        defaultValue={stringifyPropertyValue(value)}
        aria-label={t("property.editValue", { name: property.name })}
        className="min-h-8 border-transparent bg-transparent px-0 text-[13px] font-normal leading-5 shadow-none focus-visible:border-transparent focus-visible:bg-transparent focus-visible:ring-0"
        onBlur={(event) => {
          onProjectPropertyValueChange(project.id, property.id, event.target.value);
          onStopEditing();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.currentTarget.blur();
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
        key={`${project.id}:${property.id}:${formatNumberEditorValue(value)}`}
        autoFocus
        type="text"
        inputMode="decimal"
        defaultValue={formatNumberEditorValue(value)}
        aria-label={t("property.editValue", { name: property.name })}
        className="workspace-number-input h-7 border-border bg-background px-2 text-[13px] shadow-none"
        onBlur={(event) => {
          const text = event.target.value.trim();
          onProjectPropertyValueChange(project.id, property.id, text === "" ? null : text);
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
        containerClassName="w-full min-w-0"
        triggerClassName={projectDetailPlainTriggerClassName}
        onValueChange={(nextValue) =>
          onProjectPropertyValueChange(project.id, property.id, nextValue)
        }
      />
    );
  }

  if (property.propertyType === "select" || property.propertyType === "multi-select") {
    return (
      <WorkspaceSelectValueEditor
        property={property}
        value={value}
        selectValues={selectValues}
        containerClassName="w-full min-w-0"
        triggerClassName={projectDetailPlainTriggerClassName}
        onValueChange={(nextValue) =>
          onProjectPropertyValueChange(project.id, property.id, nextValue)
        }
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
  expanded = false,
  inline = false,
  keyboardActive = true,
  onOpenLocalItem,
  sidebarCollapsed = false,
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
  onCreateProperty,
  onRenameProperty,
  onHideProperty,
  onDeleteProperty,
}: WorkspaceProjectDetailPanelProps) {
  const { t } = useI18n();
  const propertyTypeOptions = useMemo<readonly ProjectDetailPropertyTypeOption[]>(
    () => [
      {
        value: "text",
        label: t("property.type.text"),
        description: t("property.type.textDescription"),
      },
      {
        value: "number",
        label: t("property.type.number"),
        description: t("property.type.numberDescription"),
      },
      {
        value: "date",
        label: t("property.type.date"),
        description: t("property.type.dateDescription"),
      },
      {
        value: "select",
        label: t("property.type.select"),
        description: t("property.type.selectDescription"),
      },
      {
        value: "multi-select",
        label: t("property.type.multiSelect"),
        description: t("property.type.multiSelectDescription"),
      },
    ],
    [t],
  );
  const [projectDetailPanelWidth, setProjectDetailPanelWidth] = useState(
    readSavedProjectDetailPanelWidth,
  );
  const [panelProject, setPanelProject] = useState<WorkspaceMockProject | null>(null);
  const [panelVisible, setPanelVisible] = useState(false);
  const [expandedFolderIds, setExpandedFolderIds] = useState<ReadonlySet<string>>(() => new Set());
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);
  const [propertyActionsId, setPropertyActionsId] = useState<string | null>(null);
  const [renamingPropertyId, setRenamingPropertyId] = useState<string | null>(null);
  const [renamingPropertyName, setRenamingPropertyName] = useState("");
  const [cardSections, setCardSections] = useState(readSavedCardSections);
  const propertiesExpanded = cardSections.properties;
  const hiddenPropertiesExpanded = cardSections.hidden;
  function toggleCardSection(section: "properties" | "hidden") {
    setCardSections((current) => ({ ...current, [section]: !current[section] }));
  }
  useEffect(() => {
    try {
      window.localStorage.setItem(cardSectionsStorageKey, JSON.stringify(cardSections));
    } catch {
      /* Keep the controls usable when local storage is unavailable. */
    }
  }, [cardSections]);
  const [openAddPropertyMenu, setOpenAddPropertyMenu] = useState(false);
  const [cardPropertyOrder, setCardPropertyOrder] = useState<readonly string[]>(
    readSavedCardPropertyOrder,
  );
  const [cardHiddenPropertyIds, setCardHiddenPropertyIds] = useState<readonly string[]>(
    readSavedCardHiddenPropertyIds,
  );
  const [cardPropertyDrag, setCardPropertyDrag] = useState<CardPropertyDragState | null>(null);
  const renamingPropertyInputRef = useRef<HTMLInputElement | null>(null);
  const panelWidthRef = useRef(projectDetailPanelWidth);
  const panelMountedRef = useRef(false);
  const cardPropertyOrderRef = useRef<readonly string[]>(cardPropertyOrder);
  const cardPropertyPressMoved = useRef(false);
  const suppressCardPropertyClickRef = useRef(false);
  const isOpen = open && project !== null;
  const detailVisibleProperties = useMemo(
    () => visibleProperties.filter(isProjectDetailProperty),
    [visibleProperties],
  );
  const orderedCardProperties = useMemo(
    () => createOrderedCardProperties(detailVisibleProperties, cardPropertyOrder),
    [detailVisibleProperties, cardPropertyOrder],
  );
  const orderedVisibleProperties = useMemo(
    () =>
      orderedCardProperties.filter(
        (property) => !isCardPropertyHidden(property, cardHiddenPropertyIds),
      ),
    [orderedCardProperties, cardHiddenPropertyIds],
  );
  const hiddenCardProperties = useMemo(
    () =>
      orderedCardProperties.filter((property) =>
        isCardPropertyHidden(property, cardHiddenPropertyIds),
      ),
    [orderedCardProperties, cardHiddenPropertyIds],
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
    const detailPropertyIdSet = new Set(detailVisibleProperties.map((property) => property.id));
    const nextHiddenPropertyIds = cardHiddenPropertyIds.filter((propertyId) =>
      detailPropertyIdSet.has(propertyId),
    );

    if (
      nextHiddenPropertyIds.length !== cardHiddenPropertyIds.length ||
      nextHiddenPropertyIds.some((propertyId, index) => propertyId !== cardHiddenPropertyIds[index])
    ) {
      setCardHiddenPropertyIds(nextHiddenPropertyIds);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          cardHiddenPropertyIdsStorageKey,
          JSON.stringify(nextHiddenPropertyIds),
        );
      }
    }
  }, [detailVisibleProperties, cardHiddenPropertyIds]);

  useEffect(() => {
    if (isOpen) {
      setExpandedFolderIds(new Set());
      setEditingPropertyId(null);
      setPropertyActionsId(null);
      setRenamingPropertyId(null);
      setRenamingPropertyName("");
      setOpenAddPropertyMenu(false);
    }
  }, [isOpen, project?.id]);

  useEffect(() => {
    const visiblePropertyIdSet = new Set(detailVisibleProperties.map((property) => property.id));
    const mergedPropertyIds = [
      ...cardPropertyOrder.filter((propertyId) => visiblePropertyIdSet.has(propertyId)),
      ...detailVisibleProperties
        .map((property) => property.id)
        .filter((propertyId) => !cardPropertyOrder.includes(propertyId)),
    ];

    if (
      mergedPropertyIds.length !== cardPropertyOrder.length ||
      mergedPropertyIds.some((propertyId, index) => propertyId !== cardPropertyOrder[index])
    ) {
      setCardPropertyOrder(mergedPropertyIds);
    }
  }, [detailVisibleProperties, cardPropertyOrder]);

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
      if (
        shouldClosePaneOnEscape({
          key: event.key,
          defaultPrevented: event.defaultPrevented,
          active: keyboardActive,
          editing: Boolean(
            event.target instanceof Element &&
            event.target.closest(
              "input,textarea,select,[contenteditable=true],[role=menu],[data-slot=popover-content],[role=dialog][data-state=open]",
            ),
          ),
        })
      ) {
        event.preventDefault();
        onOpenChange(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onOpenChange, keyboardActive]);

  useEffect(() => {
    if (!openAddPropertyMenu) {
      return undefined;
    }

    function closeAddPropertyMenuOnOutsidePointerDown(event: PointerEvent) {
      blockOutsideWorkspaceMenuPointerDown(event, detailAddPropertyMenuSurfaceSelector, () => {
        setOpenAddPropertyMenu(false);
      });
    }

    document.addEventListener("pointerdown", closeAddPropertyMenuOnOutsidePointerDown, true);

    return () => {
      document.removeEventListener("pointerdown", closeAddPropertyMenuOnOutsidePointerDown, true);
    };
  }, [openAddPropertyMenu]);

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
    if (!canRenameCardProperty(property)) {
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

  function deleteProperty(property: WorkspacePropertyDefinitionState) {
    if (
      !isProtectedCardProperty(property) &&
      window.confirm(t("confirm.deleteProperty", { name: property.name }))
    ) {
      onDeleteProperty(property.id);
    }
  }

  function createPropertyFromType(option: ProjectDetailPropertyTypeOption) {
    setOpenAddPropertyMenu(false);
    onCreateProperty({ name: defaultPropertyNameByType[option.value], type: option.value });
  }

  function onReorderCardProperties(nextPropertyIds: readonly string[]) {
    setCardPropertyOrder(nextPropertyIds);
    cardPropertyOrderRef.current = nextPropertyIds;

    if (typeof window !== "undefined") {
      window.localStorage.setItem(cardPropertyOrderStorageKey, JSON.stringify(nextPropertyIds));
    }
  }

  function setCardPropertyHidden(property: WorkspacePropertyDefinitionState, hidden: boolean) {
    if (property.id === "property:status") {
      const nextHiddenPropertyIds = hidden
        ? [...cardHiddenPropertyIds.filter((propertyId) => propertyId !== property.id), property.id]
        : cardHiddenPropertyIds.filter((propertyId) => propertyId !== property.id);

      setCardHiddenPropertyIds(nextHiddenPropertyIds);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          cardHiddenPropertyIdsStorageKey,
          JSON.stringify(nextHiddenPropertyIds),
        );
      }

      return;
    }

    if (!isProtectedCardProperty(property)) {
      onHideProperty(property.id, hidden);
    }
  }

  function getCardPropertiesForGroup(group: CardPropertyGroup) {
    return group === "hidden" ? hiddenCardProperties : orderedVisibleProperties;
  }

  function mergeCardPropertyGroupOrder(
    group: CardPropertyGroup,
    nextGroupPropertyIds: readonly string[],
  ) {
    const groupPropertyIds = new Set(
      getCardPropertiesForGroup(group).map((property) => property.id),
    );
    const nextGroupOrder = [...nextGroupPropertyIds];
    const completePropertyOrder = createOrderedCardProperties(
      detailVisibleProperties,
      cardPropertyOrderRef.current,
    ).map((property) => property.id);

    return completePropertyOrder.map((propertyId) => {
      if (!groupPropertyIds.has(propertyId)) {
        return propertyId;
      }

      return nextGroupOrder.shift() || propertyId;
    });
  }

  function getCardPropertyDragPreviewRows(group: CardPropertyGroup) {
    return Array.from(
      document.querySelectorAll<HTMLElement>(`[data-card-property-row-group="${group}"]`),
    )
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

  function findCardPropertyDragTarget(
    clientY: number,
    rows: readonly CardPropertyDragPreviewRow[],
  ) {
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

  function getCardPropertyDragStyle(
    propertyId: string,
    group: CardPropertyGroup,
  ): CSSProperties | undefined {
    if (!cardPropertyDrag) {
      return undefined;
    }

    if (cardPropertyDrag.group !== group) {
      return undefined;
    }

    const orderedPropertyIds = getCardPropertiesForGroup(group).map((property) => property.id);
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

    const group = options.group ?? "visible";
    const cardPropertyDragPreviewRows = getCardPropertyDragPreviewRows(group);
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
        group,
        startY: event.clientY,
        currentY: pendingClientY,
        dropIndex: findCardPropertyDropIndex(
          pendingClientY,
          cardPropertyDragPreviewRows,
          propertyId,
        ),
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
      cardPropertyPressMoved.current =
        Math.hypot(pendingClientX - event.clientX, pendingClientY - event.clientY) > 4;

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
      const nextGroupPropertyIds = getCardPropertyDragOrder(
        orderedPropertyIds,
        propertyId,
        dropIndex,
      );
      const moved =
        cardPropertyPressMoved.current ||
        Math.hypot(pointerEvent.clientX - event.clientX, pointerEvent.clientY - event.clientY) > 4;

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
        onReorderCardProperties(mergeCardPropertyGroupOrder(group, nextGroupPropertyIds));
      } else if (options.openActionsOnClick) {
        openCardPropertyMenu(propertyId);
      }

      cardPropertyPressMoved.current = false;
    }

    window.addEventListener("pointermove", moveCardProperty);
    window.addEventListener("pointerup", finishCardPropertyDrag, { once: true });
  }

  function renderCardPropertyActionsMenu(
    property: WorkspacePropertyDefinitionState,
    visibilityAction: "hide" | "show",
  ) {
    const visibilityLabel =
      visibilityAction === "hide" ? t("property.hideFromView") : t("property.showInView");
    const VisibilityIcon = visibilityAction === "hide" ? EyeOffIcon : EyeIcon;
    const propertyProtected = isProtectedCardProperty(property);
    const renameableProperty = canRenameCardProperty(property);
    const hideableProperty = canHideCardProperty(property);

    return (
      <PopoverContent
        align="start"
        className={`${workspaceMenuContentClassName} w-52`}
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div
          role="menu"
          aria-label={t("table.propertyActions", { name: property.name })}
          className="grid gap-0.5"
        >
          {renameableProperty ? (
            <button
              type="button"
              role="menuitem"
              className={workspaceMenuItemClassName}
              onClick={() => beginRenameProperty(property)}
            >
              <PencilIcon className={workspaceMenuIconClassName} aria-hidden="true" />
              {t("property.rename")}
            </button>
          ) : null}
          {hideableProperty ? (
            <>
              <button
                type="button"
                role="menuitem"
                className={workspaceMenuItemClassName}
                onClick={() => {
                  setPropertyActionsId(null);
                  setCardPropertyHidden(property, visibilityAction === "hide");
                }}
              >
                <VisibilityIcon className={workspaceMenuIconClassName} aria-hidden="true" />
                {visibilityLabel}
              </button>
              {!propertyProtected ? (
                <>
                  <div className={workspaceMenuSeparatorClassName} />
                  <button
                    type="button"
                    role="menuitem"
                    className={workspaceMenuDangerItemClassName}
                    onClick={() => {
                      setPropertyActionsId(null);
                      deleteProperty(property);
                    }}
                  >
                    <Trash2Icon className={workspaceMenuDangerIconClassName} aria-hidden="true" />
                    {t("property.delete")}
                  </button>
                </>
              ) : null}
            </>
          ) : null}
        </div>
      </PopoverContent>
    );
  }

  if (!panelProject) {
    return null;
  }

  const displayedProject = panelProject;

  return (
    <div
      className={[
        inline
          ? "electron-window-no-drag relative flex h-full min-h-0 min-w-0 flex-1"
          : "electron-window-no-drag pointer-events-none fixed bottom-0 right-0 z-30 flex justify-end top-[var(--workspace-header-height)]",
        !inline && expanded && !sidebarCollapsed ? "left-[var(--workspace-sidebar-width)]" : "",
      ].join(" ")}
      aria-hidden={!panelVisible}
    >
      {!expanded && !inline ? (
        <button
          type="button"
          aria-label={t("detail.close")}
          className={`electron-window-no-drag absolute inset-0 cursor-default bg-transparent ${panelVisible ? "pointer-events-auto" : "pointer-events-none"}`}
          tabIndex={panelVisible ? 0 : -1}
          onClick={closeProjectDetails}
        />
      ) : null}
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
          "electron-window-no-drag relative flex h-full flex-col gap-0 border-l border-border bg-popover bg-clip-padding text-sm text-popover-foreground shadow-lg will-change-transform transition-transform duration-[360ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
          expanded ? "workspace-project-detail-expanded" : "",
          expanded || inline
            ? "w-full max-w-none border-l-0 shadow-none"
            : "max-w-[calc(100vw-6rem)]",
          panelVisible ? "pointer-events-auto" : "pointer-events-none",
          panelVisible ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
        style={{ width: expanded || inline ? "100%" : projectDetailPanelWidth }}
      >
        {!expanded && !inline ? (
          <button
            type="button"
            aria-label={t("detail.resizePanel")}
            className="electron-window-no-drag absolute inset-y-0 left-0 z-10 w-2 cursor-ew-resize border-l border-transparent hover:border-ring focus-visible:border-ring focus-visible:outline-none"
            onPointerDown={startPanelResize}
          >
            <span className="sr-only">{t("detail.resizePanel")}</span>
          </button>
        ) : null}
        <>
          <header
            className={
              expanded ? "workspace-project-detail-content-inset pb-2 pt-3" : "px-5 pb-2 pt-3"
            }
          >
            <h2
              id="project-detail-title"
              className="workspace-project-detail-heading break-words text-sm font-medium text-foreground"
            >
              {displayedProject.name}
            </h2>
          </header>
          <div
            className={
              expanded
                ? "workspace-project-detail-content-inset min-h-0 flex-1 overflow-auto pb-6 pt-1"
                : "min-h-0 flex-1 overflow-auto px-5 pb-5 pt-1"
            }
          >
            <div className={expanded ? "grid gap-4" : "grid gap-4"}>
              <section
                className={`grid ${propertiesExpanded ? "gap-2" : "gap-0"}`}
                aria-labelledby="project-properties-heading"
              >
                <h3
                  id="project-properties-heading"
                  className="workspace-project-detail-heading text-sm font-medium text-foreground"
                >
                  <button
                    type="button"
                    aria-controls="project-visible-properties"
                    aria-expanded={propertiesExpanded}
                    className="workspace-project-detail-section-toggle group/section-heading relative flex h-7 w-full items-center rounded-md pr-2 text-left hover:bg-accent/60 hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring/40"
                    onClick={() => toggleCardSection("properties")}
                  >
                    {propertiesExpanded ? (
                      <ChevronDownIcon
                        className="absolute -left-4 size-3 shrink-0"
                        aria-hidden="true"
                      />
                    ) : (
                      <ChevronRightIcon
                        className="absolute -left-4 size-3 shrink-0"
                        aria-hidden="true"
                      />
                    )}
                    {t("property.properties")}
                  </button>
                </h3>
                {propertiesExpanded ? (
                  <dl
                    id="project-visible-properties"
                    className="overflow-hidden rounded-md border border-border/45 bg-background/15"
                  >
                    {orderedVisibleProperties.map((property) => {
                      const propertyProtected = isProtectedCardProperty(property);
                      const propertyMenuAvailable =
                        canRenameCardProperty(property) ||
                        canHideCardProperty(property) ||
                        !propertyProtected;
                      const renamingProperty = renamingPropertyId === property.id;

                      return (
                        <Popover
                          key={property.id}
                          open={propertyActionsId === property.id}
                          onOpenChange={(open) => setPropertyActionsId(open ? property.id : null)}
                        >
                          <div
                            data-card-property-row-id={property.id}
                            data-card-property-row-group="visible"
                            className={[
                              "group/card-property grid min-h-9 items-stretch gap-0 border-b border-border/45 transition-colors duration-150 last:border-b-0",
                              cardPropertyDrag ? "transition-transform ease-out" : "",
                              cardPropertyDrag?.propertyId === property.id
                                ? "bg-muted/40 shadow-sm"
                                : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            style={{
                              gridTemplateColumns: expanded
                                ? "minmax(12rem, 16.5rem) minmax(0, 1fr)"
                                : projectDetailPropertiesGridTemplateColumns,
                              ...getCardPropertyDragStyle(property.id, "visible"),
                            }}
                          >
                            <dt className="grid min-w-0 grid-cols-[2rem_minmax(0,1fr)] items-stretch border-r border-border/45">
                              {renamingProperty ? (
                                <span className="col-span-2 flex min-w-0 items-center px-2">
                                  <Input
                                    ref={renamingPropertyInputRef}
                                    value={renamingPropertyName}
                                    aria-label={t("property.rename")}
                                    className="h-7 min-w-0 flex-1 border-ring bg-background px-1.5 text-sm text-foreground shadow-none"
                                    onChange={(event) =>
                                      setRenamingPropertyName(event.target.value)
                                    }
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
                              ) : propertyMenuAvailable ? (
                                <PopoverAnchor asChild>
                                  <button
                                    type="button"
                                    aria-label={t("table.propertyActions", { name: property.name })}
                                    className="col-span-2 grid min-h-9 min-w-0 cursor-grab select-none grid-cols-[2rem_minmax(0,1fr)] items-center rounded-md text-left text-[13px] font-normal text-muted-foreground outline-none transition-colors hover:bg-accent/15 active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-ring/30"
                                    onPointerDown={(event) =>
                                      startCardPropertyDrag(event, property.id, {
                                        openActionsOnClick: true,
                                      })
                                    }
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
                                  aria-label={t("detail.reorderProperty", { name: property.name })}
                                  className="col-span-2 grid min-h-9 min-w-0 cursor-grab select-none grid-cols-[2rem_minmax(0,1fr)] items-center rounded-md text-left text-[13px] font-normal text-muted-foreground outline-none transition-colors hover:bg-accent/15 active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-ring/30"
                                  onPointerDown={(event) =>
                                    startCardPropertyDrag(event, property.id)
                                  }
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
                          {propertyMenuAvailable
                            ? renderCardPropertyActionsMenu(property, "hide")
                            : null}
                        </Popover>
                      );
                    })}
                    <DropdownMenu open={openAddPropertyMenu} onOpenChange={setOpenAddPropertyMenu}>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="grid min-h-9 w-full items-stretch gap-0 text-left transition-colors hover:bg-accent/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                          style={{
                            gridTemplateColumns: expanded
                              ? "minmax(12rem, 16.5rem) minmax(0, 1fr)"
                              : projectDetailPropertiesGridTemplateColumns,
                          }}
                        >
                          <span className="grid min-w-0 grid-cols-[2rem_minmax(0,1fr)] items-center border-r border-border/45">
                            <span className="flex h-full items-center justify-center text-muted-foreground/70">
                              <PlusIcon className="size-3.5" aria-hidden="true" />
                            </span>
                            <span className="min-w-0 truncate pr-3 text-[13px] font-normal text-muted-foreground">
                              {t("property.add")}
                            </span>
                          </span>
                          <span className="flex min-w-0 items-center px-4 text-[13px] text-muted-foreground/80">
                            {t("property.addDescription")}
                          </span>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        data-workspace-detail-add-property-menu="true"
                        align="start"
                        className={`${workspaceMenuContentClassName} w-64`}
                      >
                        <DropdownMenuLabel className={workspaceMenuLabelClassName}>
                          {t("property.add")}
                        </DropdownMenuLabel>
                        <DropdownMenuGroup>
                          {propertyTypeOptions.map((option) => (
                            <DropdownMenuItem
                              key={option.value}
                              className={workspaceMenuOptionItemClassName}
                              onSelect={() => createPropertyFromType(option)}
                            >
                              {renderPropertyTypeIcon(option.value)}
                              <span className="grid min-w-0 gap-0.5">
                                <span className="truncate font-medium">{option.label}</span>
                                <span className={workspaceMenuDescriptionClassName}>
                                  {option.description}
                                </span>
                              </span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </dl>
                ) : null}
                {hiddenCardProperties.length > 0 ? (
                  <div className="grid gap-2">
                    <div className="workspace-project-detail-hidden-properties-heading workspace-project-detail-heading group/section-heading flex items-center justify-between gap-3 text-sm font-medium">
                      <button
                        type="button"
                        aria-controls="project-hidden-properties"
                        aria-expanded={hiddenPropertiesExpanded}
                        className="workspace-project-detail-hidden-properties-toggle group/section-toggle relative flex h-7 min-w-0 flex-1 items-center rounded-md pr-2 text-left text-sm font-medium text-muted-foreground hover:bg-accent/60 hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring/40"
                        onClick={() => toggleCardSection("hidden")}
                      >
                        {hiddenPropertiesExpanded ? (
                          <ChevronDownIcon
                            className="absolute -left-4 size-3 shrink-0"
                            aria-hidden="true"
                          />
                        ) : (
                          <ChevronRightIcon
                            className="absolute -left-4 size-3 shrink-0"
                            aria-hidden="true"
                          />
                        )}
                        <span className="truncate">{t("view.hiddenProperties")}</span>
                      </button>
                      <Badge variant="secondary">{hiddenCardProperties.length}</Badge>
                    </div>
                    {hiddenPropertiesExpanded ? (
                      <dl
                        id="project-hidden-properties"
                        className="overflow-hidden rounded-md border border-border/45 bg-background/15"
                      >
                        {hiddenCardProperties.map((property) => {
                          const propertyProtected = isProtectedCardProperty(property);
                          const propertyMenuAvailable =
                            canRenameCardProperty(property) ||
                            canHideCardProperty(property) ||
                            !propertyProtected;
                          const renamingProperty = renamingPropertyId === property.id;

                          return (
                            <Popover
                              key={property.id}
                              open={propertyActionsId === property.id}
                              onOpenChange={(open) =>
                                setPropertyActionsId(open ? property.id : null)
                              }
                            >
                              <div
                                data-card-property-row-id={property.id}
                                data-card-property-row-group="hidden"
                                className={[
                                  "group/card-property grid min-h-9 items-stretch gap-0 border-b border-border/45 transition-colors duration-150 last:border-b-0",
                                  cardPropertyDrag ? "transition-transform ease-out" : "",
                                  cardPropertyDrag?.propertyId === property.id
                                    ? "bg-muted/40 shadow-sm"
                                    : "",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                                style={{
                                  gridTemplateColumns: expanded
                                    ? "minmax(12rem, 16.5rem) minmax(0, 1fr)"
                                    : projectDetailPropertiesGridTemplateColumns,
                                  ...getCardPropertyDragStyle(property.id, "hidden"),
                                }}
                              >
                                <dt className="grid min-w-0 grid-cols-[2rem_minmax(0,1fr)] items-stretch border-r border-border/45">
                                  {renamingProperty ? (
                                    <span className="col-span-2 flex min-w-0 items-center px-2">
                                      <Input
                                        ref={renamingPropertyInputRef}
                                        value={renamingPropertyName}
                                        aria-label={t("property.rename")}
                                        className="h-7 min-w-0 flex-1 border-ring bg-background px-1.5 text-sm text-foreground shadow-none"
                                        onChange={(event) =>
                                          setRenamingPropertyName(event.target.value)
                                        }
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
                                  ) : propertyMenuAvailable ? (
                                    <PopoverAnchor asChild>
                                      <button
                                        type="button"
                                        aria-label={t("table.propertyActions", {
                                          name: property.name,
                                        })}
                                        className="col-span-2 grid min-h-9 min-w-0 cursor-grab select-none grid-cols-[2rem_minmax(0,1fr)] items-center rounded-md text-left text-[13px] font-normal text-muted-foreground outline-none transition-colors hover:bg-accent/15 active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-ring/30"
                                        onPointerDown={(event) =>
                                          startCardPropertyDrag(event, property.id, {
                                            group: "hidden",
                                            openActionsOnClick: true,
                                          })
                                        }
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
                                          <GripVerticalIcon
                                            className="size-3.5"
                                            aria-hidden="true"
                                          />
                                        </span>
                                        <span className="min-w-0 truncate pr-3">
                                          {property.name}
                                        </span>
                                      </button>
                                    </PopoverAnchor>
                                  ) : (
                                    <button
                                      type="button"
                                      aria-label={t("detail.reorderProperty", {
                                        name: property.name,
                                      })}
                                      className="col-span-2 grid min-h-9 min-w-0 cursor-grab select-none grid-cols-[2rem_minmax(0,1fr)] items-center rounded-md text-left text-[13px] font-normal text-muted-foreground outline-none transition-colors hover:bg-accent/15 active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-ring/30"
                                      onPointerDown={(event) =>
                                        startCardPropertyDrag(event, property.id, {
                                          group: "hidden",
                                        })
                                      }
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
                              {propertyMenuAvailable
                                ? renderCardPropertyActionsMenu(property, "show")
                                : null}
                            </Popover>
                          );
                        })}
                      </dl>
                    ) : null}
                  </div>
                ) : null}
              </section>
              <section className="grid gap-2" aria-labelledby="project-file-tree-heading">
                <div className="flex items-center justify-between gap-3">
                  <h3
                    id="project-file-tree-heading"
                    className="workspace-project-detail-heading text-sm font-medium text-foreground"
                  >
                    {t("detail.fileTree")}
                  </h3>
                  <Badge
                    variant="secondary"
                    aria-label={t("detail.items", { count: displayedProject.fileTree.length })}
                    className="h-5 min-w-5 rounded-full px-1.5 text-xs tabular-nums"
                  >
                    {displayedProject.fileTree.length}
                  </Badge>
                </div>
                <ul className="workspace-file-tree grid gap-0">
                  {displayedProject.fileTree.map((node) => (
                    <FileTreeNode
                      key={node.id}
                      node={node}
                      onOpenLocalItem={onOpenLocalItem}
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
