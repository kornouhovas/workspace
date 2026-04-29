import { existsSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { spawn } from "node:child_process";

const previewExtensions = new Set([
  "avif",
  "css",
  "csv",
  "gif",
  "htm",
  "html",
  "jpeg",
  "jpg",
  "js",
  "json",
  "md",
  "mov",
  "mp3",
  "mp4",
  "pdf",
  "png",
  "svg",
  "txt",
  "webm",
  "webp",
  "xml",
]);

export function resolveWorkspacePath(root, relativePath) {
  if (typeof relativePath !== "string" || relativePath.length === 0) {
    throw new Error("Missing relative path.");
  }

  if (isAbsolute(relativePath)) {
    throw new Error("Expected a relative path.");
  }

  const resolvedRoot = resolve(root);
  const targetPath = resolve(resolvedRoot, relativePath);
  const rootRelativePath = relative(resolvedRoot, targetPath);
  if (rootRelativePath.startsWith("..") || isAbsolute(rootRelativePath)) {
    throw new Error("Path is outside workspace root.");
  }

  return targetPath;
}

export function getMacOpenCommand(targetPath, kind) {
  return { command: "open", args: [targetPath] };
}

export function isPreviewablePath(path) {
  if (typeof path !== "string") {
    return false;
  }

  const extension = path.toLowerCase().split(".").pop();
  return previewExtensions.has(extension);
}

export async function createRevealResponse({ body, root, platform = process.platform, spawnCommand = spawnLocalCommand }) {
  try {
    const kind = body?.kind;
    if (kind !== "directory" && kind !== "file") {
      return createJsonResponse(400, { error: "Expected kind to be directory or file." });
    }

    if (platform !== "darwin") {
      return createJsonResponse(501, { error: "Opening local items is currently implemented for macOS only." });
    }

    const targetPath = resolveWorkspacePath(root, body?.path);
    if (!existsSync(targetPath)) {
      return createJsonResponse(404, { error: "Local item was not found." });
    }

    const stat = statSync(targetPath);
    if (kind === "directory" && !stat.isDirectory()) {
      return createJsonResponse(400, { error: "Expected a directory." });
    }

    if (kind === "file" && !stat.isFile()) {
      return createJsonResponse(400, { error: "Expected a file." });
    }

    const { command, args } = getMacOpenCommand(targetPath, kind);
    await spawnCommand(command, args);

    return createJsonResponse(200, { ok: true });
  } catch (error) {
    return createJsonResponse(400, { error: error.message || "Could not open local item." });
  }
}

function createJsonResponse(status, payload) {
  return { status, payload };
}

function spawnLocalCommand(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: "ignore" });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      reject(new Error(`Command exited with code ${code}.`));
    });
  });
}
