import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { realpathSync } from 'node:fs';

// Seed the historical four-column views schema. The current service deliberately
// requires its current migrations for workspace/view lifecycle operations.
export function historicalWorkspace(path, root, name = 'Before') {
  const sql = new Database(path), sourceId = randomUUID(), workspaceId = randomUUID(), viewId = randomUUID();
  const canonicalRoot = realpathSync.native(root);
  try {
    sql.pragma('foreign_keys = ON');
    sql.transaction(() => {
      sql.prepare('INSERT INTO sources (id, canonical_root) VALUES (?, ?)').run(sourceId, canonicalRoot);
      sql.prepare('INSERT INTO workspaces (id, name, source_id, position) VALUES (?, ?, ?, 0)').run(workspaceId, name, sourceId);
      sql.prepare("INSERT INTO views (id, workspace_id, name, kind) VALUES (?, ?, 'Table', 'table')").run(viewId, workspaceId);
      sql.prepare("INSERT INTO active_workspace VALUES ('active', ?, ?)").run(workspaceId, viewId);
    })();
    return { sourceId, workspaceId, viewId, name, canonicalRoot };
  } finally { sql.close(); }
}
