import { Hint } from "./Hint.js";
import { Icon } from "./Icons.js";
import * as Popover from "@radix-ui/react-popover";
import { useRef, type RefObject, type ReactNode } from "react";

/** Contextual presentation controls share collision, scrolling and focus behavior. */
export function PresentationPopover({ label, children, triggerRef, fallbackFocus, onOpenChange, compact = false }: { label: string; children: ReactNode; triggerRef?: RefObject<HTMLButtonElement | null>; fallbackFocus?: RefObject<HTMLButtonElement | null>; onOpenChange?(open: boolean): void; compact?: boolean }) {
  const ownTrigger = useRef<HTMLButtonElement>(null);
  const trigger = triggerRef ?? ownTrigger;
  return <Popover.Root onOpenChange={onOpenChange}>
    <Hint label={label}><Popover.Trigger ref={trigger} aria-label={label} title={compact ? label : undefined} className="workspace-button workspace-button--secondary presentation-trigger">{compact ? <Icon name="more"/> : label}</Popover.Trigger></Hint>
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
