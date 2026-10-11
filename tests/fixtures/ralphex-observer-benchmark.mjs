// An owned, disposable runner fixture for the documented tool-transport benchmark.
// Never pass an existing directory or an active Ralphex run.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { initialize, phase } from '../../scripts/ralphex-run.mjs';

if (!process.argv[2]) throw new Error('Provide a new disposable fixture directory');
const root = resolve(process.argv[2]);
mkdirSync(root); // Refuse to reuse another run's directory.
const git = (...args) => execFileSync('git', args, {
  cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']
}).trim();
git('init', '-q');
git('config', 'user.name', 'Observer Fixture');
git('config', 'user.email', 'fixture@example.invalid');
writeFileSync(join(root, '.gitignore'), 'work/\n');
mkdirSync(join(root, 'docs'));
writeFileSync(join(root, 'docs/plan.md'), '### Task 1: Controlled quiet fixture\n- [ ] Execute the fixture\n');
git('add', '.gitignore', 'docs/plan.md');
git('commit', '-qm', 'fixture');
const dir = join(root, 'work/run');
initialize(dir, { cwd: root, issue: 'https://example.invalid/fixture/1', beads: 'fixture-only', base: git('rev-parse', 'HEAD') });
writeFileSync(join(dir, 'full.log'), '');
const result = phase(dir, 'execute', {
  plan: 'docs/plan.md',
  invoke() {
    writeFileSync(join(dir, 'ready.json'), JSON.stringify({ startedAt: Date.now(), runnerPid: process.pid, quietMs: 40000 }));
    const child = spawnSync(process.execPath, ['-e', 'setTimeout(() => process.stdout.write("synthetic fixture completed\\n"), 40000)'], { encoding: 'utf8' });
    writeFileSync(join(dir, 'full.log'), (child.stdout ?? '') + (child.stderr ?? ''));
    writeFileSync(join(dir, 'exit.json'), JSON.stringify({ endedAt: Date.now(), status: child.status, signal: child.signal }));
    return child;
  }
});
writeFileSync(join(dir, 'result.json'), JSON.stringify(result));
process.stdout.write(JSON.stringify({ fixtureResult: result.status, exit: result.lastExit, headSha: result.headSha, ready: JSON.parse(readFileSync(join(dir, 'ready.json'))) }) + '\n');
if (result.status === 'failed') process.exitCode = 1;
