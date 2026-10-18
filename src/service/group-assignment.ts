import { isAssignProjectGroupCommand } from "../contracts/group-assignment.js";
import type { ServiceResult } from "../contracts/settings.js";
import { randomUUID } from "node:crypto";
import type { WorkspaceService } from "./workspaces.js";

export function assignProjectGroup(model: WorkspaceService, input: unknown): ServiceResult<import("../contracts/group-assignment.js").GroupAssignmentResult> {
  if (!isAssignProjectGroupCommand(input)) return invalid();
  // All validation and the existing transactional value command run synchronously
  // in the owning backend; no renderer-supplied destination value is trusted.
  const projection = model.filterRequest({ type: "workspace.queryView", workspaceId: input.workspaceId, viewId: input.viewId, archived: input.archived });
  if (!projection.ok) return projection;
  if (!("projectIds" in projection.value) || projection.value.groupPropertyId !== input.propertyId) return invalid();
  const groups = projection.value.groups;
  const origin = groups?.find(group => group.key === input.fromKey);
  const destination = groups?.find(group => group.key === input.toKey);
  if (!origin?.projectIds.includes(input.projectId) || !destination || destination.hidden) return invalid();
  const properties = model.listTextProperties({ type: "workspace.listTextProperties", workspaceId: input.workspaceId });
  if (!properties.ok) return properties;
  const property = properties.value.definitions.find(p => p.propertyId === input.propertyId);
  if (input.propertyId === "name" || !property) {
    // Read current source ownership/revision; a drop never supplies paths or a revision.
    const projects = model.listProjects({type:"workspace.listProjects",workspaceId:input.workspaceId});
    if (!projects.ok) return projects;
    const category = projects.value.categoryProperty?.propertyId === input.propertyId;
    if (input.archived || (input.propertyId !== "name" && !category) || typeof destination.value !== "string" || !destination.value) return invalid();
    const command = {workspaceId:input.workspaceId,projectId:input.projectId,operationId:randomUUID(),expectedRevision:projects.value.revision};
    const result = input.propertyId === "name"
      ? model.renameProject({...command,type:"workspace.renameProject",name:destination.value})
      : model.moveProjectCategory({...command,type:"workspace.moveProjectCategory",destinationCategoryId:destination.value});
    if (!result.ok) return result;
    return {ok:true,value:{snapshot:properties.value,propertyId:input.propertyId,projectId:input.projectId,filesystem:result.value}};
  }

  if (input.fromKey === input.toKey && property && ["text", "number", "date", "single_select", "multi_select"].includes(property.propertyType)) {
    return { ok: true, value: { snapshot: properties.value, propertyId: input.propertyId, projectId: input.projectId } };
  }
  const base = { workspaceId: input.workspaceId, propertyId: input.propertyId, projectId: input.projectId };
  switch (property?.propertyType) {
    case "text": return model.setTextValue({ ...base, type: "workspace.setTextValue", value: destination.value });
    case "number": return model.setNumberValue({ ...base, type: "workspace.setNumberValue", expression: destination.value === null ? null : String(destination.value) });
    case "date": return model.setDateValue({ ...base, type: "workspace.setDateValue", value: destination.value });
    case "single_select": return model.selectCommand({ ...base, type: "workspace.setSelectValue", optionId: destination.value });
    case "multi_select": {
      const current = (properties.value.multiSelectValues ?? [])
        .filter(value => value.propertyId === input.propertyId && value.projectId === input.projectId)
        .map(value => value.optionId);
      const remaining = current.filter(optionId => optionId !== origin.value);
      const optionIds = destination.value === null ? [] : [...new Set([...remaining, String(destination.value)])];
      return model.selectCommand({ ...base, type: "workspace.setMultiSelectValue", optionIds });
    }
    default: return invalid();
  }
}
function invalid(): ServiceResult<never> {
  return { ok: false, error: { code: "invalid_input", message: "The project, grouping or destination changed. Refresh and choose an available group." } };
}
