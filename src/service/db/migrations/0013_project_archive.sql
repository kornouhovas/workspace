CREATE TABLE project_archives (
 project_id TEXT PRIMARY KEY NOT NULL REFERENCES projects(id),
 source_id TEXT NOT NULL REFERENCES sources(id),
 relative_path TEXT NOT NULL,
 original_relative_path TEXT NOT NULL,
 mode TEXT NOT NULL CHECK(mode IN ('direct','grouped')),
 category_name TEXT,
 parent_identity TEXT NOT NULL CHECK(json_valid(parent_identity)),
 parents TEXT NOT NULL CHECK(json_valid(parents)),
 UNIQUE(source_id, relative_path)
);
--> statement-breakpoint
CREATE TABLE project_archive_operations (
 operation_id TEXT PRIMARY KEY NOT NULL,
 source_id TEXT NOT NULL REFERENCES sources(id),
 workspace_id TEXT NOT NULL,
 project_id TEXT NOT NULL REFERENCES projects(id),
 action TEXT NOT NULL CHECK(action IN ('archive','restore')),
 original_relative_path TEXT NOT NULL,
 requested_relative_path TEXT NOT NULL,
 native_identity TEXT NOT NULL CHECK(json_valid(native_identity)),
 binding TEXT NOT NULL CHECK(json_valid(binding)),
 preview_token TEXT NOT NULL,
 parents TEXT NOT NULL CHECK(json_valid(parents)),
 stage TEXT NOT NULL CHECK(stage IN ('intent','destination_recorded','completed','failed')),
 problem TEXT,
 completed_revision INTEGER,
 CHECK((stage = 'completed' AND completed_revision IS NOT NULL AND problem IS NULL) OR (stage != 'completed' AND completed_revision IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX project_archive_outstanding_source ON project_archive_operations(source_id) WHERE stage IN ('intent','destination_recorded');
--> statement-breakpoint
CREATE TRIGGER project_archive_operation_binding BEFORE UPDATE ON project_archive_operations
WHEN NEW.operation_id != OLD.operation_id OR NEW.source_id != OLD.source_id OR NEW.workspace_id != OLD.workspace_id
 OR NEW.project_id != OLD.project_id OR NEW.action != OLD.action OR NEW.original_relative_path != OLD.original_relative_path
 OR NEW.requested_relative_path != OLD.requested_relative_path OR NEW.native_identity != OLD.native_identity
 OR NEW.binding != OLD.binding OR NEW.preview_token != OLD.preview_token
 OR OLD.stage IN ('completed','failed')
 OR (OLD.stage = 'destination_recorded' AND NEW.stage NOT IN ('destination_recorded','completed','failed'))
BEGIN SELECT RAISE(ABORT, 'Immutable archive binding and terminal receipt'); END;
--> statement-breakpoint
CREATE TRIGGER project_archive_operation_insert BEFORE INSERT ON project_archive_operations
WHEN NEW.stage != 'intent' OR NEW.problem IS NOT NULL OR NEW.completed_revision IS NOT NULL
 OR NOT EXISTS(SELECT 1 FROM workspaces w JOIN projects p ON p.source_id=w.source_id WHERE w.id=NEW.workspace_id AND p.id=NEW.project_id AND p.source_id=NEW.source_id)
 OR EXISTS(SELECT 1 FROM project_archive_operations WHERE operation_id=NEW.operation_id)
 OR EXISTS(SELECT 1 FROM project_creation_operations WHERE operation_id=NEW.operation_id)
 OR EXISTS(SELECT 1 FROM project_rename_operations WHERE operation_id=NEW.operation_id)
 OR EXISTS(SELECT 1 FROM project_category_move_operations WHERE operation_id=NEW.operation_id)
 OR EXISTS(SELECT 1 FROM category_folder_operations WHERE operation_id=NEW.operation_id)
 OR EXISTS(SELECT 1 FROM category_removal_operations WHERE operation_id=NEW.operation_id)
 OR EXISTS(SELECT 1 FROM category_removal_attempts WHERE move_id=NEW.operation_id)
BEGIN SELECT RAISE(ABORT, 'Invalid archive intent'); END;
--> statement-breakpoint
CREATE TRIGGER project_archive_operation_delete BEFORE DELETE ON project_archive_operations
BEGIN SELECT RAISE(ABORT, 'Retain archive operation history'); END;
--> statement-breakpoint
CREATE TRIGGER project_archive_insert BEFORE INSERT ON project_archives
WHEN NOT EXISTS(SELECT 1 FROM projects p WHERE p.id=NEW.project_id AND p.source_id=NEW.source_id AND p.mode_inactive=1 AND p.relative_path=NEW.original_relative_path)
BEGIN SELECT RAISE(ABORT, 'Archive must retain its project'); END;
--> statement-breakpoint
CREATE TRIGGER project_archive_update BEFORE UPDATE ON project_archives
BEGIN SELECT RAISE(ABORT, 'Archive placement is immutable until restoration'); END;
--> statement-breakpoint
CREATE TRIGGER project_creation_operations_archive_id BEFORE INSERT ON project_creation_operations
WHEN EXISTS(SELECT 1 FROM project_archive_operations WHERE operation_id=NEW.operation_id)
BEGIN SELECT RAISE(ABORT, 'Operation ID belongs to archive history'); END;
--> statement-breakpoint
CREATE TRIGGER project_rename_operations_archive_id BEFORE INSERT ON project_rename_operations
WHEN EXISTS(SELECT 1 FROM project_archive_operations WHERE operation_id=NEW.operation_id)
BEGIN SELECT RAISE(ABORT, 'Operation ID belongs to archive history'); END;
--> statement-breakpoint
CREATE TRIGGER project_category_move_operations_archive_id BEFORE INSERT ON project_category_move_operations
WHEN EXISTS(SELECT 1 FROM project_archive_operations WHERE operation_id=NEW.operation_id)
BEGIN SELECT RAISE(ABORT, 'Operation ID belongs to archive history'); END;
--> statement-breakpoint
CREATE TRIGGER category_folder_operations_archive_id BEFORE INSERT ON category_folder_operations
WHEN EXISTS(SELECT 1 FROM project_archive_operations WHERE operation_id=NEW.operation_id)
BEGIN SELECT RAISE(ABORT, 'Operation ID belongs to archive history'); END;
--> statement-breakpoint
CREATE TRIGGER category_removal_operations_archive_id BEFORE INSERT ON category_removal_operations
WHEN EXISTS(SELECT 1 FROM project_archive_operations WHERE operation_id=NEW.operation_id)
BEGIN SELECT RAISE(ABORT, 'Operation ID belongs to archive history'); END;
--> statement-breakpoint
CREATE TRIGGER category_removal_attempts_archive_id BEFORE INSERT ON category_removal_attempts
WHEN EXISTS(SELECT 1 FROM project_archive_operations WHERE operation_id=NEW.move_id)
BEGIN SELECT RAISE(ABORT, 'Operation ID belongs to archive history'); END;
--> statement-breakpoint
CREATE TRIGGER archive_parent_evidence BEFORE UPDATE OF parents ON project_archive_operations
WHEN OLD.stage != 'intent'
 OR json_array_length(NEW.parents) != json_array_length(OLD.parents)
 OR EXISTS(SELECT 1 FROM json_each(OLD.parents) p WHERE
 json_extract(NEW.parents, '$[' || p.key || '].path') IS NOT json_extract(p.value, '$.path')
 OR (json_extract(p.value, '$.identity') IS NOT NULL AND json_extract(NEW.parents, '$[' || p.key || '].identity') IS NOT json_extract(p.value, '$.identity')))
BEGIN SELECT RAISE(ABORT, 'Archive parent evidence is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER archive_delete_requires_restore BEFORE DELETE ON project_archives
WHEN NOT EXISTS(SELECT 1 FROM project_archive_operations WHERE project_id=OLD.project_id AND source_id=OLD.source_id AND action='restore' AND stage='destination_recorded')
BEGIN SELECT RAISE(ABORT, 'Archive removal requires verified restoration'); END;
