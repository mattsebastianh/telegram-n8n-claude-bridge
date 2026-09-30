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
echo " To start the system:"
echo " 1. Run the local Bridge API:"
echo "    cd bridge/claude-session && npm start"
echo " 2. Set WEBHOOK_URL and CLOUDFLARE_TUNNEL_TOKEN in .env (see docs/deployment.md)"
echo " 3. In a new terminal, start n8n and the Cloudflare Tunnel:"
echo "    docker-compose --profile tunnel up -d"
echo " "
echo " Then open n8n at http://localhost:5555,"
echo " import the workflow and set up your Telegram credentials."
echo "================================================="
