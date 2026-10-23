import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, mkdirSync, openSync, readFileSync, readdirSync, readlinkSync, writeFileSync } from 'node:fs';
import { arch, cpus, release, totalmem } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { packagedExecutablePath } from './runtime-executable.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Every principal and late surface observes one unchanged package. Original
// native/recovery consumers remain explicit rather than inheriting old receipts.
const journey = (id, script, ...args) => ({ id, args: [`scripts/${script}.mjs`, ...args] });
export const integratedJourneys = [
  journey('foundation', 'smoke-visual-foundation'),
  journey('shell', 'smoke-desktop-shell'),
  journey('workspaces', 'smoke-workspace-management'),
  journey('sources', 'smoke-source-settings'),
  journey('board', 'smoke-board'),
  journey('navigation', 'smoke-project-navigation'),
  journey('keyboard', 'smoke-keyboard-journey'),
  journey('files', 'smoke-project-files'),
  journey('scalars', 'smoke-scalar-drafts', 'release'),
  journey('selections', 'smoke-selection-editors', 'release'),
  journey('properties', 'smoke-property-management', 'release'),
  journey('assignment', 'smoke-group-assignment'),
  journey('filesystem-assignment', 'smoke-group-assignment', '--filesystem'),
  journey('projects', 'smoke-contextual-projects', 'release'),
  journey('categories', 'smoke-contextual-categories', 'release'),
  journey('archive-contexts', 'smoke-contextual-archive', 'release'),
  journey('retained-recovery', 'smoke-retained-recovery', 'release'),
  journey('sessions', 'smoke-workspace-sessions', 'release'),
  journey('recovery', 'smoke-data-recovery', 'release'),
  ...['views', 'multi-select', 'single-select', 'date-properties', 'number-properties', 'project-archive', 'category-options']
    .map(script => journey(`original-${script}`, `smoke-${script}`, 'release')),
  journey('original-base', 'smoke-runtime', 'release'),
  // The ordinary runtime command itself requires base + rename + category move
  // with separate fixtures/receipts. Do not replay its successful native tails.
  journey('original-creation-crash', 'smoke-runtime', 'release', '--creation', '--skip-native'),
  ...['direct', 'grouped'].map(mode => journey(`original-creation-${mode}`, 'smoke-runtime', 'release', '--creation', `--discovery-mode=${mode}`, '--checkpoint=after_evidence')),
  journey('strict-scale', 'smoke-performance', '--enforce', '--project-flows'),
];

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
function packageFiles(directory, prefix = '') {
  return readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
    const path = join(directory, entry.name), name = `${prefix}${entry.name}`;
    if (entry.isDirectory()) return packageFiles(path, `${name}/`);
    return [[name, entry.isSymbolicLink() ? `symlink:${readlinkSync(path)}` : sha256(readFileSync(path))]];
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some(arg => !['--list', '--failure-probe'].includes(arg) && !arg.startsWith('--from=') && !arg.startsWith('--exclude='))) throw new Error('Expected --list, --from=<journey>, --exclude=<journeys> or --failure-probe');
  const from = args.find(arg => arg.startsWith('--from='))?.slice(7);
  const start = from === undefined ? 0 : integratedJourneys.findIndex(row => row.id === from);
  if (start < 0) throw new Error(`Unknown integrated journey: ${from}`);
  const excluded=args.find(arg=>arg.startsWith('--exclude='))?.slice(10).split(',')??[];
  for(const id of excluded)if(!integratedJourneys.some(row=>row.id===id))throw new Error(`Unknown integrated journey: ${id}`);
  const selectedJourneys=integratedJourneys.slice(start).filter(row=>!excluded.includes(row.id));
  if(!selectedJourneys.length)throw new Error('Empty integrated selection');
  const excludedJourneys=integratedJourneys.filter(row=>!selectedJourneys.includes(row)).map(row=>row.id);
  if (args.includes('--list')) console.log(JSON.stringify(selectedJourneys, null, 2));
  else {
    const diagnostic = args.includes('--failure-probe');
    const evidence = resolve(process.env.WORKSPACE_SMOKE_EVIDENCE_DIR ?? 'work/issue-67-integrated');
    mkdirSync(evidence, { recursive: true });
    const executable = diagnostic ? null : packagedExecutablePath(root, process.platform, process.arch);
    const asar = executable && join(dirname(executable), process.platform === 'darwin' ? '../Resources/app.asar' : 'resources/app.asar');
    const packageSha256 = asar ? sha256(readFileSync(asar)) : null;
    const bundle = executable && (process.platform === 'darwin' ? resolve(executable, '../../..') : dirname(executable));
    const packageInventory = bundle ? packageFiles(bundle) : null;
    const selected = diagnostic ? [{ id: 'failure-probe', args: ['-e', 'console.log(JSON.stringify({performanceRoot:process.env.WORKSPACE_PERFORMANCE_ROOT,revealTrace:process.env.WORKSPACE_REVEAL_TRACE,archiveEntryTrace:process.env.WORKSPACE_ARCHIVE_ENTRY_TRACE,categoryEntryTrace:process.env.WORKSPACE_CATEGORY_ENTRY_TRACE}));process.exit(23)'] }, ...selectedJourneys] : selectedJourneys;
    const report = {
      issue: 67, sha: git(['rev-parse', 'HEAD']), run: process.env.GITHUB_RUN_ID ?? null,
      attempt: process.env.GITHUB_RUN_ATTEMPT ?? null, diagnostic, mode: 'release',
      platform: process.platform, arch: arch(), kernel: release(), cpu: cpus()[0]?.model,
      hostMemoryBytes: totalmem(), node: process.version, executable, packageSha256, packageInventory,
      completeSelection: !diagnostic && excludedJourneys.length === 0, excludedJourneys,
      sourceDiffSha256: sha256(execFileSync('git', ['diff', 'HEAD', '--binary'], { cwd: root })),
      harness: Object.fromEntries(readdirSync(join(root, 'scripts')).filter(name => name.endsWith('.mjs')).sort()
        .map(name => [name, sha256(readFileSync(join(root, 'scripts', name)))])),
      status: 'running', journeys: selected.map(row => ({ ...row, status: 'unreached' })),
    };
    const save = () => writeFileSync(join(evidence, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    save();
    try {
      for (const row of report.journeys) {
        const output = join(evidence, row.id);
        mkdirSync(output, { recursive: true });
        row.status = 'running'; row.startedAt = new Date().toISOString(); save();
        console.log(`Integrated packaged journey: ${row.id}`);
        const fd = openSync(join(output, 'runtime.log'), 'w');
        let result;
        try {
          result = spawnSync(process.execPath, row.args, { cwd: root, stdio: ['ignore', fd, fd],
            env: { ...process.env, GITHUB_SHA: report.sha, WORKSPACE_SMOKE_MODE: 'release', WORKSPACE_SMOKE_EVIDENCE_DIR: output,
              WORKSPACE_PERFORMANCE_ROOT: root, WORKSPACE_REVEAL_TRACE: '0', WORKSPACE_ARCHIVE_ENTRY_TRACE: '0', WORKSPACE_CATEGORY_ENTRY_TRACE: '0' } });
        } finally { closeSync(fd); }
        row.finishedAt = new Date().toISOString(); row.exitCode = result.status; row.signal = result.signal;
        row.logSha256 = sha256(readFileSync(join(output, 'runtime.log')));
        if (result.error) row.error = result.error.message;
        row.status = result.status === 0 && !result.error ? 'passed' : 'failed'; save();
        if (row.status === 'failed') { process.exitCode = result.status || 1; break; }
      }
      // Catch accidental rebuilds between journeys: same-source labels alone do
      // not establish that all commands exercised the same packaged application.
      if (asar && sha256(readFileSync(asar)) !== packageSha256) throw new Error('Package changed during acceptance');
      if (bundle && JSON.stringify(packageFiles(bundle)) !== JSON.stringify(packageInventory)) throw new Error('Package resources changed during acceptance');
      report.status = report.journeys.every(row => row.status === 'passed') ? (report.completeSelection ? 'passed' : 'partial') : 'failed';
    } catch (error) { report.status = 'failed'; report.error = error.stack; process.exitCode = 1; }
    finally { save(); }
  }
}
