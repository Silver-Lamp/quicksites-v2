#!/bin/bash

echo "🔧 Initializing QuickSites Project..."
cp .env.example .env.local 2>/dev/null || touch .env.local
npm install
echo "✅ Ready. Run 'npm run dev' to start the project."
