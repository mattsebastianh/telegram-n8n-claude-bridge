# Deployment

## Prerequisites
- macOS with Docker Desktop (provides `host.docker.internal`).
- Node.js 18+ installed directly on the host (`node-pty` is a native module; see [dependencies.md](dependencies.md)).
- Claude Code CLI installed and logged in: `npm install -g @anthropic-ai/claude-code`, then run `claude` once.
- A Telegram bot token from [@BotFather](https://t.me/BotFather) and your own chat ID.

## Steps
1. **Configure**: run `./setup.sh` (or `cp .env.example .env` and `npm install` in `bridge/claude-session`). Set `TELEGRAM_ALLOWED_USER_IDS` and a strong `BRIDGE_API_KEY` (`openssl rand -hex 32`).
2. **Start the bridge**: `cd bridge/claude-session && npm start`. For persistence use `pm2 start server.js --name claude-bridge`.
3. **Start n8n**: from the project root run `docker-compose up -d`, or `docker-compose --profile tunnel up -d` to also start the Cloudflare Tunnel (set it up first, see [Webhooks](#webhooks-with-a-cloudflare-tunnel)). The UI is at `http://localhost:5555`.
4. **Add credentials**: in n8n, create a **Telegram API** credential with your bot token (see [n8n/credentials/README.md](../n8n/credentials/README.md)).
5. **Import the workflow**: import `n8n/workflows/telegram_claude_bridge.json`, select the Telegram credential on the Trigger and Send Response nodes, and activate it.
6. **Verify**: follow [testing.md](testing.md).

## Environment variables in n8n
`docker-compose.yml` passes only `BRIDGE_API_KEY` and `TELEGRAM_ALLOWED_USER_IDS` from `.env` into the n8n container and sets `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`, so the workflow can read them through `$env`. The Cloudflare token is not passed to n8n. After changing `.env`, run `docker-compose up -d --force-recreate`.

## Webhooks with a Cloudflare Tunnel
Telegram only delivers webhooks to a public HTTPS URL on port 443, 80, 88 or 8443, so n8n is published through a Cloudflare Tunnel.

1. In Cloudflare Zero Trust, go to **Networks > Tunnels**, create a tunnel and copy its token.
2. Add a public hostname for the tunnel with the service `http://n8n:5678`.
3. In `.env`, replace the placeholders:
   - `WEBHOOK_URL=https://<your-tunnel-hostname>/` (keep the trailing slash)
   - `CLOUDFLARE_TUNNEL_TOKEN=<your tunnel token>`
4. Start n8n and the tunnel: `docker-compose --profile tunnel up -d --force-recreate`.
5. Activate the workflow in n8n. n8n registers the webhook with Telegram at that URL.
6. Check with `https://api.telegram.org/bot<TOKEN>/getWebhookInfo`.

Only the webhook path needs to be public. Consider protecting the n8n editor with Cloudflare Access. See [security.md](security.md#5-network-exposure).
