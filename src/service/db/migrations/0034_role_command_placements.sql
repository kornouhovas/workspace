-- Preserve every existing journal cell and relationship while extending only explicitly role-bound intents.
PRAGMA defer_foreign_keys=ON;
--> statement-breakpoint
PRAGMA legacy_alter_table=ON;
--> statement-breakpoint
CREATE TABLE project_rename_operations_role_upgrade (
  folder_roles TEXT CHECK(folder_roles IS NULL OR (json_valid(folder_roles) AND json_type(folder_roles)='array')),
  target_folder_roles TEXT CHECK(target_folder_roles IS NULL OR (json_valid(target_folder_roles) AND json_type(target_folder_roles)='array')),
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
  completed_revision INTEGER CHECK (completed_revision IS NULL OR (typeof(completed_revision) = 'integer' AND completed_revision >= 0)), authorization TEXT CHECK(authorization IS NULL OR json_valid(authorization)), project_evidence TEXT CHECK(project_evidence IS NULL OR json_valid(project_evidence)),
  FOREIGN KEY (project_id, source_id) REFERENCES projects(id, source_id),
  FOREIGN KEY (category_id, source_id) REFERENCES categories(id, source_id),
  CHECK ((folder_roles IS NULL AND ((mode = 'direct' AND category_id IS NULL AND parent_relative_path = ''
      AND original_relative_path = original_name AND requested_relative_path = name AND parent_identity = root_identity)
    OR (mode = 'grouped' AND category_id IS NOT NULL AND length(parent_relative_path) > 0 AND parent_relative_path NOT IN ('.', '..') AND instr(parent_relative_path, '/') = 0 AND instr(parent_relative_path, char(0)) = 0
      AND original_relative_path = parent_relative_path || '/' || original_name
      AND requested_relative_path = parent_relative_path || '/' || name))) OR (folder_roles IS NOT NULL AND (mode='grouped' AND (parent_relative_path='' OR (substr(parent_relative_path,1,1)!='/' AND substr(parent_relative_path,-1)!='/' AND instr(parent_relative_path,'//')=0 AND instr('/'||parent_relative_path||'/','/../')=0 AND instr('/'||parent_relative_path||'/','/./')=0 AND instr(parent_relative_path,char(0))=0 AND instr(parent_relative_path,'\')=0)) AND original_relative_path=CASE WHEN parent_relative_path='' THEN original_name ELSE parent_relative_path||'/'||original_name END AND requested_relative_path=CASE WHEN parent_relative_path='' THEN name ELSE parent_relative_path||'/'||name END))),
  CHECK ((folder_roles IS NULL AND (staging_relative_path IS NULL OR (
    staging_relative_path != original_relative_path AND staging_relative_path != requested_relative_path
    AND ((mode = 'direct' AND length(staging_relative_path) > 0 AND staging_relative_path NOT IN ('.', '..') AND instr(staging_relative_path, '/') = 0 AND instr(staging_relative_path, char(0)) = 0)
      OR (mode = 'grouped' AND substr(staging_relative_path, 1, length(parent_relative_path) + 1) = parent_relative_path || '/'
        AND length(substr(staging_relative_path, length(parent_relative_path) + 2)) > 0 AND substr(staging_relative_path, length(parent_relative_path) + 2) NOT IN ('.', '..') AND instr(substr(staging_relative_path, length(parent_relative_path) + 2), '/') = 0 AND instr(substr(staging_relative_path, length(parent_relative_path) + 2), char(0)) = 0))
    AND substr(staging_relative_path, length(parent_relative_path) + CASE WHEN mode = 'grouped' THEN 2 ELSE 1 END, 1) = '.'))) OR (folder_roles IS NOT NULL AND (staging_relative_path IS NULL OR (staging_relative_path!=original_relative_path AND staging_relative_path!=requested_relative_path AND (staging_relative_path='' OR (substr(staging_relative_path,1,1)!='/' AND substr(staging_relative_path,-1)!='/' AND instr(staging_relative_path,'//')=0 AND instr('/'||staging_relative_path||'/','/../')=0 AND instr('/'||staging_relative_path||'/','/./')=0 AND instr(staging_relative_path,char(0))=0 AND instr(staging_relative_path,'\')=0)) AND substr(staging_relative_path,length(parent_relative_path)+CASE WHEN parent_relative_path='' THEN 1 ELSE 2 END,1)='.' AND instr(substr(staging_relative_path,length(parent_relative_path)+CASE WHEN parent_relative_path='' THEN 1 ELSE 2 END),'/')=0 AND (parent_relative_path='' OR substr(staging_relative_path,1,length(parent_relative_path)+1)=parent_relative_path||'/'))))),
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
,
  CHECK ((folder_roles IS NULL AND target_folder_roles IS NULL) OR (folder_roles IS NOT NULL AND target_folder_roles IS NOT NULL))
);
--> statement-breakpoint
INSERT INTO project_rename_operations_role_upgrade ("operation_id","source_id","initiating_workspace_id","project_id","original_name","name","mode","expected_revision","category_id","canonical_root","parent_relative_path","original_relative_path","requested_relative_path","staging_relative_path","root_identity","parent_identity","native_identity","excluded_relative_paths","archive_relative_path","stage","staged_identity","destination_identity","last_verified_placement","last_verified_identity","problem","result_kind","completed_revision","authorization","project_evidence") SELECT "operation_id","source_id","initiating_workspace_id","project_id","original_name","name","mode","expected_revision","category_id","canonical_root","parent_relative_path","original_relative_path","requested_relative_path","staging_relative_path","root_identity","parent_identity","native_identity","excluded_relative_paths","archive_relative_path","stage","staged_identity","destination_identity","last_verified_placement","last_verified_identity","problem","result_kind","completed_revision","authorization","project_evidence" FROM project_rename_operations;
--> statement-breakpoint
DROP TABLE project_rename_operations;
--> statement-breakpoint
ALTER TABLE project_rename_operations_role_upgrade RENAME TO project_rename_operations;
--> statement-breakpoint
CREATE UNIQUE INDEX project_rename_outstanding_project ON project_rename_operations (project_id) WHERE stage IN ('intent', 'staged', 'destination_recorded', 'uncertain');
--> statement-breakpoint
CREATE INDEX project_rename_source ON project_rename_operations (source_id);
--> statement-breakpoint
CREATE TRIGGER project_rename_authority_update BEFORE UPDATE ON project_rename_operations
WHEN NEW.authorization IS NOT OLD.authorization OR NEW.project_evidence IS NOT OLD.project_evidence
BEGIN SELECT RAISE(ABORT, 'Rename authorization and project evidence are immutable'); END;
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
CREATE TRIGGER project_rename_complete BEFORE UPDATE ON project_rename_operations
WHEN NEW.stage = 'completed' AND OLD.stage != 'completed' AND NOT EXISTS (SELECT 1 FROM sources s JOIN projects p ON p.source_id = s.id
    WHERE s.id = NEW.source_id
    AND s.canonical_root = NEW.canonical_root AND s.discovery_mode = NEW.mode
    AND s.discovery_revision = NEW.completed_revision AND s.applied_root_identity = NEW.root_identity
    AND s.excluded_relative_paths = NEW.excluded_relative_paths AND s.archive_relative_path IS NEW.archive_relative_path
    AND p.id = NEW.project_id AND p.relative_path = NEW.requested_relative_path AND p.native_identity = NEW.native_identity
    AND p.category_id IS NEW.category_id AND p.association_state = 'active' AND p.mode_inactive = 0
    AND (NEW.folder_roles IS NOT NULL OR NEW.mode = 'direct' OR EXISTS (SELECT 1 FROM categories c WHERE c.id = NEW.category_id
      AND c.source_id = NEW.source_id AND c.relative_path = NEW.parent_relative_path
      AND c.native_identity = NEW.parent_identity AND c.association_state = 'active' AND c.mode_inactive = 0)))
BEGIN SELECT RAISE(ABORT, 'Rename completion requires its committed active project, identity and source revision'); END;
--> statement-breakpoint
CREATE TRIGGER project_rename_delete BEFORE DELETE ON project_rename_operations
BEGIN SELECT RAISE(ABORT, 'Rename history must be retained'); END;
--> statement-breakpoint
CREATE TRIGGER project_rename_evidence_update BEFORE UPDATE ON project_rename_operations
WHEN (NEW.stage = 'uncertain' AND (NEW.last_verified_placement IS NOT OLD.last_verified_placement
    OR NEW.last_verified_identity IS NOT OLD.last_verified_identity
    OR NEW.staged_identity IS NOT OLD.staged_identity OR NEW.destination_identity IS NOT OLD.destination_identity))
OR (NEW.staged_identity IS NOT OLD.staged_identity AND NEW.stage != 'staged')
OR (NEW.destination_identity IS NOT OLD.destination_identity AND NEW.stage != 'destination_recorded')
BEGIN SELECT RAISE(ABORT, 'Rename uncertainty must retain the last verified evidence'); END;
--> statement-breakpoint
CREATE TRIGGER project_rename_history_insert BEFORE INSERT ON project_rename_operations
WHEN EXISTS (SELECT 1 FROM project_rename_operations o WHERE o.operation_id = NEW.operation_id
  OR (o.project_id = NEW.project_id AND o.stage IN ('intent', 'staged', 'destination_recorded', 'uncertain')))
BEGIN SELECT RAISE(ABORT, 'Rename history and unfinished project operations must be retained'); END;
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
    AND (NEW.folder_roles IS NOT NULL OR NEW.mode = 'direct' OR EXISTS (SELECT 1 FROM categories c WHERE c.id = NEW.category_id
      AND c.source_id = NEW.source_id AND c.relative_path = NEW.parent_relative_path
      AND c.native_identity = NEW.parent_identity AND c.association_state = 'active' AND c.mode_inactive = 0)))
BEGIN SELECT RAISE(ABORT, 'Rename intent requires the current active project and initiating source configuration'); END;
--> statement-breakpoint
CREATE TRIGGER project_rename_move_operation_id_insert BEFORE INSERT ON project_rename_operations
WHEN EXISTS (SELECT 1 FROM project_category_move_operations WHERE operation_id = NEW.operation_id)
BEGIN SELECT RAISE(ABORT, 'Operation ID already belongs to move history'); END;
--> statement-breakpoint
CREATE TRIGGER project_rename_operations_archive_id BEFORE INSERT ON project_rename_operations
WHEN EXISTS(SELECT 1 FROM project_archive_operations WHERE operation_id=NEW.operation_id)
BEGIN SELECT RAISE(ABORT, 'Operation ID belongs to archive history'); END;
--> statement-breakpoint
CREATE TRIGGER project_rename_operations_category_id BEFORE INSERT ON project_rename_operations
WHEN EXISTS (SELECT 1 FROM category_folder_operations WHERE operation_id = NEW.operation_id)
BEGIN SELECT RAISE(ABORT, 'Operation ID already bound'); END;
--> statement-breakpoint
CREATE TRIGGER project_rename_operations_removal_id BEFORE INSERT ON project_rename_operations
WHEN EXISTS(SELECT 1 FROM category_removal_operations WHERE operation_id = NEW.operation_id)
 OR EXISTS(SELECT 1 FROM category_removal_attempts WHERE move_id = NEW.operation_id)
BEGIN SELECT RAISE(ABORT, 'Operation ID already bound'); END;
--> statement-breakpoint
CREATE TRIGGER project_rename_path_insert BEFORE INSERT ON project_rename_operations
WHEN EXISTS (SELECT 1 FROM project_rename_operations o WHERE o.source_id = NEW.source_id
  AND o.stage IN ('intent', 'staged', 'destination_recorded', 'uncertain')
  AND (NEW.original_relative_path IN (o.original_relative_path, o.requested_relative_path, o.staging_relative_path)
    OR NEW.requested_relative_path IN (o.original_relative_path, o.requested_relative_path, o.staging_relative_path)
    OR NEW.staging_relative_path IN (o.original_relative_path, o.requested_relative_path, o.staging_relative_path)))
BEGIN SELECT RAISE(ABORT, 'Unfinished rename placements are reserved'); END;
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
CREATE TRIGGER project_rename_role_policy_insert BEFORE INSERT ON project_rename_operations
WHEN NOT EXISTS(SELECT 1 FROM sources s WHERE s.id=NEW.source_id AND s.folder_roles IS NEW.folder_roles)
OR (NEW.folder_roles IS NOT NULL AND (NEW.mode!='grouped' OR json_extract(NEW.authorization,'$.version') IS NOT 2))
BEGIN SELECT RAISE(ABORT,'Role intent requires the current source policy and full parent authority'); END;
--> statement-breakpoint
CREATE TRIGGER project_rename_role_policy_update BEFORE UPDATE ON project_rename_operations
WHEN NEW.folder_roles IS NOT OLD.folder_roles OR NEW.target_folder_roles IS NOT OLD.target_folder_roles
BEGIN SELECT RAISE(ABORT,'Role intent snapshots are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER project_rename_role_policy_complete BEFORE UPDATE ON project_rename_operations
WHEN NEW.stage='completed' AND OLD.stage!='completed' AND NEW.folder_roles IS NOT NULL
AND NOT EXISTS(SELECT 1 FROM sources s WHERE s.id=NEW.source_id AND s.folder_roles=NEW.target_folder_roles)
BEGIN SELECT RAISE(ABORT,'Role completion requires its committed target policy'); END;
--> statement-breakpoint
CREATE TABLE project_creation_operations_role_upgrade (
  folder_roles TEXT CHECK(folder_roles IS NULL OR (json_valid(folder_roles) AND json_type(folder_roles)='array')),
  target_folder_roles TEXT CHECK(target_folder_roles IS NULL OR (json_valid(target_folder_roles) AND json_type(target_folder_roles)='array')),
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
  completed_revision INTEGER, authorization TEXT CHECK(authorization IS NULL OR json_valid(authorization)), destination_evidence TEXT CHECK(destination_evidence IS NULL OR json_valid(destination_evidence)),
  FOREIGN KEY (category_id, source_id) REFERENCES categories(id, source_id),
  CHECK ((folder_roles IS NULL AND ((mode = 'direct' AND category_id IS NULL AND parent_relative_path = '' AND relative_path = name AND parent_identity = root_identity)
    OR (mode = 'grouped' AND category_id IS NOT NULL AND length(parent_relative_path) > 0
      AND instr(parent_relative_path, '/') = 0 AND parent_relative_path NOT IN ('.', '..')
      AND relative_path = parent_relative_path || '/' || name))) OR (folder_roles IS NOT NULL AND (mode='grouped' AND (parent_relative_path='' OR (substr(parent_relative_path,1,1)!='/' AND substr(parent_relative_path,-1)!='/' AND instr(parent_relative_path,'//')=0 AND instr('/'||parent_relative_path||'/','/../')=0 AND instr('/'||parent_relative_path||'/','/./')=0 AND instr(parent_relative_path,char(0))=0 AND instr(parent_relative_path,'\')=0)) AND relative_path=CASE WHEN parent_relative_path='' THEN name ELSE parent_relative_path||'/'||name END))),
  CHECK ((stage = 'intent' AND native_identity IS NULL AND problem IS NULL AND completed_revision IS NULL)
    OR (stage = 'evidence_recorded' AND native_identity IS NOT NULL AND problem IS NULL AND completed_revision IS NULL)
    OR (stage = 'uncertain' AND problem IS NOT NULL AND completed_revision IS NULL)
    OR (stage = 'failed' AND native_identity IS NULL AND problem IS NOT NULL AND completed_revision IS NULL)
    OR (stage = 'completed' AND native_identity IS NOT NULL AND problem IS NULL AND completed_revision IS NOT NULL AND completed_revision > expected_revision))
,
  CHECK ((folder_roles IS NULL AND target_folder_roles IS NULL) OR (folder_roles IS NOT NULL AND target_folder_roles IS NOT NULL))
);
--> statement-breakpoint
INSERT INTO project_creation_operations_role_upgrade ("operation_id","source_id","initiating_workspace_id","project_id","name","mode","expected_revision","category_id","canonical_root","parent_relative_path","relative_path","root_identity","parent_identity","excluded_relative_paths","archive_relative_path","stage","native_identity","problem","completed_revision","authorization","destination_evidence") SELECT "operation_id","source_id","initiating_workspace_id","project_id","name","mode","expected_revision","category_id","canonical_root","parent_relative_path","relative_path","root_identity","parent_identity","excluded_relative_paths","archive_relative_path","stage","native_identity","problem","completed_revision","authorization","destination_evidence" FROM project_creation_operations;
--> statement-breakpoint
DROP TABLE project_creation_operations;
--> statement-breakpoint
ALTER TABLE project_creation_operations_role_upgrade RENAME TO project_creation_operations;
--> statement-breakpoint
CREATE UNIQUE INDEX project_creation_outstanding_path ON project_creation_operations (source_id, relative_path) WHERE stage IN ('intent', 'evidence_recorded', 'uncertain');
--> statement-breakpoint
CREATE INDEX project_creation_source ON project_creation_operations (source_id);
--> statement-breakpoint
CREATE TRIGGER project_creation_authority_update BEFORE UPDATE ON project_creation_operations
WHEN (NEW.authorization IS NOT NULL AND NEW.native_identity IS NOT NULL AND NEW.destination_evidence IS NULL)
OR NEW.authorization IS NOT OLD.authorization
OR (OLD.destination_evidence IS NOT NULL AND NEW.destination_evidence IS NOT OLD.destination_evidence)
OR (NEW.destination_evidence IS NOT OLD.destination_evidence AND (OLD.stage IN ('completed','failed') OR NEW.stage != 'evidence_recorded'))
BEGIN SELECT RAISE(ABORT, 'Creation authorization and recorded durable evidence are immutable'); END;
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
OR (NEW.folder_roles IS NULL AND NEW.mode = 'grouped' AND NOT EXISTS (SELECT 1 FROM categories c WHERE c.id = NEW.category_id
  AND c.source_id = NEW.source_id AND c.relative_path = NEW.parent_relative_path
  AND c.native_identity = NEW.parent_identity AND c.association_state = 'active' AND c.mode_inactive = 0))
OR EXISTS (SELECT 1 FROM projects WHERE id = NEW.project_id)
BEGIN SELECT RAISE(ABORT, 'Creation intent requires a fresh ID and the initiating source configuration'); END;
--> statement-breakpoint
CREATE TRIGGER project_creation_move_operation_id_insert BEFORE INSERT ON project_creation_operations
WHEN EXISTS (SELECT 1 FROM project_category_move_operations WHERE operation_id = NEW.operation_id)
BEGIN SELECT RAISE(ABORT, 'Operation ID already belongs to move history'); END;
--> statement-breakpoint
CREATE TRIGGER project_creation_operations_archive_id BEFORE INSERT ON project_creation_operations
WHEN EXISTS(SELECT 1 FROM project_archive_operations WHERE operation_id=NEW.operation_id)
BEGIN SELECT RAISE(ABORT, 'Operation ID belongs to archive history'); END;
--> statement-breakpoint
CREATE TRIGGER project_creation_operations_category_id BEFORE INSERT ON project_creation_operations
WHEN EXISTS (SELECT 1 FROM category_folder_operations WHERE operation_id = NEW.operation_id)
BEGIN SELECT RAISE(ABORT, 'Operation ID already bound'); END;
--> statement-breakpoint
CREATE TRIGGER project_creation_operations_removal_id BEFORE INSERT ON project_creation_operations
WHEN EXISTS(SELECT 1 FROM category_removal_operations WHERE operation_id = NEW.operation_id)
 OR EXISTS(SELECT 1 FROM category_removal_attempts WHERE move_id = NEW.operation_id)
BEGIN SELECT RAISE(ABORT, 'Operation ID already bound'); END;
--> statement-breakpoint
CREATE TRIGGER project_creation_stage_update BEFORE UPDATE ON project_creation_operations
WHEN NEW.stage != OLD.stage AND OLD.stage NOT IN ('completed', 'failed') AND NOT (
  (OLD.stage = 'intent' AND NEW.stage IN ('evidence_recorded', 'uncertain', 'failed'))
  OR (OLD.stage = 'evidence_recorded' AND NEW.stage IN ('uncertain', 'completed'))
  OR (OLD.stage = 'uncertain' AND NEW.stage = 'evidence_recorded'))
BEGIN SELECT RAISE(ABORT, 'Invalid creation stage transition'); END;
--> statement-breakpoint
CREATE TRIGGER project_creation_role_policy_insert BEFORE INSERT ON project_creation_operations
WHEN NOT EXISTS(SELECT 1 FROM sources s WHERE s.id=NEW.source_id AND s.folder_roles IS NEW.folder_roles)
OR (NEW.folder_roles IS NOT NULL AND (NEW.mode!='grouped' OR json_extract(NEW.authorization,'$.version') IS NOT 2))
BEGIN SELECT RAISE(ABORT,'Role intent requires the current source policy and full parent authority'); END;
--> statement-breakpoint
CREATE TRIGGER project_creation_role_policy_update BEFORE UPDATE ON project_creation_operations
WHEN NEW.folder_roles IS NOT OLD.folder_roles OR NEW.target_folder_roles IS NOT OLD.target_folder_roles
BEGIN SELECT RAISE(ABORT,'Role intent snapshots are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER project_creation_role_policy_complete BEFORE UPDATE ON project_creation_operations
WHEN NEW.stage='completed' AND OLD.stage!='completed' AND NEW.folder_roles IS NOT NULL
AND NOT EXISTS(SELECT 1 FROM sources s WHERE s.id=NEW.source_id AND s.folder_roles=NEW.target_folder_roles)
BEGIN SELECT RAISE(ABORT,'Role completion requires its committed target policy'); END;
--> statement-breakpoint
CREATE TABLE project_category_move_operations_role_upgrade (
  folder_roles TEXT CHECK(folder_roles IS NULL OR (json_valid(folder_roles) AND json_type(folder_roles)='array')),
  target_folder_roles TEXT CHECK(target_folder_roles IS NULL OR (json_valid(target_folder_roles) AND json_type(target_folder_roles)='array')),
  operation_id TEXT PRIMARY KEY NOT NULL,
  source_id TEXT NOT NULL REFERENCES sources(id),
  initiating_workspace_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(name) > 0 AND name NOT IN ('.', '..') AND instr(name, '/') = 0 AND instr(name, char(0)) = 0),
  expected_revision INTEGER NOT NULL CHECK (typeof(expected_revision) = 'integer' AND expected_revision >= 0),
  original_category_id TEXT,
  destination_category_id TEXT,
  canonical_root TEXT NOT NULL,
  original_parent_relative_path TEXT NOT NULL CHECK ((folder_roles IS NULL AND (length(original_parent_relative_path) > 0 AND original_parent_relative_path NOT IN ('.', '..') AND instr(original_parent_relative_path, '/') = 0 AND instr(original_parent_relative_path, char(0)) = 0)) OR (folder_roles IS NOT NULL AND ((original_parent_relative_path='' OR (substr(original_parent_relative_path,1,1)!='/' AND substr(original_parent_relative_path,-1)!='/' AND instr(original_parent_relative_path,'//')=0 AND instr('/'||original_parent_relative_path||'/','/../')=0 AND instr('/'||original_parent_relative_path||'/','/./')=0 AND instr(original_parent_relative_path,char(0))=0 AND instr(original_parent_relative_path,'\')=0))))),
  destination_parent_relative_path TEXT NOT NULL CHECK ((folder_roles IS NULL AND (length(destination_parent_relative_path) > 0 AND destination_parent_relative_path NOT IN ('.', '..') AND instr(destination_parent_relative_path, '/') = 0 AND instr(destination_parent_relative_path, char(0)) = 0)) OR (folder_roles IS NOT NULL AND ((destination_parent_relative_path='' OR (substr(destination_parent_relative_path,1,1)!='/' AND substr(destination_parent_relative_path,-1)!='/' AND instr(destination_parent_relative_path,'//')=0 AND instr('/'||destination_parent_relative_path||'/','/../')=0 AND instr('/'||destination_parent_relative_path||'/','/./')=0 AND instr(destination_parent_relative_path,char(0))=0 AND instr(destination_parent_relative_path,'\')=0))))),
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
  completed_revision INTEGER CHECK (completed_revision IS NULL OR (typeof(completed_revision) = 'integer' AND completed_revision >= 0)), original_authorization TEXT CHECK(original_authorization IS NULL OR json_valid(original_authorization)), destination_authorization TEXT CHECK(destination_authorization IS NULL OR json_valid(destination_authorization)), project_evidence TEXT CHECK(project_evidence IS NULL OR json_valid(project_evidence)),
  FOREIGN KEY (project_id, source_id) REFERENCES projects(id, source_id),
  FOREIGN KEY (original_category_id, source_id) REFERENCES categories(id, source_id),
  FOREIGN KEY (destination_category_id, source_id) REFERENCES categories(id, source_id),
  CHECK ((folder_roles IS NULL AND (original_relative_path = original_parent_relative_path || '/' || name
    AND requested_relative_path = destination_parent_relative_path || '/' || name)) OR (folder_roles IS NOT NULL AND (original_relative_path=CASE WHEN original_parent_relative_path='' THEN name ELSE original_parent_relative_path||'/'||name END AND requested_relative_path=CASE WHEN destination_parent_relative_path='' THEN name ELSE destination_parent_relative_path||'/'||name END))),
  CHECK ((folder_roles IS NULL AND ((original_category_id = destination_category_id AND original_parent_relative_path = destination_parent_relative_path
      AND original_parent_identity = destination_parent_identity)
    OR (original_category_id != destination_category_id AND original_parent_relative_path != destination_parent_relative_path))) OR (folder_roles IS NOT NULL AND (original_parent_relative_path!=destination_parent_relative_path OR (original_category_id IS destination_category_id AND original_parent_identity=destination_parent_identity)))),
  CHECK (last_verified_placement = 'original' OR destination_identity IS NOT NULL),
  CHECK ((stage = 'intent' AND destination_identity IS NULL AND last_verified_placement = 'original'
      AND problem IS NULL AND result_kind IS NULL AND completed_revision IS NULL)
    OR (stage = 'destination_recorded' AND destination_identity IS NOT NULL AND last_verified_placement = 'destination'
      AND problem IS NULL AND result_kind IS NULL AND completed_revision IS NULL)
    OR (stage = 'uncertain' AND problem IS NOT NULL AND result_kind IS NULL AND completed_revision IS NULL)
    OR (stage = 'failed' AND last_verified_placement = 'original' AND problem IS NOT NULL AND result_kind = 'rejected'
      AND result_kind IS NOT NULL AND completed_revision IS NULL)
    OR (stage = 'completed' AND problem IS NULL AND result_kind IS NOT NULL AND completed_revision IS NOT NULL AND (
      (result_kind = 'completed' AND ((folder_roles IS NULL AND original_category_id != destination_category_id) OR (folder_roles IS NOT NULL AND original_relative_path != requested_relative_path)) AND destination_identity IS NOT NULL
        AND last_verified_placement = 'destination' AND completed_revision > expected_revision)
      OR (result_kind = 'unchanged' AND original_category_id IS destination_category_id AND original_relative_path=requested_relative_path AND destination_identity IS NULL
        AND last_verified_placement = 'original' AND completed_revision = expected_revision))))
,
 CHECK(folder_roles IS NOT NULL OR (original_category_id IS NOT NULL AND destination_category_id IS NOT NULL))
,
  CHECK ((folder_roles IS NULL AND target_folder_roles IS NULL) OR (folder_roles IS NOT NULL AND target_folder_roles IS NOT NULL))
);
--> statement-breakpoint
INSERT INTO project_category_move_operations_role_upgrade ("operation_id","source_id","initiating_workspace_id","project_id","name","expected_revision","original_category_id","destination_category_id","canonical_root","original_parent_relative_path","destination_parent_relative_path","original_relative_path","requested_relative_path","root_identity","original_parent_identity","destination_parent_identity","native_identity","excluded_relative_paths","archive_relative_path","stage","destination_identity","last_verified_placement","last_verified_identity","problem","result_kind","completed_revision","original_authorization","destination_authorization","project_evidence") SELECT "operation_id","source_id","initiating_workspace_id","project_id","name","expected_revision","original_category_id","destination_category_id","canonical_root","original_parent_relative_path","destination_parent_relative_path","original_relative_path","requested_relative_path","root_identity","original_parent_identity","destination_parent_identity","native_identity","excluded_relative_paths","archive_relative_path","stage","destination_identity","last_verified_placement","last_verified_identity","problem","result_kind","completed_revision","original_authorization","destination_authorization","project_evidence" FROM project_category_move_operations;
--> statement-breakpoint
DROP TABLE project_category_move_operations;
--> statement-breakpoint
ALTER TABLE project_category_move_operations_role_upgrade RENAME TO project_category_move_operations;
--> statement-breakpoint
CREATE UNIQUE INDEX project_category_move_outstanding_project ON project_category_move_operations (project_id) WHERE stage IN ('intent', 'destination_recorded', 'uncertain');
--> statement-breakpoint
CREATE INDEX project_category_move_source ON project_category_move_operations (source_id);
--> statement-breakpoint
CREATE TRIGGER project_category_move_authority_update BEFORE UPDATE ON project_category_move_operations
WHEN NEW.original_authorization IS NOT OLD.original_authorization OR NEW.destination_authorization IS NOT OLD.destination_authorization OR NEW.project_evidence IS NOT OLD.project_evidence
BEGIN SELECT RAISE(ABORT, 'Category move authorization and project evidence are immutable'); END;
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
CREATE TRIGGER project_category_move_complete BEFORE UPDATE ON project_category_move_operations
WHEN NEW.stage = 'completed' AND OLD.stage != 'completed' AND NOT EXISTS (SELECT 1 FROM sources s JOIN projects p ON p.source_id = s.id
    WHERE s.id = NEW.source_id AND s.canonical_root = NEW.canonical_root AND s.discovery_mode = 'grouped'
    AND s.discovery_revision = NEW.completed_revision AND s.applied_root_identity = NEW.root_identity
    AND s.excluded_relative_paths = NEW.excluded_relative_paths AND s.archive_relative_path IS NEW.archive_relative_path
    AND p.id = NEW.project_id AND p.relative_path = NEW.requested_relative_path AND p.native_identity = NEW.native_identity
    AND p.category_id IS NEW.destination_category_id AND p.association_state = 'active' AND p.mode_inactive = 0
    AND (NEW.folder_roles IS NOT NULL OR EXISTS (SELECT 1 FROM categories c WHERE c.id = NEW.original_category_id AND c.source_id = NEW.source_id
      AND c.relative_path = NEW.original_parent_relative_path AND c.native_identity = NEW.original_parent_identity
      AND c.association_state = 'active' AND c.mode_inactive = 0))
    AND (NEW.folder_roles IS NOT NULL OR EXISTS (SELECT 1 FROM categories c WHERE c.id = NEW.destination_category_id AND c.source_id = NEW.source_id
      AND c.relative_path = NEW.destination_parent_relative_path AND c.native_identity = NEW.destination_parent_identity
      AND c.association_state = 'active' AND c.mode_inactive = 0)))
BEGIN SELECT RAISE(ABORT, 'Move completion requires committed project category, locator, identity and source revision'); END;
--> statement-breakpoint
CREATE TRIGGER project_category_move_delete BEFORE DELETE ON project_category_move_operations
BEGIN SELECT RAISE(ABORT, 'Move history must be retained'); END;
--> statement-breakpoint
CREATE TRIGGER project_category_move_evidence_update BEFORE UPDATE ON project_category_move_operations
WHEN (NEW.stage = 'uncertain' AND (NEW.last_verified_placement IS NOT OLD.last_verified_placement
    OR NEW.last_verified_identity IS NOT OLD.last_verified_identity OR NEW.destination_identity IS NOT OLD.destination_identity))
OR (NEW.destination_identity IS NOT OLD.destination_identity AND NEW.stage != 'destination_recorded')
BEGIN SELECT RAISE(ABORT, 'Move uncertainty must retain the last verified evidence'); END;
--> statement-breakpoint
CREATE TRIGGER project_category_move_history_insert BEFORE INSERT ON project_category_move_operations
WHEN EXISTS (SELECT 1 FROM project_category_move_operations o WHERE o.operation_id = NEW.operation_id
  OR (o.project_id = NEW.project_id AND o.stage IN ('intent', 'destination_recorded', 'uncertain')))
BEGIN SELECT RAISE(ABORT, 'Move history and unfinished project operations must be retained'); END;
--> statement-breakpoint
CREATE TRIGGER project_category_move_insert BEFORE INSERT ON project_category_move_operations
WHEN NEW.stage != 'intent' OR NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.id = NEW.initiating_workspace_id AND w.source_id = NEW.source_id)
OR NOT EXISTS (SELECT 1 FROM sources s JOIN projects p ON p.source_id = s.id
    WHERE s.id = NEW.source_id AND s.canonical_root = NEW.canonical_root AND s.discovery_mode = 'grouped'
    AND s.discovery_revision = NEW.expected_revision AND s.applied_root_identity = NEW.root_identity
    AND s.excluded_relative_paths = NEW.excluded_relative_paths AND s.archive_relative_path IS NEW.archive_relative_path
    AND p.id = NEW.project_id AND p.relative_path = NEW.original_relative_path AND p.native_identity = NEW.native_identity
    AND p.category_id IS NEW.original_category_id AND p.association_state = 'active' AND p.mode_inactive = 0
    AND (NEW.folder_roles IS NOT NULL OR EXISTS (SELECT 1 FROM categories c WHERE c.id = NEW.original_category_id AND c.source_id = NEW.source_id
      AND c.relative_path = NEW.original_parent_relative_path AND c.native_identity = NEW.original_parent_identity
      AND c.association_state = 'active' AND c.mode_inactive = 0))
    AND (NEW.folder_roles IS NOT NULL OR EXISTS (SELECT 1 FROM categories c WHERE c.id = NEW.destination_category_id AND c.source_id = NEW.source_id
      AND c.relative_path = NEW.destination_parent_relative_path AND c.native_identity = NEW.destination_parent_identity
      AND c.association_state = 'active' AND c.mode_inactive = 0)))
BEGIN SELECT RAISE(ABORT, 'Move intent requires current active project, categories and initiating source configuration'); END;
--> statement-breakpoint
CREATE TRIGGER project_category_move_operation_id_insert BEFORE INSERT ON project_category_move_operations
WHEN EXISTS (SELECT 1 FROM project_creation_operations WHERE operation_id = NEW.operation_id)
  OR EXISTS (SELECT 1 FROM project_rename_operations WHERE operation_id = NEW.operation_id)
BEGIN SELECT RAISE(ABORT, 'Operation ID already belongs to creation or rename history'); END;
--> statement-breakpoint
CREATE TRIGGER project_category_move_operations_archive_id BEFORE INSERT ON project_category_move_operations
WHEN EXISTS(SELECT 1 FROM project_archive_operations WHERE operation_id=NEW.operation_id)
BEGIN SELECT RAISE(ABORT, 'Operation ID belongs to archive history'); END;
--> statement-breakpoint
CREATE TRIGGER project_category_move_operations_category_id BEFORE INSERT ON project_category_move_operations
WHEN EXISTS (SELECT 1 FROM category_folder_operations WHERE operation_id = NEW.operation_id)
BEGIN SELECT RAISE(ABORT, 'Operation ID already bound'); END;
--> statement-breakpoint
CREATE TRIGGER project_category_move_operations_removal_id BEFORE INSERT ON project_category_move_operations
WHEN EXISTS(SELECT 1 FROM category_removal_operations WHERE operation_id = NEW.operation_id)
BEGIN SELECT RAISE(ABORT, 'Operation ID already bound'); END;
--> statement-breakpoint
CREATE TRIGGER project_category_move_path_insert BEFORE INSERT ON project_category_move_operations
WHEN EXISTS (SELECT 1 FROM project_category_move_operations o WHERE o.source_id = NEW.source_id
  AND o.stage IN ('intent', 'destination_recorded', 'uncertain')
  AND (NEW.original_relative_path IN (o.original_relative_path, o.requested_relative_path)
    OR NEW.requested_relative_path IN (o.original_relative_path, o.requested_relative_path)))
BEGIN SELECT RAISE(ABORT, 'Unfinished move placements are reserved'); END;
--> statement-breakpoint
CREATE TRIGGER project_category_move_removal_child BEFORE INSERT ON project_category_move_operations
WHEN EXISTS(SELECT 1 FROM category_removal_attempts WHERE move_id = NEW.operation_id)
 AND NOT EXISTS(SELECT 1 FROM category_removal_attempts a JOIN category_removal_operations r ON r.operation_id = a.removal_id
 WHERE a.move_id = NEW.operation_id AND a.project_id = NEW.project_id AND a.workspace_id = NEW.initiating_workspace_id
 AND a.expected_revision = NEW.expected_revision AND r.stage = 'moving' AND r.source_id = NEW.source_id
 AND r.category_id = NEW.original_category_id AND r.destination_category_id = NEW.destination_category_id
 AND r.original_relative_path = NEW.original_parent_relative_path AND r.requested_relative_path = NEW.destination_parent_relative_path)
BEGIN SELECT RAISE(ABORT, 'Move does not match its removal assignment'); END;
--> statement-breakpoint
CREATE TRIGGER project_category_move_stage_update BEFORE UPDATE ON project_category_move_operations
WHEN NEW.stage != OLD.stage AND OLD.stage NOT IN ('completed', 'failed') AND NOT (
  (OLD.stage = 'intent' AND NEW.stage IN ('destination_recorded', 'uncertain', 'failed'))
  OR (OLD.stage = 'intent' AND NEW.stage = 'completed' AND NEW.result_kind = 'unchanged')
  OR (OLD.stage = 'destination_recorded' AND NEW.stage IN ('completed', 'uncertain'))
  OR (OLD.stage = 'uncertain' AND NEW.stage IN ('destination_recorded', 'failed')))
BEGIN SELECT RAISE(ABORT, 'Invalid move stage transition'); END;
--> statement-breakpoint
CREATE TRIGGER project_category_move_role_policy_insert BEFORE INSERT ON project_category_move_operations
WHEN NOT EXISTS(SELECT 1 FROM sources s WHERE s.id=NEW.source_id AND s.folder_roles IS NEW.folder_roles)
OR (NEW.folder_roles IS NOT NULL AND (0 OR json_extract(NEW.original_authorization,'$.version') IS NOT 2))
BEGIN SELECT RAISE(ABORT,'Role intent requires the current source policy and full parent authority'); END;
--> statement-breakpoint
CREATE TRIGGER project_category_move_role_policy_update BEFORE UPDATE ON project_category_move_operations
WHEN NEW.folder_roles IS NOT OLD.folder_roles OR NEW.target_folder_roles IS NOT OLD.target_folder_roles
BEGIN SELECT RAISE(ABORT,'Role intent snapshots are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER project_category_move_role_policy_complete BEFORE UPDATE ON project_category_move_operations
WHEN NEW.stage='completed' AND OLD.stage!='completed' AND NEW.folder_roles IS NOT NULL
AND NOT EXISTS(SELECT 1 FROM sources s WHERE s.id=NEW.source_id AND s.folder_roles=NEW.target_folder_roles)
BEGIN SELECT RAISE(ABORT,'Role completion requires its committed target policy'); END;
--> statement-breakpoint
PRAGMA legacy_alter_table=OFF;
--> statement-breakpoint
CREATE TEMP TABLE role_journal_integrity_gate(violations INTEGER NOT NULL CHECK(violations=0));
--> statement-breakpoint
INSERT INTO role_journal_integrity_gate SELECT count(*) FROM pragma_foreign_key_check;
--> statement-breakpoint
DROP TABLE role_journal_integrity_gate;
--> statement-breakpoint
PRAGMA defer_foreign_keys=OFF;
