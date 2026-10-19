import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Only public service commands populate metadata; measured runtime owns a fresh
// reopen of this real database. Never generate fixtures in a user-selected root.
export async function createPerformanceFixture(directory, openService, count = 1000) {
  const data = join(directory, "data"); await mkdir(data);
  const service = openService(join(data, "workspace.sqlite"));
  const unwrap = result => { assert.equal(result.ok, true, result.ok ? undefined : JSON.stringify(result)); return result.value; };
  const sources = [];
  try {
    for (const mode of ["direct", "grouped"]) {
      const root = join(directory, mode); await mkdir(root);
      if (mode === "grouped") for (let i = 0; i < 10; i++) await mkdir(join(root, `Category ${i}`));
      for (let i = 0; i < count; i++) {
        const name = `Project ${String(i).padStart(4, "0")}`;
        const path = join(root, ...(mode === "grouped" ? [`Category ${i % 10}`] : []), name);
        await mkdir(path); await writeFile(join(path, "preserved.txt"), "Keep project contents.\n");
      }
      const workspace = unwrap(service.handleCommand({ type: "workspace.create", rootPath: root, name: mode }));
      const { workspaceId, viewId } = workspace;
      const command = (name, fields = {}) => unwrap(service.handleCommand({ type: `workspace.${name}`, workspaceId, ...fields }));
      const query = (name, fields = {}) => unwrap(service.handleQuery({ type: `workspace.${name}`, workspaceId, ...fields }));
      const preview = query("previewDiscovery", { mode });
      const list = command("applyDiscovery", { previewToken: preview.previewToken });
      assert.equal(list.projects.length, count);
      const projects = [...list.projects].sort((a, b) => a.name.localeCompare(b.name));
      const properties = [];
      for (const type of ["text", "number", "date", "single_select", "multi_select"]) for (let slot = 0; slot < 4; slot++) {
        const propertyId = command("createProperty", { name: `${type} ${slot}`, propertyType: type }).propertyId;
        const options = [];
        if (type.endsWith("select")) for (const name of ["A", "B", "C"]) {
          const snapshot = command("createSelectOption", { propertyId, name, color: "default" }).snapshot;
          options.push(snapshot.selectOptions.find(o => o.propertyId === propertyId && o.name === name).optionId);
        }
        properties.push({ propertyId, type, slot, options });
      }
      // 25% filled per property: each project has one populated field of each
      // type. Empty fields and overlapping memberships are deliberate data.
      for (let i = 0; i < projects.length; i++) for (const p of properties.filter(p => p.slot === i % 4)) {
        const fields = { propertyId: p.propertyId, projectId: projects[i].projectId };
        if (p.type === "text") command("setTextValue", { ...fields, value: `Notes ${i % 10} — описание` });
        if (p.type === "number") command("setNumberValue", { ...fields, expression: String(i) });
        if (p.type === "date") command("setDateValue", { ...fields, value: `2026-10-${String(i % 28 + 1).padStart(2, "0")}` });
        if (p.type === "single_select") command("setSelectValue", { ...fields, optionId: p.options[i % 3] });
        if (p.type === "multi_select") command("setMultiSelectValue", { ...fields, optionIds: p.options.slice(0, i % 2 + 1) });
      }
      for (let i = 1; i < 10; i++) command("createView", { name: `View ${i}`, kind: i % 2 ? "board" : "table" });
      command("activateView", { viewId });
      const views = query("listViews");
      assert.equal(views.views.length, 10); assert.equal(query("listTextProperties").definitions.length, 20);
      sources.push({ mode, root, workspaceId, viewId, projects, properties, views: views.views });
    }
    unwrap(service.handleCommand({ type: "workspace.activate", workspaceId: sources[0].workspaceId }));
    return { count, data, sources };
  } finally { service.close(); }
}
