import { useId, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PencilIcon } from '@/lib/workspace-icons';
import { useI18n } from '@/i18n';

export function ProjectRenameAction({name,relativePath,disabled,onRename}:{name:string;relativePath:string;disabled:boolean;onRename:(name:string)=>Promise<void>}) {
 const {t}=useI18n();const id=useId(),trigger=useRef<HTMLButtonElement>(null),input=useRef<HTMLInputElement>(null),submitting=useRef(false);
 const [open,setOpen]=useState(false),[draft,setDraft]=useState(name),[pending,setPending]=useState(false),[error,setError]=useState(''),[showDetails,setShowDetails]=useState(false);
 async function submit(){
  if(submitting.current)return;
  if(draft===name){setOpen(false);return;}
  submitting.current=true;setPending(true);setError('');
  try{await onRename(draft);setOpen(false)}catch(cause){setError(cause instanceof Error?cause.message:t('rename.failed')); requestAnimationFrame(() => input.current?.focus())}
  finally{submitting.current=false;setPending(false)}
 }
 return <Dialog.Root open={open} onOpenChange={next=>{if(!submitting.current)setOpen(next)}}>
  <Button ref={trigger} type="button" variant="ghost" size="sm" disabled={disabled||pending} onClick={()=>{setDraft(name);setError('');setShowDetails(false);setOpen(true)}}><PencilIcon data-icon="inline-start"/>{t('rename.action')}</Button>
  <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-black/30"/><Dialog.Content data-workspace-rename-project className="fixed left-1/2 top-1/2 z-50 grid w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 gap-3 rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-lg" onCloseAutoFocus={event=>{event.preventDefault();trigger.current?.focus()}} onPointerDownOutside={event=>event.preventDefault()} onEscapeKeyDown={event=>{if(pending)event.preventDefault()}}>
   <Dialog.Title className="text-sm font-medium">{t('rename.action')}</Dialog.Title>
   <Dialog.Description className="text-xs text-muted-foreground">{t('rename.description')}</Dialog.Description>
   <form className="grid gap-3" onSubmit={event=>{event.preventDefault();void submit()}}>
    <label htmlFor={id} className="text-xs">{t('rename.name')}</label>
    <Input ref={input} id={id} autoFocus value={draft} disabled={pending} aria-invalid={!!error} aria-describedby={error?`${id}-error`:undefined} onChange={event=>setDraft(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&event.nativeEvent.isComposing)event.preventDefault()}}/>
    {error&&<p id={`${id}-error`} role="alert" className="text-xs text-destructive-text">{error}</p>}
    {pending&&<div className="grid gap-2">
      <p role="status" className="text-xs text-muted-foreground">{t('rename.pending')}</p>
      <Button type="button" variant="ghost" size="sm" aria-expanded={showDetails} onClick={()=>setShowDetails(value=>!value)}>{t('rename.showDetails')}</Button>
      {showDetails&&<dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-xs"><dt>{t('move.from')}</dt><dd className="break-all">{relativePath}</dd><dt>{t('move.to')}</dt><dd className="break-all">{[...relativePath.split('/').slice(0,-1),draft].join('/')}</dd></dl>}
     </div>}
    <div className="flex justify-end gap-2"><Button type="button" variant="outline" size="sm" disabled={pending} onClick={()=>setOpen(false)}>{t('common.cancel')}</Button><Button type="submit" size="sm" disabled={pending}>{t('rename.confirm')}</Button></div>
   </form>
  </Dialog.Content></Dialog.Portal>
 </Dialog.Root>;
}
