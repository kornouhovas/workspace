ALTER TABLE project_archives ADD COLUMN authorization TEXT CHECK(authorization IS NULL OR json_valid(authorization));
--> statement-breakpoint
CREATE TABLE project_archive_attestations (
 id TEXT PRIMARY KEY NOT NULL,
 operation_id TEXT NOT NULL REFERENCES project_archive_operations(operation_id),
 sequence INTEGER NOT NULL CHECK(sequence >= 0),
 journal TEXT NOT NULL CHECK(json_valid(journal)),
 binding TEXT NOT NULL CHECK(json_valid(binding)),
 parents TEXT NOT NULL CHECK(json_valid(parents)),
 UNIQUE(operation_id,sequence)
);
--> statement-breakpoint
CREATE TRIGGER project_archive_attestation_insert BEFORE INSERT ON project_archive_attestations
WHEN EXISTS(SELECT 1 FROM project_archive_attestations WHERE id=NEW.id)
 OR NOT EXISTS(SELECT 1 FROM project_archive_operations WHERE operation_id=NEW.operation_id AND stage IN ('intent','destination_recorded'))
BEGIN SELECT RAISE(ABORT, 'Archive attestation requires unfinished history and a fresh ID'); END;
--> statement-breakpoint
CREATE TRIGGER project_archive_attestation_update BEFORE UPDATE ON project_archive_attestations
BEGIN SELECT RAISE(ABORT, 'Archive attestations must be retained unchanged'); END;
--> statement-breakpoint
CREATE TRIGGER project_archive_attestation_delete BEFORE DELETE ON project_archive_attestations
BEGIN SELECT RAISE(ABORT, 'Archive attestations must be retained unchanged'); END;
--> statement-breakpoint
CREATE TRIGGER archive_parent_durable_evidence BEFORE UPDATE OF parents ON project_archive_operations
WHEN EXISTS(SELECT 1 FROM json_each(OLD.parents) p
 WHERE json_extract(p.value,'$.observation') IS NOT NULL AND
 json_extract(NEW.parents,'$[' || p.key || '].observation') IS NOT json_extract(p.value,'$.observation'))
BEGIN SELECT RAISE(ABORT, 'Archive parent durable evidence is append-only'); END;
