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
  assert.match(appSource, /workspaceClient\.createView/);
  assert.match(appSource, /viewCreated/);
  assert.match(appSource, /projectionUpdated/);
  assert.match(appSource, /workspaceClient\.updateView/);
  assert.match(appSource, /workspaceClient\.deleteView/);
  assert.match(appSource, /workspaceClient\.updateFolderRole/);
  assert.match(appSource, /workspaceClient\.createWorkspace/);
  assert.match(appSource, /workspaceClient\.updateWorkspace/);
  assert.match(appSource, /workspaceClient\.deleteWorkspace/);
  assert.match(appSource, /workspaceClient\.reorderWorkspaces/);
  assert.match(appSource, /workspaceClient\.setActiveWorkspace/);
  assert.match(appSource, /includeCardChildren:\s*true/);
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
  assert.match(appSource, /onActiveViewChange/);
  assert.match(viewTabsSource, /onCreateView/);
  assert.match(viewTabsSource, /onRenameView/);
  assert.match(viewTabsSource, /onDeleteView/);
  assert.match(viewTabsSource, /DropdownMenu/);
  assert.match(viewTabsSource, /Rename View/);
  assert.match(viewTabsSource, /Delete View/);
  assert.match(viewTabsSource, /editingViewId/);
  assert.match(viewTabsSource, /aria-label="Rename view"/);
  assert.match(viewTabsSource, /min-w-44/);
  assert.match(viewTabsSource, /onContextMenu/);
  assert.match(viewTabsSource, /contextMenuViewId/);
  assert.doesNotMatch(leftPanelSource, /window\.prompt/);
  assert.doesNotMatch(viewTabsSource, /window\.prompt/);
  assert.doesNotMatch(viewTabsSource, /\bcapitalize\b/);
  assert.match(boardViewSource, /onProjectOpen/);
  assert.match(boardViewSource, /auto-cols-\[minmax\(20rem,1fr\)\]/);
  assert.match(boardViewSource, /min-h-24/);
  assert.match(boardViewSource, /w-full/);
  assert.match(tableViewSource, /onProjectOpen/);
  assert.match(tableViewSource, /GripVerticalIcon/);
  assert.match(tableViewSource, /w-full/);
  assert.match(projectDetailPanelSource, /WorkspaceProjectDetailPanel/);
  assert.match(projectDetailPanelSource, /projectDetailPanelWidth/);
  assert.match(projectDetailPanelSource, /localStorage/);
  assert.match(projectDetailPanelSource, /Resize project panel/);
  assert.match(projectDetailPanelSource, /onPointerDown/);
  assert.match(projectDetailPanelSource, /function closeProjectDetails/);
  assert.match(projectDetailPanelSource, /onPointerDown=\{closeProjectDetails\}/);
  assert.match(projectDetailPanelSource, /onClick=\{closeProjectDetails\}/);
  assert.match(projectDetailPanelSource, /Close project details backdrop/);
  assert.match(projectDetailPanelSource, /stopPropagation/);
  assert.match(projectDetailPanelSource, /translate-x-full/);
  assert.doesNotMatch(projectDetailPanelSource, /SheetContent/);
  assert.match(projectDetailPanelSource, /Properties/);
  assert.match(projectDetailPanelSource, /File tree/);
  assert.match(projectDetailPanelSource, /FolderIcon/);
  assert.match(projectDetailPanelSource, /FileIcon/);
  assert.match(projectDetailPanelSource, /onOpenChange/);

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
