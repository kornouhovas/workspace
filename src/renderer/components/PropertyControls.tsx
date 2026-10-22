import { useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from "react";
import * as Popover from "@radix-ui/react-popover";
import type { PropertyDefinition, PropertySnapshot } from "../../contracts/text-properties.js";
import type { Language } from "../../contracts/settings.js";
import type { WorkspaceServiceClient } from "../workspace-service-client.js";
import { translate, type TranslationKey } from "../localization.js";
import { contextOwner } from "./ContextTools.js";
import { useDraftGuard } from "./ScalarDrafts.js";
import { MetadataRemovalPanel } from "./MetadataRemovalPanel.js";
import { SelectOptionsEditor, type OptionsEditorState } from "./SelectOptionsEditor.js";
import { StatusMessage } from "./bb-foundation.js";
import { Hint } from "./Hint.js";
import { Icon } from "./Icons.js";

type PropertyType = PropertyDefinition["propertyType"];
interface Props {
  client: WorkspaceServiceClient; workspaceId: string; sourceId: string;
  snapshot: PropertySnapshot | null; language: Language; disabled: boolean;
  fallbackFocus: RefObject<HTMLButtonElement | null>;
  property?: PropertyDefinition; onCommitted(snapshot: PropertySnapshot): void;
  onObserved(): Promise<void>;
}
const types: {type: PropertyType; label: TranslationKey}[] = [
  {type:"text",label:"propertyTypeText"}, {type:"number",label:"propertyTypeNumber"},
  {type:"date",label:"propertyTypeDate"}, {type:"single_select",label:"propertyTypeSelect"},
  {type:"multi_select",label:"propertyTypeMultiSelect"},
];
export function PropertyControls(props: Props) {
  const [open, setOpen] = useState(false);
  const [owner, setOwner] = useState<string | undefined>(undefined);
  const ownTrigger = useRef<HTMLButtonElement>(null);
  const trigger = props.property ? ownTrigger : props.fallbackFocus;
  const openAtUnmount = useRef(open); openAtUnmount.current = open;
  const t = (key: TranslationKey) => translate(props.language,key);
  const label = props.property ? `${t("renameProperty")}: ${props.property.name}` : t("addProperty");
  const returnFocus = () => window.requestAnimationFrame(() => {
    const fallback = props.fallbackFocus.current;
    const target = trigger.current?.isConnected ? trigger.current : fallback;
    const owner = contextOwner(target ?? null);
    (target?.closest("[hidden]") && owner ? document.getElementById(owner) : target)?.focus();
  });
  useEffect(() => () => { if (openAtUnmount.current) returnFocus(); }, []);
  const canClose = useRef(() => true);
  return <Popover.Root open={open} onOpenChange={next => { if (next || canClose.current()) { if (next) setOwner(contextOwner(trigger.current)); setOpen(next); } }}>
    <Hint label={label}><Popover.Trigger asChild><button ref={trigger} type="button" className="workspace-button workspace-button--secondary property-rename" aria-label={label}
      data-add-property={props.property ? undefined : props.workspaceId} disabled={props.disabled}>
      <Icon name={props.property ? "edit" : "plus"}/>{!props.property && t("addProperty")}
    </button></Popover.Trigger></Hint>
    {open && <Popover.Portal container={document.body}><PropertyEditor {...props} owner={owner} canClose={canClose} close={() => { setOpen(false); returnFocus(); }} /></Popover.Portal>}
  </Popover.Root>;
}
function PropertyEditor({property, owner, canClose, close, ...props}: Props & {owner?:string; canClose:{current:()=>boolean}; close():void}) {
  const t = (key: TranslationKey) => translate(props.language,key), id=useId();
  const guard=useDraftGuard();
  const [name,setName]=useState(property?.name ?? "");
  const [type,setType]=useState<PropertyType>(property?.propertyType ?? "text");
  const [pending,setPending]=useState(false);
  const [error,setError]=useState<TranslationKey | null>(null);
  const [removal,setRemoval]=useState<{optionId:string | null} | null>(null);
  const [optionState,setOptionState]=useState<OptionsEditorState>({busy:false,failed:false});
  const saving=useRef(false), alive=useRef(true), input=useRef<HTMLInputElement>(null), remove=useRef<HTMLButtonElement>(null);
  const removalTrigger=useRef<HTMLButtonElement | null>(null);
  const originalName=useRef(property?.name);
  useEffect(()=>{alive.current=true;return ()=>{alive.current=false;};},[]);
  const blocked = pending || removal !== null || optionState.busy || optionState.failed;
  const dirty = !property || name !== originalName.current || error !== null;
  canClose.current=()=>!saving.current && !blocked && !dirty;
  useLayoutEffect(()=>{
    if (!dirty && !blocked) return;
    return guard?.register({commit:()=>Promise.resolve(false),focus:()=>input.current?.focus()});
  },[guard,dirty,blocked]);
  const save=async()=>{
    if(saving.current || props.disabled || blocked) return;
    if(!name.trim()){setError("propertyValidation");input.current?.focus();return;}
    saving.current=true;setPending(true);setError(null);
    try {
      const result=property ? await props.client.renameProperty(props.workspaceId,property.propertyId,name) : await props.client.createProperty(props.workspaceId,name,type);
      if(!alive.current) return;
      if(result.ok && result.value.snapshot.workspaceId===props.workspaceId && result.value.snapshot.sourceId===props.sourceId){props.onCommitted(result.value.snapshot);close();}
      else setError(!result.ok && result.error.code==="invalid_input" ? "propertyValidation":"propertySaveError");
    } catch {if(alive.current)setError("propertySaveError");}
    finally {if(alive.current){saving.current=false;setPending(false);}}
  };
  const cancelReview=()=>{setRemoval(null);window.requestAnimationFrame(()=>(removalTrigger.current?.isConnected ? removalTrigger.current : remove.current)?.focus());};
  return <Popover.Content data-context-owner={owner} collisionPadding={12} className="context-popover property-management-popover" align="start" sideOffset={4} aria-label={t("propertyTools")}
    onOpenAutoFocus={event=>{event.preventDefault();input.current?.focus();}}
    onCloseAutoFocus={event=>event.preventDefault()}
    onEscapeKeyDown={event=>{event.preventDefault();if(removal || optionState.busy)return;event.stopPropagation();if(!saving.current)close();}}
    onInteractOutside={event=>{if(dirty || blocked)event.preventDefault();}}>
    {removal && property && <MetadataRemovalPanel client={props.client} workspaceId={props.workspaceId} sourceId={props.sourceId} property={property}
      optionId={removal.optionId} options={props.snapshot?.selectOptions ?? []} language={props.language} disabled={props.disabled}
      onCancel={cancelReview} onCommitted={()=>{if(removal.optionId===null)close();else cancelReview();}} onObserved={props.onObserved}/>}
      <div hidden={removal !== null}>
      <form className="property-form" aria-busy={pending} onSubmit={event=>{event.preventDefault();void save();}}>
        <label htmlFor={`${id}-name`}>{t("propertyName")}</label>
        <input ref={input} id={`${id}-name`} className="workspace-input" value={name} disabled={props.disabled || blocked} aria-invalid={error==="propertyValidation"} onChange={event=>setName(event.currentTarget.value)}/>
        {!property ? <><label htmlFor={`${id}-type`}>{t("propertyType")}</label><select id={`${id}-type`} className="workspace-input" value={type} disabled={props.disabled || blocked} onChange={event=>setType(event.currentTarget.value as PropertyType)}>
          {types.map(item=><option key={item.type} value={item.type}>{t(item.label)}</option>)}
        </select></> : <p className="text-value-hint">{t("propertyType")}: {t(types.find(item=>item.type===property.propertyType)!.label)}</p>}
        <div className="workspace-form-actions"><button type="submit" className="workspace-button" disabled={props.disabled || blocked}>{t(pending?"propertySaving":"savePropertyName")}</button>
          <button type="button" className="workspace-button workspace-button--secondary" disabled={pending || removal !== null || optionState.busy} onClick={close}>{t("cancelRenameWorkspace")}</button></div>
      </form>
      {error && <StatusMessage kind="error" title={t(error)}/>}
      {property && property.name!==originalName.current && <StatusMessage kind="info" title={t("propertyExternalChange")}/>}
      {property && <button ref={remove} type="button" className="workspace-button workspace-button--secondary" disabled={props.disabled || blocked} onClick={event=>{removalTrigger.current=event.currentTarget;setRemoval({optionId:null});}}>{t("metadataDeleteProperty")}</button>}
      {property && props.snapshot && (type==="single_select" || type==="multi_select") && <SelectOptionsEditor client={props.client} workspaceId={props.workspaceId} property={property} snapshot={props.snapshot}
        language={props.language} disabled={props.disabled || pending} onCommitted={props.onCommitted} onStateChange={setOptionState}
        onRemove={(optionId,trigger)=>{removalTrigger.current=trigger;setRemoval({optionId});}}/>}
    </div>
  </Popover.Content>;
}
