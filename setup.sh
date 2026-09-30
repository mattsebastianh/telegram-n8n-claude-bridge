#!/bin/bash
set -e

echo "================================================="
echo " Setting up Telegram <-> n8n <-> Claude Bridge "
echo "================================================="

# Check requirements
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js (v18+)."
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker Desktop."
    exit 1
fi

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo "📄 Creating .env from .env.example..."
    cp .env.example .env
    echo "⚠️  Action Required: Please edit .env: set TELEGRAM_ALLOWED_USER_IDS and a strong BRIDGE_API_KEY (openssl rand -hex 32)."
else
    echo "✅ .env already exists."
fi

# Setup Bridge API
echo "📦 Installing Bridge API dependencies..."
cd bridge/claude-session
npm install
cd ../../

echo "================================================="
echo " Setup complete!"
echo " "
echo " 1. Start the local Bridge API:"
echo "    cd bridge/claude-session && npm start"
echo " 2. Connect n8n (see docs/deployment.md):"
echo "    Mode A, your existing n8n: node scripts/render-workflow.js, then import"
echo "      n8n/workflows/telegram_claude_bridge.local.json and add a Telegram credential."
echo "    Mode B, bundled n8n: docker-compose up -d (add --profile tunnel for Cloudflare),"
echo "      then import n8n/workflows/telegram_claude_bridge.json."
echo "================================================="
