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
    const role = normalizeFolderRole(rule.role);
    const children = rule.role === "card" ? [] : await listDirectoryTree(directory, pathParts, rules);

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
      context.cards.push({
        id: createFolderIdFromPath(node.path),
        name: node.name,
        kind: "directory",
        status: context.parentGroup,
        path: node.path,
      });
      continue;
    }

    collectAccessTreeCards(node.children || [], {
      cards: context.cards,
      parentGroup: node.role === "status" ? node.name : context.parentGroup,
      ancestorsAccess: true,
    });
  }
}

function normalizeFolderAccessRules(rules) {
  return rules && typeof rules === "object" ? rules : {};
}

function normalizeFolderRole(role) {
  return role === "status" || role === "group" ? role : "card";
}

function createStatusId(name) {
  return createFolderId(name).replace(/^folder-/, "status-");
}

function createFolderIdFromPath(path) {
  return createFolderId(path.replace(/\//g, "-"));
}

function createFolderId(name) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `folder-${slug || "untitled"}`;
}
