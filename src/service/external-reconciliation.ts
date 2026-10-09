import { asc, eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { isChildName, reliableIdentity, sameIdentity, scanDirectSource, validArchive, validExclusions,
  type DirectoryObservation, type DiscoveryScan, type NativeIdentity } from "./discovery.js";
import * as schema from "./db/schema.js";

type Database = BetterSQLite3Database<typeof schema>;
type Source = typeof schema.sources.$inferSelect;
type Project = typeof schema.projects.$inferSelect;
const nativeAlias = (a: NativeIdentity, b: NativeIdentity) => a.dev === b.dev && a.ino === b.ino;

// Compute the complete identity mapping before judging old-path occupants. Paths
// reserve placement, while sufficient unchanged native evidence identifies a move.
function directMappings(scan: DiscoveryScan, records: Project[], exclusions: string[], archive: string | null) {
  const directories = scan.snapshot!.children.filter((child): child is DirectoryObservation => child.kind === "directory");
  const identities: NativeIdentity[] = records.map((row) => {
    const value = JSON.parse(row.nativeIdentity);
    if (!value || typeof value.dev !== "string" || typeof value.ino !== "string" || typeof value.birthtimeNs !== "string") {
      throw new Error("Invalid stored native evidence");
    }
    return value;
  });
  const mappings = new Map<string, string>();
  for (const [index, row] of records.entries()) {
    const stored = identities[index];
    if (row.associationState !== "active" || !reliableIdentity(stored) || exclusions.includes(row.relativePath) ||
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

// Caller owns post-commit publication. Reconciliation never enrolls projects,
// persists observed missing states, changes authored metadata or writes files.
export function reconcileDirectSource(db: Database, source: Source): { changed: boolean; scan: DiscoveryScan | null } {
  if (source.discoveryMode !== "direct") return { changed: false, scan: null };
  const exclusions: unknown = JSON.parse(source.excludedRelativePaths);
  if (!validExclusions(exclusions) || !validArchive(source.archiveRelativePath) || !Number.isSafeInteger(source.discoveryRevision) ||
    source.discoveryRevision < 0 || source.appliedRootIdentity === null) throw new Error("Invalid configured source");
  const appliedRoot: NativeIdentity = JSON.parse(source.appliedRootIdentity);
  const scanSource = () => scanDirectSource(source.canonicalRoot, source.archiveRelativePath, exclusions);
  const scan = scanSource();
  if (!scan.snapshot) return { changed: false, scan };
  if (!reliableIdentity(appliedRoot) || !reliableIdentity(scan.snapshot.root.identity) || !sameIdentity(appliedRoot, scan.snapshot.root.identity)) {
    return { changed: false, scan: { state: "root_identity_conflict", entries: [], snapshot: null } };
  }
  const readSource = () => db.select().from(schema.sources).where(eq(schema.sources.id, source.id)).get();
  const readProjects = () => db.select().from(schema.projects).where(eq(schema.projects.sourceId, source.id)).orderBy(asc(schema.projects.id)).all();
  const records = readProjects();
  if (records.some((row) => row.categoryId !== null || !isChildName(row.relativePath)) ||
    db.select().from(schema.categories).where(eq(schema.categories.sourceId, source.id)).get()) throw new Error("Invalid direct associations");
  const mappings = directMappings(scan, records, exclusions, source.archiveRelativePath);
  if (mappings.size === 0) return { changed: false, scan };
  if (!Number.isSafeInteger(source.discoveryRevision + 1)) throw new Error("Invalid discovery revision");
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const verifyScan = () => {
    const current = scanSource();
    if (!current.snapshot || !same(current.snapshot, scan.snapshot)) throw new Error("Reconciliation observation changed");
  };
  db.transaction((tx) => {
    if (!same(readSource(), source) || !same(readProjects(), records)) throw new Error("Reconciliation configuration changed");
    verifyScan();
    // Release only participating path reservations, transaction-locally. All
    // final active states are restored before commit; triggers/indexes stay on.
    for (const id of mappings.keys()) tx.update(schema.projects).set({ associationState: "replaced" }).where(eq(schema.projects.id, id)).run();
    for (const [id, relativePath] of mappings) tx.update(schema.projects).set({ relativePath, associationState: "active" }).where(eq(schema.projects.id, id)).run();
    tx.update(schema.sources).set({ discoveryRevision: source.discoveryRevision + 1 }).where(eq(schema.sources.id, source.id)).run();
    verifyScan();
    const expected = records.map((row) => mappings.has(row.id) ? { ...row, relativePath: mappings.get(row.id)! } : row);
    if (!same(readSource(), { ...source, discoveryRevision: source.discoveryRevision + 1 }) || !same(readProjects(), expected)) {
      throw new Error("Reconciliation stored state changed");
    }
  });
  return { changed: true, scan };
}
