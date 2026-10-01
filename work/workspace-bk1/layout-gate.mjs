import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.connectOverCDP('http://127.0.0.1:9266');
const page=browser.contexts()[0].pages()[0];
const layout=await page.evaluate(()=>{const shell=document.querySelector('.workspace-shell').getBoundingClientRect(),dialog=document.querySelector('[role=dialog]'),content=dialog?.querySelector('.workspace-project-detail-content-inset'),heading=document.querySelector('#project-properties-heading');return {viewport:innerWidth,shellRight:shell.right,rootScrollHeight:document.documentElement.scrollHeight,viewportHeight:innerHeight,inset:content?{left:getComputedStyle(content).paddingLeft,right:getComputedStyle(content).paddingRight,top:getComputedStyle(content).paddingTop}:null,headingTop:heading&&dialog?heading.getBoundingClientRect().top-dialog.getBoundingClientRect().top:null}});
await browser.close();console.log(layout);
assert.equal(layout.shellRight,layout.viewport,'shell must reach viewport edge without an empty root gutter');
assert.equal(layout.rootScrollHeight,layout.viewportHeight,'document must not become the content scroll host');
if(layout.inset){assert.ok(parseFloat(layout.inset.left)>=24);assert.equal(layout.inset.left,layout.inset.right);assert.ok(layout.headingTop>=12);}
