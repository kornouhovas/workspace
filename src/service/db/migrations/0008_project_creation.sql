CREATE TABLE project_creation_operations (
  operation_id TEXT PRIMARY KEY NOT NULL,
  source_id TEXT NOT NULL REFERENCES sources(id),
  initiating_workspace_id TEXT NOT NULL,
  project_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL CHECK (length(name) > 0 AND name NOT IN ('.', '..') AND instr(name, '/') = 0 AND instr(name, char(0)) = 0),
  mode TEXT NOT NULL CHECK (mode IN ('direct', 'grouped')),
  expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
  category_id TEXT,
  canonical_root TEXT NOT NULL,
  parent_relative_path TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  root_identity TEXT NOT NULL CHECK (json_valid(root_identity) AND json_type(root_identity) = 'object' AND json_type(root_identity, '$.dev') IS 'text' AND length(json_extract(root_identity, '$.dev')) > 0 AND json_extract(root_identity, '$.dev') NOT GLOB '*[^0-9]*' AND json_type(root_identity, '$.ino') IS 'text' AND length(json_extract(root_identity, '$.ino')) > 0 AND json_extract(root_identity, '$.ino') NOT GLOB '*[^0-9]*' AND json_extract(root_identity, '$.ino') GLOB '*[1-9]*' AND json_type(root_identity, '$.birthtimeNs') IS 'text' AND length(json_extract(root_identity, '$.birthtimeNs')) > 0 AND json_extract(root_identity, '$.birthtimeNs') NOT GLOB '*[^0-9]*' AND json_extract(root_identity, '$.birthtimeNs') GLOB '*[1-9]*'),
  parent_identity TEXT NOT NULL CHECK (json_valid(parent_identity) AND json_type(parent_identity) = 'object' AND json_type(parent_identity, '$.dev') IS 'text' AND length(json_extract(parent_identity, '$.dev')) > 0 AND json_extract(parent_identity, '$.dev') NOT GLOB '*[^0-9]*' AND json_type(parent_identity, '$.ino') IS 'text' AND length(json_extract(parent_identity, '$.ino')) > 0 AND json_extract(parent_identity, '$.ino') NOT GLOB '*[^0-9]*' AND json_extract(parent_identity, '$.ino') GLOB '*[1-9]*' AND json_type(parent_identity, '$.birthtimeNs') IS 'text' AND length(json_extract(parent_identity, '$.birthtimeNs')) > 0 AND json_extract(parent_identity, '$.birthtimeNs') NOT GLOB '*[^0-9]*' AND json_extract(parent_identity, '$.birthtimeNs') GLOB '*[1-9]*'),
  excluded_relative_paths TEXT NOT NULL CHECK (json_valid(excluded_relative_paths) AND json_type(excluded_relative_paths) = 'array'),
  archive_relative_path TEXT,
  stage TEXT NOT NULL CHECK (stage IN ('intent', 'evidence_recorded', 'uncertain', 'completed', 'failed')),
  native_identity TEXT CHECK (native_identity IS NULL OR (json_valid(native_identity) AND json_type(native_identity) = 'object' AND json_type(native_identity, '$.dev') IS 'text' AND length(json_extract(native_identity, '$.dev')) > 0 AND json_extract(native_identity, '$.dev') NOT GLOB '*[^0-9]*' AND json_type(native_identity, '$.ino') IS 'text' AND length(json_extract(native_identity, '$.ino')) > 0 AND json_extract(native_identity, '$.ino') NOT GLOB '*[^0-9]*' AND json_extract(native_identity, '$.ino') GLOB '*[1-9]*' AND json_type(native_identity, '$.birthtimeNs') IS 'text' AND length(json_extract(native_identity, '$.birthtimeNs')) > 0 AND json_extract(native_identity, '$.birthtimeNs') NOT GLOB '*[^0-9]*' AND json_extract(native_identity, '$.birthtimeNs') GLOB '*[1-9]*')),
  problem TEXT CHECK (problem IS NULL OR problem IN (
    'invalid_name', 'unconfigured', 'stale_configuration', 'category_unavailable', 'excluded', 'archive',
    'reserved_destination', 'occupied', 'case_alias', 'source_unavailable', 'permission_denied',
    'filesystem_changed', 'filesystem_error', 'ownership_uncertain', 'destination_missing',
    'destination_replaced', 'destination_link', 'native_conflict', 'storage_error')),
  completed_revision INTEGER,
  FOREIGN KEY (category_id, source_id) REFERENCES categories(id, source_id),
  CHECK ((mode = 'direct' AND category_id IS NULL AND parent_relative_path = '' AND relative_path = name AND parent_identity = root_identity)
    OR (mode = 'grouped' AND category_id IS NOT NULL AND length(parent_relative_path) > 0
      AND instr(parent_relative_path, '/') = 0 AND parent_relative_path NOT IN ('.', '..')
      AND relative_path = parent_relative_path || '/' || name)),
  CHECK ((stage = 'intent' AND native_identity IS NULL AND problem IS NULL AND completed_revision IS NULL)
    OR (stage = 'evidence_recorded' AND native_identity IS NOT NULL AND problem IS NULL AND completed_revision IS NULL)
    OR (stage = 'uncertain' AND problem IS NOT NULL AND completed_revision IS NULL)
    OR (stage = 'failed' AND native_identity IS NULL AND problem IS NOT NULL AND completed_revision IS NULL)
    OR (stage = 'completed' AND native_identity IS NOT NULL AND problem IS NULL AND completed_revision IS NOT NULL AND completed_revision > expected_revision))
);
--> statement-breakpoint
CREATE INDEX project_creation_source ON project_creation_operations (source_id);
--> statement-breakpoint
CREATE UNIQUE INDEX project_creation_outstanding_path ON project_creation_operations (source_id, relative_path) WHERE stage IN ('intent', 'evidence_recorded', 'uncertain');
--> statement-breakpoint
-- REPLACE may bypass DELETE triggers when recursive_triggers is off.
CREATE TRIGGER project_creation_history_insert BEFORE INSERT ON project_creation_operations
WHEN EXISTS (SELECT 1 FROM project_creation_operations WHERE operation_id = NEW.operation_id OR project_id = NEW.project_id
  OR (source_id = NEW.source_id AND relative_path = NEW.relative_path AND stage IN ('intent', 'evidence_recorded', 'uncertain')))
BEGIN SELECT RAISE(ABORT, 'Creation operation history and reserved IDs must be retained'); END;
--> statement-breakpoint
CREATE TRIGGER project_creation_insert BEFORE INSERT ON project_creation_operations
WHEN NEW.stage != 'intent'
OR NOT EXISTS (SELECT 1 FROM workspaces w JOIN sources s ON s.id = w.source_id
  WHERE w.id = NEW.initiating_workspace_id AND s.id = NEW.source_id
  AND s.canonical_root = NEW.canonical_root AND s.discovery_mode = NEW.mode
  AND s.discovery_revision = NEW.expected_revision AND s.applied_root_identity = NEW.root_identity
  AND s.excluded_relative_paths = NEW.excluded_relative_paths AND s.archive_relative_path IS NEW.archive_relative_path)
OR (NEW.mode = 'grouped' AND NOT EXISTS (SELECT 1 FROM categories c WHERE c.id = NEW.category_id
  AND c.source_id = NEW.source_id AND c.relative_path = NEW.parent_relative_path
  AND c.native_identity = NEW.parent_identity AND c.association_state = 'active' AND c.mode_inactive = 0))
OR EXISTS (SELECT 1 FROM projects WHERE id = NEW.project_id)
BEGIN SELECT RAISE(ABORT, 'Creation intent requires a fresh ID and the initiating source configuration'); END;
--> statement-breakpoint
CREATE TRIGGER project_creation_binding_update BEFORE UPDATE ON project_creation_operations
WHEN NEW.operation_id IS NOT OLD.operation_id
OR NEW.source_id IS NOT OLD.source_id
OR NEW.initiating_workspace_id IS NOT OLD.initiating_workspace_id
OR NEW.project_id IS NOT OLD.project_id
OR NEW.name IS NOT OLD.name
OR NEW.mode IS NOT OLD.mode
OR NEW.expected_revision IS NOT OLD.expected_revision
OR NEW.category_id IS NOT OLD.category_id
OR NEW.canonical_root IS NOT OLD.canonical_root
OR NEW.parent_relative_path IS NOT OLD.parent_relative_path
OR NEW.relative_path IS NOT OLD.relative_path
OR NEW.root_identity IS NOT OLD.root_identity
OR NEW.parent_identity IS NOT OLD.parent_identity
OR NEW.excluded_relative_paths IS NOT OLD.excluded_relative_paths
OR NEW.archive_relative_path IS NOT OLD.archive_relative_path
OR (OLD.native_identity IS NOT NULL AND NEW.native_identity IS NOT OLD.native_identity)
OR (OLD.stage IN ('completed', 'failed') AND (NEW.stage IS NOT OLD.stage OR NEW.problem IS NOT OLD.problem
  OR NEW.native_identity IS NOT OLD.native_identity OR NEW.completed_revision IS NOT OLD.completed_revision))
BEGIN SELECT RAISE(ABORT, 'Creation request, recorded evidence and terminal outcome are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER project_creation_stage_update BEFORE UPDATE ON project_creation_operations
WHEN NEW.stage != OLD.stage AND OLD.stage NOT IN ('completed', 'failed') AND NOT (
  (OLD.stage = 'intent' AND NEW.stage IN ('evidence_recorded', 'uncertain', 'failed'))
  OR (OLD.stage = 'evidence_recorded' AND NEW.stage IN ('uncertain', 'completed'))
  OR (OLD.stage = 'uncertain' AND NEW.stage = 'evidence_recorded'))
BEGIN SELECT RAISE(ABORT, 'Invalid creation stage transition'); END;
--> statement-breakpoint
CREATE TRIGGER project_creation_complete BEFORE UPDATE ON project_creation_operations
WHEN NEW.stage = 'completed' AND OLD.stage != 'completed' AND NOT EXISTS (
  SELECT 1 FROM projects p JOIN sources s ON s.id = p.source_id
  WHERE p.id = NEW.project_id AND p.source_id = NEW.source_id AND p.relative_path = NEW.relative_path
  AND p.native_identity = NEW.native_identity AND p.category_id IS NEW.category_id
  AND p.association_state = 'active' AND p.mode_inactive = 0 AND s.discovery_mode = NEW.mode
  AND s.discovery_revision = NEW.completed_revision)
BEGIN SELECT RAISE(ABORT, 'Completion requires its committed project and source revision'); END;
--> statement-breakpoint
CREATE TRIGGER project_creation_delete BEFORE DELETE ON project_creation_operations
BEGIN SELECT RAISE(ABORT, 'Creation history must be retained'); END;
--> statement-breakpoint
CREATE TRIGGER project_creation_reserved_id BEFORE INSERT ON projects
WHEN EXISTS (SELECT 1 FROM project_creation_operations o WHERE o.project_id = NEW.id AND NOT (
  o.stage = 'evidence_recorded' AND o.source_id = NEW.source_id AND o.relative_path = NEW.relative_path
  AND o.native_identity = NEW.native_identity AND o.category_id IS NEW.category_id
  AND NEW.association_state = 'active' AND NEW.mode_inactive = 0))
BEGIN SELECT RAISE(ABORT, 'Reserved project ID belongs to its evidenced creation'); END;
