const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env'), quiet: true });
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const express = require('express');

const app = express();

const PORT = process.env.BRIDGE_PORT || 3000;
const API_KEY = process.env.BRIDGE_API_KEY;
const CLAUDE_CMD = process.env.CLAUDE_CMD || 'claude';
const WORKDIR = process.env.BRIDGE_CWD;
// Read and edit only by default; add Bash to let messages run shell commands
const ALLOWED_TOOLS = process.env.BRIDGE_ALLOWED_TOOLS || 'Read,Glob,Grep,Edit,Write';
const SYSTEM_PROMPT = process.env.BRIDGE_SYSTEM_PROMPT ||
  'You are answering through a Telegram chat. Keep replies concise, in plain text, and under 3500 characters.';
const DEBUG = process.env.BRIDGE_DEBUG === '1';
const COMMAND_TIMEOUT_MS = Number(process.env.BRIDGE_TIMEOUT_MS) || 300000;
const MAX_COMMAND_LENGTH = 8000;
const SESSION_FILE = path.join(__dirname, '.session');

if (!API_KEY) {
  console.error('CRITICAL ERROR: BRIDGE_API_KEY is not set in .env');
  process.exit(1);
}
// A copied example value would make the bridge reachable with a publicly known key
if (API_KEY.length < 24 || /^(YOUR_|REPLACE|CHANGE|EXAMPLE)|example|password|secret/i.test(API_KEY)) {
  console.error('CRITICAL ERROR: BRIDGE_API_KEY is too short (minimum 24 characters) or still a placeholder. Generate one with: openssl rand -hex 32');
  process.exit(1);
}

// Claude runs in a dedicated folder, never in the whole home directory.
let workdirError = null;
if (!WORKDIR) {
  workdirError = 'BRIDGE_CWD is not set in .env (folder Claude should work in).';
} else if (!fs.existsSync(WORKDIR) || !fs.statSync(WORKDIR).isDirectory()) {
  workdirError = `BRIDGE_CWD does not exist or is not a directory: ${WORKDIR}`;
} else if ([os.homedir(), '/'].includes(fs.realpathSync(WORKDIR))) {
  workdirError = 'BRIDGE_CWD must be a dedicated folder, not your home directory or /.';
}
if (workdirError) {
  console.error(`CRITICAL ERROR: ${workdirError}`);
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

// Conversation continuity: each message resumes the same Claude session.
let sessionId = null;
try { sessionId = fs.readFileSync(SESSION_FILE, 'utf8').trim() || null; } catch (e) { /* no session yet */ }

function saveSession(id) {
  sessionId = id || null;
  try {
    if (sessionId) fs.writeFileSync(SESSION_FILE, `${sessionId}\n`, { mode: 0o600 });
    else fs.rmSync(SESSION_FILE, { force: true });
  } catch (e) {
    console.warn(`Could not persist session id: ${e.message}`);
  }
}

// Variables set by a parent Claude Code session would make this one think it is a child session.
function cleanEnv() {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key === 'CLAUDECODE' || key.startsWith('CLAUDE_CODE_')) delete env[key];
  }
  return env;
}

let busy = false;
let current = null; // child process of the request in flight

// Runs one `claude -p` call. Resolves { code, stdout, stderr, timedOut }.
function runClaude(prompt, resumeId) {
  return new Promise((resolve) => {
    const args = ['-p', '--output-format', 'json', '--allowedTools', ALLOWED_TOOLS,
      '--append-system-prompt', SYSTEM_PROMPT];
    if (resumeId) args.push('--resume', resumeId);

    // A login shell gives claude the same PATH as your terminal
    const child = spawn('/bin/zsh', ['-l', '-c', 'exec "$0" "$@"', CLAUDE_CMD, ...args], {
      cwd: WORKDIR,
      env: cleanEnv(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    current = child;

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, COMMAND_TIMEOUT_MS);

    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; if (DEBUG) process.stderr.write(d); });
    child.on('error', (err) => { stderr += err.message; });
    child.on('close', (code) => {
      clearTimeout(timer);
      current = null;
      resolve({ code, stdout, stderr, timedOut });
    });

    child.stdin.on('error', () => { /* process may exit before reading */ });
    child.stdin.end(prompt); // the prompt goes through stdin, so it can never be parsed as a flag
  });
}

function parseResult(stdout) {
  try {
    const data = JSON.parse(stdout);
    return { text: typeof data.result === 'string' ? data.result : '', id: data.session_id || null, isError: !!data.is_error };
  } catch (e) {
    return null;
  }
}

async function execute(prompt) {
  let run = await runClaude(prompt, sessionId);
  let parsed = parseResult(run.stdout);

  // Only if the stored session no longer exists: start a new conversation once
  const sessionMissing = /no conversation|session.*(not found|does not exist)|not found.*session/i.test(`${run.stderr} ${run.stdout}`);
  if (sessionId && !run.timedOut && run.code !== 0 && sessionMissing) {
    console.warn('Resume failed; starting a new conversation.');
    saveSession(null);
    run = await runClaude(prompt, null);
    parsed = parseResult(run.stdout);
  }

  if (run.timedOut) return { status: 200, body: { output: parsed ? parsed.text : '', note: 'Timeout: Claude took too long and was stopped.' } };
  if (run.code !== 0 || !parsed) {
    const detail = (run.stderr || run.stdout || '').trim().slice(0, 500) || `claude exited with code ${run.code}`;
    return { status: 502, body: { error: detail } };
  }
  if (parsed.id) saveSession(parsed.id);
  if (parsed.isError) return { status: 200, body: { output: parsed.text, note: 'Claude reported an error.' } };
  return { status: 200, body: { output: parsed.text } };
}

// One command at a time: they all share one conversation.
let queue = Promise.resolve();

app.post('/execute', (req, res) => {
  const { command } = req.body || {};
  if (typeof command !== 'string' || !command.trim()) {
    return res.status(400).json({ error: 'No command provided.' });
  }
  if (command.length > MAX_COMMAND_LENGTH) {
    return res.status(413).json({ error: 'Command too long.' });
  }

  queue = queue
    .then(async () => {
      busy = true;
      try {
        const { status, body } = await execute(command);
        res.status(status).json(body);
      } finally {
        busy = false;
      }
    })
    .catch((err) => res.status(500).json({ error: err.message }));
});

// Forget the conversation (next message starts a new one) and stop any call in flight.
app.post('/reset', (req, res) => {
  saveSession(null);
  if (current) current.kill('SIGTERM');
  res.json({ status: 'Session cleared' });
});

app.get('/status', (req, res) => {
  res.json({ status: 'Online', workdir: WORKDIR, busy, session: sessionId ? 'active' : 'none' });
});

// JSON errors instead of Express's default HTML page with a stack trace
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({ error: err.status === 400 ? 'Invalid JSON body.' : 'Internal error.' });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Bridge API running on http://127.0.0.1:${PORT} (Claude workdir: ${WORKDIR})`);
});
