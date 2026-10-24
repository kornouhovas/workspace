import {parseRemovalAuthorization} from "./category-removal-authorization.js";
import {parseCategoryFolderAuthorization} from "./category-folder-authorization.js";
import {validateEvidence} from "./folder-evidence.js";
import { asc, eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./db/schema.js";

type Reader = Pick<BetterSQLite3Database<typeof schema>, "select">;

// Read from SQLite on every authorization, including startup and transaction
// rechecks. No in-memory registration window can hide a committed intent.
export function readProjectRenameReservations(db: Reader, sourceId: string) {
  return db.select().from(schema.projectRenameOperations).where(eq(schema.projectRenameOperations.sourceId, sourceId))
    .orderBy(asc(schema.projectRenameOperations.operationId)).all().filter((row) => row.stage !== "completed" && row.stage !== "failed");
}

export function readProjectRelocationReservations(db: Reader, sourceId: string) {
  const renames = readProjectRenameReservations(db, sourceId).map((row) => ({ ...row, operationKind: "rename" as const }));
  const moves = db.select().from(schema.projectCategoryMoveOperations).where(eq(schema.projectCategoryMoveOperations.sourceId, sourceId))
    .orderBy(asc(schema.projectCategoryMoveOperations.operationId)).all().filter((row) => row.stage !== "completed" && row.stage !== "failed")
    .map((row) => ({ ...row, operationKind: "category_move" as const }));
  const archives = db.select().from(schema.projectArchiveOperations).where(eq(schema.projectArchiveOperations.sourceId, sourceId))
    .orderBy(asc(schema.projectArchiveOperations.operationId)).all().filter(row => row.stage === "intent" || row.stage === "destination_recorded")
    .map(row => ({ ...row, operationKind: "project_archive" as const }));
  return [...renames, ...moves, ...archives];
}

export function hasUnfinishedProjectRelocation(db: Reader, sourceId: string): boolean {
  return readProjectRelocationReservations(db, sourceId).length > 0 || readCategoryFolderReservations(db, sourceId).length > 0 || readCategoryRemovalReservations(db, sourceId).length > 0;
}

// Keep the entire immutable binding and mutable evidence on each placement so
// existing review snapshots also detect stage/evidence changes without a source
// discovery revision. Terminal receipts supply no extra path reservations.
export function readProjectReservations(db: Reader, sourceId: string) {
  const creations = db.select().from(schema.projectCreationOperations).where(eq(schema.projectCreationOperations.sourceId, sourceId))
    .orderBy(asc(schema.projectCreationOperations.operationId)).all().filter((row) => row.stage !== "completed" && row.stage !== "failed")
    .map((row) => ({ ...row, operationKind: "creation" as const }));
  function evidence(value:string|null):string|null {
    if(value===null)return null;
    const observed=JSON.parse(value);
    if(observed?.ok!==true || !validateEvidence(observed.evidence))throw new Error("Invalid reserved durable evidence");
    return JSON.stringify(observed.evidence);
  }
  const creationProofs=db.select().from(schema.projectCreationAttestations).all();
  const renameProofs=db.select().from(schema.projectRenameAttestations).all();
  const moveProofs=db.select().from(schema.projectCategoryMoveAttestations).all();
  const durableCreations=creations.flatMap(row=>{
    const proofs=[row.destinationEvidence,...creationProofs.filter(proof=>proof.operationId===row.operationId).map(proof=>proof.destinationEvidence)].filter((proof):proof is string=>proof!==null);
    return (proofs.length ? proofs : [null]).map(proof=>({...row,durableEvidence:evidence(proof)}));
  });
  const relocations = readProjectRelocationReservations(db, sourceId).flatMap<ReturnType<typeof readProjectRelocationReservations>[number] & {durableEvidence:string|null}>(row=>{
    if(row.operationKind!=="rename" && row.operationKind!=="category_move")return [{...row,durableEvidence:null as string|null}];
    const attestations=row.operationKind==="rename" ? renameProofs : moveProofs;
    const proofs=[row.projectEvidence,...attestations.filter(proof=>proof.operationId===row.operationId).map(proof=>proof.projectEvidence)].filter((proof):proof is string=>proof!==null);
    return (proofs.length ? proofs : [null]).map(proof=>({...row,durableEvidence:evidence(proof)}));
  }).flatMap((row) =>
    [...new Set([row.originalRelativePath, row.requestedRelativePath, ...(row.operationKind === "rename" ? [row.stagingRelativePath] : [])])]
      .filter((relativePath): relativePath is string => relativePath !== null)
      .map((relativePath) => ({ ...row, relativePath })));
  const folderAttestations=db.select().from(schema.categoryFolderAttestations).all();
  const categoryFolders = readCategoryFolderReservations(db, sourceId).flatMap(row => {
    const binding=JSON.parse(row.binding) as {members:{id:string;relativePath:string;nativeIdentity:string}[];additions:{id:string;relativePath:string;nativeIdentity:string}[]};
    const authorities=[row.authorization,...folderAttestations.filter(p=>p.operationId===row.operationId).map(p=>p.authorization)]
      .filter((value):value is string=>value!==null).map(value=>{const parsed=parseCategoryFolderAuthorization(value);if(!parsed)throw new Error("Invalid category reservation");return parsed;});
    const categoryProofs=[row.destinationEvidence,...authorities.filter(a=>a.category).map(a=>JSON.stringify(a.category)),...folderAttestations.filter(p=>p.operationId===row.operationId).map(p=>p.destinationEvidence)].filter((p):p is string=>p!==null);
    const categories=[...new Set([row.originalRelativePath,row.requestedRelativePath])].filter((p):p is string=>p!==null).flatMap(relativePath=>
      (categoryProofs.length?categoryProofs:[null]).map(proof=>({...row,operationKind:"category_folder" as const,projectId:row.categoryId,relativePath,durableEvidence:evidence(proof)})));
    const members=[...binding.members,...binding.additions].flatMap(project=>{
      const paths=[...new Set([project.relativePath,...(row.originalRelativePath?[row.requestedRelativePath+project.relativePath.slice(row.originalRelativePath.length)]:[])])];
      const proofs=authorities.flatMap(a=>a.projects.filter(p=>p.id===project.id).map(p=>JSON.stringify(p.observation)));
      return paths.flatMap(relativePath=>(proofs.length?proofs:[null]).map(proof=>({...row,operationKind:"category_folder" as const,projectId:project.id,relativePath,nativeIdentity:project.nativeIdentity,durableEvidence:evidence(proof)})));
    });
    return [...categories,...members];
  });
  const removals = readCategoryRemovalReservations(db, sourceId).flatMap(row => {
    const binding = JSON.parse(row.binding);
    const authority=binding.authorization ? parseRemovalAuthorization(JSON.stringify(binding.authorization),binding) : null;
    if(binding.authorization && !authority)throw new Error("Invalid category removal reservation");
    return [{ ...row, operationKind: "category_removal" as const, projectId: row.categoryId, relativePath: row.originalRelativePath,durableEvidence:authority ? JSON.stringify(authority.category.evidence) : null },
      ...binding.members.flatMap((p:{id:string;relativePath:string;nativeIdentity:string}) => [p.relativePath, `${row.requestedRelativePath}/${p.relativePath.split("/").at(-1)}`].map(relativePath =>
        ({ ...row, operationKind: "category_removal" as const, projectId: p.id, relativePath, nativeIdentity: p.nativeIdentity,
          durableEvidence:authority ? JSON.stringify(authority.projects.find(project=>project.id===p.id)!.observation.evidence) : null })))];
  });
  return [...durableCreations, ...relocations, ...categoryFolders, ...removals];
}

export function readCategoryFolderReservations(db: Reader, sourceId: string) {
  return db.select().from(schema.categoryFolderOperations).where(eq(schema.categoryFolderOperations.sourceId, sourceId))
    .orderBy(asc(schema.categoryFolderOperations.operationId)).all().filter(row => row.stage !== "completed" && row.stage !== "failed");
}

export function readCategoryRemovalReservations(db: Reader, sourceId: string) {
  return db.select().from(schema.categoryRemovalOperations).where(eq(schema.categoryRemovalOperations.sourceId, sourceId))
    .orderBy(asc(schema.categoryRemovalOperations.operationId)).all().filter(row => row.stage === "moving" || row.stage === "cleanup_intent");
}

// Only an exact durable child assignment can use its parent's reservation.
// This capability is private to the service; no request field bypasses safety.
export function categoryRemovalOwner(db: Reader, row: typeof schema.projectCategoryMoveOperations.$inferSelect): string | null {
  const attempt = db.select().from(schema.categoryRemovalAttempts).where(eq(schema.categoryRemovalAttempts.moveId, row.operationId)).get();
  if (!attempt || attempt.projectId !== row.projectId || attempt.workspaceId !== row.initiatingWorkspaceId || attempt.expectedRevision !== row.expectedRevision) return null;
  const removal = db.select().from(schema.categoryRemovalOperations).where(eq(schema.categoryRemovalOperations.operationId, attempt.removalId)).get();
  return removal?.stage === "moving" && removal.sourceId === row.sourceId && removal.categoryId === row.originalCategoryId && removal.destinationCategoryId === row.destinationCategoryId ? removal.operationId : null;
}
