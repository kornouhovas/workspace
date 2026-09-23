import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createRevealResponse,
  getMacOpenCommand,
  isPreviewablePath,
  resolveExistingWorkspacePath,
  resolveWorkspacePath,
} from "../src/localOpen.js";

test("resolveWorkspacePath only allows relative paths inside the workspace root", () => {
  const root = "/Users/example/projects";

  assert.equal(resolveWorkspacePath(root, "Cards/Brief.pdf"), "/Users/example/projects/Cards/Brief.pdf");
  assert.throws(() => resolveWorkspacePath(root, "../Secrets/Brief.pdf"), /outside workspace root/);
  assert.throws(() => resolveWorkspacePath(root, "../../projects-copy/Brief.pdf"), /outside workspace root/);
  assert.throws(() => resolveWorkspacePath(root, "/Users/example/Secrets/Brief.pdf"), /relative path/);
  assert.throws(() => resolveWorkspacePath(root, ""), /Missing relative path/);
  assert.throws(() => resolveWorkspacePath(root, null), /Missing relative path/);
});

test("getMacOpenCommand opens folders and files in macOS", () => {
  assert.deepEqual(getMacOpenCommand("/tmp/Workspace/Card", "directory"), {
    command: "open",
    args: ["/tmp/Workspace/Card"],
  });
  assert.deepEqual(getMacOpenCommand("/tmp/Workspace/Card/Brief.pdf", "file"), {
    command: "open",
    args: ["/tmp/Workspace/Card/Brief.pdf"],
  });
});

test("isPreviewablePath recognizes browser preview file types", () => {
  assert.equal(isPreviewablePath("Brief.PDF"), true);
  assert.equal(isPreviewablePath("image.png"), true);
  assert.equal(isPreviewablePath("notes.md"), true);
  assert.equal(isPreviewablePath("archive.zip"), false);
});

test("createRevealResponse validates path, kind, and existing item before spawning", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "workspace-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "Card"));
  await writeFile(join(root, "Card", "Brief.pdf"), "pdf");
  const calls = [];

  const fileResponse = await createRevealResponse({
    body: { path: "Card/Brief.pdf", kind: "file" },
    root,
    platform: "darwin",
    spawnCommand: async (command, args) => {
      calls.push({ command, args });
    },
  });

  assert.equal(fileResponse.status, 200);
  assert.deepEqual(calls, [{ command: "open", args: [join(root, "Card", "Brief.pdf")] }]);

  const traversalResponse = await createRevealResponse({
    body: { path: "../Brief.pdf", kind: "file" },
    root,
    platform: "darwin",
    spawnCommand: async () => {
      throw new Error("should not spawn");
    },
  });

  assert.equal(traversalResponse.status, 400);

  const wrongKindResponse = await createRevealResponse({
    body: { path: "Card/Brief.pdf", kind: "directory" },
    root,
    platform: "darwin",
    spawnCommand: async () => {
      throw new Error("should not spawn");
    },
  });
  assert.equal(wrongKindResponse.status, 400);

  const unsupportedPlatformResponse = await createRevealResponse({
    body: { path: "Card/Brief.pdf", kind: "file" },
    root,
    platform: "linux",
    spawnCommand: async () => {
      throw new Error("should not spawn");
    },
  });
  assert.equal(unsupportedPlatformResponse.status, 501);
});

test("resolveExistingWorkspacePath rejects symlinks that escape the workspace root", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "workspace-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const outside = await mkdtemp(join(tmpdir(), "workspace-outside-"));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await writeFile(join(outside, "Secret.pdf"), "secret");
  await symlink(join(outside, "Secret.pdf"), join(root, "Secret.pdf"));

  assert.throws(() => resolveExistingWorkspacePath(root, "Secret.pdf"), /outside workspace root/);
});

test("createRevealResponse does not spawn escaped or broken symlink targets", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "workspace-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const outside = await mkdtemp(join(tmpdir(), "workspace-outside-"));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await writeFile(join(outside, "Secret.pdf"), "secret");
  await symlink(join(outside, "Secret.pdf"), join(root, "Escaped.pdf"));
  await symlink(join(outside, "Missing.pdf"), join(root, "Broken.pdf"));
  const calls = [];
  const spawnCommand = async (...args) => calls.push(args);

  const escapedResponse = await createRevealResponse({
    body: { path: "Escaped.pdf", kind: "file" },
    root,
    platform: "darwin",
    spawnCommand,
  });
  const brokenResponse = await createRevealResponse({
    body: { path: "Broken.pdf", kind: "file" },
    root,
    platform: "darwin",
    spawnCommand,
  });

  assert.equal(escapedResponse.status, 400);
  assert.equal(brokenResponse.status, 404);
  assert.deepEqual(calls, []);
});
