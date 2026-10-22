import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";

type Draft = { commit(): Promise<boolean>; focus(): void };
type Guard = {
  subscribe(listener: () => void): () => void;
  hasDrafts(): boolean;
  register(draft: Draft): () => void;
  run(action: () => void | Promise<unknown>): void;
};
const Context = createContext<Guard | null>(null);
export const useDraftGuard = () => useContext(Context);
const noSubscription = () => () => {};
const noDrafts = () => false;
export function useScalarDraftActive() {
  const guard = useDraftGuard();
  return useSyncExternalStore(guard?.subscribe ?? noSubscription, guard?.hasDrafts ?? noDrafts);
}

// One registry across workspace and project navigation. No queued destinations or
// mutation retries: a blocked transition requires correction or explicit Cancel.
export function ScalarDrafts({ children }: { children: ReactNode }) {
  const parent = useDraftGuard();
  const guard = useMemo<Guard>(() => {
    const drafts = new Set<Draft>();
    const listeners = new Set<() => void>();
    const notify = () => { for (const listener of listeners) listener(); };
    let transitioning = false;
    let applying = false;
    const apply = (action: () => void | Promise<unknown>) => {
      applying = true;
      try { return action(); } finally { applying = false; }
    };
    return {
      subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
      hasDrafts: () => drafts.size > 0,
      register(draft) { drafts.add(draft); notify(); return () => { drafts.delete(draft); notify(); }; },
      run(action) {
        if (applying) { void action(); return; }
        if (transitioning) return;
        if (!drafts.size) { void action(); return; }
        transitioning = true;
        void (async () => {
          try {
            const checked = new Set<Draft>();
            for (const draft of drafts) {
              if (checked.has(draft)) continue;
              checked.add(draft);
              if (!await draft.commit()) { draft.focus(); return; }
            }
            await apply(action);
          } finally { transitioning = false; }
        })();
      },
    };
  }, []);
  return <Context.Provider value={parent ?? guard}>{children}</Context.Provider>;
}
