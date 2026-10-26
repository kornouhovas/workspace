import {useEffect,useRef,useState} from "react";
import {categoryColors,type CategoryColor} from "../../contracts/category-options.js";
import type {CategorySummary} from "../../contracts/workspaces.js";
import type {Language} from "../../contracts/settings.js";
import type {WorkspaceServiceClient} from "../workspace-service-client.js";
import {translate,type TranslationKey} from "../localization.js";

const colorLabels: Record<CategoryColor,TranslationKey>={default:"categoryDefault",gray:"categoryGray",red:"categoryRed",orange:"categoryOrange",yellow:"categoryYellow",green:"categoryGreen",blue:"categoryBlue",purple:"categoryPurple"};
export const statusColorLabels={
  en:{color:"Status color",actions:"Status actions",scope:"Status colors apply only to this workspace.",saving:"Saving status color…",error:"Could not load or save status color. Refresh before trying again.",refresh:"Refresh"},
  ru:{color:"Цвет статуса",actions:"Действия со статусом",scope:"Цвета статусов относятся только к этому рабочему пространству.",saving:"Сохранение цвета статуса…",error:"Не удалось загрузить или сохранить цвет статуса. Обновите данные перед повторной попыткой.",refresh:"Обновить"},
};

export function StatusColorEditor(props:{client:WorkspaceServiceClient;workspaceId:string;category:Pick<CategorySummary,"categoryId"|"relativePath"|"presentation">;language:Language;disabled:boolean}) {
  return <ColorEditor key={`${props.workspaceId}:${props.category.categoryId}`} {...props}/>;
}
function ColorEditor({client,workspaceId,category,language,disabled}:Parameters<typeof StatusColorEditor>[0]) {
  const l=statusColorLabels[language];
  const [color,setColor]=useState<CategoryColor>(category.presentation?.color??"default"),[pending,setPending]=useState(false),[error,setError]=useState(false);
  const propRevision=useRef(0);
  const generation=useRef(0),busy=useRef(false),select=useRef<HTMLSelectElement>(null),restoreFocus=useRef(false);
  useEffect(()=>{propRevision.current++;setColor(category.presentation?.color??"default");},[category.presentation?.color]);
  useEffect(()=>()=>{generation.current++;},[]);
  useEffect(()=>{if(!pending&&restoreFocus.current){restoreFocus.current=false;if(document.activeElement===document.body)select.current?.focus({preventScroll:true});}},[pending]);
  const update=async(next?:CategoryColor)=>{
    if(busy.current||disabled)return;
    busy.current=true;const request=++generation.current,observedRevision=propRevision.current;
    restoreFocus.current=document.activeElement===select.current;setPending(true);setError(false);
    try{
      const result=next===undefined ? await client.listCategoryPresentation({workspaceId}) : await client.setCategoryColor({workspaceId,categoryId:category.categoryId,color:next});
      if(request!==generation.current)return;
      const saved=result.ok&&result.value.workspaceId===workspaceId ? result.value.options.find(option=>option.categoryId===category.categoryId) : null;
      if(saved){if(observedRevision===propRevision.current)setColor(saved.color);}else setError(true);
    }catch{if(request===generation.current)setError(true);}
    finally{if(request===generation.current){busy.current=false;setPending(false);}}
  };
  return <div className="status-color-editor" aria-busy={pending}>
    <label><span>{l.color}</span><select ref={select} className="bb-select" aria-label={`${l.color}: ${category.relativePath}`} value={color} disabled={disabled||pending||error} onChange={event=>void update(event.currentTarget.value as CategoryColor)}>
      {categoryColors.map(value=><option key={value} value={value}>{translate(language,colorLabels[value])}</option>)}
    </select></label>
    {pending&&<span role="status">{l.saving}</span>}
    {error&&<><span role="alert">{l.error}</span><button type="button" className="workspace-button workspace-button--secondary" disabled={disabled||pending} onClick={()=>void update()}>{l.refresh}</button></>}
  </div>;
}
