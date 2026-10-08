type WorkspaceMenuPointerEvent = {
  readonly target: EventTarget | null;
  preventDefault: () => void;
  stopPropagation: () => void;
};

let clickBlockerTimeout: number | null = null;

export function isWorkspaceMenuSurfaceTarget(target: EventTarget | null, selector: string) {
  return target instanceof Element && Boolean(target.closest(selector));
}

function clearWorkspaceMenuClickBlocker() {
  document.removeEventListener("click", blockWorkspaceMenuClick, true);

  if (clickBlockerTimeout !== null) {
    window.clearTimeout(clickBlockerTimeout);
    clickBlockerTimeout = null;
  }
}

function blockWorkspaceMenuClick(event: MouseEvent) {
  event.preventDefault();
  event.stopPropagation();
  clearWorkspaceMenuClickBlocker();
}

export function blockNextWorkspaceMenuClick() {
  clearWorkspaceMenuClickBlocker();
  document.addEventListener("click", blockWorkspaceMenuClick, true);
  clickBlockerTimeout = window.setTimeout(clearWorkspaceMenuClickBlocker, 400);
}

export function blockOutsideWorkspaceMenuPointerDown(
  event: WorkspaceMenuPointerEvent,
  selector: string,
  dismiss: () => void,
) {
  if (isWorkspaceMenuSurfaceTarget(event.target, selector)) {
    return false;
  }

  event.preventDefault();
  event.stopPropagation();
  blockNextWorkspaceMenuClick();
  dismiss();
  return true;
}

// The shared capture guard runs before Radix item selection handlers.
export function blockOutsideWorkspaceDropdownPointerDown(
  event: WorkspaceMenuPointerEvent,
  dismiss: () => void,
) {
  if (event.target instanceof Element && event.target.closest('[data-slot="dropdown-menu-trigger"][aria-expanded="true"]')) return false;
  return blockOutsideWorkspaceMenuPointerDown(event,
    '.workspace-menu-surface, [data-slot="dropdown-menu-content"], [data-slot="dropdown-menu-sub-content"], [data-workspace-group-menu="true"]',
    dismiss,
  );
}
