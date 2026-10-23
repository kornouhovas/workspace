import { join } from "node:path";
import { createRequire } from "node:module";

// Principal UI journeys keep their development default; milestone acceptance
// explicitly selects the built application with no source-directory argument.
export function runtimeSmokeLaunch(root, mode = process.env.WORKSPACE_SMOKE_MODE ?? "dev") {
  if (mode === "release") return {
    executablePath: packagedExecutablePath(root, process.platform, process.arch), args: [],
  };
  if (mode === "dev") return { executablePath: createRequire(import.meta.url)("electron"), args: [root] };
  throw new Error(`Unsupported smoke mode: ${mode}`);
}

export function packagedExecutablePath(root, platform, arch) {
  const archSuffix = arch === "x64" ? "" : `-${arch}`;
  if (platform === "darwin") {
    return join(root, "release", `mac${archSuffix}`, "Workspace.app", "Contents", "MacOS", "Workspace");
  }
  if (platform === "win32") {
    return join(root, "release", `win${archSuffix}-unpacked`, "Workspace.exe");
  }
  throw new Error(`Unsupported desktop platform: ${platform}`);
}
