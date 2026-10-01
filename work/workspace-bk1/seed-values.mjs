import {readFile} from 'node:fs/promises';import {join} from 'node:path';import {createWorkspaceIpcHandler} from '../../electron/workspaceIpc.js';
const rt=JSON.parse(await readFile('work/workspace-bk1/runtime.json','utf8')),s=JSON.parse(await readFile(join(rt.metadata,'settings.json'),'utf8')),workspaceId=s.activeWorkspaceId;
const h=createWorkspaceIpcHandler({configPath:join(rt.metadata,'settings.json'),viewStorePath:join(rt.metadata,'views.json'),propertyStorePath:join(rt.metadata,'properties.json')});
const catalog=await h(null,'workspace.listProperties',{workspaceId});console.log(catalog.properties.map(p=>({id:p.id,name:p.name,hidden:p.hidden})));
const p=await h(null,'workspace.getViewProjection',{workspaceId,viewId:'view:default-board'});console.log(JSON.stringify(p).slice(0,1800));
const alpha=p.projection.columns.flatMap(c=>c.projects).find(p=>p.name==='Project Alpha');
for(const prop of catalog.properties.filter(p=>!p.system))await h(null,'workspace.updateProjectPropertyValue',{workspaceId,projectId:alpha.id,propertyId:prop.id,value:prop.hidden?'Hidden text with a deliberately long value to test narrow widths':'Project notes with a long line that wraps within the panel.\nSecond line stays readable.'});
