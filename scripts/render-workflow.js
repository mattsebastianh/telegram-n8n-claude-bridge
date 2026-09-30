#!/usr/bin/env node
// Renders an importable n8n workflow from this repo's workflow files and your .env.
// The output is git-ignored (*.local.json): it contains your IDs and, in the default mode, the bridge key.
//
//   node scripts/render-workflow.js               Mode A: fills telegram_claude_bridge.template.json
//                                                 (bridge key written into the HTTP Request node headers)
//   node scripts/render-workflow.js --credential  Mode A, but the key stays out of the file: the node
//                                                 uses an n8n Header Auth credential
//   node scripts/render-workflow.js --bundled     Mode B: telegram_claude_bridge.json (reads $env in n8n)
//   --out file.json                               custom output path
//
// Workflow and webhook ids are derived from BRIDGE_API_KEY, not taken from the repo. n8n protects the
// Telegram webhook with a secret built from those ids, so fixed ids published in a repo would make
// that secret (and the webhook URL) guessable. Derived ids are stable, so re-importing replaces the
// previous copy; rotating BRIDGE_API_KEY gives new ids (delete the old workflow in n8n).
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const args = process.argv.slice(2);
const useCredential = args.includes('--credential');
const bundled = args.includes('--bundled');
const outIndex = args.indexOf('--out');

if (useCredential && bundled) {
  console.error('Error: --credential applies to the template (Mode A) and cannot be combined with --bundled.');
  process.exit(1);
}

const sourceFile = bundled ? 'telegram_claude_bridge.json' : 'telegram_claude_bridge.template.json';
const defaultOut = bundled ? 'telegram_claude_bridge.bundled.local.json' : 'telegram_claude_bridge.local.json';
const outPath = outIndex >= 0 ? path.resolve(args[outIndex + 1]) : path.join(root, 'n8n/workflows', defaultOut);

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
const key = env.BRIDGE_API_KEY || '';
if (key.length < 24 || /^(YOUR_|REPLACE|CHANGE|EXAMPLE)|example|password|secret/i.test(key)) {
  fail('BRIDGE_API_KEY in .env is missing, too short (minimum 24 characters) or still a placeholder. Generate one with: openssl rand -hex 32');
}
const ids = (env.TELEGRAM_ALLOWED_USER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
if (!ids.length) fail('TELEGRAM_ALLOWED_USER_IDS is empty in .env.');
if (!ids.every((id) => /^-?\d+$/.test(id))) fail('TELEGRAM_ALLOWED_USER_IDS must be comma-separated numeric Telegram IDs.');

const apiUrl = (env.BRIDGE_API_URL || `http://host.docker.internal:${env.BRIDGE_PORT || 3000}`).replace(/\/+$/, '');

// Stable, secret-derived identifiers
const derive = (label) => crypto.createHmac('sha256', key).update(`telegram-claude-bridge:${label}`).digest('hex');
const workflowId = derive('workflow-id').slice(0, 16);
const h = derive('webhook-id');
const webhookId = `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;

const values = {
  __ALLOWED_USER_IDS__: JSON.stringify(ids),
  __BRIDGE_API_URL__: apiUrl,
  __BRIDGE_API_KEY__: key,
};

// Replace placeholders inside parsed string values, so the result is always valid JSON
function fill(node) {
  if (typeof node === 'string') {
    return Object.entries(values).reduce((text, [name, value]) => text.split(name).join(value), node);
  }
  if (Array.isArray(node)) return node.map(fill);
  if (node && typeof node === 'object') return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, fill(v)]));
  return node;
}

const template = JSON.parse(fs.readFileSync(path.join(root, 'n8n/workflows', sourceFile), 'utf8'));

if (useCredential) {
  const http = template.nodes.find((n) => n.name === 'Send to Claude');
  delete http.parameters.sendHeaders;
  delete http.parameters.headerParameters;
  http.parameters.authentication = 'genericCredentialType';
  http.parameters.genericAuthType = 'httpHeaderAuth';
  http.credentials = { httpHeaderAuth: { id: '', name: 'Claude Bridge API Key' } };
}

const workflow = fill(template);
workflow.id = workflowId;
const variant = bundled ? 'bundled' : useCredential ? 'credential' : 'env-filled';
workflow.name = `Telegram to Claude Bridge (${variant}) ${workflowId.slice(0, 6)}`;
const trigger = workflow.nodes.find((n) => n.type === 'n8n-nodes-base.telegramTrigger');
if (!trigger) fail('no Telegram Trigger node found in the workflow.');
trigger.webhookId = webhookId;

const leftover = JSON.stringify(workflow).match(/__[A-Z_]+__/g);
if (leftover) fail(`unfilled placeholders: ${[...new Set(leftover)].join(', ')}`);

fs.writeFileSync(outPath, `${JSON.stringify(workflow, null, 2)}\n`, { mode: 0o600 });
fs.chmodSync(outPath, 0o600);

console.log(`Wrote ${path.relative(process.cwd(), outPath)}`);
console.log(`  variant:      ${variant}`);
if (!bundled) {
  console.log(`  bridge URL:   ${apiUrl}/execute`);
  console.log(`  bridge key:   ${useCredential ? 'not included (select a Header Auth credential on Send to Claude)' : 'included in the Send to Claude headers (masked here)'}`);
} else {
  console.log('  bridge key:   read by n8n from its environment ($env.BRIDGE_API_KEY)');
}
console.log(`  allowed IDs:  ${ids.length}`);
console.log('  workflow and webhook ids: derived from BRIDGE_API_KEY (stable across renders)');
