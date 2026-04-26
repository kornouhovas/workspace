import test from "node:test";
import assert from "node:assert/strict";
import { filterFolders, listDirectFolders, listStatusCards } from "../src/folderModel.js";

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

test("listStatusCards uses root child folders as statuses and their child folders as cards", async () => {
  const cards = await listStatusCards(
    fakeDirectoryHandle([
      {
        kind: "directory",
        name: "In Progress",
        values: async function* values() {
          yield { kind: "file", name: "notes.md" };
          yield { kind: "directory", name: "Prototype" };
          yield { kind: "directory", name: "Interview Notes" };
        },
      },
      {
        kind: "directory",
        name: "Backlog",
        values: async function* values() {
          yield { kind: "directory", name: "Landing Copy" };
        },
      },
      { kind: "file", name: "readme.md" },
    ]),
  );

  assert.deepEqual(cards, [
    {
      id: "status-backlog-folder-landing-copy",
      name: "Landing Copy",
      kind: "directory",
      status: "Backlog",
    },
    {
      id: "status-in-progress-folder-interview-notes",
      name: "Interview Notes",
      kind: "directory",
      status: "In Progress",
    },
    {
      id: "status-in-progress-folder-prototype",
      name: "Prototype",
      kind: "directory",
      status: "In Progress",
    },
  ]);
});
