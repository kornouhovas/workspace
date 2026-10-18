import { defaultBoardLayout, defaultBoardColumnWidth, type BoardLayoutConfig } from "../../contracts/board-layout.js";
import type { ViewGroup } from "../../contracts/view-grouping.js";
import type { WorkspaceServiceClient } from "../workspace-service-client.js";
import type { Language } from "../../contracts/settings.js";
import { translate, type TranslationKey } from "../localization.js";
import { useViewPresentation } from "./useViewPresentation.js";
import { ColumnWidth } from "./ColumnWidth.js";
import { StatusMessage } from "./bb-foundation.js";
const adapter = {
  load: (client: WorkspaceServiceClient, workspaceId: string, viewId: string) => client.getBoardLayout(workspaceId, viewId),
  save: (client: WorkspaceServiceClient, workspaceId: string, viewId: string, config: BoardLayoutConfig) => client.setBoardLayout(workspaceId, viewId, config),
};
export function useBoardLayout(client: WorkspaceServiceClient, workspaceId: string, viewId: string | undefined) {
  return useViewPresentation(client, workspaceId, viewId, adapter);
}
export function boardColumnWidth(config: BoardLayoutConfig | null, propertyId: string | null | undefined, key: string) {
  return config?.widths.find(c => c.propertyId === propertyId && c.key === key)?.width ?? defaultBoardColumnWidth;
}
interface Props {
  state: ReturnType<typeof useBoardLayout>;
  fields: {propertyId: string; name: string}[];
  groups: ViewGroup[] | null;
  groupPropertyId: string | null;
  language: Language;
  disabled: boolean;
}
export function BoardLayoutControls({state, fields, groups, groupPropertyId, language, disabled}: Props) {
  const t = (key: TranslationKey) => translate(language, key);
  const changeWidth = (key: string, width: number) => {
    if (!state.config || !groupPropertyId) return;
    void state.save({...state.config, widths:[...state.config.widths.filter(c => c.propertyId !== groupPropertyId || c.key !== key), {propertyId:groupPropertyId, key, width}]});
  };
  return <section className="board-layout-controls" aria-label={t("boardLayoutTitle")} aria-busy={state.loading || state.pending}>
    <details><summary>{t("boardLayoutTitle")}</summary><p>{t("boardLayoutHint")}</p>
      <fieldset disabled={disabled || state.pending || state.loading || !state.config}>
        <label><input type="checkbox" aria-label={t("boardWrap")} checked={state.config?.wrap ?? true} onChange={event => {if (state.config) void state.save({...state.config, wrap:event.currentTarget.checked});}}/>{t("boardWrap")}</label>
        {fields.map(field => <label key={field.propertyId} className="board-property-control"><span className={field.propertyId === "name" ? undefined : "property-authored"}>{field.name}</span>
          <input type="checkbox" aria-label={`${t("boardPropertyVisible")}: ${field.name}`} disabled={field.propertyId === "name"} checked={!state.config?.properties.find(p => p.propertyId === field.propertyId)?.hidden}
            onChange={event => { if (state.config) void state.save({...state.config, properties:[...state.config.properties.filter(p => p.propertyId !== field.propertyId), {propertyId:field.propertyId, hidden:!event.currentTarget.checked}]}); }}/>{t("boardPropertyVisible")}
        </label>)}
        {groups?.map(group => {
          const label = group.value === null ? t("groupNoValue") : group.label ?? String(group.value);
          const width = boardColumnWidth(state.config, groupPropertyId, group.key);
          return <label className="board-column-control" key={group.key}><span className="property-authored">{label}</span> {t("boardColumnWidth")}
            <ColumnWidth min={180} width={width} pending={state.pending} label={`${t("boardColumnWidth")}: ${label}`} onCommit={width => changeWidth(group.key, width)}/><output>{width}px</output>
          </label>;
        })}
      </fieldset>
    </details>
    {state.loading && <StatusMessage kind="info" title={t("boardLayoutLoading")}/>}
    {state.pending && <StatusMessage kind="info" title={t("boardLayoutSaving")}/>}
    {state.error && <><StatusMessage kind="error" title={t("boardLayoutError")}/><button type="button" disabled={state.pending || state.loading} onClick={() => void state.load()}>{t("viewsRetry")}</button>
      <button type="button" disabled={disabled || state.pending || state.loading} onClick={() => void state.save(defaultBoardLayout())}>{t("boardLayoutReset")}</button></>}
  </section>;
}
