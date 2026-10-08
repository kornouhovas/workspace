import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

function App() {
  return <main aria-label="Workspace">Workspace</main>;
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
