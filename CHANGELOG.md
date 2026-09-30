# Changelog

Versions follow [Semantic Versioning](https://semver.org/) and are marked with git tags (`vMAJOR.MINOR.PATCH`).

## [Unreleased]
### Added
- Shared-n8n workflow (`telegram_claude_bridge.shared.json`): Header Auth credential, allowlist in the node, no environment variables needed.
- Deployment modes: use an existing n8n (Mode A) or the bundled compose stack (Mode B).
- `*.local.json` workflow copies are git-ignored.

### Changed
- n8n host port moved to `5680` (`N8N_HOST_PORT`) and the compose project is named `telegram-n8n-handler`.
- Workflow files now have a top-level `id` so `n8n import:workflow` works.

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
