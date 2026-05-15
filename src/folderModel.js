export async function listDirectFolders(directoryHandle) {
  const folders = [];

  for await (const entry of directoryHandle.values()) {
    if (entry.kind === "directory") {
      folders.push({
        id: createFolderId(entry.name),
        name: entry.name,
        kind: entry.kind,
      });
    }
  }

  return folders.sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: "base" }),
  );
}

export async function listStatusCards(directoryHandle) {
  const cards = [];
  const statuses = [];

  for await (const entry of directoryHandle.values()) {
    if (entry.kind === "directory") {
      statuses.push(entry);
    }
  }

  statuses.sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" }));

  for (const status of statuses) {
    for await (const entry of status.values()) {
      if (entry.kind === "directory") {
        cards.push({
          id: `${createStatusId(status.name)}-${createFolderId(entry.name)}`,
          name: entry.name,
          kind: entry.kind,
          status: status.name,
        });
      }
    }
  }

  return cards.sort((left, right) => {
    const statusSort = left.status.localeCompare(right.status, undefined, { sensitivity: "base" });
    if (statusSort !== 0) {
      return statusSort;
    }

    return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
  });
}

export async function listFolderAccessTree(directoryHandle, options = {}) {
  return listDirectoryTree(directoryHandle, [], normalizeFolderAccessRules(options.rules));
}

export async function listFolderEntries(directoryHandle, folderPath) {
  const targetDirectory = await findDirectoryHandle(directoryHandle, folderPath);
  const entries = [];

  for await (const entry of targetDirectory.values()) {
    if ((entry.kind === "directory" || entry.kind === "file") && !isHiddenEntryName(entry.name)) {
      const path = [...splitFolderPath(folderPath), entry.name].join("/");
      entries.push({
        id: createEntryId(entry.kind, path),
        name: entry.name,
        kind: entry.kind,
        path,
      });
    }
  }

  return entries.sort(compareFolderEntries);
}

export async function getFileHandleByPath(directoryHandle, filePath) {
  const pathParts = splitFolderPath(filePath);
  const fileName = pathParts.pop();
  if (!fileName || isHiddenEntryName(fileName)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const parentHandle = await findDirectoryHandle(directoryHandle, pathParts.join("/"));
  for await (const entry of parentHandle.values()) {
    if (entry.kind === "file" && entry.name === fileName && !isHiddenEntryName(entry.name)) {
      return entry;
    }
  }

  throw new Error(`File not found: ${filePath}`);
}

export function flattenAccessTreeCards(tree, options = {}) {
  const cards = [];
  const rootStatus = options.rootStatus || "Client Projects";

  collectAccessTreeCards(tree, {
    cards,
    parentGroup: rootStatus,
    ancestorsAccess: true,
  });

  return cards;
}

export function filterFolders(folders, query) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return folders;
  }

  return folders.filter((folder) => folder.name.toLowerCase().includes(normalizedQuery));
}

async function findDirectoryHandle(directoryHandle, folderPath) {
  let currentHandle = directoryHandle;

  for (const pathPart of splitFolderPath(folderPath)) {
    currentHandle = await findChildDirectoryHandle(currentHandle, pathPart);
  }

  return currentHandle;
}

async function findChildDirectoryHandle(directoryHandle, folderName) {
  for await (const entry of directoryHandle.values()) {
    if (entry.kind === "directory" && entry.name === folderName) {
      return entry;
    }
  }

  throw new Error(`Folder not found: ${folderName}`);
}

async function listDirectoryTree(directoryHandle, parentPath, rules) {
  const directories = [];

  for await (const entry of directoryHandle.values()) {
    if (entry.kind === "directory") {
      directories.push(entry);
    }
  }

  directories.sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" }));

  const nodes = [];
  for (const directory of directories) {
    const pathParts = [...parentPath, directory.name];
    const path = pathParts.join("/");
    const rule = rules[path] || {};
    const role = normalizeFolderRole(rule.role, parentPath.length);
    const children = role === "card" ? [] : await listDirectoryTree(directory, pathParts, rules);

    nodes.push({
      id: createFolderIdFromPath(path),
      name: directory.name,
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

function collectAccessTreeCards(nodes, context) {
  for (const node of nodes) {
    const hasAccess = context.ancestorsAccess && node.access;
    if (!hasAccess) {
      continue;
    }

    if (node.role === "card") {
      const card = {
        id: createFolderIdFromPath(node.path),
        name: node.name,
        kind: "directory",
        status: context.parentGroup,
        path: node.path,
      };

      if (Array.isArray(node.fileTree)) {
        card.fileTree = node.fileTree;
      }

      context.cards.push(card);
      continue;
    }

    collectAccessTreeCards(node.children || [], {
      cards: context.cards,
      parentGroup: node.role === "status" ? node.name : context.parentGroup,
      ancestorsAccess: true,
    });
  }
}

function compareFolderEntries(left, right) {
  if (left.kind !== right.kind) {
    return left.kind === "directory" ? -1 : 1;
  }

  return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
}

function normalizeFolderAccessRules(rules) {
  return rules && typeof rules === "object" ? rules : {};
}

function normalizeFolderRole(role, depth = 0) {
  if (role === "status" || role === "group") {
    return role;
  }
  if (role === "card") {
    return "card";
  }

  return depth === 0 ? "status" : "card";
}

function createStatusId(name) {
  return createFolderId(name).replace(/^folder-/, "status-");
}

function createFolderIdFromPath(path) {
  return createFolderId(path.replace(/\//g, "-"));
}

function createEntryId(kind, path) {
  return `${kind}-${createFolderId(path.replace(/\//g, "-")).replace(/^folder-/, "")}`;
}

function splitFolderPath(path) {
  return typeof path === "string" && path ? path.split("/").filter(Boolean) : [];
}

function isHiddenEntryName(name) {
  return typeof name === "string" && name.startsWith(".");
}

function createFolderId(name) {
  const slug = String(name ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-|-$/g, "");

  return `folder-${slug || "untitled"}`;
}
