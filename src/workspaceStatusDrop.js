// A destination comes only from the backend's fresh options and an explicit Status column or group.
export function resolveStatusDrop(options, statusValueId, pending) {
  if (statusValueId === "statusValue:no-status") return null;
  if (pending || !statusValueId || !options) return null;
  return options.find(option => option.id === statusValueId && !option.current && !option.disabledReason && option.to) ?? null;
}
