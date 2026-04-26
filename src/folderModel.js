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

export function filterFolders(folders, query) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return folders;
  }

  return folders.filter((folder) => folder.name.toLowerCase().includes(normalizedQuery));
}

function createStatusId(name) {
  return createFolderId(name).replace(/^folder-/, "status-");
}

function createFolderId(name) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `folder-${slug || "untitled"}`;
}
