ALTER TABLE project_rename_operations ADD COLUMN authorization TEXT CHECK(authorization IS NULL OR json_valid(authorization));
--> statement-breakpoint
ALTER TABLE project_rename_operations ADD COLUMN project_evidence TEXT CHECK(project_evidence IS NULL OR json_valid(project_evidence));
--> statement-breakpoint
CREATE TRIGGER project_rename_authority_update BEFORE UPDATE ON project_rename_operations
WHEN NEW.authorization IS NOT OLD.authorization OR NEW.project_evidence IS NOT OLD.project_evidence
BEGIN SELECT RAISE(ABORT, 'Rename authorization and project evidence are immutable'); END;
--> statement-breakpoint
CREATE TABLE project_rename_attestations (
  id TEXT PRIMARY KEY NOT NULL,
  operation_id TEXT NOT NULL REFERENCES project_rename_operations(operation_id),
  journal TEXT NOT NULL CHECK(json_valid(journal)),
  authorization TEXT NOT NULL CHECK(json_valid(authorization)),
  project_evidence TEXT NOT NULL CHECK(json_valid(project_evidence))
);
--> statement-breakpoint
CREATE TRIGGER project_rename_attestation_insert BEFORE INSERT ON project_rename_attestations
WHEN EXISTS(SELECT 1 FROM project_rename_attestations WHERE id=NEW.id)
OR NOT EXISTS(SELECT 1 FROM project_rename_operations WHERE operation_id=NEW.operation_id AND stage NOT IN ('completed','failed'))
BEGIN SELECT RAISE(ABORT, 'Rename attestation requires unfinished history and a fresh ID'); END;
--> statement-breakpoint
CREATE TRIGGER project_rename_attestation_update BEFORE UPDATE ON project_rename_attestations
BEGIN SELECT RAISE(ABORT, 'Rename attestations must be retained unchanged'); END;
--> statement-breakpoint
CREATE TRIGGER project_rename_attestation_delete BEFORE DELETE ON project_rename_attestations
BEGIN SELECT RAISE(ABORT, 'Rename attestations must be retained unchanged'); END;
