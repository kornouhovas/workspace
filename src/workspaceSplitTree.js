// UI-only split tree. Pane content refers to an existing project tab identity.
export const MAX_WORKSPACE_PANES = 8;
export function workspacePane() {
  return { type: "pane", paneId: "workspace", tabId: null };
}
export function listWorkspacePanes(root) {
  return root.type === "pane" ? [root] : root.children.flatMap(listWorkspacePanes);
}
const equal = (count) => Array(count).fill(1 / count);
export function insertWorkspacePane(root, target, side, pane) {
  const direction = side === "left" || side === "right" ? "row" : "col";
  const before = side === "left" || side === "top";
  if (root.type === "pane")
    return root.paneId !== target
      ? root
      : {
          type: "split",
          dir: direction,
          sizes: [0.5, 0.5],
          children: before ? [pane, root] : [root, pane],
        };
  const index = root.children.findIndex(
    (child) => child.type === "pane" && child.paneId === target,
  );
  if (root.dir === direction && index !== -1) {
    const children = [...root.children];
    children.splice(index + (before ? 0 : 1), 0, pane);
    return { ...root, children, sizes: equal(children.length) };
  }
  return {
    ...root,
    children: root.children.map((child) =>
      listWorkspacePanes(child).some((p) => p.paneId === target)
        ? insertWorkspacePane(child, target, side, pane)
        : child,
    ),
  };
}
export function removeWorkspacePane(root, id) {
  if (root.type === "pane") return root.paneId === id ? null : root;
  const children = root.children.map((child) => removeWorkspacePane(child, id)).filter(Boolean);
  if (!children.length) return null;
  if (children.length === 1) return children[0];
  return {
    ...root,
    children,
    sizes: children.length === root.children.length ? root.sizes : equal(children.length),
  };
}
export function mapWorkspacePane(root, id, patch) {
  return root.type === "pane"
    ? root.paneId === id
      ? { ...root, ...patch }
      : root
    : { ...root, children: root.children.map((child) => mapWorkspacePane(child, id, patch)) };
}
export function resizeWorkspaceSplit(root, path, index, fraction) {
  if (!path.length) {
    if (root.type !== "split" || index < 0 || index >= root.children.length - 1) return root;
    const sizes = [...root.sizes];
    const pair = sizes[index] + sizes[index + 1];
    const value = Math.max(0.15, Math.min(0.85, fraction));
    sizes[index] = pair * value;
    sizes[index + 1] = pair * (1 - value);
    return { ...root, sizes };
  }
  if (root.type !== "split" || !root.children[path[0]]) return root;
  return {
    ...root,
    children: root.children.map((child, childIndex) =>
      childIndex === path[0] ? resizeWorkspaceSplit(child, path.slice(1), index, fraction) : child,
    ),
  };
}
export function readWorkspaceSplitTree(value) {
  const ids = new Set();
  let count = 0;
  function parse(node, depth = 0) {
    if (!node || typeof node !== "object" || depth > 12) return null;
    if (node.type === "pane") {
      if (
        typeof node.paneId !== "string" ||
        !node.paneId ||
        ids.has(node.paneId) ||
        ++count > MAX_WORKSPACE_PANES ||
        (node.tabId !== null && (typeof node.tabId !== "string" || !node.tabId))
      )
        return null;
      ids.add(node.paneId);
      return { type: "pane", paneId: node.paneId, tabId: node.tabId };
    }
    if (
      node.type !== "split" ||
      !["row", "col"].includes(node.dir) ||
      !Array.isArray(node.children) ||
      node.children.length < 2 ||
      !Array.isArray(node.sizes) ||
      node.sizes.length !== node.children.length ||
      node.sizes.some((s) => !Number.isFinite(s) || s <= 0)
    )
      return null;
    const total = node.sizes.reduce((a, b) => a + b, 0);
    if (Math.abs(total - 1) > 1e-8) return null;
    const children = node.children.map((child) => parse(child, depth + 1));
    if (children.some((child) => !child)) return null;
    return { type: "split", dir: node.dir, sizes: node.sizes, children };
  }
  return parse(value);
}
export function workspaceSplitDrop(rect, x, y) {
  if (
    !rect ||
    x < rect.left ||
    x > rect.left + rect.width ||
    y < rect.top + 48 ||
    y > rect.top + rect.height
  )
    return null;
  const px = (x - rect.left) / rect.width;
  const py = (y - rect.top) / rect.height;
  return px < 0.28
    ? "left"
    : px > 0.72
      ? "right"
      : py < 0.3
        ? "top"
        : py > 0.7
          ? "bottom"
          : "center";
}
export function moveWorkspacePane(root, source, target, side) {
  const panes = listWorkspacePanes(root);
  const pane = panes.find((p) => p.paneId === source);
  if (!pane || source === target || !panes.some((p) => p.paneId === target)) return root;
  if (side === "center") {
    const other = panes.find((p) => p.paneId === target);
    function swap(node) {
      if (node.type === "pane")
        return node.paneId === source ? other : node.paneId === target ? pane : node;
      return { ...node, children: node.children.map(swap) };
    }
    return swap(root);
  }
  const removed = removeWorkspacePane(root, source);
  return removed ? insertWorkspacePane(removed, target, side, pane) : root;
}
