import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./renderer.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Renderer root element is missing.");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
