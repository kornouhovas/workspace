import { readProjectSession, writeProjectSession } from "./workspaceProjectSession.js";
import { readPaneLayouts, readSidebarWidth, writePaneLayouts, writeSidebarWidth } from "./workspacePaneLayout.js";

// The concrete browser adapter is supplied by the composition root. Readers
// and writers preserve the existing formats and tolerate unavailable storage.
export function createWorkspaceSessionStorage(storage) {
  return {
    read() {
      const saved = readProjectSession(storage);
      const layouts = readPaneLayouts(storage);
      return { ...saved, layouts, sidebarWidth: readSidebarWidth(storage, layouts) };
    },
    write(snapshot, screens) {
      const panes = writePaneLayouts(storage, snapshot.layouts);
      const sidebar = writeSidebarWidth(storage, snapshot.sidebarWidth);
      const projects = writeProjectSession(storage, snapshot.tabs, screens);
      return panes && sidebar && projects;
    },
    writeChrome(snapshot) {
      const panes = writePaneLayouts(storage, snapshot.layouts);
      const sidebar = writeSidebarWidth(storage, snapshot.sidebarWidth);
      return panes && sidebar;
    },
  };
}
