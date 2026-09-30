import {chromium} from '@playwright/test';import {writeFile} from 'node:fs/promises';
const phase=process.argv[2]||'after';const b=await chromium.connectOverCDP('http://127.0.0.1:9246');const p=b.contexts()[0].pages()[0];const result=[];if(process.env.WORKSPACE_6FH_RENDERER)await p.goto(process.env.WORKSPACE_6FH_RENDERER);
await fetch('http://127.0.0.1:9247/mode');await p.evaluate(async()=>{const r=await window.workspace.request('workspace.getRoot');await window.workspace.request('workspace.updateWorkspace',{workspaceId:r.root.workspaceId,patch:{name:'Operations'}})});await p.reload();await p.getByRole('button',{name:'Operations',exact:true}).waitFor();
await fetch('http://127.0.0.1:9247/mode?failMethod=workspace.updateWorkspace');await p.getByRole('button',{name:'Workspace actions for Operations',exact:true}).click();await p.getByRole('menuitem',{name:'Rename Workspace',exact:true}).click();
const input=p.getByRole('textbox',{name:'Rename workspace',exact:true});
const prevented=await input.evaluate(e=>{const event=new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true,cancelable:true});e.dispatchEvent(event);return event.defaultPrevented});result.push({name:'IME Enter prevents submit',pass:prevented});
await input.fill('Retained draft');await input.press('Enter');await p.waitForTimeout(400);const remains=await input.count();result.push({name:'Failed rename preserves draft',pass:remains>0&&(await input.inputValue())==='Retained draft'});
await fetch('http://127.0.0.1:9247/mode');await p.reload();await writeFile(`work/workspace-6fh/${phase}-rename-contracts.json`,JSON.stringify(result,null,2));console.log(result);void b;if(result.some(r=>!r.pass))process.exitCode=1;

process.exit(process.exitCode || 0);
