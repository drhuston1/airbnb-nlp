#!/bin/bash

echo "🚀 Deploying Enhanced MCP Server to Railway..."

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Installing..."
    npm install -g @railway/cli
fi

# Login to Railway
echo "🔐 Logging in to Railway..."
railway login

# Initialize or link project
if [ ! -f ".railway" ]; then
    echo "🆕 Initializing new Railway project..."
    railway init
else
    echo "🔗 Using existing Railway project..."
fi

# Deploy
echo "📦 Deploying to Railway..."
railway up

echo "✅ Deployment complete!"
echo "🌐 Your MCP server URL will be shown above"
echo "📝 Don't forget to update MCP_SERVER_URL in your Vercel environment!"