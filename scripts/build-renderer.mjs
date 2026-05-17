import { register } from "node:module";
import { pathToFileURL } from "node:url";

register(new URL("./disable-fsevents-loader.mjs", import.meta.url), pathToFileURL("./"));

const { build } = await import("vite");

await build({
  clearScreen: false,
});
