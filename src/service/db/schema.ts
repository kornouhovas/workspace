import { integer, text, sqliteTable } from "drizzle-orm/sqlite-core";

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const sources = sqliteTable("sources", {
  id: text("id").primaryKey(),
  canonicalRoot: text("canonical_root").notNull().unique(),
  discoveryMode: text("discovery_mode"),
  discoveryRevision: integer("discovery_revision").notNull().default(0),
  excludedRelativePaths: text("excluded_relative_paths").notNull().default("[]"),
  archiveRelativePath: text("archive_relative_path"),
  appliedRootIdentity: text("applied_root_identity"),
});

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  position: integer("position").notNull(),
  sourceId: text("source_id").notNull().references(() => sources.id),
});

export const views = sqliteTable("views", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
});

export const activeWorkspace = sqliteTable("active_workspace", {
  key: text("key").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id),
  viewId: text("view_id").notNull().references(() => views.id),
});

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  sourceId: text("source_id").notNull().references(() => sources.id),
  relativePath: text("relative_path").notNull(),
  nativeIdentity: text("native_identity").notNull(),
  associationState: text("association_state", { enum: ["active", "excluded", "missing", "unresolved", "replaced"] }).notNull(),
});
