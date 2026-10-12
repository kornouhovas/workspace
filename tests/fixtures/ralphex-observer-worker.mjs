import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { phase } from '../../scripts/ralphex-run.mjs';
const [dir,mode = 'quiet',duration = '250',startupDelay = '0'] = process.argv.slice(2);
if (Number(startupDelay) > 0) await new Promise(resolve => setTimeout(resolve, Number(startupDelay)));
if (mode === 'startup-exit') process.exit(23);
const result = phase(dir,'execute',{plan:'docs/plan.md',invoke(command,args,options) {
  if (mode === 'throw') throw new Error('Fixture launch denied');
  return spawnSync(process.execPath,[fileURLToPath(new URL('./ralphex-observer-executor.mjs',import.meta.url)),mode,duration],options);
}});
process.stdout.write(JSON.stringify(result)+'\n');
if (result.status === 'failed') process.exitCode = 1;
