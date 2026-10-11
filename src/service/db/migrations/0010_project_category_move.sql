CREATE TABLE project_category_move_operations (
  operation_id TEXT PRIMARY KEY NOT NULL,
  source_id TEXT NOT NULL REFERENCES sources(id),
  initiating_workspace_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(name) > 0 AND name NOT IN ('.', '..') AND instr(name, '/') = 0 AND instr(name, char(0)) = 0),
  expected_revision INTEGER NOT NULL CHECK (typeof(expected_revision) = 'integer' AND expected_revision >= 0),
  original_category_id TEXT NOT NULL,
  destination_category_id TEXT NOT NULL,
  canonical_root TEXT NOT NULL,
  original_parent_relative_path TEXT NOT NULL CHECK (length(original_parent_relative_path) > 0 AND original_parent_relative_path NOT IN ('.', '..') AND instr(original_parent_relative_path, '/') = 0 AND instr(original_parent_relative_path, char(0)) = 0),
  destination_parent_relative_path TEXT NOT NULL CHECK (length(destination_parent_relative_path) > 0 AND destination_parent_relative_path NOT IN ('.', '..') AND instr(destination_parent_relative_path, '/') = 0 AND instr(destination_parent_relative_path, char(0)) = 0),
  original_relative_path TEXT NOT NULL,
  requested_relative_path TEXT NOT NULL,
  root_identity TEXT NOT NULL CHECK (json_valid(root_identity) AND json_type(root_identity) = 'object' AND json_type(root_identity, '$.dev') IS 'text' AND length(json_extract(root_identity, '$.dev')) > 0 AND json_extract(root_identity, '$.dev') NOT GLOB '*[^0-9]*' AND json_type(root_identity, '$.ino') IS 'text' AND length(json_extract(root_identity, '$.ino')) > 0 AND json_extract(root_identity, '$.ino') NOT GLOB '*[^0-9]*' AND json_extract(root_identity, '$.ino') GLOB '*[1-9]*' AND json_type(root_identity, '$.birthtimeNs') IS 'text' AND length(json_extract(root_identity, '$.birthtimeNs')) > 0 AND json_extract(root_identity, '$.birthtimeNs') NOT GLOB '*[^0-9]*' AND json_extract(root_identity, '$.birthtimeNs') GLOB '*[1-9]*'),
  original_parent_identity TEXT NOT NULL CHECK (json_valid(original_parent_identity) AND json_type(original_parent_identity) = 'object' AND json_type(original_parent_identity, '$.dev') IS 'text' AND length(json_extract(original_parent_identity, '$.dev')) > 0 AND json_extract(original_parent_identity, '$.dev') NOT GLOB '*[^0-9]*' AND json_type(original_parent_identity, '$.ino') IS 'text' AND length(json_extract(original_parent_identity, '$.ino')) > 0 AND json_extract(original_parent_identity, '$.ino') NOT GLOB '*[^0-9]*' AND json_extract(original_parent_identity, '$.ino') GLOB '*[1-9]*' AND json_type(original_parent_identity, '$.birthtimeNs') IS 'text' AND length(json_extract(original_parent_identity, '$.birthtimeNs')) > 0 AND json_extract(original_parent_identity, '$.birthtimeNs') NOT GLOB '*[^0-9]*' AND json_extract(original_parent_identity, '$.birthtimeNs') GLOB '*[1-9]*'),
  destination_parent_identity TEXT NOT NULL CHECK (json_valid(destination_parent_identity) AND json_type(destination_parent_identity) = 'object' AND json_type(destination_parent_identity, '$.dev') IS 'text' AND length(json_extract(destination_parent_identity, '$.dev')) > 0 AND json_extract(destination_parent_identity, '$.dev') NOT GLOB '*[^0-9]*' AND json_type(destination_parent_identity, '$.ino') IS 'text' AND length(json_extract(destination_parent_identity, '$.ino')) > 0 AND json_extract(destination_parent_identity, '$.ino') NOT GLOB '*[^0-9]*' AND json_extract(destination_parent_identity, '$.ino') GLOB '*[1-9]*' AND json_type(destination_parent_identity, '$.birthtimeNs') IS 'text' AND length(json_extract(destination_parent_identity, '$.birthtimeNs')) > 0 AND json_extract(destination_parent_identity, '$.birthtimeNs') NOT GLOB '*[^0-9]*' AND json_extract(destination_parent_identity, '$.birthtimeNs') GLOB '*[1-9]*'),
  native_identity TEXT NOT NULL CHECK (json_valid(native_identity) AND json_type(native_identity) = 'object' AND json_type(native_identity, '$.dev') IS 'text' AND length(json_extract(native_identity, '$.dev')) > 0 AND json_extract(native_identity, '$.dev') NOT GLOB '*[^0-9]*' AND json_type(native_identity, '$.ino') IS 'text' AND length(json_extract(native_identity, '$.ino')) > 0 AND json_extract(native_identity, '$.ino') NOT GLOB '*[^0-9]*' AND json_extract(native_identity, '$.ino') GLOB '*[1-9]*' AND json_type(native_identity, '$.birthtimeNs') IS 'text' AND length(json_extract(native_identity, '$.birthtimeNs')) > 0 AND json_extract(native_identity, '$.birthtimeNs') NOT GLOB '*[^0-9]*' AND json_extract(native_identity, '$.birthtimeNs') GLOB '*[1-9]*'),
  excluded_relative_paths TEXT NOT NULL CHECK (json_valid(excluded_relative_paths) AND json_type(excluded_relative_paths) = 'array'),
  archive_relative_path TEXT,
  stage TEXT NOT NULL CHECK (stage IN ('intent', 'destination_recorded', 'uncertain', 'completed', 'failed')),
  destination_identity TEXT CHECK (destination_identity IS NULL OR destination_identity = native_identity),
  last_verified_placement TEXT NOT NULL CHECK (last_verified_placement IN ('original', 'destination')),
  last_verified_identity TEXT NOT NULL CHECK (last_verified_identity = native_identity),
  problem TEXT CHECK (problem IS NULL OR problem IN (
    'invalid_name', 'unconfigured', 'stale_configuration', 'category_unavailable', 'project_unavailable',
    'excluded', 'archive', 'reserved_destination', 'occupied', 'source_unavailable', 'permission_denied',
    'filesystem_changed', 'filesystem_error', 'ownership_uncertain', 'destination_missing', 'destination_replaced',
    'destination_link', 'native_conflict', 'native_unavailable', 'busy', 'cross_device', 'unsupported', 'storage_error', 'kept_original')),
  result_kind TEXT CHECK (result_kind IS NULL OR result_kind IN ('completed', 'unchanged', 'rejected')),
  completed_revision INTEGER CHECK (completed_revision IS NULL OR (typeof(completed_revision) = 'integer' AND completed_revision >= 0)),
  FOREIGN KEY (project_id, source_id) REFERENCES projects(id, source_id),
  FOREIGN KEY (original_category_id, source_id) REFERENCES categories(id, source_id),
  FOREIGN KEY (destination_category_id, source_id) REFERENCES categories(id, source_id),
  CHECK (original_relative_path = original_parent_relative_path || '/' || name
    AND requested_relative_path = destination_parent_relative_path || '/' || name),
  CHECK ((original_category_id = destination_category_id AND original_parent_relative_path = destination_parent_relative_path
      AND original_parent_identity = destination_parent_identity)
    OR (original_category_id != destination_category_id AND original_parent_relative_path != destination_parent_relative_path)),
  CHECK (last_verified_placement = 'original' OR destination_identity IS NOT NULL),
  CHECK ((stage = 'intent' AND destination_identity IS NULL AND last_verified_placement = 'original'
      AND problem IS NULL AND result_kind IS NULL AND completed_revision IS NULL)
    OR (stage = 'destination_recorded' AND destination_identity IS NOT NULL AND last_verified_placement = 'destination'
      AND problem IS NULL AND result_kind IS NULL AND completed_revision IS NULL)
    OR (stage = 'uncertain' AND problem IS NOT NULL AND result_kind IS NULL AND completed_revision IS NULL)
    OR (stage = 'failed' AND last_verified_placement = 'original' AND problem IS NOT NULL AND result_kind = 'rejected'
      AND result_kind IS NOT NULL AND completed_revision IS NULL)
    OR (stage = 'completed' AND problem IS NULL AND result_kind IS NOT NULL AND completed_revision IS NOT NULL AND (
      (result_kind = 'completed' AND original_category_id != destination_category_id AND destination_identity IS NOT NULL
        AND last_verified_placement = 'destination' AND completed_revision > expected_revision)
      OR (result_kind = 'unchanged' AND original_category_id = destination_category_id AND destination_identity IS NULL
        AND last_verified_placement = 'original' AND completed_revision = expected_revision))))
);
--> statement-breakpoint
CREATE INDEX project_category_move_source ON project_category_move_operations (source_id);
--> statement-breakpoint
-- Creation/rename history may already overlap. Preserve it while reserving
-- every new move ID across journals, including terminal history and REPLACE.
CREATE TRIGGER project_category_move_operation_id_insert BEFORE INSERT ON project_category_move_operations
WHEN EXISTS (SELECT 1 FROM project_creation_operations WHERE operation_id = NEW.operation_id)
  OR EXISTS (SELECT 1 FROM project_rename_operations WHERE operation_id = NEW.operation_id)
BEGIN SELECT RAISE(ABORT, 'Operation ID already belongs to creation or rename history'); END;
--> statement-breakpoint
CREATE TRIGGER project_creation_move_operation_id_insert BEFORE INSERT ON project_creation_operations
WHEN EXISTS (SELECT 1 FROM project_category_move_operations WHERE operation_id = NEW.operation_id)
BEGIN SELECT RAISE(ABORT, 'Operation ID already belongs to move history'); END;
--> statement-breakpoint
CREATE TRIGGER project_rename_move_operation_id_insert BEFORE INSERT ON project_rename_operations
WHEN EXISTS (SELECT 1 FROM project_category_move_operations WHERE operation_id = NEW.operation_id)
BEGIN SELECT RAISE(ABORT, 'Operation ID already belongs to move history'); END;
--> statement-breakpoint
CREATE UNIQUE INDEX project_category_move_outstanding_project ON project_category_move_operations (project_id) WHERE stage IN ('intent', 'destination_recorded', 'uncertain');
--> statement-breakpoint
-- Protect retained history even when REPLACE bypasses delete triggers.
CREATE TRIGGER project_category_move_history_insert BEFORE INSERT ON project_category_move_operations
WHEN EXISTS (SELECT 1 FROM project_category_move_operations o WHERE o.operation_id = NEW.operation_id
  OR (o.project_id = NEW.project_id AND o.stage IN ('intent', 'destination_recorded', 'uncertain')))
BEGIN SELECT RAISE(ABORT, 'Move history and unfinished project operations must be retained'); END;
--> statement-breakpoint
CREATE TRIGGER project_category_move_path_insert BEFORE INSERT ON project_category_move_operations
WHEN EXISTS (SELECT 1 FROM project_category_move_operations o WHERE o.source_id = NEW.source_id
  AND o.stage IN ('intent', 'destination_recorded', 'uncertain')
  AND (NEW.original_relative_path IN (o.original_relative_path, o.requested_relative_path)
    OR NEW.requested_relative_path IN (o.original_relative_path, o.requested_relative_path)))
BEGIN SELECT RAISE(ABORT, 'Unfinished move placements are reserved'); END;
--> statement-breakpoint
CREATE TRIGGER project_category_move_insert BEFORE INSERT ON project_category_move_operations
WHEN NEW.stage != 'intent' OR NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.id = NEW.initiating_workspace_id AND w.source_id = NEW.source_id)
OR NOT EXISTS (SELECT 1 FROM sources s JOIN projects p ON p.source_id = s.id
    WHERE s.id = NEW.source_id AND s.canonical_root = NEW.canonical_root AND s.discovery_mode = 'grouped'
    AND s.discovery_revision = NEW.expected_revision AND s.applied_root_identity = NEW.root_identity
    AND s.excluded_relative_paths = NEW.excluded_relative_paths AND s.archive_relative_path IS NEW.archive_relative_path
    AND p.id = NEW.project_id AND p.relative_path = NEW.original_relative_path AND p.native_identity = NEW.native_identity
    AND p.category_id = NEW.original_category_id AND p.association_state = 'active' AND p.mode_inactive = 0
    AND EXISTS (SELECT 1 FROM categories c WHERE c.id = NEW.original_category_id AND c.source_id = NEW.source_id
      AND c.relative_path = NEW.original_parent_relative_path AND c.native_identity = NEW.original_parent_identity
      AND c.association_state = 'active' AND c.mode_inactive = 0)
    AND EXISTS (SELECT 1 FROM categories c WHERE c.id = NEW.destination_category_id AND c.source_id = NEW.source_id
      AND c.relative_path = NEW.destination_parent_relative_path AND c.native_identity = NEW.destination_parent_identity
      AND c.association_state = 'active' AND c.mode_inactive = 0))
BEGIN SELECT RAISE(ABORT, 'Move intent requires current active project, categories and initiating source configuration'); END;
--> statement-breakpoint
CREATE TRIGGER project_category_move_binding_update BEFORE UPDATE ON project_category_move_operations
WHEN NEW.operation_id IS NOT OLD.operation_id
OR NEW.source_id IS NOT OLD.source_id
OR NEW.initiating_workspace_id IS NOT OLD.initiating_workspace_id
OR NEW.project_id IS NOT OLD.project_id
OR NEW.name IS NOT OLD.name
OR NEW.expected_revision IS NOT OLD.expected_revision
OR NEW.original_category_id IS NOT OLD.original_category_id
OR NEW.destination_category_id IS NOT OLD.destination_category_id
OR NEW.canonical_root IS NOT OLD.canonical_root
OR NEW.original_parent_relative_path IS NOT OLD.original_parent_relative_path
OR NEW.destination_parent_relative_path IS NOT OLD.destination_parent_relative_path
OR NEW.original_relative_path IS NOT OLD.original_relative_path
OR NEW.requested_relative_path IS NOT OLD.requested_relative_path
OR NEW.root_identity IS NOT OLD.root_identity
OR NEW.original_parent_identity IS NOT OLD.original_parent_identity
OR NEW.destination_parent_identity IS NOT OLD.destination_parent_identity
OR NEW.native_identity IS NOT OLD.native_identity
OR NEW.excluded_relative_paths IS NOT OLD.excluded_relative_paths
OR NEW.archive_relative_path IS NOT OLD.archive_relative_path
OR (OLD.destination_identity IS NOT NULL AND NEW.destination_identity IS NOT OLD.destination_identity)
OR (OLD.stage IN ('completed', 'failed') AND (NEW.stage IS NOT OLD.stage
  OR NEW.destination_identity IS NOT OLD.destination_identity
  OR NEW.last_verified_placement IS NOT OLD.last_verified_placement
  OR NEW.last_verified_identity IS NOT OLD.last_verified_identity
  OR NEW.problem IS NOT OLD.problem
  OR NEW.result_kind IS NOT OLD.result_kind
  OR NEW.completed_revision IS NOT OLD.completed_revision))
BEGIN SELECT RAISE(ABORT, 'Move request, recorded evidence and terminal result are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER project_category_move_stage_update BEFORE UPDATE ON project_category_move_operations
WHEN NEW.stage != OLD.stage AND OLD.stage NOT IN ('completed', 'failed') AND NOT (
  (OLD.stage = 'intent' AND NEW.stage IN ('destination_recorded', 'uncertain', 'failed'))
  OR (OLD.stage = 'intent' AND NEW.stage = 'completed' AND NEW.result_kind = 'unchanged')
  OR (OLD.stage = 'destination_recorded' AND NEW.stage IN ('completed', 'uncertain'))
  OR (OLD.stage = 'uncertain' AND NEW.stage IN ('destination_recorded', 'failed')))
BEGIN SELECT RAISE(ABORT, 'Invalid move stage transition'); END;
--> statement-breakpoint
CREATE TRIGGER project_category_move_evidence_update BEFORE UPDATE ON project_category_move_operations
WHEN (NEW.stage = 'uncertain' AND (NEW.last_verified_placement IS NOT OLD.last_verified_placement
    OR NEW.last_verified_identity IS NOT OLD.last_verified_identity OR NEW.destination_identity IS NOT OLD.destination_identity))
OR (NEW.destination_identity IS NOT OLD.destination_identity AND NEW.stage != 'destination_recorded')
BEGIN SELECT RAISE(ABORT, 'Move uncertainty must retain the last verified evidence'); END;
--> statement-breakpoint
CREATE TRIGGER project_category_move_complete BEFORE UPDATE ON project_category_move_operations
WHEN NEW.stage = 'completed' AND OLD.stage != 'completed' AND NOT EXISTS (SELECT 1 FROM sources s JOIN projects p ON p.source_id = s.id
    WHERE s.id = NEW.source_id AND s.canonical_root = NEW.canonical_root AND s.discovery_mode = 'grouped'
    AND s.discovery_revision = NEW.completed_revision AND s.applied_root_identity = NEW.root_identity
    AND s.excluded_relative_paths = NEW.excluded_relative_paths AND s.archive_relative_path IS NEW.archive_relative_path
    AND p.id = NEW.project_id AND p.relative_path = NEW.requested_relative_path AND p.native_identity = NEW.native_identity
    AND p.category_id = NEW.destination_category_id AND p.association_state = 'active' AND p.mode_inactive = 0
    AND EXISTS (SELECT 1 FROM categories c WHERE c.id = NEW.original_category_id AND c.source_id = NEW.source_id
      AND c.relative_path = NEW.original_parent_relative_path AND c.native_identity = NEW.original_parent_identity
      AND c.association_state = 'active' AND c.mode_inactive = 0)
    AND EXISTS (SELECT 1 FROM categories c WHERE c.id = NEW.destination_category_id AND c.source_id = NEW.source_id
      AND c.relative_path = NEW.destination_parent_relative_path AND c.native_identity = NEW.destination_parent_identity
      AND c.association_state = 'active' AND c.mode_inactive = 0))
BEGIN SELECT RAISE(ABORT, 'Move completion requires committed project category, locator, identity and source revision'); END;
--> statement-breakpoint
CREATE TRIGGER project_category_move_delete BEFORE DELETE ON project_category_move_operations
BEGIN SELECT RAISE(ABORT, 'Move history must be retained'); END;
