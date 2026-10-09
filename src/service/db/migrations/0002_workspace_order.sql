ALTER TABLE `workspaces` ADD COLUMN `position` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
UPDATE `workspaces`
SET `position` = (SELECT COUNT(*) FROM `workspaces` AS previous WHERE previous.rowid < `workspaces`.rowid);
