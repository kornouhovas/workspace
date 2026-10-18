import { useEffect, useState } from "react";
export function ColumnWidth({width, pending, label, onCommit, min = 120, max = 800}: {width: number; pending: boolean; label: string; onCommit(width: number): void; min?: number; max?: number}) {
  const [draft, setDraft] = useState(width);
  useEffect(() => { if (!pending) setDraft(width); }, [width, pending]);
  const commit = (value: string) => {const next = Number(value); if (next !== width) onCommit(next);};
  return <input type="range" min={min} max={max} step="1" aria-label={label} value={draft}
    onChange={event => setDraft(Number(event.currentTarget.value))}
    onPointerUp={event => commit(event.currentTarget.value)} onKeyUp={event => commit(event.currentTarget.value)}/>;
}
