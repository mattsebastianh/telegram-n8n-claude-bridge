# Telegram ↔ n8n ↔ Claude Code

![Version](https://img.shields.io/badge/version-1.1.0-blue)
![Node.js](https://img.shields.io/badge/node-%E2%89%A518-339933?logo=nodedotjs&logoColor=white)
![Platform](https://img.shields.io/badge/platform-macOS-000000?logo=apple&logoColor=white)
![n8n](https://img.shields.io/badge/orchestration-n8n-EA4B71?logo=n8n&logoColor=white)
![Docker](https://img.shields.io/badge/docker-compose-2496ED?logo=docker&logoColor=white)
![Telegram](https://img.shields.io/badge/interface-Telegram_Bot-26A5E4?logo=telegram&logoColor=white)
![Cloudflare Tunnel](https://img.shields.io/badge/tunnel-Cloudflare-F38020?logo=cloudflare&logoColor=white)
![Claude Code](https://img.shields.io/badge/runs-Claude_Code-D97757)

Control [Claude Code](https://claude.com/claude-code) on your Mac from Telegram. Messages sent to a Telegram bot are validated by n8n, forwarded to a local bridge, and typed into a persistent `claude` CLI session. Claude's output is sent back to the same chat.

![Architecture](docs/architecture.svg)

> **Warning:** anyone who controls the allowlisted Telegram account controls a Claude Code session on your Mac, with your user's permissions. Keep the bot token and `.env` private, and read [docs/security.md](docs/security.md) before deploying.

## How it works

| Layer | What it is | Where it runs |
|-------|------------|---------------|
| Interface | Telegram Bot API | Telegram |
| Ingress | Cloudflare Tunnel (`cloudflared`, optional) gives Telegram a public HTTPS webhook | Docker container |
| Orchestration | n8n workflow (`n8n/workflows/`) | Your existing n8n, or the bundled container on host port `5680` (`N8N_HOST_PORT`) |
| Execution | Express + `node-pty` bridge (`bridge/claude-session`) driving `claude` in a `zsh -l` PTY | Mac host, `127.0.0.1:3000` |

Both workflow files have the same four nodes: **Telegram Trigger → Verify Allowlist → Send to Claude → Send Response**.

## Quick start

The bridge always runs on the Mac:

```bash
./setup.sh                              # creates .env, installs bridge dependencies
# edit .env: set BRIDGE_API_KEY (openssl rand -hex 32) and TELEGRAM_ALLOWED_USER_IDS
cd bridge/claude-session && npm start   # the bridge, on 127.0.0.1:3000
```

Then pick how to run n8n:

- **Mode A, use your existing n8n (recommended if you already have one):** import `n8n/workflows/telegram_claude_bridge.shared.json`, add a Telegram credential and a Header Auth credential holding the bridge key. No changes to your n8n container.
- **Mode B, bundled n8n:** `docker-compose up -d` (add `--profile tunnel` for the Cloudflare Tunnel), then import `n8n/workflows/telegram_claude_bridge.json`.

Step by step, with commands: [docs/deployment.md](docs/deployment.md).

## Configuration (`.env`)

| Variable | Purpose |
|----------|---------|
| `TELEGRAM_ALLOWED_USER_IDS` | Comma-separated Telegram user IDs allowed to send commands (Mode B reads it from n8n's env; Mode A writes it into the workflow) |
| `BRIDGE_API_KEY` | Shared secret, sent by n8n as `Authorization: Bearer <key>` (Mode A stores it in a Header Auth credential) |
| `BRIDGE_PORT` | Bridge port (default `3000`) |
| `BRIDGE_ALLOWED_IPS` | Optional extra source IPs the bridge accepts (localhost is always allowed) |
| `CLAUDE_CMD` | Optional command to launch instead of `claude` |
| `BRIDGE_DEBUG` | Set to `1` to echo raw Claude output in the bridge terminal |
| `WEBHOOK_URL` | Mode B only: public HTTPS hostname of your Cloudflare Tunnel (placeholder in `.env.example`) |
| `CLOUDFLARE_TUNNEL_TOKEN` | Mode B only: Cloudflare Tunnel token (placeholder in `.env.example`) |
| `N8N_HOST_PORT` | Mode B only: host port for the bundled n8n UI (default `5680`) |
| `GENERIC_TIMEZONE` | n8n timezone |

The Telegram bot token is stored in n8n's credential manager, never in `.env`.

## Project layout

```
bridge/claude-session/   Express + node-pty bridge (server.js)
n8n/workflows/           Importable workflows (bundled and shared-n8n variants)
n8n/credentials/         Credential setup notes (no secrets)
docs/                    Documentation
CHANGELOG.md             Release history
docker-compose.yml       Optional bundled n8n + Cloudflare Tunnel (Mode B)
setup.sh                 First-time setup
```

## Documentation

| Doc | Contents |
|-----|----------|
| [Architecture](docs/architecture.md) | Components, diagrams, request flow |
| [Deployment](docs/deployment.md) | Prerequisites and step-by-step setup |
| [Dependencies](docs/dependencies.md) | npm packages, host tools, images and services |
| [Workflows](docs/workflows.md) | The n8n workflow, node by node |
| [Security](docs/security.md) | Threat model and controls |
| [Testing](docs/testing.md) | Bridge, workflow and end-to-end checks |
| [Troubleshooting](docs/troubleshooting.md) | Common failures and fixes |
| [Roadmap](docs/roadmap.md) | Implemented and planned features |
| [Changelog](CHANGELOG.md) | Release history (versions are git tags) |
