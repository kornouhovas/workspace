export const TABLE_COLUMN_WIDTH_MIN = 132;

export function normalizeTableColumnWidth(width, fallback = TABLE_COLUMN_WIDTH_MIN) {
  return typeof width === 'number' && Number.isFinite(width)
    ? Math.max(TABLE_COLUMN_WIDTH_MIN, width) : fallback;
}

export function normalizeTableColumnWidths(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([id, width]) =>
    id.length > 0 && typeof width === 'number' && Number.isFinite(width) && width >= TABLE_COLUMN_WIDTH_MIN));
}

// Local drafts cover service snapshots read while a write is pending. Targets are
// captured by each gesture; acknowledgements never activate or refresh a view.
export function createTableColumnWidthQueue(save) {
  const drafts = new Map();
  let queue = Promise.resolve();
  const confirmed = new Map();
  const versions = new Map();
  const keyOf = target => JSON.stringify([target.workspaceId, target.viewId]);
  return {
    read(target, persisted) {
      return { ...normalizeTableColumnWidths(persisted), ...drafts.get(keyOf(target)) };
    },
    preview(target, propertyId, width) {
      const key = keyOf(target);
      const versionKey = JSON.stringify([key, propertyId]);
      versions.set(versionKey, (versions.get(versionKey) || 0) + 1);
      drafts.set(key, { ...drafts.get(key), [propertyId]: normalizeTableColumnWidth(width) });
    },
    commit(target, propertyId, width, previousWidth) {
      const key = keyOf(target), versionKey = JSON.stringify([key, propertyId]);
      if (!confirmed.has(versionKey)) confirmed.set(versionKey, previousWidth);
      this.preview(target, propertyId, width);
      const version = versions.get(versionKey);
      const operation = queue.then(() =>
        save(target, { [propertyId]: normalizeTableColumnWidth(width) }));
      queue = operation.catch(() => {});
      return operation.then(result => {
        confirmed.set(versionKey, normalizeTableColumnWidth(width));
        return result;
      }, error => {
        if (versions.get(versionKey) === version) this.preview(target, propertyId, confirmed.get(versionKey));
        throw error;
      });
    },
  };
}
