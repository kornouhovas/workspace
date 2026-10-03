import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function projectDirectoryHelperPath({ resourcesPath, packaged = false } = {}) {
 return packaged ? `${resourcesPath}/sidecar/${process.platform}-${process.arch}/workspace-sidecar${process.platform === 'win32' ? '.exe' : ''}`
  : fileURLToPath(new URL('../build/sidecar/local/workspace-sidecar', import.meta.url));
}

export async function createEmptyProjectDirectory({ root, parent, name, helperPath = projectDirectoryHelperPath() }) {
 if(typeof name !== 'string' || !name || name.trim() !== name || name.startsWith('.') || /[\\/\u0000-\u001f]/.test(name))
  throw Object.assign(new Error('Project name must be one visible folder name.'),{code:'INVALID_PROJECT_NAME',field:'name'});
 if(!existsSync(helperPath))throw Object.assign(new Error('Project creation helper is unavailable. Build the bundled sidecar before creating projects.'),{code:'PROJECT_CREATE_UNAVAILABLE'});
 return new Promise((resolve,reject)=>{
  const child=spawn(helperPath,['--create-project-directory'],{stdio:['pipe','pipe','pipe']});let output='',stderr='';
  child.stdout.on('data',chunk=>{output+=chunk});child.stderr.on('data',chunk=>{stderr+=chunk});
  child.once('error',reject);child.stdin.on('error',()=>{});
  child.once('close',code=>{
   let result;try{result=JSON.parse(output)}catch{result={error:stderr||'Project creation helper failed.'}}
   if(code===0&&result.created===true)resolve({created:true});
   else reject(Object.assign(new Error(result.error||'Project creation failed.'),{code:result.code||'CREATE_DIRECTORY_FAILED',field:'name'}));
  });child.stdin.end(JSON.stringify({root,parent,name}));
 });
}
