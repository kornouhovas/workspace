ALTER TABLE projects ADD COLUMN mode_inactive INTEGER NOT NULL DEFAULT 0 CHECK (mode_inactive IN (0, 1));
--> statement-breakpoint
ALTER TABLE categories ADD COLUMN mode_inactive INTEGER NOT NULL DEFAULT 0 CHECK (mode_inactive IN (0, 1));
--> statement-breakpoint
DROP TRIGGER grouped_project_insert;
--> statement-breakpoint
DROP TRIGGER grouped_project_update;
--> statement-breakpoint
DROP TRIGGER category_insert;
--> statement-breakpoint
DROP TRIGGER category_update;
--> statement-breakpoint
DROP TRIGGER discovery_mode_update;
--> statement-breakpoint
CREATE TRIGGER grouped_project_insert BEFORE INSERT ON projects
WHEN (NEW.category_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM categories c WHERE c.id = NEW.category_id AND c.source_id = NEW.source_id))
OR (NEW.mode_inactive = 0 AND (
  ((SELECT discovery_mode FROM sources WHERE id = NEW.source_id) IS NOT 'grouped' AND (NEW.category_id IS NOT NULL OR instr(NEW.relative_path, '/') != 0))
  OR ((SELECT discovery_mode FROM sources WHERE id = NEW.source_id) = 'grouped' AND NOT EXISTS (
    SELECT 1 FROM categories c WHERE c.id = NEW.category_id AND c.source_id = NEW.source_id
    AND (NEW.association_state != 'active' OR (c.association_state = 'active' AND c.mode_inactive = 0
    AND substr(NEW.relative_path, 1, length(c.relative_path) + 1) = c.relative_path || '/'
    AND length(NEW.relative_path) > length(c.relative_path) + 1
    AND instr(substr(NEW.relative_path, length(c.relative_path) + 2), '/') = 0))
  ))
))
BEGIN SELECT RAISE(ABORT, 'Operational projects require their source interpretation'); END;
--> statement-breakpoint
CREATE TRIGGER grouped_project_update BEFORE UPDATE ON projects
WHEN (NEW.category_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM categories c WHERE c.id = NEW.category_id AND c.source_id = NEW.source_id))
OR (NEW.mode_inactive = 0 AND (
  ((SELECT discovery_mode FROM sources WHERE id = NEW.source_id) IS NOT 'grouped' AND (NEW.category_id IS NOT NULL OR instr(NEW.relative_path, '/') != 0))
  OR ((SELECT discovery_mode FROM sources WHERE id = NEW.source_id) = 'grouped' AND NOT EXISTS (
    SELECT 1 FROM categories c WHERE c.id = NEW.category_id AND c.source_id = NEW.source_id
    AND (NEW.association_state != 'active' OR (c.association_state = 'active' AND c.mode_inactive = 0
    AND substr(NEW.relative_path, 1, length(c.relative_path) + 1) = c.relative_path || '/'
    AND length(NEW.relative_path) > length(c.relative_path) + 1
    AND instr(substr(NEW.relative_path, length(c.relative_path) + 2), '/') = 0))
  ))
))
BEGIN SELECT RAISE(ABORT, 'Operational projects require their source interpretation'); END;
--> statement-breakpoint
CREATE TRIGGER category_insert BEFORE INSERT ON categories
WHEN instr(NEW.relative_path, '/') != 0 OR (NEW.mode_inactive = 0 AND (SELECT discovery_mode FROM sources WHERE id = NEW.source_id) IS NOT 'grouped')
BEGIN SELECT RAISE(ABORT, 'Operational categories require a grouped source'); END;
--> statement-breakpoint
CREATE TRIGGER category_update BEFORE UPDATE ON categories
WHEN instr(NEW.relative_path, '/') != 0
OR (NEW.mode_inactive = 0 AND (SELECT discovery_mode FROM sources WHERE id = NEW.source_id) IS NOT 'grouped')
OR EXISTS (SELECT 1 FROM projects p WHERE p.category_id = OLD.id
  AND (NEW.source_id != p.source_id OR NEW.id != OLD.id
    OR (p.mode_inactive = 0 AND p.association_state = 'active' AND
      (NEW.mode_inactive != 0 OR NEW.association_state != 'active' OR NEW.relative_path != OLD.relative_path))))
BEGIN SELECT RAISE(ABORT, 'Operational grouped projects require their active category'); END;
--> statement-breakpoint
CREATE TRIGGER discovery_mode_update BEFORE UPDATE OF discovery_mode ON sources
WHEN (NEW.discovery_mode IS NOT NULL AND NEW.discovery_mode NOT IN ('direct', 'grouped'))
OR (OLD.discovery_mode IS NOT NULL AND NEW.discovery_mode IS NULL)
OR (NEW.discovery_mode = 'direct' AND (
  EXISTS (SELECT 1 FROM categories WHERE source_id = NEW.id AND mode_inactive = 0)
  OR EXISTS (SELECT 1 FROM projects WHERE source_id = NEW.id AND mode_inactive = 0 AND (category_id IS NOT NULL OR instr(relative_path, '/') != 0))))
OR (NEW.discovery_mode = 'grouped' AND EXISTS (SELECT 1 FROM projects p WHERE p.source_id = NEW.id AND p.mode_inactive = 0 AND NOT EXISTS (
  SELECT 1 FROM categories c WHERE c.id = p.category_id AND c.source_id = p.source_id
  AND (p.association_state != 'active' OR (c.association_state = 'active' AND c.mode_inactive = 0
  AND substr(p.relative_path, 1, length(c.relative_path) + 1) = c.relative_path || '/'
  AND length(p.relative_path) > length(c.relative_path) + 1
  AND instr(substr(p.relative_path, length(c.relative_path) + 2), '/') = 0))
)))
BEGIN SELECT RAISE(ABORT, 'Retire incompatible associations before changing discovery mode'); END;
