import assert from 'node:assert/strict';
import test from 'node:test';
import {observeSelectionBackend} from '../scripts/selection-editor-driver.mjs';

test('selection smoke observes owned backend processes after readiness, including a reopened app',async()=>{
 for(const launch of ['cold','reopen']){
  let ready=false;const observations=[];
  // Electron/Page are external automation boundaries. The first window exists
  // before backend startup; its ready observation admits utility metrics.
  const app={evaluate:async()=>{observations.push('owned');return ready?[41]:[];}};
  const page={waitForFunction:async()=>{observations.push('ready');ready=true;}};
  assert.deepEqual(await observeSelectionBackend(app,page),[41],launch);
  assert.deepEqual(observations,['ready','owned'],launch);
 }
});
