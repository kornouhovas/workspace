ALTER TABLE sources ADD COLUMN property_revision INTEGER NOT NULL DEFAULT 0 CHECK (property_revision >= 0);
--> statement-breakpoint
CREATE TABLE property_definitions (
  id TEXT PRIMARY KEY NOT NULL,
  source_id TEXT NOT NULL REFERENCES sources(id),
  name TEXT NOT NULL,
  property_type TEXT NOT NULL CHECK (property_type = 'text'),
  position INTEGER NOT NULL CHECK (position >= 0),
  UNIQUE (source_id, position),
  UNIQUE (id, source_id)
);
--> statement-breakpoint
CREATE UNIQUE INDEX projects_id_source ON projects (id, source_id);
--> statement-breakpoint
CREATE TABLE text_property_values (
  project_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  source_id TEXT NOT NULL REFERENCES sources(id),
  value TEXT NOT NULL,
  PRIMARY KEY (project_id, property_id),
  FOREIGN KEY (project_id, source_id) REFERENCES projects(id, source_id),
  FOREIGN KEY (property_id, source_id) REFERENCES property_definitions(id, source_id)
);
--> statement-breakpoint
CREATE TRIGGER property_type_immutable BEFORE UPDATE OF property_type ON property_definitions
WHEN NEW.property_type != OLD.property_type
BEGIN SELECT RAISE(ABORT, 'Property types are immutable'); END;
