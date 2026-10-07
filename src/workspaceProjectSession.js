const storageKey = "workspace.project-tabs.v1";
const record = value => value !== null && typeof value === "object" && !Array.isArray(value);

export function readProjectSession(storage) {
  const empty = { tabs: {}, screens: {} };
  try {
    const raw = JSON.parse(storage.getItem(storageKey) || "null");
    if (!record(raw) || ![1, 2].includes(raw.version) || !record(raw.tabs)) return empty;
    const tabs = Object.fromEntries(Object.entries(raw.tabs).map(([workspaceId, projects]) => {
      const seen = new Set();
      const valid = (Array.isArray(projects) ? projects : []).map(project => record(project) ? { ...project, tabId: raw.version === 1 ? `legacy:${project.id}` : project.tabId } : project).filter(project => {
        if (!record(project) || typeof project.id !== "string" || !project.id || typeof project.tabId !== "string" || !project.tabId || seen.has(project.tabId)
          || typeof project.name !== "string" || typeof project.currentRelativePath !== "string"
          || !record(project.status) || typeof project.status.id !== "string" || typeof project.status.name !== "string"
          || !record(project.propertyValues)) return false;
        seen.add(project.tabId);
        return true;
      }).map(project => ({ ...project, fileTree: [] }));
      return [workspaceId, valid];
    }));
    const screens = Object.fromEntries(Object.entries(record(raw.screens) ? raw.screens : {}).filter(([, screen]) => record(screen)).map(([id, screen]) => [id, {
      previewId: typeof screen.previewId === "string" ? screen.previewId : null,
      previewByView: Object.fromEntries(Object.entries(record(screen.previewByView) ? screen.previewByView :
        typeof screen.viewId === "string" && !screen.tabId ? { [screen.viewId]: screen.previewId ?? null } : {}).filter(([, id]) => id === null || typeof id === "string" && id.length > 0)),
      fullScreen: screen.fullScreen === true,
      viewId: typeof screen.viewId === "string" ? screen.viewId : null,
      tabId: (Object.hasOwn(tabs, id) ? tabs[id] : [])?.find(project => raw.version === 1 ? project.id === screen.projectId : project.tabId === screen.tabId)?.tabId || null,
    }]));
    return { tabs, screens };
  } catch { return empty; }
}

export function writeProjectSession(storage, tabs, screens) {
  try {
    const snapshots = Object.fromEntries(Object.entries(tabs).filter(([id]) => id !== "preview").map(([id, projects]) => [id,
      projects.map(({ fileTree, ...project }) => project),
    ]));
    storage.setItem(storageKey, JSON.stringify({ version: 2, tabs: snapshots, screens }));
    return true;
  } catch { return false; }
}
