import { useEffect, useRef, useState } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { useI18n } from '@/i18n';
import type { ProjectMovePending } from '@/workspaceProjectMoveState.js';

export function ProjectMoveIndicator({ pending }: { pending: ProjectMovePending | null }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const focusOwned = useRef(false);
  const currentPending = useRef(pending);
  currentPending.current = pending;
  const details = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!pending) {
      // The transient trigger disappears. Return focus to the adjacent persistent
      // sidebar control when either the trigger or details had keyboard focus.
      if (focusOwned.current)
        document.querySelector<HTMLButtonElement>('[data-sidebar-toggle]')?.focus();
      focusOwned.current = false;
      setOpen(false);
    }
  }, [pending]);
  return <>
    <span className="sr-only" role="status" aria-live="polite">{pending ? t(pending.operation === 'rename' ? 'rename.pendingAnnouncement' : 'move.pendingAnnouncement', { name: pending.projectName }) : ''}</span>
    {pending && <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button ref={trigger} onFocus={() => { focusOwned.current = true; }} onBlur={event => { if (event.relatedTarget && !details.current?.contains(event.relatedTarget)) focusOwned.current = false; }} type="button" className="bb-chrome-action electron-window-no-drag" aria-label={t(pending.operation === 'rename' ? 'rename.showDetails' : 'move.showDetails')} title={t(pending.operation === 'rename' ? 'rename.showDetails' : 'move.showDetails')} data-testid="project-move-indicator">
          <svg className="workspace-project-move-animation size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 8h15m-4-4 4 4-4 4M20 16H5m4 4-4-4 4-4" />
          </svg>
        </button>
      </PopoverTrigger>
      <PopoverContent ref={details} onFocusCapture={() => { focusOwned.current = true; }} onBlurCapture={event => { if (event.relatedTarget && !details.current?.contains(event.relatedTarget) && event.relatedTarget !== trigger.current) focusOwned.current = false; }} align="start" className="w-80 max-w-[calc(100vw-2rem)] text-xs" aria-label={t(pending.operation === 'rename' ? 'rename.details' : 'move.details')} onCloseAutoFocus={event => {
        // Radix runs this callback from the removed content's last render.
        if (!currentPending.current) { event.preventDefault(); document.querySelector<HTMLButtonElement>('[data-sidebar-toggle]')?.focus(); }
      }}>
        <p className="mb-3 text-sm font-medium">{t(pending.operation === 'rename' ? 'rename.details' : 'move.details')}</p>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2">
          <dt className="text-muted-foreground">{t('move.project')}</dt><dd className="break-words">{pending.projectName}</dd>
          <dt className="text-muted-foreground">{t('move.from')}</dt><dd className="break-all">{pending.from}</dd>
          <dt className="text-muted-foreground">{t('move.to')}</dt><dd className="break-all">{pending.to}</dd>
          <dt className="text-muted-foreground">{t('move.state')}</dt><dd>{t(pending.operation === 'rename' ? 'rename.pending' : 'move.pending')}</dd>
        </dl>
      </PopoverContent>
    </Popover>}
  </>;
}
