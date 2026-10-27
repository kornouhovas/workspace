import { useEffect, useRef, useState } from "react";
import type { ServiceResult } from "../../contracts/settings.js";
import type { WorkspaceServiceClient } from "../workspace-service-client.js";
interface PresentationAdapter<T> {
  load(client: WorkspaceServiceClient, workspaceId: string, viewId: string): Promise<ServiceResult<{workspaceId: string; viewId: string; config: T}>>;
  save(client: WorkspaceServiceClient, workspaceId: string, viewId: string, config: T): Promise<ServiceResult<{workspaceId: string; viewId: string; config: T}>>;
}
export function useViewPresentation<T>(client: WorkspaceServiceClient, workspaceId: string, viewId: string | undefined, adapter: PresentationAdapter<T>, prepared?: {viewId: string; config: T}, transitionPending = false) {
  const [state, setState] = useState<{viewId: string; config: T} | null>(null);
  const [pending, setPending] = useState(false), [error, setError] = useState(false), [loading, setLoading] = useState(false);
  const version = useRef(0), saving = useRef(false), reloadAfterSave = useRef(false);
  const savedFocus = useRef<HTMLElement | null>(null);
  const preparedOwner = useRef<string | undefined>(undefined);
  const preparedConfig = useRef<T | undefined>(undefined);
  const transitionRef = useRef(transitionPending); transitionRef.current = transitionPending;
  const reloadAfterTransition = useRef(false);
  useEffect(() => {
    if (pending || loading || !savedFocus.current || savedFocus.current.matches(":disabled")) return;
    const element = savedFocus.current; savedFocus.current = null;
    if (element.isConnected && (document.activeElement === document.body || document.activeElement === element)) element.focus();
  }, [pending, loading]);
  const load = async (preserveError = false) => {
    if (!viewId) return;
    const request = ++version.current;
    setLoading(true); if (!preserveError) setError(false);
    try {
      const result = await adapter.load(client, workspaceId, viewId);
      if (request !== version.current) return;
      if (result.ok && result.value.workspaceId === workspaceId && result.value.viewId === viewId) setState({viewId, config: result.value.config});
      else setError(true);
    } catch { if (request === version.current) setError(true); }
    finally { if (request === version.current) setLoading(false); }
  };
  useEffect(() => {
    setState(prepared && prepared.viewId === viewId ? prepared : null); setPending(false); setLoading(false); setError(false); saving.current = false; reloadAfterSave.current = false; reloadAfterTransition.current = false; savedFocus.current = null;
    if (!viewId) return;
    if (!prepared || prepared.viewId !== viewId) void load();
    const stop = client.onWorkspaceChange(event => {
      if (event.type !== "workspace.listChanged" && !(event.type === "workspace.propertiesChanged" && event.workspaceIds.includes(workspaceId))) return;
      if (transitionRef.current) { reloadAfterTransition.current = true; return; }
      if (saving.current) { if (event.type === "workspace.propertiesChanged") reloadAfterSave.current = true; } else void load(true);
    });
    return () => { version.current++; stop(); };
  }, [client, workspaceId, viewId, adapter]);
  useEffect(() => {
    if (transitionPending || !reloadAfterTransition.current) return;
    reloadAfterTransition.current = false;
    if (saving.current) reloadAfterSave.current = true;
    else void load(true);
  }, [transitionPending]);
  useEffect(() => {
    if (prepared && prepared.viewId === viewId) {
      if (preparedOwner.current !== viewId || preparedConfig.current !== prepared.config) setState(prepared);
      preparedOwner.current = viewId; preparedConfig.current = prepared.config; return;
    }
    if (viewId && preparedOwner.current === viewId) {
      preparedOwner.current = undefined; preparedConfig.current = undefined;
      if (saving.current) reloadAfterSave.current = true;
      else { setState(null); void load(true); }
    }
    else { preparedOwner.current = undefined; preparedConfig.current = undefined; }
  }, [viewId, prepared?.viewId, prepared?.config]);
  const save = async (config: T) => {
    if (!viewId || saving.current) return;
    savedFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    saving.current = true; setPending(true); setError(false); setLoading(false);
    const request = ++version.current;
    let saved = false;
    try {
      const result = await adapter.save(client, workspaceId, viewId, config);
      if (request !== version.current) return;
      if (result.ok && result.value.workspaceId === workspaceId && result.value.viewId === viewId) { saved = true; setState({viewId, config: result.value.config}); }
      else setError(true);
    } catch { if (request === version.current) setError(true); }
    finally { if (request === version.current) { saving.current = false; setPending(false); if (reloadAfterSave.current) { reloadAfterSave.current = false; void load(!saved); } } }
  };
  return {config: prepared && prepared.viewId === viewId && (preparedOwner.current !== viewId || preparedConfig.current !== prepared.config) ? prepared.config : state && state.viewId === viewId ? state.config : prepared && prepared.viewId === viewId ? prepared.config : null, pending, error, loading, load, save};
}
