import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const dir='work/workspace-bk1/table-2026-10-01';const rt=JSON.parse(await readFile(`${dir}/runtime.json`,'utf8'));const [label,w='1440',h='960']=process.argv.slice(2);
const bounds=await(await fetch(`http://127.0.0.1:9467/size?width=${w}&height=${h}`)).json();
execFileSync('osascript',['-e',`tell application "System Events" to set frontmost of first application process whose unix id is ${rt.pid} to true`]);
await new Promise(resolve=>setTimeout(resolve,750));
const native=execFileSync('/tmp/workspace-bk1-table-capture',[String(rt.pid),`${dir}/${label}.png`],{encoding:'utf8'});
const bytes=await readFile(`${dir}/${label}.png`);const pixels={width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};if(pixels.width!==+w||pixels.height!==+h)throw Error('Invalid native size');
execFileSync(process.execPath,[`${dir}/measure.mjs`,`${dir}/${label}.json`],{stdio:'ignore'});await writeFile(`${dir}/${label}-capture.json`,JSON.stringify({pid:rt.pid,bounds,pixels,native},null,2));console.log(label,pixels);
