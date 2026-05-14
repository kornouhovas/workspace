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
    lucideIconsSource,
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
    readProjectFile("src/lib/lucide-icons.ts"),
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
  assert.match(appSource, /from "@\/components\/workspace\/states"/);
  assert.match(appSource, /Workspace Project Board/);
  assert.match(appSource, /<WorkspaceLeftPanel/);
  assert.match(appSource, /data-testid="workspace-main"/);
  assert.match(appSource, /electron-window-drag/);
  assert.match(appSource, /electron-window-no-drag/);
  assert.doesNotMatch(appSource, /app\/dashboard\/data\.json/);
  assert.doesNotMatch(appSource, /ChartAreaInteractive/);
  assert.doesNotMatch(appSource, /SectionCards/);
  assert.doesNotMatch(appSource, /DataTable/);
  assert.doesNotMatch(appSource, /SidebarProvider/);

  assert.match(leftPanelSource, /Add Workspace/);
  assert.match(leftPanelSource, /Search/);
  assert.match(leftPanelSource, /Workspaces/);
  assert.match(leftPanelSource, /Settings/);
  assert.match(leftPanelSource, /from "@\/lib\/lucide-icons"/);
  assert.match(statesSource, /No source folder selected/);
  assert.match(statesSource, /Open Settings/);

  assert.match(mainSource, /document\.documentElement\.classList\.add\("dark"\)/);
  assert.match(lucideIconsSource, /lucide-react\/dist\/esm\/icons\/folder-kanban\.mjs/);
  assert.match(lucideIconsSource, /lucide-react\/dist\/esm\/icons\/search\.mjs/);
  assert.match(lucideIconsSource, /lucide-react\/dist\/esm\/icons\/settings\.mjs/);
  assert.match(cssSource, /@import "shadcn\/tailwind\.css"/);
  assert.match(cssSource, /-webkit-app-region:\s*drag/);
  assert.match(cssSource, /::-webkit-scrollbar-thumb/);
});
