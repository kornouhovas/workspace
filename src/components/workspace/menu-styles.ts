export const workspaceMenuContentClassName =
  "max-h-[calc(100vh-1rem)] max-w-[calc(100vw-1rem)] overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md shadow-black/10";

export const workspaceMenuItemClassName =
  "group/workspace-menu-item flex min-h-8 w-full cursor-default items-center gap-2 rounded-md px-2 text-left text-[13px] font-normal text-popover-foreground outline-none transition-colors [overflow-wrap:anywhere] hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 data-disabled:pointer-events-none data-disabled:opacity-50";

export const workspaceMenuDangerItemClassName =
  "group/workspace-menu-item flex min-h-8 w-full cursor-default items-center gap-2 rounded-md px-2 text-left text-[13px] font-normal text-destructive outline-none transition-colors [overflow-wrap:anywhere] hover:bg-destructive/10 hover:text-destructive focus-visible:bg-destructive/10 focus-visible:text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive disabled:pointer-events-none disabled:opacity-50 data-disabled:pointer-events-none data-disabled:opacity-50";

export const workspaceMenuIconClassName =
  "size-4 shrink-0 text-muted-foreground";

export const workspaceMenuCheckboxClassName =
  "!size-3.5 !rounded-full !border-border !bg-transparent text-background shadow-none dark:!bg-transparent disabled:!opacity-100 data-checked:!border-muted-foreground data-checked:!bg-muted-foreground data-checked:!text-background dark:data-checked:!bg-muted-foreground [&_[data-slot=checkbox-indicator]>svg]:!size-2.5";

export const workspaceMenuDangerIconClassName =
  "size-4 shrink-0 text-destructive";

export const workspaceMenuLabelClassName =
  "px-2 pb-1 pt-1 text-xs font-semibold text-muted-foreground";

export const workspaceMenuSeparatorClassName =
  "-mx-1 my-1 h-px bg-border/80";

export const workspaceMenuOptionItemClassName =
  "items-start gap-2 rounded-md px-2 py-1.5";

export const workspaceMenuDescriptionClassName =
  "truncate text-xs font-normal text-muted-foreground";
