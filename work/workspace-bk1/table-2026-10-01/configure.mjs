import {chromium} from '@playwright/test';
const browser=await chromium.connectOverCDP('http://127.0.0.1:9466');const page=browser.contexts()[0].pages()[0];
if(process.argv[2]){await page.evaluate(theme=>localStorage.setItem('workspace.theme',theme),process.argv[2]);await page.reload();await page.waitForLoadState('networkidle');}
if(process.argv[3])await page.getByRole('tab',{name:process.argv[3],exact:true}).click();
await browser.close();
