# Workflows

The project ships one workflow: `n8n/workflows/telegram_claude_bridge.json`.

## Variants

| File | For | Bridge key | Allowlist | Bridge URL |
|------|-----|-----------|-----------|------------|
| `telegram_claude_bridge.json` | Bundled n8n (Mode B) | `$env.BRIDGE_API_KEY` | `$env.TELEGRAM_ALLOWED_USER_IDS` | `$env.BRIDGE_API_URL` |
| `telegram_claude_bridge.template.json` | Existing n8n (Mode A), rendered by `scripts/render-workflow.js` | `Authorization: Bearer <key>` header, or a Header Auth credential with `--credential` | Array filled from `TELEGRAM_ALLOWED_USER_IDS` | `BRIDGE_API_URL`, or `http://host.docker.internal:BRIDGE_PORT` |

### The template
The HTTP Request node in the template holds placeholders instead of values:

| Placeholder | Filled with |
|-------------|-------------|
| `__BRIDGE_API_URL__` | `BRIDGE_API_URL` from `.env`, else `http://host.docker.internal:<BRIDGE_PORT>` (default port 3000) |
| `__BRIDGE_API_KEY__` | `BRIDGE_API_KEY` from `.env` |
| `__ALLOWED_USER_IDS__` | `TELEGRAM_ALLOWED_USER_IDS` as a JSON array, for example `["123456789"]` |

`node scripts/render-workflow.js` replaces them inside the parsed JSON (so the output is always valid), refuses placeholder or non-numeric values, and fails if any placeholder is left. The output, `telegram_claude_bridge.local.json`, is written with mode 600 and is git-ignored.

Filling the key into the node means it is stored in that n8n's database with the workflow, readable by anyone who can open the workflow. `--credential` avoids that: the node uses an n8n Header Auth credential and the key never appears in the file.

Neither Mode A option needs environment variables in the n8n container, so `N8N_BLOCK_ENV_ACCESS_IN_NODE` stays at its default. ### Workflow and webhook ids
`n8n import:workflow` needs a top-level workflow `id`. The committed files carry the marker `RENDER_WITH_SCRIPT_BEFORE_IMPORT` instead of a real one, and `scripts/render-workflow.js` replaces the workflow id and the Telegram Trigger's `webhookId` with values derived (HMAC-SHA256) from `BRIDGE_API_KEY`.

This matters for security: n8n's Telegram Trigger checks the `X-Telegram-Bot-Api-Secret-Token` header against `<workflow id>_<node id>`, and the webhook URL contains the `webhookId`. With ids fixed in a public repo, both would be public. Derived ids are private, stable across renders (re-importing replaces the previous copy) and change if you rotate the key.

`--bundled` renders the Mode B workflow (`telegram_claude_bridge.json`) the same way. Rendered files import cleanly into n8n 2.20.11.

## Nodes (both variants)

| # | Node | Type | Behaviour |
|---|------|------|-----------|
| 1 | Telegram Trigger | `telegramTrigger` | Fires on `message` updates |
| 2 | Verify Allowlist | `if` | True when both `message.chat.id` and `message.from.id` are in the allowed list; the false branch is unconnected, so others get no reply |
| 3 | Send to Claude | `httpRequest` | `POST /execute` on the bridge with `JSON.stringify({ command: message.text })` as the body and the bearer key |
| 4 | Send Response | `telegram` | Sends `$json.output` to the originating `chat.id` |

Every message is treated as raw input for the Claude session. There are no slash commands.

## Known limitations
- Output is sent as one message. Telegram rejects text over 4096 characters, so longer replies fail to send until splitting is added (see [Telegram limits](#telegram-limits)).
- The bridge's timeout note is not surfaced separately.
- Errors from the bridge are not caught or reported to the user.

Router commands (`/status`, `/cancel`), sub-workflows and a global error workflow are planned; see [roadmap.md](roadmap.md).

## Telegram limits
Checked against Telegram's Bot API documentation on 2026-09-30.

| Limit | Value |
|-------|-------|
| `sendMessage` text | 1–4096 characters (after entity parsing) |
| Media caption | 0–1024 characters |
| Messages per chat | about 1 per second |
| Messages per group | 20 per minute |
| Broadcast | about 30 messages per second (1000 with paid broadcasts) |
| Webhook ports | 443, 80, 88, 8443, HTTPS only |

Claude replies can exceed 4096 characters. The workflow does not split them yet; when it does, send chunks of at most 4096 characters and keep to one message per second per chat.
