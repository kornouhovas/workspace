// A destination comes only from the backend's fresh options and an explicit zone.
export function resolveStatusDrop(options, statusValueId, pending) {
  if (pending || !statusValueId || !options) return null;
  return options.find(option => option.id === statusValueId && !option.current && !option.disabledReason && option.to) ?? null;
}
