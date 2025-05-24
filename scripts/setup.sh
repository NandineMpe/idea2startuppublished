#!/bin/bash

echo "🚀 Setting up IdeaToStartup Dashboard..."

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "📦 Installing pnpm..."
    npm install -g pnpm
fi

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Generate NextAuth secret
echo "🔐 Generating NextAuth secret..."
npx auth secret

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Configure your environment variables in .env.local"
echo "2. Set up your Supabase project"
echo "3. Configure Google OAuth credentials"
echo "4. Run 'pnpm dev' to start development"
