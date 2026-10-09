ALTER TABLE sources ADD COLUMN category_property_revision INTEGER NOT NULL DEFAULT 0 CHECK (category_property_revision >= 0);
--> statement-breakpoint
CREATE TABLE categories (
  id TEXT PRIMARY KEY NOT NULL,
  source_id TEXT NOT NULL REFERENCES sources(id),
  relative_path TEXT NOT NULL,
  native_identity TEXT NOT NULL,
  association_state TEXT NOT NULL CHECK (association_state IN ('active', 'excluded', 'missing', 'unresolved', 'replaced')),
  UNIQUE (id, source_id)
);
--> statement-breakpoint
CREATE INDEX categories_source ON categories (source_id);
--> statement-breakpoint
CREATE UNIQUE INDEX categories_current_path ON categories (source_id, relative_path) WHERE association_state != 'replaced';
--> statement-breakpoint
CREATE TABLE category_properties (
  id TEXT PRIMARY KEY NOT NULL,
  source_id TEXT NOT NULL UNIQUE REFERENCES sources(id),
  name TEXT
);
--> statement-breakpoint
ALTER TABLE projects ADD COLUMN category_id TEXT REFERENCES categories(id);
--> statement-breakpoint
CREATE TRIGGER grouped_project_insert BEFORE INSERT ON projects
WHEN (NEW.category_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM categories c JOIN sources s ON s.id = c.source_id
  WHERE c.id = NEW.category_id AND c.source_id = NEW.source_id AND s.discovery_mode = 'grouped'
)) OR (NEW.association_state = 'active' AND (
  ((SELECT discovery_mode FROM sources WHERE id = NEW.source_id) = 'grouped' AND NOT EXISTS (
    SELECT 1 FROM categories c WHERE c.id = NEW.category_id AND c.source_id = NEW.source_id
    AND c.association_state = 'active' AND substr(NEW.relative_path, 1, length(c.relative_path) + 1) = c.relative_path || '/'
    AND length(NEW.relative_path) > length(c.relative_path) + 1
    AND instr(substr(NEW.relative_path, length(c.relative_path) + 2), '/') = 0
  )) OR ((SELECT discovery_mode FROM sources WHERE id = NEW.source_id) IS NOT 'grouped' AND NEW.category_id IS NOT NULL)
))
BEGIN SELECT RAISE(ABORT, 'Projects require a category in their grouped source'); END;
--> statement-breakpoint
CREATE TRIGGER grouped_project_update BEFORE UPDATE ON projects
WHEN (NEW.category_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM categories c JOIN sources s ON s.id = c.source_id
  WHERE c.id = NEW.category_id AND c.source_id = NEW.source_id AND s.discovery_mode = 'grouped'
)) OR (NEW.association_state = 'active' AND (
  ((SELECT discovery_mode FROM sources WHERE id = NEW.source_id) = 'grouped' AND NOT EXISTS (
    SELECT 1 FROM categories c WHERE c.id = NEW.category_id AND c.source_id = NEW.source_id
    AND c.association_state = 'active' AND substr(NEW.relative_path, 1, length(c.relative_path) + 1) = c.relative_path || '/'
    AND length(NEW.relative_path) > length(c.relative_path) + 1
    AND instr(substr(NEW.relative_path, length(c.relative_path) + 2), '/') = 0
  )) OR ((SELECT discovery_mode FROM sources WHERE id = NEW.source_id) IS NOT 'grouped' AND NEW.category_id IS NOT NULL)
))
BEGIN SELECT RAISE(ABORT, 'Projects require a category in their grouped source'); END;
--> statement-breakpoint
CREATE TRIGGER category_insert BEFORE INSERT ON categories
WHEN (SELECT discovery_mode FROM sources WHERE id = NEW.source_id) IS NOT 'grouped'
BEGIN SELECT RAISE(ABORT, 'Categories require a grouped source'); END;
--> statement-breakpoint
CREATE TRIGGER category_update BEFORE UPDATE ON categories
WHEN (SELECT discovery_mode FROM sources WHERE id = NEW.source_id) IS NOT 'grouped' OR EXISTS (
  SELECT 1 FROM projects p WHERE p.category_id = OLD.id
  AND (NEW.source_id != p.source_id OR NEW.id != OLD.id
    OR (p.association_state = 'active' AND (NEW.association_state != 'active' OR NEW.relative_path != OLD.relative_path)))
)
BEGIN SELECT RAISE(ABORT, 'Active grouped projects require their active category'); END;
--> statement-breakpoint
CREATE TRIGGER category_property_insert BEFORE INSERT ON category_properties
WHEN (SELECT discovery_mode FROM sources WHERE id = NEW.source_id) IS NOT 'grouped'
BEGIN SELECT RAISE(ABORT, 'Category properties require a grouped source'); END;
--> statement-breakpoint
CREATE TRIGGER category_property_ownership BEFORE UPDATE OF id, source_id ON category_properties
WHEN NEW.id != OLD.id OR NEW.source_id != OLD.source_id
BEGIN SELECT RAISE(ABORT, 'Category property identity is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER discovery_mode_update BEFORE UPDATE OF discovery_mode ON sources
WHEN (NEW.discovery_mode IS NOT NULL AND NEW.discovery_mode NOT IN ('direct', 'grouped'))
OR (OLD.discovery_mode IS NOT NULL AND NEW.discovery_mode IS NOT OLD.discovery_mode)
OR (NEW.discovery_mode = 'grouped' AND EXISTS (SELECT 1 FROM projects WHERE source_id = NEW.id AND association_state = 'active' AND category_id IS NULL))
BEGIN SELECT RAISE(ABORT, 'Configured discovery mode cannot be changed'); END;
