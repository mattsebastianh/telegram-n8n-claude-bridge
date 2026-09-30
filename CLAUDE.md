# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Telegram bot → n8n workflow → local Node bridge → Claude Code (`claude -p`) → reply to the same Telegram chat. The README and `docs/` cover usage; this file covers what isn't obvious from reading one file.

There is no build step, linter or test suite. Verification is done by running the bridge and calling it (see below).

## Commands

```bash
# Bridge (always runs natively on the Mac, never in Docker)
cd bridge/claude-session && npm ci && npm start     # listens on 127.0.0.1:${BRIDGE_PORT:-3000}
node --check bridge/claude-session/server.js        # syntax check

# Talk to a running bridge (key comes from .env)
set -a; . ./.env; set +a
curl -s http://127.0.0.1:3000/status -H "Authorization: Bearer $BRIDGE_API_KEY"

# Mode A: fill the workflow template from .env, then import into an existing n8n
node scripts/render-workflow.js                     # or --credential to keep the key out; --bundled renders the Mode B workflow
cat n8n/workflows/telegram_claude_bridge.local.json | docker exec -i <n8n-container> n8n import:workflow --input=/dev/stdin

# Mode B: bundled n8n (+ optional Cloudflare tunnel)
docker-compose up -d                                # add --profile tunnel for cloudflared
docker compose --profile tunnel config              # validate compose + .env interpolation
```

To exercise the bridge without spending Claude usage, point `CLAUDE_CMD` at a stub script that reads stdin and prints `{"result":"...","session_id":"x"}` (and run on a spare `BRIDGE_PORT` with a throwaway `BRIDGE_API_KEY`). Don't use `wait` without explicit PIDs when backgrounding the server in a shell command; it also waits for the server and hangs.

Validate workflow JSON by importing it into a throwaway container: `docker run --rm --entrypoint sh -v "$PWD/n8n/workflows:/w:ro" n8nio/n8n:2.20.11 -c 'n8n import:workflow --input=/w/<file>'`.

## Architecture

**Two deployment modes share one bridge.** The bridge and Claude always run on the host because Claude must see real files, login and `PATH`. n8n is either the user's existing instance (Mode A) or the optional compose stack (Mode B). n8n reaches the bridge via `host.docker.internal`; Docker Desktop delivers that as localhost, so the bridge's localhost-only check works unchanged (`BRIDGE_ALLOWED_IPS` exists only as an escape hatch).

**Bridge (`bridge/claude-session/server.js`, the only runtime code).** Each `POST /execute` runs `claude -p --output-format json` through `/bin/zsh -l -c 'exec "$0" "$@"'` (for the user's `PATH`), with `cwd=BRIDGE_CWD` and the prompt on **stdin** (never argv, so it can't be parsed as a flag). Requests are serialized through a promise queue because all messages share one conversation. Continuity is the `session_id` from Claude's JSON, persisted in `bridge/claude-session/.session` and passed back with `--resume`; it only falls back to a fresh conversation when stderr says the session no longer exists. Order matters: IP check → key check (`timingSafeEqual`) → `express.json` → routes, so unauthenticated bodies are never parsed. `CLAUDE_CODE_*` env vars are stripped before spawning. `BRIDGE_CWD` is mandatory and rejected if it is the home directory or `/`. `BRIDGE_API_KEY` must be ≥24 chars and not a placeholder (the bridge and the render script both refuse). `BRIDGE_ALLOWED_TOOLS` (default is read/edit only; the maintainer's own `.env` adds `Bash`) is the real permission boundary, since headless mode has nobody to approve tool use.

The bridge used to drive an interactive Claude through `node-pty` and scrape the screen. That was removed on purpose (the TUI redraws; prompt detection was unfixable). Don't reintroduce a terminal-scraping approach.

**Workflows (`n8n/workflows/`).** Four nodes in both variants: Telegram Trigger → Verify Allowlist (IF, checks `chat.id` **and** `from.id`) → Send to Claude (HTTP) → Send Response. The false branch is intentionally unconnected (silent drop).
- `telegram_claude_bridge.json`: Mode B, reads `$env.BRIDGE_API_KEY`, `$env.TELEGRAM_ALLOWED_USER_IDS`, `$env.BRIDGE_API_URL`; needs `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` (set in compose, which passes only those two secrets, never the tunnel token).
- `telegram_claude_bridge.template.json`: Mode A source of truth, with `__BRIDGE_API_URL__`, `__BRIDGE_API_KEY__`, `__ALLOWED_USER_IDS__` placeholders. `scripts/render-workflow.js` substitutes them inside the *parsed* JSON and fails if any placeholder remains. Don't hand-edit the rendered `*.local.json`; change the template or `.env` and re-render.

Gotchas that cost time before:
- Every workflow JSON needs a top-level `id`, or `n8n import:workflow` fails with `NOT NULL constraint failed: workflow_entity.id` (the UI import hides this). Never commit real ids: n8n's Telegram Trigger secret is `<workflow id>_<node id>` and its URL contains `webhookId`, so ids in the repo would be public. `scripts/render-workflow.js` derives them from `BRIDGE_API_KEY` (HMAC), which keeps them private and stable; committed files carry a `RENDER_WITH_SCRIPT_BEFORE_IMPORT` marker. Re-importing a rendered file *replaces* the previous copy and drops its Telegram credential selections. Templates carry no credentials by design.
- In an n8n Header Auth credential, the form field **Name** must be `Authorization`; putting the credential's title there gives `Header name must be a valid HTTP token`.
- The n8n image entrypoint is `n8n`, so use `--entrypoint sh` for shell commands in `docker run`.
- A Telegram bot has one webhook; activating this workflow on a bot another workflow uses silently takes it over.
- The rendered `*.local.json` contains the bridge key (default mode) and user IDs: it is mode 600 and git-ignored. Keep it that way.

**Compose (`docker-compose.yml`).** Optional. Project is named `telegram-n8n-handler`; n8n publishes `127.0.0.1:${N8N_HOST_PORT:-5680}` (loopback only) (5555 is commonly taken by other local n8n containers); `cloudflared` is behind the `tunnel` profile and its token is deliberately not passed to n8n. Images are currently unpinned.

## Conventions in this repo

- Docs are kept in sync with code: when changing a bridge env var, endpoint or workflow variant, update `README.md` (config table), the relevant file in `docs/`, `.env.example` and the `Unreleased` section of `CHANGELOG.md`. `docs/architecture.svg` is hand-written SVG; validate it with the `architecture-flowchart-svg` skill's `check_svg.py` and view a rendered PNG before trusting it.
- Git: commit new changes; don't amend unless asked. Releases are annotated tags `vX.Y.Z` on a commit that also bumps the `CHANGELOG.md` heading, the README version badge and `bridge/claude-session/package.json`/lock version.
- `.env` holds live secrets and is ignored. Before committing, check that neither `BRIDGE_API_KEY` nor the allowed Telegram IDs appear in staged files.
