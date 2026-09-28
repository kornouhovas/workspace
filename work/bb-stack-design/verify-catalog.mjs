import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const evidence=resolve('work/bb-stack-design/catalog');await mkdir(evidence,{recursive:true});
let output='';const child=spawn('npm',['run','storybook','--','--host','127.0.0.1','--port','61100'],{cwd:process.cwd(),stdio:['ignore','pipe','pipe'],detached:true});
child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);
let browser;const errors=[];
try{
 for(let i=0;i<100;i++){try{await fetch('http://127.0.0.1:61100');break;}catch{await new Promise(r=>setTimeout(r,100));}}
 browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:61100/?story=workspace--controls');await page.getByRole('button',{name:'Primary',exact:true}).waitFor();
 await page.screenshot({path:resolve(evidence,'controls.png')});
 await page.getByRole('button',{name:'Switch to dark theme.',exact:true}).click();
 await page.locator('.dark').waitFor();
 const dark=await page.locator('.dark').evaluate(el=>({background:getComputedStyle(el).backgroundColor, foreground:getComputedStyle(el).color}));
 assert.equal(dark.background,'rgb(36, 38, 43)');assert.equal(dark.foreground,'rgb(224, 225, 229)');
 await page.screenshot({path:resolve(evidence,'controls-dark.png')});assert.deepEqual(errors,[]);
 await writeFile(resolve(evidence,'report.json'),JSON.stringify({url:page.url(),errors,checks:['Actual npm run storybook serves real Workspace Controls story without page errors','Ladle theme control switches inherited ink/canvas tokens to real dark surfaces']},null,2));
}finally{if(browser)await browser.close();process.kill(-child.pid,'SIGINT');await writeFile(resolve(evidence,'launcher.txt'),output);}
