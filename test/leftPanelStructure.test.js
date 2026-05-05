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

test("renderer uses a shadcn dashboard sidebar shell", async () => {
  const [css, appSource, mainSource, packageSource, componentsSource, viteSource, tsconfigSource, guidelineSource] =
    await Promise.all([
      readRequiredProjectFile("src/renderer/renderer.css"),
      readRequiredProjectFile("src/renderer/App.tsx"),
      readRequiredProjectFile("electron/main.js"),
      readRequiredProjectFile("package.json"),
      readRequiredProjectFile("components.json"),
      readRequiredProjectFile("vite.config.ts"),
      readRequiredProjectFile("tsconfig.json"),
      readRequiredProjectFile("styleguideline.md"),
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
  assert.match(appSource, /from "lucide-react"/);
  assert.match(appSource, /from "@\/components\/ui\/sidebar"/);
  assert.match(appSource, /from "@\/components\/ui\/button"/);
  assert.match(appSource, /from "@\/components\/ui\/input"/);
  assert.match(appSource, /from "@\/components\/ui\/badge"/);
  assert.match(appSource, /from "@\/components\/ui\/separator"/);
  assert.match(appSource, /from "@\/components\/ui\/tooltip"/);
  assert.match(appSource, /function DashboardSidebar/);
  assert.match(appSource, /function WorkspaceContent/);
  assert.match(appSource, /<SidebarProvider/);
  assert.match(appSource, /<Sidebar/);
  assert.match(appSource, /<SidebarMenuButton/);
  assert.match(appSource, /<SidebarTrigger/);
  assert.match(appSource, /<TooltipProvider/);
  assert.match(appSource, /<Badge/);
  assert.match(appSource, /<Input/);
  assert.match(appSource, /<Button/);
  assert.match(appSource, /Command center/);
  assert.match(appSource, /Current workspace/);
  assert.match(appSource, /workspace\.dashboard\.workspaces/);
  assert.match(appSource, /workspace\.dashboard\.selectedWorkspaceId/);
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
  assert.match(css, /\.dashboard-shell/);
  assert.match(css, /\.window-drag-region/);
  assert.match(css, /-webkit-app-region:\s*drag/);
  assert.match(css, /\.window-drag-region button/);
  assert.match(css, /-webkit-app-region:\s*no-drag/);
  assert.doesNotMatch(css, /--codex-sidebar-glass/);
  assert.doesNotMatch(css, /\.workspace-drag-overlay/);

  assert.match(guidelineSource, /shadcn\/ui/);
  assert.match(guidelineSource, /lucide-react/);
  assert.match(guidelineSource, /Dashboard Sidebar/);
  assert.match(guidelineSource, /Tailwind CSS v4/);
});
