import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { phase } from '../../scripts/ralphex-run.mjs';
const [dir,mode = 'quiet',duration = '250',startupDelay = '0'] = process.argv.slice(2);
if (Number(startupDelay) > 0) await new Promise(resolve => setTimeout(resolve, Number(startupDelay)));
if (mode === 'startup-exit') process.exit(23);
const result = phase(dir,'execute',{plan:'docs/plan.md',invoke(command,args,options) {
  if (mode === 'throw') throw new Error('Fixture launch denied');
  if (mode === 'gated') {
    // Hold the owned runner before it spawns a descendant. Failed assertions
    // cannot strand a child polling a fixture that teardown has removed.
    const deadline = Date.now() + 10000, wait = new Int32Array(new SharedArrayBuffer(4));
    while (true) {
      try {
        if (readFileSync(join(dir,'fixture-release'),'utf8') !== 'release\n') throw new Error('Invalid fixture release');
        break;
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (Date.now() >= deadline) throw new Error('Fixture release timed out');
      Atomics.wait(wait,0,0,10);
    }
  }
  return spawnSync(process.execPath,[fileURLToPath(new URL('./ralphex-observer-executor.mjs',import.meta.url)),mode === 'gated' ? 'quiet' : mode,duration],options);
}});
process.stdout.write(JSON.stringify(result)+'\n');
if (result.status === 'failed') process.exitCode = 1;
