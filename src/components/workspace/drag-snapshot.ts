// Freeze the rendered subtree at activation, including wrapping and inherited
// styles. The visual clone is inert and has no duplicated DOM/ARIA identities.
export function captureDragSnapshot(source: HTMLElement) {
  const rect = source.getBoundingClientRect();
  const node = source.cloneNode(true) as HTMLElement;
  const originals = [source, ...source.querySelectorAll<HTMLElement>('*')];
  const clones = [node, ...node.querySelectorAll<HTMLElement>('*')];
  originals.forEach((element, index) => {
    const clone = clones[index];
    const computed = getComputedStyle(element);
    for (const property of computed) clone.style.setProperty(property, computed.getPropertyValue(property));
    for (const attribute of ['id', 'for', 'aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns']) clone.removeAttribute(attribute);
    clone.removeAttribute('autofocus');
    clone.setAttribute('tabindex', '-1');
    clone.style.transition = 'none';
    clone.style.animation = 'none';
  });
  node.removeAttribute('data-workspace-project-drag');
  node.style.width = `${rect.width}px`;
  node.style.height = `${rect.height}px`;
  node.style.boxSizing = 'border-box';
  node.style.margin = '0';
  node.style.opacity = '1';
  node.style.transform = 'none';
  node.style.pointerEvents = 'none';
  node.inert = true;
  return { node, width: rect.width, height: rect.height };
}
