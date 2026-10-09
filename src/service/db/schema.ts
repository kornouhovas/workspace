import { integer, text, sqliteTable, primaryKey, unique, foreignKey } from "drizzle-orm/sqlite-core";

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const sources = sqliteTable("sources", {
  id: text("id").primaryKey(),
  canonicalRoot: text("canonical_root").notNull().unique(),
  discoveryMode: text("discovery_mode"),
  categoryPropertyRevision: integer("category_property_revision").notNull().default(0),
  propertyRevision: integer("property_revision").notNull().default(0),
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

export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  sourceId: text("source_id").notNull().references(() => sources.id),
  relativePath: text("relative_path").notNull(),
  nativeIdentity: text("native_identity").notNull(),
  associationState: text("association_state", { enum: ["active", "excluded", "missing", "unresolved", "replaced"] }).notNull(),
}, (table) => [unique("categories_id_source").on(table.id, table.sourceId)]);

export const categoryProperties = sqliteTable("category_properties", {
  id: text("id").primaryKey(),
  sourceId: text("source_id").notNull().unique().references(() => sources.id),
  name: text("name"),
});

export const projects = sqliteTable("projects", {
  categoryId: text("category_id").references(() => categories.id),
  id: text("id").primaryKey(),
  sourceId: text("source_id").notNull().references(() => sources.id),
  relativePath: text("relative_path").notNull(),
  nativeIdentity: text("native_identity").notNull(),
  associationState: text("association_state", { enum: ["active", "excluded", "missing", "unresolved", "replaced"] }).notNull(),
}, (table) => [unique("projects_id_source").on(table.id, table.sourceId)]);

export const propertyDefinitions = sqliteTable("property_definitions", {
  id: text("id").primaryKey(),
  sourceId: text("source_id").notNull().references(() => sources.id),
  name: text("name").notNull(),
  propertyType: text("property_type", { enum: ["text"] }).notNull(),
  position: integer("position").notNull(),
}, (table) => [unique().on(table.sourceId, table.position), unique().on(table.id, table.sourceId)]);

export const textPropertyValues = sqliteTable("text_property_values", {
  projectId: text("project_id").notNull(),
  propertyId: text("property_id").notNull(),
  sourceId: text("source_id").notNull().references(() => sources.id),
  value: text("value").notNull(),
}, (table) => [
  primaryKey({ columns: [table.projectId, table.propertyId] }),
  foreignKey({ columns: [table.projectId, table.sourceId], foreignColumns: [projects.id, projects.sourceId] }),
  foreignKey({ columns: [table.propertyId, table.sourceId], foreignColumns: [propertyDefinitions.id, propertyDefinitions.sourceId] }),
]);
