import type { BoardLayoutSnapshot } from "../contracts/board-layout.js";
import type { TableLayoutSnapshot } from "../contracts/table-layout.js";
import type { ViewGroupingSnapshot } from "../contracts/view-grouping.js";
import type { ViewFilterPayload } from "../contracts/view-filters.js";
import { viewCommands, type ViewSnapshot } from "../contracts/views.js";
import { selectCommands } from "../contracts/text-properties.js";
import type { ArchivePayload } from "../contracts/project-archive.js";
import type { CategoryRemovalPayload } from "../contracts/category-removal.js";
import type { CategoryOptionsPayload } from "../contracts/category-options.js";
import type { ProjectCategoryMoveResult, ProjectCategoryMoveList, ProjectCategoryMoveRecoveryPreview } from "../contracts/project-category-move.js";
import type { ProjectRenameResult, ProjectRenameList, ProjectRenameRecoveryPreview } from "../contracts/project-rename.js";
import type { ProjectRenameNative } from "./project-rename.js";
import type { NativeProjectReveal } from "../contracts/service-protocol.js";
import type { ProjectRevealResult } from "../contracts/project-reveal.js";
import type { ObserverDependencies } from "./source-observer.js";
import type { ProjectFilesystem } from "./project-filesystem.js";
import type { ProjectCreationResult, ProjectCreationList, ProjectCreationRecoveryPreview } from "../contracts/project-creation.js";
import type { ProjectRecoveryPreview } from "../contracts/project-recovery.js";
import type { TextPropertySnapshot, TextPropertyMutation } from "../contracts/text-properties.js";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  type Language,
  type ServiceError,
  type ServiceResult,
  type Settings,
  supportedLanguages,
} from "../contracts/settings.js";
import { settings } from "./db/schema.js";
import * as schema from "./db/schema.js";
import { createWorkspaceService, type WorkspaceFilesystem, type WorkspaceService } from "./workspaces.js";
import type { CategoryPropertySnapshot, ProjectList, DiscoveryPreview, ActiveWorkspace, WorkspaceCreated, WorkspaceLoad, WorkspaceSourceObservationSnapshot, WorkspaceSourceState } from "../contracts/workspaces.js";

export interface SettingsService {
  moveProjectCategory(input: unknown): ServiceResult<ProjectCategoryMoveResult>;
  listProjectCategoryMoves(input: unknown): ServiceResult<ProjectCategoryMoveList>;
  getProjectCategoryMove(input: unknown): ServiceResult<ProjectCategoryMoveResult>;
  previewProjectCategoryMoveRecovery(input: unknown): ServiceResult<ProjectCategoryMoveRecoveryPreview>;
  recoverProjectCategoryMove(input: unknown): ServiceResult<ProjectCategoryMoveResult>;
  renameProject(input: unknown): ServiceResult<ProjectRenameResult>;
  listProjectRenames(input: unknown): ServiceResult<ProjectRenameList>;
  getProjectRename(input: unknown): ServiceResult<ProjectRenameResult>;
  previewProjectRenameRecovery(input: unknown): ServiceResult<ProjectRenameRecoveryPreview>;
  recoverProjectRename(input: unknown): ServiceResult<ProjectRenameResult>;
  revealProject(input: unknown, native?: NativeProjectReveal): Promise<ServiceResult<ProjectRevealResult>>;
  handleQuery(input: unknown): ServiceResult<BoardLayoutSnapshot | TableLayoutSnapshot | ViewGroupingSnapshot | ViewFilterPayload | ViewSnapshot | ArchivePayload | CategoryRemovalPayload | CategoryOptionsPayload | ProjectCategoryMoveResult | ProjectCategoryMoveList | ProjectCategoryMoveRecoveryPreview | ProjectRenameResult | ProjectRenameList | ProjectRenameRecoveryPreview | ProjectCreationResult | ProjectCreationList | ProjectCreationRecoveryPreview | WorkspaceSourceObservationSnapshot | ProjectRecoveryPreview | TextPropertySnapshot | Settings | WorkspaceLoad | DiscoveryPreview | ProjectList>;
  handleCommand(input: unknown): ServiceResult<BoardLayoutSnapshot | TableLayoutSnapshot | ViewGroupingSnapshot | ViewFilterPayload | ViewSnapshot | ArchivePayload | CategoryRemovalPayload | CategoryOptionsPayload | ProjectCategoryMoveResult | ProjectRenameResult | ProjectCreationResult | CategoryPropertySnapshot | TextPropertyMutation | Settings | WorkspaceCreated | ActiveWorkspace | WorkspaceLoad | WorkspaceSourceState | ProjectList>;
  workspaces: WorkspaceService;
  close(): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidInput(message: string): ServiceError {
  return { code: "invalid_input", message };
}

function storageError(): ServiceError {
  return { code: "storage", message: "Settings could not be read or saved." };
}

function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && supportedLanguages.some((language) => language === value);
}

export function openSettingsService(
  databasePath: string,
  migrationFolder = resolve(process.cwd(), "src/service/db/migrations"),
  workspaceFilesystem?: WorkspaceFilesystem,
  observerDependencies?: ObserverDependencies,
  projectFilesystem?: ProjectFilesystem,
  projectRenameNative?: ProjectRenameNative,
): SettingsService {
  mkdirSync(dirname(databasePath), { recursive: true });
  const sqlite = new Database(databasePath);
  const db = (() => {
    try {
      sqlite.pragma("journal_mode = WAL");
      sqlite.pragma("foreign_keys = ON");
      const database = drizzle(sqlite, { schema });
      migrate(database, { migrationsFolder: migrationFolder });
      const existing = database.select().from(settings).where(eq(settings.key, "language")).get();
      if (!existing) {
        database.insert(settings).values({ key: "language", value: "en" }).run();
      }
      return database;
    } catch (error) {
      sqlite.close();
      throw error;
    }
  })();

  const workspaces = createWorkspaceService(db, workspaceFilesystem, observerDependencies, projectFilesystem, projectRenameNative);
  return {
    workspaces,
    moveProjectCategory: workspaces.moveProjectCategory,
    listProjectCategoryMoves: workspaces.listProjectCategoryMoves,
    getProjectCategoryMove: workspaces.getProjectCategoryMove,
    previewProjectCategoryMoveRecovery: workspaces.previewProjectCategoryMoveRecovery,
    recoverProjectCategoryMove: workspaces.recoverProjectCategoryMove,
    renameProject: workspaces.renameProject,
    listProjectRenames: workspaces.listProjectRenames,
    getProjectRename: workspaces.getProjectRename,
    previewProjectRenameRecovery: workspaces.previewProjectRenameRecovery,
    recoverProjectRename: workspaces.recoverProjectRename,
    revealProject: workspaces.revealProject,
    handleQuery(input) {
      if (isRecord(input) && input.type === "workspace.getBoardLayout") return workspaces.boardLayoutRequest(input);
      if (isRecord(input) && input.type === "workspace.getTableLayout") return workspaces.tableLayoutRequest(input);
      if (isRecord(input) && input.type === "workspace.getViewGrouping") return workspaces.groupingRequest(input);
      if (isRecord(input) && ["workspace.getViewFilter", "workspace.queryView"].includes(String(input.type))) return workspaces.filterRequest(input);
      if (isRecord(input) && input.type === "workspace.listViews") return workspaces.viewRequest(input);
      if (isRecord(input) && input.type === "workspace.previewProjectArchive") return workspaces.previewProjectArchive(input);
      if (isRecord(input) && input.type === "workspace.listProjectArchiveOperations") return workspaces.listProjectArchiveOperations(input);
      if (isRecord(input) && input.type === "workspace.getProjectArchiveOperation") return workspaces.getProjectArchiveOperation(input);
      if (isRecord(input) && input.type === "workspace.previewProjectArchiveRecovery") return workspaces.previewProjectArchiveRecovery(input);
      if (isRecord(input) && input.type === "workspace.previewArchiveLocation") return workspaces.previewArchiveLocation(input);
      if (isRecord(input) && input.type === "workspace.listArchivedProjects") return workspaces.listArchivedProjects(input);
      if (isRecord(input) && input.type === "workspace.previewCategoryRemovalRecovery") return workspaces.previewCategoryRemovalRecovery(input);
      if (isRecord(input) && input.type === "workspace.getCategoryRemoval") return workspaces.getCategoryRemoval(input);
      if (isRecord(input) && input.type === "workspace.listCategoryRemovals") return workspaces.listCategoryRemovals(input);
      if (isRecord(input) && input.type === "workspace.previewCategoryRemoval") return workspaces.previewCategoryRemoval(input);
      if (isRecord(input) && input.type === "workspace.getCategoryFolderOperation") return workspaces.getCategoryFolderOperation(input);
      if (isRecord(input) && input.type === "workspace.previewCategoryFolder") return workspaces.previewCategoryFolder(input);
      if (isRecord(input) && input.type === "workspace.listCategoryFolderOperations") return workspaces.listCategoryFolderOperations(input);
      if (isRecord(input) && input.type === "workspace.previewCategoryFolderRecovery") return workspaces.previewCategoryFolderRecovery(input);
      if (isRecord(input) && input.type === "workspace.listCategoryPresentation") return workspaces.listCategoryPresentation(input);

      if (isRecord(input) && input.type === "workspace.previewProjectCategoryMoveRecovery") return workspaces.previewProjectCategoryMoveRecovery(input);
      if (isRecord(input) && input.type === "workspace.listProjectCategoryMoves") return workspaces.listProjectCategoryMoves(input);
      if (isRecord(input) && input.type === "workspace.getProjectCategoryMove") return workspaces.getProjectCategoryMove(input);
      if (isRecord(input) && input.type === "workspace.listProjectRenames") return workspaces.listProjectRenames(input);
      if (isRecord(input) && input.type === "workspace.getProjectRename") return workspaces.getProjectRename(input);
      if (isRecord(input) && input.type === "workspace.previewProjectRenameRecovery") return workspaces.previewProjectRenameRecovery(input);
      if (isRecord(input) && input.type === "workspace.listProjectCreations") return workspaces.listProjectCreations(input);
      if (isRecord(input) && input.type === "workspace.getProjectCreation") return workspaces.getProjectCreation(input);
      if (isRecord(input) && input.type === "workspace.previewProjectCreationRecovery") return workspaces.previewProjectCreationRecovery(input);
      if (isRecord(input) && input.type === "workspace.getSourceObservation") return workspaces.getSourceObservation(input);
      if (isRecord(input) && input.type === "workspace.previewProjectRecovery") return workspaces.previewProjectRecovery(input);
      if (isRecord(input) && input.type === "workspace.listTextProperties") return workspaces.listTextProperties(input);
      if (isRecord(input) && input.type === "workspace.listProjects") return workspaces.listProjects(input);
      if (isRecord(input) && input.type === "workspace.previewDiscovery") return workspaces.previewDiscovery(input);
      if (isRecord(input) && input.type === "workspace.load") return workspaces.load();
      if (!isRecord(input) || input.type !== "settings.load") {
        return { ok: false, error: invalidInput("Expected a settings.load query.") };
      }

      try {
        const row = db.select().from(settings).where(eq(settings.key, "language")).get();
        if (!row || !isLanguage(row.value)) return { ok: true, value: { language: "en" } };
        return { ok: true, value: { language: row.value } };
      } catch {
        return { ok: false, error: storageError() };
      }
    },

    handleCommand(input) {
      if (isRecord(input) && input.type === "workspace.assignProjectGroup") return workspaces.assignProjectGroup(input);
      if (isRecord(input) && input.type === "workspace.setBoardLayout") return workspaces.boardLayoutRequest(input);
      if (isRecord(input) && input.type === "workspace.setTableLayout") return workspaces.tableLayoutRequest(input);
      if (isRecord(input) && input.type === "workspace.setViewGrouping") return workspaces.groupingRequest(input);
      if (isRecord(input) && input.type === "workspace.setViewFilter") return workspaces.filterRequest(input);
      if (isRecord(input) && typeof input.type === "string" && viewCommands.includes(input.type)) return workspaces.viewRequest(input);
      if (isRecord(input) && input.type === "workspace.applyProjectArchive") return workspaces.applyProjectArchive(input);
      if (isRecord(input) && input.type === "workspace.recoverProjectArchive") return workspaces.recoverProjectArchive(input);
      if (isRecord(input) && input.type === "workspace.applyArchiveLocation") return workspaces.applyArchiveLocation(input);
      if (isRecord(input) && input.type === "workspace.recoverCategoryRemoval") return workspaces.recoverCategoryRemoval(input);
      if (isRecord(input) && input.type === "workspace.applyCategoryRemoval") return workspaces.applyCategoryRemoval(input);
      if (isRecord(input) && input.type === "workspace.applyCategoryFolder") return workspaces.applyCategoryFolder(input);
      if (isRecord(input) && input.type === "workspace.recoverCategoryFolder") return workspaces.recoverCategoryFolder(input);
      if (isRecord(input) && input.type === "workspace.setCategoryPresentation") return workspaces.setCategoryPresentation(input);

      if (isRecord(input) && input.type === "workspace.recoverProjectCategoryMove") return workspaces.recoverProjectCategoryMove(input);
      if (isRecord(input) && input.type === "workspace.moveProjectCategory") return workspaces.moveProjectCategory(input);
      if (isRecord(input) && input.type === "workspace.renameProject") return workspaces.renameProject(input);
      if (isRecord(input) && input.type === "workspace.recoverProjectRename") return workspaces.recoverProjectRename(input);
      if (isRecord(input) && input.type === "workspace.recoverProjectCreation") return workspaces.recoverProjectCreation(input);
      if (isRecord(input) && input.type === "workspace.createProject") return workspaces.createProject(input);
      if (isRecord(input) && input.type === "workspace.reassociateProject") return workspaces.reassociateProject(input);
      if (isRecord(input) && input.type === "workspace.renameCategoryProperty") return workspaces.renameCategoryProperty(input);
      if (isRecord(input) && typeof input.type === "string" && selectCommands.includes(input.type)) return workspaces.selectCommand(input);
      if (isRecord(input) && input.type === "workspace.createProperty") return workspaces.createProperty(input);
      if (isRecord(input) && input.type === "workspace.setDateValue") return workspaces.setDateValue(input);
      if (isRecord(input) && input.type === "workspace.setNumberValue") return workspaces.setNumberValue(input);
      if (isRecord(input) && input.type === "workspace.setTextValue") return workspaces.setTextValue(input);
      if (isRecord(input) && input.type === "workspace.renameProperty") return workspaces.renameProperty(input);
      if (isRecord(input) && input.type === "workspace.applyDiscovery") return workspaces.applyDiscovery(input);
      if (isRecord(input) && input.type === "workspace.create") return workspaces.create(input);
      if (isRecord(input) && input.type === "workspace.activate") return workspaces.activate(input);
      if (isRecord(input) && input.type === "workspace.rename") return workspaces.rename(input);
      if (isRecord(input) && input.type === "workspace.reorder") return workspaces.reorder(input);
      if (isRecord(input) && input.type === "workspace.refreshSource") return workspaces.refreshSource(input);
      if (isRecord(input) && input.type === "workspace.remove") return workspaces.remove(input);
      if (!isRecord(input) || input.type !== "settings.setLanguage" || !isLanguage(input.language)) {
        return { ok: false, error: invalidInput("Expected a supported language: en or ru.") };
      }

      try {
        db.insert(settings)
          .values({ key: "language", value: input.language })
          .onConflictDoUpdate({ target: settings.key, set: { value: input.language } })
          .run();
        return { ok: true, value: { language: input.language } };
      } catch {
        return { ok: false, error: storageError() };
      }
    },

    close() {
      workspaces.close();
      sqlite.close();
    },
  };
}
