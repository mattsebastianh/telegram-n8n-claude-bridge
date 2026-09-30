# Workflows

The project ships one workflow: `n8n/workflows/telegram_claude_bridge.json`.

## Variants

| File | For | Bridge key | Allowlist | Bridge URL |
|------|-----|-----------|-----------|------------|
| `telegram_claude_bridge.json` | Bundled n8n (Mode B) | `$env.BRIDGE_API_KEY` | `$env.TELEGRAM_ALLOWED_USER_IDS` | `$env.BRIDGE_API_URL` |
| `telegram_claude_bridge.shared.json` | Existing n8n (Mode A) | Header Auth credential `Claude Bridge API Key` | IDs written in the **Verify Allowlist** node (placeholder `REPLACE_WITH_TELEGRAM_USER_ID`) | `http://host.docker.internal:3000/execute` |

The shared variant needs no environment variables, so `N8N_BLOCK_ENV_ACCESS_IN_NODE` can stay at its default and other workflows on the instance can't read the bridge key. Files named `*.local.json` are git-ignored, so you can keep a copy with your real ID. Both files carry a fixed workflow `id` (required for `n8n import:workflow`) and import cleanly into n8n 2.20.11.

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
