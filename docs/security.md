# Security Model

This system gives a Telegram chat remote code execution on your machine. Treat the bot token, chat allowlist and `BRIDGE_API_KEY` as credentials.

## 1. Telegram authorization (implemented)
- The **Verify Allowlist** node requires both `message.chat.id` and `message.from.id` to appear in `TELEGRAM_ALLOWED_USER_IDS` (comma-separated).
- Non-matching messages are dropped with no reply. Nothing is logged beyond n8n's normal execution history.

## 2. Bridge authentication (implemented)
- The bridge listens only on `127.0.0.1` and rejects other source IPs with 403. Docker Desktop's `host.docker.internal` traffic arrives as localhost, so n8n works without loosening this. If your setup shows 403s, add the source IP to `BRIDGE_ALLOWED_IPS`.
- Every request needs `Authorization: Bearer <BRIDGE_API_KEY>`, compared in constant time; otherwise it returns 401. The bridge refuses to start without the key.
- Request bodies are parsed only after authentication, and malformed JSON returns a plain 400.
- Commands are serialized, limited to 8000 characters, and newlines are flattened so one message can't submit several prompts.
- `claude` is the PTY process itself. If it exits, the bridge restarts it and returns 503 until it is ready, so commands never fall through to a bare shell.

## 3. Privilege
- Run the bridge as your normal user, never root. `claude` inherits that user's permissions and starts in `$HOME`.
- The session is persistent and shared: whatever one command changes (directory, state) carries over to the next.
- The bridge does not log Claude's output unless `BRIDGE_DEBUG=1`.
- Keep `.env` at mode 600 (`chmod 600 .env`).

## 4. Secrets
- **Existing (shared) n8n:** use the `shared` workflow. It keeps the bridge key in an n8n Header Auth credential and does not need `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`. Enabling env access would let every workflow on that instance read all container variables, including the encryption key and database password.
- The Telegram bot token lives in n8n's credential manager.
- `BRIDGE_API_KEY` and the allowlist live in `.env` (do not commit it) and are read by n8n through environment variables. Never hardcode them in workflow exports.

## 5. Network exposure
- Bundled n8n is published through a Cloudflare Tunnel (`docker-compose --profile tunnel`), so no router ports are opened. An existing n8n keeps whatever public URL it already has. Telegram delivers webhooks over HTTPS to `WEBHOOK_URL`.
- Keep the n8n editor private: restrict it with Cloudflare Access, or only publish the `/webhook/` paths.
- Treat `CLOUDFLARE_TUNNEL_TOKEN` as a secret. It stays in `.env` and is only given to the `cloudflared` container.
- Use a dedicated Telegram bot for this project. A bot has one webhook, so sharing it with another workflow would break one of them.
- The bridge stays bound to `127.0.0.1` and is never exposed through the tunnel.
