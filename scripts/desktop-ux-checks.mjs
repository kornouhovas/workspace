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
// Bounded Board acceptance retains real service/folder seams and shared focus consumers.
export const boardTests = [
  'desktop-ux-checks.test.mjs', 'runtime-lifecycle.test.mjs', 'context-tools.test.tsx', 'components.test.tsx',
  'board-layout-ui.test.tsx', 'board-layout-service.test.mjs',
  'view-grouping-ui.test.tsx', 'view-grouping-service.test.mjs',
  'group-assignment-ui.test.tsx', 'group-assignment-service.test.mjs',
  'views-ui.test.tsx', 'views-service.test.mjs', 'view-filters-ui.test.tsx',
  'table-layout-ui.test.tsx', 'viewport-projects-ui.test.tsx',
];
export function boardCommands() {
  return [
    ['npm', ['run', 'typecheck']], ['npm', ['run', 'lint']],
    [process.execPath, ['--import','tsx','--test',...boardTests.map(file=>`tests/${file}`)]],
    [process.execPath, ['scripts/smoke-board.mjs']],
    ['npm', ['run', 'smoke:shell']],
    ['npm', ['run', 'smoke:views']],
  ];
}
// Ordinary assignment changes both list surfaces and the shared draft guard.
export function groupAssignmentCommands() {
  const tests = [...new Set([...boardTests, 'group-assignment-interactions.test.tsx',
    'group-assignment-ipc.test.mjs', 'scalar-drafts-ui.test.tsx',
    'selection-editors-ui.test.tsx', 'single-select-service.test.mjs', 'multi-select-service.test.mjs'])];
  return [
    ['npm', ['run', 'typecheck']], ['npm', ['run', 'lint']],
    [process.execPath, ['--import', 'tsx', '--test', ...tests.map(file => `tests/${file}`)]],
    [process.execPath, ['-e', "require('electron')"]],
    [process.execPath, ['--test', 'tests/runtime-group-drag.test.mjs']],
    [process.execPath, ['scripts/smoke-group-assignment.mjs']],
    ['npm', ['run', 'smoke:views']],
  ];
}
// Contextual filesystem dialogs retain original native and packaged consumers.
export function contextualProjectCommands({regressionsOnly=false}={}) {
  const tests = ['desktop-ux-checks.test.mjs', 'project-operation-dialog.test.tsx', 'project-category-move-ui.test.tsx', 'project-creation-ui.test.tsx',
    'project-rename-ui.test.tsx', 'project-navigation-ui.test.tsx', 'scalar-drafts-ui.test.tsx',
    'project-creation-service.test.mjs', 'project-creation-crash.test.mjs',
    'project-rename-service.test.mjs', 'project-rename-journal.test.mjs',
    'project-rename-coordination.test.mjs', 'project-rename-crash.test.mjs',
    'project-rename-ipc.test.mjs', 'project-reveal.test.mjs',
    'windows-project-reveal.test.mjs', 'windows-project-reveal-com.test.mjs'];
  if (regressionsOnly) return [
    ['npm', ['run','typecheck']], ['npm', ['run','lint']],
    [process.execPath, ['--import','tsx','--test', ...['desktop-ux-checks.test.mjs',
      'project-operation-dialog.test.tsx', 'project-category-move-ui.test.tsx',
      'project-creation-ui.test.tsx', 'project-rename-ui.test.tsx', 'test-suites.test.mjs'].map(file=>`tests/${file}`)]],
  ];
  const native = mode => [
    [process.execPath, ['scripts/smoke-contextual-projects.mjs', mode]],
    ['npm', ['run', 'smoke:runtime', '--', mode, '--rename']],
    ...['direct','grouped'].map(discovery => ['npm', ['run', 'smoke:runtime', '--', mode,
      '--creation', `--discovery-mode=${discovery}`, '--checkpoint=after_evidence']]),
  ];
  return [
    ['npm', ['run', 'typecheck']], ['npm', ['run', 'lint']],
    [process.execPath, ['--import','tsx','--test',...tests.map(file=>`tests/${file}`)]],
    ...native('dev'), ['npm', ['run','package:built']], ['npm', ['run','check:artifact','--','release']],
    ...native('release'),
  ];
}
// Contextual archive retains the existing real-folder recovery and restart consumers.
export function contextualArchiveCommands({nativeOnly=false}={}) {
  const tests = ['contextual-archive-ui.test.tsx', 'project-archive-ui.test.tsx',
    'project-archive-service.test.mjs', 'project-archive-journal.test.mjs',
    'project-archive-crash.test.mjs', 'project-archive-ipc.test.mjs',
    'project-navigation-ui.test.tsx', 'workspace-sessions-service.test.mjs',
    'scalar-drafts-ui.test.tsx', 'selection-editors-ui.test.tsx',
    'table-layout-ui.test.tsx', 'board-layout-ui.test.tsx', 'view-filters-ui.test.tsx',
    'view-grouping-ui.test.tsx', 'views-ui.test.tsx', 'renderer-app.test.tsx',
    'project-operation-dialog.test.tsx', 'desktop-ux-checks.test.mjs', 'test-suites.test.mjs'];
  if (nativeOnly) return [
    ['npm', ['run','typecheck']], ['npm', ['run','lint']],
    [process.execPath, ['--import','tsx','--test','tests/contextual-archive-ui.test.tsx','tests/rename-runtime-startup.test.mjs','tests/desktop-ux-checks.test.mjs']],
    [process.execPath, ['scripts/smoke-contextual-archive.mjs','dev']],
  ];
  const native = mode => [
    [process.execPath, ['scripts/smoke-contextual-archive.mjs', mode]],
    ['npm', ['run', 'smoke:archive', '--', mode]],
    [process.execPath, ['-e', `require('node:fs').cpSync('work/issue-22-project-archive-runtime','work/issue-62-archive-original-${mode}',{recursive:true})`]],
    ['npm', ['run', 'smoke:views', ...(mode === 'release' ? ['--', mode] : [])]],
    [process.execPath, ['-e', `require('node:fs').cpSync('work/issue-27-views-runtime','work/issue-62-archive-views-${mode}',{recursive:true})`]],
  ];
  return [
    ['npm', ['run', 'typecheck']], ['npm', ['run', 'lint']],
    [process.execPath, ['--import', 'tsx', '--test', ...tests.map(file => `tests/${file}`)]],
    ...native('dev'), ['npm', ['run', 'package:built']], ['npm', ['run', 'check:artifact', '--', 'release']],
    ...native('release'),
  ];
}

// Folder-backed contextual UI retains the existing real filesystem/recovery seams.
export function contextualCategoryCommands() {
  const tests = ['desktop-ux-checks.test.mjs','project-operation-dialog.test.tsx',
    'project-category-move-ui.test.tsx','category-options-ui.test.tsx','category-removal-ui.test.tsx',
    'project-navigation-ui.test.tsx','board-layout-ui.test.tsx','project-creation-ui.test.tsx','project-rename-ui.test.tsx',
    'category-options-service.test.mjs','category-removal-service.test.mjs',
    'project-category-move-service.test.mjs','project-category-move-journal.test.mjs',
    'project-category-move-coordination.test.mjs','project-category-move-crash.test.mjs',
    'project-category-move-ipc.test.mjs','project-category-move-runtime.test.mjs'];
  return [
    ['npm',['run','typecheck']], ['npm',['run','lint']],
    [process.execPath,['--import','tsx','--test',...tests.map(file=>`tests/${file}`)]],
    [process.execPath,['-e',"require('electron')"]],
    [process.execPath,['scripts/smoke-contextual-categories.mjs','dev']],
    [process.execPath,['scripts/smoke-category-options.mjs','dev']],
    ['npm',['run','smoke:runtime','--','dev','--category-move']],
    ['npm',['run','package:built']],['npm',['run','check:artifact','--','release']],
    [process.execPath,['scripts/smoke-contextual-categories.mjs','release']],
    [process.execPath,['scripts/smoke-category-options.mjs','release']],
    ['npm',['run','smoke:runtime','--','release','--category-move']],
  ];
}
// Project navigation changes the shell and both project-list consumers.
export const navigationTests = [...new Set([...boardTests,
  'project-navigation-ui.test.tsx', 'renderer-app.test.tsx',
  'view-filters-service.test.mjs', 'project-archive-ui.test.tsx',
  'project-rename-ui.test.tsx', 'project-recovery-ui.test.tsx', 'project-category-move-ui.test.tsx',
])];
export function navigationCommands({nativeOnly=false}={}) {
  if(nativeOnly) return [
    ['npm',['run','typecheck']], ['npm',['run','lint']],
    [process.execPath,['--test','tests/view-scroll-native.test.mjs']],
    [process.execPath,['--import','tsx','--test','tests/project-navigation-ui.test.tsx','tests/viewport-projects-ui.test.tsx','tests/views-ui.test.tsx','tests/desktop-ux-checks.test.mjs']],
    [process.execPath,['scripts/smoke-project-navigation.mjs']],
  ];
  return [
    ['npm', ['run', 'typecheck']], ['npm', ['run', 'lint']],
    [process.execPath,['--test','tests/view-scroll-native.test.mjs']],
    [process.execPath, ['--import','tsx','--test',...navigationTests.map(file=>`tests/${file}`)]],
    [process.execPath, ['scripts/smoke-project-navigation.mjs']],
    ['npm', ['run', 'smoke:shell']], ['npm', ['run', 'smoke:views']],
  ];
}
// File browsing crosses the service/IPC/native boundary on every supported host.
export const projectFilesTests = [...new Set([...navigationTests,
  'project-files-service.test.mjs', 'project-files-ui.test.tsx', 'project-reveal.test.mjs',
  'backend-lifecycle.test.mjs', 'windows-project-reveal.test.mjs', 'windows-project-reveal-com.test.mjs',
  'native-reveal-receipt.test.mjs', 'project-archive-service.test.mjs',
  'build-smoke.test.mjs', 'artifact-smoke.test.mjs', 'runtime-project-visibility.test.mjs', 'external-file-evidence.test.mjs',
])];
export function projectFilesCommands({nativeOnly=false}={}) {
  const tests = nativeOnly ? ['project-files-service.test.mjs','project-files-ui.test.tsx','backend-lifecycle.test.mjs','project-reveal.test.mjs','runtime-project-visibility.test.mjs','external-file-evidence.test.mjs','desktop-ux-checks.test.mjs'] : projectFilesTests;
  return [
    ['npm', ['run', 'typecheck']], ['npm', ['run', 'lint']],
    [process.execPath, ['--import','tsx','--test','tests/windows-project-reveal-com.test.mjs']],
    [process.execPath, ['--import','tsx','--test',...tests.filter(file=>file!=='windows-project-reveal-com.test.mjs').map(file=>`tests/${file}`)]],
    [process.execPath, ['scripts/smoke-project-files.mjs']],
    ...(nativeOnly ? [] : [[process.execPath, ['scripts/smoke-project-navigation.mjs']], ['npm', ['run', 'smoke:shell']]]),
    ['npm', ['run', 'smoke:views']],
  ];
}
// One milestone candidate exercises each principal journey and shared regression once.
export function coherentCommands() {
  const nativeTests = ['view-scroll-native.test.mjs', 'property-editor-driver.test.mjs', 'runtime-view-readiness.test.mjs', 'windows-project-reveal-com.test.mjs'];
  const tests = [...new Set([...foundationTests, ...projectFilesTests])].filter(file => !nativeTests.includes(file));
  return [
    ['npm', ['run', 'typecheck']], ['npm', ['run', 'lint']],
    ...nativeTests.map(file => [process.execPath, ['--import', 'tsx', '--test', `tests/${file}`]]),
    [process.execPath, ['--import', 'tsx', '--test', ...tests.map(file => `tests/${file}`)]],
    ...['smoke-visual-foundation', 'smoke-board', 'smoke-project-files', 'smoke-project-navigation'].map(script => [process.execPath, [`scripts/${script}.mjs`]]),
    ...['smoke:shell', 'smoke:workspaces', 'smoke:sources', 'smoke:views'].map(script => ['npm', ['run', script]]),
  ];
}
export function sessionCommands() {
  const tests = ['workspace-sessions-service.test.mjs', 'data-recovery-service.test.mjs', 'automatic-backups-service.test.mjs',
    'workspaces-service.test.mjs', 'views-service.test.mjs', 'project-navigation-ui.test.tsx', 'renderer-app.test.tsx',
    'project-files-service.test.mjs', 'artifact-smoke.test.mjs', 'build-smoke.test.mjs', 'desktop-ux-checks.test.mjs'];
  return [
    ['npm', ['run', 'typecheck']], ['npm', ['run', 'lint']],
    [process.execPath, ['--import', 'tsx', '--test', ...tests.map(file => `tests/${file}`)]],
    [process.execPath, ['scripts/smoke-workspace-sessions.mjs', 'dev']],
    ['npm', ['run', 'smoke:data-recovery', '--', 'dev']],
  ];
}
// Shared scalar editors change Table, Board, project and shell navigation.
export function scalarCommands() {
  const tests = [...new Set([...navigationTests, 'scalar-drafts-ui.test.tsx',
    'number-properties-ui.test.tsx', 'date-properties-ui.test.tsx',
    'text-properties-service.test.mjs', 'number-properties-service.test.mjs',
    'date-properties-service.test.mjs', 'single-select-ui.test.tsx',
    'multi-select-ui.test.tsx', 'workspace-sessions-service.test.mjs'])];
  return [
    ['npm', ['run', 'typecheck']], ['npm', ['run', 'lint']],
    [process.execPath, ['--import', 'tsx', '--test', ...tests.map(file => `tests/${file}`)]],
    [process.execPath, ['scripts/smoke-scalar-drafts.mjs', 'dev']],
    [process.execPath, ['scripts/smoke-project-navigation.mjs']],
    ['npm', ['run', 'smoke:number', '--', 'dev']],
    ['npm', ['run', 'smoke:date', '--', 'dev']],
  ];
}
// Immediate choices share the scalar navigation guard and all three working surfaces.
export function selectionCommands() {
  const tests = [...new Set([...navigationTests, 'selection-editors-ui.test.tsx', 'scalar-drafts-ui.test.tsx',
    'single-select-ui.test.tsx', 'multi-select-ui.test.tsx', 'selection-backend-readiness.test.mjs', 'selection-driver.test.mjs', 'single-select-service.test.mjs',
    'multi-select-service.test.mjs', 'single-select-ipc.test.mjs', 'multi-select-ipc.test.mjs',
    'metadata-removal-ui.test.tsx', 'metadata-removal-service.test.mjs', 'category-options-ui.test.tsx'])];
  return [
    ['npm', ['run', 'typecheck']], ['npm', ['run', 'lint']],
    [process.execPath, ['--import', 'tsx', '--test', ...tests.map(file => `tests/${file}`)]],
    [process.execPath, ['scripts/smoke-selection-editors.mjs', 'dev']],
    ['npm', ['run', 'smoke:select', '--', 'dev']], ['npm', ['run', 'smoke:multiselect', '--', 'dev']],
    [process.execPath, ['scripts/smoke-scalar-drafts.mjs', 'dev']],
    ['npm', ['run', 'smoke:views']],
  ];
}
// Bounded property-definition/removal acceptance; the existing service owns cleanup.
export function propertyCommands() {
  const tests = ['number-properties-ui.test.tsx', 'date-properties-ui.test.tsx', 'property-management-ui.test.tsx', 'metadata-removal-ui.test.tsx', 'metadata-removal-service.test.mjs', 'metadata-removal-ipc.test.mjs',
    'renderer-app.test.tsx', 'single-select-ui.test.tsx', 'multi-select-ui.test.tsx', 'selection-editors-ui.test.tsx', 'scalar-drafts-ui.test.tsx',
    'text-properties-service.test.mjs', 'number-properties-service.test.mjs', 'date-properties-service.test.mjs', 'single-select-service.test.mjs', 'multi-select-service.test.mjs',
    'view-filters-ui.test.tsx', 'view-grouping-ui.test.tsx', 'table-layout-ui.test.tsx', 'board-layout-ui.test.tsx', 'property-editor-driver.test.mjs', 'desktop-ux-checks.test.mjs'];
  return [
    ['npm', ['run', 'typecheck']], ['npm', ['run', 'lint']],
    [process.execPath, ['--import', 'tsx', '--test', ...tests.map(file => `tests/${file}`)]],
    [process.execPath, ['scripts/smoke-property-management.mjs', 'dev']],
    [process.execPath, ['scripts/smoke-selection-editors.mjs', 'dev']],
    ['npm', ['run', 'smoke:select', '--', 'dev']], ['npm', ['run', 'smoke:multiselect', '--', 'dev']],
    ['npm', ['run', 'smoke:views']],
  ];
}
// Renew the original failed commands before the remaining test-only consumers.
export function propertyRepairCommands(platform = process.platform) {
  return [
    ['npm', ['run', 'typecheck']], ['npm', ['run', 'lint']],
    // Complete Electron's lazy extraction before parallel native workers.
    [process.execPath, ['-e', "require('electron')"]],
    [process.execPath, ['--import', 'tsx', '--test', '--test-name-pattern=property view entry waits|grouping closure completes', 'tests/property-editor-driver.test.mjs', 'tests/selection-driver.test.mjs']],
    platform === 'darwin' ? [process.execPath, ['scripts/smoke-property-management.mjs', 'dev']] : ['npm', ['run', 'smoke:views']],
  ];
}
export function propertyRenewalCommands(platform = process.platform, renewViews = false) {
  return [
    [process.execPath, ['--import','tsx','--test','tests/desktop-ux-checks.test.mjs']],
    ['npm', ['run', platform === 'darwin' ? 'smoke:views' : 'smoke:multiselect', ...(platform === 'darwin' ? [] : ['--','dev'])]],
    ...(platform !== 'darwin' && renewViews ? [['npm',['run','smoke:views']]] : []),
  ];
}
export function propertyTailCommands({platform = process.platform, renewViews = false} = {}) {
  return [
    [process.execPath, ['--import', 'tsx', '--test', 'tests/desktop-ux-checks.test.mjs']],
    ...(platform === 'darwin' ? [
      [process.execPath, ['scripts/smoke-selection-editors.mjs', 'dev']],
      ['npm', ['run', 'smoke:select', '--', 'dev']], ['npm', ['run', 'smoke:multiselect', '--', 'dev']],
      ['npm', ['run', 'smoke:views']],
    ] : [
      [process.execPath, ['scripts/smoke-property-management.mjs', 'dev']],
      ...(renewViews ? [['npm', ['run', 'smoke:views']]] : []),
    ]),
  ];
}
// Test-driver-only renewal: unchanged application/878+ source tests retain their receipts.
export function selectionNativeCommands({renewViews = false} = {}) {
  return [
    ['npm', ['run', 'typecheck']], ['npm', ['run', 'lint']],
    [process.execPath, ['--import', 'tsx', '--test', 'tests/selection-driver.test.mjs', 'tests/selection-backend-readiness.test.mjs', 'tests/desktop-ux-checks.test.mjs']],
    [process.execPath, ['scripts/smoke-selection-editors.mjs', 'dev']],
    ['npm', ['run', 'smoke:select', '--', 'dev']], ['npm', ['run', 'smoke:multiselect', '--', 'dev']],
    ...(renewViews ? [['npm', ['run', 'smoke:views']]] : []),
  ];
}
export function selectionFocusCommands() {
  return [
    [process.execPath, ['--import', 'tsx', '--test', 'tests/selection-driver.test.mjs', 'tests/desktop-ux-checks.test.mjs']],
    ['npm', ['run', 'smoke:multiselect', '--', 'dev']],
  ];
}
export function selectionTailCommands() {
  return [
    [process.execPath, ['scripts/smoke-scalar-drafts.mjs', 'dev']],
    ['npm', ['run', 'smoke:views']],
  ];
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
  if(args.some(arg=>!['foundation','board','contextual-categories','contextual-archive','contextual-archive-native','contextual-projects','contextual-project-regressions','group-assignment','navigation','project-files','coherent','sessions','scalars','selections','properties','property-repair','property-tail','property-renewal','selection-native','selection-focus','selection-tail','--list','--failure-probe','--native-only'].includes(arg)) || !['foundation','board','contextual-categories','contextual-archive','contextual-archive-native','contextual-projects','contextual-project-regressions','group-assignment','navigation','project-files','coherent','sessions','scalars','selections','properties','property-repair','property-tail','property-renewal','selection-native','selection-focus','selection-tail'].includes(args[0])) throw new Error('Usage: desktop-ux-checks.mjs <foundation|board|contextual-categories|contextual-archive|contextual-archive-native|contextual-projects|contextual-project-regressions|group-assignment|navigation|project-files|coherent|sessions|scalars|selections|properties|property-repair|property-tail|property-renewal|selection-native|selection-focus|selection-tail> [--list] [--failure-probe]');
  if(args.includes('--native-only') && !['navigation','project-files'].includes(args[0]))throw new Error('--native-only requires navigation or project-files');
  const commands=args[0]==='contextual-categories' ? contextualCategoryCommands() : args[0]==='contextual-archive-native' ? contextualArchiveCommands({nativeOnly:true}) : args[0]==='contextual-archive' ? contextualArchiveCommands() : args[0]==='contextual-project-regressions' ? contextualProjectCommands({regressionsOnly:true}) : args[0]==='contextual-projects' ? contextualProjectCommands() : args[0]==='group-assignment' ? groupAssignmentCommands() : args[0]==='property-renewal' ? propertyRenewalCommands(process.platform, process.env.WORKSPACE_PROPERTY_VIEWS_RENEW==='1') : args[0]==='property-repair' ? propertyRepairCommands() : args[0]==='property-tail' ? propertyTailCommands({renewViews:process.env.WORKSPACE_PROPERTY_VIEWS_RENEW==='1'}) : args[0]==='properties' ? propertyCommands() : args[0]==='selection-focus' ? selectionFocusCommands() : args[0]==='selection-native' ? selectionNativeCommands({renewViews:process.env.WORKSPACE_SELECTION_VIEWS_RENEW==='1'}) : args[0]==='selection-tail' ? selectionTailCommands() : args[0]==='selections' ? selectionCommands() : args[0]==='scalars' ? scalarCommands() : args[0]==='sessions' ? sessionCommands() : args[0]==='coherent' ? coherentCommands() : args[0]==='project-files' ? projectFilesCommands({nativeOnly:args.includes('--native-only')}) : args[0]==='navigation' ? navigationCommands({nativeOnly:args.includes('--native-only')}) : args[0]==='board' ? boardCommands() : foundationCommands({failureProbe:args.includes('--failure-probe')});
  if(args[0]!=='foundation' && args.includes('--failure-probe')) commands.unshift([process.execPath,['-e','process.exit(23)']]);
  if(args.includes('--list')) console.log(JSON.stringify(commands));
  else process.exitCode=runChecks(commands);
}
