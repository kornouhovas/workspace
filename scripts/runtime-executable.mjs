import { join } from "node:path";

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
