import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { isChildName, reserveCreationDestinations, projectExclusions, reliableIdentity, sameIdentity, scanDirectSource, scanGroupedSource, validArchive, validExclusions,
  type DirectoryObservation, type DiscoveryScan, type NativeIdentity } from "./discovery.js";
import * as schema from "./db/schema.js";

type Database = BetterSQLite3Database<typeof schema>;
type Source = typeof schema.sources.$inferSelect;
type Project = typeof schema.projects.$inferSelect;
type Category = typeof schema.categories.$inferSelect;
type Association = Project | Category;
function storedIdentity(row: Association): NativeIdentity {
  const value = JSON.parse(row.nativeIdentity);
  if (!value || typeof value.dev !== "string" || typeof value.ino !== "string" || typeof value.birthtimeNs !== "string") {
    throw new Error("Invalid stored native evidence");
  }
  return value;
}
const nativeAlias = (a: NativeIdentity, b: NativeIdentity) => a.dev === b.dev && a.ino === b.ino;

// Compute the complete identity mapping before judging old-path occupants. Paths
// reserve placement, while sufficient unchanged native evidence identifies a move.
function directMappings(scan: DiscoveryScan, records: Project[], exclusions: string[], archive: string | null) {
  const directories = scan.snapshot!.children.filter((child): child is DirectoryObservation => child.kind === "directory");
  const identities = records.map(storedIdentity);
  const mappings = new Map<string, string>();
  for (const [index, row] of records.entries()) {
    const stored = identities[index];
    if (row.modeInactive || row.associationState !== "active" || !reliableIdentity(stored) || exclusions.includes(row.relativePath) ||
      row.relativePath === archive?.split("/")[0]) continue;
    const candidates = directories.filter((child) => reliableIdentity(child.identity) && sameIdentity(stored, child.identity) &&
      scan.entries.some((entry) => entry.relativePath === child.relativePath && entry.reason === null));
    if (candidates.length !== 1) continue;
    const target = candidates[0];
    // Continuously matching same-path associations need no write. In particular,
    // explicit recovery's historical-evidence exception remains path-local.
    if (target.relativePath === row.relativePath) continue;
    if (directories.some((child) => child !== target && nativeAlias(child.identity, target.identity)) ||
      identities.some((identity, other) => other !== index && nativeAlias(identity, target.identity))) continue;
    mappings.set(row.id, target.relativePath);
  }
  // Removing a blocked owner can block its predecessors too. Keep only complete
  // permutations/chains whose displaced current reservations all move away.
  let removed: boolean;
  do {
    removed = false;
    for (const [id, target] of mappings) {
      const owner = records.find((row) => row.id !== id && row.associationState !== "replaced" && row.relativePath === target);
      if (owner && !mappings.has(owner.id)) { mappings.delete(id); removed = true; }
    }
  } while (removed);
  return mappings;
}

interface Placement { relativePath: string; categoryId: string | null }

function groupedMappings(scan: DiscoveryScan, projects: Project[], categories: Category[], exclusions: string[], archive: string | null) {
  const directories = scan.snapshot!.children.filter((child): child is DirectoryObservation => child.kind === "directory");
  const evidence = [...categories, ...projects].map((row) => ({ row, identity: storedIdentity(row) }));
  const eligible = (path: string) => scan.entries.some((entry) => entry.relativePath === path && entry.reason === null);
  const suppressed = (path: string) => exclusions.some((excluded) => path === excluded || path.startsWith(`${excluded}/`)) ||
    !!archive && archive.split("/").slice(0, 2).join("/") === path;
  // Reviewed mode changes can retain a direct project over the same physical
  // folder now owned by an operational category. This exact, continuous role
  // history remains legitimate after the category moves; its old project locator
  // must stay dormant. Same-role reservations and reused/ambiguous evidence still
  // block reconciliation, and a new category has no owner for this exception.
  const categoryRoleHistory = (row: Association, identity: NativeIdentity, owner?: Association) =>
    owner !== undefined && !("categoryId" in owner) && !owner.modeInactive && owner.associationState === "active" &&
    "categoryId" in row && row.categoryId === null && isChildName(row.relativePath) && row.sourceId === owner.sourceId &&
    row.modeInactive && (row.associationState === "active" || row.associationState === "excluded") &&
    reliableIdentity(identity) && sameIdentity(identity, storedIdentity(owner));
  const conflict = (child: DirectoryObservation, owner?: Association, continuous = false) =>
    directories.some((other) => other !== child && nativeAlias(other.identity, child.identity)) ||
    evidence.some(({ row, identity }) => row.id !== owner?.id && nativeAlias(identity, child.identity) &&
      !(continuous && row.associationState === "replaced") && !categoryRoleHistory(row, identity, owner));
  // The same-path recovery exception is continuous only. Cross-path matching
  // still rejects competing same-role records and ambiguous native evidence.
  const candidate = (row: Association) => {
    if (row.modeInactive || row.associationState !== "active" || suppressed(row.relativePath)) return null;
    const identity = storedIdentity(row);
    if (!reliableIdentity(identity)) return null;
    const matches = directories.filter((child) => eligible(child.relativePath) && reliableIdentity(child.identity) && sameIdentity(child.identity, identity));
    if (matches.length !== 1) return null;
    const child = matches[0];
    return conflict(child, row, child.relativePath === row.relativePath) ? null : child;
  };
  // Include continuously verified categories for project placement, then discard
  // blocked permutations together with any projects that depend on them.
  const verified = new Map<string, string>();
  for (const category of categories) {
    const child = candidate(category);
    if (child && isChildName(child.relativePath)) verified.set(category.id, child.relativePath);
  }
  const newTargets = directories.filter((child) => isChildName(child.relativePath) && eligible(child.relativePath) &&
    reliableIdentity(child.identity) && !categories.some((row) => row.relativePath === child.relativePath) && !conflict(child));
  const projectCandidates = new Map<string, DirectoryObservation>();
  for (const project of projects) {
    const child = candidate(project);
    if (child?.relativePath.split("/").length === 2) projectCandidates.set(project.id, child);
  }
  let placements = new Map<string, Placement>();
  let removed: boolean;
  do {
    removed = false;
    for (const [id, target] of verified) {
      const owner = categories.find((row) => row.id !== id && row.associationState !== "replaced" && row.relativePath === target);
      if (owner && (!verified.has(owner.id) || verified.get(owner.id) === owner.relativePath)) {
        verified.delete(id); removed = true;
      }
    }
    placements = new Map();
    for (const project of projects) {
      if (!project.categoryId || !verified.has(project.categoryId)) continue;
      const child = projectCandidates.get(project.id);
      if (!child) continue;
      const parent = child.relativePath.split("/")[0];
      const category = categories.find((row) => verified.get(row.id) === parent);
      if (!category && !newTargets.some((target) => target.relativePath === parent)) continue;
      if (child.relativePath !== project.relativePath || category?.id !== project.categoryId) {
        placements.set(project.id, { relativePath: child.relativePath, categoryId: category?.id ?? null });
      }
    }
    let blocked: boolean;
    do {
      blocked = false;
      for (const [id, target] of placements) {
        const owner = projects.find((row) => row.id !== id && row.associationState !== "replaced" && row.relativePath === target.relativePath);
        if (owner && !placements.has(owner.id)) { placements.delete(id); blocked = true; }
      }
    } while (blocked);
    for (const category of categories) {
      if (verified.has(category.id) && verified.get(category.id) !== category.relativePath &&
        projects.some((project) => project.categoryId === category.id && !project.modeInactive && project.associationState === "active" && !placements.has(project.id))) {
        // A parent rename cannot leave an active child at its old locator under
        // SQLite's required-category invariant. Defer the dependent mapping;
        // never infer absent/excluded children's identities or persist absence.
        verified.delete(category.id); removed = true;
      }
    }
  } while (removed);
  const changedCategories = new Map([...verified].filter(([id, path]) => categories.find((row) => row.id === id)!.relativePath !== path));
  const needed = newTargets.filter((child) => [...placements.values()].some((target) => target.categoryId === null && target.relativePath.split("/")[0] === child.relativePath));
  return { projects: placements, categories: changedCategories, needed };
}

// Caller owns post-commit publication. Reconciliation never enrolls projects,
// persists observed missing states, changes authored metadata or writes files.
export function reconcileSource(db: Database, source: Source): { changed: boolean; scan: DiscoveryScan | null } {
  if (source.discoveryMode !== "direct" && source.discoveryMode !== "grouped") return { changed: false, scan: null };
  const grouped = source.discoveryMode === "grouped";
  const exclusions: unknown = JSON.parse(source.excludedRelativePaths);
  if (!validExclusions(exclusions, "grouped") || !validArchive(source.archiveRelativePath) || !Number.isSafeInteger(source.discoveryRevision) ||
    source.discoveryRevision < 0 || source.appliedRootIdentity === null) throw new Error("Invalid configured source");
  const appliedRoot: NativeIdentity = JSON.parse(source.appliedRootIdentity);
  const readReservations = () => db.select().from(schema.projectCreationOperations).where(eq(schema.projectCreationOperations.sourceId, source.id))
    .orderBy(asc(schema.projectCreationOperations.operationId)).all().filter((row) => !["completed", "failed"].includes(row.stage));
  const reservations = readReservations();
  const scanSource = () => reserveCreationDestinations((grouped ? scanGroupedSource : scanDirectSource)(source.canonicalRoot,
    source.archiveRelativePath, projectExclusions(exclusions, grouped ? "grouped" : "direct").effective), reservations);
  const scan = scanSource();
  if (!scan.snapshot) return { changed: false, scan };
  if (!reliableIdentity(appliedRoot) || !reliableIdentity(scan.snapshot.root.identity) || !sameIdentity(appliedRoot, scan.snapshot.root.identity)) {
    return { changed: false, scan: { state: "root_identity_conflict", entries: [], snapshot: null } };
  }
  const readSource = () => db.select().from(schema.sources).where(eq(schema.sources.id, source.id)).get();
  const readProjects = () => db.select().from(schema.projects).where(eq(schema.projects.sourceId, source.id)).orderBy(asc(schema.projects.id)).all();
  const readCategories = () => db.select().from(schema.categories).where(eq(schema.categories.sourceId, source.id)).orderBy(asc(schema.categories.id)).all();
  const readProperty = () => db.select().from(schema.categoryProperties).where(eq(schema.categoryProperties.sourceId, source.id)).get();
  const records = readProjects(), categories = readCategories(), property = readProperty();
  if (grouped && !property || categories.some((row) => !isChildName(row.relativePath)) || records.some((row) =>
    !row.relativePath.split("/").every(isChildName) || row.relativePath.split("/").length > 2 ||
    row.categoryId !== null && !categories.some((category) => category.id === row.categoryId) ||
    !row.modeInactive && (grouped ? row.relativePath.split("/").length !== 2 || !categories.some((category) => category.id === row.categoryId &&
      (row.associationState !== "active" || !category.modeInactive && category.associationState === "active" && row.relativePath.split("/")[0] === category.relativePath)) :
      row.categoryId !== null || !isChildName(row.relativePath)))) throw new Error("Invalid configured associations");
  const mapping = grouped ? groupedMappings(scan, records, categories, exclusions, source.archiveRelativePath) : null;
  const mappings = mapping?.projects ?? new Map([...directMappings(scan, records, exclusions, source.archiveRelativePath)]
    .map(([id, relativePath]) => [id, { relativePath, categoryId: null }]));
  const categoryMappings = mapping?.categories ?? new Map<string, string>();
  const insertedCategories: Category[] = (mapping?.needed ?? []).map((child) => ({ modeInactive: false, id: randomUUID(), sourceId: source.id,
    relativePath: child.relativePath, nativeIdentity: JSON.stringify(child.identity), associationState: "active" }));
  for (const target of mappings.values()) if (target.categoryId === null && grouped) {
    target.categoryId = insertedCategories.find((row) => row.relativePath === target.relativePath.split("/")[0])!.id;
  }
  if (mappings.size === 0 && categoryMappings.size === 0) return { changed: false, scan };
  if (!Number.isSafeInteger(source.discoveryRevision + 1)) throw new Error("Invalid discovery revision");
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const verifyScan = () => {
    const current = scanSource();
    if (!current.snapshot || !same(current.snapshot, scan.snapshot)) throw new Error("Reconciliation observation changed");
  };
  db.transaction((tx) => {
    if (!same(readSource(), source) || !same(readProjects(), records) || !same(readCategories(), categories) || !same(readProperty(), property) || !same(readReservations(), reservations)) throw new Error("Reconciliation configuration changed");
    verifyScan();
    // Release only participating path reservations, transaction-locally. All
    // final active states are restored before commit; triggers/indexes stay on.
    for (const id of mappings.keys()) tx.update(schema.projects).set({ associationState: "replaced" }).where(eq(schema.projects.id, id)).run();
    for (const id of categoryMappings.keys()) tx.update(schema.categories).set({ associationState: "replaced" }).where(eq(schema.categories.id, id)).run();
    for (const [id, relativePath] of categoryMappings) tx.update(schema.categories).set({ relativePath, associationState: "active" }).where(eq(schema.categories.id, id)).run();
    for (const row of insertedCategories) tx.insert(schema.categories).values(row).run();
    for (const [id, target] of mappings) tx.update(schema.projects).set({ ...target, associationState: "active" }).where(eq(schema.projects.id, id)).run();
    tx.update(schema.sources).set({ discoveryRevision: source.discoveryRevision + 1 }).where(eq(schema.sources.id, source.id)).run();
    verifyScan();
    const expected = records.map((row) => mappings.has(row.id) ? { ...row, ...mappings.get(row.id)! } : row);
    const expectedCategories = [...categories.map((row) => categoryMappings.has(row.id) ? { ...row, relativePath: categoryMappings.get(row.id)! } : row),
      ...insertedCategories].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    if (!same(readCategories(), expectedCategories) || !same(readProperty(), property) || !same(readSource(), { ...source, discoveryRevision: source.discoveryRevision + 1 }) || !same(readProjects(), expected) || !same(readReservations(), reservations)) {
      throw new Error("Reconciliation stored state changed");
    }
  });
  return { changed: true, scan };
}
