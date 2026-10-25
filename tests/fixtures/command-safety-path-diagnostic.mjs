// Diagnostic only: real disposable SQLite/filesystem, no OS dispatch or live data.
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,realpathSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import Database from 'better-sqlite3';
import {openSettingsService} from '../../dist/service/settings.mjs';
import {observeFolder} from '../../src/service/folder-evidence.ts';
import {createNativeProjectReveal} from '../../src/desktop/project-reveal.ts';
const directory=realpathSync(mkdtempSync(join(tmpdir(),'command-path-diagnostic-'))),root=join(directory,'root');
mkdirSync(join(root,'Project'),{recursive:true});
const report={sha:process.env.GITHUB_SHA??null,platform:process.platform,root,variants:[]};
let mode=null,canonicalExpected,matched=0,observations=[];
const reader=(path,scope)=>{
 const proof=observeFolder(path,scope);if(!mode||!proof.ok)return proof;
 observations.push(path);
 const matches=mode==='slash'?path.endsWith('/Project'):path===(mode==='raw'?join(root,'Project'):canonicalExpected);
 if(!matches)return proof;matched++;return {...proof,evidence:{...proof.evidence,created:(BigInt(proof.evidence.created)+1n).toString()}};
};
const observer={watch(){return{close(){}};},schedule(){return{cancel(){}};}};
const service=openSettingsService(join(directory,'app.sqlite'),undefined,undefined,observer,undefined,undefined,reader),sql=new Database(join(directory,'app.sqlite'));
const unwrap=result=>{assert.equal(result.ok,true,JSON.stringify(result));return result.value;};
try {
 const workspace=unwrap(service.handleCommand({type:'workspace.create',name:'Diagnostic',rootPath:root}));
 report.canonicalRoot=workspace.canonicalRoot;canonicalExpected=join(workspace.canonicalRoot,'Project');
 const query=input=>unwrap(service.handleQuery({workspaceId:workspace.workspaceId,...input})),command=input=>unwrap(service.handleCommand({workspaceId:workspace.workspaceId,...input}));
 const discovery=query({type:'workspace.previewDiscovery',mode:'direct'}),list=command({type:'workspace.applyDiscovery',previewToken:discovery.previewToken}),projectId=list.projects[0].projectId;
 report.rawSqlMatches=sql.prepare('SELECT count(*) n FROM sources WHERE canonical_root=?').get(root).n;
 report.canonicalSqlMatches=sql.prepare('SELECT count(*) n FROM sources WHERE canonical_root=?').get(workspace.canonicalRoot).n;
 const native=createNativeProjectReveal(path=>{report.nativePath=path;report.originalNativeAssertionMatches=path===join(root,'Project');});
 report.nativeResult=await service.revealProject({type:'workspace.revealProject',workspaceId:workspace.workspaceId,projectId},(target,verify)=>native(target,()=>true,async()=>verify()));
 const location=query({type:'workspace.previewArchiveLocation',relativePath:'Archive'});assert.ok(location.previewToken);command({type:'workspace.applyArchiveLocation',operationId:randomUUID(),previewToken:location.previewToken});
 for(mode of ['slash','raw','canonical']) {
  matched=0;observations=[];
  const review=query({type:'workspace.previewProjectArchive',projectId,action:'archive',name:null,createParent:false});
  report.variants.push({mode,matched,observations,previewGranted:review.previewToken!==null});
 }
}finally{
 service.close();sql.close();rmSync(directory,{recursive:true,force:true});
 mkdirSync('work/ci-command-safety-fixtures',{recursive:true});
 writeFileSync('work/ci-command-safety-fixtures/path-diagnostic.json',JSON.stringify(report,null,2)+'\n');
 console.info('Disposable command-safety path observations retained.');
}
