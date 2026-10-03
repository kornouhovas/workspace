import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../src/components/workspace/table-property-visibility.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { getHiddenTableProperties } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

const properties = [
  { id: "property:name", name: "Project", propertyType: "text", system: true, hidden: false },
  { id: "property:status", name: "Workflow Status", propertyType: "select", system: true, hidden: false },
  { id: "property:text", name: "Text", propertyType: "text", system: false, hidden: false },
  { id: "property:notes", name: "Notes", propertyType: "text", system: false, hidden: false },
  { id: "property:globally-hidden", name: "Archived", propertyType: "text", system: false, hidden: true },
];

// Excluding every system definition loses the existing Status column. Name is
// mandatory, whereas Status participates in the active view's visibility.
test("Table offers the renamed system Status when it is the only hidden view column", () => {
  const hidden = getHiddenTableProperties(properties, new Set(["property:name", "property:text", "property:notes"]));
  assert.deepEqual(hidden.map(({ id, name }) => ({ id, name })), [
    { id: "property:status", name: "Workflow Status" },
  ]);
  assert.strictEqual(hidden[0], properties[1], "restore the existing property definition");
});

test("Table restores Status and custom columns independently across show/hide transitions", () => {
  for (const [visible, expected] of [
    [["property:name", "property:notes"], ["property:status", "property:text"]],
    [["property:name", "property:status", "property:notes"], ["property:text"]],
    [["property:name", "property:status", "property:text", "property:notes"], []],
    [["property:name", "property:text", "property:notes"], ["property:status"]],
  ]) {
    assert.deepEqual(getHiddenTableProperties(properties, new Set(visible)).map(property => property.id), expected);
  }
  assert.deepEqual(properties[1], { id: "property:status", name: "Workflow Status", propertyType: "select", system: true, hidden: false });
});

test("Table never offers required Name or globally hidden definitions for restoration", () => {
  const hidden = getHiddenTableProperties(properties, new Set(["property:status", "property:text", "property:notes"]));
  assert.deepEqual(hidden, []);
});
