CREATE TABLE category_removal_operations (
 operation_id TEXT PRIMARY KEY NOT NULL,
 source_id TEXT NOT NULL REFERENCES sources(id), workspace_id TEXT NOT NULL,
 category_id TEXT NOT NULL, destination_category_id TEXT,
 original_relative_path TEXT NOT NULL, requested_relative_path TEXT,
 native_identity TEXT NOT NULL CHECK(json_valid(native_identity)),
 preview_token TEXT NOT NULL, binding TEXT NOT NULL CHECK(json_valid(binding)),
 stage TEXT NOT NULL CHECK(stage IN ('moving','cleanup_intent','completed','abandoned')),
 problem TEXT, completed_revision INTEGER,
 FOREIGN KEY(category_id, source_id) REFERENCES categories(id, source_id),
 FOREIGN KEY(destination_category_id, source_id) REFERENCES categories(id, source_id),
 CHECK(category_id IS NOT destination_category_id),
 CHECK((stage = 'completed') = (completed_revision IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX category_removal_source_active ON category_removal_operations(source_id) WHERE stage IN ('moving','cleanup_intent');
--> statement-breakpoint
CREATE TABLE category_removal_attempts (
 move_id TEXT PRIMARY KEY NOT NULL, removal_id TEXT NOT NULL REFERENCES category_removal_operations(operation_id),
 project_id TEXT NOT NULL REFERENCES projects(id), workspace_id TEXT NOT NULL,
 expected_revision INTEGER NOT NULL CHECK(expected_revision >= 0), sequence INTEGER NOT NULL CHECK(sequence >= 0), problem TEXT,
 UNIQUE(removal_id, project_id, sequence)
);
--> statement-breakpoint
CREATE TRIGGER category_removal_binding BEFORE UPDATE ON category_removal_operations
WHEN NEW.operation_id != OLD.operation_id OR NEW.source_id != OLD.source_id OR NEW.workspace_id != OLD.workspace_id
 OR NEW.category_id != OLD.category_id OR NEW.destination_category_id IS NOT OLD.destination_category_id
 OR NEW.original_relative_path != OLD.original_relative_path OR NEW.requested_relative_path IS NOT OLD.requested_relative_path
 OR NEW.native_identity != OLD.native_identity OR NEW.preview_token != OLD.preview_token OR NEW.binding != OLD.binding
 OR OLD.stage IN ('completed','abandoned')
 OR (OLD.stage = 'cleanup_intent' AND NEW.stage NOT IN ('cleanup_intent','completed','abandoned'))
 OR (OLD.stage = 'moving' AND NEW.stage NOT IN ('moving','cleanup_intent','abandoned'))
BEGIN SELECT RAISE(ABORT, 'Immutable category removal binding/receipt'); END;
--> statement-breakpoint
CREATE TRIGGER category_removal_delete BEFORE DELETE ON category_removal_operations
BEGIN SELECT RAISE(ABORT, 'Retain category removal history'); END;
--> statement-breakpoint
CREATE TRIGGER category_removal_replace BEFORE INSERT ON category_removal_operations
WHEN NEW.stage != 'moving' OR NEW.problem IS NOT NULL OR NEW.completed_revision IS NOT NULL
 OR EXISTS(SELECT 1 FROM category_removal_operations WHERE operation_id = NEW.operation_id)
 OR EXISTS(SELECT 1 FROM project_creation_operations WHERE operation_id = NEW.operation_id)
 OR EXISTS(SELECT 1 FROM project_rename_operations WHERE operation_id = NEW.operation_id)
 OR EXISTS(SELECT 1 FROM project_category_move_operations WHERE operation_id = NEW.operation_id)
 OR EXISTS(SELECT 1 FROM category_folder_operations WHERE operation_id = NEW.operation_id)
 OR EXISTS(SELECT 1 FROM category_removal_attempts WHERE move_id = NEW.operation_id)
BEGIN SELECT RAISE(ABORT, 'Operation ID already bound'); END;
--> statement-breakpoint
CREATE TRIGGER category_removal_attempt_update BEFORE UPDATE ON category_removal_attempts
WHEN NEW.move_id != OLD.move_id OR NEW.removal_id != OLD.removal_id OR NEW.project_id != OLD.project_id
 OR NEW.workspace_id != OLD.workspace_id OR NEW.expected_revision != OLD.expected_revision OR NEW.sequence != OLD.sequence
 OR OLD.problem IS NOT NULL OR NEW.problem IS NULL
 OR NOT EXISTS(SELECT 1 FROM category_removal_operations WHERE operation_id = OLD.removal_id AND stage = 'moving')
BEGIN SELECT RAISE(ABORT, 'Retain immutable category removal attempts'); END;
--> statement-breakpoint
CREATE TRIGGER category_removal_attempt_delete BEFORE DELETE ON category_removal_attempts
BEGIN SELECT RAISE(ABORT, 'Retain category removal attempts'); END;
--> statement-breakpoint
CREATE TRIGGER category_removal_attempt_insert BEFORE INSERT ON category_removal_attempts
WHEN NEW.problem IS NOT NULL OR NOT EXISTS(SELECT 1 FROM category_removal_operations r JOIN projects p ON p.source_id = r.source_id
 WHERE r.operation_id = NEW.removal_id AND r.stage = 'moving' AND p.id = NEW.project_id
 AND EXISTS(SELECT 1 FROM json_each(r.binding, '$.members') m WHERE json_extract(m.value, '$.id') = NEW.project_id)
 AND EXISTS(SELECT 1 FROM workspaces w WHERE w.id = NEW.workspace_id AND w.source_id = r.source_id))
 OR EXISTS(SELECT 1 FROM category_removal_attempts WHERE move_id = NEW.move_id)
 OR EXISTS(SELECT 1 FROM category_removal_operations WHERE operation_id = NEW.move_id)
 OR EXISTS(SELECT 1 FROM project_creation_operations WHERE operation_id = NEW.move_id)
 OR EXISTS(SELECT 1 FROM project_rename_operations WHERE operation_id = NEW.move_id)
 OR EXISTS(SELECT 1 FROM project_category_move_operations WHERE operation_id = NEW.move_id)
 OR EXISTS(SELECT 1 FROM category_folder_operations WHERE operation_id = NEW.move_id)
BEGIN SELECT RAISE(ABORT, 'Invalid category removal attempt'); END;

--> statement-breakpoint
CREATE TRIGGER project_creation_operations_removal_id BEFORE INSERT ON project_creation_operations
WHEN EXISTS(SELECT 1 FROM category_removal_operations WHERE operation_id = NEW.operation_id)
 OR EXISTS(SELECT 1 FROM category_removal_attempts WHERE move_id = NEW.operation_id)
BEGIN SELECT RAISE(ABORT, 'Operation ID already bound'); END;

--> statement-breakpoint
CREATE TRIGGER project_rename_operations_removal_id BEFORE INSERT ON project_rename_operations
WHEN EXISTS(SELECT 1 FROM category_removal_operations WHERE operation_id = NEW.operation_id)
 OR EXISTS(SELECT 1 FROM category_removal_attempts WHERE move_id = NEW.operation_id)
BEGIN SELECT RAISE(ABORT, 'Operation ID already bound'); END;

--> statement-breakpoint
CREATE TRIGGER category_folder_operations_removal_id BEFORE INSERT ON category_folder_operations
WHEN EXISTS(SELECT 1 FROM category_removal_operations WHERE operation_id = NEW.operation_id)
 OR EXISTS(SELECT 1 FROM category_removal_attempts WHERE move_id = NEW.operation_id)
BEGIN SELECT RAISE(ABORT, 'Operation ID already bound'); END;

--> statement-breakpoint
CREATE TRIGGER project_category_move_operations_removal_id BEFORE INSERT ON project_category_move_operations
WHEN EXISTS(SELECT 1 FROM category_removal_operations WHERE operation_id = NEW.operation_id)
BEGIN SELECT RAISE(ABORT, 'Operation ID already bound'); END;

--> statement-breakpoint
CREATE TRIGGER project_category_move_removal_child BEFORE INSERT ON project_category_move_operations
WHEN EXISTS(SELECT 1 FROM category_removal_attempts WHERE move_id = NEW.operation_id)
 AND NOT EXISTS(SELECT 1 FROM category_removal_attempts a JOIN category_removal_operations r ON r.operation_id = a.removal_id
 WHERE a.move_id = NEW.operation_id AND a.project_id = NEW.project_id AND a.workspace_id = NEW.initiating_workspace_id
 AND a.expected_revision = NEW.expected_revision AND r.stage = 'moving' AND r.source_id = NEW.source_id
 AND r.category_id = NEW.original_category_id AND r.destination_category_id = NEW.destination_category_id
 AND r.original_relative_path = NEW.original_parent_relative_path AND r.requested_relative_path = NEW.destination_parent_relative_path)
BEGIN SELECT RAISE(ABORT, 'Move does not match its removal assignment'); END;
