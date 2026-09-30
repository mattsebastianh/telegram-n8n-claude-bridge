#!/usr/bin/env node
// Fills n8n/workflows/telegram_claude_bridge.template.json with values from .env and writes a
// ready-to-import workflow (git-ignored: it contains your IDs and, by default, the bridge key).
//
//   node scripts/render-workflow.js                 key is written into the HTTP Request node headers
//   node scripts/render-workflow.js --credential    key stays out: the node uses an n8n Header Auth credential
//   node scripts/render-workflow.js --out file.json custom output path
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const args = process.argv.slice(2);
const useCredential = args.includes('--credential');
const outIndex = args.indexOf('--out');
const outPath = outIndex >= 0 ? path.resolve(args[outIndex + 1]) : path.join(root, 'n8n/workflows/telegram_claude_bridge.local.json');

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

// Minimal .env parser (KEY=value, # comments, optional quotes)
function readEnv(file) {
  if (!fs.existsSync(file)) fail(`${file} not found. Copy .env.example to .env first.`);
  const env = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match || line.trim().startsWith('#')) continue;
    env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return env;
}

const env = readEnv(path.join(root, '.env'));
const ids = (env.TELEGRAM_ALLOWED_USER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
if (!ids.length) fail('TELEGRAM_ALLOWED_USER_IDS is empty in .env.');
if (!ids.every((id) => /^-?\d+$/.test(id))) fail('TELEGRAM_ALLOWED_USER_IDS must be comma-separated numeric Telegram IDs.');
if (!useCredential && !env.BRIDGE_API_KEY) fail('BRIDGE_API_KEY is empty in .env.');
if (!useCredential && /^YOUR_|REPLACE|example/i.test(env.BRIDGE_API_KEY)) fail('BRIDGE_API_KEY still has its placeholder value.');

const apiUrl = (env.BRIDGE_API_URL || `http://host.docker.internal:${env.BRIDGE_PORT || 3000}`).replace(/\/+$/, '');

const values = {
  __ALLOWED_USER_IDS__: JSON.stringify(ids),
  __BRIDGE_API_URL__: apiUrl,
  __BRIDGE_API_KEY__: env.BRIDGE_API_KEY || '',
};

// Replace placeholders inside parsed string values, so the result is always valid JSON
function fill(node) {
  if (typeof node === 'string') {
    return Object.entries(values).reduce((text, [key, value]) => text.split(key).join(value), node);
  }
  if (Array.isArray(node)) return node.map(fill);
  if (node && typeof node === 'object') return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, fill(v)]));
  return node;
}

const template = JSON.parse(fs.readFileSync(path.join(root, 'n8n/workflows/telegram_claude_bridge.template.json'), 'utf8'));

if (useCredential) {
  const http = template.nodes.find((n) => n.name === 'Send to Claude');
  delete http.parameters.sendHeaders;
  delete http.parameters.headerParameters;
  http.parameters.authentication = 'genericCredentialType';
  http.parameters.genericAuthType = 'httpHeaderAuth';
  http.credentials = { httpHeaderAuth: { id: '', name: 'Claude Bridge API Key' } };
}

const workflow = fill(template);
workflow.id = 'tgClaudeLcl00001';
workflow.name = `Telegram to Claude Bridge (${useCredential ? 'credential' : 'env-filled'})`;

const leftover = JSON.stringify(workflow).match(/__[A-Z_]+__/g);
if (leftover) fail(`unfilled placeholders: ${[...new Set(leftover)].join(', ')}`);

fs.writeFileSync(outPath, `${JSON.stringify(workflow, null, 2)}\n`, { mode: 0o600 });
fs.chmodSync(outPath, 0o600);

console.log(`Wrote ${path.relative(process.cwd(), outPath)}`);
console.log(`  bridge URL:   ${apiUrl}/execute`);
console.log(`  allowed IDs:  ${ids.length}`);
console.log(`  bridge key:   ${useCredential ? 'not included (select a Header Auth credential on Send to Claude)' : 'included in the Send to Claude headers (masked here)'}`);
