# Credential Management

> **Important**: Never store API keys or Telegram bot tokens in workflow files or git repositories.

## Telegram API (both modes)
1. In n8n, open **Credentials > Add credential** and choose **Telegram API**.
2. Enter the bot token from [@BotFather](https://t.me/BotFather) and name it (for example "Telegram Bot Creds").
3. After importing the workflow, select it on the **Telegram Trigger** and **Send Response** nodes.

## Bridge API key

### Mode A: existing n8n (`telegram_claude_bridge.shared.json`)
1. Create a **Header Auth** credential named `Claude Bridge API Key`.
2. **Name**: `Authorization`. **Value**: `Bearer <BRIDGE_API_KEY>` (the key from `.env`).
3. Select it on the **Send to Claude** node.

The key lives only in n8n's encrypted credential store. No environment variables are needed, so other workflows on the same instance can't read it through `$env`.

### Mode B: bundled n8n (`telegram_claude_bridge.json`)
The key is read from `$env.BRIDGE_API_KEY`, which `docker-compose.yml` passes in from `.env`. Do not hardcode it in the HTTP Request node.
