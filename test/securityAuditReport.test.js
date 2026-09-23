import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const reportUrl = new URL(
  "../docs/security/20260923-project-security-audit.md",
  import.meta.url,
);

const requiredSections = [
  "Метаданные аудита",
  "Цель и границы аудита",
  "Методика",
  "Активы",
  "Доверительные границы",
  "Источники входных данных",
  "Модель атакующего",
  "Предположения и ограничения",
  "Классификация риска",
  "Шаблон finding",
  "Findings",
  "Electron, renderer и IPC boundary",
  "Filesystem и local metadata boundary",
  "Go sidecar и any-store boundary",
  "Dependencies, secrets и build chain",
  "Матрица покрытия",
  "Правила работы с доказательствами",
  "Журнал проверки",
];

const allowedSeverities = new Set([
  "Critical",
  "High",
  "Medium",
  "Low",
  "Informational",
]);
const allowedConfidences = new Set(["High", "Medium", "Low"]);

function parseFindings(report) {
  const findingsSection = report.match(
    /^## Findings\s*$([\s\S]*?)(?=^##\s|\z)/m,
  )?.[1] ?? "";
  const headings = [...findingsSection.matchAll(/^### (SEC-\d{3}): .+$/gm)];

  return headings.map((heading, index) => {
    const start = heading.index;
    const end = headings[index + 1]?.index ?? findingsSection.length;
    const body = findingsSection.slice(start, end);
    const field = (name) =>
      body.match(new RegExp(`^- ${name}: (.+)$`, "m"))?.[1]?.trim();

    return {
      id: heading[1],
      severity: field("Severity"),
      confidence: field("Confidence"),
    };
  });
}

test("security audit report contains the required baseline sections", async () => {
  const report = await readFile(reportUrl, "utf8");

  for (const section of requiredSections) {
    assert.match(report, new RegExp(`^## ${section}$`, "m"));
  }

  for (const boundary of ["TB-01", "TB-02", "TB-03", "TB-04", "TB-05", "TB-06", "TB-07"]) {
    assert.match(report, new RegExp(`\\| ${boundary} \\|`));
  }

  for (const coverageArea of [
    "Electron shell",
    "Preload и IPC",
    "Renderer boundary",
    "Filesystem",
    "Local metadata",
    "Go sidecar HTTP",
    "any-store/SQLite",
    "Dependencies",
    "Secrets",
    "Build configuration",
  ]) {
    assert.match(report, new RegExp(`\\| ${coverageArea.replace("/", "\\/")} \\|`));
  }

  assert.match(report, /7e5add7eb8da7e23317687a3f3ae74bd7e5d197f/);
  assert.match(report, /Node\.js \| `v20\.18\.3`/);
  assert.match(report, /Go \| `go1\.26\.2 darwin\/arm64`/);
  assert.match(report, /Electron \| `41\.5\.0`/);
});

test("security audit findings have unique IDs and allowed classifications", async () => {
  const report = await readFile(reportUrl, "utf8");
  const findings = parseFindings(report);
  const ids = findings.map(({ id }) => id);

  assert.equal(new Set(ids).size, ids.length, "finding IDs must be unique");

  for (const finding of findings) {
    assert.ok(
      allowedSeverities.has(finding.severity),
      `${finding.id} has unsupported severity: ${finding.severity}`,
    );
    assert.ok(
      allowedConfidences.has(finding.confidence),
      `${finding.id} has unsupported confidence: ${finding.confidence}`,
    );
  }
});

test("security audit defines a complete reusable finding template", async () => {
  const report = await readFile(reportUrl, "utf8");
  const template = report.match(
    /^## Шаблон finding\s*$([\s\S]*?)(?=^##\s)/m,
  )?.[1] ?? "";

  for (const field of [
    "SEC-001",
    "Severity",
    "Confidence",
    "Status",
    "CWE",
    "OWASP",
    "Trust boundary",
    "Affected files",
    "Evidence",
    "Impact",
    "Reproduction",
    "Recommendation",
  ]) {
    assert.match(template, new RegExp(field));
  }
});

test("security audit includes Electron and IPC evidence for Task 2", async () => {
  const report = await readFile(reportUrl, "utf8");
  const section = report.match(
    /^## Electron, renderer и IPC boundary\s*$([\s\S]*?)(?=^##\s)/m,
  )?.[1] ?? "";

  for (const evidence of [
    "contextIsolation",
    "nodeIntegration",
    "sandbox",
    "preload",
    "sender/frame",
    "navigation",
    "permission",
    "Content-Security-Policy",
    "absolute path",
    "error",
    "test/securityControls.test.js",
    "test/rendererBoundary.test.js",
  ]) {
    assert.match(section, new RegExp(evidence.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }

  assert.match(report, /\| Electron shell \|[^\n]+\| Task 2 \| Covered \|/);
  assert.match(report, /\| Preload и IPC \|[^\n]+\| Task 2 \| Covered \|/);
  assert.match(report, /\| Renderer boundary \|[^\n]+\| Task 2 \| Covered \|/);
});

test("security audit includes filesystem and local metadata evidence for Task 3", async () => {
  const report = await readFile(reportUrl, "utf8");
  const section = report.match(
    /^## Filesystem и local metadata boundary\s*$([\s\S]*?)(?=^##\s)/m,
  )?.[1] ?? "";

  for (const evidence of [
    "readFile",
    "writeFile",
    "readdir",
    "rename",
    "rm",
    "stat",
    "realpath",
    "spawn",
    "symlink",
    "TOCTOU",
    "HTML/SVG/XML/JS",
    "atomic",
    "future-schema",
    "concurrent",
    "workspace.deleteWorkspace",
    "test/localOpen.test.js",
    "test/workspaceBackend.test.js",
    "test/workspaceIpc.test.js",
  ]) {
    assert.match(section, new RegExp(evidence.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }

  assert.match(report, /\| Filesystem \|[^\n]+\| Task 3 \| Covered \|/);
  assert.match(report, /\| Local metadata \|[^\n]+\| Task 3 \| Covered \|/);
});

test("security audit includes sidecar and store evidence for Task 4", async () => {
  const report = await readFile(reportUrl, "utf8");
  const section = report.match(
    /^## Go sidecar и any-store boundary\s*$([\s\S]*?)(?=^##\s)/m,
  )?.[1] ?? "";

  for (const evidence of [
    "127.0.0.1:0",
    "authentication/session secret",
    "Origin",
    "HTTP methods",
    "Content-Type",
    "malformed",
    "trailing",
    "body limit",
    "timeout",
    "concurrency",
    "graceful shutdown",
    "workspace",
    "project",
    "property",
    "soft delete",
    "history",
    "SQLite",
    "0644",
    "any-store errors",
    "test/sidecarClient.test.js",
    "cmd/workspace-sidecar/main_test.go",
    "internal/workspacestore/store_test.go",
  ]) {
    assert.match(section, new RegExp(evidence.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }

  assert.match(report, /\| Go sidecar HTTP \|[^\n]+\| Task 4 \| Covered \|/);
  assert.match(report, /\| any-store\/SQLite \|[^\n]+\| Task 4 \| Covered \|/);
});

test("security audit includes dependency, secret, and build-chain evidence for Task 5", async () => {
  const report = await readFile(reportUrl, "utf8");
  const section = report.match(
    /^## Dependencies, secrets и build chain\s*$([\s\S]*?)(?=^##\s)/m,
  )?.[1] ?? "";

  for (const evidence of [
    "package-lock.json",
    "lockfileVersion 3",
    "sha512 integrity",
    "registry.npmjs.org",
    "lifecycle",
    "npm audit --json --omit=dev",
    "npm audit --json",
    "electron",
    "41.5.0",
    "1136584",
    "go list -m -json all",
    "go mod verify",
    "govulncheck",
    "tracked tree",
    "reachable commits",
    "private-key",
    "high-entropy",
    ".workspace/",
    "workspace.db",
    ".ralphex/",
    "Mach-O/ELF/PE",
    "scripts/build-renderer.mjs",
  ]) {
    assert.match(section, new RegExp(evidence.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }

  assert.match(section, /Production,[^\n]+\| 0 \| 8 \| 4 \| 3 \| 15 \|/);
  assert.match(section, /Full,[^\n]+\| 0 \| 11 \| 4 \| 3 \| 18 \|/);
  assert.match(report, /\| Dependencies \|[^\n]+\| Task 5 \| Covered \|/);
  assert.match(report, /\| Secrets \|[^\n]+\| Task 5 \| Covered \|/);
  assert.match(report, /\| Build configuration \|[^\n]+\| Task 5 \| Covered \|/);
});
