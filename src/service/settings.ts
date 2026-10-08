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

export interface SettingsService {
  handleQuery(input: unknown): ServiceResult<Settings>;
  handleCommand(input: unknown): ServiceResult<Settings>;
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
): SettingsService {
  mkdirSync(dirname(databasePath), { recursive: true });
  const sqlite = new Database(databasePath);
  const db = (() => {
    try {
      sqlite.pragma("journal_mode = WAL");
      const database = drizzle(sqlite);
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

  return {
    handleQuery(input) {
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
      sqlite.close();
    },
  };
}
