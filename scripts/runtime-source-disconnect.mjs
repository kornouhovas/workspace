import { constants } from "node:fs";
import { lstat, open, readdir, readlink, realpath, rename } from "node:fs/promises";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { isAbsolute, join } from "node:path";

const maxAttempts = 20, budgetMs = 2000, spacingMs = 100;
const codes = new Set(["EPERM", "EACCES", "ENOENT", "EEXIST", "ENOTEMPTY", "ENOTDIR", "ELOOP", "EBUSY", "EXDEV", "EIO"]);
const errorCode = (error) => codes.has(error?.code) ? error.code : "unknown";
const failureCodes = new Set(["unsafe_source", "changed_identity", "insufficient_identity", "changed_contents", "unsafe_contents",
  "occupied_destination", "deadline_exhausted", "missing_effects", "unexpected_effects", "rename_failed", "attempts_exhausted",
  "validation_failed", "invalid_evidence", "evidence_failed"]);
const identity = (info) => [info.dev, info.ino, info.birthtimeNs];
const sameIdentity = (a, b) => isDeepStrictEqual(identity(a), identity(b));
const fail = (code) => { throw Object.assign(new Error(`Fixture source move failed: ${code}`), { code }); };

async function entry(path) {
  try { return await lstat(path, { bigint: true }); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

async function directory(path, expected) {
  const info = await entry(path);
  if (!info?.isDirectory() || info.isSymbolicLink()) fail("unsafe_source");
  if (expected && !sameIdentity(info, expected)) fail("changed_identity");
  if (info.ino === 0n || info.birthtimeNs <= 0n) fail("insufficient_identity");
  return info;
}

// No link targets are traversed. Files are read through a checked handle; all
// private names, link texts, identities and hashes stay inside this closure.
async function inventory(path) {
  const before = await directory(path);
  const result = [];
  for (const name of (await readdir(path)).sort()) {
    const child = join(path, name), info = await lstat(child, { bigint: true });
    let contents;
    if (info.isSymbolicLink()) contents = ["link", await readlink(child)];
    else if (info.isDirectory()) contents = ["directory", await inventory(child)];
    else if (info.isFile()) {
      const file = await open(child, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
      try {
        const opened = await file.stat({ bigint: true });
        if (!opened.isFile() || !sameIdentity(info, opened)) fail("changed_contents");
        contents = ["file", createHash("sha256").update(await file.readFile()).digest("hex")];
      } finally { await file.close(); }
    } else fail("unsafe_contents");
    const after = await lstat(child, { bigint: true });
    if (!sameIdentity(info, after) || info.mode !== after.mode || info.size !== after.size || info.mtimeNs !== after.mtimeNs || info.ctimeNs !== after.ctimeNs) fail("changed_contents");
    result.push([name, identity(info), info.mode, contents]);
  }
  const after = await directory(path, before);
  if (before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs) fail("changed_contents");
  return result;
}

// Only the caller's exclusively owned disposable mkdtemp root is authorized.
// This is NOT a production filesystem API or atomic no-replace protection:
// ordinary Node rename still has TOCTOU windows against adversarial substitution.
// Canonicalization accepts OS temp aliases (e.g. /var -> /private/var) outside
// that boundary. Inside it, both move endpoints are fixed immediate children.
// __test is a private deterministic seam; runtime callers use real dependencies.
export async function createRuntimeSourceDisconnect({ ownedFixture, sourceName }, __test = {}) {
  if (typeof ownedFixture !== "string" || !isAbsolute(ownedFixture) ||
      typeof sourceName !== "string" || !sourceName || /[\\/:\0]/u.test(sourceName) ||
      sourceName === "." || sourceName === ".." || sourceName.toLowerCase() === "temporarily-disconnected" ||
      /[. ]$/u.test(sourceName)) fail("unsafe_path");
  const originalFixture = await directory(ownedFixture);
  const fixture = await realpath(ownedFixture);
  const fixtureIdentity = await directory(fixture, originalFixture);
  const source = join(fixture, sourceName);
  const disconnected = join(fixture, "temporarily-disconnected");
  const rootIdentity = await directory(source);
  const expectedContents = await inventory(source);
  await directory(source, rootIdentity);
  await directory(fixture, fixtureIdentity);
  if (await entry(disconnected)) fail("occupied_destination");
  const move = __test.rename ?? rename, platform = __test.platform ?? process.platform;
  const now = __test.now ?? (() => performance.now());
  const sleep = __test.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  let location = "disconnect", busy = false, failed = false;
  return async (direction) => {
    if (direction !== "disconnect" && direction !== "restore") fail("invalid_direction");
    if (busy || failed || direction !== location) fail("invalid_state");
    busy = true;
    const from = direction === "disconnect" ? source : disconnected;
    const to = direction === "disconnect" ? disconnected : source;
    const started = now();
    const observation = { attempts: 0, elapsedMs: 0, firstErrorCode: null,
      sourceAbsent: false, destinationIdentityMatches: false, contentsMatch: false, verificationComplete: false };
    const elapsed = () => Math.max(0, Math.ceil(now() - started));
    async function validate() {
      observation.verificationComplete = false;
      await directory(fixture, fixtureIdentity);
      await directory(from, rootIdentity);
      if (!isDeepStrictEqual(await inventory(from), expectedContents)) fail("changed_contents");
      await directory(from, rootIdentity);
      if (await entry(to)) fail("occupied_destination");
      await directory(fixture, fixtureIdentity);
    }
    async function effects() {
      observation.verificationComplete = false;
      await directory(fixture, fixtureIdentity);
      observation.sourceAbsent = (await entry(from)) === null;
      const target = await entry(to);
      observation.destinationIdentityMatches = !!target?.isDirectory() && !target.isSymbolicLink() && sameIdentity(target, rootIdentity);
      if (observation.destinationIdentityMatches) {
        observation.contentsMatch = isDeepStrictEqual(await inventory(to), expectedContents);
        await directory(to, rootIdentity);
      }
      observation.sourceAbsent = (await entry(from)) === null;
      await directory(fixture, fixtureIdentity);
      observation.verificationComplete = true;
    }
    try {
      while (observation.attempts < maxAttempts) {
        if (elapsed() >= budgetMs) fail("deadline_exhausted");
        await validate();
        if (elapsed() >= budgetMs) fail("deadline_exhausted");
        observation.attempts++;
        let moveError;
        // Await settlement even beyond the deadline. Never abandon an in-flight
        // rename, race cleanup against it, replay unexpected effects or roll back.
        try { await move(from, to); } catch (error) { moveError = error; }
        if (moveError) observation.firstErrorCode ??= errorCode(moveError);
        await effects();
        if (elapsed() >= budgetMs) fail("deadline_exhausted");
        if (!moveError) {
          if (!observation.sourceAbsent || !observation.destinationIdentityMatches || !observation.contentsMatch) fail("missing_effects");
          location = direction === "disconnect" ? "restore" : "disconnect";
          observation.elapsedMs = elapsed();
          return observation;
        }
        if (observation.sourceAbsent || await entry(to)) fail("unexpected_effects");
        if (platform !== "win32" || moveError.code !== "EPERM") fail("rename_failed");
        if (observation.attempts >= maxAttempts) fail("attempts_exhausted");
        const remaining = budgetMs - elapsed();
        if (remaining <= 0) fail("deadline_exhausted");
        await sleep(Math.min(spacingMs, remaining));
      }
    } catch (error) {
      failed = true;
      observation.elapsedMs = elapsed();
      // Only finite diagnostic fields are enumerable. Raw OS messages, paths,
      // identities and file contents never become fixture failure observations.
      let failure = error;
      if (!failureCodes.has(error.code)) {
        observation.firstErrorCode ??= errorCode(error);
        failure = Object.assign(new Error("Fixture source move failed: validation_failed"), { code: "validation_failed" });
      }
      failure.fixtureMove = observation;
      throw failure;
    } finally { busy = false; }
  };
}

const effectKeys = ["sourceAbsent", "destinationIdentityMatches", "contentsMatch", "verificationComplete"];
const observationKeys = ["attempts", "elapsedMs", "firstErrorCode", ...effectKeys];
function checkedObservation(value) {
  if (!value || typeof value !== "object" || Reflect.ownKeys(value).some(key => typeof key !== "string") ||
      !isDeepStrictEqual(Reflect.ownKeys(value).sort(), [...observationKeys].sort()) ||
      observationKeys.some(key => !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), "value")) ||
      !Number.isInteger(value.attempts) || value.attempts < 0 || value.attempts > maxAttempts ||
      !Number.isSafeInteger(value.elapsedMs) || value.elapsedMs < 0 ||
      !(value.firstErrorCode === null || codes.has(value.firstErrorCode) || value.firstErrorCode === "unknown") ||
      !effectKeys.every(key => typeof value[key] === "boolean")) fail("invalid_evidence");
  return Object.fromEntries(observationKeys.map(key => [key, value[key]]));
}

// Fixed four-operation ledger: no caller-provided labels, raw exceptions or
// per-attempt arrays. Snapshots cannot mutate it, and unreached moves stay visible.
export function createRuntimeSourceMoveEvidence() {
  const outcomes = ["subscribed", "unsubscribed"].flatMap(cycle => ["disconnect", "restore"].map(direction => ({
    scenario: `${cycle}-${direction}`, direction, status: "unreached", finalCode: null,
    attempts: 0, elapsedMs: 0, firstErrorCode: null,
    sourceAbsent: false, destinationIdentityMatches: false, contentsMatch: false, verificationComplete: false,
  })));
  let index = 0, busy = false, failed = false;
  return {
    snapshot: () => outcomes.map(outcome => ({ ...outcome })),
    assertComplete() { if (busy || failed || !outcomes.every(outcome => outcome.status === "passed")) fail("incomplete_moves"); },
    async run(direction, move, persist) {
      if (busy || failed || !outcomes[index] || direction !== outcomes[index].direction) fail("invalid_state");
      busy = true;
      const outcome = outcomes[index];
      outcome.status = "running";
      let primary;
      try {
        const observation = checkedObservation(await move(direction));
        Object.assign(outcome, observation);
        if (observation.attempts === 0 || observation.elapsedMs >= budgetMs || !effectKeys.every(key => observation[key])) fail("invalid_evidence");
        outcome.status = "passed";
      } catch (error) {
        primary = error;
        outcome.status = "failed";
        outcome.finalCode = failureCodes.has(error.code) ? error.code : "validation_failed";
        if (error.fixtureMove) {
          try { Object.assign(outcome, checkedObservation(error.fixtureMove)); }
          catch { outcome.finalCode = "invalid_evidence"; }
        }
      }
      try {
        // Await evidence collection before returning or propagating the move
        // failure. Collection failure cannot replace that primary failure.
        await persist();
      } catch {
        if (!primary) {
          primary = Object.assign(new Error("Fixture source move failed: evidence_failed"), { code: "evidence_failed" });
          outcome.status = "failed";
          outcome.finalCode = "evidence_failed";
        }
      } finally {
        busy = false;
        failed = !!primary;
        if (!failed) index++;
      }
      if (primary) throw primary;
      return { ...outcome };
    },
  };
}
