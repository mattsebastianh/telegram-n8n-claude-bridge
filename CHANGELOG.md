# Changelog

Versions follow [Semantic Versioning](https://semver.org/) and are marked with git tags (`vMAJOR.MINOR.PATCH`).

## [1.2.0] - 2026-09-30
### Security
- Workflow and webhook ids are now derived from `BRIDGE_API_KEY` by `scripts/render-workflow.js` (n8n builds the Telegram webhook secret and URL from them, so fixed ids in the repo were guessable). Committed workflows carry a marker id and must be rendered before import; `--bundled` renders the Mode B workflow.
- The bridge and the render script refuse placeholder or short (<24 characters) `BRIDGE_API_KEY` values.
- `BRIDGE_ALLOWED_TOOLS` defaults to `Read,Glob,Grep,Edit,Write` (no `Bash`).
- Compose publishes n8n on `127.0.0.1` only. `setup.sh` sets `.env` to mode 600.

### Added
- MIT `LICENSE`.

### Changed
- **The bridge now runs Claude headless (`claude -p`) instead of driving an interactive terminal.** Each message resumes the same conversation and returns clean JSON text. This replaces the fragile prompt and screen detection, removes the `node-pty` dependency (no native build, no `spawn-helper` problem) and needs no folder-trust step.
- Claude may only use the tools in `BRIDGE_ALLOWED_TOOLS` (default `Read,Glob,Grep,Edit,Write,Bash`); the default was chosen to allow shell commands.
- Replies are asked to be concise and plain text; `BRIDGE_SYSTEM_PROMPT` overrides that.
- Calls are stopped after `BRIDGE_TIMEOUT_MS` (default 5 minutes). Failures return `502` with the error.

### Added
- `scripts/render-workflow.js` and `telegram_claude_bridge.template.json`: fills the HTTP Request node (URL, `Authorization` header) and the allowlist from `.env`; `--credential` keeps the key out of the file. Output is git-ignored and mode 600. Replaces the hand-edited `shared` workflow.
- `BRIDGE_CWD`: required dedicated working folder for Claude (home directory and `/` are refused).
- `BRIDGE_ALLOWED_TOOLS`, `BRIDGE_TIMEOUT_MS` and `BRIDGE_SYSTEM_PROMPT` settings.
- Conversation id kept in `bridge/claude-session/.session` (mode 600, git-ignored); `POST /reset` starts a new conversation.

### Removed
- `node-pty`, its postinstall fix and `allowScripts`.

## [1.1.0] - 2026-09-30
### Added
- Shared-n8n workflow (`telegram_claude_bridge.shared.json`, replaced in Unreleased by the rendered template): Header Auth credential, allowlist in the node, no environment variables needed.
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
