import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode, RefObject } from "react";

/** Keep operation controllers alive when their form is dismissed. */
export function ProjectOperationDialog({ open, title, onClose, children, contentRef, className = "" }: {
  open: boolean; title: string; onClose(): void; children: ReactNode; contentRef?: RefObject<HTMLDivElement | null>; className?: string;
}) {
  if (!open) return children;
  return <Dialog.Root open modal={false} onOpenChange={next => { if (!next) onClose(); }}>
    <Dialog.Portal container={document.body}>
      <Dialog.Overlay className="project-operation-overlay" />
      <Dialog.Content ref={contentRef} className={`project-operation-dialog ${className}`} aria-label={title} aria-describedby={undefined}
        onInteractOutside={event => event.preventDefault()}
        onOpenAutoFocus={event => {
          event.preventDefault();
          const content = event.currentTarget as HTMLElement;
          content.querySelector<HTMLElement>('input:not(:disabled), button:not(:disabled), [tabindex="-1"]')?.focus();
        }}
        onCloseAutoFocus={event => event.preventDefault()}>
        <Dialog.Title>{title}</Dialog.Title>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
