import { useState, type RefObject } from "react";
import { PresentationPopover } from "./PresentationPopover.js";
import { useViewPresentation } from "./useViewPresentation.js";
import { ColumnWidth } from "./ColumnWidth.js";
import { defaultTableLayout, orderedProjectIds, type TableColumn, type TableLayoutConfig } from "../../contracts/table-layout.js";
import type { WorkspaceServiceClient } from "../workspace-service-client.js";
import type { Language } from "../../contracts/settings.js";
import { translate, type TranslationKey } from "../localization.js";
import { StatusMessage } from "./bb-foundation.js";
export interface TableField { propertyId: string; name: string; text: boolean }
const tableAdapter = {
  load: (client: WorkspaceServiceClient, workspaceId: string, viewId: string) => client.getTableLayout(workspaceId, viewId),
  save: (client: WorkspaceServiceClient, workspaceId: string, viewId: string, config: TableLayoutConfig) => client.setTableLayout(workspaceId, viewId, config),
};
export function useTableLayout(client: WorkspaceServiceClient, workspaceId: string, viewId: string | undefined) {
  return useViewPresentation(client, workspaceId, viewId, tableAdapter);
}
export function tableColumns(config: TableLayoutConfig | null, fields: TableField[]): TableColumn[] {
  const available = new Set(fields.map(f => f.propertyId));
  const saved = new Set(config?.columns.map(c => c.propertyId));
  return [...(config?.columns.filter(c => available.has(c.propertyId)) ?? []), ...fields.filter(f => !saved.has(f.propertyId)).map(f => ({propertyId: f.propertyId, hidden: false, width: 224, wrap: f.text}))];
}
interface Props {
  state: ReturnType<typeof useTableLayout>; fields: TableField[]; language: Language; disabled: boolean; propertyId?: string; layoutTrigger?: RefObject<HTMLButtonElement | null>;
}
export function TableLayoutControls({state, fields, language, disabled, propertyId, layoutTrigger}: Props) {
  const [open, setOpen] = useState(false);
  const t = (key: TranslationKey) => translate(language, key);
  const columns = tableColumns(state.config, fields);
  const change = (next: TableColumn[]) => {
    if (!state.config) return;
    // Preserve settings for currently dormant properties.
    void state.save({...state.config, columns: [...next, ...state.config.columns.filter(c => !fields.some(f => f.propertyId === c.propertyId))]});
  };
  const move = (index: number, delta: number) => {
    const next = [...columns], target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]]; change(next);
  };
  const label = propertyId ? `${t("tableColumnSettings")}: ${fields.find(field => field.propertyId === propertyId)?.name ?? ""}` : t("tableTitle");
  const feedback = <>
    {state.loading && <StatusMessage kind="info" title={t("tableLoading")}/>}
    {state.pending && <StatusMessage kind="info" title={t("tableSaving")}/>}
    {state.error && <><StatusMessage kind="error" title={t("tableError")}/><button type="button" disabled={state.pending || state.loading} onClick={() => void state.load()}>{t("viewsRetry")}</button>
      <button type="button" disabled={disabled || state.pending || state.loading} onClick={() => void state.save(defaultTableLayout())}>{t("tableReset")}</button></>}
  </>;
  return <div className="table-layout-controls" aria-busy={state.loading || state.pending}>
    <PresentationPopover compact={!!propertyId} label={label} onOpenChange={setOpen} triggerRef={propertyId ? undefined : layoutTrigger} fallbackFocus={propertyId ? layoutTrigger : undefined}><p>{t("tableHint")}</p>
    <fieldset disabled={disabled || state.loading || state.pending || !state.config}>
      {columns.map((column, index) => {
        if (propertyId && column.propertyId !== propertyId) return null;
        const field = fields.find(f => f.propertyId === column.propertyId)!;
        const update = (patch: Partial<TableColumn>) => change(columns.map(c => c.propertyId === column.propertyId ? {...c, ...patch} : c));
        return <div className="table-column-control" key={column.propertyId}>
          <span className={field.propertyId === "name" ? undefined : "property-authored"}>{field.name}</span>
          <label><input type="checkbox" aria-label={`${t("tableVisible")}: ${field.name}`} checked={!column.hidden} disabled={column.propertyId === "name"} onChange={event => update({hidden: !event.currentTarget.checked})}/>{t("tableVisible")}</label>
          <button type="button" disabled={index === 0} aria-label={`${t("tableColumnEarlier")}: ${field.name}`} onClick={() => move(index, -1)}>{t("tableColumnEarlier")}</button>
          <button type="button" disabled={index === columns.length - 1} aria-label={`${t("tableColumnLater")}: ${field.name}`} onClick={() => move(index, 1)}>{t("tableColumnLater")}</button>
          <label>{t("tableWidth")}<ColumnWidth width={column.width} pending={state.pending} label={`${t("tableWidth")}: ${field.name}`} onCommit={width => update({width})}/><output>{column.width}px</output></label>
          {field.text && <label><input type="checkbox" aria-label={`${t("tableWrap")}: ${field.name}`} checked={column.wrap} onChange={event => update({wrap:event.currentTarget.checked})}/>{t("tableWrap")}</label>}
        </div>;
      })}
    </fieldset>
    {feedback}
    </PresentationPopover>
    {!propertyId && !open && feedback}
  </div>;
}
export function moveTableRow(config: TableLayoutConfig, current: string[], projectId: string, targetId: string): TableLayoutConfig {
  const complete = [...config.rowOrder, ...current.filter(id => !config.rowOrder.includes(id))];
  const from = complete.indexOf(projectId), to = complete.indexOf(targetId);
  if (from < 0 || to < 0 || from === to) return config;
  complete.splice(from, 1); complete.splice(to, 0, projectId);
  return {...config, rowOrder: complete};
}
export { orderedProjectIds };

