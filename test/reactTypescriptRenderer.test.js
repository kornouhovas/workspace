import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readProjectFile(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("renderer is built with React, TypeScript, Vite, and shadcn", async () => {
  const [packageSource, viteConfig, tsconfig, indexHtml, mainTsx, appTsx, styles, mainSource, componentsSource] =
    await Promise.all([
      readProjectFile("package.json"),
      readProjectFile("vite.config.ts"),
      readProjectFile("tsconfig.json"),
      readProjectFile("index.html"),
      readProjectFile("src/renderer/main.tsx"),
      readProjectFile("src/renderer/App.tsx"),
      readProjectFile("src/renderer/renderer.css"),
      readProjectFile("electron/main.js"),
      readProjectFile("components.json"),
    ]);
  const packageJson = JSON.parse(packageSource);
  const componentsJson = JSON.parse(componentsSource);
  const tsconfigJson = JSON.parse(tsconfig);

  assert.equal(packageJson.scripts["build:renderer"], "vite build");
  assert.equal(packageJson.scripts.typecheck, "tsc --noEmit");
  assert.equal(packageJson.scripts.electron, "npm run build:sidecar && npm run build:renderer && electron electron/main.js");
  assert.equal(packageJson.dependencies.react.startsWith("^"), true);
  assert.equal(packageJson.dependencies["react-dom"].startsWith("^"), true);
  assert.equal(packageJson.dependencies["@tailwindcss/vite"].startsWith("^"), true);
  assert.equal(packageJson.dependencies.tailwindcss.startsWith("^"), true);
  assert.equal(packageJson.dependencies["lucide-react"].startsWith("^"), true);
  assert.equal(packageJson.dependencies["class-variance-authority"].startsWith("^"), true);
  assert.equal(packageJson.devDependencies.typescript.startsWith("^"), true);
  assert.equal(packageJson.devDependencies.vite.startsWith("^"), true);
  assert.equal(packageJson.devDependencies["@vitejs/plugin-react"].startsWith("^"), true);
  assert.equal(packageJson.devDependencies["@types/react"].startsWith("^"), true);
  assert.equal(packageJson.devDependencies["@types/react-dom"].startsWith("^"), true);
  assert.deepEqual(packageJson.build.files, [
    "dist/renderer/**/*",
    "electron/**/*",
    "src/**/*",
    "THIRD_PARTY_NOTICES.md",
  ]);

  assert.equal(componentsJson.style, "radix-nova");
  assert.equal(componentsJson.tailwind.css, "src/renderer/renderer.css");
  assert.equal(componentsJson.aliases.ui, "@/components/ui");
  assert.equal(componentsJson.iconLibrary, "lucide");

  assert.match(viteConfig, /@vitejs\/plugin-react/);
  assert.match(viteConfig, /@tailwindcss\/vite/);
  assert.match(viteConfig, /outDir:\s*"dist\/renderer"/);
  assert.match(viteConfig, /base:\s*"\.\/"/);
  assert.match(viteConfig, /"@":\s*resolve\(__dirname,\s*"src\/renderer"\)/);
  assert.match(tsconfig, /"jsx":\s*"react-jsx"/);
  assert.match(tsconfig, /"strict":\s*true/);
  assert.match(tsconfig, /"ignoreDeprecations":\s*"6\.0"/);
  assert.equal(tsconfigJson.compilerOptions.paths["@/*"][0], "./src/renderer/*");
  assert.match(indexHtml, /<div id="root"><\/div>/);
  assert.match(indexHtml, /src="\/src\/renderer\/main\.tsx"/);
  assert.match(mainTsx, /createRoot/);
  assert.match(mainTsx, /<App \/>/);

  assert.match(appTsx, /type Workspace/);
  assert.match(appTsx, /from "lucide-react"/);
  assert.match(appTsx, /function App\(\)/);
  assert.match(appTsx, /function DashboardSidebar/);
  assert.match(appTsx, /function WorkspaceMenuRow/);
  assert.match(appTsx, /function WorkspaceContent/);
  assert.match(appTsx, /workspace\.dashboard\.workspaces/);
  assert.match(appTsx, /workspace\.dashboard\.selectedWorkspaceId/);
  assert.match(appTsx, /<SidebarProvider/);
  assert.match(appTsx, /<SidebarTrigger/);
  assert.match(appTsx, /<SidebarMenuButton/);
  assert.match(appTsx, /<Button/);
  assert.match(appTsx, /<Input/);
  assert.match(appTsx, /<Badge/);
  assert.match(appTsx, /<TooltipProvider/);
  assert.match(appTsx, /New Workspace/);
  assert.match(appTsx, /Workspaces/);
  assert.match(appTsx, /Current workspace/);
  assert.match(appTsx, /editingWorkspaceId/);
  assert.match(appTsx, /pendingDeleteWorkspaceId/);
  assert.match(appTsx, /className="workspace-name-input"/);
  assert.match(appTsx, /function\s+isWorkspaceStatus/);
  const addWorkspaceBody = appTsx.match(/function addWorkspace[\s\S]*?\n  function selectWorkspace/)?.[0] || "";
  assert.match(addWorkspaceBody, /name:\s*"Workspace"/);
  assert.doesNotMatch(addWorkspaceBody, /workspaceCounter/);
  assert.doesNotMatch(appTsx, /iconPaths/);
  assert.doesNotMatch(appTsx, /function Icon\(/);
  assert.doesNotMatch(appTsx, /window\.workspace/);
  assert.doesNotMatch(appTsx, /showContextMenu/);
  assert.doesNotMatch(appTsx, /window\.prompt/);
  assert.doesNotMatch(appTsx, /window\.confirm/);
  assert.doesNotMatch(appTsx, /onPointerDown/);
  assert.doesNotMatch(appTsx, /onPointerMove/);
  assert.doesNotMatch(appTsx, /onDragStart/);
  assert.doesNotMatch(appTsx, /onDrop/);

  assert.match(styles, /@import "tailwindcss"/);
  assert.match(styles, /@theme inline/);
  assert.match(styles, /--font-sans:/);
  assert.match(styles, /--sidebar:/);
  assert.match(styles, /--primary:/);
  assert.match(styles, /\.dashboard-shell/);
  assert.match(styles, /\.dashboard-sidebar/);
  assert.match(styles, /\.window-drag-region/);
  assert.match(styles, /-webkit-app-region:\s*drag/);
  assert.match(styles, /\.window-drag-region button/);
  assert.match(styles, /-webkit-app-region:\s*no-drag/);
  assert.match(styles, /\.workspace-content/);
  assert.match(styles, /\.workspace-hero/);
  assert.match(styles, /\.workspace-grid/);
  assert.doesNotMatch(styles, /--codex-sidebar-glass/);
  assert.doesNotMatch(styles, /\.left-panel\b/);
  assert.doesNotMatch(styles, /\.workspace-drag-overlay/);

  assert.doesNotMatch(mainSource, /nativeTheme/);
  assert.doesNotMatch(mainSource, /themeSource/);
  assert.match(mainSource, /titleBarStyle:\s*"hiddenInset"/);
  assert.match(mainSource, /window\.loadFile\(join\(__dirname,\s*"\.\.\/dist\/renderer\/index\.html"\)\)/);
});
