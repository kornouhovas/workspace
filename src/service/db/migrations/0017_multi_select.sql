-- Preserve every existing option, assignment and workspace presentation before rebuilding definitions.
CREATE TEMP TABLE preserved_select_visibility AS SELECT * FROM select_option_visibility;
--> statement-breakpoint
CREATE TEMP TABLE preserved_select_values AS SELECT * FROM select_property_values;
--> statement-breakpoint
CREATE TEMP TABLE preserved_select_options AS SELECT * FROM select_options;
--> statement-breakpoint
DROP TABLE select_option_visibility;
--> statement-breakpoint
DROP TABLE select_property_values;
--> statement-breakpoint
DROP TABLE select_options;
--> statement-breakpoint
-- Expand definitions without losing existing typed values.
CREATE TEMP TABLE preserved_date_values AS SELECT * FROM date_property_values;
--> statement-breakpoint
DROP TABLE date_property_values;
--> statement-breakpoint
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
  property_type TEXT NOT NULL CHECK (property_type IN ('text', 'number', 'date', 'single_select', 'multi_select')),
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
INSERT INTO date_property_values SELECT * FROM preserved_date_values;
--> statement-breakpoint
DROP TABLE preserved_date_values;
--> statement-breakpoint
CREATE TRIGGER date_value_type_insert BEFORE INSERT ON date_property_values
WHEN (SELECT property_type FROM property_definitions WHERE id = NEW.property_id) != 'date'
BEGIN SELECT RAISE(ABORT, 'Date value requires Date definition'); END;
--> statement-breakpoint
CREATE TRIGGER date_value_type_update BEFORE UPDATE ON date_property_values
WHEN (SELECT property_type FROM property_definitions WHERE id = NEW.property_id) != 'date'
BEGIN SELECT RAISE(ABORT, 'Date value requires Date definition'); END;

--> statement-breakpoint
CREATE TABLE select_options (
  id TEXT PRIMARY KEY NOT NULL, source_id TEXT NOT NULL REFERENCES sources(id),
  property_id TEXT NOT NULL, name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  color TEXT NOT NULL CHECK (color IN ('default','gray','red','orange','yellow','green','blue','purple')),
  position INTEGER NOT NULL CHECK (position >= 0), UNIQUE(id, property_id, source_id),
  FOREIGN KEY(property_id, source_id) REFERENCES property_definitions(id, source_id)
);
--> statement-breakpoint
CREATE TRIGGER select_option_type_insert BEFORE INSERT ON select_options
WHEN (SELECT property_type FROM property_definitions WHERE id = NEW.property_id) NOT IN ('single_select', 'multi_select')
BEGIN SELECT RAISE(ABORT, 'Select option requires Single Select or MultiSelect definition'); END;
--> statement-breakpoint
CREATE TRIGGER select_option_type_update BEFORE UPDATE ON select_options
WHEN NEW.id != OLD.id OR NEW.property_id != OLD.property_id OR NEW.source_id != OLD.source_id
BEGIN SELECT RAISE(ABORT, 'Select option identity is immutable'); END;
--> statement-breakpoint
CREATE TABLE select_property_values (
  project_id TEXT NOT NULL, property_id TEXT NOT NULL, source_id TEXT NOT NULL REFERENCES sources(id), option_id TEXT NOT NULL,
  PRIMARY KEY(project_id, property_id),
  FOREIGN KEY(project_id, source_id) REFERENCES projects(id, source_id),
  FOREIGN KEY(option_id, property_id, source_id) REFERENCES select_options(id, property_id, source_id)
);
--> statement-breakpoint
CREATE TABLE select_option_visibility (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  option_id TEXT NOT NULL REFERENCES select_options(id), hidden INTEGER NOT NULL CHECK(hidden IN (0,1)),
  PRIMARY KEY(workspace_id, option_id)
);
--> statement-breakpoint
CREATE TRIGGER select_visibility_owner_insert BEFORE INSERT ON select_option_visibility
WHEN (SELECT source_id FROM workspaces WHERE id = NEW.workspace_id) != (SELECT source_id FROM select_options WHERE id = NEW.option_id)
BEGIN SELECT RAISE(ABORT, 'Select visibility requires matching workspace source'); END;
--> statement-breakpoint
CREATE TRIGGER select_visibility_owner_update BEFORE UPDATE ON select_option_visibility
WHEN (SELECT source_id FROM workspaces WHERE id = NEW.workspace_id) != (SELECT source_id FROM select_options WHERE id = NEW.option_id)
BEGIN SELECT RAISE(ABORT, 'Select visibility requires matching workspace source'); END;

--> statement-breakpoint
INSERT INTO select_options SELECT * FROM preserved_select_options;
--> statement-breakpoint
INSERT INTO select_property_values SELECT * FROM preserved_select_values;
--> statement-breakpoint
INSERT INTO select_option_visibility SELECT * FROM preserved_select_visibility;
--> statement-breakpoint
DROP TABLE preserved_select_options;
--> statement-breakpoint
DROP TABLE preserved_select_values;
--> statement-breakpoint
DROP TABLE preserved_select_visibility;
--> statement-breakpoint
CREATE TABLE multi_select_property_values (
  project_id TEXT NOT NULL, property_id TEXT NOT NULL, source_id TEXT NOT NULL REFERENCES sources(id), option_id TEXT NOT NULL,
  PRIMARY KEY(project_id, property_id, option_id),
  FOREIGN KEY(project_id, source_id) REFERENCES projects(id, source_id),
  FOREIGN KEY(option_id, property_id, source_id) REFERENCES select_options(id, property_id, source_id)
);
--> statement-breakpoint
CREATE TRIGGER select_property_values_type_insert BEFORE INSERT ON select_property_values
WHEN (SELECT property_type FROM property_definitions WHERE id = NEW.property_id) != 'single_select'
BEGIN SELECT RAISE(ABORT, 'Single Select value requires Single Select definition'); END;
--> statement-breakpoint
CREATE TRIGGER select_property_values_type_update BEFORE UPDATE ON select_property_values
WHEN (SELECT property_type FROM property_definitions WHERE id = NEW.property_id) != 'single_select'
BEGIN SELECT RAISE(ABORT, 'Single Select value requires Single Select definition'); END;
--> statement-breakpoint
CREATE TRIGGER multi_select_property_values_type_insert BEFORE INSERT ON multi_select_property_values
WHEN (SELECT property_type FROM property_definitions WHERE id = NEW.property_id) != 'multi_select'
BEGIN SELECT RAISE(ABORT, 'MultiSelect value requires MultiSelect definition'); END;
--> statement-breakpoint
CREATE TRIGGER multi_select_property_values_type_update BEFORE UPDATE ON multi_select_property_values
WHEN (SELECT property_type FROM property_definitions WHERE id = NEW.property_id) != 'multi_select'
BEGIN SELECT RAISE(ABORT, 'MultiSelect value requires MultiSelect definition'); END;
