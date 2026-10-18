import { useEffect, useRef, useState } from "react";
import type { ServiceResult } from "../../contracts/settings.js";
import type { WorkspaceServiceClient } from "../workspace-service-client.js";
interface PresentationAdapter<T> {
  load(client: WorkspaceServiceClient, workspaceId: string, viewId: string): Promise<ServiceResult<{workspaceId: string; viewId: string; config: T}>>;
  save(client: WorkspaceServiceClient, workspaceId: string, viewId: string, config: T): Promise<ServiceResult<{workspaceId: string; viewId: string; config: T}>>;
}
export function useViewPresentation<T>(client: WorkspaceServiceClient, workspaceId: string, viewId: string | undefined, adapter: PresentationAdapter<T>) {
  const [state, setState] = useState<{viewId: string; config: T} | null>(null);
  const [pending, setPending] = useState(false), [error, setError] = useState(false), [loading, setLoading] = useState(false);
  const version = useRef(0), saving = useRef(false);
  const savedFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (pending || !savedFocus.current) return;
    const element = savedFocus.current; savedFocus.current = null;
    if (element.isConnected && (document.activeElement === document.body || document.activeElement === element)) element.focus();
  }, [pending]);
  const load = async () => {
    if (!viewId) return;
    const request = ++version.current;
    setLoading(true); setError(false);
    try {
      const result = await adapter.load(client, workspaceId, viewId);
      if (request !== version.current) return;
      if (result.ok && result.value.workspaceId === workspaceId && result.value.viewId === viewId) setState({viewId, config: result.value.config});
      else setError(true);
    } catch { if (request === version.current) setError(true); }
    finally { if (request === version.current) setLoading(false); }
  };
  useEffect(() => {
    setState(null); setPending(false); saving.current = false; savedFocus.current = null;
    if (!viewId) return;
    void load();
    const stop = client.onWorkspaceChange(event => { if (event.type === "workspace.listChanged" && !saving.current) void load(); });
    return () => { version.current++; stop(); };
  }, [client, workspaceId, viewId, adapter]);
  const save = async (config: T) => {
    if (!viewId || saving.current) return;
    savedFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    saving.current = true; setPending(true); setError(false); setLoading(false);
    const request = ++version.current;
    try {
      const result = await adapter.save(client, workspaceId, viewId, config);
      if (request !== version.current) return;
      if (result.ok && result.value.workspaceId === workspaceId && result.value.viewId === viewId) setState({viewId, config: result.value.config});
      else setError(true);
    } catch { if (request === version.current) setError(true); }
    finally { if (request === version.current) { saving.current = false; setPending(false); } }
  };
  return {config: state && state.viewId === viewId ? state.config : null, pending, error, loading, load, save};
}
