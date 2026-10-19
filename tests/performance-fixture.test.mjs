import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openSettingsService } from "../dist/service/settings.mjs";
import { createPerformanceFixture } from "../scripts/performance-fixture.mjs";

test("representative fixture reopens two isolated sources with exact typed values, views and unchanged project files", async () => {
  const directory = await mkdtemp(join(tmpdir(), "performance-fixture-test-"));
  let service;
  try {
    const fixture = await createPerformanceFixture(directory, openSettingsService, 8);
    service = openSettingsService(join(fixture.data, "workspace.sqlite"));
    for (const source of fixture.sources) {
      const query = name => {
        const result = service.handleQuery({ type: `workspace.${name}`, workspaceId: source.workspaceId });
        assert.equal(result.ok, true); return result.value;
      };
      assert.equal(query("listProjects").projects.length, 8);
      assert.deepEqual(query("listViews").views.map(v => v.kind), ["table", "board", "table", "board", "table", "board", "table", "board", "table", "board"]);
      const values = query("listTextProperties"), first = source.projects[0].projectId;
      const property = type => source.properties.find(p => p.type === type && p.slot === 0);
      assert.equal(values.definitions.length, 20);
      assert.equal(values.values.find(v => v.projectId === first && v.propertyId === property("text").propertyId).value, "Notes 0 — описание");
      assert.equal(values.numberValues.find(v => v.projectId === first).value, 0);
      assert.equal(values.dateValues.find(v => v.projectId === first).value, "2026-10-01");
      assert.equal(values.selectValues.find(v => v.projectId === first).optionId, property("single_select").options[0]);
      const second = source.projects[1].projectId;
      assert.equal(values.multiSelectValues.filter(v => v.projectId === second).length, 2);
      assert.equal(values.values.some(v => v.projectId === second && v.propertyId === property("text").propertyId), false);
      assert.equal(await readFile(join(source.root, source.projects[0].relativePath, "preserved.txt"), "utf8"), "Keep project contents.\n");
    }
    assert.equal(new Set(fixture.sources.flatMap(s => s.projects.map(p => p.projectId))).size, 16);
  } finally { service?.close(); await rm(directory, { recursive: true, force: true }); }
});
