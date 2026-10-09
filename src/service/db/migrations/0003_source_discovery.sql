ALTER TABLE sources ADD COLUMN discovery_mode TEXT;
--> statement-breakpoint
ALTER TABLE sources ADD COLUMN discovery_revision INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE sources ADD COLUMN excluded_relative_paths TEXT NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE sources ADD COLUMN archive_relative_path TEXT;
--> statement-breakpoint
ALTER TABLE sources ADD COLUMN applied_root_identity TEXT;
