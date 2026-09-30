# Dependencies

Catalog of everything the project needs. Versions were checked on 2026-09-30 on macOS (Apple silicon or Intel).

## 1. Bridge (npm)
Defined in `bridge/claude-session/package.json` (`engines.node` is `>=18`), pinned by `package-lock.json`. Both dependencies are on their latest stable releases, with no dev dependencies.

| Package | Declared | Locked | Purpose |
|---------|----------|--------|---------|
| `express` | `^5.2.1` | 5.2.1 | HTTP API: `/execute`, `/reset`, `/status` |
| `dotenv` | `^18.0.5` | 18.0.5 | Loads `.env` from the project root (`quiet: true` silences its startup message) |

Notes:
- There are no native modules, so a clean `npm ci` needs no compiler. (Earlier versions used `node-pty`, which was removed when the bridge moved to headless `claude -p`.)
- Install with `npm ci` for reproducible versions, or `./setup.sh`.

## 2. Host tools
Needed on the Mac, outside npm.

| Tool | Version checked | Why |
|------|-----------------|-----|
| Node.js | 24.21.0 (`>=18` required by `engines` and by Express 5; not tested on 18) | Runs the bridge |
| npm | 11.19.0 | Installs the bridge dependencies |
| Claude Code CLI | 2.1.285 | Run headless (`claude -p`) by the bridge; must be logged in |
| zsh | 5.9 | The bridge launches `claude` through `/bin/zsh -l` so it has your `PATH` |
| Docker Desktop | Docker 29.8.1 | Runs n8n and the tunnel; provides `host.docker.internal` |

## 3. Container images
Defined in `docker-compose.yml`.

| Image | Tag in compose | Version seen | Notes |
|-------|----------------|--------------|-------|
| `docker.n8n.io/n8nio/n8n` | none (`latest`) | 2.20.11 | Bundled mode only. The workflows import cleanly into 2.20.11. The bundled workflow needs `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` to read `$env`; the rendered template does not |
| `cloudflare/cloudflared` | `latest` | not pulled yet | Optional, profile `tunnel` |

Neither image is pinned, so a fresh pull can change behaviour. Pin both to a version tag before relying on the setup.

## 4. External services
- **Telegram Bot API** and a bot token from [@BotFather](https://t.me/BotFather), stored in n8n's credential manager.
- **Cloudflare account** with a Tunnel (Zero Trust), for a public HTTPS webhook. Optional but required for Telegram webhooks.
- **Anthropic account** logged in to Claude Code.

## 5. Updating
```bash
cd bridge/claude-session
npm outdated            # see available versions
npm audit               # check for known vulnerabilities
npm update              # stay within declared ranges
```
After updating, run the checks in [testing.md](testing.md), update the versions in this file, and add an entry to [CHANGELOG.md](../CHANGELOG.md).
