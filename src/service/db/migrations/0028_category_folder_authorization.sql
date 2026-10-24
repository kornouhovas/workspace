ALTER TABLE category_folder_operations ADD COLUMN authorization TEXT CHECK(authorization IS NULL OR json_valid(authorization));
--> statement-breakpoint
ALTER TABLE category_folder_operations ADD COLUMN destination_evidence TEXT CHECK(destination_evidence IS NULL OR json_valid(destination_evidence));
--> statement-breakpoint
CREATE TRIGGER category_folder_authority_update BEFORE UPDATE ON category_folder_operations
WHEN NEW.authorization IS NOT OLD.authorization OR OLD.destination_evidence IS NOT NULL AND NEW.destination_evidence IS NOT OLD.destination_evidence
BEGIN SELECT RAISE(ABORT, 'Category authorization and recorded destination evidence are immutable'); END;
--> statement-breakpoint
CREATE TABLE category_folder_attestations (
  id TEXT PRIMARY KEY NOT NULL,
  operation_id TEXT NOT NULL REFERENCES category_folder_operations(operation_id),
  journal TEXT NOT NULL CHECK(json_valid(journal)),
  authorization TEXT NOT NULL CHECK(json_valid(authorization)),
  destination_evidence TEXT CHECK(destination_evidence IS NULL OR json_valid(destination_evidence))
);
--> statement-breakpoint
CREATE TRIGGER category_folder_attestation_insert BEFORE INSERT ON category_folder_attestations
WHEN EXISTS(SELECT 1 FROM category_folder_attestations WHERE id=NEW.id)
OR NOT EXISTS(SELECT 1 FROM category_folder_operations WHERE operation_id=NEW.operation_id AND stage NOT IN ('completed','failed'))
BEGIN SELECT RAISE(ABORT, 'Category attestation requires unfinished history and a fresh ID'); END;
--> statement-breakpoint
CREATE TRIGGER category_folder_attestation_update BEFORE UPDATE ON category_folder_attestations
BEGIN SELECT RAISE(ABORT, 'Category attestations must be retained unchanged'); END;
--> statement-breakpoint
CREATE TRIGGER category_folder_attestation_delete BEFORE DELETE ON category_folder_attestations
BEGIN SELECT RAISE(ABORT, 'Category attestations must be retained unchanged'); END;
