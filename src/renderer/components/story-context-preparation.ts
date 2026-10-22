// Disposable story preparation follows the same contextual entry as a user.
export function openStoryProjectAction(root: HTMLElement, label: string) {
  const actions = [...root.querySelectorAll<HTMLButtonElement>("button[aria-label]")]
    .filter(button => button.getAttribute("aria-label")?.startsWith(`${label}: `));
  if (actions.length !== 1 || actions[0].disabled) return false;
  const button = actions[0];
  if (!showContext(root, button)) return false;
  button.click();
  return true;
}

function showContext(root: HTMLElement, control: HTMLElement) {
  const panel = control.closest<HTMLElement>("[data-context-return]");
  if (!panel?.hidden) return true;
  const trigger = root.ownerDocument.getElementById(panel.dataset.contextReturn!);
  if (trigger?.tagName === "BUTTON" && !(trigger as HTMLButtonElement).disabled) trigger.click();
  return false;
}

export function showStoryHistory(root: HTMLElement, selector: string) {
  const list = root.querySelector<HTMLElement>(selector);
  if (!list || !showContext(root, list)) return false;
  const details = list.closest("details");
  if (details && !details.open) { details.querySelector("summary")?.click(); return false; }
  return true;
}
