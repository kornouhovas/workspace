// Backend failure is terminal for this launch, not a slow interface render.
export async function waitForRuntimeInterface(page, record) {
  const handle = await page.waitForFunction(() => globalThis.document.querySelector("#interface-language, .workspace-screen > .bb-status--error"), undefined, { timeout: 15000 });
  await handle.dispose();
  const status = await page.evaluate(() => globalThis.window.workspace.getBackendStatus());
  // The controller supplies a finite validated diagnostic; never retain its
  // human message or the utility process's raw error report here.
  const outcome = { state: status.state, ...(status.diagnostic ? { diagnostic: status.diagnostic } : {}) };
  await record(outcome);
  if (status.state !== "ready") throw new Error("Electron local service startup failed; inspect sanitized startup evidence");
  await page.locator("#interface-language").waitFor();
}
