#!/bin/bash
# Railway deployment script for CSBot

set -e

echo "🚂 CSBot Railway Deployment"
echo "=========================="

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Install it with:"
    echo "   npm i -g @railway/cli"
    exit 1
fi

# Check if logged in
if ! railway whoami &> /dev/null; then
    echo "🔐 Please login to Railway first:"
    railway login
fi

# Link to project or create new one
echo ""
echo "📦 Linking to Railway project..."
railway link

# Set environment variables
echo ""
echo "⚙️  Setting environment variables..."

read -p "LLM API Key: " LLM_API_KEY
read -p "LLM Base URL [https://token-plan-cn.xiaomimimo.com/v1]: " LLM_BASE_URL
LLM_BASE_URL=${LLM_BASE_URL:-https://token-plan-cn.xiaomimimo.com/v1}

railway variables set LLM_PROVIDER=openai
railway variables set LLM_MODEL=mimo-v2.5-pro
railway variables set LLM_BASE_URL="$LLM_BASE_URL"
railway variables set LLM_API_KEY="$LLM_API_KEY"
railway variables set CORS_ORIGINS="*"

echo ""
echo "✅ Environment variables set!"

# Deploy
echo ""
echo "🚀 Deploying CSBot Server..."
railway up --service csbot-server

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Add PostgreSQL service in Railway Dashboard"
echo "   2. Add Redis service in Railway Dashboard"
echo "   3. Run database migration (see below)"
echo "   4. Set custom domain in Railway Dashboard"
echo ""
echo "🔗 Railway Dashboard: https://railway.com/dashboard"
