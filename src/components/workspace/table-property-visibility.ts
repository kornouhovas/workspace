import type { WorkspacePropertyDefinitionState } from "@/workspaceAppState";

export function getHiddenTableProperties(
  properties: readonly WorkspacePropertyDefinitionState[],
  visiblePropertyIds: ReadonlySet<string>,
) {
  return properties.filter((property) => (
    !property.hidden &&
    property.id !== "property:name" &&
    !visiblePropertyIds.has(property.id)
  ));
}
