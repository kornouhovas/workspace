import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { Language } from '../../contracts/settings.js';
import type { ProjectFileEntry } from '../../contracts/project-files.js';
import type { WorkspaceServiceClient } from '../workspace-service-client.js';
import { Icon } from './Icons.js';
import { Hint } from './Hint.js';

const labels = {
  en: { files:'Files', refresh:'Refresh files', loading:'Loading files…', empty:'This folder is empty.', error:'Files could not be read. Refresh to try again.', unavailable:'This item is unavailable. Refresh files or check the project source.', open:'Open externally', reveal:'Reveal in Finder / Explorer', failed:'The external action failed. Check the default application or file manager, then retry.', pending:'Opening…', unsafe:'Unavailable item' },
  ru: { files:'Файлы', refresh:'Обновить файлы', loading:'Загрузка файлов…', empty:'Папка пуста.', error:'Не удалось прочитать файлы. Обновите список.', unavailable:'Объект недоступен. Обновите файлы или проверьте источник проекта.', open:'Открыть во внешнем приложении', reveal:'Показать в Finder / Проводнике', failed:'Внешнее действие не выполнено. Проверьте приложение по умолчанию или файловый менеджер и повторите.', pending:'Открытие…', unsafe:'Недоступный объект' },
};
type Directory = { entries: ProjectFileEntry[]; state: 'loading' | 'ready' | 'error' | 'unavailable' };
type Props = { client:WorkspaceServiceClient; workspaceId:string; projectId:string; language:Language; disabled:boolean };

// The host keys this controller by logical project and observed locator lifetime.
export function ProjectFiles({client,workspaceId,projectId,language,disabled}: Props) {
  const t=labels[language];
  const [directories,setDirectories]=useState<Record<string,Directory>>({});
  const [expanded,setExpanded]=useState(new Set<string>());
  const [selected,setSelected]=useState<string|null>(null);
  const [pending,setPending]=useState(false), [problem,setProblem]=useState<'failed'|'unavailable'|null>(null);
  const generation=useRef(0), rows=useRef(new Map<string,HTMLLIElement>()), busy=useRef(false);
  const requests=useRef(new Set<string>());
  async function load(path:string, owner=generation.current) {
    if(disabled || requests.current.has(path)) return;
    requests.current.add(path);
    setDirectories(current=>({...current,[path]:{entries:[],state:'loading'}}));
    try {
      const result=await client.listProjectFiles(workspaceId,projectId,path);
      if(owner!==generation.current) return;
      setDirectories(current=>({...current,[path]:result.ok && result.value.outcome==='listed'
        ? {entries:result.value.entries,state:'ready'}
        : {entries:[],state:result.ok ? 'unavailable':'error'}}));
    } catch { if(owner===generation.current) setDirectories(current=>({...current,[path]:{entries:[],state:'error'}})); }
    finally { if(owner===generation.current) requests.current.delete(path); }
  }
  useEffect(()=>{
    generation.current++; requests.current.clear(); setDirectories({});setExpanded(new Set());setSelected(null);setProblem(null);setPending(false);busy.current=false;
    void load('');
    return ()=>{generation.current++;};
  },[client,workspaceId,projectId,disabled]);
  const visible: {entry:ProjectFileEntry;depth:number;parent:string}[]=[];
  function visit(path:string,depth:number) {
    for(const entry of directories[path]?.entries ?? []) {
      visible.push({entry,depth,parent:path});
      if(entry.kind==='directory' && expanded.has(entry.relativePath)) visit(entry.relativePath,depth+1);
    }
  }
  visit('',1);
  const active=visible.find(row=>row.entry.relativePath===selected)?.entry;
  function toggle(entry:ProjectFileEntry) {
    if(entry.kind!=='directory' || disabled) return;
    const next=new Set(expanded);
    if(next.has(entry.relativePath)) {
      next.delete(entry.relativePath);
      if(selected?.startsWith(`${entry.relativePath}/`)) setSelected(entry.relativePath);
    } else { next.add(entry.relativePath); if(!directories[entry.relativePath] || directories[entry.relativePath].state!=='ready') void load(entry.relativePath); }
    setExpanded(next);
  }
  function focus(path:string) { setSelected(path);rows.current.get(path)?.focus(); }
  async function command(entry:ProjectFileEntry,action:'open'|'reveal') {
    if(disabled || busy.current || entry.kind==='unavailable' || action==='open' && entry.kind!=='file') return;
    const owner=generation.current;busy.current=true;setPending(true);setProblem(null);
    try {
      const result=await client.projectFileCommand(workspaceId,projectId,entry.relativePath,action);
      if(owner!==generation.current) return;
      if(!result.ok || result.value.outcome==='rejected') setProblem(result.ok && result.value.outcome==='rejected' && !['native_error','native_unavailable'].includes(result.value.problem) ? 'unavailable':'failed');
    } catch { if(owner===generation.current) setProblem('failed'); }
    finally { if(owner===generation.current) {busy.current=false;setPending(false);rows.current.get(entry.relativePath)?.focus();} }
  }
  function keyboard(event:KeyboardEvent,entry:ProjectFileEntry) {
    const index=visible.findIndex(row=>row.entry.relativePath===entry.relativePath);
    const row=visible[index];
    if(['ArrowDown','ArrowUp','ArrowRight','ArrowLeft','Home','End','Enter',' '].includes(event.key)) {event.preventDefault();event.stopPropagation();}
    if(event.key==='ArrowDown' || event.key==='ArrowUp') focus(visible[Math.max(0,Math.min(visible.length-1,index+(event.key==='ArrowDown'?1:-1)))].entry.relativePath);
    if(event.key==='Home') focus(visible[0].entry.relativePath);
    if(event.key==='End') focus(visible[visible.length-1].entry.relativePath);
    if(event.key==='ArrowRight' && entry.kind==='directory') { if(!expanded.has(entry.relativePath)) toggle(entry); else if(visible[index+1]?.parent===entry.relativePath) focus(visible[index+1].entry.relativePath); }
    if(event.key==='ArrowLeft') { if(expanded.has(entry.relativePath)) toggle(entry); else if(row.parent) focus(row.parent); }
    if(event.key==='Enter') {if(entry.kind==='directory') toggle(entry); else void command(entry,'open');}
    if(event.key===' ') setSelected(entry.relativePath);
  }
  function status(path:string) {
    const directory=directories[path];
    if(!directory || directory.state==='loading') return <p role="status" className="project-files-status">{disabled?t.unavailable:t.loading}</p>;
    if(directory.state!=='ready') return <p role="status" className="project-files-status">{t[directory.state]}</p>;
    if(!directory.entries.length) return <p role="status" className="project-files-status">{t.empty}</p>;
    return null;
  }
  return <section className="project-files" aria-label={t.files}>
    <header className="project-files-header"><h3>{t.files}</h3>
      <Hint label={t.refresh}><button type="button" className="workspace-button workspace-button--secondary icon-button" aria-label={t.refresh} disabled={disabled || pending} onClick={()=>{
        generation.current++;requests.current.clear();setDirectories({});setExpanded(new Set());setSelected(null);setProblem(null);void load('');
      }}><Icon name="refresh"/></button></Hint>
    </header>
    {status('')}
    {!!visible.length && <ul role="tree" aria-label={t.files} className="project-file-tree" aria-disabled={disabled}>
      {visible.map(({entry,depth})=><li role="treeitem" key={entry.relativePath} ref={node=>{if(node)rows.current.set(entry.relativePath,node);else rows.current.delete(entry.relativePath);}}
        aria-label={entry.name} aria-level={depth} aria-selected={selected===entry.relativePath} aria-disabled={disabled || entry.kind==='unavailable'}
        aria-expanded={entry.kind==='directory'?expanded.has(entry.relativePath):undefined}
        tabIndex={!disabled && (selected===entry.relativePath || !active && visible[0].entry===entry)?0:-1}
        style={{paddingLeft:8+(depth-1)*16}} className="project-file-row" title={entry.relativePath}
        onFocus={()=>setSelected(entry.relativePath)} onClick={()=>{focus(entry.relativePath);if(entry.kind==='directory')toggle(entry);}}
        onDoubleClick={()=>{if(entry.kind==='file')void command(entry,'open');}} onKeyDown={event=>keyboard(event,entry)}>
        <span className={`project-file-chevron${expanded.has(entry.relativePath)?' is-expanded':''}`}>{entry.kind==='directory' && <Icon name="forward"/>}</span>
        <Icon name={entry.kind==='directory'?'folder':'file'}/><span className="project-file-name">{entry.name}</span>
        {entry.kind==='unavailable' && <span className="project-file-unavailable" aria-label={t.unsafe}>!</span>}
      </li>)}
    </ul>}
    {[...expanded].map(path=><div key={path} className="project-files-nested-status">{status(path)}</div>)}
    <div className="project-file-actions">
      <button type="button" className="workspace-button workspace-button--secondary" disabled={disabled || pending || active?.kind!=='file'} onClick={()=>{if(active)void command(active,'open');}}>{t.open}</button>
      <button type="button" className="workspace-button workspace-button--secondary" disabled={disabled || pending || !active || active.kind==='unavailable'} onClick={()=>{if(active)void command(active,'reveal');}}>{t.reveal}</button>
    </div>
    {pending && <p role="status" className="project-files-status">{t.pending}</p>}
    {problem && <p role="alert" className="project-files-status">{t[problem]}</p>}
  </section>;
}
