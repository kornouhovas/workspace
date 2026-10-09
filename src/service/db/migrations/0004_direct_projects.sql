CREATE TABLE `projects` (
  `id` text PRIMARY KEY NOT NULL,
  `source_id` text NOT NULL REFERENCES `sources`(`id`),
  `relative_path` text NOT NULL,
  `native_identity` text NOT NULL,
  `association_state` text NOT NULL CHECK (`association_state` IN ('active', 'excluded', 'missing', 'unresolved', 'replaced'))
);
--> statement-breakpoint
CREATE INDEX `projects_source` ON `projects` (`source_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_current_path` ON `projects` (`source_id`, `relative_path`) WHERE `association_state` != 'replaced';
