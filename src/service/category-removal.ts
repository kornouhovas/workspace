import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { isCategoryRemovalRequest, type CategoryRemovalPreview } from "../contracts/category-removal.js";
import type { ServiceResult } from "../contracts/settings.js";
import { isChildName, validArchive, validExclusions } from "./discovery.js";
import { filesystemAlias } from "./path-alias.js";
import { nativeProjectFilesystem, validProjectBasename, verifyCreationDirectory, type ProjectFilesystem } from "./project-filesystem.js";
import { readProjectReservations } from "./project-rename-reservations.js";
import * as schema from "./db/schema.js";

type Database = BetterSQLite3Database<typeof schema>;
export function createCategoryRemovalService(db: Database, filesystem: ProjectFilesystem = nativeProjectFilesystem) {
  const invalid = (): ServiceResult<never> => ({ ok: false, error: { code: "invalid_input", message: "Choose a current category and an eligible destination in this source." } });
  function previewCategoryRemoval(input: unknown): ServiceResult<CategoryRemovalPreview> {
    if (!isCategoryRemovalRequest(input)) return invalid();
    try {
      const source = db.select().from(schema.workspaces).innerJoin(schema.sources, eq(schema.workspaces.sourceId, schema.sources.id))
        .where(eq(schema.workspaces.id, input.workspaceId)).get()?.sources;
      if (!source || source.discoveryMode !== "grouped" || !source.appliedRootIdentity || readProjectReservations(db, source.id).length) return invalid();
      const exclusions: unknown = JSON.parse(source.excludedRelativePaths);
      if (!validExclusions(exclusions, "grouped") || !validArchive(source.archiveRelativePath)) return invalid();
      verifyCreationDirectory(filesystem, source.canonicalRoot, JSON.parse(source.appliedRootIdentity));
      const categories = db.select().from(schema.categories).where(eq(schema.categories.sourceId, source.id)).all();
      const category = categories.find(c => c.id === input.categoryId);
      const destination = categories.find(c => c.id === input.destinationCategoryId);
      if (!category || input.destinationCategoryId !== null && !destination || category.id === destination?.id) return invalid();
      for (const c of [category, ...(destination ? [destination] : [])]) {
        if (c.modeInactive || c.associationState !== "active" || !isChildName(c.relativePath) || !validProjectBasename(c.relativePath, filesystem.platform) ||
          c.relativePath.includes("\\") || c.relativePath.startsWith(".") || ["$RECYCLE.BIN", "SYSTEM VOLUME INFORMATION"].includes(filesystemAlias(c.relativePath)) ||
          exclusions.some(p => filesystemAlias(c.id === category.id ? p.split("/")[0] : p) === filesystemAlias(c.relativePath)) ||
          source.archiveRelativePath && filesystemAlias(c.id === category.id ? source.archiveRelativePath.split("/")[0] : source.archiveRelativePath) === filesystemAlias(c.relativePath)) return invalid();
        if (filesystem.names(source.canonicalRoot).filter(n => filesystemAlias(n) === filesystemAlias(c.relativePath)).join() !== c.relativePath) return invalid();
        verifyCreationDirectory(filesystem, join(source.canonicalRoot, c.relativePath), JSON.parse(c.nativeIdentity));
        filesystem.assertAccessible?.(join(source.canonicalRoot, c.relativePath));
      }
      const sourceProjects = db.select().from(schema.projects).where(eq(schema.projects.sourceId, source.id)).all();
      const occupiedPaths = new Set(sourceProjects.map(p => filesystemAlias(p.relativePath)));
      const members = sourceProjects.filter(p => p.categoryId === category.id).sort((a, b) => a.relativePath.localeCompare(b.relativePath));
      if (members.length && !destination) return invalid();
      const blockers: CategoryRemovalPreview["blockers"] = [];
      const names = filesystem.names(join(source.canonicalRoot, category.relativePath));
      for (const name of names) if (!members.some(p => p.relativePath === `${category.relativePath}/${name}`)) blockers.push({ relativePath: `${category.relativePath}/${name}`, problem: "unexpected_entry" });
      const projects = members.map(p => ({ projectId: p.id, originalRelativePath: p.relativePath,
        requestedRelativePath: `${destination!.relativePath}/${p.relativePath.split("/").at(-1)}` }));
      const destinationNames = new Set((destination ? filesystem.names(join(source.canonicalRoot, destination.relativePath)) : []).map(filesystemAlias));
      const plannedCounts = new Map<string, number>();
      for (const p of projects) { const key = filesystemAlias(p.requestedRelativePath); plannedCounts.set(key, (plannedCounts.get(key) ?? 0) + 1); }
      for (const [index, p] of members.entries()) {
        const parts = p.relativePath.split("/"), name = parts[1];
        try {
          if (p.sourceId !== source.id || p.modeInactive || p.associationState !== "active" || parts.length !== 2 ||
            parts[0] !== category.relativePath || !names.includes(name)) throw new Error("Unavailable project");
          verifyCreationDirectory(filesystem, join(source.canonicalRoot, p.relativePath), JSON.parse(p.nativeIdentity));
        } catch { blockers.push({ relativePath: p.relativePath, problem: "project_unavailable" }); }
        const requested = projects[index].requestedRelativePath;
        if (destinationNames.has(filesystemAlias(name)) || occupiedPaths.has(filesystemAlias(requested)) || plannedCounts.get(filesystemAlias(requested))! > 1) {
          blockers.push({ relativePath: requested, problem: "occupied" });
        }
        if (exclusions.some(p => filesystemAlias(p) === filesystemAlias(requested))) blockers.push({ relativePath: requested, problem: "excluded" });
        if (source.archiveRelativePath && filesystemAlias(source.archiveRelativePath.split("/").slice(0, 2).join("/")) === filesystemAlias(requested)) blockers.push({ relativePath: requested, problem: "archive" });
      }
      verifyCreationDirectory(filesystem, source.canonicalRoot, JSON.parse(source.appliedRootIdentity));
      const preview: CategoryRemovalPreview = { workspaceId: input.workspaceId, sourceId: source.id, categoryId: category.id,
        destinationCategoryId: destination?.id ?? null, originalRelativePath: category.relativePath, destinationRelativePath: destination?.relativePath ?? null,
        revision: source.discoveryRevision, projects, blockers, previewToken: randomUUID() };
      return { ok: true, value: preview };
    } catch { return { ok: false, error: { code: "filesystem", message: "Category folders could not be verified. Refresh and review their current state." } }; }
  }
  return { previewCategoryRemoval };
}
