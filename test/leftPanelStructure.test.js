import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readRequiredProjectFile(path) {
  try {
    return await readFile(new URL(`../${path}`, import.meta.url), "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      assert.fail(`${path} should exist`);
    }
    throw error;
  }
}

test("renderer uses the shadcn dashboard-01 block shell", async () => {
  const [
    css,
    appSource,
    mainSource,
    packageSource,
    componentsSource,
    viteSource,
    tsconfigSource,
    guidelineSource,
    appSidebarSource,
    siteHeaderSource,
    sectionCardsSource,
    dataTableSource,
    chartSource,
  ] =
    await Promise.all([
      readRequiredProjectFile("src/renderer/renderer.css"),
      readRequiredProjectFile("src/renderer/App.tsx"),
      readRequiredProjectFile("electron/main.js"),
      readRequiredProjectFile("package.json"),
      readRequiredProjectFile("components.json"),
      readRequiredProjectFile("vite.config.ts"),
      readRequiredProjectFile("tsconfig.json"),
      readRequiredProjectFile("styleguideline.md"),
      readRequiredProjectFile("src/renderer/components/app-sidebar.tsx"),
      readRequiredProjectFile("src/renderer/components/site-header.tsx"),
      readRequiredProjectFile("src/renderer/components/section-cards.tsx"),
      readRequiredProjectFile("src/renderer/components/data-table.tsx"),
      readRequiredProjectFile("src/renderer/components/chart-area-interactive.tsx"),
    ]);
  const packageJson = JSON.parse(packageSource);
  const componentsJson = JSON.parse(componentsSource);
  const tsconfigJson = JSON.parse(tsconfigSource);

  assert.equal(componentsJson.style, "radix-nova");
  assert.equal(componentsJson.iconLibrary, "lucide");
  assert.equal(componentsJson.aliases.components, "@/components");
  assert.equal(componentsJson.aliases.utils, "@/lib/utils");
  assert.equal(tsconfigJson.compilerOptions.baseUrl, ".");
  assert.equal(tsconfigJson.compilerOptions.paths["@/*"][0], "./src/renderer/*");
  assert.match(viteSource, /@tailwindcss\/vite/);
  assert.match(viteSource, /alias:\s*\{[\s\S]*"@":\s*resolve\(__dirname,\s*"src\/renderer"\)/);

  assert.ok(packageJson.dependencies["@tailwindcss/vite"]);
  assert.ok(packageJson.dependencies["lucide-react"]);
  assert.ok(packageJson.dependencies["class-variance-authority"]);
  assert.ok(packageJson.dependencies["tailwind-merge"]);

  assert.match(mainSource, /titleBarStyle:\s*"hiddenInset"/);
  assert.match(appSource, /from "@\/components\/app-sidebar"/);
  assert.match(appSource, /from "@\/components\/site-header"/);
  assert.match(appSource, /from "@\/components\/section-cards"/);
  assert.match(appSource, /from "@\/components\/data-table"/);
  assert.match(appSource, /from "@\/components\/chart-area-interactive"/);
  assert.match(appSource, /from "@\/components\/ui\/sidebar"/);
  assert.match(appSource, /from "@\/components\/ui\/tooltip"/);
  assert.match(appSource, /data\.json/);
  assert.match(appSource, /function App\(\)/);
  assert.doesNotMatch(appSource, /function DashboardSidebar/);
  assert.doesNotMatch(appSource, /function WorkspaceContent/);
  assert.doesNotMatch(appSource, /function WorkspaceMenuRow/);
  assert.match(appSource, /<SidebarProvider/);
  assert.match(appSource, /<TooltipProvider/);
  assert.match(appSource, /<TooltipProvider>[\s\S]*<SidebarProvider/);
  assert.match(appSource, /<AppSidebar/);
  assert.match(appSource, /<SiteHeader/);
  assert.match(appSource, /<SectionCards/);
  assert.match(appSource, /<ChartAreaInteractive/);
  assert.match(appSource, /<DataTable/);
  assert.doesNotMatch(appSource, /workspace\.dashboard\.workspaces/);
  assert.doesNotMatch(appSource, /workspace\.dashboard\.selectedWorkspaceId/);
  assert.doesNotMatch(appSource, /iconPaths/);
  assert.doesNotMatch(appSource, /function Icon\(/);
  assert.doesNotMatch(appSource, /handleWorkspacePointerDown/);
  assert.doesNotMatch(appSource, /handleWorkspacePointerMove/);
  assert.doesNotMatch(appSource, /showContextMenu/);
  assert.doesNotMatch(appSource, /window\.workspace/);
  assert.doesNotMatch(appSource, /workspace-drag-overlay/);
  assert.doesNotMatch(appSource, /\sdraggable\b/);
  assert.doesNotMatch(appSource, /onDragStart/);
  assert.doesNotMatch(appSource, /onDrop/);

  assert.match(css, /@import "tailwindcss"/);
  assert.match(css, /@theme inline/);
  assert.match(css, /--sidebar:/);
  assert.match(css, /--radius:/);
  assert.match(css, /\.dashboard-01-shell/);
  assert.doesNotMatch(css, /--codex-sidebar-glass/);
  assert.doesNotMatch(css, /\.workspace-drag-overlay/);

  assert.match(guidelineSource, /shadcn\/ui/);
  assert.match(guidelineSource, /lucide-react/);
  assert.match(guidelineSource, /dashboard-01/);
  assert.match(guidelineSource, /Tailwind CSS v4/);

  assert.match(appSidebarSource, /export function AppSidebar/);
  assert.match(siteHeaderSource, /export function SiteHeader/);
  assert.match(sectionCardsSource, /export function SectionCards/);
  assert.match(dataTableSource, /export function DataTable/);
  assert.match(chartSource, /export function ChartAreaInteractive/);
});
