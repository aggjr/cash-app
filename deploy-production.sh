#!/bin/bash

# CASH Application - Production Deployment Script
# This script deploys the CASH application to production with SSL support

set -e  # Exit on error

echo "🚀 CASH Application - Production Deployment"
echo "=============================================="
echo ""

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo "❌ Error: .env.production file not found!"
    echo "Please copy env.production.template to .env.production and fill in the values."
    exit 1
fi

# Load environment variables
export $(cat .env.production | grep -v '^#' | xargs)

# Validate required environment variables
if [ -z "$DB_PASSWORD" ] || [ "$DB_PASSWORD" = "CHANGE_ME_TO_STRONG_PASSWORD" ]; then
    echo "❌ Error: DB_PASSWORD not set in .env.production"
    exit 1
fi

if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "CHANGE_ME_TO_RANDOM_STRING_AT_LEAST_64_CHARS" ]; then
    echo "❌ Error: JWT_SECRET not set in .env.production"
    exit 1
fi

echo "✅ Environment variables validated"
echo ""

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose -f docker-compose.prod.yml down

# Build images
echo "🔨 Building Docker images..."
docker-compose -f docker-compose.prod.yml build --no-cache

# Start services
echo "🚀 Starting services..."
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check service status
echo "📊 Service Status:"
docker-compose -f docker-compose.prod.yml ps

# Show logs
echo ""
echo "📋 Recent logs:"
docker-compose -f docker-compose.prod.yml logs --tail=50

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Application should be available at:"
echo "   http://cash.gutoapps.site (will redirect to HTTPS after SSL setup)"
echo ""
echo "📝 Next steps:"
echo "   1. Wait for SSL certificate generation (check certbot logs)"
echo "   2. Test the application at https://cash.gutoapps.site"
echo "   3. Monitor logs with: docker-compose -f docker-compose.prod.yml logs -f"
echo ""
