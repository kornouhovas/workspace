// Serialized into Electron main only for a separate diagnostic run. No payload,
// result, error, path or process identity is retained; strict acceptance never installs it.
export function installPerformanceCommandProbe({ipcMain}) {
  const original = ipcMain._invokeHandlers?.get('workspace:command');
  if (typeof original !== 'function') throw new Error('Diagnostic workspace handler unavailable');
  globalThis.__workspacePerformanceCommands = [];
  ipcMain.removeHandler('workspace:command');
  ipcMain.handle('workspace:command', async (event, input) => {
    const started = Date.now(), clock = performance.now();
    try { return await original(event, input); }
    finally {
      if (['workspace.setViewGrouping','workspace.queryView','workspace.getViewGrouping','workspace.getTableLayout','workspace.assignProjectGroup','workspace.setViewFilter','workspace.setTextValue','workspace.refreshSource','workspace.listTextProperties'].includes(input?.type)) {
        globalThis.__workspacePerformanceCommands.push({type:input.type,started,finished:Date.now(),durationMs:performance.now()-clock});
        if (globalThis.__workspacePerformanceCommands.length > 256) globalThis.__workspacePerformanceCommands.shift();
      }
    }
  });
}
