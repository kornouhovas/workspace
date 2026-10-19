/* global document, innerWidth */
import assert from 'node:assert/strict';
import { recordGroupDrag } from './runtime-group-assignment.mjs';
import { showRuntimeProject, waitForRuntimeProjectPath } from './runtime-project-visibility.mjs';
import { mkdir, readdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export async function exerciseFolderGroupAssignment({page,query,rootPath,language,evidenceDirectory}) {
  const en=language==='en',checks=[];
  await mkdir(rootPath);
  for(const layout of ['table','board']) {
    const source=join(rootPath,layout);await mkdir(source);
    for(const [category,name] of [['A','Alpha'],['B','Target'],['C','Target']]) {
      await mkdir(join(source,category));await mkdir(join(source,category,name));
      await writeFile(join(source,category,name,'keep'),category);
    }
    const workspace=await query(page,{type:'workspace.create',rootPath:source,name:`Folder drag ${language} ${layout}`});
    const {workspaceId,viewId}=workspace;
    const call=(type,fields={})=>query(page,{type:`workspace.${type}`,workspaceId,...fields});
    const preview=await call('previewDiscovery',{mode:'grouped'});
    const list=await call('applyDiscovery',{previewToken:preview.previewToken}),project=list.projects.find(p=>p.name==='Alpha');
    const propertyId=(await call('createProperty',{name:'Keep metadata',propertyType:'text'})).propertyId;
    await call('setTextValue',{projectId:project.projectId,propertyId,value:'saved'});
    await call('setViewLayout',{viewId,kind:layout});
    await call('setViewGrouping',{viewId,config:{propertyId:'name',settings:[]}});
    await page.reload();
    const drag=name=>`${en?'Drag to change group':'Перетащить для изменения группы'}: ${name}`;
    const change=name=>`${en?'Change group':'Изменить группу'}: ${name}`;
    const region=name=>page.getByRole('region',{name,exact:true});
    const handle=region('Alpha').getByRole('button',{name:drag('Alpha'),exact:true}).and(page.locator(':enabled'));
    const heading=region('Target').getByRole('heading');
    await heading.evaluate(el=>el.scrollIntoView({block:'start',inline:'nearest'}));
    await recordGroupDrag(page, handle, heading, join(evidenceDirectory, `${language}-${layout}-folder-name-drag-receipt.json`));
    await waitForRuntimeProjectPath(page, workspaceId, project.projectId, 'A/Target');
    assert.deepEqual(await readdir(join(source,'A')),['Target']);
    assert.equal(await readFile(join(source,'A','Target','keep'),'utf8'),'A');
    const categoryPropertyId=list.categoryProperty.propertyId;
    await call('setViewGrouping',{viewId,config:{propertyId:categoryPropertyId,settings:[]}});
    await region('A').getByLabel(change('Target'),{exact:true}).and(page.locator(':enabled')).waitFor();
    const destination=list.categories.find(c=>c.name==='B').categoryId;
    await region('A').getByLabel(change('Target'),{exact:true}).selectOption(JSON.stringify(destination));
    await page.getByText(en?'This folder name or identity is occupied or reserved. Choose another name.':'Это имя или идентификатор папки занят или зарезервирован. Выберите другое имя.',{exact:true}).waitFor();
    assert.equal((await call('listProjects')).projects.find(p=>p.projectId===project.projectId).relativePath,'A/Target');
    const other=list.projects.find(p=>p.relativePath==='C/Target');
    await call('renameProject',{projectId:other.projectId,operationId:randomUUID(),name:'Other',expectedRevision:(await call('listProjects')).revision});
    const selector=region('A').getByLabel(change('Target'),{exact:true}).and(page.locator(':enabled'));
    await selector.selectOption(JSON.stringify(list.categories.find(c=>c.name==='C').categoryId));
    await waitForRuntimeProjectPath(page, workspaceId, project.projectId, 'C/Target');
    await showRuntimeProject(page, 'Target', project.projectId);
    await region('C').getByLabel(change('Target'),{exact:true}).and(page.locator(':enabled')).waitFor();
    assert.equal(await readFile(join(source,'C','Target','keep'),'utf8'),'A');
    assert.deepEqual(await readdir(join(source,'A')),[]);
    for(const width of [360,1440]) {
      await page.setViewportSize({width,height:width===1440?960:720});
      await showRuntimeProject(page, 'Target', project.projectId);
      await region('C').getByLabel(change('Target'),{exact:true}).scrollIntoViewIfNeeded();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      await page.screenshot({path:join(evidenceDirectory,`${language}-${layout}-${width}-folder-drag.png`)});
    }
    await page.reload();
    await showRuntimeProject(page, 'Target', project.projectId);
    await region('C').getByLabel(change('Target'),{exact:true}).waitFor();
    assert.equal((await call('listTextProperties')).values.find(v=>v.projectId===project.projectId).value,'saved');
    checks.push({layout,language,namePointer:true,categoryKeyboard:true,collision:true,identity:true,metadata:true,reload:true,widths:[360,1440]});
  }
  return {checks};
}
