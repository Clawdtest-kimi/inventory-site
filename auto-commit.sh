#!/bin/bash

# Auto-commit script for inventory data changes
# Run this after data updates to commit to GitHub

REPO_DIR="/Users/apple/.openclaw/workspace"
cd "$REPO_DIR"

# Check if there are changes to commit
if git diff --quiet HEAD -- inventory-site/my-app/data/ inventory-site/my-app/last-stock.json 2>/dev/null; then
    echo "No data changes to commit"
    exit 0
fi

# Add data files
git add inventory-site/my-app/data/ inventory-site/my-app/last-stock.json 2>/dev/null || true

# Commit with timestamp
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
git commit -m "data: auto-update inventory data - $TIMESTAMP"

# Push to GitHub
git push origin main

echo "✅ Data committed to GitHub at $TIMESTAMP"
