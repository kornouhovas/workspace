CREATE TABLE category_folder_operations (
  operation_id TEXT PRIMARY KEY NOT NULL,
  source_id TEXT NOT NULL REFERENCES sources(id),
  workspace_id TEXT NOT NULL,
  preview_token TEXT NOT NULL,
  category_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create','associate','rename')),
  original_relative_path TEXT,
  requested_relative_path TEXT NOT NULL,
  binding TEXT NOT NULL,
  native_identity TEXT,
  stage TEXT NOT NULL CHECK (stage IN ('intent','destination_recorded','completed','failed')),
  problem TEXT,
  completed_revision INTEGER,
  CHECK ((stage = 'completed') = (completed_revision IS NOT NULL)),
  CHECK (stage NOT IN ('destination_recorded','completed') OR native_identity IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE category_presentation (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id),
  color TEXT NOT NULL CHECK (color IN ('default','gray','red','orange','yellow','green','blue','purple')),
  hidden INTEGER NOT NULL CHECK (hidden IN (0,1)),
  position INTEGER NOT NULL CHECK (position >= 0),
  PRIMARY KEY (workspace_id, category_id)
);
--> statement-breakpoint
CREATE TRIGGER category_presentation_insert BEFORE INSERT ON category_presentation
WHEN NOT EXISTS (SELECT 1 FROM workspaces w JOIN categories c ON w.source_id = c.source_id WHERE w.id = NEW.workspace_id AND c.id = NEW.category_id)
BEGIN SELECT RAISE(ABORT, 'Category presentation belongs to the workspace source'); END;
--> statement-breakpoint
CREATE TRIGGER category_presentation_update BEFORE UPDATE ON category_presentation
WHEN NOT EXISTS (SELECT 1 FROM workspaces w JOIN categories c ON w.source_id = c.source_id WHERE w.id = NEW.workspace_id AND c.id = NEW.category_id)
BEGIN SELECT RAISE(ABORT, 'Category presentation belongs to the workspace source'); END;
--> statement-breakpoint
CREATE TRIGGER category_folder_binding BEFORE UPDATE ON category_folder_operations
WHEN NEW.operation_id != OLD.operation_id OR NEW.source_id != OLD.source_id OR NEW.workspace_id != OLD.workspace_id OR NEW.preview_token != OLD.preview_token
 OR NEW.category_id != OLD.category_id OR NEW.action != OLD.action OR NEW.original_relative_path IS NOT OLD.original_relative_path
 OR NEW.requested_relative_path != OLD.requested_relative_path OR NEW.binding != OLD.binding
 OR (OLD.native_identity IS NOT NULL AND NEW.native_identity IS NOT OLD.native_identity)
 OR OLD.stage IN ('completed','failed')
 OR (OLD.stage = 'intent' AND NEW.stage NOT IN ('intent','destination_recorded','failed'))
 OR (OLD.stage = 'destination_recorded' AND NEW.stage NOT IN ('destination_recorded','completed','failed'))
BEGIN SELECT RAISE(ABORT, 'Category operation bindings and receipts are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER category_folder_delete BEFORE DELETE ON category_folder_operations
BEGIN SELECT RAISE(ABORT, 'Category operation history is retained'); END;
--> statement-breakpoint
CREATE TRIGGER category_folder_replace BEFORE INSERT ON category_folder_operations
WHEN EXISTS (SELECT 1 FROM category_folder_operations WHERE operation_id = NEW.operation_id)
 OR EXISTS (SELECT 1 FROM project_creation_operations WHERE operation_id = NEW.operation_id)
 OR EXISTS (SELECT 1 FROM project_rename_operations WHERE operation_id = NEW.operation_id)
 OR EXISTS (SELECT 1 FROM project_category_move_operations WHERE operation_id = NEW.operation_id)
BEGIN SELECT RAISE(ABORT, 'Operation ID already bound'); END;

--> statement-breakpoint
CREATE TRIGGER project_creation_operations_category_id BEFORE INSERT ON project_creation_operations
WHEN EXISTS (SELECT 1 FROM category_folder_operations WHERE operation_id = NEW.operation_id)
BEGIN SELECT RAISE(ABORT, 'Operation ID already bound'); END;

--> statement-breakpoint
CREATE TRIGGER project_rename_operations_category_id BEFORE INSERT ON project_rename_operations
WHEN EXISTS (SELECT 1 FROM category_folder_operations WHERE operation_id = NEW.operation_id)
BEGIN SELECT RAISE(ABORT, 'Operation ID already bound'); END;

--> statement-breakpoint
CREATE TRIGGER project_category_move_operations_category_id BEFORE INSERT ON project_category_move_operations
WHEN EXISTS (SELECT 1 FROM category_folder_operations WHERE operation_id = NEW.operation_id)
BEGIN SELECT RAISE(ABORT, 'Operation ID already bound'); END;
