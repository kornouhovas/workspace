import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { translate } from '../src/i18n/core.js';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Render the real panel: splitting it into two lists or restoring its visible heading
// must fail this contract. No source-text matching is involved.
test('project details use one accessible property list with counted hidden disclosure', async () => {
 const folder = await mkdtemp(resolve('test/.project-detail-'));
 const savedWindow = globalThis.window;
 try {
  await build({stdin:{contents:'export { WorkspaceProjectDetailPanel } from "@/components/workspace/project-detail-panel"; export { I18nProvider } from "@/i18n";',resolveDir:process.cwd(),loader:'tsx'},bundle:true,platform:'node',format:'esm',packages:'external',alias:{'@':resolve('src')},outfile:resolve(folder,'panel.mjs')});
  const {WorkspaceProjectDetailPanel,I18nProvider}=await import(pathToFileURL(resolve(folder,'panel.mjs')));
  for (const count of [0,1,3]) for (const expanded of [false,true]) {
   globalThis.window={innerWidth:1440,localStorage:{getItem(key){return key==='workspace.card-property-sections.v1'?JSON.stringify({properties:false,hidden:expanded}):null;}}};
   const properties=[{id:'property:status',name:'Status',system:true,propertyType:'select'},...Array.from({length:count},(_,i)=>({id:`custom:${i}`,name:`Hidden ${i}`,propertyType:'text',hidden:true}))];
   const html=renderToStaticMarkup(React.createElement(I18nProvider,null,React.createElement(WorkspaceProjectDetailPanel,{inline:true,open:true,project:{id:'alpha',name:'Alpha',status:'Active',propertyValues:{},fileTree:[]},visibleProperties:properties,selectValues:[],onOpenChange(){}})));
   assert.equal((html.match(/<dl\b/g)||[]).length,1);
   assert.match(html,/<section[^>]*aria-label="Properties"/);
   assert.doesNotMatch(html,/<h3[^>]*>[^<]*Properties/);
   assert.match(html,/Status/);
   if(count===0) assert.doesNotMatch(html,/workspace-project-detail-hidden-properties-toggle/);
   else {
    assert.match(html,new RegExp(`aria-expanded="${expanded}"`));
    assert.ok(html.includes(expanded?`Hide ${count} ${count===1?'property':'properties'}`:`${count} more ${count===1?'property':'properties'}`));
   }
  }
 } finally {globalThis.window=savedWindow; await rm(folder,{recursive:true,force:true});}
});


test('hidden disclosure uses English and Russian count forms', () => {
 for (const [count,noun] of [[1,'свойство'],[2,'свойства'],[5,'свойств'],[21,'свойство']]) {
  assert.equal(translate('ru','detail.moreProperties',{count}),`Ещё ${count} ${noun}`);
  assert.equal(translate('ru','detail.hideProperties',{count}),`Скрыть ${count} ${noun}`);
 }
 assert.equal(translate('en','detail.moreProperties',{count:1}),'1 more property');
 assert.equal(translate('en','detail.hideProperties',{count:3}),'Hide 3 properties');
});
