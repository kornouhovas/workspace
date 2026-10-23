import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

const read = (path: string) => readFileSync(resolve(import.meta.dirname, path), "utf8");
const appInfo = {
  version: JSON.parse(read("package.json")).version,
  notices: [
    { title: "Third-party notices", content: read("THIRD_PARTY_NOTICES.txt") },
    { title: "bb — MIT", content: read("src/renderer/components/bb/LICENSE") },
    { title: "Drizzle ORM — Apache 2.0", content: read("licenses/Drizzle-Apache-2.0.txt") },
    { title: "Inter — SIL Open Font License 1.1", content: read("node_modules/@fontsource-variable/inter/LICENSE") },
  ],
};

export default defineConfig({
  define: { __WORKSPACE_APP_INFO__: JSON.stringify(appInfo) },
  root: resolve(import.meta.dirname, "src/renderer"),
  base: "./",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: resolve(import.meta.dirname, "dist/renderer"),
    emptyOutDir: true,
  },
});
