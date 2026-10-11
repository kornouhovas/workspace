const [mode,duration] = process.argv.slice(2);
if (mode === 'noisy') process.stdout.write('ordinary output\n'.repeat(10000)+'RALPHEX_STAGE {"status":"success"}\n');
await new Promise(resolve=>setTimeout(resolve,Number(duration)));
process.stdout.write('fixture executor finished\n');
if (mode === 'failure') process.exitCode = 9;
