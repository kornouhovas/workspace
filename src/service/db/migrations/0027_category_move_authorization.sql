ALTER TABLE project_category_move_operations ADD COLUMN original_authorization TEXT CHECK(original_authorization IS NULL OR json_valid(original_authorization));
--> statement-breakpoint
ALTER TABLE project_category_move_operations ADD COLUMN destination_authorization TEXT CHECK(destination_authorization IS NULL OR json_valid(destination_authorization));
--> statement-breakpoint
ALTER TABLE project_category_move_operations ADD COLUMN project_evidence TEXT CHECK(project_evidence IS NULL OR json_valid(project_evidence));
--> statement-breakpoint
CREATE TRIGGER project_category_move_authority_update BEFORE UPDATE ON project_category_move_operations
WHEN NEW.original_authorization IS NOT OLD.original_authorization OR NEW.destination_authorization IS NOT OLD.destination_authorization OR NEW.project_evidence IS NOT OLD.project_evidence
BEGIN SELECT RAISE(ABORT, 'Category move authorization and project evidence are immutable'); END;
--> statement-breakpoint
CREATE TABLE project_category_move_attestations (
  id TEXT PRIMARY KEY NOT NULL,
  operation_id TEXT NOT NULL REFERENCES project_category_move_operations(operation_id),
  journal TEXT NOT NULL CHECK(json_valid(journal)),
  original_authorization TEXT NOT NULL CHECK(json_valid(original_authorization)),
  destination_authorization TEXT NOT NULL CHECK(json_valid(destination_authorization)),
  project_evidence TEXT NOT NULL CHECK(json_valid(project_evidence))
);
--> statement-breakpoint
CREATE TRIGGER project_category_move_attestation_insert BEFORE INSERT ON project_category_move_attestations
WHEN EXISTS(SELECT 1 FROM project_category_move_attestations WHERE id=NEW.id)
OR NOT EXISTS(SELECT 1 FROM project_category_move_operations WHERE operation_id=NEW.operation_id AND stage NOT IN ('completed','failed'))
BEGIN SELECT RAISE(ABORT, 'Category move attestation requires unfinished history and a fresh ID'); END;
--> statement-breakpoint
CREATE TRIGGER project_category_move_attestation_update BEFORE UPDATE ON project_category_move_attestations
BEGIN SELECT RAISE(ABORT, 'Category move attestations must be retained unchanged'); END;
--> statement-breakpoint
CREATE TRIGGER project_category_move_attestation_delete BEFORE DELETE ON project_category_move_attestations
BEGIN SELECT RAISE(ABORT, 'Category move attestations must be retained unchanged'); END;
