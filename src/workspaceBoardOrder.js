// Board rank is view metadata keyed by opaque status IDs. Missing statuses retain
// their slots so filtering and source availability do not destroy preferences.
export function completeBoardColumnOrder(saved = [], statusIds = []) {
  return [...new Set([...(Array.isArray(saved) ? saved : []), ...(Array.isArray(statusIds) ? statusIds : [])].filter(id => typeof id === 'string' && id))];
}
export function reorderBoardColumns(order, visibleIds, activeId, targetIndex) {
  const visible = completeBoardColumnOrder([], visibleIds);
  const from = visible.indexOf(activeId);
  const to = Math.max(0, Math.min(visible.length - 1, targetIndex));
  if (from < 0 || from === to) return null;
  const next = [...visible]; next.splice(from, 1); next.splice(to, 0, activeId);
  const visibleSet = new Set(visible);
  let index = 0;
  return completeBoardColumnOrder(order, visible).map(id => visibleSet.has(id) ? next[index++] : id);
}

// Temporary interaction state: headers can diverge only during preview. A drop
// synchronously applies both before persistence; failure restores both together.
export function createBoardOrderSession(order = [], visibleIds = order) {
  let confirmed, bodies, headers, visible, activeId = null, pending = null, version = 0;
  function reset(next, nextVisible = next) {
    confirmed = completeBoardColumnOrder(next, nextVisible); bodies = [...confirmed]; headers = [...confirmed];
    visible = completeBoardColumnOrder([], nextVisible); activeId = null; pending = null; version++;
  }
  reset(order, visibleIds);
  return {
    reset,
    snapshot: () => ({ headers: [...headers], bodies: [...bodies], activeId, pending }),
    start(id) {
      if (pending !== null || activeId !== null || !visible.includes(id)) return false;
      activeId = id; headers = [...bodies]; return true;
    },
    preview(index) {
      if (activeId === null) return;
      const currentVisible = bodies.filter(id => visible.includes(id));
      headers = reorderBoardColumns(bodies, currentVisible, activeId, index) ?? [...bodies];
    },
    cancel() { activeId = null; headers = [...bodies]; },
    drop(valid) {
      if (activeId === null) return null;
      activeId = null;
      if (!valid || headers.every((id, index) => id === bodies[index])) { headers = [...bodies]; return null; }
      bodies = [...headers]; pending = ++version;
      return { token: pending, order: [...bodies] };
    },
    settle(token, success) {
      if (pending !== token) return false;
      if (success) confirmed = [...bodies]; else bodies = [...confirmed];
      headers = [...bodies]; pending = null; return true;
    },
  };
}

export function boardOrderPointerActivated(startX, startY, x, y) {
  return Math.abs(x - startX) >= 6;
}
export function boardOrderPointerInside(rect, x, y) {
  return !!rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}
export function boardOrderScrollSpeed(rect, x) {
  const edge = 40;
  return x < rect.left + edge ? -Math.ceil((rect.left + edge - x) / 4)
    : x > rect.right - edge ? Math.ceil((x - rect.right + edge) / 4) : 0;
}
export function boardOrderPointerIndex(x, scrollLeft, firstCenter, step) {
  return Math.round((x + scrollLeft - firstCenter) / step);
}

// The captured slot geometry is independent of animated header rectangles.
// Pointer displacement is continuous; only the insertion rank is rounded.
export function boardOrderDragGeometry(origin, x, y, scrollLeft, scrollTop) {
  const dx = x - origin.startX + scrollLeft - origin.scrollLeft;
  // Y belongs to the Board header line, including when the Board scrolls.
  return { x: dx, y: 0, index: origin.sourceIndex + Math.round(dx / origin.step) };
}
