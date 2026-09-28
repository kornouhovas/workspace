import { resolve, join } from "node:path";

// Opt-in desktop development only. Production keeps its existing storage paths.
export function getDevelopmentRuntime({ env = process.env, checkout }) {
  if (env.WORKSPACE_DEV !== "1") return null;
  let rendererUrl = null;
  if (env.WORKSPACE_DEV_URL) {
    const url = new URL(env.WORKSPACE_DEV_URL);
    if (
      url.protocol !== "http:" ||
      url.hostname !== "127.0.0.1" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      throw new Error("Development renderer must use an HTTP loopback origin (127.0.0.1).");
    }
    rendererUrl = url.href;
  }
  const dataDirectory = resolve(checkout, env.WORKSPACE_DEV_DATA || ".workspace-dev");
  if (
    dataDirectory.split(/[\\/]/).some((part) => part === ".workspace" || part === ".folder-kanban")
  ) {
    throw new Error("Development data must use an isolated directory outside production metadata.");
  }
  return {
    rendererUrl,
    dataDirectory,
    userData: join(dataDirectory, "electron"),
    storage: {
      configPath: join(dataDirectory, "settings.json"),
      viewStorePath: join(dataDirectory, "views.json"),
      propertyStorePath: join(dataDirectory, "properties.json"),
    },
  };
}
