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

export function filterFolders(folders, query) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return folders;
  }

  return folders.filter((folder) => folder.name.toLowerCase().includes(normalizedQuery));
}

function createFolderId(name) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `folder-${slug || "untitled"}`;
}
