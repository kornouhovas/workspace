import {chromium} from '@playwright/test';import {execFileSync} from 'node:child_process';
const b=await chromium.connectOverCDP('http://127.0.0.1:9466'),p=b.contexts()[0].pages()[0];p.setDefaultTimeout(5000);
for(const theme of ['dark','light']){await p.evaluate(t=>localStorage.setItem('workspace.theme',t),theme);await p.reload();await p.waitForLoadState('networkidle');
for(const [w,h]of [[1440,960],[1024,720]]){
await p.getByRole('tab',{name:'Table',exact:true}).click();execFileSync(process.execPath,['work/workspace-bk1/table-2026-10-01/capture.mjs',`after-${theme}-${w}-table`,String(w),String(h)],{stdio:'inherit'});
await p.getByRole('tab',{name:'Board',exact:true}).click();execFileSync(process.execPath,['work/workspace-bk1/table-2026-10-01/capture.mjs',`after-${theme}-${w}-board`,String(w),String(h)],{stdio:'inherit'});
await p.getByRole('button',{name:'Project Alpha',exact:true}).click();execFileSync(process.execPath,['work/workspace-bk1/table-2026-10-01/capture.mjs',`after-${theme}-${w}-project`,String(w),String(h)],{stdio:'inherit'});
await p.getByRole('tab',{name:'Table',exact:true}).click();
}}
await b.close();
