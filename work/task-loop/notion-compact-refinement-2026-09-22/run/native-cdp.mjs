import { readFile, writeFile } from 'node:fs/promises';

// Diagnostic only: connects to the isolated Electron process started with port 9229.
const port = 9236;
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const target = targets.find((item) => item.type === 'page' && item.title === 'Workspace');
if (!target) throw new Error('Workspace native target is unavailable');
const browser = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
const command = JSON.parse(await readFile(process.argv[2], 'utf8'));
const ws = new WebSocket(command.type === 'bounds' ? browser.webSocketDebuggerUrl : target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});
let nextId = 0;
const pending = new Map();
ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (!message.id) return;
  const promise = pending.get(message.id);
  if (!promise) return;
  pending.delete(message.id);
  if (message.error) promise.reject(new Error(JSON.stringify(message.error)));
  else promise.resolve(message.result);
});
function send(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
try {
  if (command.type === 'eval') {
    const result = await send('Runtime.evaluate', {
      expression: command.expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    console.log(JSON.stringify(result.result?.value, null, 2));
  } else if (command.type === 'click') {
    const expression = `(() => { const el = ${command.expression}; if (!el) throw new Error('click target missing'); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, text: el.textContent }; })()`;
    const point = await send('Runtime.evaluate', { expression, returnByValue: true });
    if (point.exceptionDetails) throw new Error(point.exceptionDetails.text);
    const { x, y, text } = point.result.value;
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    console.log(JSON.stringify({ x, y, text }));
  } else if (command.type === 'key') {
    const keyCode = command.key === 'Tab' ? 9 : command.key === 'Escape' ? 27 : undefined;
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: command.key, code: command.key, windowsVirtualKeyCode: keyCode });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: command.key, code: command.key, windowsVirtualKeyCode: keyCode });
    console.log(JSON.stringify({ key: command.key }));
  } else if (command.type === 'clearViewport') {
    await send('Emulation.clearDeviceMetricsOverride');
    const metrics = await send('Runtime.evaluate', {
      expression: '({innerWidth, innerHeight, devicePixelRatio})',
      returnByValue: true,
    });
    console.log(JSON.stringify(metrics.result?.value));
  } else if (command.type === 'bounds') {
    const win = await send('Browser.getWindowForTarget', { targetId: target.id });
    await send('Browser.setWindowBounds', { windowId: win.windowId, bounds: command.bounds });
    const actual = await send('Browser.getWindowBounds', { windowId: win.windowId });
    console.log(JSON.stringify({ windowId: win.windowId, requested: command.bounds, actual: actual.bounds }));
  } else if (command.type === 'screenshot') {
    await send('Page.enable');
    if (command.viewport) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: command.viewport[0],
        height: command.viewport[1],
        deviceScaleFactor: 1,
        mobile: false,
      });
    }
    if (command.waitFor) {
      const wait = await send('Runtime.evaluate', {
        expression: `new Promise((resolve, reject) => { const start = performance.now(); const check = () => { if (${command.waitFor}) return resolve(true); if (performance.now() - start > 5000) return reject(new Error('capture condition timed out')); setTimeout(check, 50); }; check(); })`,
        awaitPromise: true,
        returnByValue: true,
      });
      if (wait.exceptionDetails) throw new Error(wait.exceptionDetails.text);
    }
    const metrics = await send('Runtime.evaluate', {
      expression: '({innerWidth, innerHeight, devicePixelRatio, url: location.href, title: document.title})',
      returnByValue: true,
    });
    const screenshot = await send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
      fromSurface: true,
    });
    await writeFile(command.path, Buffer.from(screenshot.data, 'base64'));
    console.log(JSON.stringify({ target: target.url, metrics: metrics.result?.value, path: command.path }));
  } else {
    throw new Error(`Unsupported command: ${command.type}`);
  }
} finally {
  ws.close();
}
