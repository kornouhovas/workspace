import { Hint } from "./Hint.js";
import { Icon } from "./Icons.js";
import type { AssignProjectGroupCommand } from "../../contracts/group-assignment.js";
import { isAssignProjectGroupCommand } from "../../contracts/group-assignment.js";
import type { ViewGroup } from "../../contracts/view-grouping.js";
import type { Language } from "../../contracts/settings.js";
import { translate } from "../localization.js";

export const groupAssignmentMime = "application/x-workspace-group-assignment";
export function readGroupDrop(raw: string, context: {workspaceId: string; viewId: string; propertyId: string; archived: boolean}, toKey: string): AssignProjectGroupCommand | null {
  try {
    const input: unknown = JSON.parse(raw);
    if (!isAssignProjectGroupCommand(input) || input.workspaceId !== context.workspaceId || input.viewId !== context.viewId || input.propertyId !== context.propertyId || input.archived !== context.archived) return null;
    return {...input, toKey};
  } catch { return null; }
}
interface Props {
  command: AssignProjectGroupCommand;
  groups: ViewGroup[];
  projectName: string;
  language: Language;
  disabled: boolean;
  controlRef(element: HTMLSelectElement | null): void;
  onDragBegin(command: AssignProjectGroupCommand, trigger: HTMLButtonElement): void;
  onDragFinish(): void;
  onAssign(command: AssignProjectGroupCommand): void;
}
export function GroupAssignment({command, groups, projectName, language, disabled, controlRef, onAssign, onDragBegin, onDragFinish}: Props) {
  const unavailable = (group: ViewGroup) => group.assignmentUnavailable ? translate(language, group.assignmentUnavailable === "no_status" ? "statusNoDestination" : group.assignmentUnavailable === "nested_status" ? "statusNestedDestination" : "statusUnavailableDestination") : null;
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  return <div className="group-assignment-controls">
    <Hint label={`${t("groupAssignmentDrag")}: ${projectName}`}><button type="button" disabled={disabled} draggable={!disabled} aria-label={`${t("groupAssignmentDrag")}: ${projectName}`}
      onDragEnd={onDragFinish} onDragStart={event => {event.stopPropagation(); onDragBegin(command, event.currentTarget); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData(groupAssignmentMime, JSON.stringify(command));}}><Icon name="drag"/></button></Hint>
    <label><span className="sr-only">{t("groupAssignmentChoose")}</span><select ref={controlRef} className="workspace-input" aria-label={`${t("groupAssignmentChoose")}: ${projectName}`} value={command.fromKey} disabled={disabled}
      onChange={event => { if (!groups.find(group=>group.key===event.currentTarget.value)?.assignmentUnavailable) onAssign({...command, toKey: event.currentTarget.value}); }}>
      {groups.filter(group => !group.hidden || group.key === command.fromKey).map(group => <option key={group.key} value={group.key} disabled={!!group.assignmentUnavailable}>{group.value === null ? t(group.assignmentUnavailable === "no_status" ? "groupNoStatus" : "groupNoValue") : group.label ?? String(group.value)}{unavailable(group) ? ` · ${unavailable(group)}` : ""}</option>)}
    </select></label>
    {groups.some(group => group.key === "null") && <Hint label={`${t("groupAssignmentClear")}: ${projectName}`}><button type="button" aria-label={`${t("groupAssignmentClear")}: ${projectName}`} disabled={disabled || command.fromKey === "null" || !groups.some(group => group.key === "null" && !group.hidden && !group.assignmentUnavailable)}
      onClick={() => onAssign({...command,toKey:"null"})}><Icon name="close"/></button></Hint>}
  </div>;
}
