import {spawnSync,execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {closeSync,mkdirSync,openSync,readFileSync,readdirSync,readlinkSync,writeFileSync} from 'node:fs';
import {arch,release} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {packagedExecutablePath} from './runtime-executable.mjs';

export function commandSafetyJourneys(mode) {
  if(!['dev','release'].includes(mode))throw new Error('Choose dev or release');
  return [
    {id:'source-enrollment',args:['scripts/smoke-source-association.mjs']},
    {id:'creation-recovery-native',args:['scripts/smoke-project-creation.mjs',mode]},
    {id:'rename',args:['scripts/smoke-runtime.mjs',mode,'--rename']},
    {id:'category-move',args:['scripts/smoke-runtime.mjs',mode,'--category-move']},
    {id:'category-folders-removal',args:['scripts/smoke-category-options.mjs',mode]},
    {id:'archive-restore',args:['scripts/smoke-project-archive.mjs',mode]},
    {id:'files-native',args:['scripts/smoke-project-files.mjs']},
    {id:'backup-recovery',args:['scripts/smoke-data-recovery.mjs',mode]},
  ];
}
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const sha256=value=>createHash('sha256').update(value).digest('hex');
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
function inventory(directory,prefix='') {
  return readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(entry=>{
    const path=join(directory,entry.name),name=prefix+entry.name;
    return entry.isDirectory()?inventory(path,name+'/'):[[name,entry.isSymbolicLink()?'symlink:'+readlinkSync(path):sha256(readFileSync(path))]];
  });
}
function harnessDigests(){return Object.fromEntries(readdirSync(join(root,'scripts')).filter(name=>name.endsWith('.mjs')).sort().map(name=>[name,sha256(readFileSync(join(root,'scripts',name)))]));}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const [mode,...options]=process.argv.slice(2),all=commandSafetyJourneys(mode);
  if(options.some(option=>!['--list','--failure-probe'].includes(option)&&!['--from=','--through='].some(prefix=>option.startsWith(prefix))) || ['--from=','--through='].some(prefix=>options.filter(option=>option.startsWith(prefix)).length>1))throw new Error('Expected --list, --from=<journey>, --through=<journey> or --failure-probe');
  const from=options.find(option=>option.startsWith('--from='))?.slice(7),start=from===undefined?0:all.findIndex(row=>row.id===from);
  const through=options.find(option=>option.startsWith('--through='))?.slice(10),end=through===undefined?all.length-1:all.findIndex(row=>row.id===through);
  if(start<0||end<start)throw new Error('Unknown or reversed command-safety journey range');
  const selected=all.slice(start,end+1);
  if(options.includes('--list'))console.log(JSON.stringify(selected));
  else {
    const diagnostic=options.includes('--failure-probe'),output=resolve(process.env.WORKSPACE_SMOKE_EVIDENCE_DIR??`work/issue-72-${mode}`);
    mkdirSync(output,{recursive:true});
    const report={mode,phase:process.env.WORKSPACE_COMMAND_SAFETY_PHASE??'standalone-runtime',diagnostic,platform:process.platform,os:release(),arch:arch(),head:git(['rev-parse','HEAD']),sha:process.env.GITHUB_SHA??null,
      run:process.env.GITHUB_RUN_ID??null,attempt:process.env.GITHUB_RUN_ATTEMPT??null,sourceDiffSha256:sha256(execFileSync('git',['diff','HEAD','--binary'],{cwd:root})),
      harnessDigests:harnessDigests(),
      selected:selected.map(row=>row.id),excluded:all.filter(row=>!selected.includes(row)).map(row=>row.id),packageBefore:null,packageAfter:null,appAsarSha256:null,
      journeys:all.map(row=>({id:row.id,status:'unreached'})),status:'running'};
    const save=()=>writeFileSync(join(output,'manifest.json'),JSON.stringify(report,null,2)+'\n');
    let bundle,activeRow,exitCode=0;
    try {
      if(mode==='release'&&!diagnostic) {
        const executable=packagedExecutablePath(root,process.platform,process.arch);
        bundle=process.platform==='darwin'?resolve(executable,'../../..'):dirname(executable);
        report.packageBefore=inventory(bundle);
        report.appAsarSha256=sha256(readFileSync(join(dirname(executable),process.platform==='darwin'?'../Resources/app.asar':'resources/app.asar')));
      }
      save();
      const runs=diagnostic?[{id:'failure-probe',args:['-e','process.exit(23)']}]:selected;
      for(const journey of runs) {
        const row=diagnostic?{id:journey.id,status:'running'}:report.journeys.find(row=>row.id===journey.id);
        activeRow=row;
        if(diagnostic)report.journeys.unshift(row);
        row.status='running';save();console.log(`${mode}: ${journey.id}`);
        const directory=join(output,journey.id);mkdirSync(directory,{recursive:true});const log=openSync(join(directory,'runtime.log'),'w');
        let result;
        try {result=spawnSync(process.execPath,journey.args,{cwd:root,env:{...process.env,WORKSPACE_SMOKE_MODE:mode,WORKSPACE_SMOKE_EVIDENCE_DIR:directory},stdio:['ignore',log,log]});}
        finally{closeSync(log);}
        row.exitCode=result.status;row.signal=result.signal;row.logSha256=sha256(readFileSync(join(directory,'runtime.log')));
        row.status=!result.error&&result.status===0?'passed':'failed';save();
        if(result.error)throw result.error;
        if(row.status==='failed'){exitCode=result.status||1;break;}
        if(bundle){report.packageAfter=inventory(bundle);if(JSON.stringify(report.packageBefore)!==JSON.stringify(report.packageAfter))throw new Error('Package changed during command-safety acceptance');}
        if(git(['rev-parse','HEAD'])!==report.head || sha256(execFileSync('git',['diff','HEAD','--binary'],{cwd:root}))!==report.sourceDiffSha256 || JSON.stringify(harnessDigests())!==JSON.stringify(report.harnessDigests))throw new Error('Source or harness changed during command-safety acceptance');
        activeRow=undefined;
      }
      report.status=exitCode?'failed':selected.length<all.length?'partial':'passed';
    }catch(error){exitCode=1;report.status='failed';report.error=error.message;if(activeRow){activeRow.status='failed';activeRow.error=error.message;}}
    finally{save();}
    process.exitCode=exitCode;
  }
}
