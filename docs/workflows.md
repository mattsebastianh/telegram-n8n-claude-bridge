# Workflows

The project ships one workflow: `n8n/workflows/telegram_claude_bridge.json`.

## Telegram Claude Bridge

| # | Node | Type | Behaviour |
|---|------|------|-----------|
| 1 | Telegram Trigger | `telegramTrigger` | Fires on `message` updates |
| 2 | Verify Allowlist | `if` | True when both `message.chat.id` and `message.from.id` are in the comma-separated `$env.TELEGRAM_ALLOWED_USER_IDS`; the false branch is unconnected, so others get no reply |
| 3 | Send to Claude | `httpRequest` | `POST {BRIDGE_API_URL}/execute` with `Authorization: Bearer $env.BRIDGE_API_KEY` and the message text as `command` |
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
