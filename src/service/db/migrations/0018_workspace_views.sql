ALTER TABLE views ADD COLUMN position INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
UPDATE views SET position = (SELECT count(*) FROM views AS preceding WHERE preceding.workspace_id = views.workspace_id AND preceding.id < views.id);
--> statement-breakpoint
CREATE TABLE workspace_view_selection (
  workspace_id TEXT PRIMARY KEY NOT NULL REFERENCES workspaces(id),
  view_id TEXT NOT NULL REFERENCES views(id)
);
--> statement-breakpoint
INSERT INTO workspace_view_selection(workspace_id, view_id)
SELECT w.id, COALESCE((SELECT a.view_id FROM active_workspace a WHERE a.workspace_id = w.id),
 (SELECT v.id FROM views v WHERE v.workspace_id = w.id ORDER BY v.position, v.id LIMIT 1)) FROM workspaces w;
