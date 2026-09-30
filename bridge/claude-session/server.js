const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env'), quiet: true });
const crypto = require('crypto');
const express = require('express');
const pty = require('node-pty');

const app = express();
const PORT = process.env.BRIDGE_PORT || 3000;
const API_KEY = process.env.BRIDGE_API_KEY;
const CLAUDE_CMD = process.env.CLAUDE_CMD || 'claude';
const DEBUG = process.env.BRIDGE_DEBUG === '1';
const COMMAND_TIMEOUT_MS = 120000;
const MAX_COMMAND_LENGTH = 8000;

if (!API_KEY) {
  console.error('CRITICAL ERROR: BRIDGE_API_KEY is not set in .env');
  process.exit(1);
}

// Localhost is always allowed. Add the Docker gateway address for n8n with
// BRIDGE_ALLOWED_IPS (comma-separated), only if requests from n8n are refused.
const ALLOWED_IPS = new Set([
  '127.0.0.1',
  '::1',
  '::ffff:127.0.0.1',
  ...(process.env.BRIDGE_ALLOWED_IPS || '').split(',').map((s) => s.trim()).filter(Boolean),
]);
const keyBuffer = Buffer.from(API_KEY);

function hasValidKey(header) {
  const match = /^Bearer (.+)$/.exec(header || '');
  if (!match) return false;
  const given = Buffer.from(match[1]);
  return given.length === keyBuffer.length && crypto.timingSafeEqual(given, keyBuffer);
}

app.use((req, res, next) => {
  const remoteIp = req.socket.remoteAddress;
  if (!ALLOWED_IPS.has(remoteIp)) {
    console.warn(`Blocked request from disallowed IP: ${remoteIp}`);
    return res.status(403).json({ error: 'Forbidden: source IP not allowed.' });
  }
  if (!hasValidKey(req.headers.authorization)) {
    console.warn(`Blocked request with invalid API key from ${remoteIp}`);
    return res.status(401).json({ error: 'Unauthorized: Invalid API Key.' });
  }
  next();
});

// Parse bodies only after the request has been authenticated
app.use(express.json({ limit: '64kb' }));

// Strips ANSI escape sequences (colors, cursor movements)
const stripAnsi = (str) => str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');

let term = null;
let ready = false;
let outputBuffer = '';
let pending = null; // { resolve, timer } for the request in flight

function finishPending(note) {
  if (!pending) return;
  const { resolve, timer } = pending;
  clearTimeout(timer);
  pending = null;
  const output = outputBuffer;
  outputBuffer = '';
  resolve(note ? { output, note } : { output });
}

function startClaude() {
  console.log(`Starting ${CLAUDE_CMD} in a PTY...`);
  ready = false;
  outputBuffer = '';
  // The PTY process is claude itself (via a login shell for PATH), so if it
  // exits there is no bare shell left to receive commands.
  const proc = pty.spawn('/bin/zsh', ['-l', '-c', `exec ${CLAUDE_CMD}`], {
    name: 'xterm-color',
    cols: 120,
    rows: 40,
    cwd: process.env.HOME || process.cwd(),
    env: process.env,
  });
  term = proc;

  proc.onData((data) => {
    if (DEBUG) process.stdout.write(data);
    outputBuffer += stripAnsi(data.toString());

    // Claude Code shows the prompt character ❯ (U+276F) when ready for input
    const isReady = /❯\s*$/.test(outputBuffer);
    const notLoggedIn = outputBuffer.includes('Not logged in') || outputBuffer.includes('Please run /login');

    if (!pending) {
      if (isReady) { ready = true; outputBuffer = ''; }
      return;
    }
    if (isReady || notLoggedIn) finishPending();
  });

  proc.onExit(({ exitCode }) => {
    console.warn(`Claude exited (code ${exitCode}); restarting in 3s.`);
    if (term === proc) { term = null; ready = false; }
    finishPending('Claude session exited.');
    setTimeout(startClaude, 3000);
  });
}

startClaude();

function runCommand(command) {
  return new Promise((resolve, reject) => {
    if (!term || !ready) {
      const err = new Error('Claude session is not ready.');
      err.status = 503;
      return reject(err);
    }
    outputBuffer = '';
    const timer = setTimeout(
      () => finishPending('Output incomplete: Timeout waiting for prompt.'),
      COMMAND_TIMEOUT_MS
    );
    pending = { resolve, timer };
    term.write(`${command}\r`);
  });
}

// One command at a time: the PTY has a single shared output stream.
let queue = Promise.resolve();

app.post('/execute', (req, res) => {
  const { command } = req.body || {};
  if (typeof command !== 'string' || !command.trim()) {
    return res.status(400).json({ error: 'No command provided.' });
  }
  if (command.length > MAX_COMMAND_LENGTH) {
    return res.status(413).json({ error: 'Command too long.' });
  }
  // A newline would submit several prompts at once
  const single = command.replace(/[\r\n]+/g, ' ').trim();

  queue = queue
    .then(() => runCommand(single))
    .then((result) => res.json(result))
    .catch((err) => res.status(err.status || 500).json({ error: err.message }));
});

app.post('/reset', (req, res) => {
  if (term) term.kill(); // onExit restarts the session
  res.json({ status: 'Restarting' });
});

app.get('/status', (req, res) => {
  res.json({ status: ready ? 'Online' : 'Starting', processPid: term ? term.pid : null });
});

// JSON errors instead of Express's default HTML page with a stack trace
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({ error: err.status === 400 ? 'Invalid JSON body.' : 'Internal error.' });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Bridge API running on http://127.0.0.1:${PORT}`);
});
