import { readFile } from 'node:fs/promises';

const command = JSON.parse(await readFile(process.argv[2], 'utf8'));
const targets = await (await fetch('http://127.0.0.1:9337/json/list')).json();
const target = targets.find((item) => item.type === 'node');
if (!target) throw new Error('Electron main Node inspector target unavailable');
const ws = new WebSocket(target.webSocketDebuggerUrl);
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
  await send('Runtime.enable');
  const result = await send('Runtime.evaluate', {
    expression: command.expression,
    awaitPromise: true,
    returnByValue: true,
    includeCommandLineAPI: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  }
  console.log(JSON.stringify(result.result?.value, null, 2));
} finally {
  ws.close();
}
