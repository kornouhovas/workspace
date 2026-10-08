import { StrictMode } from "react";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { BackendStatus } from "../contracts/desktop-api.js";

function App() {
  const [backend, setBackend] = useState<BackendStatus>({ state: "starting" });

  useEffect(() => {
    void window.workspace.getBackendStatus().then(setBackend);
    return window.workspace.onBackendStatus(setBackend);
  }, []);

  return (
    <main aria-label="Workspace">
      <h1>Workspace</h1>
      {backend.state === "starting" && <p role="status">Starting local service…</p>}
      {backend.state === "unavailable" && <p role="alert">{backend.message}</p>}
    </main>
  );
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Renderer root element is missing");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
