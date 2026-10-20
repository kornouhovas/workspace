import * as Popover from "@radix-ui/react-popover";
import { useRef, useState, type RefObject, type ReactNode } from "react";

/** Contextual presentation controls share collision, scrolling and focus behavior. */
export function PresentationPopover({ label, children, triggerRef, fallbackFocus, onOpenChange, compact = false }: { label: string; children: ReactNode; triggerRef?: RefObject<HTMLButtonElement | null>; fallbackFocus?: RefObject<HTMLButtonElement | null>; onOpenChange?(open: boolean): void; compact?: boolean }) {
  const ownTrigger = useRef<HTMLButtonElement>(null);
  const trigger = triggerRef ?? ownTrigger;
  const [activated, setActivated] = useState(false);
  // Grouped tables repeat these compact triggers in every header. Mount their
  // Radix tree on first use, then keep it for normal close/focus behavior.
  if (compact && !activated) return <button type="button" ref={trigger} aria-label={label} title={label} aria-haspopup="dialog" aria-expanded={false}
    className="workspace-button workspace-button--secondary presentation-trigger" onClick={() => { setActivated(true); onOpenChange?.(true); }}>•••</button>;
  return <Popover.Root defaultOpen={compact && activated} onOpenChange={onOpenChange}>
    <Popover.Trigger ref={trigger} aria-label={label} title={compact ? label : undefined} className="workspace-button workspace-button--secondary presentation-trigger">{compact ? "•••" : label}</Popover.Trigger>
    <Popover.Portal>
      <Popover.Content className="contextual-panel presentation-popover" aria-label={label} sideOffset={6} collisionPadding={12} onCloseAutoFocus={event => {
        if (!trigger.current?.isConnected && fallbackFocus?.current?.isConnected) {
          event.preventDefault(); fallbackFocus.current.focus();
        }
      }}>
        {children}
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>;
}
