import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('integrated package acceptance propagates a failed journey and records unreached consumers', async () => {
  const evidence = await mkdtemp(join(tmpdir(), 'workspace-integration-probe-'));
  try {
    const result = spawnSync(process.execPath, ['scripts/integrated-desktop.mjs', '--failure-probe'], {
      env: { ...process.env, WORKSPACE_SMOKE_EVIDENCE_DIR: evidence }, encoding: 'utf8',
    });
    assert.equal(result.status, 23, result.stderr);
    const report = JSON.parse(await readFile(join(evidence, 'report.json'), 'utf8'));
    assert.equal(report.diagnostic, true);
    assert.equal(report.completeSelection, false);
    assert.equal(report.status, 'failed');
    assert.equal(report.journeys[0].exitCode, 23);
    assert.equal(report.journeys[0].status, 'failed');
    assert.ok(report.journeys.slice(1).every(row => row.status === 'unreached'));
  } finally { await rm(evidence, { recursive: true, force: true }); }
});

test('unknown integration selections fail before launching an application', () => {
  const result = spawnSync(process.execPath, ['scripts/integrated-desktop.mjs', '--from=missing'], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown integrated journey/);
});
