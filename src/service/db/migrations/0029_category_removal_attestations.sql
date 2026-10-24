CREATE TABLE category_removal_attestations (
 id TEXT PRIMARY KEY NOT NULL,
 operation_id TEXT NOT NULL REFERENCES category_removal_operations(operation_id),
 sequence INTEGER NOT NULL CHECK(sequence >= 0),
 journal TEXT NOT NULL CHECK(json_valid(journal)),
 binding TEXT NOT NULL CHECK(json_valid(binding)),
 UNIQUE(operation_id,sequence)
);
--> statement-breakpoint
CREATE TRIGGER category_removal_attestation_insert BEFORE INSERT ON category_removal_attestations
WHEN EXISTS(SELECT 1 FROM category_removal_attestations WHERE id=NEW.id)
 OR NOT EXISTS(SELECT 1 FROM category_removal_operations WHERE operation_id=NEW.operation_id AND stage IN ('moving','cleanup_intent'))
BEGIN SELECT RAISE(ABORT, 'Removal attestation requires unfinished history and a fresh ID'); END;
--> statement-breakpoint
CREATE TRIGGER category_removal_attestation_update BEFORE UPDATE ON category_removal_attestations
BEGIN SELECT RAISE(ABORT, 'Removal attestations must be retained unchanged'); END;
--> statement-breakpoint
CREATE TRIGGER category_removal_attestation_delete BEFORE DELETE ON category_removal_attestations
BEGIN SELECT RAISE(ABORT, 'Removal attestations must be retained unchanged'); END;
