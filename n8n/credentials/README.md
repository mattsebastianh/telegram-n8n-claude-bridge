# Credential Management

> **Important**: Never store hardcoded API keys or Telegram Bot tokens in workflow files or git repositories.

## Setup Instructions

1. Go to n8n's **Credentials** tab in the UI.
2. Click **Add Credential**.
3. Search for **Telegram API**.
4. Enter your Telegram Bot Token (obtained from [@BotFather](https://t.me/BotFather)).
5. Name it something descriptive (e.g., "Telegram Bot Creds").
6. When importing the `telegram_claude_bridge.json` workflow, select these credentials in the **Telegram Trigger** and **Telegram Send** nodes.

## Bridge Authentication
The Local Bridge API Key is injected dynamically using n8n environment variables (`$env.BRIDGE_API_KEY`) configured in the `docker-compose.yml` and `.env` file. Do not hardcode the key in the HTTP Request node.
