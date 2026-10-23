ALTER TABLE sources ADD COLUMN durable_evidence TEXT;
--> statement-breakpoint
ALTER TABLE sources ADD COLUMN evidence_generation INTEGER NOT NULL DEFAULT 0 CHECK(evidence_generation >= 0);
--> statement-breakpoint
ALTER TABLE categories ADD COLUMN durable_evidence TEXT;
--> statement-breakpoint
ALTER TABLE projects ADD COLUMN durable_evidence TEXT;
