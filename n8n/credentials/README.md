# Credential Management

> **Important**: Never store API keys or Telegram bot tokens in workflow files or git repositories.

## Telegram API (both modes)
1. In n8n, open **Credentials > Add credential** and choose **Telegram API**.
2. Enter the bot token from [@BotFather](https://t.me/BotFather) and name it (for example "Telegram Bot Creds").
3. After importing the workflow, select it on the **Telegram Trigger** and **Send Response** nodes.

## Bridge API key

### Mode A: existing n8n (rendered from `telegram_claude_bridge.template.json`)
By default `node scripts/render-workflow.js` writes the key into the HTTP Request node, so no credential is needed for the bridge. The key is then stored in that n8n's database inside the workflow.

To keep it in n8n's encrypted credential store instead, render with `node scripts/render-workflow.js --credential` and:
1. Create a **Header Auth** credential. Give it the title `Claude Bridge API Key` (the title at the top of the dialog, just a label).
2. In the form, fill the two fields:
   - **Name**: `Authorization` (the HTTP header name, it must not contain spaces)
   - **Value**: `Bearer <BRIDGE_API_KEY>` (the word `Bearer`, one space, then the key from `.env`)
3. Select it on the **Send to Claude** node.

Do not put the credential title in the **Name** field: n8n would send a header called `Claude Bridge API Key` and fail with `Header name must be a valid HTTP token`.

### Mode B: bundled n8n (`telegram_claude_bridge.json`)
The key is read from `$env.BRIDGE_API_KEY`, which `docker-compose.yml` passes in from `.env`. Do not hardcode it in the HTTP Request node.
