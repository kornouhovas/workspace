import { cp, mkdir } from "node:fs/promises";

const outputDirectory = "dist/service/db/migrations";
await mkdir(outputDirectory, { recursive: true });
await cp("src/service/db/migrations", outputDirectory, { recursive: true });
