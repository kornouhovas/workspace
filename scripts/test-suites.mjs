import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Only DOM/mocked-client and pure helper tests belong here. Mixed suites that
// open SQLite, touch real project folders or launch processes stay platform tests.
const common = new Set([
  'components.test.tsx',
  'native-bridge-evidence.test.mjs',
  'project-category-move-ui.test.tsx',
  'project-recovery-ui.test.tsx',
  'project-rename-ui.test.tsx',
  'rename-runtime-startup.test.mjs',
  'runtime-executable.test.mjs',
  'runtime-layout.test.mjs',
  'runtime-readiness.test.mjs',
  'test-suites.test.mjs',
]);

export function selectTestFiles(files, suite) {
  if (!['all', 'common', 'platform'].includes(suite)) throw new Error('Expected suite: all, common or platform');
  if (new Set(files).size !== files.length || files.some(name => !/^[\w-]+\.test\.(mjs|tsx)$/.test(name))) {
    throw new Error('Invalid test inventory');
  }
  for (const name of common) if (!files.includes(name)) throw new Error(`Missing common test: ${name}`);
  return files.filter(name => suite === 'all' || (suite === 'common' ? common.has(name) : !common.has(name))).sort();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [suite, option, ...extra] = process.argv.slice(2);
    if (extra.length || (option !== undefined && option !== '--list')) throw new Error('Usage: node scripts/test-suites.mjs <all|common|platform> [--list]');
    const inventory = readdirSync('tests').filter(name => /\.test\.(mjs|tsx)$/.test(name));
    const files = selectTestFiles(inventory, suite).map(name => `tests/${name}`);
    if (option === '--list') console.log(JSON.stringify(files));
    else {
      const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', ...files], { stdio: 'inherit' });
      if (result.error) throw result.error;
      process.exitCode = result.status ?? 1;
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
