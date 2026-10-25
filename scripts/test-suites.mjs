import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Only DOM/mocked-client and pure helper tests belong here. Mixed suites that
// open SQLite, touch real project folders or launch processes stay platform tests.
const common = new Set([
  'components.test.tsx',
  'source-association-ui.test.tsx',
  'folder-roles-ui.test.tsx',
  'project-files-ui.test.tsx',
  'external-file-evidence.test.mjs',
  'context-tools.test.tsx',
  'desktop-ux-checks.test.mjs',
  'native-bridge-evidence.test.mjs',
  'project-category-move-ui.test.tsx',
  'project-recovery-ui.test.tsx',
  'project-rename-ui.test.tsx',
  'project-operation-dialog.test.tsx',
  'contextual-archive-ui.test.tsx',
  'rename-runtime-startup.test.mjs',
  'runtime-executable.test.mjs',
  'runtime-layout.test.mjs',
  'runtime-readiness.test.mjs',
]);

export function selectTestFiles(files, suite) {
  if (!['all', 'common', 'platform'].includes(suite)) throw new Error('Expected suite: all, common or platform');
  if (new Set(files).size !== files.length || files.some(name => !/^[\w-]+\.test\.(mjs|tsx)$/.test(name))) {
    throw new Error('Invalid test inventory');
  }
  for (const name of common) if (!files.includes(name)) throw new Error(`Missing common test: ${name}`);
  return files.filter(name => suite === 'all' || (suite === 'common' ? common.has(name) : !common.has(name))).sort();
}

export function selectTestBatches(files, platform) {
  if (platform !== 'win32') return [files];
  // Native utility-exit and creator-close controls retain their original bounds
  // without competing with the rest of the real-Electron platform workers.
  const isolated = ['tests/project-category-move-fixture.test.mjs', 'tests/property-editor-driver.test.mjs'].filter(file => files.includes(file));
  return [...isolated.map(file => [file]), files.filter(file => !isolated.includes(file))].filter(batch => batch.length);
}

export function runTestBatches(batches, run) {
  let failed = false;
  for (const batch of batches) {
    const result = run(batch);
    if (result.error) throw result.error;
    if (result.status !== 0) failed = true;
  }
  return failed ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [suite, option, ...extra] = process.argv.slice(2);
    if (extra.length || (option !== undefined && option !== '--list')) throw new Error('Usage: node scripts/test-suites.mjs <all|common|platform> [--list]');
    const inventory = readdirSync('tests').filter(name => /\.test\.(mjs|tsx)$/.test(name));
    const files = selectTestFiles(inventory, suite).map(name => `tests/${name}`);
    if (option === '--list') console.log(JSON.stringify(files));
    else {
      // Electron installs lazily on first require. Finish that shared mutation
      // before native test workers can concurrently extract/use the same binary.
      if (suite !== 'common') createRequire(import.meta.url)('electron');
      process.exitCode = runTestBatches(selectTestBatches(files, process.platform), batch =>
        spawnSync(process.execPath, ['--import', 'tsx', '--test', ...batch], { stdio: 'inherit' }));
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
