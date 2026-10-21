import { Hint } from "./Hint.js";
import { Icon } from "./Icons.js";
import { contextOwner } from "./ContextTools.js";
import { useViewControlsVisible } from "./ManagementSurface.js";
import * as Popover from "@radix-ui/react-popover";
import { useEffect, useRef, useState, type RefObject, type ReactNode } from "react";

/** Contextual presentation controls share collision, scrolling and focus behavior. */
export function PresentationPopover({ label, children, triggerRef, fallbackFocus, onOpenChange, compact = false }: { label: string; children: ReactNode; triggerRef?: RefObject<HTMLButtonElement | null>; fallbackFocus?: RefObject<HTMLButtonElement | null>; onOpenChange?(open: boolean): void; compact?: boolean }) {
  const ownTrigger = useRef<HTMLButtonElement>(null);
  const trigger = triggerRef ?? ownTrigger;
  const [owner,setOwner]=useState<string | undefined>(undefined);
  const visible=useViewControlsVisible();
  const [open,setOpen]=useState(false);
  useEffect(()=>{if(!visible)setOpen(false);},[visible]);
  return <Popover.Root open={visible && open} onOpenChange={open=>{setOpen(open);if(open) setOwner(contextOwner(trigger.current));onOpenChange?.(open);}}>
    <Hint label={label}><Popover.Trigger ref={trigger} aria-label={label} title={compact ? label : undefined} className="workspace-button workspace-button--secondary presentation-trigger">{compact ? <Icon name="more"/> : label}</Popover.Trigger></Hint>
    <Popover.Portal>
      <Popover.Content data-context-owner={owner} className="contextual-panel presentation-popover" aria-label={label} sideOffset={6} collisionPadding={12} onEscapeKeyDown={event => {
        // Radix observes Escape in document capture, before a React form can
        // cancel its draft. Leave dismissal to that form for this keypress.
        if (event.target instanceof Element && event.target.closest("[data-presentation-escape-owner]")) event.preventDefault();
      }} onCloseAutoFocus={event => {
        if (!trigger.current?.isConnected && fallbackFocus?.current?.isConnected) {
          event.preventDefault();
          const fallback = fallbackFocus.current;
          const owner = contextOwner(fallback);
          const target = fallback.closest("[hidden]") && owner ? document.getElementById(owner) : fallback;
          target?.focus();
        }
      }}>
        {children}
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>;
}
