CREATE TABLE workspace_sessions (
  workspace_id TEXT PRIMARY KEY NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  state TEXT NOT NULL DEFAULT '{"tabs":[],"expanded":null,"previews":{},"sidebarWidth":220,"sidebarCollapsed":false,"projectWidth":360}' CHECK (json_valid(state))
);
--> statement-breakpoint
INSERT INTO workspace_sessions (workspace_id) SELECT id FROM workspaces;
--> statement-breakpoint
CREATE TRIGGER initialize_workspace_session AFTER INSERT ON workspaces
BEGIN INSERT INTO workspace_sessions (workspace_id) VALUES (NEW.id); END;
--> statement-breakpoint
CREATE TRIGGER remove_view_session_preview AFTER DELETE ON views
BEGIN
  UPDATE workspace_sessions
    SET state = json_remove(state, '$.previews.' || OLD.id), revision = revision + 1
    WHERE workspace_id = OLD.workspace_id;
END;
