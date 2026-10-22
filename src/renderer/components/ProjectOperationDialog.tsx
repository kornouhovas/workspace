import * as Dialog from "@radix-ui/react-dialog";
import { FocusScope } from "@radix-ui/react-focus-scope";
import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";

/** Nonmodal operation forms preserve independent editors and their Escape owner. */
export function ProjectOperationDialog({ open, title, onClose, children, contentRef, className = "" }: {
  open: boolean; title: string; onClose(): void; children: ReactNode; contentRef?: RefObject<HTMLDivElement | null>; className?: string;
}) {
  const ownContent = useRef<HTMLDivElement>(null);
  const content = contentRef ?? ownContent;
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    // Window bubbling runs after editors and document-owned contextual menus.
    // Dialog.Content's document-capture dismissal would consume their Escape.
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || !(event.target instanceof Node) || !content.current?.contains(event.target)) return;
      event.preventDefault(); onClose();
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [open, onClose, content]);
  if (!open) return children;
  return <Dialog.Root open modal={false}>
    <Dialog.Portal container={document.body}>
      <FocusScope asChild loop
        onMountAutoFocus={event => {
          event.preventDefault();
          content.current?.querySelector<HTMLElement>('input:not(:disabled), button:not(:disabled), [tabindex="-1"]')?.focus();
        }}
        onUnmountAutoFocus={event => event.preventDefault()}>
        <div ref={content} role="dialog" aria-labelledby={titleId} tabIndex={-1} className={`project-operation-dialog ${className}`}>
          <Dialog.Title id={titleId}>{title}</Dialog.Title>
          {children}
        </div>
      </FocusScope>
    </Dialog.Portal>
  </Dialog.Root>;
}
