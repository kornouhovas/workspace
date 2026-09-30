import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const phase=process.argv[2]||'after';const browser=await chromium.connectOverCDP('http://127.0.0.1:9246');const page=browser.contexts()[0].pages()[0];
const checks=[];
for(const theme of ['light','dark']){
await page.evaluate(theme=>localStorage.setItem('workspace.theme',theme),theme);await page.reload();await page.getByRole('button',{name:'Settings',exact:true}).click();
checks.push(...await page.evaluate(theme=>{const root=getComputedStyle(document.documentElement);const results=[];function check(name,actual,expected){results.push({theme,name,actual,expected,pass:actual===expected})}function color(value){const e=document.createElement('span');e.style.color=value;document.body.append(e);const out=getComputedStyle(e).color;e.remove();return out}function token(name,expected){check(name,color(`var(--${name})`),color(expected))}
token('input',`color-mix(in oklch,var(--ink) ${theme==='dark'?'32.6':'29.5'}%,var(--canvas))`);
token('surface-raised','color-mix(in oklab,var(--ink) 2.5%,transparent)');
token('surface-selected',`color-mix(in oklab,var(--primary) ${theme==='dark'?'12':'16'}%,transparent)`);
token('destructive-text',theme==='dark'?'oklch(0.65 0.16 22)':'oklch(0.45 0.19 25.8625)');
token('sidebar-accent',`color-mix(in oklch,var(--ink) ${theme==='dark'?'12':'8'}%,var(--canvas))`);
const select=document.querySelector('[data-slot=select-trigger][data-size=default]');check('Select default height',getComputedStyle(select).height,'36px');check('Select radius',getComputedStyle(select).borderRadius,'6px');
const probe=document.createElement('span');probe.className='text-base';probe.textContent='base';document.body.append(probe);check('base size',getComputedStyle(probe).fontSize,'15px');check('base leading',getComputedStyle(probe).lineHeight,'22px');probe.remove();
token('file-accent',theme==='dark'?'oklch(0.72 0.09 250)':'oklch(0.55 0.1 250)');
for(const kind of ['xs','sm','md']){const probe=document.createElement('div');probe.className=`shadow-${kind}`;document.body.append(probe);const actual=getComputedStyle(probe).boxShadow.replace(/rgba\(0, 0, 0, 0\) 0px 0px 0px 0px, /g,'');const expected=document.createElement('div');const c=theme==='dark'?'0%':'20%';const a=theme==='dark'?(kind==='xs'?'.2':'.3'):(kind==='xs'?'.07':'.15');const b=theme==='dark'?(kind==='sm'?'.4':'.5'):'.15';expected.style.boxShadow=`0px 2px 0px 0px hsl(0 0% ${c} / ${a})`+(kind==='xs'?'':`, 0px ${kind==='sm'?'1px 2px':'2px 4px'} -1px hsl(0 0% ${c} / ${b})`);document.body.append(expected);check(`shadow-${kind}`,actual,getComputedStyle(expected).boxShadow);probe.remove();expected.remove();}
check('root16',root.fontSize,'16px');return results},theme));
}
await writeFile(`work/workspace-6fh/${phase}-contracts.json`,JSON.stringify(checks,null,2));console.log(JSON.stringify({phase,total:checks.length,failures:checks.filter(c=>!c.pass)},null,2));void browser;if(checks.some(c=>!c.pass))process.exitCode=1;

process.exit(process.exitCode || 0);
