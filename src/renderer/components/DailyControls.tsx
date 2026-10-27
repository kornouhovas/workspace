import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Only entry controls move into the strip. Forms, operation receipts and their
// controllers retain their owning saved-view lifetime and visibility boundary.
const DailyControlsContext = createContext<{
  target: HTMLDivElement | null;
  setTarget(target: HTMLDivElement | null): void;
} | null>(null);

export function DailyControlsSurface({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  return <DailyControlsContext.Provider value={{ target, setTarget }}>{children}</DailyControlsContext.Provider>;
}

export function DailyControlsTarget({ hidden, inert = false }: { hidden: boolean; inert?: boolean }) {
  const context = useContext(DailyControlsContext);
  return <div className="daily-controls" hidden={hidden} inert={inert} ref={context?.setTarget} />;
}

export function DailyControl({ children }: { children: ReactNode }) {
  const context = useContext(DailyControlsContext);
  if (!context) return children;
  return context.target ? createPortal(children, context.target) : null;
}
