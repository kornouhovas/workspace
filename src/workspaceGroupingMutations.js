import { normalizeGrouping } from './workspaceGrouping.js';

// Capture targets and merge against the latest pending draft, not a stale render.
export function createGroupingMutationQueue(save) {
  let queue = Promise.resolve();
  const drafts = new Map();
  return {
    enqueue(target, initial, mutation) {
      const key = JSON.stringify([target.workspaceId, target.viewId]);
      const baseline = JSON.stringify(normalizeGrouping(initial));
      const previous = drafts.get(key);
      const current = previous && (previous.pending > 0 || previous.baseline === baseline)
        ? previous.value : normalizeGrouping(initial);
      const value = normalizeGrouping(typeof mutation === 'function' ? mutation(current) : mutation);
      const draft = {value, baseline, pending: (previous?.pending || 0) + 1};
      drafts.set(key, draft);
      const operation = queue.then(() => save(target, value));
      queue = operation.catch(() => {});
      return operation.then(result => {
        const latest = drafts.get(key);
        if (latest) latest.pending -= 1;
        return result;
      }, error => {
        const latest = drafts.get(key);
        if (latest === draft) drafts.delete(key);
        else if (latest) latest.pending -= 1;
        throw error;
      });
    },
  };
}
