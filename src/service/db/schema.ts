import type { ProjectCategoryMoveProblem, ProjectCategoryMoveStage, ProjectCategoryMovePlacement } from "../../contracts/project-category-move.js";
import { sql } from "drizzle-orm";
import type { ProjectRenameProblem, ProjectRenameStage, ProjectRenamePlacement } from "../../contracts/project-rename.js";
import type { ProjectCreationProblem, ProjectCreationStage } from "../../contracts/project-creation.js";
import { integer, text, sqliteTable, primaryKey, unique, foreignKey, index, uniqueIndex } from "drizzle-orm/sqlite-core";

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
  modeInactive: integer("mode_inactive", { mode: "boolean" }).notNull().default(false),
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
  modeInactive: integer("mode_inactive", { mode: "boolean" }).notNull().default(false),
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

// SQL migration 0008 additionally guards immutable bindings and stage transitions.
// The initiating workspace is historical context, deliberately not a foreign key.
export const projectCreationOperations = sqliteTable("project_creation_operations", {
  operationId: text("operation_id").primaryKey(),
  sourceId: text("source_id").notNull().references(() => sources.id),
  initiatingWorkspaceId: text("initiating_workspace_id").notNull(),
  projectId: text("project_id").notNull().unique(),
  name: text("name").notNull(),
  mode: text("mode", { enum: ["direct", "grouped"] }).notNull(),
  expectedRevision: integer("expected_revision").notNull(),
  categoryId: text("category_id"),
  canonicalRoot: text("canonical_root").notNull(),
  parentRelativePath: text("parent_relative_path").notNull(),
  relativePath: text("relative_path").notNull(),
  rootIdentity: text("root_identity").notNull(),
  parentIdentity: text("parent_identity").notNull(),
  excludedRelativePaths: text("excluded_relative_paths").notNull(),
  archiveRelativePath: text("archive_relative_path"),
  stage: text("stage").$type<ProjectCreationStage>().notNull(),
  nativeIdentity: text("native_identity"),
  problem: text("problem").$type<ProjectCreationProblem>(),
  completedRevision: integer("completed_revision"),
}, (table) => [
  index("project_creation_source").on(table.sourceId),
  uniqueIndex("project_creation_outstanding_path").on(table.sourceId, table.relativePath)
    .where(sql`${table.stage} IN ('intent', 'evidence_recorded', 'uncertain')`),
  foreignKey({ columns: [table.categoryId, table.sourceId], foreignColumns: [categories.id, categories.sourceId] }),
]);

// Migration 0009 enforces immutable bindings, evidence, transitions and cross-role reservations.
// Historical initiating workspace IDs deliberately survive workspace removal.
export const projectRenameOperations = sqliteTable("project_rename_operations", {
  operationId: text("operation_id").primaryKey(),
  sourceId: text("source_id").notNull().references(() => sources.id),
  initiatingWorkspaceId: text("initiating_workspace_id").notNull(),
  projectId: text("project_id").notNull(),
  originalName: text("original_name").notNull(),
  name: text("name").notNull(),
  mode: text("mode", { enum: ["direct", "grouped"] }).notNull(),
  expectedRevision: integer("expected_revision").notNull(),
  categoryId: text("category_id"),
  canonicalRoot: text("canonical_root").notNull(),
  parentRelativePath: text("parent_relative_path").notNull(),
  originalRelativePath: text("original_relative_path").notNull(),
  requestedRelativePath: text("requested_relative_path").notNull(),
  stagingRelativePath: text("staging_relative_path"),
  rootIdentity: text("root_identity").notNull(),
  parentIdentity: text("parent_identity").notNull(),
  nativeIdentity: text("native_identity").notNull(),
  excludedRelativePaths: text("excluded_relative_paths").notNull(),
  archiveRelativePath: text("archive_relative_path"),
  stage: text("stage").$type<ProjectRenameStage>().notNull(),
  stagedIdentity: text("staged_identity"),
  destinationIdentity: text("destination_identity"),
  lastVerifiedPlacement: text("last_verified_placement").$type<ProjectRenamePlacement>().notNull(),
  lastVerifiedIdentity: text("last_verified_identity").notNull(),
  problem: text("problem").$type<ProjectRenameProblem>(),
  resultKind: text("result_kind", { enum: ["completed", "unchanged", "rejected"] }),
  completedRevision: integer("completed_revision"),
}, (table) => [
  index("project_rename_source").on(table.sourceId),
  uniqueIndex("project_rename_outstanding_project").on(table.projectId)
    .where(sql`${table.stage} IN ('intent', 'staged', 'destination_recorded', 'uncertain')`),
  foreignKey({ columns: [table.projectId, table.sourceId], foreignColumns: [projects.id, projects.sourceId] }),
  foreignKey({ columns: [table.categoryId, table.sourceId], foreignColumns: [categories.id, categories.sourceId] }),
]);

// Migration 0010 guards immutable two-parent bindings, evidence and retained history.
export const projectCategoryMoveOperations = sqliteTable("project_category_move_operations", {
  operationId: text("operation_id").primaryKey(),
  sourceId: text("source_id").notNull().references(() => sources.id),
  initiatingWorkspaceId: text("initiating_workspace_id").notNull(),
  projectId: text("project_id").notNull(),
  name: text("name").notNull(),
  expectedRevision: integer("expected_revision").notNull(),
  originalCategoryId: text("original_category_id").notNull(),
  destinationCategoryId: text("destination_category_id").notNull(),
  canonicalRoot: text("canonical_root").notNull(),
  originalParentRelativePath: text("original_parent_relative_path").notNull(),
  destinationParentRelativePath: text("destination_parent_relative_path").notNull(),
  originalRelativePath: text("original_relative_path").notNull(),
  requestedRelativePath: text("requested_relative_path").notNull(),
  rootIdentity: text("root_identity").notNull(),
  originalParentIdentity: text("original_parent_identity").notNull(),
  destinationParentIdentity: text("destination_parent_identity").notNull(),
  nativeIdentity: text("native_identity").notNull(),
  excludedRelativePaths: text("excluded_relative_paths").notNull(),
  archiveRelativePath: text("archive_relative_path"),
  stage: text("stage").$type<ProjectCategoryMoveStage>().notNull(),
  destinationIdentity: text("destination_identity"),
  lastVerifiedPlacement: text("last_verified_placement").$type<ProjectCategoryMovePlacement>().notNull(),
  lastVerifiedIdentity: text("last_verified_identity").notNull(),
  problem: text("problem").$type<ProjectCategoryMoveProblem>(),
  resultKind: text("result_kind", { enum: ["completed", "unchanged", "rejected"] }),
  completedRevision: integer("completed_revision"),
}, (table) => [
  index("project_category_move_source").on(table.sourceId),
  uniqueIndex("project_category_move_outstanding_project").on(table.projectId)
    .where(sql`${table.stage} IN ('intent', 'destination_recorded', 'uncertain')`),
  foreignKey({ columns: [table.projectId, table.sourceId], foreignColumns: [projects.id, projects.sourceId] }),
  foreignKey({ columns: [table.originalCategoryId, table.sourceId], foreignColumns: [categories.id, categories.sourceId] }),
  foreignKey({ columns: [table.destinationCategoryId, table.sourceId], foreignColumns: [categories.id, categories.sourceId] }),
]);

export const categoryFolderOperations = sqliteTable("category_folder_operations", {
  operationId: text("operation_id").primaryKey(), sourceId: text("source_id").notNull().references(() => sources.id),
  workspaceId: text("workspace_id").notNull(), previewToken: text("preview_token").notNull(), categoryId: text("category_id").notNull(),
  action: text("action", { enum: ["create", "associate", "rename"] }).notNull(),
  originalRelativePath: text("original_relative_path"), requestedRelativePath: text("requested_relative_path").notNull(),
  binding: text("binding").notNull(), nativeIdentity: text("native_identity"),
  stage: text("stage", { enum: ["intent", "destination_recorded", "completed", "failed"] }).notNull(),
  problem: text("problem"), completedRevision: integer("completed_revision"),
});
export const categoryPresentation = sqliteTable("category_presentation", {
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  categoryId: text("category_id").notNull().references(() => categories.id),
  color: text("color").$type<import("../../contracts/category-options.js").CategoryPresentation["color"]>().notNull(),
  hidden: integer("hidden", { mode: "boolean" }).notNull(), position: integer("position").notNull(),
}, table => [primaryKey({ columns: [table.workspaceId, table.categoryId] })]);

// Migration 0012 retains immutable batch bindings and append-only move attempts.
export const categoryRemovalOperations = sqliteTable("category_removal_operations", {
  operationId: text("operation_id").primaryKey(), sourceId: text("source_id").notNull().references(() => sources.id),
  workspaceId: text("workspace_id").notNull(), categoryId: text("category_id").notNull(), destinationCategoryId: text("destination_category_id"),
  originalRelativePath: text("original_relative_path").notNull(), requestedRelativePath: text("requested_relative_path"),
  nativeIdentity: text("native_identity").notNull(), previewToken: text("preview_token").notNull(), binding: text("binding").notNull(),
  stage: text("stage", { enum: ["moving", "cleanup_intent", "completed", "abandoned"] }).notNull(),
  problem: text("problem"), completedRevision: integer("completed_revision"),
});
export const categoryRemovalAttempts = sqliteTable("category_removal_attempts", {
  moveId: text("move_id").primaryKey(), removalId: text("removal_id").notNull().references(() => categoryRemovalOperations.operationId),
  projectId: text("project_id").notNull().references(() => projects.id), workspaceId: text("workspace_id").notNull(),
  expectedRevision: integer("expected_revision").notNull(), sequence: integer("sequence").notNull(), problem: text("problem"),
}, table => [unique().on(table.removalId, table.projectId, table.sequence)]);

// Archive keeps the active-model locator as historical evidence. The physical
// archive locator is separate, and the project is mode-inactive until restore.
export const projectArchives = sqliteTable("project_archives", {
  projectId: text("project_id").primaryKey().references(() => projects.id),
  sourceId: text("source_id").notNull().references(() => sources.id),
  relativePath: text("relative_path").notNull(),
  originalRelativePath: text("original_relative_path").notNull(),
  mode: text("mode", { enum: ["direct", "grouped"] }).notNull(),
  categoryName: text("category_name"),
  parentIdentity: text("parent_identity").notNull(),
  parents: text("parents").notNull(),
});
export const projectArchiveOperations = sqliteTable("project_archive_operations", {
  operationId: text("operation_id").primaryKey(),
  sourceId: text("source_id").notNull().references(() => sources.id),
  workspaceId: text("workspace_id").notNull(),
  projectId: text("project_id").notNull().references(() => projects.id),
  action: text("action", { enum: ["archive", "restore"] }).notNull(),
  originalRelativePath: text("original_relative_path").notNull(),
  requestedRelativePath: text("requested_relative_path").notNull(),
  nativeIdentity: text("native_identity").notNull(),
  binding: text("binding").notNull(),
  previewToken: text("preview_token").notNull(),
  parents: text("parents").notNull(),
  stage: text("stage", { enum: ["intent", "destination_recorded", "completed", "failed"] }).notNull(),
  problem: text("problem"),
  completedRevision: integer("completed_revision"),
});
