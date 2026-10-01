export const workspaceMenuContentClassName =
  "workspace-menu-surface min-w-44 max-h-[calc(100vh-1rem)] max-w-[calc(100vw-1rem)] overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md";

export const workspaceMenuItemClassName =
  "group/workspace-menu-item flex w-full py-[0.3125rem] cursor-default items-center gap-2 rounded-sm px-2 text-left text-xs font-normal text-popover-foreground outline-none [overflow-wrap:anywhere] hover:bg-state-hover hover:text-foreground focus-visible:bg-state-hover focus-visible:text-foreground data-[highlighted]:bg-state-hover data-[highlighted]:text-foreground disabled:pointer-events-none disabled:opacity-50 data-disabled:pointer-events-none data-disabled:opacity-50";

export const workspaceMenuDangerItemClassName =
  "group/workspace-menu-item flex w-full py-[0.3125rem] cursor-default items-center gap-2 rounded-sm px-2 text-left text-xs font-normal text-destructive-text outline-none [overflow-wrap:anywhere] hover:bg-destructive/10 hover:text-destructive-text focus-visible:bg-destructive/10 focus-visible:text-destructive-text data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive-text disabled:pointer-events-none disabled:opacity-50 data-disabled:pointer-events-none data-disabled:opacity-50";

export const workspaceMenuIconClassName =
  "size-4 shrink-0 text-muted-foreground";

export const workspaceMenuCheckboxClassName =
  "!size-3.5 !rounded-full !border-border !bg-transparent text-background shadow-none dark:!bg-transparent disabled:!opacity-100 data-checked:!border-muted-foreground data-checked:!bg-muted-foreground data-checked:!text-background dark:data-checked:!bg-muted-foreground [&_[data-slot=checkbox-indicator]>svg]:!size-2.5";

export const workspaceMenuDangerIconClassName =
  "size-4 shrink-0 text-destructive-text";

export const workspaceMenuLabelClassName =
  "px-2 pb-1 pt-1 text-xs font-medium text-muted-foreground";

export const workspaceMenuSeparatorClassName =
  "-mx-1 my-1 h-px bg-border/80";

export const workspaceMenuOptionItemClassName =
  "items-start gap-2 rounded-md px-2 py-1.5";

export const workspaceMenuDescriptionClassName =
  "truncate text-xs font-normal text-muted-foreground";
