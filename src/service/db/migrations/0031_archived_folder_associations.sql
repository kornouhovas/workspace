CREATE TABLE archived_folder_associations (
 id TEXT PRIMARY KEY NOT NULL,
 source_id TEXT NOT NULL REFERENCES sources(id),
 project_id TEXT NOT NULL REFERENCES projects(id),
 generation INTEGER NOT NULL CHECK(generation>0),
 authorization TEXT NOT NULL CHECK(json_valid(authorization)),
 UNIQUE(project_id,generation)
);
--> statement-breakpoint
CREATE TRIGGER archived_folder_association_insert BEFORE INSERT ON archived_folder_associations
WHEN EXISTS(SELECT 1 FROM archived_folder_associations WHERE id=NEW.id)
 OR NOT EXISTS(SELECT 1 FROM projects p JOIN sources s ON s.id=p.source_id JOIN project_archives a ON a.project_id=p.id
 WHERE p.id=NEW.project_id AND p.source_id=NEW.source_id AND a.source_id=NEW.source_id AND p.mode_inactive=1 AND s.evidence_generation=NEW.generation)
BEGIN SELECT RAISE(ABORT, 'Archived association requires reviewed current ownership and a fresh ID'); END;
--> statement-breakpoint
CREATE TRIGGER archived_folder_association_update BEFORE UPDATE ON archived_folder_associations
BEGIN SELECT RAISE(ABORT, 'Archived association history must be retained'); END;
--> statement-breakpoint
CREATE TRIGGER archived_folder_association_delete BEFORE DELETE ON archived_folder_associations
BEGIN SELECT RAISE(ABORT, 'Archived association history must be retained'); END;
