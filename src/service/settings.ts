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
  handleQuery(input: unknown): ServiceResult<ProjectCreationResult | ProjectCreationList | ProjectCreationRecoveryPreview | WorkspaceSourceObservationSnapshot | ProjectRecoveryPreview | TextPropertySnapshot | Settings | WorkspaceLoad | DiscoveryPreview | ProjectList>;
  handleCommand(input: unknown): ServiceResult<ProjectCreationResult | CategoryPropertySnapshot | TextPropertyMutation | Settings | WorkspaceCreated | ActiveWorkspace | WorkspaceLoad | WorkspaceSourceState | ProjectList>;
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

  const workspaces = createWorkspaceService(db, workspaceFilesystem, observerDependencies, projectFilesystem);
  return {
    workspaces,
    handleQuery(input) {
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
      if (isRecord(input) && input.type === "workspace.recoverProjectCreation") return workspaces.recoverProjectCreation(input);
      if (isRecord(input) && input.type === "workspace.createProject") return workspaces.createProject(input);
      if (isRecord(input) && input.type === "workspace.reassociateProject") return workspaces.reassociateProject(input);
      if (isRecord(input) && input.type === "workspace.renameCategoryProperty") return workspaces.renameCategoryProperty(input);
      if (isRecord(input) && input.type === "workspace.createProperty") return workspaces.createProperty(input);
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
