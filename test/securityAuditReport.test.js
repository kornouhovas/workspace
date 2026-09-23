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
  "Рекомендуемые follow-up задачи",
  "Итоговый handoff",
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

function parseRiskRegister(report) {
  const riskRegister = report.match(/^## Risk register\s*$([\s\S]*?)(?=^##\s)/m)?.[1] ?? "";
  return [...riskRegister.matchAll(
    /^\| (P\d+) \| ([^|]+) \| (Critical|High|Medium|Low|Informational) \| ([^|]+) \| (Open|Accepted|Mitigated|False positive) \|$/gm,
  )].map((row) => ({
    priority: row[1],
    ids: [...row[2].matchAll(/SEC-\d{3}/g)].map((match) => match[0]),
    severity: row[3],
    risk: row[4].trim(),
    status: row[5],
  }));
}

function assertExactFindingCoverage(findings, assignedIds, label) {
  assert.equal(
    new Set(assignedIds).size,
    assignedIds.length,
    `${label} must assign each finding exactly once`,
  );
  assert.deepEqual(
    [...assignedIds].sort(),
    findings.map(({ id }) => id).sort(),
    `${label} must cover every finding exactly once`,
  );
}

function validateRiskRegister(findings, rows) {
  const assignedIds = rows.flatMap(({ ids }) => ids);
  assertExactFindingCoverage(findings, assignedIds, "risk register");

  const findingsById = new Map(findings.map((finding) => [finding.id, finding]));
  for (const row of rows) {
    for (const id of row.ids) {
      const finding = findingsById.get(id);
      assert.equal(row.severity, finding.severity, `${id} severity must match its finding`);
      assert.equal(row.status, finding.status, `${id} status must match its finding`);
    }
  }
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

  assert.equal(findings.length, 34, "all consolidated findings must be parsed");
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

test("risk register validation rejects duplicate assignments", () => {
  const findings = [
    { id: "SEC-001", severity: "Medium", status: "Open" },
    { id: "SEC-002", severity: "Low", status: "Mitigated" },
  ];

  assert.throws(
    () => validateRiskRegister(findings, [
      { ids: ["SEC-001"], severity: "Medium", status: "Open" },
      { ids: ["SEC-002", "SEC-002"], severity: "Low", status: "Mitigated" },
    ]),
    /exactly once/,
  );
});

test("risk register validation rejects stale severity", () => {
  const findings = [
    { id: "SEC-001", severity: "Medium", status: "Open" },
    { id: "SEC-002", severity: "Low", status: "Mitigated" },
  ];

  assert.throws(
    () => validateRiskRegister(findings, [
      { ids: ["SEC-001"], severity: "Low", status: "Open" },
      { ids: ["SEC-002"], severity: "Low", status: "Mitigated" },
    ]),
    /SEC-001 severity/,
  );
});

test("risk register validation rejects stale status", () => {
  const findings = [
    { id: "SEC-001", severity: "Medium", status: "Open" },
    { id: "SEC-002", severity: "Low", status: "Mitigated" },
  ];

  assert.throws(
    () => validateRiskRegister(findings, [
      { ids: ["SEC-001"], severity: "Medium", status: "Open" },
      { ids: ["SEC-002"], severity: "Low", status: "Open" },
    ]),
    /SEC-002 status/,
  );
});

test("exact finding coverage rejects duplicate follow-up assignments", () => {
  assert.throws(
    () => assertExactFindingCoverage(
      [{ id: "SEC-001" }, { id: "SEC-002" }],
      ["SEC-001", "SEC-001", "SEC-002"],
      "follow-up backlog",
    ),
    /exactly once/,
  );
});

test("consolidated audit includes every finding in the risk register and remediation order", async () => {
  const report = await readFile(reportUrl, "utf8");
  const findings = parseFindings(report);
  const riskRegisterRows = parseRiskRegister(report);
  const remediation = report.match(
    /^## Приоритет и безопасный порядок remediation\s*$([\s\S]*?)(?=^##\s)/m,
  )?.[1] ?? "";

  validateRiskRegister(findings, riskRegisterRows);

  const severityCounts = new Map(
    ["High", "Medium", "Low", "Informational"].map((severity) => [
      severity,
      findings.filter((finding) => finding.severity === severity).length,
    ]),
  );
  const summary = `${findings.length} уникальных findings: ${severityCounts.get("High")} High, ${severityCounts.get("Medium")} Medium, ${severityCounts.get("Low")} Low и ${severityCounts.get("Informational")} Informational`;
  assert.match(report, new RegExp(summary));
  assert.match(report, /Critical findings не обнаружены/);
  assert.equal(
    findings.find(({ id }) => id === "SEC-005")?.severity,
    "High",
    "native launch through workspace.reveal must remain classified as High",
  );
  assert.equal(
    findings.find(({ id }) => id === "SEC-019")?.severity,
    "High",
    "privileged file protocol access must remain classified as High",
  );
  assert.equal(
    findings.find(({ id }) => id === "SEC-020")?.severity,
    "Medium",
    "cross-root default view ID collisions must remain classified as Medium",
  );
  assert.equal(
    findings.find(({ id }) => id === "SEC-021")?.severity,
    "Medium",
    "cross-root property and select ID collisions must remain classified as Medium",
  );
  assert.equal(
    findings.find(({ id }) => id === "SEC-022")?.severity,
    "Medium",
    "view routes without current-source authorization must remain classified as Medium",
  );
  for (const [id, message] of [
    ["SEC-008", "same-handler settings lost updates must remain classified as Medium"],
    ["SEC-023", "path-derived project identity collisions must remain classified as Medium"],
    ["SEC-024", "source-root settings loss must remain classified as Medium"],
    ["SEC-025", "status identifier collisions must remain classified as Medium"],
    ["SEC-026", "property lifecycle cascade inconsistency must remain classified as Medium"],
    ["SEC-027", "active-runtime property history loss must remain classified as Medium"],
    ["SEC-028", "unbounded project-tree enumeration must remain classified as Medium"],
    ["SEC-029", "value and history partial commits must remain classified as Medium"],
    ["SEC-030", "same-source workspace scope collapse must remain classified as Medium"],
    ["SEC-031", "view lifecycle partial commits must remain classified as Medium"],
    ["SEC-032", "workspace lifecycle partial commits must remain classified as Medium"],
    ["SEC-033", "property and select reorder partial commits must remain classified as Medium"],
    ["SEC-034", "unbounded IPC and metadata payloads must remain classified as Medium"],
  ]) {
    assert.equal(findings.find((finding) => finding.id === id)?.severity, "Medium", message);
  }
  assert.match(remediation, /SEC-005[\s\S]+SEC-019[\s\S]+SEC-001[\s\S]+SEC-022[\s\S]+SEC-023[\s\S]+SEC-020[\s\S]+SEC-021[\s\S]+SEC-025[\s\S]+SEC-030[\s\S]+SEC-024[\s\S]+SEC-026[\s\S]+SEC-027[\s\S]+SEC-029[\s\S]+SEC-033[\s\S]+SEC-031[\s\S]+SEC-032[\s\S]+SEC-010[\s\S]+SEC-028[\s\S]+SEC-034[\s\S]+SEC-011[\s\S]+SEC-004[\s\S]+SEC-016/);
});

test("second review findings retain concrete active-runtime evidence", async () => {
  const report = await readFile(reportUrl, "utf8");
  const findingsById = new Map(parseFindings(report).map((finding) => [finding.id, finding]));

  assert.match(findingsById.get("SEC-008")?.evidence ?? "", /single handler/);
  assert.match(findingsById.get("SEC-008")?.evidence ?? "", /workspace\.updateFolderRole[\s\S]+workspace\.setActiveWorkspace/);
  assert.match(findingsById.get("SEC-008")?.reproduction ?? "", /Promise\.all[\s\S]+folder role[\s\S]+active Workspace[\s\S]+lost update/);
  assert.match(findingsById.get("SEC-008")?.recommendation ?? "", /settings read-modify-write[\s\S]+single handler[\s\S]+independent settings fields/);
  assert.match(findingsById.get("SEC-023")?.evidence ?? "", /32-bit[\s\S]+14wmu3/);
  assert.match(findingsById.get("SEC-023")?.reproduction ?? "", /Status\/A\(\[&_--B[\s\S]+Status\/A_!% --B/);
  assert.match(findingsById.get("SEC-026")?.evidence ?? "", /deletePropertyResult[\s\S]+PROPERTY_NOT_FOUND/);
  assert.match(findingsById.get("SEC-026")?.recommendation ?? "", /persisted idempotent[\s\S]+injected write failure/);
  assert.match(findingsById.get("SEC-027")?.evidence ?? "", /appendPropertyHistory[\s\S]+properties\.json\.history/);
  assert.match(findingsById.get("SEC-027")?.recommendation ?? "", /targetType[\s\S]+previous\/next snapshots/);
});

test("third review findings retain concrete availability, scope, and atomicity evidence", async () => {
  const report = await readFile(reportUrl, "utf8");
  const findingsById = new Map(parseFindings(report).map((finding) => [finding.id, finding]));

  assert.match(findingsById.get("SEC-028")?.evidence ?? "", /workspace\.scan[\s\S]+includeCardChildren[\s\S]+listWorkspaceAccessTree[\s\S]+workspace\.listEntries[\s\S]+listProjectFileTree[\s\S]+depth[\s\S]+node-count[\s\S]+concurrency/);
  assert.match(findingsById.get("SEC-029")?.evidence ?? "", /saveProjectPropertyValue[\s\S]+appendPropertyHistory[\s\S]+oldValue/);
  assert.match(findingsById.get("SEC-030")?.evidence ?? "", /sourceFolderId[\s\S]+shares object properties across workspaces[\s\S]+deletes custom properties/);
  assert.match(findingsById.get("SEC-031")?.evidence ?? "", /saveView[\s\S]+saveWorkspace[\s\S]+activeViewId/);
});

test("fifth review findings retain filesystem and IPC resource-exhaustion coverage", async () => {
  const report = await readFile(reportUrl, "utf8");
  const findingsById = new Map(parseFindings(report).map((finding) => [finding.id, finding]));
  const backlog = report.match(
    /^## Рекомендуемые follow-up задачи\s*$([\s\S]*?)(?=^##\s)/m,
  )?.[1] ?? "";

  assert.match(findingsById.get("SEC-028")?.affectedFiles ?? "", /src\/App\.tsx[\s\S]+electron\/workspaceIpc\.js[\s\S]+src\/workspaceBackend\.js/);
  assert.match(findingsById.get("SEC-028")?.recommendation ?? "", /scan[\s\S]+listEntries[\s\S]+listProjectFileTree[\s\S]+pagination/);
  assert.match(findingsById.get("SEC-034")?.evidence ?? "", /normalizePayload[\s\S]+normalizeProjectPropertyValue[\s\S]+saveProjectPropertyValue[\s\S]+appendPropertyHistory[\s\S]+JSON\.stringify/);
  assert.match(findingsById.get("SEC-034")?.recommendation ?? "", /per-method[\s\S]+string[\s\S]+array[\s\S]+metadata[\s\S]+rate/);
  assert.match(backlog, /FUP-14:[^\n]+workspace\.scan[\s\S]+workspace\.listEntries[\s\S]+workspace\.listProjectFileTree/);
  assert.match(backlog, /FUP-18:[^\n]+SEC-034[\s\S]+oversized[\s\S]+до persistence/);
});

test("fourth review findings retain concrete workspace and reorder atomicity evidence", async () => {
  const report = await readFile(reportUrl, "utf8");
  const findingsById = new Map(parseFindings(report).map((finding) => [finding.id, finding]));

  assert.match(findingsById.get("SEC-032")?.evidence ?? "", /saveView[\s\S]+saveWorkspace[\s\S]+writeWorkspaceSettings[\s\S]+reorderWorkspaces[\s\S]+deleteWorkspace/);
  assert.match(findingsById.get("SEC-032")?.recommendation ?? "", /stable operation ID[\s\S]+active Workspace[\s\S]+unique order/);
  assert.match(findingsById.get("SEC-033")?.evidence ?? "", /reorderPropertiesResult[\s\S]+saveProperty[\s\S]+reorderSelectValuesResult[\s\S]+saveSelectValue/);
  assert.match(findingsById.get("SEC-033")?.recommendation ?? "", /atomic transaction[\s\S]+stable operation ID[\s\S]+unique order/);
});

test("final audit handoff contains a scoped remediation backlog for every finding", async () => {
  const report = await readFile(reportUrl, "utf8");
  const findings = parseFindings(report);
  const backlog = report.match(
    /^## Рекомендуемые follow-up задачи\s*$([\s\S]*?)(?=^##\s)/m,
  )?.[1] ?? "";
  const rows = [...backlog.matchAll(/^\| (FUP-\d{2}):[^\n]+\| (SEC-[^|]+) \| ([^|]+) \| ([^|]+) \|$/gm)];

  assert.equal(rows.length, 18, "follow-up backlog must keep independent implementation scopes");
  assert.equal(new Set(rows.map((row) => row[1])).size, rows.length, "follow-up task IDs must be unique");

  const coveredIds = rows.flatMap((row) => [
    ...row[2].matchAll(/SEC-\d{3}/g),
  ].map((match) => match[0]));
  assertExactFindingCoverage(findings, coveredIds, "follow-up backlog");

  for (const row of rows) {
    assert.ok(row[3].trim().length > 40, `${row[1]} must define a bounded scope`);
    assert.ok(row[4].trim().length > 40, `${row[1]} must define verification criteria`);
  }
});

test("final audit report is redacted and records the non-production handoff", async () => {
  const report = await readFile(reportUrl, "utf8");
  const handoff = report.match(/^## Итоговый handoff\s*$([\s\S]*?)(?=^##\s)/m)?.[1] ?? "";

  assert.doesNotMatch(report, /(?:\/Users\/|\/home\/|[A-Za-z]:\\\\)/);
  assert.doesNotMatch(report, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/);
  assert.doesNotMatch(report, /\b(?:AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,})\b/);

  for (const statement of [
    "production behavior",
    "API contracts",
    "storage schema",
    "manifests/lockfiles/dependencies",
    "Electron security settings",
    "README.md",
    "AGENTS.md",
    "не выполнялась",
    "human review",
  ]) {
    assert.match(handoff, new RegExp(statement.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }

  assert.equal(parseFindings(report).every(({ status }) => status === "Open"), true);
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
    "file://",
    "GrantFileProtocolExtraPrivileges",
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
