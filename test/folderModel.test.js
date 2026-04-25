import test from "node:test";
import assert from "node:assert/strict";
import { filterFolders, listDirectFolders } from "../src/folderModel.js";

function fakeDirectoryHandle(entries) {
  return {
    async *values() {
      for (const entry of entries) {
        yield entry;
      }
    },
  };
}

test("listDirectFolders returns only direct directory entries sorted by name", async () => {
  const folders = await listDirectFolders(
    fakeDirectoryHandle([
      { kind: "file", name: "notes.md" },
      { kind: "directory", name: "zeta" },
      { kind: "directory", name: "Alpha" },
    ]),
  );

  assert.deepEqual(folders, [
    { id: "folder-alpha", name: "Alpha", kind: "directory" },
    { id: "folder-zeta", name: "zeta", kind: "directory" },
  ]);
});

test("filterFolders matches folder names case-insensitively", () => {
  const folders = [
    { id: "folder-app", name: "app", kind: "directory" },
    { id: "folder-docs", name: "docs", kind: "directory" },
  ];

  assert.deepEqual(filterFolders(folders, "DO"), [
    { id: "folder-docs", name: "docs", kind: "directory" },
  ]);
});
