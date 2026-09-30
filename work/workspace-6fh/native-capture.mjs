import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
export async function nativeCapture(pid,path,width,height){
 const attempts=[];
 for(let i=0;i<5;i++){
  await fetch('http://127.0.0.1:9247/front');
  await new Promise(r=>setTimeout(r,700));
  const output=execFileSync('work/workspace-6fh/capture-window',[String(pid),path],{encoding:'utf8'});
  const bytes=await readFile(path);const w=bytes.readUInt32BE(16),h=bytes.readUInt32BE(20);
  const match=output.match(/Height = (\d+);[\s\S]*?Width = (\d+);/);const cg=match?{width:Number(match[2]),height:Number(match[1])}:null;
  attempts.push({w,h,cg,output});
  if(w===width&&h===height&&cg?.width===width&&cg?.height===height)return {path,attempts};
 }
 throw new Error(`Unstable native capture ${path}: ${JSON.stringify(attempts.map(({w,h,cg})=>({w,h,cg})))}`);
}
