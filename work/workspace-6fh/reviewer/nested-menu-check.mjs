import {chromium,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.connectOverCDP('http://127.0.0.1:9246');
const page=browser.contexts()[0].pages()[0];
const checks=[];const check=(name,details)=>checks.push({name,pass:true,details});
try {
 await page.reload();
 await page.getByRole('tab',{name:'Board',exact:true}).click();
 await page.getByRole('button',{name:'Project Alpha',exact:true}).waitFor();
 const customize=page.getByRole('button',{name:'Customize Columns',exact:true});
 await customize.click();
 const parent=page.locator('[data-workspace-view-filter-menu=true]');
 await expect(parent).toBeVisible();
 const action=page.getByRole('button',{name:'Notes property actions',exact:true});
 await action.click();
 const nested=page.locator('[data-workspace-actions-popover=true]');
 await expect(nested).toBeVisible();
 await expect(parent).toBeVisible();
 check('Nested actions portal remains interactive while controlled parent stays open');
 await nested.getByRole('menuitem',{name:'Rename property',exact:true}).click();
 const input=page.getByRole('textbox',{name:'Rename property',exact:true});
 await expect(input).toBeVisible();
 await expect(parent).toBeVisible();
 check('Nested action dispatch opens rename without parent dismissal');
 await input.press('Escape');
 await expect(input).toHaveCount(0);
 await expect(parent).toBeVisible();
 await customize.click();
 await expect(parent).toHaveCount(0);
 check('Open trigger retains normal toggle-close behavior');
 await customize.click();
 await expect(parent).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(parent).toHaveCount(0);
 await expect(customize).toBeFocused();
 check('Controlled menu reopens and Escape returns focus');
} catch(error) {checks.push({name:'nested-menu-risk',pass:false,error:String(error)}); throw error;}
finally {await writeFile('work/workspace-6fh/reviewer/nested-menu-report.json',JSON.stringify(checks,null,2));process.exit(checks.every(check=>check.pass)?0:1);}
