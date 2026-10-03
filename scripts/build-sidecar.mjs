import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const targets = { local: [process.platform, process.arch], mac: ['darwin', 'arm64'], win: ['win32', 'x64'], linux: ['linux', 'x64'] };
const target = process.argv[2] || 'local';
if (!Object.hasOwn(targets, target)) throw new Error(`Unknown sidecar build target: ${target}`);
const [platform, arch] = targets[target];
const output = join('build', 'sidecar', target === 'local' ? 'local' : `${platform}-${arch}`);
mkdirSync(output, { recursive: true });
const env = { ...process.env, GOFLAGS: `${process.env.GOFLAGS || ''} -buildvcs=false`.trim() };
if (target !== 'local') { env.GOOS = platform === 'win32' ? 'windows' : platform; env.GOARCH = arch === 'x64' ? 'amd64' : arch; }
const result = spawnSync('go', ['build', '-o', join(output, `workspace-sidecar${platform === 'win32' ? '.exe' : ''}`), './cmd/workspace-sidecar'], { stdio: 'inherit', env });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
