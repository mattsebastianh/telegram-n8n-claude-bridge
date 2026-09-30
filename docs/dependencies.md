# Dependencies

Catalog of everything the project needs. Versions were checked on 2026-09-30 on macOS (Apple silicon or Intel).

## 1. Bridge (npm)
Defined in `bridge/claude-session/package.json` (`engines.node` is `>=18`), pinned by `package-lock.json`. All dependencies are on their latest stable releases, with no dev dependencies.

| Package | Declared | Locked | Purpose |
|---------|----------|--------|---------|
| `express` | `^5.2.1` | 5.2.1 | HTTP API: `/execute`, `/reset`, `/status` |
| `node-pty` | `^1.1.0` | 1.1.0 | Runs `claude` inside a pseudo-terminal |
| `dotenv` | `^18.0.5` | 18.0.5 | Loads `.env` from the project root (`quiet: true` silences its startup message) |

Notes:
- `node-pty` has a 1.2.0 beta, which is not used. Only stable releases are declared.
- `node-pty` is a native module. `npm ci` uses its bundled prebuilt binaries for macOS (`darwin-arm64`, `darwin-x64`) and falls back to `node-gyp rebuild` (Xcode command-line tools and Python) if none match.
- **Postinstall fix:** `node-pty` 1.1.0 ships its macOS `spawn-helper` without the execute bit, which makes `pty.spawn()` fail with `posix_spawnp failed`. `scripts/postinstall.js` sets the permission after every install. Do not install with `--ignore-scripts`.
- `allowScripts` in `package.json` approves `node-pty`'s own install script for npm 11. It is tied to version 1.1.0, so re-approve after upgrading it (`npm install-scripts approve node-pty`).
- Install with `npm ci` for reproducible versions, or `./setup.sh`.

## 2. Host tools
Needed on the Mac, outside npm.

| Tool | Version checked | Why |
|------|-----------------|-----|
| Node.js | 24.21.0 (`>=18` required by `engines` and by Express 5; not tested on 18) | Runs the bridge |
| npm | 11.19.0 | Installs the bridge dependencies |
| Claude Code CLI | 2.1.285 | The session the bridge drives; must be logged in |
| zsh | 5.9 | The bridge launches `claude` through `/bin/zsh -l` |
| Docker Desktop | Docker 29.8.1 | Runs n8n and the tunnel; provides `host.docker.internal` |

## 3. Container images
Defined in `docker-compose.yml`.

| Image | Tag in compose | Version seen | Notes |
|-------|----------------|--------------|-------|
| `docker.n8n.io/n8nio/n8n` | none (`latest`) | 2.20.11 | Runs the workflow; needs `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` to read `$env` |
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
ls -l node_modules/node-pty/prebuilds/*/spawn-helper   # must be executable (-rwxr-xr-x)
```
After updating, run the checks in [testing.md](testing.md), update the versions in this file, and add an entry to [CHANGELOG.md](../CHANGELOG.md).
