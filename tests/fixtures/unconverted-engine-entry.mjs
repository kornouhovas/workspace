// Test-only Electron utility boundary for retained #72 engine guarantees.
// The shipped entry keeps its default gated factory. This bundle is excluded
// from packages and its auto-start is disabled only by the test build command.
import nodeProcess from 'node:process';
import {startServiceProcess} from '../../src/service/entry.ts';
import {openLegacyCommandTransportFixture} from '../support/unconverted-command-engines.mjs';

if(!nodeProcess.parentPort)throw new Error('An owned utility parent port is required');
startServiceProcess(nodeProcess.parentPort,(...args)=>openLegacyCommandTransportFixture(...args),code=>nodeProcess.exit(code));
