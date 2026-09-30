# Changelog

Versions follow [Semantic Versioning](https://semver.org/) and are marked with git tags (`vMAJOR.MINOR.PATCH`).

## [1.0.0] - 2026-09-30
### Added
- Telegram → n8n → bridge → Claude Code CLI → Telegram round trip.
- Express + `node-pty` bridge with a persistent, auto-restarting `claude` session, serialized commands, and `POST /reset`.
- n8n workflow with a multi-ID allowlist checking `chat.id` and `from.id`.
- Bearer-token authentication (constant-time) and localhost-only access on the bridge.
- Optional Cloudflare Tunnel service (`docker-compose --profile tunnel`).
- Architecture diagram and documentation in `docs/`.

### Known limitations
- Replies over Telegram's 4096-character limit are not split.
- No slash commands or live streaming yet.
