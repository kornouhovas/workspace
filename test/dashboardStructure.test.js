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

  assert.match(appSource, /from "@\/components\/workspace\/left-panel"/);
  assert.match(appSource, /Workspace Project Board/);
  assert.match(appSource, /<WorkspaceLeftPanel/);
  assert.match(appSource, /WorkspaceBoardView/);
  assert.match(appSource, /WorkspaceTableView/);
  assert.match(appSource, /WorkspaceViewTabs/);
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
  assert.match(appSource, /workspaceClient\.reorderWorkspaces/);
  assert.match(appSource, /workspaceClient\.setActiveWorkspace/);
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
  assert.match(leftPanelSource, /draggable/);
  assert.match(leftPanelSource, /onDragStart/);
  assert.match(leftPanelSource, /onDrop/);
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
  assert.match(appSource, /workspaceClient\.updateSelectValue/);
  assert.match(appSource, /workspaceClient\.deleteSelectValue/);
  assert.match(appSource, /workspaceClient\.reorderSelectValues/);
  assert.match(appSource, /onActiveViewChange/);
  assert.match(viewTabsSource, /onCreateView/);
  assert.match(viewTabsSource, /onRenameView/);
  assert.match(viewTabsSource, /onDeleteView/);
  assert.match(viewTabsSource, /WorkspaceViewFilterMenu/);
  assert.match(viewTabsSource, /onTogglePropertyVisibility/);
  assert.match(viewTabsSource, /onToggleValueFilter/);
  assert.match(viewFilterMenuSource, /WorkspaceViewFilterMenu/);
  assert.match(viewFilterMenuSource, /Visible properties/);
  assert.match(viewFilterMenuSource, /Value filters/);
  assert.match(viewFilterMenuSource, /Checkbox/);
  assert.match(viewFilterMenuSource, /valueVisibility/);
  assert.match(viewTabsSource, /DropdownMenu/);
  assert.match(viewTabsSource, /Rename View/);
  assert.match(viewTabsSource, /Delete View/);
  assert.match(viewTabsSource, /editingViewId/);
  assert.match(viewTabsSource, /aria-label="Rename view"/);
  assert.match(viewTabsSource, /rounded-xl bg-muted\/80/);
  assert.match(viewTabsSource, /group-data-horizontal\/tabs:!h-9/);
  assert.match(viewTabsSource, /text-sm font-medium/);
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
  assert.match(tableViewSource, /onCreateProperty/);
  assert.match(tableViewSource, /onRenameProperty/);
  assert.match(tableViewSource, /onDeleteProperty/);
  assert.match(tableViewSource, /onReorderViewProperties/);
  assert.match(tableViewSource, /onTogglePropertyVisibility/);
  assert.match(tableViewSource, /Add property column/);
  assert.match(tableViewSource, /Add property/);
  assert.match(tableViewSource, /createPropertyFromType/);
  assert.match(tableViewSource, /propertyTypeOptions\.map/);
  assert.match(tableViewSource, /Hide from view/);
  assert.match(tableViewSource, /Delete property/);
  assert.doesNotMatch(tableViewSource, /newPropertyName/);
  assert.doesNotMatch(tableViewSource, /newPropertyType/);
  assert.doesNotMatch(tableViewSource, /New property name/);
  assert.doesNotMatch(tableViewSource, /New property type/);
  assert.doesNotMatch(tableViewSource, /SelectTrigger/);
  assert.doesNotMatch(tableViewSource, /SelectContent/);
  assert.doesNotMatch(tableViewSource, /draggable/);
  assert.doesNotMatch(tableViewSource, /startColumnDrag/);
  assert.match(tableViewSource, /startPointerColumnDrag/);
  assert.match(tableViewSource, /data-property-column-id/);
  assert.match(tableViewSource, /Drag \$\{property\.name\} column/);
  assert.match(tableViewSource, /absolute left-1 top-1\/2/);
  assert.doesNotMatch(tableViewSource, /group-hover\/column:opacity-100/);
  assert.doesNotMatch(tableViewSource, /onDragOver/);
  assert.doesNotMatch(tableViewSource, /onDrop/);
  assert.match(tableViewSource, /colgroup/);
  assert.match(tableViewSource, /table-fixed/);
  assert.match(tableViewSource, /visiblePropertyWidths/);
  assert.match(tableViewSource, /style=\{\{ width: tableWidth \}\}/);
  assert.match(tableViewSource, /Resize \$\{property\.name\} column/);
  assert.match(tableViewSource, /cursor-col-resize/);
  assert.match(tableViewSource, /clampPropertyColumnWidth/);
  assert.match(tableViewSource, /className="h-7 w-full min-w-0 rounded-md px-1\.5 text-sm"/);
  assert.doesNotMatch(tableViewSource, /min-w-36/);
  assert.match(tableViewSource, /hiddenViewProperties/);
  assert.match(tableViewSource, /GripVerticalIcon/);
  assert.match(tableViewSource, /PlusIcon/);
  assert.match(tableViewSource, /flex h-full min-h-0 w-full flex-col overflow-hidden/);
  assert.match(tableViewSource, /pl-4 pr-4 pt-4 pb-0/);
  assert.match(tableViewSource, /min-h-0 w-full flex-1 overflow-auto/);
  assert.match(tableViewSource, /w-full/);
  assert.doesNotMatch(tableViewSource, /rounded-lg border border-border/);
  assert.doesNotMatch(tableViewSource, /sticky right-0/);
  assert.doesNotMatch(tableViewSource, /currentRelativePath/);
  assert.doesNotMatch(tableViewSource, />Path<\/TableHead>/);
  assert.doesNotMatch(tableViewSource, /px-4/);
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
  assert.doesNotMatch(projectDetailPanelSource, /opacity-0/);
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
  assert.match(projectDetailPanelSource, /className="h-7 w-full justify-start px-2 py-1 text-left"/);
  assert.match(projectDetailPanelSource, /<ul className="grid gap-0\.5">/);
  assert.doesNotMatch(projectDetailPanelSource, /block truncate text-xs font-normal text-muted-foreground">\{node\.relativePath\}<\/span>/);
  assert.match(projectDetailPanelSource, /ChevronRightIcon/);
  assert.match(projectDetailPanelSource, /ChevronDownIcon/);
  assert.match(projectDetailPanelSource, /Properties/);
  assert.match(projectDetailPanelSource, /File tree/);
  assert.match(projectDetailPanelSource, /FolderIcon/);
  assert.match(projectDetailPanelSource, /FileIcon/);
  assert.match(projectDetailPanelSource, /onOpenChange/);
  assert.match(projectDetailPanelSource, /ProjectPropertyValueEditor/);
  assert.match(projectDetailPanelSource, /property\.propertyType === "text"/);
  assert.match(projectDetailPanelSource, /property\.propertyType === "number"/);
  assert.match(projectDetailPanelSource, /property\.propertyType === "date"/);
  assert.match(projectDetailPanelSource, /property\.propertyType === "select"/);
  assert.match(projectDetailPanelSource, /property\.propertyType === "multi-select"/);
  assert.match(projectDetailPanelSource, /type="number"/);
  assert.match(projectDetailPanelSource, /type="date"/);
  assert.match(projectDetailPanelSource, /Checkbox/);
  assert.match(projectDetailPanelSource, /onProjectPropertyValueChange/);
  assert.match(appSource, /handleProjectPropertyValueChange/);
  assert.match(appSource, /workspaceClient\.updateProjectPropertyValue/);
  assert.match(appSource, /projectPropertyValueUpdated/);
  assert.match(appSource, /propertySaveFailed/);
  assert.match(appSource, /handleTogglePropertyVisibility/);
  assert.match(appSource, /handleToggleValueFilter/);
  assert.match(appSource, /handleCreateVisibleProperty/);
  assert.match(appSource, /handleReorderViewProperties/);

  assert.match(mainSource, /document\.documentElement\.classList\.add\("dark"\)/);
  assert.match(lucideIconsSource, /lucide-react\/dist\/esm\/icons\/folder-kanban\.mjs/);
  assert.match(lucideIconsSource, /lucide-react\/dist\/esm\/icons\/folder\.mjs/);
  assert.match(lucideIconsSource, /lucide-react\/dist\/esm\/icons\/file\.mjs/);
  assert.match(lucideIconsSource, /lucide-react\/dist\/esm\/icons\/search\.mjs/);
  assert.match(lucideIconsSource, /lucide-react\/dist\/esm\/icons\/settings\.mjs/);
  assert.match(cssSource, /@import "shadcn\/tailwind\.css"/);
  assert.match(cssSource, /-webkit-app-region:\s*drag/);
  assert.match(cssSource, /::-webkit-scrollbar-thumb/);
});
