# Roadmap

## Implemented (v1.0)
- Telegram → n8n → bridge → Claude CLI → Telegram round trip.
- Persistent `claude` session in a `node-pty` shell.
- `chat.id` allowlist, localhost-only bridge and bearer-token authentication.
- ANSI stripping and prompt-based completion detection with a 2-minute timeout.
- Serialized commands, `claude` as the PTY process with auto-restart, and `POST /reset`.
- Multi-ID allowlist checking both `chat.id` and `from.id`.

## Planned (v1.1)
- **Slash commands**: `/status`, `/reset` (the bridge endpoint exists; add a Telegram command), `/cancel`.
- **Long output**: split replies into chunks of at most 4096 characters (Telegram's `sendMessage` limit), at most one message per second per chat.
- **Error workflow**: report failed executions to the admin chat.
- **Live streaming**: update the Telegram message while Claude works.
- **File attachments**: save uploads locally and ask Claude to analyze them.

## Future (v2.0)
- Separate Claude sessions per user.
- MCP integration through n8n instead of wrapping the CLI.
