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
