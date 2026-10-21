import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
// These suites retain their real SQLite/folder boundaries; this is an impact
// selector, never a reclassification into the common DOM-only suite.
export const foundationTests = [
  'desktop-ux-checks.test.mjs', 'test-suites.test.mjs',
  'components.test.tsx', 'context-tools.test.tsx', 'renderer-app.test.tsx',
  'views-ui.test.tsx', 'views-service.test.mjs', 'views-ipc.test.mjs',
  'table-layout-ui.test.tsx', 'table-layout-service.test.mjs',
  'board-layout-ui.test.tsx', 'view-filters-ui.test.tsx', 'view-grouping-ui.test.tsx',
  'project-category-move-runtime.test.mjs',
  'group-assignment-ui.test.tsx', 'viewport-projects-ui.test.tsx',
  'date-properties-ui.test.tsx', 'number-properties-ui.test.tsx',
  'single-select-ui.test.tsx', 'multi-select-ui.test.tsx',
  'project-creation-ui.test.tsx', 'project-rename-ui.test.tsx',
  'project-category-move-ui.test.tsx', 'project-recovery-ui.test.tsx',
  'project-archive-ui.test.tsx', 'category-options-ui.test.tsx',
  'category-removal-ui.test.tsx', 'metadata-removal-ui.test.tsx',
  'data-recovery-ui.test.tsx', 'artifact-smoke.test.mjs', 'build-smoke.test.mjs',
];
export function foundationCommands({ failureProbe = false } = {}) {
  const commands = [
    ['npm', ['run', 'typecheck']], ['npm', ['run', 'lint']],
    [process.execPath, ['--import', 'tsx', '--test', ...foundationTests.map(file=>`tests/${file}`)]],
    [process.execPath, ['--import','tsx','--test','tests/property-editor-driver.test.mjs']],
    [process.execPath, ['--import','tsx','--test','tests/runtime-view-readiness.test.mjs']],
    [process.execPath, ['scripts/smoke-visual-foundation.mjs']],
    ['npm', ['run', 'smoke:shell']], ['npm', ['run', 'smoke:workspaces']],
    ['npm', ['run', 'smoke:sources']], ['npm', ['run', 'smoke:views']],
  ];
  if (failureProbe) commands.splice(0, 0, [process.execPath, ['-e', 'process.exit(23)']]);
  return commands;
}
export function runChecks(commands, run = (command,args)=>spawnSync(command,args,{stdio:'inherit',shell:process.platform==='win32' && command==='npm'})) {
  for (const [command,args] of commands) {
    const result=run(command,args);
    if(result.error) throw result.error;
    if(result.status !== 0) return result.status ?? 1;
  }
  return 0;
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2);
  if(args.some(arg=>!['foundation','--list','--failure-probe'].includes(arg)) || args[0]!=='foundation') throw new Error('Usage: desktop-ux-checks.mjs foundation [--list] [--failure-probe]');
  const commands=foundationCommands({failureProbe:args.includes('--failure-probe')});
  if(args.includes('--list')) console.log(JSON.stringify(commands));
  else process.exitCode=runChecks(commands);
}
