import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
test('status assignment acceptance selects three hosts, complete suite and actual DEV/package consumers without changing full default',()=>{
 const dispatch=readFileSync('.github/workflows/desktop-ci.yml','utf8'),workflow=readFileSync('.github/workflows/status-moves.yml','utf8');
 assert.match(dispatch,/common:\n {4}if:.*inputs.checks != 'status-moves'/);
 assert.match(dispatch,/options: \[full, status-moves,/);assert.match(dispatch,/default: full/);
 assert.match(dispatch,/inputs.checks == 'status-moves'[\s\S]*?uses: .\/.github\/workflows\/status-moves.yml/);
 assert.match(workflow,/os: \[macos-latest, windows-latest, windows-2022\]/);
 for(const command of ['npm run test:all','node scripts/smoke-status-assignment.mjs','npm run smoke:folder-roles','node scripts/smoke-group-assignment.mjs --filesystem','npm run check:artifact -- release'])assert.ok(workflow.includes(command));
 assert.equal((workflow.match(/run: node scripts\/smoke-status-assignment.mjs/g)||[]).length,2);
 assert.match(workflow,/WORKSPACE_SMOKE_MODE: release/);assert.match(workflow,/if: always\(\)/);assert.match(workflow,/set -o pipefail/);
 assert.ok(!workflow.includes('continue-on-error'));
});
