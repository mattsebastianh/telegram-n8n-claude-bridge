# Troubleshooting

## 1. n8n cannot reach the bridge
**Symptom**: the Send to Claude node fails with `ECONNREFUSED`, `401`, `403` or `503`.
- `ECONNREFUSED`: the bridge isn't running. Start it with `npm start` in `bridge/claude-session`, and check `BRIDGE_API_URL` is `http://host.docker.internal:3000`.
- `401 Unauthorized`: `BRIDGE_API_KEY` differs between the bridge and the n8n container. The container gets the key from `.env` at creation time; recreate it after editing (`docker-compose up -d --force-recreate`).
- `403 Forbidden`: the request came from an address that isn't localhost. Add that IP to `BRIDGE_ALLOWED_IPS` in `.env` and restart the bridge.
- `503 Claude session is not ready`: Claude is still starting or restarting. Wait a few seconds, or check that `claude` runs and is logged in. `POST /reset` restarts the session.

## 2. Telegram bot not responding
- Look at **Executions** in n8n to see whether the workflow fired.
- The trigger uses webhooks, so `WEBHOOK_URL` must be a public HTTPS URL registered with Telegram. Check with `https://api.telegram.org/bot<TOKEN>/getWebhookInfo`.
- Confirm the workflow is activated.
- With the Cloudflare Tunnel, check that the `cloudflared` container is running (`docker-compose --profile tunnel ps`), that the tunnel's public hostname points to `http://n8n:5678`, and that `WEBHOOK_URL` matches that hostname. Recreate n8n after changing it.

## 3. No reply from an allowed chat
- Check that your Telegram user ID is listed in `TELEGRAM_ALLOWED_USER_IDS` and that variable reaches the n8n container.
- Non-allowed chats are dropped silently by design.

## 4. Reply says "Not logged in" or "Please run /login"
- Claude Code isn't authenticated. Run `claude` in a terminal on the Mac and log in, then restart the bridge.

## 5. Output is cut off or times out
- The bridge waits up to 2 minutes for Claude's `❯` prompt, then returns partial output with a timeout note.
- Telegram limits message text to 4096 characters, so longer replies fail to send. Splitting is not implemented yet.

## 6. Garbled output
- The bridge strips ANSI escape codes with a regex in `server.js` (`stripAnsi`). Some sequences may slip through; extend the regex there.
- The bridge logs raw PTY output to its own terminal, which helps when debugging.

## 7. Bridge crashes with `posix_spawnp failed`
- `node-pty`'s `spawn-helper` lost its execute bit, usually because dependencies were installed with `--ignore-scripts`. Run `npm run postinstall` (or `npm ci`) in `bridge/claude-session`, or `chmod +x node_modules/node-pty/prebuilds/*/spawn-helper`.
- Also check that `claude` is installed and on the login shell's `PATH` (`zsh -l -c 'which claude'`).

## 8. Existing n8n: credential or webhook problems
- **"Credential not found" on Send to Claude**: create the Header Auth credential (`Authorization: Bearer <key>`) and select it on the node. The imported file has an empty credential reference on purpose.
- **Another workflow stopped getting Telegram updates**: the bot is shared. A bot has one webhook and activating this workflow replaced it. Use a dedicated bot.
- **Workflow never triggers**: your n8n's `WEBHOOK_URL` must be public HTTPS. Check `getWebhookInfo`.
- **`host.docker.internal` does not resolve** (Linux or non-Docker-Desktop): add `extra_hosts: ["host.docker.internal:host-gateway"]` to that n8n container, and add the gateway IP to `BRIDGE_ALLOWED_IPS` if the bridge answers 403.
- **`n8n import:workflow` fails with `workflow_entity.id`**: the file has no top-level `id`. The files in this repo include one.
