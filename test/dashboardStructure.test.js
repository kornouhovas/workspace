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
    textValueEditorSource,
    popoverSource,
    workspaceAppStateSource,
    buildRendererSource,
    disableFsEventsLoaderSource,
    lucideIconTypesSource,
    menuStylesSource,
    menuDismissalSource,
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
    readProjectFile("src/components/workspace/text-value-editor.tsx"),
    readProjectFile("src/components/ui/popover.tsx"),
    readProjectFile("src/workspaceAppState.ts"),
    readProjectFile("scripts/build-renderer.mjs"),
    readProjectFile("scripts/disable-fsevents-loader.mjs"),
    readProjectFile("src/types/lucide-react-icons.d.ts"),
    readProjectFile("src/components/workspace/menu-styles.ts"),
    readProjectFile("src/components/workspace/menu-dismissal.ts"),
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
  assert.match(lucideIconsSource, /lucide-react\/dist\/esm\/icons\/pencil\.mjs/);
  assert.match(lucideIconsSource, /lucide-react\/dist\/esm\/icons\/trash-2\.mjs/);
  assert.match(lucideIconsSource, /lucide-react\/dist\/esm\/icons\/eye-off\.mjs/);
  assert.match(lucideIconsSource, /lucide-react\/dist\/esm\/icons\/eye\.mjs/);
  assert.match(lucideIconsSource, /lucide-react\/dist\/esm\/icons\/palette\.mjs/);
  assert.match(lucideIconsSource, /lucide-react\/dist\/esm\/icons\/kanban\.mjs/);
  assert.match(lucideIconsSource, /lucide-react\/dist\/esm\/icons\/table\.mjs/);
  assert.match(lucideIconTypesSource, /lucide-react\/dist\/esm\/icons\/\*\.mjs/);
  assert.match(menuStylesSource, /workspaceMenuCheckboxClassName/);
  assert.match(menuStylesSource, /!size-3\.5/);
  assert.match(menuStylesSource, /!rounded-full/);
  assert.match(menuStylesSource, /\[&_\[data-slot=checkbox-indicator\]>svg\]:!size-2\.5/);
  assert.match(menuDismissalSource, /blockOutsideWorkspaceMenuPointerDown/);
  assert.match(menuDismissalSource, /event\.preventDefault\(\)/);
  assert.match(menuDismissalSource, /event\.stopPropagation\(\)/);
  assert.match(menuDismissalSource, /document\.addEventListener\("click"/);
  assert.match(menuDismissalSource, /window\.setTimeout/);
  assert.match(menuDismissalSource, /dismiss\(\)/);

  for (const menuSource of [
    leftPanelSource,
    viewTabsSource,
    tableViewSource,
    viewFilterMenuSource,
    selectValueEditorSource,
    projectDetailPanelSource,
  ]) {
    assert.match(menuSource, /from "@\/components\/workspace\/menu-styles"/);
    assert.match(menuSource, /workspaceMenuContentClassName/);
    assert.match(menuSource, /workspaceMenuItemClassName/);
    assert.match(menuSource, /workspaceMenuIconClassName/);
  }

  assert.match(appSource, /from "@\/components\/workspace\/left-panel"/);
  assert.match(appSource, /useI18n/);
  assert.doesNotMatch(appSource, /t\("app\.title"\)/);
  assert.match(appSource, /<WorkspaceLeftPanel/);
  assert.match(appSource, /WorkspaceBoardView/);
  assert.match(appSource, /WorkspaceTableView/);
  assert.doesNotMatch(boardViewSource, /workspace-board-heading/);
  assert.doesNotMatch(tableViewSource, /workspace-table-heading/);
  assert.doesNotMatch(boardViewSource, /Status columns are fixed for the MVP/);
  assert.doesNotMatch(tableViewSource, /Rows use the same project set as the Board projection/);
  assert.match(appSource, /WorkspaceViewTabs/);
  assert.match(appSource, /electron-window-drag flex h-\[var\(--workspace-header-height\)\] shrink-0 items-center gap-2 border-b border-border/);
  assert.doesNotMatch(appSource, /projectExpanded \? "h-\[113px\]" : "h-24"/);
  assert.match(appSource, /WorkspaceSplitTree/);
  assert.match(appSource, /WorkspaceSettingsView/);
  assert.match(appSource, /handleSelectFolder/);
  assert.match(appSource, /loadRequestIdRef/);
  assert.match(appSource, /folderSelectionPendingRef/);
  assert.match(appSource, /workspaceIdRef/);
  assert.match(appSource, /workspaceIdRef\.current === root\.workspaceId/);
  assert.doesNotMatch(appSource, /workspacePreview/);
  assert.doesNotMatch(appSource, /isWorkspaceSwitchPreview/);
  assert.match(appSource, /projectionIsStaleWorkspaceSurface/);
  assert.match(appSource, /isWorkspaceSwitchPendingSurface/);
  assert.match(appSource, /pointer-events-none select-none/);
  assert.doesNotMatch(appSource, /transition-\[opacity,transform\]/);
  assert.match(appSource, /loadWorkspaceList/);
  assert.match(appSource, /rootSelected/);
  assert.match(appSource, /handleCreateView/);
  assert.match(appSource, /handleRenameView/);
  assert.match(appSource, /handleDeleteView/);
  assert.match(appSource, /handleReorderViews/);
  assert.match(appSource, /workspaceClient\.reorderViews/);
  assert.match(appSource, /onReorderViews=\{handleReorderViews\}/);
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
  assert.match(appSource, /const shouldUseMockViews = !state\.root && !state\.workspaceId/);
  assert.doesNotMatch(appSource, /searchQuery:\s*state\.searchQuery/);
  assert.doesNotMatch(appSource, /\[reloadToken, workspaceClient, state\.activeViewId, state\.searchQuery\]/);
  assert.match(appSource, /activeViewChanged/);
  assert.match(appSource, /workspaceClient\s*\.setActiveView/);
  assert.match(appSource, /isUnsupportedWorkspaceMethodError/);
  assert.match(appSource, /sidebarCollapsed/);
  assert.match(appSource, /PanelLeftIcon/);
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

  assert.match(leftPanelSource, /t\("sidebar\.addWorkspace"\)/);
  assert.match(leftPanelSource, /t\("sidebar\.search"\)/);
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
  assert.match(leftPanelSource, /aria-label=\{t\("sidebar\.renameWorkspaceInput"\)\}/);
  assert.match(leftPanelSource, /min-w-52/);
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
  assert.match(leftPanelSource, /t\("sidebar\.renameWorkspace"\)/);
  assert.match(leftPanelSource, /t\("sidebar\.deleteWorkspace"\)/);
  assert.match(leftPanelSource, /min-h-\[var\(--workspace-header-height\)\]/);
  assert.match(leftPanelSource, /onChange/);
  assert.match(leftPanelSource, /t\("sidebar\.workspaces"\)/);
  assert.match(leftPanelSource, /t\("sidebar\.settings"\)/);
  assert.match(leftPanelSource, /from "@\/lib\/workspace-icons"/);
  assert.match(statesSource, /t\("state\.noSourceTitle"\)/);
  assert.match(statesSource, /t\("state\.openSettings"\)/);
  assert.match(statesSource, /onOpenSettings/);
  assert.match(settingsViewSource, /WorkspaceSettingsView/);
  assert.match(settingsViewSource, /t\("settings\.sourceFolder"\)/);
  assert.match(settingsViewSource, /t\("settings\.selectFolder"\)/);
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
  assert.match(settingsViewSource, /statusValues=\{statusValues\}/);
  assert.match(settingsViewSource, /selectValues=\{selectValues\}/);
  assert.match(settingsViewSource, /onColorStatusValue/);
  assert.match(propertyControlsSource, /WorkspacePropertyControls/);
  assert.match(propertyControlsSource, /t\("settings\.statusValuesDescription"\)/);
  assert.match(propertyControlsSource, /t\("table\.status"\)/);
  assert.match(propertyControlsSource, /onColorStatusValue/);
  assert.match(propertyControlsSource, /<Select/);
  assert.match(propertyControlsSource, /Color/);
  assert.match(propertyControlsSource, /valueColorOptions/);
  assert.doesNotMatch(propertyControlsSource, /Add property/);
  assert.doesNotMatch(propertyControlsSource, /Property name/);
  assert.doesNotMatch(propertyControlsSource, /Add select value/);
  assert.doesNotMatch(propertyControlsSource, /Rename select value/);
  assert.doesNotMatch(propertyControlsSource, /Delete select value/);
  assert.match(appSource, /workspaceClient\.createSelectValue/);
  assert.match(appSource, /normalizeSelectValue\(response\.selectValue/);
  assert.match(appSource, /workspaceClient\.updateStatusValueColor/);
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
  assert.match(viewTabsSource, /onReorderViews/);
  assert.match(viewTabsSource, /dismissSignal/);
  assert.match(viewTabsSource, /WorkspaceViewFilterMenu/);
  assert.match(viewTabsSource, /dismissSignal=\{dismissSignal\}/);
  assert.match(viewTabsSource, /onTogglePropertyVisibility/);
  assert.match(viewTabsSource, /onToggleValueFilter/);
  assert.match(viewTabsSource, /onReorderViewProperties/);
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
  assert.match(viewFilterMenuSource, /t\("view\.visibleProperties"\)/);
  assert.match(viewFilterMenuSource, /Columns3Icon className="size-4 text-muted-foreground"/);
  assert.match(viewFilterMenuSource, /h-6 min-w-6 justify-center rounded-full px-2/);
  assert.match(viewFilterMenuSource, /t\("view\.visiblePropertiesDescription"\)/);
  assert.match(viewFilterMenuSource, /t\("view\.valueFilters"\)/);
  assert.match(viewFilterMenuSource, /grid gap-1\.5/);
  assert.match(viewFilterMenuSource, /t\("view\.valueFiltersDescription"\)/);
  assert.match(viewFilterMenuSource, /statusValues/);
  assert.match(viewFilterMenuSource, /property\.id === "property:status"/);
  assert.match(viewFilterMenuSource, /expandedFilterPropertyIds/);
  assert.match(viewFilterMenuSource, /ChevronDownIcon/);
  assert.match(viewFilterMenuSource, /ChevronRightIcon/);
  assert.match(viewFilterMenuSource, /visiblePropertyRowClassName/);
  assert.match(viewFilterMenuSource, /workspace-customize-property-row/);
  assert.match(viewFilterMenuSource, /workspace-customize-property-action/);
  assert.match(viewFilterMenuSource, /function canRenameProperty/);
  assert.match(viewFilterMenuSource, /const canOpenActions = canRenameProperty\(property\) \|\| !required;/);
  assert.match(cssSource, /\.workspace-customize-property-row:has\(\.workspace-customize-property-action:hover\):hover/);
  assert.match(viewFilterMenuSource, /from "@\/workspaceDrag"/);
  assert.match(viewFilterMenuSource, /from "@\/components\/workspace\/menu-dismissal"/);
  assert.match(viewFilterMenuSource, /blockOutsideWorkspaceMenuPointerDown/);
  assert.match(viewFilterMenuSource, /data-workspace-view-filter-menu/);
  assert.match(viewFilterMenuSource, /reorderIdsByDropIndex/);
  assert.match(viewFilterMenuSource, /mergeFixedIdsWithReorderedIds/);
  assert.match(viewFilterMenuSource, /\.filter\(\(property\) => !isRequiredViewProperty\(property\.id\)\)/);
  assert.doesNotMatch(viewFilterMenuSource, /function getPropertyDragOrder/);
  assert.match(viewFilterMenuSource, /grid-cols-\[auto_minmax\(0,1fr\)_minmax\(5rem,auto\)_1\.5rem\]/);
  assert.match(viewFilterMenuSource, /max-h-52 gap-0\.5/);
  assert.match(viewFilterMenuSource, /visibleViewProperties/);
  assert.match(viewFilterMenuSource, /hiddenViewProperties/);
  assert.match(viewFilterMenuSource, /onReorderViewProperties/);
  assert.match(viewFilterMenuSource, /propertyDragState/);
  assert.match(viewFilterMenuSource, /data-view-property-row-id/);
  assert.match(viewFilterMenuSource, /startPointerPropertyDrag/);
  assert.match(viewFilterMenuSource, /propertyDragStartThreshold/);
  assert.match(viewFilterMenuSource, /dragStarted/);
  assert.match(viewFilterMenuSource, /startPropertyDragPreview/);
  assert.match(viewFilterMenuSource, /Math\.abs\(pointerEvent\.clientY - event\.clientY\) <= propertyDragStartThreshold/);
  assert.match(viewFilterMenuSource, /getPropertyDragPreviewRows/);
  assert.match(viewFilterMenuSource, /getPropertyDragStyle/);
  assert.match(viewFilterMenuSource, /requestAnimationFrame/);
  assert.match(viewFilterMenuSource, /transitionDuration: "180ms"/);
  assert.doesNotMatch(viewFilterMenuSource, /draggable=\{canDragProperty\}/);
  assert.doesNotMatch(viewFilterMenuSource, /onDragStart=\{\(event\) => handlePropertyDragStart/);
  assert.match(viewFilterMenuSource, /t\("view\.hiddenProperties"\)/);
  assert.doesNotMatch(viewFilterMenuSource, /variant="secondary"[\s\S]*>\s*Hidden\s*<\/Badge>/);
  assert.match(viewFilterMenuSource, /select-none/);
  assert.match(viewFilterMenuSource, /valueFilterGroupButtonClassName/);
  assert.match(viewFilterMenuSource, /valueFilterItemClassName/);
  assert.match(viewFilterMenuSource, /grid h-7 min-w-0 cursor-default select-none grid-cols-\[1rem_minmax\(0,1fr\)\] items-center gap-1\.5 rounded-lg px-1\.5 text-sm transition-colors hover:bg-accent\/55/);
  assert.match(viewFilterMenuSource, /className="h-6 min-w-0"/);
  assert.match(viewFilterMenuSource, /max-h-60 gap-1/);
  assert.match(viewFilterMenuSource, /<div className="grid gap-0\.5">/);
  assert.doesNotMatch(viewFilterMenuSource, /className="grid gap-0\.5 pl-6"/);
  assert.match(viewFilterMenuSource, /Checkbox/);
  assert.match(viewFilterMenuSource, /workspaceMenuCheckboxClassName/);
  assert.match(viewFilterMenuSource, /valueVisibility/);
  assert.match(viewFilterMenuSource, /MoreHorizontalIcon/);
  assert.match(viewFilterMenuSource, /actionsPropertyId/);
  assert.match(viewFilterMenuSource, /Popover/);
  assert.match(viewFilterMenuSource, /PopoverContent/);
  assert.match(viewFilterMenuSource, /data-workspace-actions-popover/);
  assert.match(viewFilterMenuSource, /side="right"/);
  assert.doesNotMatch(viewFilterMenuSource, /DropdownMenuSub/);
  assert.doesNotMatch(viewFilterMenuSource, /ml-7 mr-1 mb-1/);
  assert.match(viewFilterMenuSource, /t\("property\.rename"\)/);
  assert.match(viewFilterMenuSource, /t\("property\.hideFromView"\)/);
  assert.match(viewFilterMenuSource, /t\("property\.showInView"\)/);
  assert.match(viewFilterMenuSource, /t\("property\.delete"\)/);
  assert.match(viewFilterMenuSource, /function isRequiredViewProperty/);
  assert.match(viewFilterMenuSource, /propertyId === "property:name"/);
  assert.doesNotMatch(viewFilterMenuSource, /const disabled = isSystemProperty\(property\.id\)/);
  assert.match(viewFilterMenuSource, /editingPropertyId/);
  assert.match(viewFilterMenuSource, /onRenameProperty/);
  assert.match(viewFilterMenuSource, /onDeleteProperty/);
  assert.match(viewTabsSource, /DropdownMenu/);
  assert.match(viewTabsSource, /t\("view\.rename"\)/);
  assert.match(viewTabsSource, /t\("view\.delete"\)/);
  assert.match(viewTabsSource, /editingViewId/);
  assert.match(viewTabsSource, /aria-label=\{t\("view\.renameInput"\)\}/);
  assert.match(viewTabsSource, /workspace-tab-scroll/);
  // Tab pixel geometry follows pinned bb runtime; retain scrolling/selection behavior below.
  assert.match(viewTabsSource, /text-sm font-normal/);
  assert.doesNotMatch(viewTabsSource, /justify-between gap-3 border-b border-border px-4 py-2\.5/);
  assert.match(viewTabsSource, /data-active:border-transparent/);
  assert.match(viewTabsSource, /data-active:bg-accent/);
  assert.match(viewTabsSource, /renderViewIcon/);
  assert.match(viewTabsSource, /KanbanIcon/);
  assert.match(viewTabsSource, /TableIcon/);
  assert.match(viewTabsSource, /viewTabDragState/);
  assert.match(viewTabsSource, /data-view-tab-id/);
  assert.match(viewTabsSource, /startPointerViewTabDrag/);
  assert.match(viewTabsSource, /getViewTabDragPreviewItems/);
  assert.match(viewTabsSource, /getViewTabDragStyle/);
  assert.match(viewTabsSource, /getViewTabDragOrder/);
  assert.match(viewTabsSource, /requestAnimationFrame/);
  assert.match(viewTabsSource, /transitionDuration: "180ms"/);
  assert.doesNotMatch(viewTabsSource, /draggable=\{canDragView\}/);
  assert.doesNotMatch(viewTabsSource, /onDragStart=\{\(event\) => handleViewDragStart/);
  assert.doesNotMatch(viewTabsSource, /text-base font-semibold/);
  assert.match(viewTabsSource, /min-w-56/);
  assert.match(viewTabsSource, /onContextMenu/);
  assert.match(viewTabsSource, /contextMenuViewId/);
  assert.match(viewTabsSource, /function isViewContextMenuTarget/);
  assert.match(viewTabsSource, /from "@\/components\/workspace\/menu-dismissal"/);
  assert.match(viewTabsSource, /blockOutsideWorkspaceMenuPointerDown/);
  assert.match(viewTabsSource, /data-workspace-view-create-menu/);
  assert.doesNotMatch(viewTabsSource, /data-workspace-view-actions-menu/);
  assert.match(viewTabsSource, /closeViewContextMenuOnOutsidePointerDown/);
  assert.match(viewTabsSource, /document\.addEventListener\("pointerdown", closeViewContextMenuOnOutsidePointerDown, true\)/);
  assert.match(viewTabsSource, /data-workspace-view-context-menu="true"/);
  assert.doesNotMatch(viewTabsSource, /onMouseLeave=\{\(\) => setContextMenuViewId\(null\)\}/);
  assert.doesNotMatch(leftPanelSource, /window\.prompt/);
  assert.doesNotMatch(viewTabsSource, /window\.prompt/);
  assert.doesNotMatch(viewTabsSource, /\bcapitalize\b/);
  assert.match(boardViewSource, /onProjectOpen/);
  assert.match(boardViewSource, /selectValues/);
  assert.match(boardViewSource, /formatPropertyValue/);
  assert.match(boardViewSource, /renderBoardStatusValue/);
  assert.match(boardViewSource, /data-color=\{color\}/);
  assert.match(boardViewSource, /data-color=\{statusColor\}/);
  assert.match(boardViewSource, /"--workspace-board-column-width": `\$\{preferredColumnWidth\}px`/);
  assert.doesNotMatch(boardViewSource, /Math\.min\(preferredColumnWidth/);
  assert.match(boardViewSource, /gridAutoColumns: "var\(--workspace-board-column-width\)"/);
  assert.match(boardViewSource, /resizeObserver\.observe\(viewport\)/);
  assert.match(appSource, /columnWidth=\{activeView\?\.boardLayout\?\.columnWidth\}/);
  assert.match(appSource, /boardColumnWidthMax=\{getBoardColumnWidthMax\(boardViewportWidth\)\}/);
  assert.match(appSource, /onViewportWidthChange=\{setBoardViewportWidth\}/);
  assert.match(boardViewSource, /min-h-10/);
  assert.match(boardViewSource, /flex h-full min-h-0 w-full flex-col overflow-hidden/);
  assert.match(boardViewSource, /px-4 pb-4 pt-3/);
  assert.match(boardViewSource, /workspace-board-scroll min-h-0 flex-1 overflow-auto/);
  assert.doesNotMatch(boardViewSource, /overflow-y-auto/);
  assert.match(boardViewSource, /data-workspace-column-count/);
  assert.match(boardViewSource, /w-full/);
  assert.doesNotMatch(boardViewSource, /py-4/);
  assert.doesNotMatch(boardViewSource, /Cards are read-only across status columns/);
  assert.doesNotMatch(boardViewSource, /currentRelativePath/);
  assert.match(tableViewSource, /onProjectOpen/);
  assert.match(tableViewSource, /selectValues/);
  assert.match(tableViewSource, /formatPropertyValue/);
  assert.match(tableViewSource, /property\.id === "property:status"/);
  assert.match(tableViewSource, /backendProject\.folderStatus/);
  assert.match(tableViewSource, /renderTableStatusValue/);
  assert.match(tableViewSource, /className="workspace-table-cell-control flex h-8 w-full min-w-0 items-center justify-start rounded-md px-2 transition-colors"/);
  assert.match(tableViewSource, /className="workspace-table-value-chip h-6 max-w-full cursor-default select-none gap-1\.5 rounded-md border border-border\/50 bg-secondary\/70 px-2 text-xs font-normal"/);
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
  assert.match(tableViewSource, /function canRenameProperty/);
  assert.match(tableViewSource, /disabled=\{!canRenameProperty\(property\)\}/);
  assert.match(tableViewSource, /readonly view: WorkspaceViewState \| null;/);
  assert.match(tableViewSource, /readonly statusValues: WorkspaceProjectionResponse\["statusValues"\];/);
  assert.match(tableViewSource, /readonly onToggleValueFilter: \(propertyId: string, valueId: string, included: boolean\) => void;/);
  assert.match(tableViewSource, /function isFilterableProperty/);
  assert.match(tableViewSource, /function getFilterValues/);
  assert.match(tableViewSource, /function hasActiveValueFilter/);
  assert.match(tableViewSource, /function isRequiredViewProperty/);
  assert.match(tableViewSource, /propertyId === "property:name"/);
  assert.match(tableViewSource, /ListFilterIcon/);
  assert.match(tableViewSource, /hasActiveValueFilter\(property\.id, valueVisibility\)/);
  assert.match(lucideIconsSource, /ListFilterIcon/);
  assert.match(lucideIconsSource, /lucide-react\/dist\/esm\/icons\/list-filter\.mjs/);
  assert.match(tableViewSource, /t\("property\.valueFilters"\)/);
  assert.match(tableViewSource, /t\("common\.noValues"\)/);
  assert.match(tableViewSource, /data-workspace-property-menu="true"/);
  assert.match(tableViewSource, /data-workspace-property-menu-trigger="true"/);
  assert.match(tableViewSource, /from "@\/components\/workspace\/menu-dismissal"/);
  assert.match(tableViewSource, /blockOutsideWorkspaceMenuPointerDown/);
  assert.match(tableViewSource, /data-workspace-table-add-property-menu/);
  assert.match(tableViewSource, /hoveredPropertyMenuTriggerId/);
  assert.match(tableViewSource, /setPropertyMenuTriggerHovered/);
  assert.match(tableViewSource, /propertyMenuTriggerActive \? "" : "hover:bg-muted\/60 focus-within:bg-muted\/60"/);
  assert.match(tableViewSource, /onPointerEnter=\{\(\) => setPropertyMenuTriggerHovered\(property\.id, true\)\}/);
  assert.match(tableViewSource, /onPointerLeave=\{\(\) => setPropertyMenuTriggerHovered\(property\.id, false\)\}/);
  assert.match(tableViewSource, /closePropertyMenuOnOutsidePointerDown/);
  assert.match(tableViewSource, /from "react-dom"/);
  assert.match(tableViewSource, /createPortal/);
  assert.match(tableViewSource, /propertyMenuAnchor/);
  assert.match(tableViewSource, /fixed z-50 w-60/);
  assert.match(tableViewSource, /style=\{\{ left: propertyMenuAnchor\.left, top: propertyMenuAnchor\.top \}\}/);
  assert.doesNotMatch(tableViewSource, /DropdownMenuCheckboxItem/);
  assert.match(tableViewSource, /import \{ Checkbox \} from "@\/components\/ui\/checkbox";/);
  assert.match(tableViewSource, /workspaceMenuCheckboxClassName/);
  assert.doesNotMatch(tableViewSource, /suppressNextPropertyMenuCloseRef/);
  assert.match(tableViewSource, /grid-cols-\[auto_minmax\(0,1fr\)\] items-center gap-2 rounded-md px-1 py-0\.5 text-sm hover:bg-muted\/40/);
  assert.match(tableViewSource, /<Checkbox[\s\S]*checked=\{filterValueChecked\}/);
  assert.match(tableViewSource, /onCheckedChange=\{\(value\) => onToggleValueFilter\(property\.id, filterValue\.id, value === true\)\}/);
  assert.match(tableViewSource, /const selectedValueIds = new Set\(valueVisibility\[property\.id\]\?\.valueIds \|\| \[\]\);/);
  assert.match(tableViewSource, /t\("table\.addProperty"\)/);
  assert.match(tableViewSource, /t\("property\.add"\)/);
  assert.match(tableViewSource, /createPropertyFromType/);
  assert.match(tableViewSource, /propertyTypeOptions\.map/);
  assert.match(tableViewSource, /DropdownMenuLabel/);
  assert.match(tableViewSource, /DropdownMenuGroup/);
  assert.match(tableViewSource, /renderPropertyTypeIcon/);
  assert.match(tableViewSource, /t\("property\.type\.textDescription"\)/);
  assert.match(tableViewSource, /t\("property\.type\.numberDescription"\)/);
  assert.match(tableViewSource, /t\("property\.hideFromView"\)/);
  assert.match(tableViewSource, /disabled=\{isRequiredViewProperty\(property\.id\)\}/);
  assert.match(tableViewSource, /t\("property\.delete"\)/);
  assert.doesNotMatch(tableViewSource, /newPropertyName/);
  assert.doesNotMatch(tableViewSource, /newPropertyType/);
  assert.doesNotMatch(tableViewSource, /New property name/);
  assert.doesNotMatch(tableViewSource, /New property type/);
  assert.match(tableViewSource, /ProjectTablePropertyValueEditor/);
  assert.match(tableViewSource, /WorkspaceSelectValueEditor/);
  assert.match(tableViewSource, /WorkspaceDateValueEditor/);
  assert.match(tableViewSource, /WorkspaceTextValueTextarea/);
  assert.match(tableViewSource, /PopoverTrigger/);
  assert.match(tableViewSource, /function renderTextEditorPopover/);
  assert.match(tableViewSource, /property\.propertyType === "text" && !wrapContent/);
  assert.match(tableViewSource, /style=\{\{ width: "var\(--radix-popover-trigger-width\)" \}\}/);
  assert.match(tableViewSource, /className="workspace-table-text-editor-popover/);
  assert.match(tableViewSource, /editing \? \(/);
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
  assert.match(tableViewSource, /function renderTextCellDisplay/);
  assert.match(tableViewSource, /readonly onTogglePropertyWrapContent: \(propertyId: string, wrapContent: boolean\) => void;/);
  assert.match(tableViewSource, /t\("property\.wrapContent"\)/);
  assert.match(tableViewSource, /property\.propertyType === "text" && wrapContent/);
  assert.match(tableViewSource, /workspace-table-text-value block w-full min-w-0 whitespace-pre-wrap break-words \[overflow-wrap:anywhere\] rounded-md px-1 py-0\.5/);
  assert.match(tableViewSource, /function renderWrappedTextEditor/);
  assert.match(tableViewSource, /workspace-table-wrapped-text-editor-frame/);
  assert.match(tableViewSource, /className="workspace-table-text-value block w-full min-w-0 min-h-0 whitespace-pre-wrap/);
  assert.match(tableViewSource, /border-0 bg-transparent px-1 py-0\.5/);
  assert.match(tableViewSource, /focus-within:border-ring focus-within:bg-background focus-within:ring-2 focus-within:ring-ring\/30/);
  assert.match(tableViewSource, /return renderWrappedTextEditor\(stringifyEditableValue\(value\)\);/);
  assert.match(tableViewSource, /workspace-table-text-value min-w-0 truncate rounded-md px-1 py-0\.5/);
  assert.match(tableViewSource, /if \(property\.propertyType === "text" && !wrapContent\) \{[\s\S]*return renderTextEditorPopover\(stringifyEditableValue\(value\)\);[\s\S]*\}/);
  assert.match(appSource, /viewPropertyLayoutUpdated/);
  assert.match(appSource, /viewBoardLayoutUpdated/);
  assert.match(viewFilterMenuSource, /t\("view\.columnWidth"\)/);
  assert.match(viewFilterMenuSource, /Math\.max\([\s\S]*boardColumnWidthMax,[\s\S]*preferredBoardColumnWidth/);
  assert.match(viewFilterMenuSource, /boardColumnWidthDragMax \?\? availableBoardColumnWidthMax/);
  assert.match(viewFilterMenuSource, /<Slider/);
  assert.match(viewFilterMenuSource, /onValueCommit/);
  assert.match(viewFilterMenuSource, /max-h-\[calc\(100vh-4\.5rem\)\].*overflow-y-auto/);
  assert.match(tableViewSource, /<WorkspaceTextValueTextarea[\s\S]*aria-label=\{t\("table\.propertyActions", \{\s*name: property\.name,?\s*\}\)\}/);
  assert.match(tableViewSource, /onKeyDown=\{\(event\) => \{\s+event\.stopPropagation\(\);\s+if \(event\.key === "Escape"\)/);
  assert.match(textValueEditorSource, /useLayoutEffect/);
  assert.doesNotMatch(textValueEditorSource, /useEffect/);
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
  assert.match(tableViewSource, /t\("table\.dragColumn", \{\s*name: property\.name,?\s*\}\)/);
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
  assert.match(tableViewSource, /<col aria-label=\{t\("table\.addPropertyFiller"\)\} \/>/);
  assert.match(tableViewSource, /t\("table\.resizeColumn", \{\s*name: property\.name,?\s*\}\)/);
  assert.match(tableViewSource, /cursor-col-resize/);
  assert.match(tableViewSource, /clampPropertyColumnWidth/);
  assert.match(tableViewSource, /className="h-7 w-full min-w-0 rounded-md px-1\.5 text-sm"/);
  assert.doesNotMatch(tableViewSource, /min-w-36/);
  assert.match(tableViewSource, /hiddenViewProperties/);
  assert.doesNotMatch(tableViewSource, /GripVerticalIcon/);
  assert.doesNotMatch(tableViewSource, /rowHandleColumnWidth/);
  assert.doesNotMatch(tableViewSource, /aria-label="Row reorder"/);
  assert.match(tableViewSource, /PlusIcon/);
  assert.match(tableViewSource, /className="h-8 hover:bg-accent\/15"/);
  assert.doesNotMatch(tableViewSource, /cursor-pointer/);
  assert.match(tableViewSource, /function getBodyCellClassName/);
  assert.match(tableViewSource, /return `h-8 \$\{tableColumnDividerClassName\} align-top p-0\.5`;/);
  assert.match(tableViewSource, /\? `h-8 \$\{tableColumnDividerClassName\} align-top p-0\.5`/);
  assert.match(tableViewSource, /: `h-8 \$\{tableColumnDividerClassName\} align-top truncate px-3 py-0`;/);
  assert.match(tableViewSource, /className=\{getBodyCellClassName\(property, editable, wrapContent\)\}/);
  assert.match(tableViewSource, /workspace-table-cell-display workspace-table-cell-control flex h-8/);
  assert.match(tableViewSource, /workspace-table-cell-control/);
  assert.match(tableViewSource, /workspace-table-text-value/);
  assert.match(selectValueEditorSource, /workspace-table-value-chip/);
  assert.match(selectValueEditorSource, /workspace-table-select-value-chip/);
  assert.match(selectValueEditorSource, /workspace-table-empty-value/);
  assert.match(cssSource, /\.workspace-table-cell-control:has\(\.workspace-table-select-value-chip:hover\):hover/);
  assert.doesNotMatch(cssSource, /\.workspace-table-cell-control:has\(\.workspace-table-empty-value:hover\):hover/);
  assert.doesNotMatch(cssSource, /\.workspace-table-cell-control:has\(\.workspace-table-text-value:hover\):hover/);
  assert.match(cssSource, /\.workspace-table-select-value-chip:hover/);
  assert.doesNotMatch(cssSource, /\.workspace-table-empty-value:hover/);
  assert.doesNotMatch(cssSource, /\.workspace-table-text-value:hover/);
  assert.match(cssSource, /box-shadow: inset 0 0 0 1px color-mix\(in oklch, var\(--border\) 75%, var\(--foreground\) 25%\);/);
  assert.match(tableViewSource, /className="workspace-table-cell-control flex h-8 w-full min-w-0 items-center justify-start rounded-md px-2 text-left font-normal text-foreground transition-colors focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring\/30"/);
  assert.doesNotMatch(tableViewSource, /className="flex h-10 w-full/);
  assert.match(tableViewSource, /flex h-full min-h-0 w-full flex-col overflow-hidden/);
  assert.match(tableViewSource, /px-3 pb-0 pt-3/);
  assert.match(tableViewSource, /min-h-0 w-full flex-1 overflow-auto/);
  assert.match(tableViewSource, /w-full/);
  assert.match(tableViewSource, /rounded-lg border border-border\/45/);
  assert.match(viewFilterMenuSource, /t\("view\.customizeColumns"\)/);
  assert.doesNotMatch(viewFilterMenuSource, /ChevronDownIcon data-icon="inline-end"/);
  assert.match(viewTabsSource, /from "@\/components\/ui\/button"/);
  assert.match(viewTabsSource, /t\("view\.add"\)/);
  assert.match(viewTabsSource, /PlusIcon aria-hidden="true"/);
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
  assert.match(projectDetailPanelSource, /t\("detail\.resizePanel"\)/);
  assert.match(projectDetailPanelSource, /onPointerDown/);
  assert.match(projectDetailPanelSource, /function closeProjectDetails/);
  assert.match(appSource, /onClick=\{toggleProjectExpanded\}/);
  assert.match(projectDetailPanelSource, /onClick=\{closeProjectDetails\}/);
  assert.match(projectDetailPanelSource, /t\("detail\.close"\)/);
  assert.match(projectDetailPanelSource, /stopPropagation/);
  assert.match(projectDetailPanelSource, /transition-transform/);
  assert.match(projectDetailPanelSource, /duration-\[360ms\]/);
  assert.match(projectDetailPanelSource, /panelVisible \? "translate-x-0" : "translate-x-full"/);
  assert.doesNotMatch(projectDetailPanelSource, /transition-\[transform,opacity\]/);
  assert.doesNotMatch(projectDetailPanelSource, /panelVisible \? "opacity-100" : "opacity-0"/);
  assert.match(projectDetailPanelSource, /translate-x-full/);
  assert.doesNotMatch(projectDetailPanelSource, /SheetContent/);
  assert.doesNotMatch(projectDetailPanelSource, /project-identity-heading/);
  assert.match(projectDetailPanelSource, /workspace-project-detail-content-inset min-h-0 flex-1 overflow-auto pb-6 pt-1/);
  assert.doesNotMatch(projectDetailPanelSource, /displayedProject\.currentRelativePath/);
  assert.doesNotMatch(projectDetailPanelSource, /<Badge variant="outline">\{displayedProject\.status\.name\}<\/Badge>/);
  assert.doesNotMatch(projectDetailPanelSource, /property\.id !== "property:status"/);
  assert.match(projectDetailPanelSource, /detailVisibleProperties/);
  assert.match(projectDetailPanelSource, /property\.id !== "property:name"/);
  assert.match(projectDetailPanelSource, /detailVisibleProperties\.map/);
  assert.match(projectDetailPanelSource, /property\.id === "property:name"/);
  assert.match(projectDetailPanelSource, /property\.id === "property:status"/);
  assert.match(projectDetailPanelSource, /function canRenameCardProperty/);
  assert.match(projectDetailPanelSource, /renderCardPropertyActionsMenu\(property/);
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
  assert.match(projectDetailPanelSource, /className="h-7 w-full justify-start px-1\.5 py-0 text-left/);
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
  assert.match(projectDetailPanelSource, /t\("property\.properties"\)/);
  assert.match(projectDetailPanelSource, /t\("detail\.fileTree"\)/);
  assert.doesNotMatch(projectDetailPanelSource, /<header className="border-b border-border\/60/);
  assert.match(projectDetailPanelSource, /t\("view\.hiddenProperties"\)/);
  assert.match(projectDetailPanelSource, /hiddenCardProperties/);
  assert.match(projectDetailPanelSource, /function isProjectDetailProperty/);
  assert.match(projectDetailPanelSource, /property\.id !== "property:name"/);
  assert.match(projectDetailPanelSource, /const detailVisibleProperties = useMemo\(\s+\(\) => visibleProperties\.filter\(isProjectDetailProperty\),/);
  assert.match(projectDetailPanelSource, /function canHideCardProperty/);
  assert.match(projectDetailPanelSource, /property\.id === "property:status"/);
  assert.match(projectDetailPanelSource, /cardHiddenPropertyIdsStorageKey/);
  assert.match(projectDetailPanelSource, /function isCardPropertyHidden/);
  assert.match(projectDetailPanelSource, /property\.hidden \|\| cardHiddenPropertyIds\.includes\(property\.id\)/);
  assert.match(projectDetailPanelSource, /function setCardPropertyHidden/);
  assert.match(projectDetailPanelSource, /setCardPropertyHidden\(property, visibilityAction === "hide"\)/);
  assert.match(projectDetailPanelSource, /aria-controls="project-visible-properties"\s+aria-expanded=\{propertiesExpanded\}/);
  assert.doesNotMatch(projectDetailPanelSource, /Properties[\s\S]*workspace-project-detail-hidden-properties-toggle[\s\S]*<\/div>[\s\S]*<dl className="overflow-hidden rounded-md border border-border\/45 bg-background\/15">\s*\{orderedVisibleProperties\.map/);
  assert.match(projectDetailPanelSource, /workspace-project-detail-hidden-properties-toggle/);
  assert.match(projectDetailPanelSource, /workspace-project-detail-hidden-properties-heading workspace-project-detail-heading group\/section-heading flex items-center justify-between gap-3/);
  assert.match(projectDetailPanelSource, /workspace-project-detail-hidden-properties-toggle group\/section-toggle relative flex h-7/);
  assert.match(projectDetailPanelSource, /t\("view\.hiddenProperties"\)[\s\S]*<dl[\s\S]*id="project-hidden-properties"[\s\S]*className="overflow-hidden rounded-md border border-border\/45 bg-background\/15"/);
  assert.match(projectDetailPanelSource, /hiddenCardProperties\.map[\s\S]*border-b border-border\/45[\s\S]*last:border-b-0/);
  assert.match(projectDetailPanelSource, /hiddenCardProperties\.map[\s\S]*ProjectPropertyValueEditor/);
  const hiddenPropertiesMarkup = projectDetailPanelSource.slice(
    projectDetailPanelSource.indexOf("{hiddenPropertiesExpanded ? ("),
    projectDetailPanelSource.indexOf("<section className=\"grid gap-2\" aria-labelledby=\"project-file-tree-heading\">"),
  );
  assert.match(hiddenPropertiesMarkup, /hover:bg-accent\/15/);
  assert.doesNotMatch(hiddenPropertiesMarkup, /opacity-75/);
  assert.match(hiddenPropertiesMarkup, /data-card-property-row-group="hidden"/);
  assert.match(hiddenPropertiesMarkup, /PopoverAnchor asChild/);
  assert.match(hiddenPropertiesMarkup, /startCardPropertyDrag\(event, property\.id, \{\s+group: "hidden",\s+openActionsOnClick: true,\s+\}\)/);
  assert.match(hiddenPropertiesMarkup, /renderCardPropertyActionsMenu\(property, "show"\)/);
  assert.doesNotMatch(hiddenPropertiesMarkup, /Open \$\{property\.name\} hidden property value menu/);
  assert.doesNotMatch(hiddenPropertiesMarkup, /isProtectedCardProperty\(property\) && propertyMenuAvailable[\s\S]*openCardPropertyMenu\(property\.id\)/);
  assert.doesNotMatch(hiddenPropertiesMarkup, /onClick=\{\(\) => showProperty\(property\)\}/);
  assert.doesNotMatch(hiddenPropertiesMarkup, />\s*Show\s*<\/Button>/);
  assert.doesNotMatch(projectDetailPanelSource, /<span className="truncate">Hidden<\/span>/);
  assert.doesNotMatch(projectDetailPanelSource, /<Separator className="my-0" \/>/);
  assert.doesNotMatch(projectDetailPanelSource, /mt-2 border-t border-border\/70 pt-2/);
  assert.match(projectDetailPanelSource, /onRenameProperty/);
  assert.match(projectDetailPanelSource, /onHideProperty/);
  assert.match(projectDetailPanelSource, /onDeleteProperty/);
  assert.match(projectDetailPanelSource, /onCreateProperty/);
  assert.match(projectDetailPanelSource, /t\("property\.rename"\)/);
  assert.match(projectDetailPanelSource, /t\("property\.hideFromView"\)/);
  assert.match(projectDetailPanelSource, /t\("property\.showInView"\)/);
  assert.match(projectDetailPanelSource, /t\("property\.delete"\)/);
  assert.match(projectDetailPanelSource, /t\("property\.add"\)/);
  assert.match(projectDetailPanelSource, /propertyTypeOptions/);
  assert.match(projectDetailPanelSource, /createPropertyFromType/);
  assert.match(projectDetailPanelSource, /DropdownMenuContent/);
  assert.match(projectDetailPanelSource, /PlusIcon/);
  assert.match(appSource, /<WorkspaceProjectDetailPanel[\s\S]*onCreateProperty=\{handleCreateVisibleProperty\}/);
  assert.match(projectDetailPanelSource, /t\("table\.propertyActions", \{\s*name: property\.name,?\s*\}\)/);
  assert.match(projectDetailPanelSource, /FolderIcon/);
  assert.match(projectDetailPanelSource, /FileIcon/);
  assert.match(projectDetailPanelSource, /onOpenChange/);
  assert.match(projectDetailPanelSource, /ProjectPropertyValueEditor/);
  assert.match(projectDetailPanelSource, /ProjectPropertyValueDisplay/);
  assert.match(projectDetailPanelSource, /WorkspaceTextValueTextarea/);
  assert.match(projectDetailPanelSource, /projectDetailMultilineValueClassName/);
  assert.match(projectDetailPanelSource, /whitespace-pre-wrap break-words/);
  assert.match(projectDetailPanelSource, /<WorkspaceTextValueTextarea[\s\S]*aria-label=\{t\("table\.propertyActions", \{\s*name: property\.name,?\s*\}\)\}/);
  assert.match(projectDetailPanelSource, /editingPropertyId/);
  assert.match(projectDetailPanelSource, /cardPropertyOrderStorageKey/);
  assert.match(projectDetailPanelSource, /orderedVisibleProperties/);
  assert.match(projectDetailPanelSource, /type CardPropertyGroup = "visible" \| "hidden";/);
  assert.match(projectDetailPanelSource, /data-card-property-row-group="visible"/);
  assert.match(projectDetailPanelSource, /mergeCardPropertyGroupOrder/);
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
  assert.match(projectDetailPanelSource, /DropdownMenuTrigger asChild[\s\S]*t\("property\.add"\)/);
  assert.match(projectDetailPanelSource, /detailAddPropertyMenuSurfaceSelector/);
  assert.match(projectDetailPanelSource, /blockOutsideWorkspaceMenuPointerDown/);
  assert.match(projectDetailPanelSource, /const \[openAddPropertyMenu, setOpenAddPropertyMenu\] = useState\(false\);/);
  assert.match(projectDetailPanelSource, /setOpenAddPropertyMenu\(false\);[\s\S]*onCreateProperty\(\{ name: defaultPropertyNameByType\[option\.value\], type: option\.value \}\);/);
  assert.match(projectDetailPanelSource, /if \(!openAddPropertyMenu\) \{[\s\S]*return undefined;[\s\S]*blockOutsideWorkspaceMenuPointerDown\(event, detailAddPropertyMenuSurfaceSelector, \(\) => \{[\s\S]*setOpenAddPropertyMenu\(false\);/);
  assert.match(projectDetailPanelSource, /<DropdownMenu\s+open=\{openAddPropertyMenu\}\s+onOpenChange=\{setOpenAddPropertyMenu\}/);
  assert.match(projectDetailPanelSource, /data-workspace-detail-add-property-menu="true"/);
  assert.match(projectDetailPanelSource, /setPropertyActionsId\(propertyId\)/);
  assert.match(projectDetailPanelSource, /closePropertyMenuBeforeAction/);
  assert.match(projectDetailPanelSource, /startCardPropertyDrag\(event, property\.id, \{\s*openActionsOnClick: true,?\s*\}\)/);
  assert.match(projectDetailPanelSource, /onClick=\{\(event\) => \{\s*event\.preventDefault\(\);[\s\S]*suppressCardPropertyClickRef[\s\S]*openCardPropertyMenu\(property\.id\);/);
  assert.match(projectDetailPanelSource, /role="menu"/);
  assert.match(projectDetailPanelSource, /role="menuitem"/);
  assert.match(projectDetailPanelSource, /t\("table\.propertyActions", \{\s*name: property\.name,?\s*\}\)/);
  assert.doesNotMatch(projectDetailPanelSource, /MoreHorizontalIcon/);
  assert.match(projectDetailPanelSource, /t\("detail\.reorderProperty", \{\s*name: property\.name,?\s*\}\)/);
  assert.match(projectDetailPanelSource, /WorkspaceSelectValueEditor/);
  assert.match(projectDetailPanelSource, /onColorSelectValue/);
  assert.match(projectDetailPanelSource, /WorkspaceDateValueEditor/);
  assert.match(projectDetailPanelSource, /property\.propertyType === "text"/);
  assert.match(projectDetailPanelSource, /property\.propertyType === "number"/);
  assert.match(projectDetailPanelSource, /property\.propertyType === "date"/);
  assert.match(projectDetailPanelSource, /property\.propertyType === "select"/);
  assert.match(projectDetailPanelSource, /property\.propertyType === "multi-select"/);
  assert.match(projectDetailPanelSource, /formatNumberEditorValue/);
  assert.match(projectDetailPanelSource, /formatNumberDisplayValue/);
  assert.doesNotMatch(projectDetailPanelSource, /type="number"/);
  assert.match(tableViewSource, /formatNumberEditorValue/);
  assert.match(tableViewSource, /formatNumberDisplayValue/);
  assert.doesNotMatch(tableViewSource, /type="number"/);
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
  assert.match(selectValueEditorSource, /useRef/);
  assert.match(selectValueEditorSource, /dismissSignal/);
  assert.match(selectValueEditorSource, /setOpen\(false\)/);
  assert.match(selectValueEditorSource, /setSelectValueAction\(null\)/);
  assert.match(selectValueEditorSource, /t\("value\.search"\)/);
  assert.match(selectValueEditorSource, /t\("value\.clearSelection"\)/);
  assert.match(selectValueEditorSource, /Create/);
  assert.match(selectValueEditorSource, /onCreateSelectValue/);
  assert.match(selectValueEditorSource, /onRenameSelectValue/);
  assert.match(selectValueEditorSource, /onDeleteSelectValue/);
  assert.match(selectValueEditorSource, /onColorSelectValue/);
  assert.match(selectValueEditorSource, /valueColorOptions/);
  assert.match(selectValueEditorSource, /Color/);
  assert.match(selectValueEditorSource, /DropdownMenuCheckboxItem/);
  assert.match(selectValueEditorSource, /type SelectValueActionSource = "chip" \| "picker"/);
  assert.match(selectValueEditorSource, /type SelectValueActionState =/);
  assert.match(selectValueEditorSource, /selectValueAction/);
  assert.match(selectValueEditorSource, /isSelectValueActionOpen\(selectValue, "chip"\)/);
  assert.match(selectValueEditorSource, /isSelectValueActionOpen\(selectValue, "picker"\)/);
  assert.match(selectValueEditorSource, /Popover/);
  assert.match(selectValueEditorSource, /PopoverAnchor/);
  assert.match(selectValueEditorSource, /PopoverContent/);
  assert.match(selectValueEditorSource, /data-workspace-actions-popover/);
  assert.match(selectValueEditorSource, /data-workspace-select-value-menu/);
  assert.match(selectValueEditorSource, /from "@\/components\/workspace\/menu-dismissal"/);
  assert.match(selectValueEditorSource, /blockOutsideWorkspaceMenuPointerDown/);
  assert.match(selectValueEditorSource, /data-workspace-select-value-chip-trigger="true"/);
  assert.match(selectValueEditorSource, /data-workspace-select-value-trigger="true"/);
  assert.match(selectValueEditorSource, /openSelectValueActionsFromChip/);
  assert.match(selectValueEditorSource, /closingDropdownForSelectValueActionRef/);
  assert.doesNotMatch(selectValueEditorSource, /open=\{actionsSelectValueId === selectValue\.id\}/);
  assert.match(selectValueEditorSource, /source: "chip"/);
  assert.match(selectValueEditorSource, /source: "picker"/);
  assert.match(selectValueEditorSource, /setSelectValueAction\(null\);[\s\S]*return;/);
  assert.match(selectValueEditorSource, /closingDropdownForSelectValueActionRef\.current = selectValue\.id/);
  assert.match(selectValueEditorSource, /setOpen\(false\);[\s\S]*setSelectValueAction\(\{ selectValueId: selectValue\.id, source: "chip" \}\)/);
  assert.match(selectValueEditorSource, /if \(nextOpen\) \{[\s\S]*setSelectValueAction\(null\)/);
  assert.match(selectValueEditorSource, /keepSelectValueActionsPopoverFocusInsidePicker/);
  assert.match(selectValueEditorSource, /onFocusOutside=\{keepSelectValueActionsPopoverFocusInsidePicker\}/);
  assert.match(selectValueEditorSource, /onInteractOutside=\{keepSelectValueActionsPopoverOpen\}/);
  const selectValueActionsOutsideGuard = selectValueEditorSource.slice(
    selectValueEditorSource.indexOf("function keepSelectValueActionsPopoverFocusInsidePicker"),
    selectValueEditorSource.indexOf("function getSelectValuesForProperty"),
  );
  assert.match(selectValueActionsOutsideGuard, /data-workspace-actions-popover/);
  assert.match(selectValueActionsOutsideGuard, /data-workspace-select-value-menu/);
  assert.match(selectValueEditorSource, /side=\{options\.side \|\| "right"\}/);
  assert.doesNotMatch(selectValueEditorSource, /DropdownMenuSub/);
  assert.doesNotMatch(selectValueEditorSource, /mx-1 mb-1/);
  assert.doesNotMatch(selectValueEditorSource, /onBlur=\{\(\) => commitRenameSelectValue/);
  assert.match(selectValueEditorSource, /MoreHorizontalIcon/);
  assert.match(selectValueEditorSource, /t\("value\.rename"\)/);
  assert.match(selectValueEditorSource, /t\("value\.delete"\)/);
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
  assert.match(dateValueEditorSource, /from "@\/components\/workspace\/menu-dismissal"/);
  assert.match(dateValueEditorSource, /blockOutsideWorkspaceMenuPointerDown/);
  assert.match(dateValueEditorSource, /data-workspace-date-value-menu/);
  assert.match(dateValueEditorSource, /t\("value\.chooseDate"\)/);
  assert.match(dateValueEditorSource, /t\("value\.clearSelection"\)/);
  assert.match(dateValueEditorSource, /ChevronLeftIcon/);
  assert.match(dateValueEditorSource, /ChevronRightIcon/);
  assert.doesNotMatch(dateValueEditorSource, /type="date"/);
  assert.doesNotMatch(dateValueEditorSource, /dateValue \|\| "Empty"/);
  assert.doesNotMatch(selectValueEditorSource, /: "Empty"/);
  assert.doesNotMatch(projectDetailPanelSource, /<span className="truncate">Empty<\/span>/);
  assert.match(projectDetailPanelSource, /workspace-project-detail-value-trigger/);
  assert.match(dateValueEditorSource, /data-empty-value=\{dateValue \? undefined : "true"\}/);
  assert.match(selectValueEditorSource, /data-empty-value=\{selectedValueItems\.length > 0 \? undefined : "true"\}/);
  assert.match(selectValueEditorSource, /readonly containerClassName\?: string/);
  assert.match(selectValueEditorSource, /className=\{containerClassName\}/);
  assert.match(dateValueEditorSource, /readonly containerClassName\?: string/);
  assert.match(dateValueEditorSource, /className=\{containerClassName\}/);
  assert.match(projectDetailPanelSource, /containerClassName="w-full min-w-0"/);
  assert.match(cssSource, /\.workspace-project-detail-value-trigger\[data-empty-value="true"\]:hover/);
  assert.match(cssSource, /\.workspace-project-detail-value-trigger:has\(\.workspace-table-select-value-chip:hover\):hover/);
  assert.match(cssSource, /\.workspace-project-detail-value-trigger \.workspace-table-select-value-chip:hover/);
  assert.match(popoverSource, /@radix-ui\/react-popover/);

  assert.doesNotMatch(mainSource, /document\.documentElement\.classList\.add\("dark"\)/);
  assert.match(cssSource, /--background: var\(--canvas\)/);
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
