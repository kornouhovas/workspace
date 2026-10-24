-- Legacy journal bytes are retained; NULL never confers durable authority.
ALTER TABLE project_creation_operations ADD COLUMN authorization TEXT CHECK(authorization IS NULL OR json_valid(authorization));
--> statement-breakpoint
ALTER TABLE project_creation_operations ADD COLUMN destination_evidence TEXT CHECK(destination_evidence IS NULL OR json_valid(destination_evidence));
--> statement-breakpoint
CREATE TRIGGER project_creation_authority_update BEFORE UPDATE ON project_creation_operations
WHEN (NEW.authorization IS NOT NULL AND NEW.native_identity IS NOT NULL AND NEW.destination_evidence IS NULL)
OR NEW.authorization IS NOT OLD.authorization
OR (OLD.destination_evidence IS NOT NULL AND NEW.destination_evidence IS NOT OLD.destination_evidence)
OR (NEW.destination_evidence IS NOT OLD.destination_evidence AND (OLD.stage IN ('completed','failed') OR NEW.stage != 'evidence_recorded'))
BEGIN SELECT RAISE(ABORT, 'Creation authorization and recorded durable evidence are immutable'); END;
--> statement-breakpoint
CREATE TABLE project_creation_attestations (
  id TEXT PRIMARY KEY NOT NULL,
  operation_id TEXT NOT NULL REFERENCES project_creation_operations(operation_id),
  journal TEXT NOT NULL CHECK(json_valid(journal)),
  destination_evidence TEXT CHECK(destination_evidence IS NULL OR json_valid(destination_evidence)),
  authorization TEXT NOT NULL CHECK(json_valid(authorization))
);
--> statement-breakpoint
CREATE TRIGGER project_creation_attestation_insert BEFORE INSERT ON project_creation_attestations
WHEN EXISTS(SELECT 1 FROM project_creation_attestations WHERE id=NEW.id)
OR NOT EXISTS(SELECT 1 FROM project_creation_operations WHERE operation_id=NEW.operation_id AND stage NOT IN ('completed','failed'))
BEGIN SELECT RAISE(ABORT, 'Creation attestation requires unfinished history and a fresh ID'); END;
--> statement-breakpoint
CREATE TRIGGER project_creation_attestation_update BEFORE UPDATE ON project_creation_attestations
BEGIN SELECT RAISE(ABORT, 'Creation attestations must be retained unchanged'); END;
--> statement-breakpoint
CREATE TRIGGER project_creation_attestation_delete BEFORE DELETE ON project_creation_attestations
BEGIN SELECT RAISE(ABORT, 'Creation attestations must be retained unchanged'); END;
