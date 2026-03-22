#!/bin/bash
# QueryQuest Deploy Script
# Run this from the queryquest-web directory

set -e

echo "═══════════════════════════════════════"
echo "  QUERYQUEST — Deploy Script"
echo "═══════════════════════════════════════"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Install from https://nodejs.org/"
    exit 1
fi
echo "✓ Node.js $(node -v)"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Build
echo ""
echo "🔨 Building..."
npm run build

echo ""
echo "✓ Build successful!"
echo ""

# Deploy options
echo "Choose deploy method:"
echo "  1) Vercel (recommended)"
echo "  2) GitHub (push to repo)"
echo "  3) Local preview only"
echo ""
read -p "Enter choice (1/2/3): " choice

case $choice in
    1)
        echo ""
        echo "🚀 Deploying to Vercel..."
        npx vercel --prod
        echo ""
        echo "✓ Deployed! Check the URL above."
        ;;
    2)
        read -p "GitHub repo URL: " repo_url
        git init 2>/dev/null || true
        git add .
        git commit -m "QueryQuest v1.0 — 80 SQL challenges" 2>/dev/null || git commit --amend --no-edit
        git remote remove origin 2>/dev/null || true
        git remote add origin "$repo_url"
        git push -u origin main --force
        echo ""
        echo "✓ Pushed to GitHub!"
        echo "  → Connect to Vercel: https://vercel.com/import"
        ;;
    3)
        echo ""
        echo "🖥  Starting local preview..."
        npm start
        ;;
esac
