import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { WorkspaceSessionSnapshot, WorkspaceSessionState } from "../../contracts/workspace-sessions.js";
import type { Language } from "../../contracts/settings.js";
import type { WorkspaceServiceClient } from "../workspace-service-client.js";

type SessionContext = {
  state: WorkspaceSessionState | null;
  ready: boolean;
  pending: boolean;
  error: boolean;
  update(patch: Partial<WorkspaceSessionState>): void;
  reload(): void;
};
const Context = createContext<SessionContext | null>(null);
export const useWorkspaceSession = () => useContext(Context);
const labels = {
  en: { loading: "Restoring workspace session…", saving: "Saving workspace session…", error: "The workspace session could not be loaded or saved. Reload the saved session before continuing.", reload: "Reload saved session" },
  ru: { loading: "Восстанавливаем рабочую сессию…", saving: "Сохраняем рабочую сессию…", error: "Не удалось загрузить или сохранить сессию. Загрузите сохранённую сессию перед продолжением.", reload: "Загрузить сохранённую сессию" },
};
export function WorkspaceSessionGate({ language, children }: { language: Language; children: ReactNode }) {
  const session = useWorkspaceSession(), l = labels[language];
  if (session && !session.ready) return <div role={session.error ? "alert" : "status"}>
    <p>{session.error ? l.error : l.loading}</p>
    {session.error && <button type="button" className="workspace-button workspace-button--secondary" onClick={session.reload}>{l.reload}</button>}
  </div>;
  return <>{session?.pending && <span role="status" className="sr-only">{l.saving}</span>}{children}</>;
}
export function WorkspaceSessionProvider({ client, workspaceId, generation = 0, children }: {
  client: WorkspaceServiceClient; workspaceId?: string; language: Language; generation?: number; children: ReactNode;
}) {
  const [version, setVersion] = useState(0);
  const [value, setValue] = useState<{ workspaceId?: string; state: WorkspaceSessionState | null; pending: boolean; error: boolean }>({ state: null, pending: false, error: false });
  const writer = useRef<((patch: Partial<WorkspaceSessionState>) => void) | null>(null);
  useEffect(() => {
    let current = true;
    let snapshot: WorkspaceSessionSnapshot | null = null;
    let desired: WorkspaceSessionState | null = null;
    let writing = false;
    let latest: WorkspaceSessionState | null = null;
    const fail = () => { if (current) setValue(v => ({ ...v, pending: false, error: true })); };
    const flush = async () => {
      if (!snapshot || !desired || writing || !workspaceId) return;
      writing = true;
      try {
        while (desired && snapshot) {
          const state = desired; desired = null;
          const result = await client.setSession(workspaceId, snapshot.epoch, snapshot.revision, state);
          if (!result.ok) { desired = null; snapshot = null; fail(); return; }
          snapshot = result.value;
        }
        if (current) setValue(v => ({ ...v, pending: false }));
      } catch { desired = null; snapshot = null; fail(); }
      finally { writing = false; }
    };
    writer.current = patch => {
      if (!snapshot || !current) return;
      latest = { ...(latest ?? snapshot.state), ...patch };
      desired = latest;
      const state = latest;
      setValue(v => ({ ...v, state, pending: true }));
      void flush();
    };
    setValue({ workspaceId, state: null, pending: false, error: false });
    let readVersion = 0;
    const read = () => {
      if (!workspaceId || writing) return;
      const request = ++readVersion;
      void client.getSession(workspaceId).then(result => {
      if (!current || request !== readVersion || writing) return;
      if (!result.ok) { fail(); return; }
      if (snapshot && result.value.epoch === snapshot.epoch && result.value.revision <= snapshot.revision) return;
      snapshot = result.value;
      latest = snapshot.state;
      setValue({ workspaceId, state: snapshot.state, pending: false, error: false });
      }).catch(() => { if (request === readVersion) fail(); });
    };
    read();
    const unsubscribe = client.onWorkspaceChange(event => { if (event.type === "workspace.listChanged") read(); });
    return () => { current = false; readVersion++; writer.current = null; unsubscribe(); };
  }, [client, workspaceId, generation, version]);
  const matches = value.workspaceId === workspaceId;
  const context: SessionContext = {
    state: matches ? value.state : null,
    ready: !workspaceId || matches && !!value.state && !value.error,
    pending: matches && value.pending,
    error: matches && value.error,
    update: patch => writer.current?.(patch),
    reload: () => setVersion(v => v + 1),
  };
  return <Context.Provider value={context}>{children}</Context.Provider>;
}
