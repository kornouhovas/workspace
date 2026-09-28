import { register } from "node:module";
register(new URL("./disable-fsevents-loader.mjs", import.meta.url), import.meta.url);
await import(new URL("../node_modules/@ladle/react/lib/cli/cli.js", import.meta.url));
