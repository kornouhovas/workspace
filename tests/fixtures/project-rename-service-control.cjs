/* global Buffer, setTimeout, clearTimeout */
// Private, fixed two-command control for the disposable service fixture only.
const fs = require("node:fs/promises");
const { join } = require("node:path");
const MAX_COMMAND_BYTES = 5;
const commands = { ack: "ack\n", exit: "exit\n" };
function commandPath(root, command) {
  if (!Object.hasOwn(commands, command)) throw new Error("Invalid fixture command");
  return join(root, `${command}.control`);
}
function beforeDeadline(deadline) {
  if (!Number.isFinite(deadline) || Date.now() >= deadline) throw new Error("Fixture control deadline");
}
async function publishCommand(root, command, deadline) {
  const destination = commandPath(root, command), temporary = `${destination}.pending`;
  beforeDeadline(deadline);
  let timer;
  const publish = async () => {
    try { await fs.lstat(destination); throw new Error("Duplicate fixture command"); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    beforeDeadline(deadline);
    // Exclusive creation prevents concurrent publication of the same command.
    const file = await fs.open(temporary, "wx");
    let published = false, renamed = false;
    try {
      try { beforeDeadline(deadline); await file.writeFile(commands[command]); } finally { await file.close(); }
      beforeDeadline(deadline);
      await fs.rename(temporary, destination); renamed = true;
      beforeDeadline(deadline); published = true;
    } finally { if (!published) await fs.rm(renamed ? destination : temporary, { force: true }); }
  };
  try {
    // A stalled local filesystem callback cannot suspend supervisor termination.
    // Late preparation rechecks expiry before opening/writing/publishing; it can
    // close its handle and remove its own expired record. An already-started
    // rename cannot be canceled; late completion removes its destination too.
    await Promise.race([publish(), new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("Fixture publication deadline")), Math.max(0, deadline - Date.now()));
    })]);
  } finally { clearTimeout(timer); }
}
async function readCommand(root, command) {
  let file;
  try { file = await fs.open(commandPath(root, command), "r"); }
  catch (error) { if (error.code === "ENOENT") return false; throw error; }
  try {
    // Read at most one byte beyond the fixed limit; never load arbitrary data.
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > MAX_COMMAND_BYTES || stat.size !== Buffer.byteLength(commands[command])) throw new Error("Invalid fixture command size");
    const buffer = Buffer.alloc(MAX_COMMAND_BYTES + 1);
    const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
    if (!buffer.subarray(0, bytesRead).equals(Buffer.from(commands[command]))) throw new Error("Invalid fixture command record");
    return true;
  } finally { await file.close(); }
}
function startControlReceiver(root, { deadline, onAck, onExit, onError, onTimeout }) {
  let disposed = false, resultPublished = false, acknowledged = false, pollTimer;
  const dispose = () => { disposed = true; clearTimeout(pollTimer); clearTimeout(deadlineTimer); };
  const deadlineTimer = setTimeout(() => { if (!disposed) { dispose(); onTimeout(); } }, Math.max(0, deadline - Date.now()));
  async function poll() {
    if (disposed) return;
    try {
      if (!Number.isFinite(deadline)) throw new Error("Fixture control deadline");
      if (Date.now() >= deadline) { dispose(); onTimeout(); return; }
      const ack = await readCommand(root, "ack"), exit = await readCommand(root, "exit");
      if (disposed) return;
      if (Date.now() >= deadline) { dispose(); onTimeout(); return; }
      if ((ack && (!resultPublished || acknowledged)) || (exit && !acknowledged)) throw new Error("Out-of-order fixture command");
      if (ack) {
        await fs.unlink(commandPath(root, "ack"));
        if (disposed) return;
        acknowledged = true; onAck();
      }
      if (exit) {
        await fs.unlink(commandPath(root, "exit"));
        if (disposed) return;
        dispose(); onExit(); return;
      }
      if (!disposed) pollTimer = setTimeout(() => { void poll(); }, 10);
    } catch {
      if (!disposed) { dispose(); onError(); }
    }
  }
  pollTimer = setTimeout(() => { void poll(); }, 0);
  return { dispose, resultPublished() { resultPublished = true; } };
}
module.exports = { publishCommand, readCommand, startControlReceiver, MAX_COMMAND_BYTES };
