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
  "Сведение и классификация findings",
  "Risk register",
  "Приоритет и безопасный порядок remediation",
  "Положительные security controls",
  "Residual risks",
  "Непроверенные области и ограничения аудита",
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
const allowedStatuses = new Set(["Open", "Accepted", "Mitigated", "False positive"]);
const allowedClasses = new Set([
  "Vulnerability",
  "Defense in depth",
  "Documentation gap",
  "Limitation",
]);
const allowedBoundaries = new Set([
  "TB-01",
  "TB-02",
  "TB-03",
  "TB-04",
  "TB-05",
  "TB-06",
  "TB-07",
]);

function parseFindings(report) {
  const findingsSection = report.match(
    /^## Findings\s*$([\s\S]*?)(?=^##\s|(?![\s\S]))/m,
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
      title: heading[0].replace(/^### SEC-\d{3}: /, "").trim(),
      severity: field("Severity"),
      confidence: field("Confidence"),
      status: field("Status"),
      className: field("Class"),
      cwe: field("CWE"),
      owasp: field("OWASP"),
      trustBoundary: field("Trust boundary"),
      affectedFiles: field("Affected files"),
      evidence: field("Evidence"),
      impact: field("Impact"),
      reproduction: field("Reproduction"),
      recommendation: field("Recommendation"),
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

  assert.equal(findings.length, 18, "all consolidated findings must be parsed");
  assert.equal(new Set(ids).size, ids.length, "finding IDs must be unique");
  assert.equal(new Set(findings.map(({ title }) => title)).size, findings.length, "finding titles must be unique");

  for (const finding of findings) {
    assert.ok(
      allowedSeverities.has(finding.severity),
      `${finding.id} has unsupported severity: ${finding.severity}`,
    );
    assert.ok(
      allowedConfidences.has(finding.confidence),
      `${finding.id} has unsupported confidence: ${finding.confidence}`,
    );
    assert.ok(
      allowedStatuses.has(finding.status),
      `${finding.id} has unsupported status: ${finding.status}`,
    );
    assert.ok(
      allowedClasses.has(finding.className),
      `${finding.id} has unsupported class: ${finding.className}`,
    );
  }
});

test("every finding has actionable evidence and valid repository file references", async () => {
  const report = await readFile(reportUrl, "utf8");
  const findings = parseFindings(report);
  const fileCache = new Map();

  for (const finding of findings) {
    for (const field of ["evidence", "impact", "reproduction", "recommendation"]) {
      assert.ok(finding[field]?.length > 20, `${finding.id} must define ${field}`);
    }

    assert.match(finding.cwe ?? "", /^CWE-\d+$/);
    assert.ok(finding.owasp?.length > 0, `${finding.id} must define OWASP mapping`);

    const boundaries = finding.trustBoundary?.split(",").map((value) => value.trim()) ?? [];
    assert.ok(boundaries.length > 0, `${finding.id} must identify a trust boundary`);
    for (const boundary of boundaries) {
      assert.ok(allowedBoundaries.has(boundary), `${finding.id} has invalid boundary: ${boundary}`);
    }

    const references = [...(finding.affectedFiles ?? "").matchAll(/`([^`]+)`/g)].map((match) => match[1]);
    assert.ok(references.length > 0, `${finding.id} must reference affected files`);

    for (const reference of references) {
      const match = reference.match(/^([^:]+):(\d+)$/);
      assert.ok(match, `${finding.id} has invalid file reference: ${reference}`);
      const [, relativePath, lineText] = match;
      assert.doesNotMatch(relativePath, /^(?:\/|[A-Za-z]:|\.\.\/)/, `${finding.id} uses a non-repository path`);

      if (!fileCache.has(relativePath)) {
        fileCache.set(relativePath, await readFile(new URL(`../${relativePath}`, import.meta.url), "utf8"));
      }
      const lineCount = fileCache.get(relativePath).split(/\r?\n/).length;
      assert.ok(Number(lineText) >= 1 && Number(lineText) <= lineCount, `${finding.id} points outside ${relativePath}`);
    }
  }
});

test("consolidated audit includes every finding in the risk register and remediation order", async () => {
  const report = await readFile(reportUrl, "utf8");
  const findings = parseFindings(report);
  const riskRegister = report.match(/^## Risk register\s*$([\s\S]*?)(?=^##\s)/m)?.[1] ?? "";
  const remediation = report.match(
    /^## Приоритет и безопасный порядок remediation\s*$([\s\S]*?)(?=^##\s)/m,
  )?.[1] ?? "";

  for (const finding of findings) {
    assert.match(riskRegister, new RegExp(`\\b${finding.id}\\b`), `${finding.id} is missing from risk register`);
  }

  assert.match(report, /18 уникальных findings: 1 High, 6 Medium, 6 Low и 5 Informational/);
  assert.match(report, /Critical findings не обнаружены/);
  assert.match(remediation, /SEC-016[\s\S]+SEC-001[\s\S]+SEC-005 и SEC-010[\s\S]+SEC-011/);
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
