CREATE TABLE `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`canonical_root` text NOT NULL UNIQUE
);
--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`source_id` text NOT NULL REFERENCES `sources`(`id`)
);
--> statement-breakpoint
CREATE TABLE `views` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL REFERENCES `workspaces`(`id`),
	`name` text NOT NULL,
	`kind` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `active_workspace` (
	`key` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL REFERENCES `workspaces`(`id`),
	`view_id` text NOT NULL REFERENCES `views`(`id`)
);
