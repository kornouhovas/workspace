import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoreHorizontalIcon, PlusIcon, EyeOffIcon } from '@/lib/workspace-icons';
import { workspaceMenuContentClassName, workspaceMenuItemClassName, workspaceMenuIconClassName } from './menu-styles';
import { blockOutsideWorkspaceMenuPointerDown } from './menu-dismissal';
import { useI18n } from '@/i18n';

export function BoardColumnActions({ statusValueId, name, disabled, unavailable, onHide, onCreate, wrapContent, onWrapContentChange, contextRequest = 0 }: {
 wrapContent?: boolean; onWrapContentChange?: (enabled: boolean) => Promise<void>; contextRequest?: number;
 statusValueId: string; name: string; disabled: boolean; unavailable: boolean;
 onHide?: (id: string) => Promise<void>; onCreate?: (id: string, name: string) => Promise<void>;
}) {
 const {t}=useI18n(); const [menu,setMenu]=useState(false),[dialog,setDialog]=useState(false),[projectName,setName]=useState(''),[pending,setPending]=useState(false),[error,setError]=useState('');
 const submitting=useRef(false),trigger=useRef<HTMLButtonElement>(null);
 useEffect(() => { setMenu(contextRequest > 0 && !disabled); }, [contextRequest]);
 async function submit() {
  if(submitting.current || !onCreate)return;
  submitting.current=true;setPending(true);setError('');
  try{await onCreate(statusValueId,projectName);setDialog(false);}
  catch(error){setError(error instanceof Error ? error.message : t('board.createFailed'));}
  finally{submitting.current=false;setPending(false);}
 }
 return <>
  <DropdownMenu open={menu} onOpenChange={setMenu}>
   <DropdownMenuTrigger asChild><Button ref={trigger} type="button" variant="ghost" size="icon" className="size-7 shrink-0" disabled={disabled||pending} data-workspace-column-actions aria-label={t('board.columnActions',{name})} onPointerDown={event=>event.stopPropagation()} onClick={event=>event.stopPropagation()}><MoreHorizontalIcon className="size-4" /></Button></DropdownMenuTrigger>
   <DropdownMenuContent align="end" className={workspaceMenuContentClassName} data-workspace-column-menu onPointerDownOutside={event=>blockOutsideWorkspaceMenuPointerDown(event,'[data-workspace-column-menu]',()=>setMenu(false))} onCloseAutoFocus={event=>{if(dialog)event.preventDefault()}}>
    <DropdownMenuItem className={workspaceMenuItemClassName} disabled={unavailable||!onCreate} onSelect={()=>{setName('');setError('');setDialog(true)}}><PlusIcon className={workspaceMenuIconClassName}/><span>{t('board.addCard')}{unavailable&&<span className="block max-w-56 text-[11px] text-muted-foreground">{t('board.noCreationDestination')}</span>}</span></DropdownMenuItem>
    <DropdownMenuCheckboxItem className={workspaceMenuItemClassName} checked={wrapContent === true} disabled={!onWrapContentChange} onCheckedChange={enabled=>void onWrapContentChange?.(enabled)}>{t('board.wrapContent')}</DropdownMenuCheckboxItem>
    <DropdownMenuItem className={workspaceMenuItemClassName} disabled={!onHide} onSelect={()=>void onHide?.(statusValueId)}><EyeOffIcon className={workspaceMenuIconClassName}/>{t('board.hideColumn')}</DropdownMenuItem>
   </DropdownMenuContent>
  </DropdownMenu>
  <Dialog.Root open={dialog} onOpenChange={open=>{if(!submitting.current)setDialog(open)}}>
   <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-black/30"/><Dialog.Content data-workspace-create-project className="fixed left-1/2 top-1/2 z-50 grid w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 gap-3 rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-lg" onCloseAutoFocus={event=>{event.preventDefault();trigger.current?.focus()}} onPointerDownOutside={event=>event.preventDefault()} onEscapeKeyDown={event=>{if(pending)event.preventDefault()}}>
    <Dialog.Title className="text-sm font-medium">{t('board.addCard')}</Dialog.Title>
    <Dialog.Description className="text-xs text-muted-foreground">{t('board.createDescription',{name})}</Dialog.Description>
    <form className="grid gap-3" onSubmit={event=>{event.preventDefault();void submit()}}>
     <label className="grid gap-1 text-xs">{t('board.projectName')}<Input autoFocus value={projectName} onChange={event=>setName(event.target.value)} disabled={pending} aria-invalid={!!error} aria-describedby={error?'workspace-create-project-error':undefined}/></label>
     {error&&<p id="workspace-create-project-error" role="alert" className="text-xs text-destructive-text">{error}</p>}
     <div className="flex justify-end gap-2"><Button type="button" variant="outline" size="sm" disabled={pending} onClick={()=>setDialog(false)}>{t('common.cancel')}</Button><Button type="submit" size="sm" disabled={pending||!projectName.trim()}>{t(pending?'board.creating':'board.create')}</Button></div>
    </form>
   </Dialog.Content></Dialog.Portal>
  </Dialog.Root>
 </>;
}
