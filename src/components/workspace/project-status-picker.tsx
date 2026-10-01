import { useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { workspaceMenuContentClassName, workspaceMenuOptionItemClassName } from './menu-styles';
import { blockOutsideWorkspaceMenuPointerDown } from './menu-dismissal';
import { useI18n } from '@/i18n';
import { getStatusDisplayName } from '@/i18n/status';
import type { WorkspaceMockProject } from '@/workspaceMockData';
import type { ProjectStatusMoveOption } from '@/workspaceProjectMoveState.js';

export function ProjectStatusPicker({ project, pending, loadOptions, onSelect, trigger, label }: {
  trigger?: ReactNode;
  label?: string;
  project: WorkspaceMockProject;
  pending: boolean;
  loadOptions: (projectId: string) => Promise<readonly ProjectStatusMoveOption[]>;
  onSelect: (project: WorkspaceMockProject, option: ProjectStatusMoveOption) => void;
}) {
  const { t } = useI18n();
  const [options, setOptions] = useState<readonly ProjectStatusMoveOption[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  function changeOpen(next: boolean) {
    setOpen(next);
    if (next) {
      setOptions(null); setFailed(false);
      void loadOptions(project.id).then(setOptions).catch(() => setFailed(true));
    }
  }
  return <DropdownMenu open={open} onOpenChange={changeOpen}>
    <DropdownMenuTrigger asChild>
      <button type="button" disabled={pending} data-workspace-status-picker onPointerDown={trigger ? event => event.preventDefault() : undefined}
        onClick={event => { event.stopPropagation(); if (trigger) changeOpen(!open); }} aria-label={label || t('move.chooseStatus')} aria-busy={pending || undefined}
        className="min-w-0 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-60">
        {trigger || <Badge variant="secondary" data-workspace-status-value className="h-6 max-w-full gap-1.5 rounded-md border border-border/50 bg-secondary/70 px-2 text-sm font-normal">
          <span className="size-2 shrink-0 rounded-full bg-muted-foreground/70" data-color={project.status.color || 'gray'} aria-hidden="true" />
          <span className="truncate">{getStatusDisplayName(t, project.status)}</span>
        </Badge>}
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent className={workspaceMenuContentClassName} align="start" data-workspace-status-menu="true" onPointerDownOutside={event => blockOutsideWorkspaceMenuPointerDown(event, "[data-workspace-status-menu='true']", () => setOpen(false))}>
      {options ? <DropdownMenuRadioGroup value={project.status.id} onValueChange={id => {
        const option = options.find(item => item.id === id);
        if (option && !option.current && !option.disabledReason && option.to) onSelect(project, option);
      }}>
        {options.filter(option => option.id !== "statusValue:no-status").map(option => <DropdownMenuRadioItem key={option.id} value={option.id}
          className={workspaceMenuOptionItemClassName} disabled={!option.current && !!option.disabledReason}>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="flex items-center gap-2" data-workspace-status-value>
              <span className="size-2 shrink-0 rounded-full bg-muted-foreground/70" data-color={option.color || 'gray'} aria-hidden="true" />
              <span className="truncate">{getStatusDisplayName(t, option)}</span>
            </span>
            {option.disabledReason && !option.current && <span className="max-w-60 whitespace-normal text-[11px] text-muted-foreground">{t(option.disabledReason === 'no-status-target' ? 'move.noStatusReason' : 'move.nestedStatusReason')}</span>}
            {!option.disabledReason && option.relativePath !== option.name && <span className="text-[11px] text-muted-foreground">{option.relativePath}</span>}
          </span>
        </DropdownMenuRadioItem>)}
      </DropdownMenuRadioGroup> : <DropdownMenuItem disabled>{t(failed ? 'move.optionsFailed' : 'move.loading')}</DropdownMenuItem>}
    </DropdownMenuContent>
  </DropdownMenu>;
}
