-- Preserve the child rows before rebuilding the immutable definition table.
CREATE TEMP TABLE preserved_text_values AS SELECT * FROM text_property_values;
--> statement-breakpoint
CREATE TEMP TABLE preserved_number_values AS SELECT * FROM number_property_values;
--> statement-breakpoint
DROP TABLE number_property_values;
--> statement-breakpoint
DROP TABLE text_property_values;
--> statement-breakpoint
CREATE TABLE new_property_definitions (
  id TEXT PRIMARY KEY NOT NULL,
  source_id TEXT NOT NULL REFERENCES sources(id),
  name TEXT NOT NULL,
  property_type TEXT NOT NULL CHECK (property_type IN ('text', 'number', 'date')),
  position INTEGER NOT NULL CHECK (position >= 0),
  UNIQUE (source_id, position),
  UNIQUE (id, source_id)
);
--> statement-breakpoint
INSERT INTO new_property_definitions SELECT * FROM property_definitions;
--> statement-breakpoint
DROP TABLE property_definitions;
--> statement-breakpoint
ALTER TABLE new_property_definitions RENAME TO property_definitions;
--> statement-breakpoint
CREATE TRIGGER property_type_immutable BEFORE UPDATE OF property_type ON property_definitions
WHEN NEW.property_type != OLD.property_type
BEGIN SELECT RAISE(ABORT, 'Property types are immutable'); END;
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
INSERT INTO text_property_values SELECT * FROM preserved_text_values;
--> statement-breakpoint
DROP TABLE preserved_text_values;
--> statement-breakpoint
CREATE TABLE number_property_values (
  project_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  source_id TEXT NOT NULL REFERENCES sources(id),
  value REAL NOT NULL CHECK (typeof(value) IN ('real', 'integer') AND abs(value) <= 9007199254740991),
  PRIMARY KEY (project_id, property_id),
  FOREIGN KEY (project_id, source_id) REFERENCES projects(id, source_id),
  FOREIGN KEY (property_id, source_id) REFERENCES property_definitions(id, source_id)
);
--> statement-breakpoint
INSERT INTO number_property_values SELECT * FROM preserved_number_values;
--> statement-breakpoint
DROP TABLE preserved_number_values;
--> statement-breakpoint
CREATE TRIGGER number_value_type_insert BEFORE INSERT ON number_property_values
WHEN (SELECT property_type FROM property_definitions WHERE id = NEW.property_id) != 'number'
BEGIN SELECT RAISE(ABORT, 'Number value requires Number definition'); END;
--> statement-breakpoint
CREATE TRIGGER number_value_type_update BEFORE UPDATE ON number_property_values
WHEN (SELECT property_type FROM property_definitions WHERE id = NEW.property_id) != 'number'
BEGIN SELECT RAISE(ABORT, 'Number value requires Number definition'); END;
--> statement-breakpoint
CREATE TRIGGER text_value_type_insert BEFORE INSERT ON text_property_values
WHEN (SELECT property_type FROM property_definitions WHERE id = NEW.property_id) != 'text'
BEGIN SELECT RAISE(ABORT, 'Text value requires Text definition'); END;
--> statement-breakpoint
CREATE TRIGGER text_value_type_update BEFORE UPDATE ON text_property_values
WHEN (SELECT property_type FROM property_definitions WHERE id = NEW.property_id) != 'text'
BEGIN SELECT RAISE(ABORT, 'Text value requires Text definition'); END;

--> statement-breakpoint
CREATE TABLE date_property_values (
  project_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  source_id TEXT NOT NULL REFERENCES sources(id),
  value TEXT NOT NULL CHECK (
    length(CAST(value AS BLOB)) = 10 AND value GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
    AND CAST(substr(value, 1, 4) AS INTEGER) BETWEEN 1 AND 9999
    AND CAST(substr(value, 6, 2) AS INTEGER) BETWEEN 1 AND 12
    AND CAST(substr(value, 9, 2) AS INTEGER) BETWEEN 1 AND
      CASE CAST(substr(value, 6, 2) AS INTEGER)
        WHEN 2 THEN 28 + (CAST(substr(value, 1, 4) AS INTEGER) % 4 = 0
          AND (CAST(substr(value, 1, 4) AS INTEGER) % 100 != 0 OR CAST(substr(value, 1, 4) AS INTEGER) % 400 = 0))
        WHEN 4 THEN 30 WHEN 6 THEN 30 WHEN 9 THEN 30 WHEN 11 THEN 30 ELSE 31 END
  ),
  PRIMARY KEY (project_id, property_id),
  FOREIGN KEY (project_id, source_id) REFERENCES projects(id, source_id),
  FOREIGN KEY (property_id, source_id) REFERENCES property_definitions(id, source_id)
);
--> statement-breakpoint
CREATE TRIGGER date_value_type_insert BEFORE INSERT ON date_property_values
WHEN (SELECT property_type FROM property_definitions WHERE id = NEW.property_id) != 'date'
BEGIN SELECT RAISE(ABORT, 'Date value requires Date definition'); END;
--> statement-breakpoint
CREATE TRIGGER date_value_type_update BEFORE UPDATE ON date_property_values
WHEN (SELECT property_type FROM property_definitions WHERE id = NEW.property_id) != 'date'
BEGIN SELECT RAISE(ABORT, 'Date value requires Date definition'); END;
