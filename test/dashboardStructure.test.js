import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readProjectFile(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("renderer composes the workspace product shell", async () => {
  const [
    componentsSource,
    appSource,
    mainSource,
    cssSource,
    packageSource,
    viteSource,
    tsconfigSource,
    leftPanelSource,
    statesSource,
    settingsViewSource,
    projectDetailPanelSource,
    lucideIconsSource,
    boardViewSource,
    tableViewSource,
    viewTabsSource,
    workspaceCompatibilitySource,
    propertyControlsSource,
    viewFilterMenuSource,
    selectValueEditorSource,
    dateValueEditorSource,
    popoverSource,
    workspaceAppStateSource,
    buildRendererSource,
    disableFsEventsLoaderSource,
    lucideIconTypesSource,
  ] = await Promise.all([
    readProjectFile("components.json"),
    readProjectFile("src/App.tsx"),
    readProjectFile("src/main.tsx"),
    readProjectFile("src/styles.css"),
    readProjectFile("package.json"),
    readProjectFile("vite.config.ts"),
    readProjectFile("tsconfig.json"),
    readProjectFile("src/components/workspace/left-panel.tsx"),
    readProjectFile("src/components/workspace/states.tsx"),
    readProjectFile("src/components/workspace/settings-view.tsx"),
    readProjectFile("src/components/workspace/project-detail-panel.tsx"),
    readProjectFile("src/lib/lucide-icons.ts"),
    readProjectFile("src/components/workspace/board-view.tsx"),
    readProjectFile("src/components/workspace/table-view.tsx"),
    readProjectFile("src/components/workspace/view-tabs.tsx"),
    readProjectFile("src/workspaceCompatibility.ts"),
    readProjectFile("src/components/workspace/property-controls.tsx"),
    readProjectFile("src/components/workspace/view-filter-menu.tsx"),
    readProjectFile("src/components/workspace/select-value-editor.tsx"),
    readProjectFile("src/components/workspace/date-value-editor.tsx"),
    readProjectFile("src/components/ui/popover.tsx"),
    readProjectFile("src/workspaceAppState.ts"),
    readProjectFile("scripts/build-renderer.mjs"),
    readProjectFile("scripts/disable-fsevents-loader.mjs"),
    readProjectFile("src/types/lucide-react-icons.d.ts"),
  ]);

  const componentsJson = JSON.parse(componentsSource);
  const packageJson = JSON.parse(packageSource);
  const tsconfigJson = JSON.parse(tsconfigSource);

  assert.equal(componentsJson.style, "radix-nova");
  assert.equal(componentsJson.tailwind.css, "src/styles.css");
  assert.equal(componentsJson.iconLibrary, "lucide");
  assert.equal(componentsJson.aliases.components, "@/components");
  assert.equal(tsconfigJson.compilerOptions.paths["@/*"][0], "./src/*");
  assert.match(viteSource, /@vitejs\/plugin-react/);
  assert.match(viteSource, /@tailwindcss\/vite/);
  assert.match(viteSource, /"@":\s*resolve\(__dirname,\s*"src"\)/);

  assert.ok(packageJson.dependencies.react);
  assert.ok(packageJson.dependencies["react-dom"]);
  assert.ok(packageJson.dependencies.shadcn);
  assert.ok(packageJson.dependencies["lucide-react"]);
  assert.equal(packageJson.scripts["build:renderer"], "node scripts/build-renderer.mjs");
  assert.match(cssSource, /@import "tailwindcss" source\(none\);/);
  assert.match(cssSource, /@source "\.";/);
  assert.match(cssSource, /@source "\.\.\/index\.html";/);
  assert.match(buildRendererSource, /register\(new URL\("\.\/disable-fsevents-loader\.mjs"/);
  assert.match(buildRendererSource, /await import\("vite"\)/);
  assert.match(disableFsEventsLoaderSource, /specifier === "fsevents"/);
  assert.match(disableFsEventsLoaderSource, /export default undefined/);
  assert.doesNotMatch(lucideIconsSource, /from "lucide-react"/);
  assert.match(lucideIconsSource, /lucide-react\/dist\/esm\/icons\/check\.mjs/);
  assert.match(lucideIconTypesSource, /lucide-react\/dist\/esm\/icons\/\*\.mjs/);

  assert.match(appSource, /from "@\/components\/workspace\/left-panel"/);
  assert.match(appSource, /Workspace Project Board/);
  assert.match(appSource, /<WorkspaceLeftPanel/);
  assert.match(appSource, /WorkspaceBoardView/);
  assert.match(appSource, /WorkspaceTableView/);
  assert.doesNotMatch(boardViewSource, /workspace-board-heading/);
  assert.doesNotMatch(tableViewSource, /workspace-table-heading/);
  assert.doesNotMatch(boardViewSource, /Status columns are fixed for the MVP/);
  assert.doesNotMatch(tableViewSource, /Rows use the same project set as the Board projection/);
  assert.match(appSource, /WorkspaceViewTabs/);
  assert.doesNotMatch(appSource, /electron-window-drag flex h-12 shrink-0 items-center gap-2 border-b border-border pr-4/);
  assert.match(appSource, /WorkspaceSettingsView/);
  assert.match(appSource, /handleSelectFolder/);
  assert.match(appSource, /loadRequestIdRef/);
  assert.match(appSource, /folderSelectionPendingRef/);
  assert.match(appSource, /loadWorkspaceList/);
  assert.match(appSource, /rootSelected/);
  assert.match(appSource, /handleCreateView/);
  assert.match(appSource, /handleRenameView/);
  assert.match(appSource, /handleDeleteView/);
  assert.match(appSource, /handleAddWorkspace/);
  assert.match(appSource, /const workspaceName = "Workspace"/);
  assert.doesNotMatch(appSource, /Workspace \$\{nextIndex\}/);
  assert.match(appSource, /handleRenameWorkspace/);
  assert.match(appSource, /handleDeleteWorkspace/);
  assert.match(appSource, /handleReorderWorkspaces/);
  assert.match(appSource, /handleFolderRoleChange/);
  assert.match(appSource, /workspaceClient\.setRoot/);
  assert.match(appSource, /workspaceClient\.scan/);
  assert.match(appSource, /includeCardChildren:\s*activeSurface === "settings"/);
  assert.match(appSource, /workspaceClient\.createView/);
  assert.match(appSource, /viewCreated/);
  assert.match(appSource, /projectionUpdated/);
  assert.match(appSource, /workspaceClient\.updateView/);
  assert.match(appSource, /workspaceClient\.deleteView/);
  assert.match(appSource, /workspaceClient\.updateFolderRole/);
  assert.match(appSource, /workspaceClient\.listProjectFileTree/);
  assert.match(appSource, /loadProjectFileTree/);
  assert.match(appSource, /workspaceClient\.createWorkspace/);
  assert.match(appSource, /workspaceClient\.updateWorkspace/);
  assert.match(appSource, /workspaceClient\.deleteWorkspace/);
  assert.match(appSource, /deleteWorkspaceListFallback\(current,\s*workspaceId\)/);
  assert.match(appSource, /responseActiveWorkspaceId/);
  assert.match(appSource, /workspaceClient\.reorderWorkspaces/);
  assert.match(appSource, /workspaceClient\.setActiveWorkspace/);
  const workspaceOpenHandler = appSource.slice(
    appSource.indexOf("async function handleWorkspaceOpen"),
    appSource.indexOf("async function handleRenameWorkspace"),
  );
  assert.match(workspaceOpenHandler, /dispatch\(\{\s*type: "workspaceActivated",\s*workspaceId\s*\}\)/);
  assert.match(workspaceOpenHandler, /isUnsupportedWorkspaceMethodError\(error, "workspace\.setActiveWorkspace"\)[\s\S]*dispatch\(\{\s*type: "workspaceActivated",\s*workspaceId\s*\}\)/);
  assert.doesNotMatch(appSource, /includeCardChildren:\s*true/);
  assert.match(appSource, /normalizeFolderRoleTree/);
  assert.match(appSource, /onSelectFolder/);
  assert.match(appSource, /onFolderRoleChange/);
  assert.match(appSource, /folderRoleTree=\{folderRoleTree\}/);
  assert.match(appSource, /WorkspaceProjectDetailPanel/);
  assert.match(appSource, /workspaceMockProjection/);
  assert.match(appSource, /selectedProject/);
  assert.match(appSource, /useState<WorkspaceMockProject \| null>\(\s*null\s*\)/);
  assert.match(appSource, /activeSurface/);
  assert.match(appSource, /activeSurface === "settings"/);
  assert.match(appSource, /activeViewType === "board"/);
  assert.match(appSource, /activeViewType === "table"/);
  assert.match(appSource, /onProjectOpen=\{handleProjectOpen\}/);
  assert.match(appSource, /searchQueryChanged/);
  assert.match(appSource, /filterWorkspaceProjectionBySearch/);
  assert.doesNotMatch(appSource, /searchQuery:\s*state\.searchQuery/);
  assert.doesNotMatch(appSource, /\[reloadToken, workspaceClient, state\.activeViewId, state\.searchQuery\]/);
  assert.match(appSource, /activeViewChanged/);
  assert.match(appSource, /workspaceClient\.setActiveView/);
  assert.match(appSource, /isUnsupportedWorkspaceMethodError/);
  assert.match(appSource, /sidebarCollapsed/);
  assert.match(appSource, /PanelLeftIcon/);
  assert.match(appSource, /pl-24/);
  assert.match(appSource, /transition-\[width,opacity\]/);
  assert.match(appSource, /w-0/);
  assert.doesNotMatch(leftPanelSource, /onToggleCollapsed/);
  assert.match(appSource, /data-testid="workspace-main"/);
  assert.match(appSource, /flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden/);
  assert.match(appSource, /electron-window-drag/);
  assert.match(appSource, /electron-window-no-drag/);
  assert.match(workspaceCompatibilitySource, /workspace\.listWorkspaces/);
  assert.match(workspaceCompatibilitySource, /createWorkspaceListFallback/);
  assert.match(workspaceCompatibilitySource, /addWorkspaceListFallback/);
  assert.doesNotMatch(appSource, /app\/dashboard\/data\.json/);
  assert.doesNotMatch(appSource, /ChartAreaInteractive/);
  assert.doesNotMatch(appSource, /SectionCards/);
  assert.doesNotMatch(appSource, /DataTable/);
  assert.doesNotMatch(appSource, /SidebarProvider/);

  assert.match(leftPanelSource, /Add Workspace/);
  assert.match(leftPanelSource, /Search/);
  assert.match(leftPanelSource, /searchQuery/);
  assert.match(leftPanelSource, /onSearchQueryChange/);
  assert.match(leftPanelSource, /onWorkspaceOpen/);
  assert.match(leftPanelSource, /onOpenSettings/);
  assert.match(leftPanelSource, /workspaces/);
  assert.match(leftPanelSource, /activeWorkspaceId/);
  assert.match(leftPanelSource, /onAddWorkspace/);
  assert.match(leftPanelSource, /onRenameWorkspace/);
  assert.match(leftPanelSource, /onDeleteWorkspace/);
  assert.match(leftPanelSource, /onReorderWorkspaces/);
  assert.match(leftPanelSource, /editingWorkspaceId/);
  assert.match(leftPanelSource, /aria-label="Rename workspace"/);
  assert.match(leftPanelSource, /min-w-44/);
  assert.doesNotMatch(leftPanelSource, /draggable/);
  assert.doesNotMatch(leftPanelSource, /onDragStart/);
  assert.doesNotMatch(leftPanelSource, /onDrop/);
  assert.match(leftPanelSource, /startPointerWorkspaceDrag/);
  assert.match(leftPanelSource, /getWorkspaceDragPreviewRows/);
  assert.match(leftPanelSource, /getWorkspaceDragStyle/);
  assert.match(leftPanelSource, /requestAnimationFrame/);
  assert.match(leftPanelSource, /transitionDuration: "180ms"/);
  assert.doesNotMatch(leftPanelSource, /pointerEvents: "none"/);
  assert.match(leftPanelSource, /transform: `translateY/);
  assert.doesNotMatch(leftPanelSource, /dragging && "bg-sidebar-accent/);
  assert.match(leftPanelSource, /Rename Workspace/);
  assert.match(leftPanelSource, /Delete Workspace/);
  assert.match(leftPanelSource, /pt-7/);
  assert.match(leftPanelSource, /onChange/);
  assert.match(leftPanelSource, /Workspaces/);
  assert.match(leftPanelSource, /Settings/);
  assert.match(leftPanelSource, /from "@\/lib\/lucide-icons"/);
  assert.match(statesSource, /No source folder selected/);
  assert.match(statesSource, /Open Settings/);
  assert.match(statesSource, /onOpenSettings/);
  assert.match(settingsViewSource, /WorkspaceSettingsView/);
  assert.match(settingsViewSource, /Source folder/);
  assert.match(settingsViewSource, /Select folder/);
  assert.match(settingsViewSource, /onSelectFolder/);
  assert.match(settingsViewSource, /expandedFolderIds/);
  assert.match(settingsViewSource, /toggleFolderExpanded/);
  assert.match(settingsViewSource, /ChevronRightIcon/);
  assert.match(settingsViewSource, /onFolderRoleChange/);
  assert.match(settingsViewSource, /group/);
  assert.match(settingsViewSource, /status/);
  assert.match(settingsViewSource, /project/);
  assert.match(settingsViewSource, /folderRoleTree/);
  assert.match(settingsViewSource, /WorkspacePropertyControls/);
  assert.match(settingsViewSource, /properties=\{properties\}/);
  assert.match(settingsViewSource, /selectValues=\{selectValues\}/);
  assert.match(settingsViewSource, /onCreateProperty/);
  assert.match(propertyControlsSource, /WorkspacePropertyControls/);
  assert.match(propertyControlsSource, /Add property/);
  assert.match(propertyControlsSource, /Text/);
  assert.match(propertyControlsSource, /Numbers/);
  assert.match(propertyControlsSource, /Date/);
  assert.match(propertyControlsSource, /Select/);
  assert.match(propertyControlsSource, /Multi-select/);
  assert.match(propertyControlsSource, /Rename property/);
  assert.match(propertyControlsSource, /Hide property/);
  assert.match(propertyControlsSource, /Show property/);
  assert.match(propertyControlsSource, /Delete property/);
  assert.match(propertyControlsSource, /GripVerticalIcon/);
  assert.match(propertyControlsSource, /DropdownMenu/);
  assert.match(propertyControlsSource, /<Input/);
  assert.match(propertyControlsSource, /<Select/);
  assert.match(propertyControlsSource, /Add select value/);
  assert.match(propertyControlsSource, /Rename select value/);
  assert.match(propertyControlsSource, /Color/);
  assert.match(propertyControlsSource, /Hide select value/);
  assert.match(propertyControlsSource, /Show select value/);
  assert.match(propertyControlsSource, /Delete select value/);
  assert.match(propertyControlsSource, /valueColorOptions/);
  assert.match(propertyControlsSource, /isSelectProperty/);
  assert.match(appSource, /workspaceClient\.createSelectValue/);
  assert.match(appSource, /normalizeSelectValue\(response\.selectValue/);
  assert.match(appSource, /onCreateSelectValue=\{handleCreateSelectValue\}/);
  assert.match(appSource, /workspaceClient\.updateSelectValue/);
  assert.match(appSource, /workspaceClient\.deleteSelectValue/);
  assert.match(appSource, /workspaceClient\.reorderSelectValues/);
  assert.match(appSource, /workspaceFloatingDismissToken/);
  assert.match(appSource, /function dismissWorkspaceFloatingMenus/);
  assert.match(appSource, /setWorkspaceFloatingDismissToken\(\(currentToken\) => currentToken \+ 1\)/);
  assert.match(appSource, /dismissSignal=\{workspaceFloatingDismissToken\}/);
  assert.match(appSource, /onDismissFloatingMenus=\{dismissWorkspaceFloatingMenus\}/);
  assert.match(appSource, /onActiveViewChange/);
  assert.match(viewTabsSource, /onCreateView/);
  assert.match(viewTabsSource, /onRenameView/);
  assert.match(viewTabsSource, /onDeleteView/);
  assert.match(viewTabsSource, /dismissSignal/);
  assert.match(viewTabsSource, /WorkspaceViewFilterMenu/);
  assert.match(viewTabsSource, /dismissSignal=\{dismissSignal\}/);
  assert.match(viewTabsSource, /onTogglePropertyVisibility/);
  assert.match(viewTabsSource, /onToggleValueFilter/);
  assert.match(viewTabsSource, /onRenameProperty/);
  assert.match(viewTabsSource, /onDeleteProperty/);
  assert.match(viewTabsSource, /statusValues/);
  assert.match(appSource, /statusValues=\{statusValues\}/);
  assert.match(viewFilterMenuSource, /WorkspaceViewFilterMenu/);
  assert.match(viewFilterMenuSource, /dismissSignal/);
  assert.match(viewFilterMenuSource, /const \[open, setOpen\] = useState\(false\)/);
  assert.match(viewFilterMenuSource, /setOpen\(false\)/);
  assert.match(viewFilterMenuSource, /setActionsPropertyId\(null\)/);
  assert.match(viewFilterMenuSource, /open=\{open\}/);
  assert.match(viewFilterMenuSource, /onOpenChange=\{setOpen\}/);
  assert.match(viewFilterMenuSource, /Visible properties/);
  assert.match(viewFilterMenuSource, /Value filters/);
  assert.match(viewFilterMenuSource, /statusValues/);
  assert.match(viewFilterMenuSource, /property\.id === "property:status"/);
  assert.match(viewFilterMenuSource, /expandedFilterPropertyIds/);
  assert.match(viewFilterMenuSource, /ChevronDownIcon/);
  assert.match(viewFilterMenuSource, /ChevronRightIcon/);
  assert.match(viewFilterMenuSource, /grid-cols-\[auto_minmax\(0,1fr\)_minmax\(5\.75rem,auto\)_1\.75rem\]/);
  assert.match(viewFilterMenuSource, /max-h-52 gap-0\.5/);
  assert.match(viewFilterMenuSource, /py-0\.5 text-sm/);
  assert.match(viewFilterMenuSource, /className="h-6 min-w-0"/);
  assert.match(viewFilterMenuSource, /max-h-60 gap-1/);
  assert.match(viewFilterMenuSource, /Checkbox/);
  assert.match(viewFilterMenuSource, /valueVisibility/);
  assert.match(viewFilterMenuSource, /MoreHorizontalIcon/);
  assert.match(viewFilterMenuSource, /actionsPropertyId/);
  assert.match(viewFilterMenuSource, /Popover/);
  assert.match(viewFilterMenuSource, /PopoverContent/);
  assert.match(viewFilterMenuSource, /data-workspace-actions-popover/);
  assert.match(viewFilterMenuSource, /side="right"/);
  assert.doesNotMatch(viewFilterMenuSource, /DropdownMenuSub/);
  assert.doesNotMatch(viewFilterMenuSource, /ml-7 mr-1 mb-1/);
  assert.match(viewFilterMenuSource, /Rename property/);
  assert.match(viewFilterMenuSource, /Delete property/);
  assert.match(viewFilterMenuSource, /editingPropertyId/);
  assert.match(viewFilterMenuSource, /onRenameProperty/);
  assert.match(viewFilterMenuSource, /onDeleteProperty/);
  assert.match(viewTabsSource, /DropdownMenu/);
  assert.match(viewTabsSource, /Rename View/);
  assert.match(viewTabsSource, /Delete View/);
  assert.match(viewTabsSource, /editingViewId/);
  assert.match(viewTabsSource, /aria-label="Rename view"/);
  assert.match(viewTabsSource, /rounded-xl bg-muted\/80/);
  assert.match(viewTabsSource, /group-data-horizontal\/tabs:!h-9/);
  assert.match(viewTabsSource, /text-sm font-medium/);
  assert.doesNotMatch(viewTabsSource, /justify-between gap-3 border-b border-border px-4 py-2\.5/);
  assert.match(viewTabsSource, /data-active:border-border/);
  assert.match(viewTabsSource, /data-active:bg-background/);
  assert.doesNotMatch(viewTabsSource, /text-base font-semibold/);
  assert.match(viewTabsSource, /min-w-44/);
  assert.match(viewTabsSource, /onContextMenu/);
  assert.match(viewTabsSource, /contextMenuViewId/);
  assert.doesNotMatch(leftPanelSource, /window\.prompt/);
  assert.doesNotMatch(viewTabsSource, /window\.prompt/);
  assert.doesNotMatch(viewTabsSource, /\bcapitalize\b/);
  assert.match(boardViewSource, /onProjectOpen/);
  assert.match(boardViewSource, /selectValues/);
  assert.match(boardViewSource, /formatPropertyValue/);
  assert.match(boardViewSource, /auto-cols-\[minmax\(20rem,1fr\)\]/);
  assert.match(boardViewSource, /min-h-24/);
  assert.match(boardViewSource, /flex h-full min-h-0 w-full flex-col overflow-hidden/);
  assert.match(boardViewSource, /pl-4 pr-0 pt-4 pb-0/);
  assert.match(boardViewSource, /min-h-0 flex-1 overflow-x-auto overflow-y-hidden/);
  assert.match(boardViewSource, /w-full/);
  assert.doesNotMatch(boardViewSource, /py-4/);
  assert.doesNotMatch(boardViewSource, /pb-2/);
  assert.doesNotMatch(boardViewSource, /pr-4/);
  assert.doesNotMatch(boardViewSource, /Cards are read-only across status columns/);
  assert.doesNotMatch(boardViewSource, /currentRelativePath/);
  assert.match(tableViewSource, /onProjectOpen/);
  assert.match(tableViewSource, /selectValues/);
  assert.match(tableViewSource, /formatPropertyValue/);
  assert.match(tableViewSource, /property\.id === "property:status"/);
  assert.match(tableViewSource, /backendProject\.folderStatus/);
  assert.match(tableViewSource, /renderTableStatusValue/);
  assert.match(tableViewSource, /className="h-6 max-w-full cursor-default select-none gap-1\.5 rounded-md border border-border\/50 bg-secondary\/70 px-2 text-\[13px\] font-medium"/);
  assert.match(tableViewSource, /rounded-lg border border-border\/45 bg-background\/15/);
  assert.match(tableViewSource, /sticky top-0 z-20 bg-background\/95/);
  assert.match(tableViewSource, /const tableColumnDividerClassName = "shadow-\[inset_-1px_0_0_var\(--border\)\]";/);
  assert.match(tableViewSource, /group\/column relative cursor-default select-none bg-background\/95 px-1/);
  assert.doesNotMatch(tableViewSource, /after:pointer-events-none after:absolute after:inset-y-0 after:right-0/);
  assert.match(tableViewSource, /<TableBody className="\[\&_tr:last-child\]:!border-b \[\&_tr:last-child\]:!border-border\/45">/);
  assert.match(tableViewSource, /bg-muted-foreground\/70/);
  assert.match(tableViewSource, /onCreateProperty/);
  assert.match(appSource, /createClientDocumentId\("property"\)/);
  assert.match(tableViewSource, /onRenameProperty/);
  assert.match(tableViewSource, /onDeleteProperty/);
  assert.match(tableViewSource, /onReorderViewProperties/);
  assert.match(tableViewSource, /onTogglePropertyVisibility/);
  assert.match(tableViewSource, /readonly view: WorkspaceViewState \| null;/);
  assert.match(tableViewSource, /readonly statusValues: WorkspaceProjectionResponse\["statusValues"\];/);
  assert.match(tableViewSource, /readonly onToggleValueFilter: \(propertyId: string, valueId: string, included: boolean\) => void;/);
  assert.match(tableViewSource, /function isFilterableProperty/);
  assert.match(tableViewSource, /function getFilterValues/);
  assert.match(tableViewSource, /function hasActiveValueFilter/);
  assert.match(tableViewSource, /ListFilterIcon/);
  assert.match(tableViewSource, /\$\{property\.name\} value filter active/);
  assert.match(tableViewSource, /hasActiveValueFilter\(property\.id, valueVisibility\)/);
  assert.match(lucideIconsSource, /ListFilterIcon/);
  assert.match(lucideIconsSource, /lucide-react\/dist\/esm\/icons\/list-filter\.mjs/);
  assert.match(tableViewSource, /Value filters/);
  assert.match(tableViewSource, /No values/);
  assert.match(tableViewSource, /data-workspace-property-menu="true"/);
  assert.match(tableViewSource, /data-workspace-property-menu-trigger="true"/);
  assert.match(tableViewSource, /closePropertyMenuOnOutsidePointerDown/);
  assert.match(tableViewSource, /from "react-dom"/);
  assert.match(tableViewSource, /createPortal/);
  assert.match(tableViewSource, /propertyMenuAnchor/);
  assert.match(tableViewSource, /className="fixed z-50 w-52/);
  assert.match(tableViewSource, /style=\{\{ left: propertyMenuAnchor\.left, top: propertyMenuAnchor\.top \}\}/);
  assert.doesNotMatch(tableViewSource, /PopoverContent/);
  assert.doesNotMatch(tableViewSource, /DropdownMenuCheckboxItem/);
  assert.match(tableViewSource, /import \{ Checkbox \} from "@\/components\/ui\/checkbox";/);
  assert.doesNotMatch(tableViewSource, /suppressNextPropertyMenuCloseRef/);
  assert.match(tableViewSource, /grid-cols-\[auto_minmax\(0,1fr\)\] items-center gap-2 rounded-md px-1 py-0\.5 text-sm hover:bg-muted\/40/);
  assert.match(tableViewSource, /<Checkbox[\s\S]*checked=\{filterValueChecked\}/);
  assert.match(tableViewSource, /onCheckedChange=\{\(value\) => onToggleValueFilter\(property\.id, filterValue\.id, value === true\)\}/);
  assert.match(tableViewSource, /const selectedValueIds = new Set\(valueVisibility\[property\.id\]\?\.valueIds \|\| \[\]\);/);
  assert.match(tableViewSource, /Add property column/);
  assert.match(tableViewSource, /Add property/);
  assert.match(tableViewSource, /createPropertyFromType/);
  assert.match(tableViewSource, /propertyTypeOptions\.map/);
  assert.match(tableViewSource, /DropdownMenuLabel/);
  assert.match(tableViewSource, /DropdownMenuGroup/);
  assert.match(tableViewSource, /renderPropertyTypeIcon/);
  assert.match(tableViewSource, /Short notes or free text/);
  assert.match(tableViewSource, /Numeric values and counts/);
  assert.match(tableViewSource, /Hide from view/);
  assert.match(tableViewSource, /Delete property/);
  assert.doesNotMatch(tableViewSource, /newPropertyName/);
  assert.doesNotMatch(tableViewSource, /newPropertyType/);
  assert.doesNotMatch(tableViewSource, /New property name/);
  assert.doesNotMatch(tableViewSource, /New property type/);
  assert.match(tableViewSource, /ProjectTablePropertyValueEditor/);
  assert.match(tableViewSource, /WorkspaceSelectValueEditor/);
  assert.match(tableViewSource, /WorkspaceDateValueEditor/);
  assert.match(tableViewSource, /isEditableProperty/);
  assert.match(tableViewSource, /onProjectPropertyValueChange/);
  assert.match(appSource, /workspaceClient\.updateProjectPropertyValue/);
  assert.match(tableViewSource, /editingCellId/);
  assert.match(tableViewSource, /startCellEditing/);
  assert.match(tableViewSource, /openAddPropertyMenu/);
  assert.match(tableViewSource, /dropdownDismissToken/);
  assert.match(tableViewSource, /onDismissFloatingMenus/);
  assert.match(tableViewSource, /function blurActiveEditingCell/);
  assert.match(tableViewSource, /function dismissHeaderTransientState/);
  assert.match(tableViewSource, /document\.activeElement/);
  assert.match(tableViewSource, /activeElement\.blur\(\)/);
  assert.match(tableViewSource, /setOpenPropertyMenuId\(null\)/);
  assert.match(tableViewSource, /setOpenAddPropertyMenu\(false\)/);
  assert.match(tableViewSource, /setDropdownDismissToken/);
  assert.match(tableViewSource, /onDismissFloatingMenus\(\)/);
  assert.match(tableViewSource, /onPointerDownCapture=\{dismissHeaderTransientState\}/);
  assert.match(tableViewSource, /dismissSignal=\{dropdownDismissToken\}/);
  assert.match(tableViewSource, /open=\{openAddPropertyMenu\}/);
  assert.match(tableViewSource, /workspace-table-cell-display/);
  assert.match(tableViewSource, /autoFocus/);
  assert.match(tableViewSource, /openProjectFromNameCell/);
  assert.match(tableViewSource, /property\.id === "property:name"/);
  assert.doesNotMatch(tableViewSource, /label \|\| "Empty"/);
  assert.doesNotMatch(tableViewSource, /role="button"/);
  assert.doesNotMatch(tableViewSource, /onClick=\{\(\) => onProjectOpen\(project\)\}/);
  assert.doesNotMatch(tableViewSource, /hover:bg-muted\/50 focus-visible:border-ring focus-visible:bg-background/);
  assert.doesNotMatch(tableViewSource, /type="date"/);
  assert.match(tableViewSource, /onPointerDown=\{stopCellActivation\}/);
  assert.match(appSource, /onProjectPropertyValueChange=\{handleProjectPropertyValueChange\}/);
  assert.match(appSource, /"property:name"/);
  assert.match(appSource, /"property:status"/);
  assert.doesNotMatch(tableViewSource, /draggable/);
  assert.doesNotMatch(tableViewSource, /startColumnDrag/);
  assert.match(tableViewSource, /startPointerColumnDrag/);
  assert.match(tableViewSource, /columnDrag/);
  assert.match(tableViewSource, /columnDragPreviewColumns/);
  assert.match(tableViewSource, /getColumnHeaderDragStyle/);
  assert.match(tableViewSource, /findColumnDropIndex/);
  assert.match(tableViewSource, /getColumnDragOrder/);
  assert.match(tableViewSource, /getColumnDragLefts/);
  assert.match(tableViewSource, /requestAnimationFrame/);
  assert.match(tableViewSource, /cancelAnimationFrame/);
  assert.doesNotMatch(tableViewSource, /findColumnDragTargetFromPoint/);
  assert.doesNotMatch(tableViewSource, /document\.elementsFromPoint/);
  assert.match(tableViewSource, /pointerEvents: "none"/);
  assert.match(tableViewSource, /transition-transform ease-out/);
  assert.match(tableViewSource, /onContextMenu/);
  assert.match(tableViewSource, /openPropertyMenuId/);
  assert.match(tableViewSource, /data-property-column-id/);
  assert.match(tableViewSource, /Drag \$\{property\.name\} column/);
  assert.match(tableViewSource, /onPointerDown=\{\(event\) => startPointerColumnDrag\(event, property\.id\)\}/);
  assert.doesNotMatch(tableViewSource, /GripVerticalIcon className="size-3\.5"/);
  assert.doesNotMatch(tableViewSource, /absolute left-1 top-1\/2/);
  assert.match(tableViewSource, /opacity-0/);
  assert.match(tableViewSource, /group-hover\/column:opacity-100/);
  assert.match(tableViewSource, /group-focus-within\/column:opacity-100/);
  assert.match(tableViewSource, /data-\[state=open\]:opacity-100/);
  assert.doesNotMatch(tableViewSource, /onDragOver/);
  assert.doesNotMatch(tableViewSource, /onDrop/);
  assert.match(tableViewSource, /colgroup/);
  assert.match(tableViewSource, /table-fixed/);
  assert.match(tableViewSource, /visiblePropertyWidths/);
  assert.match(tableViewSource, /className="min-w-full table-fixed"/);
  assert.match(tableViewSource, /style=\{\{ minWidth: tableWidth \}\}/);
  assert.match(tableViewSource, /<col aria-label="Add property filler column" \/>/);
  assert.match(tableViewSource, /Resize \$\{property\.name\} column/);
  assert.match(tableViewSource, /cursor-col-resize/);
  assert.match(tableViewSource, /clampPropertyColumnWidth/);
  assert.match(tableViewSource, /className="h-7 w-full min-w-0 rounded-md px-1\.5 text-sm"/);
  assert.doesNotMatch(tableViewSource, /min-w-36/);
  assert.match(tableViewSource, /hiddenViewProperties/);
  assert.doesNotMatch(tableViewSource, /GripVerticalIcon/);
  assert.doesNotMatch(tableViewSource, /rowHandleColumnWidth/);
  assert.doesNotMatch(tableViewSource, /aria-label="Row reorder"/);
  assert.match(tableViewSource, /PlusIcon/);
  assert.match(tableViewSource, /className="h-10 hover:bg-accent\/15"/);
  assert.doesNotMatch(tableViewSource, /cursor-pointer/);
  assert.match(tableViewSource, /function getBodyCellClassName/);
  assert.match(tableViewSource, /return `h-10 \$\{tableColumnDividerClassName\} p-0\.5`;/);
  assert.match(tableViewSource, /\? `h-10 \$\{tableColumnDividerClassName\} p-0\.5`/);
  assert.match(tableViewSource, /: `h-10 \$\{tableColumnDividerClassName\} truncate px-3 py-0`;/);
  assert.match(tableViewSource, /className=\{getBodyCellClassName\(property, editable\)\}/);
  assert.match(tableViewSource, /workspace-table-cell-display flex h-8/);
  assert.match(tableViewSource, /className="flex h-8 w-full min-w-0 items-center justify-start rounded-md px-2 text-left font-medium text-foreground transition-colors hover:bg-muted\/60 focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring\/30"/);
  assert.doesNotMatch(tableViewSource, /className="flex h-10 w-full/);
  assert.match(tableViewSource, /flex h-full min-h-0 w-full flex-col overflow-hidden/);
  assert.match(tableViewSource, /px-4 pb-0 pt-4/);
  assert.match(tableViewSource, /min-h-0 w-full flex-1 overflow-auto/);
  assert.match(tableViewSource, /w-full/);
  assert.match(tableViewSource, /rounded-lg border border-border\/45/);
  assert.match(viewFilterMenuSource, /Customize Columns/);
  assert.match(viewFilterMenuSource, /ChevronDownIcon data-icon="inline-end"/);
  assert.match(viewTabsSource, /from "@\/components\/ui\/button"/);
  assert.match(viewTabsSource, /Add View/);
  assert.match(viewTabsSource, /PlusIcon data-icon="inline-start"/);
  assert.doesNotMatch(tableViewSource, /sticky right-0/);
  assert.doesNotMatch(tableViewSource, /currentRelativePath/);
  assert.doesNotMatch(tableViewSource, />Path<\/TableHead>/);
  assert.doesNotMatch(tableViewSource, /py-4/);
  assert.match(projectDetailPanelSource, /WorkspaceProjectDetailPanel/);
  assert.match(projectDetailPanelSource, /panelProject/);
  assert.match(projectDetailPanelSource, /panelVisible/);
  assert.match(projectDetailPanelSource, /setPanelVisible\(false\)/);
  assert.match(projectDetailPanelSource, /setPanelVisible\(true\)/);
  assert.match(projectDetailPanelSource, /requestAnimationFrame/);
  assert.match(projectDetailPanelSource, /cancelAnimationFrame/);
  assert.match(projectDetailPanelSource, /projectDetailPanelAnimationMs/);
  assert.match(projectDetailPanelSource, /onTransitionEnd/);
  assert.match(projectDetailPanelSource, /if \(!panelProject\) \{\s+return null;\s+\}/);
  assert.match(projectDetailPanelSource, /electron-window-no-drag/);
  assert.match(projectDetailPanelSource, /projectDetailPanelWidth/);
  assert.match(projectDetailPanelSource, /localStorage/);
  assert.match(projectDetailPanelSource, /Resize project panel/);
  assert.match(projectDetailPanelSource, /onPointerDown/);
  assert.match(projectDetailPanelSource, /function closeProjectDetails/);
  assert.match(projectDetailPanelSource, /onPointerDown=\{closeProjectDetails\}/);
  assert.match(projectDetailPanelSource, /onClick=\{closeProjectDetails\}/);
  assert.match(projectDetailPanelSource, /Close project details backdrop/);
  assert.match(projectDetailPanelSource, /stopPropagation/);
  assert.match(projectDetailPanelSource, /transition-transform/);
  assert.match(projectDetailPanelSource, /duration-\[360ms\]/);
  assert.match(projectDetailPanelSource, /panelVisible \? "translate-x-0" : "translate-x-full"/);
  assert.doesNotMatch(projectDetailPanelSource, /transition-\[transform,opacity\]/);
  assert.doesNotMatch(projectDetailPanelSource, /panelVisible \? "opacity-100" : "opacity-0"/);
  assert.match(projectDetailPanelSource, /translate-x-full/);
  assert.doesNotMatch(projectDetailPanelSource, /SheetContent/);
  assert.doesNotMatch(projectDetailPanelSource, /project-identity-heading/);
  assert.doesNotMatch(projectDetailPanelSource, /displayedProject\.currentRelativePath/);
  assert.doesNotMatch(projectDetailPanelSource, /<Badge variant="outline">\{displayedProject\.status\.name\}<\/Badge>/);
  assert.doesNotMatch(projectDetailPanelSource, /detailProperties/);
  assert.doesNotMatch(projectDetailPanelSource, /property\.id !== "property:name"/);
  assert.doesNotMatch(projectDetailPanelSource, /property\.id !== "property:status"/);
  assert.match(projectDetailPanelSource, /visibleProperties\.map/);
  assert.match(projectDetailPanelSource, /property\.id === "property:name"/);
  assert.match(projectDetailPanelSource, /property\.id === "property:status"/);
  assert.match(projectDetailPanelSource, /expandedFolderIds/);
  assert.match(projectDetailPanelSource, /toggleProjectFileFolder/);
  assert.match(projectDetailPanelSource, /aria-expanded=\{isFolder \? isExpanded : undefined\}/);
  assert.match(projectDetailPanelSource, /isFolder && isExpanded && node\.children/);
  assert.match(projectDetailPanelSource, /projectDetailPropertiesGridTemplateColumns/);
  assert.match(projectDetailPanelSource, /getFileTreeNodeIconClassName/);
  assert.match(projectDetailPanelSource, /rounded-md border border-border\/45 bg-background\/15/);
  assert.match(projectDetailPanelSource, /grid-cols-\[2rem_minmax\(0,1fr\)\]/);
  assert.match(projectDetailPanelSource, /border-r border-border\/45/);
  assert.match(projectDetailPanelSource, /border-b border-border\/45/);
  assert.match(projectDetailPanelSource, /className="h-8 w-full justify-start px-1\.5 py-0 text-left/);
  assert.match(projectDetailPanelSource, /text-amber-300/);
  assert.match(projectDetailPanelSource, /text-emerald-300/);
  assert.match(projectDetailPanelSource, /text-rose-300/);
  assert.match(projectDetailPanelSource, /text-sky-300/);
  assert.match(projectDetailPanelSource, /text-sm font-normal/);
  assert.match(projectDetailPanelSource, /<ul className="grid gap-0">/);
  assert.doesNotMatch(projectDetailPanelSource, /uppercase tracking-wide/);
  assert.doesNotMatch(projectDetailPanelSource, /block truncate text-xs font-normal text-muted-foreground">\{node\.relativePath\}<\/span>/);
  assert.match(projectDetailPanelSource, /ChevronRightIcon/);
  assert.match(projectDetailPanelSource, /ChevronDownIcon/);
  assert.match(projectDetailPanelSource, /Properties/);
  assert.match(projectDetailPanelSource, /File tree/);
  assert.match(projectDetailPanelSource, /Hidden properties/);
  assert.match(projectDetailPanelSource, /hiddenCardProperties/);
  assert.match(projectDetailPanelSource, /Hidden properties[\s\S]*<dl className="overflow-hidden rounded-md border border-border\/45 bg-background\/15">/);
  assert.match(projectDetailPanelSource, /hiddenCardProperties\.map[\s\S]*border-b border-border\/45[\s\S]*last:border-b-0/);
  assert.match(projectDetailPanelSource, /hiddenCardProperties\.map[\s\S]*ProjectPropertyValueEditor/);
  assert.doesNotMatch(projectDetailPanelSource, /<span className="truncate">Hidden<\/span>/);
  assert.doesNotMatch(projectDetailPanelSource, /<Separator className="my-0" \/>/);
  assert.doesNotMatch(projectDetailPanelSource, /mt-2 border-t border-border\/70 pt-2/);
  assert.match(projectDetailPanelSource, /onRenameProperty/);
  assert.match(projectDetailPanelSource, /onHideProperty/);
  assert.match(projectDetailPanelSource, /onDeleteProperty/);
  assert.match(projectDetailPanelSource, /Rename property/);
  assert.match(projectDetailPanelSource, /Hide property/);
  assert.match(projectDetailPanelSource, /Delete property/);
  assert.match(projectDetailPanelSource, /property menu/);
  assert.match(projectDetailPanelSource, /FolderIcon/);
  assert.match(projectDetailPanelSource, /FileIcon/);
  assert.match(projectDetailPanelSource, /onOpenChange/);
  assert.match(projectDetailPanelSource, /ProjectPropertyValueEditor/);
  assert.match(projectDetailPanelSource, /ProjectPropertyValueDisplay/);
  assert.match(projectDetailPanelSource, /editingPropertyId/);
  assert.match(projectDetailPanelSource, /cardPropertyOrderStorageKey/);
  assert.match(projectDetailPanelSource, /orderedVisibleProperties/);
  assert.match(projectDetailPanelSource, /startCardPropertyDrag/);
  assert.match(projectDetailPanelSource, /getCardPropertyDragPreviewRows/);
  assert.match(projectDetailPanelSource, /getCardPropertyDragStyle/);
  assert.match(projectDetailPanelSource, /requestAnimationFrame/);
  assert.match(projectDetailPanelSource, /transitionDuration: "180ms"/);
  assert.match(projectDetailPanelSource, /transform: `translateY/);
  assert.match(projectDetailPanelSource, /onReorderCardProperties/);
  assert.match(projectDetailPanelSource, /GripVerticalIcon/);
  assert.match(projectDetailPanelSource, /cursor-grab/);
  assert.match(projectDetailPanelSource, /openActionsOnClick/);
  assert.match(projectDetailPanelSource, /cardPropertyPressMoved/);
  assert.match(projectDetailPanelSource, /suppressCardPropertyClickRef/);
  assert.match(projectDetailPanelSource, /openCardPropertyMenu/);
  assert.match(popoverSource, /PopoverAnchor/);
  assert.match(projectDetailPanelSource, /PopoverAnchor asChild/);
  assert.match(projectDetailPanelSource, /PopoverContent/);
  assert.doesNotMatch(projectDetailPanelSource, /DropdownMenuTrigger asChild/);
  assert.match(projectDetailPanelSource, /setPropertyActionsId\(propertyId\)/);
  assert.match(projectDetailPanelSource, /closePropertyMenuBeforeAction/);
  assert.match(projectDetailPanelSource, /aria-label=\{`Open \$\{property\.name\} property menu`\}\s+className="[^"]*cursor-grab[^"]*"\s+onPointerDown=\{\(event\) =>\s*\(\s*startCardPropertyDrag\(event, property\.id, \{ openActionsOnClick: true \}\)\s*\)\}/);
  assert.match(projectDetailPanelSource, /onClick=\{\(event\) => \{\s*event\.preventDefault\(\);[\s\S]*suppressCardPropertyClickRef[\s\S]*openCardPropertyMenu\(property\.id\);/);
  assert.match(projectDetailPanelSource, /role="menu"/);
  assert.match(projectDetailPanelSource, /role="menuitem"/);
  assert.match(projectDetailPanelSource, /Open \$\{property\.name\} property menu/);
  assert.doesNotMatch(projectDetailPanelSource, /MoreHorizontalIcon/);
  assert.match(projectDetailPanelSource, /card property order/);
  assert.match(projectDetailPanelSource, /WorkspaceSelectValueEditor/);
  assert.match(projectDetailPanelSource, /onColorSelectValue/);
  assert.match(projectDetailPanelSource, /WorkspaceDateValueEditor/);
  assert.match(projectDetailPanelSource, /property\.propertyType === "text"/);
  assert.match(projectDetailPanelSource, /property\.propertyType === "number"/);
  assert.match(projectDetailPanelSource, /property\.propertyType === "date"/);
  assert.match(projectDetailPanelSource, /property\.propertyType === "select"/);
  assert.match(projectDetailPanelSource, /property\.propertyType === "multi-select"/);
  assert.match(projectDetailPanelSource, /type="number"/);
  assert.doesNotMatch(projectDetailPanelSource, /type="date"/);
  assert.match(projectDetailPanelSource, /onProjectPropertyValueChange/);
  assert.match(appSource, /handleProjectPropertyValueChange/);
  assert.match(appSource, /workspaceClient\.updateProjectPropertyValue/);
  assert.match(appSource, /projectPropertyValueUpdated/);
  assert.match(appSource, /propertySaveFailed/);
  assert.match(appSource, /handleTogglePropertyVisibility/);
  assert.match(appSource, /handleToggleValueFilter/);
  assert.match(appSource, /handleCreateVisibleProperty/);
  assert.match(appSource, /handleReorderViewProperties/);

  assert.match(selectValueEditorSource, /WorkspaceSelectValueEditor/);
  assert.match(selectValueEditorSource, /useEffect/);
  assert.match(selectValueEditorSource, /dismissSignal/);
  assert.match(selectValueEditorSource, /setOpen\(false\)/);
  assert.match(selectValueEditorSource, /setActionsSelectValueId\(null\)/);
  assert.match(selectValueEditorSource, /Search values/);
  assert.match(selectValueEditorSource, /Clear selection/);
  assert.match(selectValueEditorSource, /Create/);
  assert.match(selectValueEditorSource, /onCreateSelectValue/);
  assert.match(selectValueEditorSource, /onRenameSelectValue/);
  assert.match(selectValueEditorSource, /onDeleteSelectValue/);
  assert.match(selectValueEditorSource, /onColorSelectValue/);
  assert.match(selectValueEditorSource, /valueColorOptions/);
  assert.match(selectValueEditorSource, /Color/);
  assert.match(selectValueEditorSource, /DropdownMenuCheckboxItem/);
  assert.match(selectValueEditorSource, /actionsSelectValueId/);
  assert.match(selectValueEditorSource, /Popover/);
  assert.match(selectValueEditorSource, /PopoverContent/);
  assert.match(selectValueEditorSource, /data-workspace-actions-popover/);
  assert.match(selectValueEditorSource, /side="right"/);
  assert.doesNotMatch(selectValueEditorSource, /DropdownMenuSub/);
  assert.doesNotMatch(selectValueEditorSource, /mx-1 mb-1/);
  assert.doesNotMatch(selectValueEditorSource, /onBlur=\{\(\) => commitRenameSelectValue/);
  assert.match(selectValueEditorSource, /MoreHorizontalIcon/);
  assert.match(selectValueEditorSource, /Rename value/);
  assert.match(selectValueEditorSource, /Delete value/);
  assert.match(selectValueEditorSource, /editingSelectValueId/);
  assert.match(selectValueEditorSource, /selectedValues/);
  assert.match(selectValueEditorSource, /setSearchQuery/);
  assert.match(selectValueEditorSource, /onValueChange\(createdValue\.id\)/);
  assert.match(selectValueEditorSource, /onValueChange\(nextValues\)/);
  assert.match(appSource, /onRenameSelectValue=\{handleRenameSelectValue\}/);
  assert.match(appSource, /onDeleteSelectValue=\{handleDeleteSelectValue\}/);
  assert.match(tableViewSource, /readonly onColorSelectValue: \(selectValueId: string, color: string\) => void;/);
  assert.match(tableViewSource, /onColorSelectValue,\s+onDeleteSelectValue,\s+\}: WorkspaceTableViewProps/);
  assert.match(tableViewSource, /onColorSelectValue=\{onColorSelectValue\}/);
  assert.match(appSource, /<WorkspaceTableView[\s\S]*view=\{activeView \?\? null\}/);
  assert.match(appSource, /<WorkspaceTableView[\s\S]*statusValues=\{statusValues\}/);
  assert.match(appSource, /<WorkspaceTableView[\s\S]*onToggleValueFilter=\{handleToggleValueFilter\}/);
  assert.match(appSource, /<WorkspaceTableView[\s\S]*onColorSelectValue=\{handleColorSelectValue\}/);
  const renamePropertyHandler = appSource.slice(
    appSource.indexOf("async function handleRenameProperty"),
    appSource.indexOf("async function handleHideProperty"),
  );
  const hidePropertyHandler = appSource.slice(
    appSource.indexOf("async function handleHideProperty"),
    appSource.indexOf("async function handleDeleteProperty"),
  );
  const deletePropertyHandler = appSource.slice(
    appSource.indexOf("async function handleDeleteProperty"),
    appSource.indexOf("async function handleReorderProperties"),
  );
  const renameSelectValueHandler = appSource.slice(
    appSource.indexOf("async function handleRenameSelectValue"),
    appSource.indexOf("async function handleColorSelectValue"),
  );
  assert.doesNotMatch(renamePropertyHandler, /setReloadToken/);
  assert.doesNotMatch(hidePropertyHandler, /setReloadToken/);
  assert.doesNotMatch(deletePropertyHandler, /setReloadToken/);
  assert.doesNotMatch(renameSelectValueHandler, /setReloadToken/);
  assert.match(workspaceAppStateSource, /viewPropertiesUpdated/);
  const selectValueActionsMarkup = selectValueEditorSource.slice(
    selectValueEditorSource.indexOf("role=\"menuitem\""),
    selectValueEditorSource.indexOf("{filteredValues.map"),
  );
  assert.ok(
    selectValueActionsMarkup.indexOf("Delete value") < selectValueActionsMarkup.indexOf("Color"),
    "select value actions should show rename, delete, then color controls",
  );

  assert.match(dateValueEditorSource, /WorkspaceDateValueEditor/);
  assert.match(dateValueEditorSource, /useEffect/);
  assert.match(dateValueEditorSource, /dismissSignal/);
  assert.match(dateValueEditorSource, /setOpen\(false\)/);
  assert.match(dateValueEditorSource, /Popover/);
  assert.match(dateValueEditorSource, /Pick date/);
  assert.match(dateValueEditorSource, /Clear date/);
  assert.match(dateValueEditorSource, /ChevronLeftIcon/);
  assert.match(dateValueEditorSource, /ChevronRightIcon/);
  assert.doesNotMatch(dateValueEditorSource, /type="date"/);
  assert.match(popoverSource, /@radix-ui\/react-popover/);

  assert.match(mainSource, /document\.documentElement\.classList\.add\("dark"\)/);
  assert.match(lucideIconsSource, /FolderKanbanIcon/);
  assert.match(lucideIconsSource, /FolderIcon/);
  assert.match(lucideIconsSource, /FileIcon/);
  assert.match(lucideIconsSource, /SearchIcon/);
  assert.match(lucideIconsSource, /SettingsIcon/);
  assert.doesNotMatch(lucideIconsSource, /from "lucide-react"/);
  assert.match(cssSource, /@import "shadcn\/tailwind\.css"/);
  assert.match(cssSource, /-webkit-app-region:\s*drag/);
  assert.match(cssSource, /workspace-number-input/);
  assert.match(cssSource, /-webkit-inner-spin-button/);
  assert.match(cssSource, /-moz-appearance:\s*textfield/);
  assert.match(cssSource, /::-webkit-scrollbar-thumb/);
});
