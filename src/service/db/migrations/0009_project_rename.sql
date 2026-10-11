CREATE TABLE project_rename_operations (
  operation_id TEXT PRIMARY KEY NOT NULL,
  source_id TEXT NOT NULL REFERENCES sources(id),
  initiating_workspace_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  original_name TEXT NOT NULL CHECK (length(original_name) > 0 AND original_name NOT IN ('.', '..') AND instr(original_name, '/') = 0 AND instr(original_name, char(0)) = 0),
  name TEXT NOT NULL CHECK (length(name) > 0 AND name NOT IN ('.', '..') AND instr(name, '/') = 0 AND instr(name, char(0)) = 0),
  mode TEXT NOT NULL CHECK (mode IN ('direct', 'grouped')),
  expected_revision INTEGER NOT NULL CHECK (typeof(expected_revision) = 'integer' AND expected_revision >= 0),
  category_id TEXT,
  canonical_root TEXT NOT NULL,
  parent_relative_path TEXT NOT NULL,
  original_relative_path TEXT NOT NULL,
  requested_relative_path TEXT NOT NULL,
  staging_relative_path TEXT,
  root_identity TEXT NOT NULL CHECK (json_valid(root_identity) AND json_type(root_identity) = 'object' AND json_type(root_identity, '$.dev') IS 'text' AND length(json_extract(root_identity, '$.dev')) > 0 AND json_extract(root_identity, '$.dev') NOT GLOB '*[^0-9]*' AND json_type(root_identity, '$.ino') IS 'text' AND length(json_extract(root_identity, '$.ino')) > 0 AND json_extract(root_identity, '$.ino') NOT GLOB '*[^0-9]*' AND json_extract(root_identity, '$.ino') GLOB '*[1-9]*' AND json_type(root_identity, '$.birthtimeNs') IS 'text' AND length(json_extract(root_identity, '$.birthtimeNs')) > 0 AND json_extract(root_identity, '$.birthtimeNs') NOT GLOB '*[^0-9]*' AND json_extract(root_identity, '$.birthtimeNs') GLOB '*[1-9]*'),
  parent_identity TEXT NOT NULL CHECK (json_valid(parent_identity) AND json_type(parent_identity) = 'object' AND json_type(parent_identity, '$.dev') IS 'text' AND length(json_extract(parent_identity, '$.dev')) > 0 AND json_extract(parent_identity, '$.dev') NOT GLOB '*[^0-9]*' AND json_type(parent_identity, '$.ino') IS 'text' AND length(json_extract(parent_identity, '$.ino')) > 0 AND json_extract(parent_identity, '$.ino') NOT GLOB '*[^0-9]*' AND json_extract(parent_identity, '$.ino') GLOB '*[1-9]*' AND json_type(parent_identity, '$.birthtimeNs') IS 'text' AND length(json_extract(parent_identity, '$.birthtimeNs')) > 0 AND json_extract(parent_identity, '$.birthtimeNs') NOT GLOB '*[^0-9]*' AND json_extract(parent_identity, '$.birthtimeNs') GLOB '*[1-9]*'),
  native_identity TEXT NOT NULL CHECK (json_valid(native_identity) AND json_type(native_identity) = 'object' AND json_type(native_identity, '$.dev') IS 'text' AND length(json_extract(native_identity, '$.dev')) > 0 AND json_extract(native_identity, '$.dev') NOT GLOB '*[^0-9]*' AND json_type(native_identity, '$.ino') IS 'text' AND length(json_extract(native_identity, '$.ino')) > 0 AND json_extract(native_identity, '$.ino') NOT GLOB '*[^0-9]*' AND json_extract(native_identity, '$.ino') GLOB '*[1-9]*' AND json_type(native_identity, '$.birthtimeNs') IS 'text' AND length(json_extract(native_identity, '$.birthtimeNs')) > 0 AND json_extract(native_identity, '$.birthtimeNs') NOT GLOB '*[^0-9]*' AND json_extract(native_identity, '$.birthtimeNs') GLOB '*[1-9]*'),
  excluded_relative_paths TEXT NOT NULL CHECK (json_valid(excluded_relative_paths) AND json_type(excluded_relative_paths) = 'array'),
  archive_relative_path TEXT,
  stage TEXT NOT NULL CHECK (stage IN ('intent', 'staged', 'destination_recorded', 'uncertain', 'completed', 'failed')),
  staged_identity TEXT CHECK (staged_identity IS NULL OR (staging_relative_path IS NOT NULL AND staged_identity = native_identity)),
  destination_identity TEXT CHECK (destination_identity IS NULL OR destination_identity = native_identity),
  last_verified_placement TEXT NOT NULL CHECK (last_verified_placement IN ('original', 'staged', 'destination')),
  last_verified_identity TEXT NOT NULL CHECK (last_verified_identity = native_identity),
  problem TEXT CHECK (problem IS NULL OR problem IN (
    'invalid_name', 'unconfigured', 'stale_configuration', 'category_unavailable', 'project_unavailable',
    'excluded', 'archive', 'reserved_destination', 'occupied', 'source_unavailable', 'permission_denied',
    'filesystem_changed', 'filesystem_error', 'ownership_uncertain', 'destination_missing', 'destination_replaced',
    'destination_link', 'native_conflict', 'native_unavailable', 'busy', 'cross_device', 'unsupported', 'storage_error', 'kept_original')),
  result_kind TEXT CHECK (result_kind IS NULL OR result_kind IN ('completed', 'unchanged', 'rejected')),
  completed_revision INTEGER CHECK (completed_revision IS NULL OR (typeof(completed_revision) = 'integer' AND completed_revision >= 0)),
  FOREIGN KEY (project_id, source_id) REFERENCES projects(id, source_id),
  FOREIGN KEY (category_id, source_id) REFERENCES categories(id, source_id),
  CHECK ((mode = 'direct' AND category_id IS NULL AND parent_relative_path = ''
      AND original_relative_path = original_name AND requested_relative_path = name AND parent_identity = root_identity)
    OR (mode = 'grouped' AND category_id IS NOT NULL AND length(parent_relative_path) > 0 AND parent_relative_path NOT IN ('.', '..') AND instr(parent_relative_path, '/') = 0 AND instr(parent_relative_path, char(0)) = 0
      AND original_relative_path = parent_relative_path || '/' || original_name
      AND requested_relative_path = parent_relative_path || '/' || name)),
  CHECK (staging_relative_path IS NULL OR (
    staging_relative_path != original_relative_path AND staging_relative_path != requested_relative_path
    AND ((mode = 'direct' AND length(staging_relative_path) > 0 AND staging_relative_path NOT IN ('.', '..') AND instr(staging_relative_path, '/') = 0 AND instr(staging_relative_path, char(0)) = 0)
      OR (mode = 'grouped' AND substr(staging_relative_path, 1, length(parent_relative_path) + 1) = parent_relative_path || '/'
        AND length(substr(staging_relative_path, length(parent_relative_path) + 2)) > 0 AND substr(staging_relative_path, length(parent_relative_path) + 2) NOT IN ('.', '..') AND instr(substr(staging_relative_path, length(parent_relative_path) + 2), '/') = 0 AND instr(substr(staging_relative_path, length(parent_relative_path) + 2), char(0)) = 0))
    AND substr(staging_relative_path, length(parent_relative_path) + CASE WHEN mode = 'grouped' THEN 2 ELSE 1 END, 1) = '.')),
  CHECK ((last_verified_placement = 'original')
    OR (last_verified_placement = 'staged' AND staged_identity IS NOT NULL)
    OR (last_verified_placement = 'destination' AND destination_identity IS NOT NULL)),
  CHECK ((stage = 'intent' AND staged_identity IS NULL AND destination_identity IS NULL AND last_verified_placement = 'original'
      AND problem IS NULL AND result_kind IS NULL AND completed_revision IS NULL)
    OR (stage = 'staged' AND staged_identity IS NOT NULL AND last_verified_placement = 'staged'
      AND problem IS NULL AND result_kind IS NULL AND completed_revision IS NULL)
    OR (stage = 'destination_recorded' AND destination_identity IS NOT NULL AND last_verified_placement = 'destination'
      AND problem IS NULL AND result_kind IS NULL AND completed_revision IS NULL)
    OR (stage = 'uncertain' AND problem IS NOT NULL AND result_kind IS NULL AND completed_revision IS NULL)
    OR (stage = 'failed' AND last_verified_placement = 'original' AND problem IS NOT NULL AND result_kind IS NOT NULL AND result_kind = 'rejected' AND completed_revision IS NULL)
    OR (stage = 'completed' AND problem IS NULL AND result_kind IS NOT NULL AND completed_revision IS NOT NULL AND (
      (result_kind = 'completed' AND original_name != name AND destination_identity IS NOT NULL
        AND last_verified_placement = 'destination' AND completed_revision > expected_revision)
      OR (result_kind = 'unchanged' AND original_name = name AND original_relative_path = requested_relative_path
        AND staging_relative_path IS NULL AND staged_identity IS NULL AND destination_identity IS NULL
        AND last_verified_placement = 'original' AND completed_revision = expected_revision))))
);
--> statement-breakpoint
CREATE INDEX project_rename_source ON project_rename_operations (source_id);
--> statement-breakpoint
CREATE UNIQUE INDEX project_rename_outstanding_project ON project_rename_operations (project_id) WHERE stage IN ('intent', 'staged', 'destination_recorded', 'uncertain');
--> statement-breakpoint
-- Protect against REPLACE even with recursive_triggers disabled.
CREATE TRIGGER project_rename_history_insert BEFORE INSERT ON project_rename_operations
WHEN EXISTS (SELECT 1 FROM project_rename_operations o WHERE o.operation_id = NEW.operation_id
  OR (o.project_id = NEW.project_id AND o.stage IN ('intent', 'staged', 'destination_recorded', 'uncertain')))
BEGIN SELECT RAISE(ABORT, 'Rename history and unfinished project operations must be retained'); END;
--> statement-breakpoint
-- Every role conflicts with every role of another unfinished operation; self aliases remain legal.
CREATE TRIGGER project_rename_path_insert BEFORE INSERT ON project_rename_operations
WHEN EXISTS (SELECT 1 FROM project_rename_operations o WHERE o.source_id = NEW.source_id
  AND o.stage IN ('intent', 'staged', 'destination_recorded', 'uncertain')
  AND (NEW.original_relative_path IN (o.original_relative_path, o.requested_relative_path, o.staging_relative_path)
    OR NEW.requested_relative_path IN (o.original_relative_path, o.requested_relative_path, o.staging_relative_path)
    OR NEW.staging_relative_path IN (o.original_relative_path, o.requested_relative_path, o.staging_relative_path)))
BEGIN SELECT RAISE(ABORT, 'Unfinished rename placements are reserved'); END;
--> statement-breakpoint
CREATE TRIGGER project_rename_insert BEFORE INSERT ON project_rename_operations
WHEN NEW.stage != 'intent' OR NOT EXISTS (SELECT 1 FROM workspaces w JOIN sources s ON s.id = w.source_id
    JOIN projects p ON p.source_id = s.id
    WHERE w.id = NEW.initiating_workspace_id AND s.id = NEW.source_id
    AND s.canonical_root = NEW.canonical_root AND s.discovery_mode = NEW.mode
    AND s.discovery_revision = NEW.expected_revision AND s.applied_root_identity = NEW.root_identity
    AND s.excluded_relative_paths = NEW.excluded_relative_paths AND s.archive_relative_path IS NEW.archive_relative_path
    AND p.id = NEW.project_id AND p.relative_path = NEW.original_relative_path AND p.native_identity = NEW.native_identity
    AND p.category_id IS NEW.category_id AND p.association_state = 'active' AND p.mode_inactive = 0
    AND (NEW.mode = 'direct' OR EXISTS (SELECT 1 FROM categories c WHERE c.id = NEW.category_id
      AND c.source_id = NEW.source_id AND c.relative_path = NEW.parent_relative_path
      AND c.native_identity = NEW.parent_identity AND c.association_state = 'active' AND c.mode_inactive = 0)))
BEGIN SELECT RAISE(ABORT, 'Rename intent requires the current active project and initiating source configuration'); END;
--> statement-breakpoint
CREATE TRIGGER project_rename_binding_update BEFORE UPDATE ON project_rename_operations
WHEN NEW.operation_id IS NOT OLD.operation_id
OR NEW.source_id IS NOT OLD.source_id
OR NEW.initiating_workspace_id IS NOT OLD.initiating_workspace_id
OR NEW.project_id IS NOT OLD.project_id
OR NEW.original_name IS NOT OLD.original_name
OR NEW.name IS NOT OLD.name
OR NEW.mode IS NOT OLD.mode
OR NEW.expected_revision IS NOT OLD.expected_revision
OR NEW.category_id IS NOT OLD.category_id
OR NEW.canonical_root IS NOT OLD.canonical_root
OR NEW.parent_relative_path IS NOT OLD.parent_relative_path
OR NEW.original_relative_path IS NOT OLD.original_relative_path
OR NEW.requested_relative_path IS NOT OLD.requested_relative_path
OR NEW.staging_relative_path IS NOT OLD.staging_relative_path
OR NEW.root_identity IS NOT OLD.root_identity
OR NEW.parent_identity IS NOT OLD.parent_identity
OR NEW.native_identity IS NOT OLD.native_identity
OR NEW.excluded_relative_paths IS NOT OLD.excluded_relative_paths
OR NEW.archive_relative_path IS NOT OLD.archive_relative_path
OR (OLD.staged_identity IS NOT NULL AND NEW.staged_identity IS NOT OLD.staged_identity)
OR (OLD.destination_identity IS NOT NULL AND NEW.destination_identity IS NOT OLD.destination_identity)
OR (OLD.stage IN ('completed', 'failed') AND (NEW.stage IS NOT OLD.stage
  OR NEW.staged_identity IS NOT OLD.staged_identity
  OR NEW.destination_identity IS NOT OLD.destination_identity
  OR NEW.last_verified_placement IS NOT OLD.last_verified_placement
  OR NEW.last_verified_identity IS NOT OLD.last_verified_identity
  OR NEW.problem IS NOT OLD.problem
  OR NEW.result_kind IS NOT OLD.result_kind
  OR NEW.completed_revision IS NOT OLD.completed_revision))
BEGIN SELECT RAISE(ABORT, 'Rename request, recorded evidence and terminal result are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER project_rename_stage_update BEFORE UPDATE ON project_rename_operations
WHEN NEW.stage != OLD.stage AND OLD.stage NOT IN ('completed', 'failed') AND NOT (
  (OLD.stage = 'intent' AND NEW.stage IN ('staged', 'destination_recorded', 'uncertain', 'failed'))
  OR (OLD.stage = 'intent' AND NEW.stage = 'completed' AND NEW.result_kind = 'unchanged')
  OR (OLD.stage = 'staged' AND NEW.stage IN ('destination_recorded', 'uncertain'))
  OR (OLD.stage = 'destination_recorded' AND NEW.stage IN ('completed', 'uncertain'))
  OR (OLD.stage = 'uncertain' AND NEW.stage IN ('staged', 'destination_recorded', 'failed')))
BEGIN SELECT RAISE(ABORT, 'Invalid rename stage transition'); END;
--> statement-breakpoint
CREATE TRIGGER project_rename_evidence_update BEFORE UPDATE ON project_rename_operations
WHEN (NEW.stage = 'uncertain' AND (NEW.last_verified_placement IS NOT OLD.last_verified_placement
    OR NEW.last_verified_identity IS NOT OLD.last_verified_identity
    OR NEW.staged_identity IS NOT OLD.staged_identity OR NEW.destination_identity IS NOT OLD.destination_identity))
OR (NEW.staged_identity IS NOT OLD.staged_identity AND NEW.stage != 'staged')
OR (NEW.destination_identity IS NOT OLD.destination_identity AND NEW.stage != 'destination_recorded')
BEGIN SELECT RAISE(ABORT, 'Rename uncertainty must retain the last verified evidence'); END;
--> statement-breakpoint
CREATE TRIGGER project_rename_complete BEFORE UPDATE ON project_rename_operations
WHEN NEW.stage = 'completed' AND OLD.stage != 'completed' AND NOT EXISTS (SELECT 1 FROM sources s JOIN projects p ON p.source_id = s.id
    WHERE s.id = NEW.source_id
    AND s.canonical_root = NEW.canonical_root AND s.discovery_mode = NEW.mode
    AND s.discovery_revision = NEW.completed_revision AND s.applied_root_identity = NEW.root_identity
    AND s.excluded_relative_paths = NEW.excluded_relative_paths AND s.archive_relative_path IS NEW.archive_relative_path
    AND p.id = NEW.project_id AND p.relative_path = NEW.requested_relative_path AND p.native_identity = NEW.native_identity
    AND p.category_id IS NEW.category_id AND p.association_state = 'active' AND p.mode_inactive = 0
    AND (NEW.mode = 'direct' OR EXISTS (SELECT 1 FROM categories c WHERE c.id = NEW.category_id
      AND c.source_id = NEW.source_id AND c.relative_path = NEW.parent_relative_path
      AND c.native_identity = NEW.parent_identity AND c.association_state = 'active' AND c.mode_inactive = 0)))
BEGIN SELECT RAISE(ABORT, 'Rename completion requires its committed active project, identity and source revision'); END;
--> statement-breakpoint
CREATE TRIGGER project_rename_delete BEFORE DELETE ON project_rename_operations
BEGIN SELECT RAISE(ABORT, 'Rename history must be retained'); END;
