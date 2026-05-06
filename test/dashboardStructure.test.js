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
    dataTableSource,
    chartAreaSource,
    _avatarSource,
    siteHeaderSource,
    dropdownMenuSource,
    tablerIconsSource,
    tablerIconTypesSource,
    lucideIconsSource,
    lucideIconTypesSource,
    rechartsSource,
    rechartsTypesSource,
    navMainSource,
    navUserSource,
    navDocumentsSource,
    sectionCardsSource,
    selectSource,
    checkboxSource,
    sidebarSource,
    sonnerSource,
    uiChartSource,
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
    readProjectFile("src/components/ui/dropdown-menu.tsx"),
    readProjectFile("src/lib/tabler-icons.ts"),
    readProjectFile("src/types/tabler-icons-react.d.ts"),
    readProjectFile("src/lib/lucide-icons.ts"),
    readProjectFile("src/types/lucide-react-icons.d.ts"),
    readProjectFile("src/lib/recharts.ts"),
    readProjectFile("src/types/recharts-es6.d.ts"),
    readProjectFile("src/components/nav-main.tsx"),
    readProjectFile("src/components/nav-user.tsx"),
    readProjectFile("src/components/nav-documents.tsx"),
    readProjectFile("src/components/section-cards.tsx"),
    readProjectFile("src/components/ui/select.tsx"),
    readProjectFile("src/components/ui/checkbox.tsx"),
    readProjectFile("src/components/ui/sidebar.tsx"),
    readProjectFile("src/components/ui/sonner.tsx"),
    readProjectFile("src/components/ui/chart.tsx"),
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
  assert.match(appSource, /<SidebarInset className="dashboard-main-inset">/);
  assert.match(appSource, /<SiteHeader/);
  assert.match(appSource, /@container\/main flex flex-1 flex-col gap-2/);
  assert.match(appSource, /<SectionCards/);
  assert.match(appSource, /<div className="px-4 lg:px-6">\s*<ChartAreaInteractive \/>/);
  assert.match(appSource, /<ChartAreaInteractive/);
  assert.match(appSource, /<DataTable data=\{data\}/);
  assert.match(mainSource, /document\.documentElement\.classList\.add\("dark"\)/);
  assert.match(appSidebarSource, /from "@\/lib\/tabler-icons"/);
  assert.match(navMainSource, /from "@\/lib\/tabler-icons"/);
  assert.match(navUserSource, /from "@\/lib\/tabler-icons"/);
  assert.match(navDocumentsSource, /from "@\/lib\/tabler-icons"/);
  assert.doesNotMatch(appSidebarSource, /from "@tabler\/icons-react"/);
  assert.doesNotMatch(navMainSource, /from "@tabler\/icons-react"/);
  assert.doesNotMatch(navUserSource, /from "@tabler\/icons-react"/);
  assert.doesNotMatch(navDocumentsSource, /from "@tabler\/icons-react"/);
  assert.match(tablerIconsSource, /@tabler\/icons-react\/dist\/esm\/icons\/IconDashboard\.mjs/);
  assert.match(tablerIconsSource, /@tabler\/icons-react\/dist\/esm\/icons\/IconInnerShadowTop\.mjs/);
  assert.match(tablerIconTypesSource, /declare module "@tabler\/icons-react\/dist\/esm\/icons\/\*\.mjs"/);
  assert.match(appSidebarSource, /IconInnerShadowTop/);
  assert.match(appSidebarSource, /IconDashboard/);
  assert.match(appSidebarSource, /avatar:\s*"\.\/avatars\/shadcn\.svg"/);
  assert.match(appSidebarSource, /<SidebarHeader className="electron-window-drag pt-9">/);
  assert.match(appSidebarSource, /electron-window-no-drag/);
  assert.match(siteHeaderSource, /electron-window-drag/);
  assert.match(siteHeaderSource, /electron-window-no-drag/);
  assert.match(siteHeaderSource, /site-header-content/);
  assert.match(siteHeaderSource, /size="icon-xs"/);
  assert.match(siteHeaderSource, /text-sm font-medium leading-none/);
  assert.match(dropdownMenuSource, /modal\s*=\s*false/);
  for (const source of [
    dataTableSource,
    dropdownMenuSource,
    sectionCardsSource,
    selectSource,
    checkboxSource,
    sidebarSource,
    sonnerSource,
  ]) {
    assert.doesNotMatch(source, /from "lucide-react"/);
    assert.match(source, /from "@\/lib\/lucide-icons"/);
  }
  assert.match(lucideIconsSource, /lucide-react\/dist\/esm\/icons\/check\.mjs/);
  assert.match(lucideIconsSource, /lucide-react\/dist\/esm\/icons\/panel-left\.mjs/);
  assert.match(lucideIconTypesSource, /declare module "lucide-react\/dist\/esm\/icons\/\*\.mjs"/);
  for (const source of [dataTableSource, chartAreaSource, uiChartSource]) {
    assert.doesNotMatch(source, /from "recharts"/);
    assert.match(source, /from "@\/lib\/recharts"/);
  }
  assert.match(rechartsSource, /recharts\/es6\/chart\/AreaChart\.js/);
  assert.match(rechartsSource, /recharts\/es6\/component\/ResponsiveContainer\.js/);
  assert.match(rechartsTypesSource, /declare module "recharts\/es6\/chart\/AreaChart\.js"/);
  assert.match(cssSource, /@import "shadcn\/tailwind\.css"/);
  assert.match(cssSource, /--header-height:\s*3rem/);
  assert.match(cssSource, /\.dashboard-01-shell/);
  assert.match(cssSource, /body\s*\{[\s\S]*background:\s*var\(--sidebar\)/);
  assert.match(cssSource, /body\[data-scroll-locked\]\s*\{[\s\S]*margin-right:\s*0\s*!important/);
  assert.match(cssSource, /#root\s*\{[\s\S]*background:\s*var\(--sidebar\)/);
  assert.match(cssSource, /\.dashboard-01-shell\s*\{[\s\S]*background:\s*var\(--sidebar\)/);
  assert.match(cssSource, /\.dashboard-main-inset/);
  assert.match(cssSource, /\.dashboard-main-inset\s*\{[\s\S]*background:\s*var\(--background\)/);
  assert.match(cssSource, /margin:\s*0\s+0\s+calc\(var\(--spacing\)\s*\*\s*2\)/);
  assert.match(cssSource, /\.site-header-content\s*\{[\s\S]*padding-inline:\s*calc\(var\(--spacing\)\s*\*\s*4\)/);
  assert.match(cssSource, /\.site-header-content\s*\{[\s\S]*transform:\s*translateY\(calc\(var\(--spacing\)\s*\*\s*-0\.5\)\)/);
  assert.match(cssSource, /\[data-variant="inset"\]\[data-state="collapsed"\]\s*~\s*\.dashboard-main-inset\s+\.site-header-content\s*\{[\s\S]*padding-left:\s*calc\(var\(--spacing\)\s*\*\s*26\)/);
  assert.match(cssSource, /scrollbar-gutter:\s*stable/);
  assert.match(cssSource, /-webkit-app-region:\s*drag/);
  assert.match(cssSource, /::-webkit-scrollbar-thumb/);
});
