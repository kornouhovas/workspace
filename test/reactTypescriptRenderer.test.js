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
  assert.equal(packageJson.dependencies["@tanstack/react-table"].startsWith("^"), true);
  assert.equal(packageJson.dependencies["@dnd-kit/core"].startsWith("^"), true);
  assert.equal(packageJson.dependencies.recharts.startsWith("^"), true);
  assert.equal(packageJson.dependencies.sonner.startsWith("^"), true);
  assert.equal(packageJson.dependencies.zod.startsWith("^"), true);
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

  assert.match(appTsx, /from "@\/components\/app-sidebar"/);
  assert.match(appTsx, /from "@\/components\/site-header"/);
  assert.match(appTsx, /from "@\/components\/section-cards"/);
  assert.match(appTsx, /from "@\/components\/chart-area-interactive"/);
  assert.match(appTsx, /from "@\/components\/data-table"/);
  assert.match(appTsx, /from "\.\.\/app\/dashboard\/data\.json"/);
  assert.match(appTsx, /function App\(\)/);
  assert.match(appTsx, /<SidebarProvider/);
  assert.match(appTsx, /<AppSidebar variant="inset"/);
  assert.match(appTsx, /<SidebarInset/);
  assert.match(appTsx, /<SiteHeader/);
  assert.match(appTsx, /<SectionCards/);
  assert.match(appTsx, /<ChartAreaInteractive/);
  assert.match(appTsx, /<DataTable data=\{data\}/);
  assert.match(appTsx, /<Toaster/);
  assert.doesNotMatch(appTsx, /type Workspace/);
  assert.doesNotMatch(appTsx, /function DashboardSidebar/);
  assert.doesNotMatch(appTsx, /function WorkspaceMenuRow/);
  assert.doesNotMatch(appTsx, /function WorkspaceContent/);
  assert.doesNotMatch(appTsx, /workspace\.dashboard\.workspaces/);
  assert.doesNotMatch(appTsx, /workspace\.dashboard\.selectedWorkspaceId/);
  assert.doesNotMatch(appTsx, /New Workspace/);
  assert.doesNotMatch(appTsx, /editingWorkspaceId/);
  assert.doesNotMatch(appTsx, /pendingDeleteWorkspaceId/);
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
  assert.match(styles, /--header-height:\s*3rem/);
  assert.match(styles, /\.dashboard-01-shell/);
  assert.doesNotMatch(styles, /\.dashboard-shell/);
  assert.doesNotMatch(styles, /\.dashboard-sidebar/);
  assert.doesNotMatch(styles, /\.window-drag-region/);
  assert.doesNotMatch(styles, /\.workspace-content/);
  assert.doesNotMatch(styles, /\.workspace-hero/);
  assert.doesNotMatch(styles, /\.workspace-grid/);
  assert.doesNotMatch(styles, /--codex-sidebar-glass/);
  assert.doesNotMatch(styles, /\.left-panel\b/);
  assert.doesNotMatch(styles, /\.workspace-drag-overlay/);

  assert.doesNotMatch(mainSource, /nativeTheme/);
  assert.doesNotMatch(mainSource, /themeSource/);
  assert.match(mainSource, /titleBarStyle:\s*"hiddenInset"/);
  assert.match(mainSource, /window\.loadFile\(join\(__dirname,\s*"\.\.\/dist\/renderer\/index\.html"\)\)/);
});
