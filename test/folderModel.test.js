import test from "node:test";
import assert from "node:assert/strict";
import {
  filterFolders,
  flattenAccessTreeCards,
  listDirectFolders,
  listFolderAccessTree,
  listStatusCards,
} from "../src/folderModel.js";

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

test("listFolderAccessTree recursively builds access rules for nested folders", async () => {
  const tree = await listFolderAccessTree(
    fakeDirectoryHandle([
      {
        kind: "directory",
        name: "Archive",
        values: async function* values() {
          yield {
            kind: "directory",
            name: "Completed",
            values: async function* values() {
              yield { kind: "directory", name: "Acme redesign", values: fakeDirectoryHandle([]).values };
              yield { kind: "file", name: "notes.md" };
            },
          };
        },
      },
      { kind: "directory", name: "Active", values: fakeDirectoryHandle([]).values },
    ]),
    {
      rules: {
        Archive: { role: "group", expanded: true },
        "Archive/Completed": { role: "status", expanded: true },
        "Archive/Completed/Acme redesign": { access: false },
      },
    },
  );

  assert.deepEqual(tree, [
    {
      id: "folder-active",
      name: "Active",
      kind: "directory",
      path: "Active",
      access: true,
      role: "card",
      expanded: false,
      children: [],
    },
    {
      id: "folder-archive",
      name: "Archive",
      kind: "directory",
      path: "Archive",
      access: true,
      role: "group",
      expanded: true,
      children: [
        {
          id: "folder-archive-completed",
          name: "Completed",
          kind: "directory",
          path: "Archive/Completed",
          access: true,
          role: "status",
          expanded: true,
          children: [
            {
              id: "folder-archive-completed-acme-redesign",
              name: "Acme redesign",
              kind: "directory",
              path: "Archive/Completed/Acme redesign",
              access: false,
              role: "card",
              expanded: false,
              children: [],
            },
          ],
        },
      ],
    },
  ]);
});

test("listFolderAccessTree treats explicitly configured card folders as scan leaves", async () => {
  const tree = await listFolderAccessTree(
    fakeDirectoryHandle([
      {
        kind: "directory",
        name: "Client app",
        values: async function* values() {
          throw new Error("Card folder descendants should not be scanned");
        },
      },
    ]),
    {
      rules: {
        "Client app": { role: "card" },
      },
    },
  );

  assert.deepEqual(tree, [
    {
      id: "folder-client-app",
      name: "Client app",
      kind: "directory",
      path: "Client app",
      access: true,
      role: "card",
      expanded: false,
      children: [],
    },
  ]);
});

test("flattenAccessTreeCards uses status folders as statuses and skips status containers", () => {
  const cards = flattenAccessTreeCards([
    {
      name: "Archive",
      path: "Archive",
      access: true,
      role: "group",
      children: [
        {
          name: "Completed",
          path: "Archive/Completed",
          access: true,
          role: "status",
          children: [
            { name: "Acme redesign", path: "Archive/Completed/Acme redesign", access: true, role: "card", children: [] },
            { name: "Old concepts", path: "Archive/Completed/Old concepts", access: false, role: "card", children: [] },
          ],
        },
      ],
    },
    { name: "Internal", path: "Internal", access: true, role: "card", children: [] },
  ]);

  assert.deepEqual(cards, [
    {
      id: "folder-archive-completed-acme-redesign",
      name: "Acme redesign",
      kind: "directory",
      status: "Completed",
      path: "Archive/Completed/Acme redesign",
    },
    {
      id: "folder-internal",
      name: "Internal",
      kind: "directory",
      status: "Client Projects",
      path: "Internal",
    },
  ]);
});

test("flattenAccessTreeCards treats group folders as transparent storage containers", () => {
  const cards = flattenAccessTreeCards([
    {
      name: "Archive",
      path: "Archive",
      access: true,
      role: "group",
      children: [
        {
          name: "Finished",
          path: "Archive/Finished",
          access: true,
          role: "group",
          children: [
            {
              name: "Acme redesign",
              path: "Archive/Finished/Acme redesign",
              access: true,
              role: "card",
              children: [],
            },
          ],
        },
      ],
    },
  ]);

  assert.deepEqual(cards, [
    {
      id: "folder-archive-finished-acme-redesign",
      name: "Acme redesign",
      kind: "directory",
      status: "Client Projects",
      path: "Archive/Finished/Acme redesign",
    },
  ]);
});

test("flattenAccessTreeCards treats a card folder as a leaf even when it has child folders", () => {
  const cards = flattenAccessTreeCards([
    {
      name: "Client app",
      path: "Client app",
      access: true,
      role: "card",
      children: [
        {
          name: "Nested project",
          path: "Client app/Nested project",
          access: true,
          role: "card",
          children: [],
        },
      ],
    },
  ]);

  assert.deepEqual(cards, [
    {
      id: "folder-client-app",
      name: "Client app",
      kind: "directory",
      status: "Client Projects",
      path: "Client app",
    },
  ]);
});
