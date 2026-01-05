#!/bin/bash
# Emergency fix: Rename problematic files to disable them temporarily
# Run this directly on the server if Easypanel rebuild is not working

echo "🚨 Emergency IVA Fix - Disabling discovery services temporarily"

cd /app/services

if [ -f "IvaExplorationService.js" ]; then
    echo "📦 Renaming IvaExplorationService.js to .bak"
    mv IvaExplorationService.js IvaExplorationService.js.bak
fi

if [ -f "IvaLearningCache.js" ]; then
    echo "📦 Renaming IvaLearningCache.js to .bak"
    mv IvaLearningCache.js IvaLearningCache.js.bak
fi

echo "✅ Services disabled. Restarting Node.js..."
# The container should auto-restart or you can manually restart it

echo "Done! IVA should work now without discovery features."
