import {StatusColorEditor,statusColorLabels} from "./StatusColorEditor.js";
import type {CategorySummary} from "../../contracts/workspaces.js";
import {useEffect,useRef,useState} from "react";
import type {Language} from "../../contracts/settings.js";
import type {DiscoveryPreview,FolderChildren,FolderRole,FolderRoleOverride} from "../../contracts/workspaces.js";
import type {WorkspaceServiceClient} from "../workspace-service-client.js";
import {StatusMessage} from "./bb-foundation.js";

export const folderLabels={
  en:{title:"Folder roles",description:"Groups and statuses contain other folders. Discovery stops at projects. A project uses its nearest status, or No status. Changing roles does not move folders.",group:"Group",status:"Status",project:"Project",role:"Role",expand:"Expand",collapse:"Collapse",exclude:"Exclude",review:"Review changes",apply:"Apply folder configuration",cancel:"Cancel",confirm:"I reviewed the shared impact",shared:"Affected workspaces — folder roles and exclusions are shared; views remain independent.",retained:"Projects no longer discovered keep their properties and references for recovery.",added:"New projects",kept:"Retained projects",removed:"No longer discovered",error:"Could not load or save folder configuration. Refresh and review again.",stale:"Folder configuration changed. Review the current impact again.",retry:"Refresh",empty:"No folders",unavailable:"Folder access needs attention. Use the association and availability controls below."},
  ru:{title:"Роли папок",description:"Группы и статусы содержат другие папки. Обнаружение останавливается на проектах. Проект получает ближайший статус или «Без статуса». Смена роли не перемещает папки.",group:"Группа",status:"Статус",project:"Проект",role:"Роль",expand:"Раскрыть",collapse:"Свернуть",exclude:"Исключить",review:"Проверить изменения",apply:"Применить настройку папок",cancel:"Отмена",confirm:"Я проверил влияние на общие данные",shared:"Затронутые рабочие пространства — роли и исключения общие, виды остаются независимыми.",retained:"Свойства и ссылки проектов, которые больше не обнаруживаются, сохранятся для восстановления.",added:"Новые проекты",kept:"Сохранённые проекты",removed:"Больше не обнаруживаются",error:"Не удалось загрузить или сохранить настройку папок. Обновите и проверьте ещё раз.",stale:"Настройка папок изменилась. Проверьте актуальное влияние ещё раз.",retry:"Обновить",empty:"Нет папок",unavailable:"Нужно проверить доступ к папке. Используйте настройки связи и доступности ниже."},
};

export function FolderRolesPanel({client,workspaceId,language,disabled,invalidation,onCommitted,onPendingChange}:{client:WorkspaceServiceClient;workspaceId:string;language:Language;disabled:boolean;invalidation:number;onCommitted():void;onPendingChange(pending:boolean):void}) {
  const l=folderLabels[language];
  const [categories,setCategories]=useState<CategorySummary[]>([]),[colorError,setColorError]=useState(false),[colorRefresh,setColorRefresh]=useState(0);
  useEffect(()=>{
    let active=true,request=0;
    const loadColors=async()=>{
      const current=++request;
      try{const result=await client.listProjects(workspaceId);
        if(!active||current!==request)return;
        if(result.ok){setCategories(result.value.categories);setColorError(false);}else setColorError(true);
      }catch{if(active&&current===request)setColorError(true);}
    };
    void loadColors();
    const stop=client.onWorkspaceChange(event=>{
      if((event.type==="workspace.categoryPresentationChanged"||event.type==="workspace.projectsChanged")&&event.workspaceIds.includes(workspaceId))void loadColors();
    });
    return()=>{active=false;request++;stop();};
  },[client,workspaceId,invalidation,colorRefresh]);
  const [root,setRoot]=useState<FolderChildren|null>(null),[branches,setBranches]=useState<Record<string,FolderChildren["children"]>>({});
  const [expanded,setExpanded]=useState<string[]>([]),[roles,setRoles]=useState<FolderRoleOverride[]>([]),[exclusions,setExclusions]=useState<string[]>([]);
  const [dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(false),[stale,setStale]=useState(false);
  const [preview,setPreview]=useState<DiscoveryPreview|null>(null),[confirmed,setConfirmed]=useState(false);
  const generation=useRef(0),mounted=useRef(true),reviewButton=useRef<HTMLButtonElement>(null),reviewHeading=useRef<HTMLHeadingElement>(null);
  const editingControl=useRef<HTMLElement|null>(null),refreshButton=useRef<HTMLButtonElement>(null),returnFocus=useRef(false);
  useEffect(()=>{
    if(!returnFocus.current||busy)return;
    (editingControl.current?.isConnected?editingControl.current:refreshButton.current)?.focus({preventScroll:true});returnFocus.current=false;
  },[busy,dirty,preview]);
  const callback=useRef(onPendingChange);callback.current=onPendingChange;
  useEffect(()=>{callback.current(dirty||busy);},[dirty,busy]);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;generation.current++;callback.current(false);};},[]);
  const expandedPaths=useRef(expanded);expandedPaths.current=expanded;
  const load=async(preserveExpansion=false)=>{
    const version=++generation.current;setBusy(true);setError(false);
    try {
      const result=await client.getFolderChildren(workspaceId,"");
      if(!mounted.current||version!==generation.current)return;
      if(!result.ok){setError(true);return;}
      const paths=preserveExpansion ? expandedPaths.current : [];
      const nested=await Promise.all(paths.map(async path=>({path,result:await client.getFolderChildren(workspaceId,path)})));
      if(!mounted.current||version!==generation.current)return;
      if(nested.some(branch=>!branch.result.ok || branch.result.value.revision!==result.value.revision)){setStale(true);return;}
      setRoot(result.value);setBranches(Object.fromEntries([["",result.value.children],...nested.map(branch=>[branch.path,branch.result.ok?branch.result.value.children:[]])]));setExpanded(paths);
      setRoles(result.value.folderRoles);setExclusions(result.value.excludedRelativePaths);setDirty(false);setPreview(null);setConfirmed(false);setStale(false);
    }catch{if(mounted.current&&version===generation.current)setError(true);}
    finally{if(mounted.current&&version===generation.current)setBusy(false);}
  };
  useEffect(()=>{void load();},[client,workspaceId]);
  const lastInvalidation=useRef(invalidation);
  useEffect(()=>{
    if(lastInvalidation.current===invalidation)return;
    lastInvalidation.current=invalidation;
    if(!dirty&&!preview){void load(true);return;}
    setPreview(null);setConfirmed(false);setStale(true);
  },[invalidation]);
  useEffect(()=>{if(preview)reviewHeading.current?.focus();},[preview]);
  const edit=()=>{setDirty(true);setPreview(null);setConfirmed(false);setError(false);};
  const toggle=async(path:string)=>{
    if(expanded.includes(path)){setExpanded(current=>current.filter(item=>item!==path));return;}
    if(branches[path]){setExpanded(current=>[...current,path]);return;}
    const version=generation.current;setBusy(true);setError(false);
    try{
      const result=await client.getFolderChildren(workspaceId,path);
      if(!mounted.current||version!==generation.current)return;
      if(!result.ok){setError(true);return;}
      if(root && result.value.revision!==root.revision){setStale(true);setPreview(null);setConfirmed(false);}
      setBranches(current=>({...current,[path]:result.value.children}));setExpanded(current=>[...current,path]);
    }catch{if(mounted.current&&version===generation.current)setError(true);}
    finally{if(mounted.current&&version===generation.current)setBusy(false);}
  };
  const review=async()=>{
    const version=generation.current, observedInvalidation=lastInvalidation.current;setBusy(true);setError(false);setPreview(null);setConfirmed(false);
    try{
      const result=await client.previewDiscovery(workspaceId,exclusions,undefined,roles);
      if(!mounted.current||version!==generation.current)return;
      if(observedInvalidation!==lastInvalidation.current){setStale(true);return;}
      if(result.ok){setPreview(result.value);setStale(false);}else setError(true);
    }catch{if(mounted.current&&version===generation.current)setError(true);}
    finally{if(mounted.current&&version===generation.current)setBusy(false);}
  };
  const apply=async()=>{
    if(!confirmed||!preview?.previewToken)return;
    const version=generation.current;setBusy(true);setError(false);
    try{
      const result=await client.applyDiscovery(workspaceId,preview.previewToken);
      if(!mounted.current||version!==generation.current)return;
      if(!result.ok){setPreview(null);setConfirmed(false);setStale(true);setError(true);return;}
      returnFocus.current=true;await load(true);onCommitted();
    }catch{if(mounted.current&&version===generation.current)setError(true);}
    finally{if(mounted.current&&version===generation.current)setBusy(false);}
  };
  const cancel=()=>{returnFocus.current=true;if(stale)void load(true);setRoles(root?.folderRoles??[]);setExclusions(root?.excludedRelativePaths??[]);setDirty(false);setPreview(null);setConfirmed(false);setStale(false);setError(false);};
  const nodes=(parent:string)=> <ul className="folder-role-list">{(branches[parent]??[]).map(node=>{
    const role=roles.find(row=>row.relativePath===node.relativePath)?.role??node.role;
    const category=categories.find(category=>category.relativePath===node.relativePath);
    const excluded=exclusions.includes(node.relativePath),blocked=!!node.reason&&node.reason!=="manual";
    return <li key={node.relativePath}>
      <div className="folder-role-row">
        <button type="button" className="workspace-button workspace-button--secondary icon-button" aria-label={`${expanded.includes(node.relativePath)?l.collapse:l.expand}: ${node.relativePath}`} aria-expanded={expanded.includes(node.relativePath)} disabled={busy||disabled||blocked||excluded} onClick={()=>void toggle(node.relativePath)}>{expanded.includes(node.relativePath)?"−":"+"}</button>
        <span className="folder-role-name category-chip" data-color={role==="status" ? category?.presentation?.color??"default" : "default"} title={node.relativePath}>{node.name}</span>
        <select className="bb-input" aria-label={`${l.role}: ${node.relativePath}`} value={role} disabled={busy||disabled||blocked||excluded} onChange={event=>{const next=event.currentTarget.value as FolderRole;editingControl.current=event.currentTarget;edit();setRoles(current=>[...current.filter(row=>row.relativePath!==node.relativePath),{relativePath:node.relativePath,role:next}].sort((a,b)=>a.relativePath.localeCompare(b.relativePath)));}}>
          {(["group","status","project"] as const).map(value=><option key={value} value={value}>{l[value]}</option>)}
        </select>
        {role==="status"&&category&&<StatusColorEditor client={client} workspaceId={workspaceId} category={category} language={language} disabled={disabled||busy||dirty||blocked||excluded}/>}
        <label className="folder-role-exclusion"><input type="checkbox" aria-label={`${l.exclude}: ${node.relativePath}`} checked={excluded} disabled={busy||disabled||blocked} onChange={event=>{const checked=event.currentTarget.checked;editingControl.current=event.currentTarget;edit();setExclusions(current=>checked?[...current,node.relativePath].sort():current.filter(path=>path!==node.relativePath));}}/>{l.exclude}</label>
      </div>
      {expanded.includes(node.relativePath)&&nodes(node.relativePath)}
    </li>;
  })}</ul>;
  return <section className="folder-role-settings" aria-label={l.title} aria-busy={busy} onKeyDown={event=>{if(event.key==="Escape"&&dirty&&!busy){event.preventDefault();event.stopPropagation();cancel();}}}>
    <h3>{l.title}</h3><p>{l.description}</p><p>{statusColorLabels[language].scope}</p>
    {colorError&&<StatusMessage kind="error" title={statusColorLabels[language].error}><button type="button" className="workspace-button workspace-button--secondary" disabled={disabled} onClick={()=>setColorRefresh(value=>value+1)}>{statusColorLabels[language].refresh}</button></StatusMessage>}
    {root&&!['ready','empty'].includes(root.state)&&<StatusMessage kind="info" title={l.unavailable}/>}
    {stale&&<p role="status">{l.stale}</p>}
    {error&&<StatusMessage kind="error" title={l.error}/>}
    {root&&nodes("")}
    {root&&!root.children.length&&<p>{l.empty}</p>}
    {root&&!["ready","empty"].includes(root.state)&&<ul>{root.folderRoles.map(row=><li key={row.relativePath}><span className="workspace-root">{row.relativePath}</span> · {l[row.role]}</li>)}</ul>}
    <div className="workspace-form-actions">
      <button ref={reviewButton} type="button" className="workspace-button" disabled={busy||disabled||!dirty} onClick={()=>void review()}>{l.review}</button>
      {dirty&&<button type="button" className="workspace-button workspace-button--secondary" disabled={busy} onClick={cancel}>{l.cancel}</button>}
      {!dirty&&<button ref={refreshButton} type="button" className="workspace-button workspace-button--secondary" disabled={busy||disabled} onClick={()=>void load()}>{l.retry}</button>}
    </div>
    {preview&&<div className="folder-role-review"><h4 ref={reviewHeading} tabIndex={-1}>{l.shared}</h4>
      <ul>{preview.affectedWorkspaces?.map(workspace=><li key={workspace.workspaceId}>{workspace.name}</li>)}</ul>
      {!preview.previewToken&&<StatusMessage kind="info" title={l.unavailable}/>}
      <p>{l.retained}</p>
      <dl><dt>{l.added}</dt><dd>{preview.projectEffects.added.length}</dd><dt>{l.kept}</dt><dd>{preview.projectEffects.retained.length}</dd><dt>{l.removed}</dt><dd>{preview.projectEffects.noLongerRecognized.length}</dd></dl>
      <ul>{preview.projectEffects.noLongerRecognized.map(project=><li key={project.projectId}>{project.relativePath}</li>)}</ul>
      <label><input type="checkbox" checked={confirmed} disabled={busy||!preview.previewToken} onChange={event=>setConfirmed(event.currentTarget.checked)}/>{l.confirm}</label>
      <button type="button" className="workspace-button" disabled={busy||disabled||!confirmed||!preview.previewToken} onClick={()=>void apply()}>{l.apply}</button>
    </div>}
  </section>;
}
