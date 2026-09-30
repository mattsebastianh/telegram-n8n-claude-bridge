# Deployment

There are two ways to run the n8n side. The bridge and Claude Code always run natively on the Mac.

| | Mode A: existing n8n (recommended if you already run n8n) | Mode B: bundled n8n |
|---|---|---|
| n8n | Your own container or install | `docker-compose.yml` in this repo |
| Workflow file | `telegram_claude_bridge.shared.json` | `telegram_claude_bridge.json` |
| Bridge key | n8n **Header Auth** credential | `$env.BRIDGE_API_KEY` |
| Allowlist | Written in the workflow's **Verify Allowlist** node | `$env.TELEGRAM_ALLOWED_USER_IDS` |
| Changes to n8n | None (no restart, no env vars) | New instance, own data |
| Public URL | Whatever your n8n already uses | `WEBHOOK_URL` + optional Cloudflare Tunnel |

## Prerequisites (both modes)
- macOS with Docker Desktop (provides `host.docker.internal`).
- Node.js 18+ on the host (`node-pty` is a native module; see [dependencies.md](dependencies.md)).
- Claude Code CLI installed and logged in: `npm install -g @anthropic-ai/claude-code`, then run `claude` once.
- A Telegram bot token from [@BotFather](https://t.me/BotFather) and your own Telegram user ID.
- Use a dedicated bot. A bot can have only one webhook, so activating this workflow on a bot that another workflow already uses would replace that webhook.

## Start the bridge (both modes)
1. Run `./setup.sh` (or `cp .env.example .env` and `npm ci` in `bridge/claude-session`).
2. Set `BRIDGE_API_KEY` in `.env` (`openssl rand -hex 32`).
3. `cd bridge/claude-session && npm start`. For persistence use `pm2 start server.js --name claude-bridge`.

## Mode A: use your existing n8n
Nothing in your n8n container has to change. The workflow reaches the bridge at `http://host.docker.internal:3000`, which a container on Docker Desktop resolves to your Mac. This was verified on 2026-09-30 from an n8n 2.20.11 container: the bridge accepted the request from localhost.

1. **Create the workflow file** with your Telegram user ID (local files ending in `.local.json` are git-ignored):
   ```bash
   sed "s/REPLACE_WITH_TELEGRAM_USER_ID/$(grep '^TELEGRAM_ALLOWED_USER_IDS=' .env | cut -d= -f2 | sed "s/,/','/g")/" \
     n8n/workflows/telegram_claude_bridge.shared.json \
     > n8n/workflows/telegram_claude_bridge.shared.local.json
   ```
   Or import the template and replace `REPLACE_WITH_TELEGRAM_USER_ID` in the **Verify Allowlist** node by hand.
2. **Import it**: in n8n, **Workflows > ⋯ > Import from file**. From the command line: `docker cp n8n/workflows/telegram_claude_bridge.shared.local.json n8n:/tmp/w.json && docker exec n8n n8n import:workflow --input=/tmp/w.json` (use your container's name).
3. **Create two credentials** in n8n (see [n8n/credentials/README.md](../n8n/credentials/README.md)):
   - **Telegram API** with the bot token. Select it on **Telegram Trigger** and **Send Response**.
   - **Header Auth** named `Claude Bridge API Key`: header `Authorization`, value `Bearer <BRIDGE_API_KEY>`. Select it on **Send to Claude**.
4. **Activate the workflow.** n8n registers the webhook with Telegram using your instance's `WEBHOOK_URL`, which must be a public HTTPS address. Check with `https://api.telegram.org/bot<TOKEN>/getWebhookInfo`.
5. **Verify** with [testing.md](testing.md).

## Mode B: bundled n8n
1. In `.env`, set `TELEGRAM_ALLOWED_USER_IDS`, `BRIDGE_API_KEY`, and optionally `N8N_HOST_PORT` (default `5680`; check that it is free with `lsof -nP -iTCP -sTCP:LISTEN`).
2. Start it from the project root: `docker-compose up -d`, or `docker-compose --profile tunnel up -d` to also start the Cloudflare Tunnel (see below). The UI is at `http://localhost:5680`.
3. Create a **Telegram API** credential, import `n8n/workflows/telegram_claude_bridge.json`, select the credential on the Trigger and Send Response nodes, and activate it.
4. Verify with [testing.md](testing.md).

`docker-compose.yml` passes only `BRIDGE_API_KEY` and `TELEGRAM_ALLOWED_USER_IDS` from `.env` into the n8n container and sets `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`, so the workflow can read them through `$env`. The Cloudflare token is not passed to n8n. After changing `.env`, run `docker-compose up -d --force-recreate`.

### Webhooks with a Cloudflare Tunnel (Mode B)
Telegram only delivers webhooks to a public HTTPS URL on port 443, 80, 88 or 8443.

1. In Cloudflare Zero Trust, go to **Networks > Tunnels**, create a tunnel and copy its token.
2. Add a public hostname for the tunnel with the service `http://n8n:5678`.
3. In `.env`, replace the placeholders:
   - `WEBHOOK_URL=https://<your-tunnel-hostname>/` (keep the trailing slash)
   - `CLOUDFLARE_TUNNEL_TOKEN=<your tunnel token>`
4. Start with `docker-compose --profile tunnel up -d --force-recreate`.
5. Activate the workflow and check with `getWebhookInfo`.

Only the webhook path needs to be public. Consider protecting the n8n editor with Cloudflare Access. See [security.md](security.md#5-network-exposure).
