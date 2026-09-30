# Roadmap

## Implemented
- Telegram → n8n → bridge → Claude Code → Telegram round trip.
- Headless Claude (`claude -p`) in a dedicated folder, resuming one conversation, with a tool allowlist and a timeout.
- Multi-ID allowlist checking both `chat.id` and `from.id`, localhost-only bridge and bearer-token authentication.
- Serialized commands and `POST /reset` to start a fresh conversation.
- Shared-n8n and bundled-n8n deployment modes.

## Planned
- **Slash commands**: `/status`, `/reset` (the bridge endpoint exists; add a Telegram command), `/cancel`.
- **Long output**: split replies into chunks of at most 4096 characters (Telegram's `sendMessage` limit), at most one message per second per chat.
- **Error workflow**: report failed executions to the admin chat.
- **Live streaming**: update the Telegram message while Claude works.
- **File attachments**: save uploads locally and ask Claude to analyze them.

## Future (v2.0)
- Separate Claude sessions per user.
- MCP integration through n8n instead of wrapping the CLI.
