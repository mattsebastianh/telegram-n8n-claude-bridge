# Troubleshooting

## 1. n8n cannot reach the bridge
**Symptom**: the Send to Claude node fails with `ECONNREFUSED`, `401`, `403` or `503`.
- `ECONNREFUSED`: the bridge isn't running. Start it with `npm start` in `bridge/claude-session`, and check `BRIDGE_API_URL` is `http://host.docker.internal:3000`.
- `401 Unauthorized`: `BRIDGE_API_KEY` differs between the bridge and the n8n container. The container gets the key from `.env` at creation time; recreate it after editing (`docker-compose up -d --force-recreate`).
- `403 Forbidden`: the request came from an address that isn't localhost. Add that IP to `BRIDGE_ALLOWED_IPS` in `.env` and restart the bridge.
- `502` with an `error` message: `claude` failed to run. Try it by hand in `BRIDGE_CWD` (`claude -p "hello"`), and check it is installed, on the login shell's `PATH` (`zsh -l -c 'which claude'`) and logged in.

## 2. Telegram bot not responding
- Look at **Executions** in n8n to see whether the workflow fired.
- The trigger uses webhooks, so `WEBHOOK_URL` must be a public HTTPS URL registered with Telegram. Check with `https://api.telegram.org/bot<TOKEN>/getWebhookInfo`.
- Confirm the workflow is activated.
- With the Cloudflare Tunnel, check that the `cloudflared` container is running (`docker-compose --profile tunnel ps`), that the tunnel's public hostname points to `http://n8n:5678`, and that `WEBHOOK_URL` matches that hostname. Recreate n8n after changing it.

## 3. No reply from an allowed chat
- Check that your Telegram user ID is listed in `TELEGRAM_ALLOWED_USER_IDS` and that variable reaches the n8n container.
- Non-allowed chats are dropped silently by design.

## 4. Reply says "Not logged in" or "Please run /login"
- Claude Code isn't authenticated. Run `claude` in a terminal on the Mac and log in. No bridge restart is needed.

## 5. Replies are slow, cut off, or time out
- Each message starts a `claude -p` process, so replies take several seconds even for short answers.
- After `BRIDGE_TIMEOUT_MS` (default 300000) the bridge stops Claude and returns a timeout note. Raise it for long tasks.
- Telegram limits message text to 4096 characters, so longer replies fail to send. The bridge asks Claude for short replies, but splitting is not implemented yet.

## 6. Claude forgot the conversation, or remembers too much
- Conversations continue through the session id in `bridge/claude-session/.session`. Call `POST /reset` (or delete that file) to start fresh.
- If Claude lost its context unexpectedly, the stored session may have expired; the bridge starts a new one automatically.

## 7. Bridge will not start
- `BRIDGE_CWD ...`: set it in `.env` to an existing folder that is not your home directory.
- `BRIDGE_API_KEY is not set`: set it in `.env`.
- After upgrading from an older version, run `npm ci` in `bridge/claude-session`; the `node-pty` dependency is gone.

## 8. Existing n8n: credential or webhook problems
- **`Header name must be a valid HTTP token ["Claude Bridge API Key"]`**: the Header Auth **Name** field holds the credential title. Set **Name** to `Authorization` and **Value** to `Bearer <BRIDGE_API_KEY>`.
- **"Credential not found" on Send to Claude**: create the Header Auth credential (`Authorization: Bearer <key>`) and select it on the node. The imported file has an empty credential reference on purpose.
- **Another workflow stopped getting Telegram updates**: the bot is shared. A bot has one webhook and activating this workflow replaced it. Use a dedicated bot.
- **Workflow never triggers**: your n8n's `WEBHOOK_URL` must be public HTTPS. Check `getWebhookInfo`.
- **`host.docker.internal` does not resolve** (Linux or non-Docker-Desktop): add `extra_hosts: ["host.docker.internal:host-gateway"]` to that n8n container, and add the gateway IP to `BRIDGE_ALLOWED_IPS` if the bridge answers 403.
- **`n8n import:workflow` fails with `workflow_entity.id`**: the file has no top-level `id`. The files in this repo include one.
