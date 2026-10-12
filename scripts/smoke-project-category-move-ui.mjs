import assert from "node:assert/strict";
import { execFileSync, fork } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { once } from "node:events";
import { lstat, mkdir, mkdtemp, readdir, readFile, realpath, rename, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron } from "playwright-core";
import { packagedExecutablePath } from "./runtime-executable.mjs";
import { cleanupOwnedFixture, closeRuntimeSession, ownedProcessesStopped, withDeadline } from "./runtime-lifecycle.mjs";
import { createRenameRuntimeStartup } from "./rename-runtime-startup.mjs";
import { measureDiscoveryLayout } from "./runtime-layout.mjs";
import { assertCategoryMoveAcceptance, createCategoryMoveEvidence, recordCategoryMoveEvidence } from "./runtime-evidence.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const unwrap = result => { assert.equal(result.ok, true, JSON.stringify(result)); return result.value; };
const query = async (page, type, workspaceId, extra = {}) => unwrap(await page.evaluate(input => globalThis.window.workspace.workspace(input), { type: `workspace.${type}`, ...(workspaceId === undefined ? {} : { workspaceId }), ...extra }));
const labels = {
  en: { move: "Move project category", submit: "Move project folder", saved: "Project folder moved to the selected category.", unchanged: "The current category was verified. No folder move was needed.", occupied: "The destination is occupied or reserved. Choose another category.", unavailable: "This folder or category is unavailable. Check source access and the project association." },
  ru: { move: "Переместить проект в категорию", submit: "Переместить папку проекта", saved: "Папка проекта перемещена в выбранную категорию.", unchanged: "Текущая категория проверена. Перемещение папки не потребовалось.", occupied: "Назначение занято или зарезервировано. Выберите другую категорию.", unavailable: "Папка или категория недоступна. Проверьте доступ к источнику и привязку проекта." },
};

// Bind by the intended project action and category, then assert exact authored
// text. No guessed composite accessible cell name; both may repeat across rows.
export async function assertRuntimeCategoryCell(page, projectName, categoryName, moveLabel, eligible = true) {
  moveLabel ??= labels[await page.locator("#interface-language").inputValue()].move;
  const normalize = value => value.replace(/\s+/g, " ").trim();
  let cell = page.getByRole("cell").filter({ hasText: categoryName.trim() });
  if (eligible) cell = cell.filter({ has: page.getByRole("button", { name: normalize(`${moveLabel}: ${projectName}`), exact: true }) });
  await cell.waitFor();
  assert.equal(await cell.count(), 1, "Unique intended project/category cell");
  assert.equal(await cell.locator("..").locator("td").nth(0).evaluate(node => node.querySelector(".property-authored")?.textContent), projectName);
  assert.equal(await cell.evaluate(node => node.firstChild?.textContent), categoryName, "Exact authored category text");
  assert.equal(await cell.getByRole("button").count(), eligible ? 1 : 0);
  if (eligible) {
    const action = cell.getByRole("button", { name: `${moveLabel}: ${projectName}`.replace(/\s+/g, " ").trim(), exact: true });
    assert.equal(await action.isDisabled(), false);
  }
  return cell;
}

export async function categoryMoveInventory(path) {
  const info = await lstat(path, { bigint: true });
  assert.equal(info.isSymbolicLink(), false, "No-follow fixture tree");
  const identity = { dev: String(info.dev), ino: String(info.ino), birthtimeNs: String(info.birthtimeNs) };
  if (info.isDirectory()) {
    const children = [];
    for (const name of (await readdir(path)).sort()) children.push([name, await categoryMoveInventory(join(path, name))]);
    return { identity, mode: Number(info.mode & 0o777n), children };
  }
  assert.equal(info.isFile(), true);
  return { identity, mode: Number(info.mode & 0o777n), bytes: (await readFile(path)).toString("hex") };
}

export async function categoryMoveMetadata(database) {
  const { default: Database } = await import("better-sqlite3");
  const db = new Database(database, { readonly: true });
  try {
    return Object.fromEntries(["workspaces", "views", "active_workspace", "sources", "projects", "categories", "category_properties", "property_definitions", "text_property_values", "settings", "project_creation_operations", "project_rename_operations"].map(table => [table, db.prepare(`SELECT * FROM ${table} ORDER BY 1, 2`).all()]));
  } finally { db.close(); }
}

export async function recoveryState(setup) {
  const { default: Database } = await import("better-sqlite3");
  const db = new Database(setup.database, { readonly: true });
  let journal;
  try { journal = db.prepare("SELECT * FROM project_category_move_operations ORDER BY operation_id").all(); }
  finally { db.close(); }
  return { journal, metadata: await categoryMoveMetadata(setup.database), tree: await categoryMoveInventory(setup.sourceRoot), otherTree: await categoryMoveInventory(setup.otherRoot) };
}

// These are independent, read-only fixture oracles. Observation acknowledgment
// is not application metadata; every retained application table is compared.
export async function captureRuntimeCategoryState(page, setup, workspaceId = setup.workspace.workspaceId) {
  return {
    durable: await recoveryState(setup),
    projects: await query(page, "listProjects", workspaceId),
    sibling: await query(page, "listProjects", setup.sibling.workspaceId),
    other: await query(page, "listProjects", setup.other.workspaceId),
    text: await query(page, "listTextProperties", workspaceId),
    siblingText: await query(page, "listTextProperties", setup.sibling.workspaceId),
    otherText: await query(page, "listTextProperties", setup.other.workspaceId),
    configurations: await query(page, "load"),
    settings: unwrap(await page.evaluate(() => globalThis.window.workspace.settings({ type: "settings.load" }))),
    events: await page.evaluate(() => globalThis.categoryMoveEvents),
  };
}

export function runtimeCategoryBinding(before, projectId, destinationCategoryId) {
  const list = before.projects;
  const project = list.projects.find(entry => entry.projectId === projectId);
  const original = list.categories.find(entry => entry.categoryId === project?.categoryId);
  const destination = list.categories.find(entry => entry.categoryId === destinationCategoryId);
  assert.ok(project && original && destination);
  assert.equal(project.relativePath, `${original.relativePath}/${project.name}`);
  return Object.freeze({ workspaceId: list.workspaceId, sourceId: list.sourceId, projectId,
    name: project.name, originalCategoryId: original.categoryId, destinationCategoryId,
    originalRelativePath: project.relativePath, requestedRelativePath: `${destination.relativePath}/${project.name}`,
    originalParent: original.relativePath, destinationParent: destination.relativePath, expectedRevision: list.revision });
}

function inventoryEntry(tree, path) {
  for (const name of path.split("/")) { tree = tree.children.find(([entry]) => entry === name)?.[1]; assert.ok(tree); }
  return tree;
}

export function expectedRuntimeCategoryRow(before, binding, operationId, outcome) {
  assert.ok(outcome === "unchanged" || outcome === "completed");
  assert.match(operationId, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  const { metadata, tree } = before.durable;
  const source = metadata.sources.find(row => row.id === binding.sourceId);
  const project = metadata.projects.find(row => row.id === binding.projectId && row.source_id === binding.sourceId);
  const original = metadata.categories.find(row => row.id === binding.originalCategoryId && row.source_id === binding.sourceId);
  const destination = metadata.categories.find(row => row.id === binding.destinationCategoryId && row.source_id === binding.sourceId);
  assert.ok(source && project && original && destination);
  assert.equal(source.discovery_revision, binding.expectedRevision);
  assert.equal(project.category_id, binding.originalCategoryId); assert.equal(project.relative_path, binding.originalRelativePath);
  assert.deepEqual(JSON.parse(source.applied_root_identity), tree.identity);
  for (const category of [original, destination]) assert.deepEqual(JSON.parse(category.native_identity), inventoryEntry(tree, category.relative_path).identity);
  assert.deepEqual(JSON.parse(project.native_identity), inventoryEntry(tree, project.relative_path).identity);
  assert.equal(binding.originalCategoryId === binding.destinationCategoryId, outcome === "unchanged");
  return { operation_id: operationId, source_id: binding.sourceId, initiating_workspace_id: binding.workspaceId,
    project_id: binding.projectId, name: binding.name, expected_revision: binding.expectedRevision,
    original_category_id: binding.originalCategoryId, destination_category_id: binding.destinationCategoryId,
    canonical_root: source.canonical_root, original_parent_relative_path: binding.originalParent, destination_parent_relative_path: binding.destinationParent,
    original_relative_path: binding.originalRelativePath, requested_relative_path: binding.requestedRelativePath,
    root_identity: source.applied_root_identity, original_parent_identity: original.native_identity, destination_parent_identity: destination.native_identity,
    native_identity: project.native_identity, excluded_relative_paths: source.excluded_relative_paths, archive_relative_path: source.archive_relative_path,
    stage: "completed", destination_identity: outcome === "unchanged" ? null : project.native_identity,
    last_verified_placement: outcome === "unchanged" ? "original" : "destination", last_verified_identity: project.native_identity,
    problem: null, result_kind: outcome, completed_revision: binding.expectedRevision + (outcome === "unchanged" ? 0 : 1) };
}

export function assertRuntimeCategoryReceipt(result, row) {
  assert.deepEqual(result, { ok: true, value: { outcome: row.result_kind, operation: {
    operationId: row.operation_id, sourceId: row.source_id, initiatingWorkspaceId: row.initiating_workspace_id,
    projectId: row.project_id, name: row.name, originalCategoryId: row.original_category_id, destinationCategoryId: row.destination_category_id,
    originalRelativePath: row.original_relative_path, requestedRelativePath: row.requested_relative_path, expectedRevision: row.expected_revision,
    stage: "completed", lastVerifiedPlacement: row.last_verified_placement, problem: null, resultKind: row.result_kind, completedRevision: row.completed_revision,
  }, project: { operationId: row.operation_id, sourceId: row.source_id, projectId: row.project_id, name: row.name,
    relativePath: row.requested_relative_path, categoryId: row.destination_category_id, revision: row.completed_revision } } });
  return result.value;
}

export function assertRuntimeCategoryJournal(before, after, row, existing = false) {
  assert.equal(before.filter(entry => entry.operation_id === row.operation_id).length, existing ? 1 : 0);
  const expected = before.filter(entry => entry.operation_id !== row.operation_id).concat(row).sort((a, b) => a.operation_id.localeCompare(b.operation_id));
  assert.deepEqual(after, expected, "Exact correlated operation and unchanged complete journal");
}

function assertMoveEvents(before, after, sourceId, revision, workspaceIds) {
  assert.deepEqual(after.slice(0, before.length), before);
  const added = after.slice(before.length);
  assert.equal(added.length, 1, "One authored move event");
  assert.deepEqual({ ...added[0], workspaceIds: [...added[0].workspaceIds].sort() },
    { type: "workspace.projectsChanged", sourceId, revision, workspaceIds: [...workspaceIds].sort() });
}

export function assertRuntimeCategoryUnchanged(before, after, binding, operationId, result) {
  const row = expectedRuntimeCategoryRow(before, binding, operationId, "unchanged");
  assert.equal(before.durable.journal.some(entry => entry.operation_id === operationId), false);
  const expected = structuredClone(before);
  expected.durable.journal.push(row); expected.durable.journal.sort((a, b) => a.operation_id.localeCompare(b.operation_id));
  assert.deepEqual(after, expected, "Exactly one correlated no-op receipt; no independent state/effect/event change");
  return assertRuntimeCategoryReceipt(result, row);
}

export function assertRuntimeCategoryKeptOriginal(before, after, row, result, originalProjection) {
  const bound = before.durable.journal.find(entry => entry.operation_id === row.operation_id);
  assert.ok(bound, "Existing authored recovery operation");
  assert.deepEqual(row, { ...bound, stage: "failed", result_kind: "rejected", last_verified_placement: "original",
    problem: "kept_original", completed_revision: null }, "Exact keep_original journal transition");
  assertRuntimeCategoryJournal(before.durable.journal, after.durable.journal, row, true);
  const project = originalProjection.projects.find(entry => entry.projectId === bound.project_id);
  const stored = before.durable.metadata.projects.find(entry => entry.id === bound.project_id);
  assert.ok(project && stored);
  assert.equal(originalProjection.sourceId, bound.source_id);
  assert.equal(originalProjection.revision, bound.expected_revision);
  assert.equal(project.resolution, "active"); assert.equal(project.associationState, "active");
  assert.equal(project.retentionReason, null);
  assert.equal(project.name, bound.name); assert.equal(project.relativePath, bound.original_relative_path);
  assert.equal(project.categoryId, bound.original_category_id);
  assert.equal(stored.source_id, bound.source_id); assert.equal(stored.relative_path, project.relativePath);
  assert.equal(stored.category_id, project.categoryId); assert.equal(stored.native_identity, bound.native_identity);
  assert.deepEqual(inventoryEntry(before.durable.tree, project.relativePath).identity, JSON.parse(bound.native_identity));
  const expected = structuredClone(before);
  expected.durable.journal = before.durable.journal.map(entry => entry.operation_id === row.operation_id ? row : entry);
  for (const key of ["projects", "sibling"]) {
    const active = { ...structuredClone(originalProjection), workspaceId: before[key].workspaceId };
    const pending = structuredClone(active);
    pending.projects = pending.projects.filter(entry => entry.projectId !== bound.project_id);
    pending.retainedProjects.push({ ...project, resolution: "unresolved" });
    pending.retainedProjects.sort((a, b) => a.relativePath < b.relativePath ? -1 : a.relativePath > b.relativePath ? 1 : 0);
    pending.retainedCount++;
    assert.deepEqual(before[key], pending, "Only the selected original project is pending before keep_original");
    expected[key] = active;
  }
  assert.deepEqual(after, expected, "keep_original changes only its exact terminal receipt and original active projections");
  assert.deepEqual(result, { ok: true, value: { outcome: "rejected", problem: "kept_original", operation: {
    operationId: row.operation_id, sourceId: row.source_id, initiatingWorkspaceId: row.initiating_workspace_id,
    projectId: row.project_id, name: row.name, originalCategoryId: row.original_category_id, destinationCategoryId: row.destination_category_id,
    originalRelativePath: row.original_relative_path, requestedRelativePath: row.requested_relative_path, expectedRevision: row.expected_revision,
    stage: "failed", lastVerifiedPlacement: "original", problem: "kept_original", resultKind: "rejected", completedRevision: null,
  } } });
  return result.value;
}

// Record, but never replace, the ID generated by the actual renderer Enter.
// The frozen preload API and service request/response remain untouched.
export async function recordRuntimeCategoryAction(page, action) {
  await page.evaluate(() => {
    const original = globalThis.crypto.randomUUID;
    globalThis.categoryMoveActionIds = [];
    globalThis.categoryMoveOriginalUUID = original;
    globalThis.crypto.randomUUID = function (...args) {
      const id = Reflect.apply(original, this, args); globalThis.categoryMoveActionIds.push(id); return id;
    };
  });
  try { await action(); return await page.evaluate(() => globalThis.categoryMoveActionIds); }
  finally {
    await page.evaluate(() => {
      globalThis.crypto.randomUUID = globalThis.categoryMoveOriginalUUID;
      delete globalThis.categoryMoveOriginalUUID; delete globalThis.categoryMoveActionIds;
    });
  }
}

export async function assertRuntimeCategoryAcknowledgment(page, language, outcome, prove) {
  assert.ok(outcome === "unchanged" || outcome === "completed");
  assert.equal(typeof prove, "function", "Authoritative operation proof is required before UI acknowledgment");
  const receipt = await prove();
  assert.equal(receipt.outcome, outcome);
  assert.equal(receipt.operation.stage, "completed"); assert.equal(receipt.operation.resultKind, outcome);
  const ordinary = labels[language][outcome === "unchanged" ? "unchanged" : "saved"];
  const guarded = language === "en" ? "The category move is confirmed. Loading the current project placement after a newer source change."
    : "Перемещение подтверждено. Загружается актуальное расположение после нового изменения источника.";
  const messages = await page.locator(".project-category-move").evaluate(node => [...node.querySelectorAll(":scope > .bb-status > .bb-status__title")].map(title => title.textContent));
  assert.ok(messages.length === 1 && (messages[0] === ordinary || messages[0] === guarded), "Exact proven category acknowledgment");
  assert.equal(await page.locator("#project-category-move-destination").count(), 0, "Completed editor detached");
  assert.equal(await page.locator(".category-move-review").count(), 0, "Completed recovery review detached");
  return receipt;
}

// Fixture preparation uses the existing service only before the production app
// consumes the database. No production failure injection or mutation seam.
export async function seedCategoryMoveFixture(data) {
  await mkdir(data, { recursive: true });
  const sourceRoot = join(data, "root"), otherRoot = join(data, "other");
  const name = "  Exact 日本語 📝  ";
  for (const path of [join(sourceRoot, "Current", name, "nested"), join(sourceRoot, "Destination"), join(sourceRoot, "Occupied", name), join(sourceRoot, "Unavailable"), join(otherRoot, "Other project")]) await mkdir(path, { recursive: true });
  await writeFile(join(sourceRoot, "Current", name, "sentinel"), "original bytes\0日本語\n");
  await writeFile(join(sourceRoot, "Current", name, "nested", "note"), "nested bytes\n");
  await writeFile(join(sourceRoot, "Occupied", name, "sentinel"), "occupied bytes\0retained");
  await writeFile(join(otherRoot, "Other project", "sentinel"), "unrelated bytes\0");
  const database = join(data, "workspace.sqlite");
  const { openSettingsService } = await import("../dist/service/settings.mjs");
  const service = openSettingsService(database);
  let setup;
  try {
    const command = input => unwrap(service.handleCommand(input));
    const read = input => unwrap(service.handleQuery(input));
    const workspace = command({ type: "workspace.create", name: "Category move", rootPath: sourceRoot });
    const sibling = command({ type: "workspace.create", name: "Sibling", rootPath: sourceRoot });
    const other = command({ type: "workspace.create", name: "Other", rootPath: otherRoot });
    for (const [entry, mode] of [[workspace, "grouped"], [other, "direct"]]) {
      const preview = read({ type: "workspace.previewDiscovery", workspaceId: entry.workspaceId, mode });
      command({ type: "workspace.applyDiscovery", workspaceId: entry.workspaceId, previewToken: preview.previewToken });
    }
    let projection = read({ type: "workspace.listProjects", workspaceId: workspace.workspaceId });
    const project = projection.projects.find(p => p.name === name && p.relativePath.startsWith("Current/")); assert.ok(project);
    command({ type: "workspace.renameCategoryProperty", workspaceId: workspace.workspaceId, propertyId: projection.categoryProperty.propertyId, name: "  Exact category label 📝  " });
    const property = command({ type: "workspace.createProperty", workspaceId: workspace.workspaceId, name: "  Notes 📝  ", propertyType: "text" });
    command({ type: "workspace.setTextValue", workspaceId: workspace.workspaceId, projectId: project.projectId, propertyId: property.propertyId, value: "  Exact\nТекст\t  " });
    command({ type: "workspace.activate", workspaceId: workspace.workspaceId });
    projection = read({ type: "workspace.listProjects", workspaceId: workspace.workspaceId });
    const properties = read({ type: "workspace.listTextProperties", workspaceId: workspace.workspaceId });
    const otherProjection = read({ type: "workspace.listProjects", workspaceId: other.workspaceId });
    const otherProperties = read({ type: "workspace.listTextProperties", workspaceId: other.workspaceId });
    const configurations = read({ type: "workspace.load" });
    setup = { data, database, sourceRoot, otherRoot, workspace, sibling, other, project, projection, properties, otherProjection, otherProperties, configurations };
  } finally { service.close(); }
  // Owned, distinct per-workspace view names make accidental sharing observable.
  const { default: Database } = await import("better-sqlite3");
  const db = new Database(database);
  try { for (const entry of [setup.workspace, setup.sibling, setup.other]) db.prepare("UPDATE views SET name = ? WHERE id = ?").run(`${entry.name} independent view`, entry.viewId); }
  finally { db.close(); }
  setup.metadata = await categoryMoveMetadata(database);
  setup.tree = await categoryMoveInventory(sourceRoot);
  setup.projectTree = await categoryMoveInventory(join(sourceRoot, "Current", name));
  setup.otherTree = await categoryMoveInventory(otherRoot);
  return setup;
}

export async function interruptCategoryMoveFixture(setup, checkpoint, ownedProcesses) {
  const stages = { intent: "intent", native_effect: "intent", destination_evidence: "destination_recorded", commit: "completed" };
  assert.ok(Object.hasOwn(stages, checkpoint), "Supported category interruption checkpoint");
  const marker = join(setup.data, "cleanup-marker");
  const child = fork(join(root, "tests/fixtures/project-category-move-crash-worker.mjs"), [setup.database, checkpoint, JSON.stringify(setup.request), marker],
    { cwd: root, execArgv: [], stdio: ["ignore", "ignore", "pipe", "ipc"] });
  ownedProcesses.add(child);
  const exited = once(child, "exit");
  // Observe the exit promise immediately, including spawn failures, while the
  // checkpoint wait owns the error. No unhandled rejection may escape cleanup.
  void exited.catch(() => {});
  let reached;
  const result = new Promise((done, reject) => {
    child.once("error", reject);
    child.once("exit", () => { if (!reached) reject(new Error("Category interruption worker exited before its checkpoint")); });
    child.once("message", message => {
      if (message.checkpoint !== checkpoint || message.operationId !== setup.request.operationId || message.stage !== stages[checkpoint]) reject(new Error("Category interruption worker returned the wrong checkpoint"));
      else { reached = message; done(message); }
    });
  });
  child.stderr.resume();
  try {
    await withDeadline(result, 10000, "Category interruption checkpoint");
    assert.equal(child.kill("SIGKILL"), true);
    const [code, signal] = await withDeadline(exited, 5000, "Category interruption termination");
    assert.ok(process.platform === "win32" ? code !== null || signal !== null : signal === "SIGKILL", "Owned controlled termination");
    await assert.rejects(stat(marker), { code: "ENOENT" });
    return { kind: "controlled_fixture_preparation", checkpoint, stage: reached.stage, workerExited: true, cleanupExecuted: false };
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL"); await withDeadline(exited, 5000, "Category interruption cleanup");
    }
  }
}

export async function categoryMoveRuntimeInputs(mode, executablePath) {
  const digest = createHash("sha256");
  const hashes = {};
  async function include(path) {
    const bytes = await readFile(join(root, path));
    hashes[path] = createHash("sha256").update(bytes).digest("hex");
    digest.update(path).update("\0").update(hashes[path]).update("\0");
  }
  async function tree(path) {
    for (const entry of (await readdir(join(root, path), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.isDirectory()) await tree(`${path}/${entry.name}`);
      else { assert.equal(entry.isFile(), true); await include(`${path}/${entry.name}`); }
    }
  }
  for (const path of ["package.json", "package-lock.json", "scripts/smoke-runtime.mjs", "scripts/smoke-project-category-move-ui.mjs", "scripts/runtime-evidence.mjs", "scripts/runtime-executable.mjs", "scripts/rename-runtime-startup.mjs", "scripts/runtime-startup.mjs", "scripts/runtime-lifecycle.mjs", "scripts/runtime-layout.mjs", "tests/fixtures/project-category-move-crash-worker.mjs", "dist/service/project-rename-filesystem.mjs", "dist/service-test-native/project-rename.node", "dist/desktop/main.cjs", "dist/desktop/preload.cjs", "dist/service/settings.mjs", "dist/service/entry.cjs", "node_modules/better-sqlite3/package.json", "node_modules/better-sqlite3/lib/binding.js", `node_modules/better-sqlite3/prebuilds/${process.platform}-${process.arch}.node`]) await include(path);
  for (const path of ["src/contracts", "src/service", "src/desktop", "src/renderer", "dist/renderer", "dist/service/db/migrations", "dist/service/native", "dist/desktop/native"]) await tree(path);
  if (mode === "release") {
    const resources = process.platform === "darwin" ? resolve(dirname(executablePath), "../Resources") : join(dirname(executablePath), "resources");
    async function artifact(path, logicalPath) {
      const info = await lstat(path); assert.equal(info.isSymbolicLink(), false);
      if (info.isDirectory()) {
        for (const name of (await readdir(path)).sort()) await artifact(join(path, name), `${logicalPath}/${name}`);
      } else {
        assert.equal(info.isFile(), true);
        hashes[logicalPath] = createHash("sha256").update(await readFile(path)).digest("hex");
        digest.update(logicalPath).update("\0").update(hashes[logicalPath]).update("\0");
      }
    }
    for (const path of ["app.asar", "app.asar.unpacked", "native"]) await artifact(join(resources, path), `packaged/${path}`);
  }
  return { inputs: { mode, platform: process.platform, arch: process.arch, node: process.version,
    sourceRevision: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(), inputDigest: digest.digest("hex") }, hashes };
}

export async function runProjectCategoryMoveUi(mode = "dev") {
  assert.ok(["dev", "release"].includes(mode));
  const executablePath = mode === "dev" ? createRequire(import.meta.url)("electron") : packagedExecutablePath(root, process.platform, process.arch);
  await stat(executablePath);
  const directory = process.env.WORKSPACE_SMOKE_EVIDENCE_DIR ?? join(root, "work", `category-move-ui-${mode}-${Date.now()}`);
  await mkdir(directory, { recursive: true });
  const { inputs, hashes } = await categoryMoveRuntimeInputs(mode, executablePath);
  await writeFile(join(directory, `${mode}-category-move-inputs.json`), JSON.stringify({ inputs, hashes }, null, 2) + "\n");
  const evidence = createCategoryMoveEvidence(inputs), observations = [], shutdowns = [];
  const ownedProcesses = new Set(), backendPids = new Set();
  const fixture = await realpath(await mkdtemp(join(tmpdir(), "workspace-category-move-ui-")));
  let failure, active;
  const save = async () => writeFile(join(directory, `${mode}-category-move-observations.json`), JSON.stringify({
    scope: "grouped production UI/preload/backend moves, rejections and explicit controlled-interruption recovery; final platform acceptance remains separate", inputs,
    status: failure ? "failed" : evidence.fixtureCleanup.status === "passed" ? "passed" : "pending", evidence, observations, shutdowns,
    ...(failure ? { error: failure.message } : {}),
  }, null, 2) + "\n");
  const saveOperationProof = async (language, stage, proof) => writeFile(join(directory, `${mode}-${language}-${stage}-operation-proof.json`),
    JSON.stringify({ kind: "owned_disposable_fixture_proof", inputs, ...proof }, null, 2) + "\n");
  const check = async (target, stage, assertion) => {
    active = { target, stage };
    const details = await assertion() ?? {};
    recordCategoryMoveEvidence(target, stage, { status: "passed", asserted: true, ...details });
    active = undefined; await save();
  };
  const startup = createRenameRuntimeStartup({ launchElectron: options => _electron.launch(options), ownedProcesses, backendPids,
    recordStartup: async outcome => { observations.push({ startup: outcome }); await save(); } });
  async function launch(data) {
    const page = await startup.launch({ executablePath, args: mode === "dev" ? [root] : [], cwd: root, env: { ...process.env, WORKSPACE_USER_DATA_DIR: data }, timeout: 30000 });
    await check(evidence, "isolation", async () => {
      assert.deepEqual(await startup.current.electron.evaluate(({ BrowserWindow, app }) => {
        const p = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
        return { contextIsolation: p.contextIsolation, nodeIntegration: p.nodeIntegration, sandbox: p.sandbox, userData: app.getPath("userData"), sessionData: app.getPath("sessionData") };
      }), { contextIsolation: true, nodeIntegration: false, sandbox: true, userData: data, sessionData: data });
      assert.equal(await page.evaluate(() => typeof process), "undefined"); assert.equal(await page.evaluate(() => typeof require), "undefined");
    });
    return page;
  }
  async function shutdown() {
    const closing = startup.current; startup.clearCurrent();
    const outcome = { passed: false }; shutdowns.push(outcome);
    try {
      await closeRuntimeSession(closing.electron, { shutdown: outcome, readBackendPids: startup.readBackendPids, beforeClose: save,
        assertBackendsStopped: async pids => {
          for (const pid of pids) await withDeadline((async () => {
            for (let attempt = 0; attempt < 50; attempt++) {
              try { process.kill(pid, 0); } catch (error) { if (error.code === "ESRCH") return; throw error; }
              await new Promise(done => setTimeout(done, 100));
            }
            throw new Error("Category move backend survived normal quit");
          })(), 5000, "Category move backend exit");
        } });
    } catch (error) { recordCategoryMoveEvidence(evidence, "normalShutdown", { status: "failed", reason: error.message, forcedCleanup: error.forcedCleanup }); throw error; }
    await save();
  }
  async function select(page, workspace, language) {
    await page.locator("#interface-language").selectOption(language);
    await page.waitForFunction(lang => globalThis.document.documentElement.lang === lang && !globalThis.document.querySelector("#interface-language")?.disabled, language);
    await page.locator("#workspace-switcher").selectOption(workspace.workspaceId);
    await page.getByRole("heading", { name: workspace.name, exact: true }).waitFor();
    await page.waitForFunction(() => globalThis.document.querySelector(".table-view")?.getAttribute("aria-busy") === "false" && globalThis.document.querySelector(".category-move-operations")?.getAttribute("aria-busy") === "false");
  }
  async function capture(page, language, state) {
    for (const size of [{ width: 1440, height: 960 }, { width: 1024, height: 720 }, { width: 420, height: 800 }]) {
      await page.setViewportSize(size);
      const layout = await measureDiscoveryLayout(page);
      assert.equal(layout.document, false); assert.deepEqual(layout.clippedControls, []);
      for (const button of await page.locator(".project-category-move button, .project-category-move select, .category-move-review button").all()) {
        const reachable = await button.evaluate(async node => {
          node.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
          await new Promise(done => globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(done)));
          const r = node.getBoundingClientRect();
          return r.left >= 0 && r.right <= globalThis.innerWidth && r.top >= 0 && r.bottom <= globalThis.innerHeight;
        });
        assert.equal(reachable, true, "Reachable category move control");
      }
      observations.push({ layout: { language, state, viewport: size, ...layout } });
      await page.screenshot({ path: join(directory, `${mode}-${language}-${state}-${size.width}.png`), fullPage: true });
    }
    await save();
  }
  async function preserved(page, setup, categoryName) {
    const list = await query(page, "listProjects", setup.workspace.workspaceId);
    const category = setup.projection.categories.find(c => c.name === categoryName); assert.ok(category);
    const project = list.projects.find(p => p.projectId === setup.project.projectId); assert.ok(project);
    assert.equal(project.name, setup.project.name); assert.equal(project.categoryId, category.categoryId);
    assert.equal(project.relativePath, `${categoryName}/${setup.project.name}`);
    assert.deepEqual(list.projects.filter(p => p.projectId !== project.projectId), setup.projection.projects.filter(p => p.projectId !== project.projectId));
    assert.deepEqual(list.retainedProjects, []); assert.deepEqual(list.categories, setup.projection.categories);
    assert.deepEqual(list.categoryProperty, setup.projection.categoryProperty); assert.equal(list.categoryPropertyRevision, setup.projection.categoryPropertyRevision);
    assert.deepEqual(await query(page, "listTextProperties", setup.workspace.workspaceId), setup.properties);
    assert.deepEqual(await categoryMoveInventory(join(setup.sourceRoot, categoryName, setup.project.name)), setup.projectTree);
    assert.equal((await readdir(join(setup.sourceRoot, categoryName))).includes(setup.project.name), true, "Exact basename spelling");
    const expectedTree = structuredClone(setup.tree);
    if (categoryName !== "Current") {
      const original = expectedTree.children.find(([name]) => name === "Current")[1];
      const destination = expectedTree.children.find(([name]) => name === categoryName)[1];
      destination.children.push(original.children.pop()); destination.children.sort(([a], [b]) => a.localeCompare(b));
    }
    assert.deepEqual(await categoryMoveInventory(setup.sourceRoot), expectedTree);
    assert.deepEqual(await categoryMoveInventory(setup.otherRoot), setup.otherTree);
    assert.deepEqual(await query(page, "listProjects", setup.other.workspaceId), setup.otherProjection);
    assert.deepEqual(await query(page, "listTextProperties", setup.other.workspaceId), setup.otherProperties);
    assert.deepEqual((await query(page, "load")).workspaces, setup.configurations.workspaces);
    const metadata = await categoryMoveMetadata(setup.database);
    const expectedMetadata = structuredClone(setup.metadata);
    const storedProject = expectedMetadata.projects.find(p => p.id === setup.project.projectId);
    storedProject.category_id = category.categoryId; storedProject.relative_path = project.relativePath;
    expectedMetadata.sources.find(s => s.id === setup.workspace.sourceId).discovery_revision = list.revision;
    assert.deepEqual(metadata, expectedMetadata);
    return list;
  }
  async function openEditor(page, setup, t) {
    const list = await query(page, "listProjects", setup.workspace.workspaceId);
    const project = list.projects.find(p => p.projectId === setup.project.projectId);
    const cell = await assertRuntimeCategoryCell(page, project.name, project.categoryName, t.move);
    const trigger = cell.getByRole("button", { name: `${t.move}: ${setup.project.name}`.replace(/\s+/g, " ").trim(), exact: true });
    await trigger.press("Enter");
    const input = page.locator("#project-category-move-destination"); await input.waitFor();
    await page.waitForFunction(() => { const node = globalThis.document.querySelector("#project-category-move-destination"); return node && !node.disabled && node === globalThis.document.activeElement; }, undefined, { timeout: 15000 });
    return input;
  }
  async function closeEditor(page) {
    const input = page.locator("#project-category-move-destination");
    if (await input.count()) await page.locator(".project-category-move form button[type=button]").press("Enter");
    await input.waitFor({ state: "detached" });
  }
  try {
    for (const language of ["en", "ru"]) {
      const target = evidence[language], t = labels[language];
      console.info(`Category move ${mode}: ${language} grouped moves/rejections/restart`);
      let setup;
      await check(target, "seed", async () => { setup = await seedCategoryMoveFixture(join(fixture, language)); return { realSQLite: true, noFollowTree: true }; });
      let page = await launch(setup.data); await select(page, setup.workspace, language);
      setup.metadata.settings = (await categoryMoveMetadata(setup.database)).settings;
      await check(target, "readOnlyReopen", async () => {
        await preserved(page, setup, "Current");
        assert.deepEqual((await query(page, "listProjectCategoryMoves", setup.workspace.workspaceId)).operations, []);
        await assertRuntimeCategoryCell(page, setup.project.name, "Current", t.move);
      });
      await page.evaluate(() => { globalThis.categoryMoveEvents = []; globalThis.window.workspace.onWorkspaceChange(event => { if (event.type === "workspace.projectsChanged") globalThis.categoryMoveEvents.push(event); }); });
      const destination = setup.projection.categories.find(c => c.name === "Destination");
      await check(target, "submission", async () => {
        const input = await openEditor(page, setup, t); await input.selectOption(destination.categoryId);
        await capture(page, language, "editing");
        const before = await captureRuntimeCategoryState(page, setup);
        const binding = runtimeCategoryBinding(before, setup.project.projectId, destination.categoryId);
        assert.equal(await page.locator("#workspace-switcher").inputValue(), binding.workspaceId);
        assert.equal(await input.inputValue(), binding.destinationCategoryId);
        await saveOperationProof(language, "submission", { binding, before });
        const ids = await recordRuntimeCategoryAction(page, async () => { await input.press("Enter"); await input.waitFor({ state: "detached" }); });
        assert.equal(ids.length, 1, "One ID from the authored move Enter");
        const row = expectedRuntimeCategoryRow(before, binding, ids[0], "completed");
        const receipt = await assertRuntimeCategoryAcknowledgment(page, language, "completed", async () => {
          let receipt, after;
          for (let count = 0; count < 2; count++) {
            const state = await captureRuntimeCategoryState(page, setup);
            assertRuntimeCategoryJournal(before.durable.journal, state.durable.journal, row);
            receipt = assertRuntimeCategoryReceipt(await page.evaluate(input => globalThis.window.workspace.workspace(input),
              { type: "workspace.getProjectCategoryMove", workspaceId: binding.workspaceId, operationId: ids[0] }), row);
            const list = await preserved(page, setup, "Destination"); assert.equal(list.revision, binding.expectedRevision + 1);
            assert.deepEqual(state.sibling, { ...list, workspaceId: setup.sibling.workspaceId });
            assertMoveEvents(before.events, state.events, binding.sourceId, binding.expectedRevision + 1, [setup.workspace.workspaceId, setup.sibling.workspaceId]);
            assert.deepEqual(state.text, before.text); assert.deepEqual(state.siblingText, before.siblingText);
            assert.deepEqual(state.otherText, before.otherText); assert.deepEqual(state.settings, before.settings);
            assert.deepEqual(state.configurations, before.configurations);
            if (after) assert.deepEqual(state, after, "Repeated proof cannot create another operation or effect");
            after = state;
            await saveOperationProof(language, "submission", { binding, operationId: ids[0], expectedRow: row, before, after, receipt, readOnlyProofs: count + 1 });
          }
          return receipt;
        });
        return { operationId: ids[0], outcome: "completed", receipt, durableProof: true, submissions: 1, readOnlyProofs: 2 };
      });
      await check(target, "currentCategory", async () => {
        const input = await openEditor(page, setup, t); await input.selectOption(destination.categoryId);
        const before = await captureRuntimeCategoryState(page, setup);
        const binding = runtimeCategoryBinding(before, setup.project.projectId, destination.categoryId);
        assert.equal(await page.locator("#workspace-switcher").inputValue(), binding.workspaceId);
        assert.equal(await input.inputValue(), binding.destinationCategoryId);
        await saveOperationProof(language, "current-category", { binding, before });
        const ids = await recordRuntimeCategoryAction(page, async () => { await input.press("Enter"); await input.waitFor({ state: "detached" }); });
        assert.equal(ids.length, 1, "One ID from the authored current-category Enter");
        const receipt = await assertRuntimeCategoryAcknowledgment(page, language, "unchanged", async () => {
          let receipt;
          for (let count = 0; count < 2; count++) {
            const result = await page.evaluate(input => globalThis.window.workspace.workspace(input),
              { type: "workspace.getProjectCategoryMove", workspaceId: binding.workspaceId, operationId: ids[0] });
            const after = await captureRuntimeCategoryState(page, setup);
            await saveOperationProof(language, "current-category", { binding, operationId: ids[0], before, after, result, readOnlyProofs: count + 1 });
            receipt = assertRuntimeCategoryUnchanged(before, after, binding, ids[0], result);
          }
          return receipt;
        });
        await preserved(page, setup, "Destination"); await capture(page, language, "unchanged");
        return { operationId: ids[0], outcome: "unchanged", expectedRevision: binding.expectedRevision, completedRevision: binding.expectedRevision,
          receipt, durableProof: true, submissions: 1, readOnlyProofs: 2, noEffects: true };
      });
      await check(target, "occupied", async () => {
        const before = await query(page, "listProjects", setup.workspace.workspaceId);
        const input = await openEditor(page, setup, t); const category = setup.projection.categories.find(c => c.name === "Occupied");
        await input.selectOption(category.categoryId); await input.press("Enter"); await page.getByText(t.occupied, { exact: true }).waitFor();
        assert.equal(await input.inputValue(), category.categoryId); await capture(page, language, "occupied");
        assert.deepEqual(await query(page, "listProjects", setup.workspace.workspaceId), before);
        await preserved(page, setup, "Destination"); await closeEditor(page);
      });
      await check(target, "unavailable", async () => {
        const input = await openEditor(page, setup, t); const category = setup.projection.categories.find(c => c.name === "Unavailable");
        await input.selectOption(category.categoryId);
        // Move only this owned empty category outside the selected root while
        // the editor is open. No permissions/global or production seam changes.
        const from = join(setup.sourceRoot, category.name), to = join(setup.data, "unavailable-category");
        const beforeTree = await categoryMoveInventory(setup.sourceRoot);
        await rename(from, to);
        const beforeSubmit = await categoryMoveInventory(setup.sourceRoot);
        await input.press("Enter");
        // Production revalidates the selected unavailable destination. A later
        // observer update may reset an unsubmitted editor; it must not move.
        await page.getByText(t.unavailable, { exact: true }).waitFor();
        assert.deepEqual(await categoryMoveInventory(setup.sourceRoot), beforeSubmit);
        await capture(page, language, "unavailable"); await closeEditor(page);
        await rename(to, from);
        assert.deepEqual(await categoryMoveInventory(setup.sourceRoot), beforeTree);
        await page.getByRole("button", { name: language === "en" ? "Refresh source" : "Обновить источник", exact: true }).press("Enter");
        await page.waitForFunction(() => globalThis.document.querySelector(".table-view")?.getAttribute("aria-busy") === "false");
      });
      await check(target, "sibling", async () => {
        await select(page, setup.sibling, language);
        await assertRuntimeCategoryCell(page, setup.project.name, "Destination", t.move);
        const list = await query(page, "listProjects", setup.sibling.workspaceId);
        assert.equal(list.projects.find(p => p.projectId === setup.project.projectId).categoryId, destination.categoryId);
        assert.deepEqual(await query(page, "listTextProperties", setup.sibling.workspaceId), { ...setup.properties, workspaceId: setup.sibling.workspaceId });
        await select(page, setup.workspace, language);
      });
      await check(target, "preservation", async () => { await preserved(page, setup, "Destination"); });
      await check(target, "layout", async () => {
        await assertRuntimeCategoryCell(page, setup.project.name, "Destination", t.move);
        await capture(page, language, "saved");
      });
      const settings = unwrap(await page.evaluate(() => globalThis.window.workspace.settings({ type: "settings.load" })));
      await shutdown(); page = await launch(setup.data); await select(page, setup.workspace, language);
      await check(target, "restartPersistence", async () => {
        await preserved(page, setup, "Destination"); await assertRuntimeCategoryCell(page, setup.project.name, "Destination", t.move);
        assert.deepEqual(unwrap(await page.evaluate(() => globalThis.window.workspace.settings({ type: "settings.load" }))), settings);
        assert.deepEqual((await query(page, "listProjectCategoryMoves", setup.workspace.workspaceId)).operations, []);
        assert.equal((await query(page, "load")).activeWorkspace.viewId, setup.workspace.viewId);
      });
      await shutdown();
      for (const [checkpoint, recovery] of Object.entries(target.recovery)) {
        console.info(`Category move ${mode}: ${language} controlled preparation ${checkpoint}, read-only startup and explicit recovery`);
        let setup;
        await check(recovery, "preparation", async () => {
          setup = await seedCategoryMoveFixture(join(fixture, `${language}-${checkpoint}`));
          const { openSettingsService } = await import("../dist/service/settings.mjs");
          const service = openSettingsService(setup.database);
          try {
            unwrap(service.handleCommand({ type: "settings.setLanguage", language }));
            unwrap(service.handleCommand({ type: "workspace.activate", workspaceId: setup.sibling.workspaceId }));
          } finally { service.close(); }
          setup.metadata = await categoryMoveMetadata(setup.database);
          setup.request = { type: "workspace.moveProjectCategory", workspaceId: setup.workspace.workspaceId, projectId: setup.project.projectId,
            operationId: randomUUID(), destinationCategoryId: setup.projection.categories.find(c => c.name === "Destination").categoryId, expectedRevision: setup.projection.revision };
          return interruptCategoryMoveFixture(setup, checkpoint === "keep_original" ? "intent" : checkpoint, ownedProcesses);
        });
        const before = await recoveryState(setup);
        let page = await launch(setup.data); await select(page, setup.sibling, language);
        const status = () => query(page, "getProjectCategoryMove", setup.sibling.workspaceId, { operationId: setup.request.operationId });
        let originalStatus;
        await check(recovery, "restartNoReplay", async () => {
          originalStatus = await status();
          assert.equal(originalStatus.operation.stage, recovery.preparation.stage);
          assert.equal(originalStatus.outcome, checkpoint === "commit" ? "completed" : "recoverable");
          const operation = originalStatus.operation;
          assert.equal(operation.operationId, setup.request.operationId); assert.equal(operation.projectId, setup.project.projectId);
          assert.equal(operation.sourceId, setup.workspace.sourceId); assert.equal(operation.initiatingWorkspaceId, setup.workspace.workspaceId);
          assert.equal(operation.name, setup.project.name); assert.equal(operation.originalCategoryId, setup.project.categoryId);
          assert.equal(operation.destinationCategoryId, setup.request.destinationCategoryId);
          assert.equal(operation.originalRelativePath, `Current/${setup.project.name}`);
          assert.equal(operation.requestedRelativePath, `Destination/${setup.project.name}`);
          assert.equal(operation.expectedRevision, setup.projection.revision);
          await page.evaluate(() => { globalThis.categoryMoveEvents = []; globalThis.window.workspace.onWorkspaceChange(event => { if (event.type === "workspace.projectsChanged") globalThis.categoryMoveEvents.push(event); }); });
          const assertNoReplay = async () => {
            const list = await query(page, "listProjectCategoryMoves", setup.sibling.workspaceId);
            assert.equal(list.workspaceId, setup.sibling.workspaceId); assert.equal(list.sourceId, setup.workspace.sourceId);
            assert.deepEqual(list.operations, checkpoint === "commit" ? [] : [originalStatus.operation]);
            const projects = await query(page, "listProjects", setup.sibling.workspaceId);
            assert.equal([...projects.projects, ...projects.retainedProjects].filter(project => project.projectId === setup.project.projectId).length, 1);
            assert.deepEqual(await status(), originalStatus);
            assert.deepEqual(await query(page, "listTextProperties", setup.sibling.workspaceId), { ...setup.properties, workspaceId: setup.sibling.workspaceId });
            assert.deepEqual(await query(page, "listProjects", setup.other.workspaceId), setup.otherProjection);
            assert.deepEqual(await recoveryState(setup), before, "UI startup/list/status did not replay or write durable state");
          };
          // Drive the production list and status controls, as well as repeated
          // public reads. Neither control is authorized to recover automatically.
          await page.getByRole("button", { name: language === "en" ? "Reload interrupted category moves" : "Обновить прерванные перемещения", exact: true }).press("Enter");
          await page.waitForFunction(() => globalThis.document.querySelector(".category-move-operations")?.getAttribute("aria-busy") === "false");
          if (checkpoint !== "commit") {
            await page.getByRole("button", { name: `${language === "en" ? "Check category move status" : "Проверить статус перемещения в категорию"}: ${operation.originalRelativePath}`.replace(/\s+/g, " ").trim(), exact: true }).press("Enter");
            await page.waitForFunction(() => globalThis.document.querySelector(".category-move-operations")?.getAttribute("aria-busy") === "false");
          }
          for (let count = 0; count < 2; count++) await assertNoReplay();
          assert.deepEqual(await page.evaluate(() => globalThis.categoryMoveEvents), []);
          await shutdown(); page = await launch(setup.data); await select(page, setup.sibling, language);
          await assertNoReplay();
        });
        let resolvedStatus;
        await page.evaluate(() => { globalThis.categoryMoveEvents = []; globalThis.window.workspace.onWorkspaceChange(event => { if (event.type === "workspace.projectsChanged") globalThis.categoryMoveEvents.push(event); }); });
        await check(recovery, "resolution", async () => {
          if (checkpoint === "commit") {
            resolvedStatus = await status(); assert.deepEqual(resolvedStatus, originalStatus);
            assert.equal(await page.locator(".category-move-review").count(), 0);
            assert.equal(await page.locator(".category-move-operations button").count(), 1, "Terminal commit offers reload only, no recovery mutation");
            return { action: null, outcome: "completed", mutationRequired: false };
          }
          const action = checkpoint === "keep_original" ? "keep_original" : checkpoint === "intent" ? "retry_original" : "complete_destination";
          const reviewName = `${language === "en" ? "Review interrupted category move" : "Проверить прерванное перемещение"}: ${originalStatus.operation.originalRelativePath} → ${originalStatus.operation.requestedRelativePath}`.replace(/\s+/g, " ").trim();
          await page.getByRole("button", { name: reviewName, exact: true }).press("Enter");
          const actionName = {
            en: { retry_original: "Retry original category move", complete_destination: "Complete destination category move", keep_original: "Keep original category folder" },
            ru: { retry_original: "Повторить исходное перемещение", complete_destination: "Подтвердить перемещение в категорию назначения", keep_original: "Сохранить папку в исходной категории" },
          }[language][action];
          const button = page.locator(".category-move-review").getByRole("button", { name: actionName, exact: true });
          await button.waitFor(); assert.equal(await button.isDisabled(), false);
          assert.equal(await page.locator("#category-move-review-title").evaluate(node => node === globalThis.document.activeElement), true);
          assert.deepEqual(await recoveryState(setup), before, "Fresh UI preview remains read-only");
          await capture(page, language, `recovery-${checkpoint}`);
          const actionBefore = await captureRuntimeCategoryState(page, setup, setup.sibling.workspaceId);
          const bound = before.journal.find(row => row.operation_id === setup.request.operationId); assert.ok(bound);
          const kept = checkpoint === "keep_original";
          const row = { ...bound, stage: kept ? "failed" : "completed", result_kind: kept ? "rejected" : "completed",
            destination_identity: kept ? bound.destination_identity : bound.native_identity, last_verified_placement: kept ? "original" : "destination",
            problem: kept ? "kept_original" : null, completed_revision: kept ? null : setup.projection.revision + 1 };
          assert.equal(await page.locator("#workspace-switcher").inputValue(), setup.sibling.workspaceId);
          await saveOperationProof(language, `recovery-${checkpoint}`, { action, operationId: row.operation_id, expectedRow: row, before: actionBefore });
          const ids = await recordRuntimeCategoryAction(page, async () => { await button.press("Enter"); await page.locator(".category-move-review").waitFor({ state: "detached" }); });
          assert.deepEqual(ids, [], "One chosen recovery Enter uses the existing operation, no new move ID");
          const prove = async () => {
            let receipt, after;
            for (let count = 0; count < 2; count++) {
              const result = await page.evaluate(input => globalThis.window.workspace.workspace(input),
                { type: "workspace.getProjectCategoryMove", workspaceId: setup.sibling.workspaceId, operationId: setup.request.operationId });
              const state = await captureRuntimeCategoryState(page, setup, setup.sibling.workspaceId);
              await saveOperationProof(language, `recovery-${checkpoint}`, { action, operationId: row.operation_id, expectedRow: row,
                before: actionBefore, after: state, result, readOnlyProofs: count + 1 });
              assertRuntimeCategoryJournal(actionBefore.durable.journal, state.durable.journal, row, true);
              if (kept) {
                receipt = assertRuntimeCategoryKeptOriginal(actionBefore, state, row, result, setup.projection);
              } else {
                receipt = assertRuntimeCategoryReceipt(result, row);
                await preserved(page, setup, "Destination");
                assertMoveEvents(actionBefore.events, state.events, row.source_id, row.completed_revision, [setup.workspace.workspaceId, setup.sibling.workspaceId]);
                assert.deepEqual(state.sibling, { ...await query(page, "listProjects", setup.workspace.workspaceId), workspaceId: setup.sibling.workspaceId });
                assert.deepEqual(state.text, actionBefore.text); assert.deepEqual(state.siblingText, actionBefore.siblingText);
                assert.deepEqual(state.otherText, actionBefore.otherText); assert.deepEqual(state.settings, actionBefore.settings);
                assert.deepEqual(state.configurations, actionBefore.configurations);
              }
              if (after) assert.deepEqual(state, after, "Repeated recovery proof remains read-only");
              after = state;
            }
            return receipt;
          };
          if (kept) {
            resolvedStatus = await prove();
            await page.getByText(language === "en" ? "Original category folder retained. Category move resolved." : "Папка сохранена в исходной категории. Перемещение разрешено.", { exact: true }).waitFor();
          } else resolvedStatus = await assertRuntimeCategoryAcknowledgment(page, language, "completed", prove);
          assert.deepEqual((await query(page, "listProjectCategoryMoves", setup.sibling.workspaceId)).operations, []);
          return { action, outcome: resolvedStatus.outcome, mutationRequired: true, freshAdvertisedAction: true,
            operationId: row.operation_id, receipt: resolvedStatus, durableProof: true, submissions: 1, readOnlyProofs: 2 };
        });
        const placement = checkpoint === "keep_original" ? "Current" : "Destination";
        await check(recovery, "preservation", async () => {
          const list = await preserved(page, setup, placement);
          assert.equal(list.revision, setup.projection.revision + (checkpoint === "keep_original" ? 0 : 1));
          const sibling = await query(page, "listProjects", setup.sibling.workspaceId);
          assert.deepEqual(sibling, { ...list, workspaceId: setup.sibling.workspaceId });
          await assertRuntimeCategoryCell(page, setup.project.name, placement, t.move);
        });
        const finalState = await recoveryState(setup);
        await shutdown(); page = await launch(setup.data); await select(page, setup.sibling, language);
        await check(recovery, "restartPersistence", async () => {
          await preserved(page, setup, placement); await assertRuntimeCategoryCell(page, setup.project.name, placement, t.move);
          assert.deepEqual(await status(), resolvedStatus);
          assert.deepEqual((await query(page, "listProjectCategoryMoves", setup.workspace.workspaceId)).operations, []);
          assert.deepEqual(await recoveryState(setup), finalState);
          assert.equal((await query(page, "load")).activeWorkspace.viewId, setup.sibling.viewId);
        });
        await shutdown();
      }
    }
    assert.ok(shutdowns.length >= 34 && shutdowns.every(outcome => outcome.passed && !outcome.forcedCleanup));
    recordCategoryMoveEvidence(evidence, "normalShutdown", { status: "passed", asserted: true, normalQuit: true, backendExit: true, forcedCleanup: false, invocations: shutdowns.length });
    const finalInputs = (await categoryMoveRuntimeInputs(mode, executablePath)).inputs;
    assert.deepEqual(finalInputs, inputs, "Runtime inputs stayed unchanged for the entire fixture");
  } catch (error) {
    failure = error;
    if (active) recordCategoryMoveEvidence(active.target, active.stage, { status: "failed", reason: error.message });
    if (startup.current?.page) await startup.current.page.screenshot({ path: join(directory, `${mode}-category-move-failed.png`), fullPage: true, timeout: 3000 }).catch(() => {});
    await save().catch(() => {});
  } finally {
    if (startup.current) { try { await shutdown(); } catch (error) { failure ??= error; } }
    await cleanupOwnedFixture(fixture, { processesStopped: ownedProcessesStopped(ownedProcesses, backendPids, { launchUnverified: startup.launchUnverified }), primaryFailure: failure,
      record: async outcome => {
        if (outcome.status === "passed") await assert.rejects(stat(fixture), { code: "ENOENT" });
        recordCategoryMoveEvidence(evidence, "fixtureCleanup", { ...outcome, removed: outcome.status === "passed" });
        try { if (!failure) assertCategoryMoveAcceptance(evidence, inputs); } catch (error) { failure = error; }
        await save(); if (failure) throw failure;
      } });
  }
  assertCategoryMoveAcceptance(evidence, inputs);
  console.info(`Graphical category move ${mode} grouped EN/RU slice passed; evidence ${directory}`);
}
