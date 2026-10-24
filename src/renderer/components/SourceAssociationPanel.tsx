import { useEffect, useRef, useState } from "react";
import type { FolderMapping, SourceAssociationPreview } from "../../contracts/source-association.js";
import type { Language } from "../../contracts/settings.js";
import { WorkspaceServiceClient } from "../workspace-service-client.js";
import { StatusMessage } from "./bb-foundation.js";

const labels = {
  en: {open:"Review folder association", title:"Review folder association", explanation:"The old volume may not have been recorded. Confirming creates a new association; it does not prove historical continuity. Properties, views and unselected records are preserved.",
    archivedParent:"Original category of an archived project. Association preserves its inactive state; review the source mode separately.",archived:"Archived project. It stays archived; its original location is preserved.",select:"Choose each category and project explicitly. Approving the source alone does not approve its folders.", review:"Preview selected mappings", confirm:"I confirm that these folders should own the retained data", apply:"Confirm association", cancel:"Cancel", error:"Association was not confirmed. Refresh and review again.",
    pending:"Interrupted operation reservations are retained. Association review cannot authorize their recovery; inspect those operations before taking further folder actions.", retained:"Unmapped records retained", root:"Source root", unavailable:"This folder cannot be associated with the available evidence.", gate:"Folder actions await a safety update. Retained properties and saved views remain available.",
    reason:{verified:"Saved evidence matches this installation.",review_required:"The old volume was not recorded. Folder association needs review.",scope_unverified:"This installation has not approved the saved folder evidence.",different_volume:"A different volume is connected. Connect the expected disk and refresh.",folder_changed:"Folder identity differs from saved evidence. Retained data is unchanged.",evidence_unavailable:"Folder identity cannot be verified. Check access and filesystem support, then retry.",unsafe:"Folder state changed or its route is unsafe. Check the folder and refresh."}},
  ru: {open:"Проверить связь с папкой",title:"Проверка связи с папкой",explanation:"Прежний том мог не быть записан. Подтверждение создаёт новую связь и не доказывает историческую идентичность. Свойства, представления и невыбранные записи сохраняются.",
    archivedParent:"Исходная категория архивного проекта. Привязка сохранит её неактивное состояние; режим источника проверяется отдельно.",archived:"Архивный проект останется в архиве; исходное расположение сохранится.",select:"Выберите каждую категорию и проект явно. Подтверждение источника не подтверждает его папки.",review:"Предпросмотр выбранных связей",confirm:"Подтверждаю, что выбранным папкам следует передать сохранённые данные",apply:"Подтвердить связь",cancel:"Отмена",error:"Связь не подтверждена. Обновите данные и проверьте ещё раз.",
    pending:"Резервирования прерванных операций сохранены. Проверка связи не разрешает их восстановление; изучите операции перед дальнейшими действиями с папками.",retained:"Невыбранных записей сохранено",root:"Корень источника",unavailable:"Доступных данных недостаточно для подтверждения этой папки.",gate:"Действия с папками ожидают обновления проверок безопасности. Сохранённые свойства и представления доступны.",
    reason:{verified:"Сохранённые данные соответствуют этой установке.",review_required:"Прежний том не был записан. Требуется проверить связь с папкой.",scope_unverified:"Эта установка приложения ещё не подтвердила сохранённые данные о папке.",different_volume:"Подключён другой том. Подключите ожидаемый диск и обновите данные.",folder_changed:"Идентичность папки отличается от сохранённых данных. Сохранённые данные не изменены.",evidence_unavailable:"Не удалось проверить идентичность папки. Проверьте доступ и поддержку файловой системы, затем повторите.",unsafe:"Состояние папки изменилось или путь небезопасен. Проверьте папку и обновите данные."}},
};
export function SourceAssociationPanel({client,workspaceId,language,disabled=false,onCommitted,invalidation=0}: {
  client:WorkspaceServiceClient;workspaceId:string;language:Language;disabled?:boolean;onCommitted?():void;invalidation?:number;
}) {
  const l=labels[language];
  const [preview,setPreview]=useState<SourceAssociationPreview|null>(null),[mappings,setMappings]=useState<FolderMapping[]>([]);
  const [pending,setPending]=useState(false),[error,setError]=useState(false),[confirmed,setConfirmed]=useState(false),[dirty,setDirty]=useState(false);
  const version=useRef(0),opener=useRef<HTMLButtonElement>(null),activeToken=useRef<string|null>(null);
  activeToken.current=preview?.previewToken??null;
  const close=()=>{version.current++;setPreview(null);setConfirmed(false);setMappings([]);setError(false);setPending(false);queueMicrotask(()=>opener.current?.focus());};
  const cancel=async()=>{
    if(pending)return;
    if(!preview?.previewToken){close();return;}
    const current=++version.current;setPending(true);setConfirmed(false);
    try{const result=await client.cancelSourceAssociation(workspaceId,preview.previewToken);if(current!==version.current)return;
      if(result.ok)close();else setError(true);
    }catch{if(current===version.current)setError(true);}finally{if(current===version.current)setPending(false);}
  };
  useEffect(()=>{version.current++;setPreview(null);setConfirmed(false);setMappings([]);setPending(false);},[workspaceId,invalidation]);
  useEffect(()=>()=>{version.current++;if(activeToken.current)void client.cancelSourceAssociation(workspaceId,activeToken.current).catch(()=>{});},[client,workspaceId]);
  const review=async(selected:FolderMapping[])=>{
    const current=++version.current;setPending(true);setError(false);setConfirmed(false);
    try {const result=await client.previewSourceAssociation(workspaceId,selected);if(current!==version.current)return;
      if(result.ok){setPreview(result.value);setMappings(selected);setDirty(false);}else setError(true);
    }catch{if(current===version.current)setError(true);}finally{if(current===version.current)setPending(false);}
  };
  const apply=async()=>{
    if(!confirmed||dirty||!preview?.previewToken)return;
    const current=++version.current;setPending(true);setError(false);setConfirmed(false);
    const token=preview.previewToken;setPreview({...preview,previewToken:null});
    try{const result=await client.applySourceAssociation(workspaceId,token);if(current!==version.current)return;
      if(result.ok){close();onCommitted?.();}else setError(true);
    }catch{if(current===version.current)setError(true);}finally{if(current===version.current)setPending(false);}
  };
  const targetsFor=(candidate:SourceAssociationPreview['candidates'][number])=>preview?.targets.filter(target=>target.kind===candidate.kind &&
    (candidate.archived?target.archivedProjectId===candidate.id:candidate.archivedParent?target.archivedParentCategoryId===candidate.id:!target.archivedProjectId&&!target.archivedParentCategoryId))??[];
  return <section className="source-association" aria-label={l.title} aria-busy={pending}>
    <p>{l.gate}</p>
    {!preview&&<button ref={opener} type="button" className="workspace-button" disabled={disabled||pending} onClick={()=>void review([])}>{l.open}</button>}
    {error&&<StatusMessage kind="error" title={l.error}/>}
    {preview&&<div onKeyDown={event=>{if(event.key==="Escape"&&!pending){event.stopPropagation();void cancel();}}}>
      <h3>{l.title}</h3><p role="status">{l.reason[preview.reason]}</p><p>{l.explanation}</p>
      <p>{l.root}: <span className="workspace-root">{preview.canonicalRoot}</span></p><p>{l.select}</p>
      {preview.pendingOperations>0&&<StatusMessage kind="info" title={l.pending}/>}
      <fieldset disabled={pending||disabled}><legend>{l.title}</legend>
        {preview.candidates.map(candidate=><label key={candidate.id} className="source-association-mapping">
          <input type="checkbox" checked={mappings.some(m=>m.id===candidate.id)} disabled={!candidate.eligible&&!mappings.some(m=>m.id===candidate.id)}
            onChange={event=>{setConfirmed(false);setDirty(true);setMappings(current=>event.target.checked?[...current,{kind:candidate.kind,id:candidate.id,relativePath:candidate.relativePath}]:current.filter(m=>m.id!==candidate.id));}}/>
          <span className="workspace-root">{candidate.savedPath} → {candidate.relativePath}</span>
          {candidate.archived&&<span>{l.archived}</span>}
          {candidate.archivedParent&&<span>{l.archivedParent}</span>}
          <select disabled={candidate.archived||candidate.archivedParent} aria-label={`${candidate.savedPath}: ${l.review}`} value={mappings.find(m=>m.id===candidate.id)?.relativePath??candidate.relativePath} onChange={event=>{
            setConfirmed(false);setDirty(true);setMappings(current=>[...current.filter(m=>m.id!==candidate.id),{kind:candidate.kind,id:candidate.id,relativePath:event.target.value}]);
          }}>
            {!targetsFor(candidate).some(t=>t.relativePath===candidate.relativePath)&&<option value={candidate.relativePath}>{candidate.relativePath}</option>}
            {targetsFor(candidate).map(target=><option key={target.relativePath} value={target.relativePath}>{target.relativePath}</option>)}
          </select>{!candidate.eligible&&<span>{l.reason[candidate.reason]} {l.unavailable}</span>}
        </label>)}
      </fieldset>
      <p>{l.retained}: {preview.retainedCount}</p>
      <button type="button" className="workspace-button" disabled={pending||disabled} onClick={()=>void review(mappings)}>{l.review}</button>
      <label className="source-association-mapping"><input type="checkbox" checked={confirmed} disabled={pending||dirty||!preview.previewToken||disabled} onChange={event=>setConfirmed(event.target.checked)}/>{l.confirm}</label>
      <div className="workspace-form-actions"><button type="button" className="workspace-button" disabled={pending||disabled||dirty||!confirmed||!preview.previewToken} onClick={()=>void apply()}>{l.apply}</button>
        <button type="button" className="workspace-button workspace-button--secondary" disabled={pending} onClick={()=>void cancel()}>{l.cancel}</button></div>
    </div>}
  </section>;
}
