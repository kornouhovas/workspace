import { createReadStream, existsSync, statSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, extname, join } from "node:path";
import { spawn } from "node:child_process";
import { flattenAccessTreeCards } from "./folderModel.js";
import { isPreviewablePath, resolveWorkspacePath } from "./localOpen.js";

export const defaultWorkspaceSettingsPath = join(process.cwd(), ".folder-kanban", "settings.json");

const fileContentTypes = {
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".gif": "image/gif",
  ".htm": "text/html; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webm": "video/webm",
  ".webp": "image/webp",
  ".xml": "application/xml; charset=utf-8",
};

export async function createRootResponse({ configPath = defaultWorkspaceSettingsPath } = {}) {
  const settings = await readWorkspaceSettings(configPath);
  if (!settings.rootPath || !existsSync(settings.rootPath)) {
    return createJsonResponse(200, { root: null });
  }

  return createJsonResponse(200, { root: createRootPayload(settings.rootPath) });
}

export async function createSelectRootResponse({
  configPath = defaultWorkspaceSettingsPath,
  chooseRoot = chooseMacWorkspaceRoot,
} = {}) {
  const rootPath = await chooseRoot();
  if (!rootPath) {
    return createJsonResponse(400, { error: "No folder selected." });
  }

  await writeWorkspaceSettings(configPath, { rootPath });
  return createJsonResponse(200, { root: createRootPayload(rootPath) });
}

export async function createScanResponse({ root, rules = {} }) {
  try {
    if (!root || !existsSync(root) || !statSync(root).isDirectory()) {
      return createJsonResponse(404, { error: "Workspace root was not found." });
    }

    const tree = await listWorkspaceAccessTree(root, rules);
    const folders = flattenAccessTreeCards(tree, { rootStatus: basename(root) });
    return createJsonResponse(200, {
      root: createRootPayload(root),
      tree,
      folders,
    });
  } catch (error) {
    return createJsonResponse(400, { error: error.message || "Could not scan workspace root." });
  }
}

export async function createListEntriesResponse({ root, body }) {
  try {
    if (!root) {
      return createJsonResponse(404, { error: "Workspace root was not selected." });
    }

    const targetPath = resolveWorkspaceEntryPath(root, body?.path || "");
    if (!existsSync(targetPath) || !statSync(targetPath).isDirectory()) {
      return createJsonResponse(404, { error: "Folder was not found." });
    }

    const entries = await listWorkspaceEntries(root, body?.path || "");
    return createJsonResponse(200, { entries });
  } catch (error) {
    return createJsonResponse(400, { error: error.message || "Could not list folder." });
  }
}

export async function createFileResponse({ root, path }) {
  try {
    if (!root) {
      return createJsonResponse(404, { error: "Workspace root was not selected." });
    }

    if (!isPreviewablePath(path)) {
      return createJsonResponse(415, { error: "File type is not previewable." });
    }

    const filePath = resolveWorkspacePath(root, path);
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      return createJsonResponse(404, { error: "File was not found." });
    }

    return {
      status: 200,
      filePath,
      contentType: fileContentTypes[extname(filePath).toLowerCase()] || "application/octet-stream",
      stream: createReadStream(filePath),
    };
  } catch (error) {
    return createJsonResponse(400, { error: error.message || "Could not open file." });
  }
}

export async function readWorkspaceSettings(configPath = defaultWorkspaceSettingsPath) {
  try {
    return JSON.parse(await readFile(configPath, "utf8"));
  } catch (error) {
    return {};
  }
}

export async function writeWorkspaceSettings(configPath, settings) {
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(settings, null, 2)}\n`);
}

export async function chooseMacWorkspaceRoot() {
  const script = 'POSIX path of (choose folder with prompt "Choose workspace root")';
  const output = await runCommand("osascript", ["-e", script]);
  return output.trim();
}

async function listWorkspaceAccessTree(root, rules, parentPath = []) {
  const directoryPath = parentPath.length > 0 ? resolveWorkspacePath(root, parentPath.join("/")) : root;
  const entries = await readVisibleDirectoryEntries(directoryPath);
  const nodes = [];

  for (const entry of entries.filter((item) => item.isDirectory())) {
    const pathParts = [...parentPath, entry.name];
    const path = pathParts.join("/");
    const rule = rules?.[path] || {};
    const role = normalizeFolderRole(rule.role);
    const children = role === "card" ? [] : await listWorkspaceAccessTree(root, rules, pathParts);

    nodes.push({
      id: createFolderIdFromPath(path),
      name: entry.name,
      kind: "directory",
      path,
      access: rule.access !== false,
      role,
      expanded: rule.expanded === true,
      children,
    });
  }

  return nodes;
}

async function listWorkspaceEntries(root, folderPath) {
  const targetPath = resolveWorkspaceEntryPath(root, folderPath);
  const entries = await readVisibleDirectoryEntries(targetPath);

  return entries
    .filter((entry) => entry.isDirectory() || entry.isFile())
    .map((entry) => {
      const kind = entry.isDirectory() ? "directory" : "file";
      const path = [folderPath, entry.name].filter(Boolean).join("/");
      return {
        id: createEntryId(kind, path),
        name: entry.name,
        kind,
        path,
      };
    })
    .sort(compareFolderEntries);
}

async function readVisibleDirectoryEntries(directoryPath) {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  return entries
    .filter((entry) => !entry.name.startsWith("."))
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" }));
}

function resolveWorkspaceEntryPath(root, relativePath) {
  return relativePath ? resolveWorkspacePath(root, relativePath) : root;
}

function createRootPayload(rootPath) {
  return {
    name: basename(rootPath),
  };
}

function compareFolderEntries(left, right) {
  if (left.kind !== right.kind) {
    return left.kind === "directory" ? -1 : 1;
  }

  return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
}

function normalizeFolderRole(role) {
  return role === "status" || role === "group" ? role : "card";
}

function createFolderIdFromPath(path) {
  return createFolderId(path.replace(/\//g, "-"));
}

function createEntryId(kind, path) {
  return `${kind}-${createFolderId(path.replace(/\//g, "-")).replace(/^folder-/, "")}`;
}

function createFolderId(name) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `folder-${slug || "untitled"}`;
}

function createJsonResponse(status, payload) {
  return { status, payload };
}

function runCommand(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: homedir(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) {
        resolvePromise(stdout);
        return;
      }

      reject(new Error(stderr.trim() || `Command exited with code ${code}.`));
    });
  });
}
