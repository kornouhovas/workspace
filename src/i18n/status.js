const noStatusValueId = "statusValue:no-status";

export function getStatusDisplayName(t, status) {
  if (status.source === "no-status" || status.id === noStatusValueId) {
    return t("property.noStatus");
  }

  return status.name || "";
}
