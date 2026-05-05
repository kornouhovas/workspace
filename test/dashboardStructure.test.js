import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readProjectFile(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("renderer installs and composes shadcn dashboard-01", async () => {
  const [
    componentsSource,
    appSource,
    mainSource,
    cssSource,
    packageSource,
    viteSource,
    tsconfigSource,
    appSidebarSource,
    _dataTableSource,
    _chartSource,
    _avatarSource,
    siteHeaderSource,
  ] = await Promise.all([
    readProjectFile("components.json"),
    readProjectFile("src/App.tsx"),
    readProjectFile("src/main.tsx"),
    readProjectFile("src/styles.css"),
    readProjectFile("package.json"),
    readProjectFile("vite.config.ts"),
    readProjectFile("tsconfig.json"),
    readProjectFile("src/components/app-sidebar.tsx"),
    readProjectFile("src/components/data-table.tsx"),
    readProjectFile("src/components/chart-area-interactive.tsx"),
    readProjectFile("public/avatars/shadcn.svg"),
    readProjectFile("src/components/site-header.tsx"),
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
  assert.ok(packageJson.dependencies["@tabler/icons-react"]);
  assert.ok(packageJson.dependencies.recharts);
  assert.ok(packageJson.dependencies["@tanstack/react-table"]);

  assert.match(appSource, /from "@\/components\/app-sidebar"/);
  assert.match(appSource, /from "@\/components\/site-header"/);
  assert.match(appSource, /from "@\/components\/section-cards"/);
  assert.match(appSource, /from "@\/components\/chart-area-interactive"/);
  assert.match(appSource, /from "@\/components\/data-table"/);
  assert.match(appSource, /from "@\/components\/ui\/tooltip"/);
  assert.match(appSource, /from "\.\/app\/dashboard\/data\.json"/);
  assert.match(appSource, /<TooltipProvider>[\s\S]*<SidebarProvider/);
  assert.match(appSource, /className="dashboard-01-shell dark"/);
  assert.match(appSource, /"--sidebar-width":\s*"calc\(var\(--spacing\) \* 72\)"/);
  assert.match(appSource, /"--header-height":\s*"calc\(var\(--spacing\) \* 12\)"/);
  assert.match(appSource, /<AppSidebar variant="inset"/);
  assert.match(appSource, /<SiteHeader/);
  assert.match(appSource, /@container\/main flex flex-1 flex-col gap-2/);
  assert.match(appSource, /<SectionCards/);
  assert.match(appSource, /<div className="px-4 lg:px-6">\s*<ChartAreaInteractive \/>/);
  assert.match(appSource, /<ChartAreaInteractive/);
  assert.match(appSource, /<DataTable data=\{data\}/);
  assert.match(mainSource, /document\.documentElement\.classList\.add\("dark"\)/);
  assert.match(appSidebarSource, /from "@tabler\/icons-react"/);
  assert.match(appSidebarSource, /IconInnerShadowTop/);
  assert.match(appSidebarSource, /IconDashboard/);
  assert.match(appSidebarSource, /avatar:\s*"\.\/avatars\/shadcn\.svg"/);
  assert.match(appSidebarSource, /electron-window-drag/);
  assert.match(appSidebarSource, /electron-window-no-drag/);
  assert.match(siteHeaderSource, /electron-window-drag/);
  assert.match(siteHeaderSource, /electron-window-no-drag/);
  assert.match(cssSource, /@import "shadcn\/tailwind\.css"/);
  assert.match(cssSource, /--header-height:\s*3rem/);
  assert.match(cssSource, /\.dashboard-01-shell/);
  assert.match(cssSource, /-webkit-app-region:\s*drag/);
  assert.match(cssSource, /::-webkit-scrollbar-thumb/);
});
