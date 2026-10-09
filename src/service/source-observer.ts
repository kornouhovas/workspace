import { accessSync, constants, lstatSync, opendirSync, realpathSync, watch } from "node:fs";
import type { DiscoveryPreview } from "../contracts/workspaces.js";
import type { NativeIdentity } from "./discovery.js";

export interface WatchTarget {
  path: string;
  identity: NativeIdentity;
  stamp: string;
}
export interface SourceObservation {
  state: DiscoveryPreview["state"];
  signature: string;
  targets: WatchTarget[];
}
export interface ObserverDependencies {
  watch(path: string, hint: () => void, failed: () => void): { close(): void };
  schedule(callback: () => void, delay: number): { cancel(): void };
  probe(path: string): WatchTarget;
}

export const nativeObserverDependencies: ObserverDependencies = {
  watch(path, hint, failed) {
    const watcher = watch(path, { recursive: false, persistent: false }, hint);
    watcher.on("error", failed);
    return watcher;
  },
  schedule(callback, delay) {
    const timer = setTimeout(callback, delay);
    timer.unref();
    return { cancel: () => clearTimeout(timer) };
  },
  probe(path) {
    const stat = lstatSync(path, { bigint: true });
    if (!stat.isDirectory() || realpathSync.native(path) !== path) throw new Error("Watch target changed");
    accessSync(path, constants.R_OK | constants.X_OK);
    const directory = opendirSync(path);
    directory.closeSync(); // Probe availability without enumerating any entries.
    return { path, identity: { dev: stat.dev.toString(), ino: stat.ino.toString(), birthtimeNs: stat.birthtimeNs.toString() },
      stamp: `${stat.mtimeNs}:${stat.ctimeNs}` };
  },
};

type Handle = { target: WatchTarget; active: boolean; close?: () => void };
type Entry = {
  sourceId: string; root: string; active: boolean; running: boolean; again: boolean;
  handles: Map<string, Handle>; scheduled?: { cancel(): void }; health?: { cancel(): void };
  failedTargets: Map<string, string>;
  observation?: SourceObservation; published?: string; degraded: boolean;
};

// Owns scheduling and resources only. The service owns validated scans,
// reconciliation transactions, reviews and actual workspace fanout.
export function createSourceObserver(
  pass: (sourceId: string) => SourceObservation,
  changed: (sourceId: string, observation: SourceObservation, revision: number,
    automaticUpdates: "active" | "degraded") => void,
  dependencies: ObserverDependencies = nativeObserverDependencies,
) {
  const entries = new Map<string, Entry>();
  const revisions = new Map<string, number>();
  let closed = false;
  const identity = (target: WatchTarget) => JSON.stringify(target.identity);
  function emit(entry: Entry) {
    if (!entry.active || !entry.observation) return;
    const status = entry.degraded ? "degraded" : "active";
    const signature = JSON.stringify([entry.observation.state, entry.observation.signature, status]);
    if (entry.published === signature) return;
    entry.published = signature;
    const revision = (revisions.get(entry.sourceId) ?? 0) + 1;
    revisions.set(entry.sourceId, revision);
    changed(entry.sourceId, entry.observation, revision, status);
  }
  function drop(entry: Entry, path: string) {
    const handle = entry.handles.get(path);
    if (!handle) return;
    handle.active = false;
    entry.handles.delete(path);
    try { handle.close?.(); } catch { /* Already failed/closed watcher. */ }
  }
  function hint(entry: Entry) {
    if (!entry.active || closed) return;
    if (entry.running) { entry.again = true; return; }
    if (entry.scheduled) return;
    entry.scheduled = dependencies.schedule(() => {
      entry.scheduled = undefined;
      if (entry.active && !closed) run(entry);
    }, 100);
  }
  function accept(entry: Entry, observation: SourceObservation) {
    if (!entry.active || closed) return;
    entry.observation = observation;
    const targets = new Map(observation.targets.map((target) => [target.path, target]));
    for (const [path, evidence] of entry.failedTargets) {
      const target = targets.get(path);
      if (!target || identity(target) !== evidence) entry.failedTargets.delete(path);
    }
    // Close all obsolete targets before installing any replacement.
    for (const [path, handle] of entry.handles) {
      const target = targets.get(path);
      if (!target || identity(handle.target) !== identity(target)) drop(entry, path);
    }
    entry.degraded = !targets.has(entry.root) || !["ready", "empty"].includes(observation.state);
    let installed = false;
    for (const [path, target] of targets) {
      if (entry.handles.has(path)) { entry.handles.get(path)!.target = target; continue; }
      // Notification and installation-window passes still validate the source,
      // but a failed target waits for health retry or explicit Refresh.
      if (entry.failedTargets.has(path)) { entry.degraded = true; continue; }
      const handle: Handle = { target, active: true };
      try {
        if (identity(dependencies.probe(path)) !== identity(target)) throw new Error("Watch installation raced");
        entry.handles.set(path, handle);
        const watcher = dependencies.watch(path, () => {
          if (handle.active) hint(entry); // Event names/filenames never authorize a path.
        }, () => {
          if (!handle.active || !entry.active || closed) return;
          entry.failedTargets.set(path, identity(target));
          drop(entry, path); entry.degraded = true; emit(entry); hint(entry);
        });
        handle.close = () => watcher.close();
        if (!handle.active) { watcher.close(); throw new Error("Watch installation failed"); }
        if (identity(dependencies.probe(path)) !== identity(target)) throw new Error("Watch installation raced");
        installed = true;
      } catch { entry.failedTargets.set(path, identity(target)); drop(entry, path); entry.degraded = true; }
    }
    emit(entry);
    if (installed) hint(entry); // Cover the validated-scan/watch-installation window.
  }
  function run(entry: Entry) {
    if (!entry.active || closed) return;
    if (entry.running) { entry.again = true; return; }
    entry.running = true;
    try { accept(entry, pass(entry.sourceId)); }
    catch {
      entry.degraded = true;
      if (!entry.observation) entry.observation = { state: "changed", signature: "failed", targets: [] };
      emit(entry);
    } finally {
      entry.running = false;
      if (entry.again) { entry.again = false; hint(entry); }
    }
  }
  function health(entry: Entry) {
    entry.health = dependencies.schedule(() => {
      entry.health = undefined;
      if (!entry.active || closed) return;
      let scan = entry.degraded;
      try {
        const root = dependencies.probe(entry.root);
        const previous = entry.handles.get(entry.root)?.target;
        if (!previous || identity(root) !== identity(previous) || root.stamp !== previous.stamp) scan = true;
      } catch { scan = true; }
      if (scan) { entry.failedTargets.clear(); hint(entry); }
      health(entry);
    }, 5000);
  }
  function stop(entry: Entry) {
    entry.active = false;
    entry.scheduled?.cancel(); entry.health?.cancel();
    for (const path of entry.handles.keys()) drop(entry, path);
  }
  return {
    sync(sources: { sourceId: string; root: string }[]) {
      if (closed) return;
      const desired = new Map(sources.map((source) => [source.sourceId, source.root]));
      for (const [id, entry] of entries) if (desired.get(id) !== entry.root) { stop(entry); entries.delete(id); }
      for (const [sourceId, root] of desired) if (!entries.has(sourceId)) {
        const entry: Entry = { sourceId, root, active: true, running: false, again: false, handles: new Map(), failedTargets: new Map(), degraded: false };
        entries.set(sourceId, entry);
        health(entry); run(entry);
      }
    },
    accept(sourceId: string, observation: SourceObservation) {
      const entry = entries.get(sourceId);
      if (entry) { entry.failedTargets.clear(); accept(entry, observation); }
    },
    request(sourceId: string) { const entry = entries.get(sourceId); if (entry) hint(entry); },
    close() { closed = true; for (const entry of entries.values()) stop(entry); entries.clear(); revisions.clear(); },
  };
}
