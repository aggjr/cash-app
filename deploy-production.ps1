# CASH Application - Production Deployment Script (PowerShell)
# This script deploys the CASH application to production with SSL support

$ErrorActionPreference = "Stop"

Write-Host "🚀 CASH Application - Production Deployment" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env.production exists
if (-not (Test-Path .env.production)) {
    Write-Host "❌ Error: .env.production file not found!" -ForegroundColor Red
    Write-Host "Please copy env.production.template to .env.production and fill in the values." -ForegroundColor Yellow
    exit 1
}

# Load environment variables
Get-Content .env.production | ForEach-Object {
    if ($_ -match '^([^#][^=]+)=(.*)$') {
        $name = $matches[1].Trim()
        $value = $matches[2].Trim()
        [Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
}

# Validate required environment variables
$dbPassword = [Environment]::GetEnvironmentVariable("DB_PASSWORD", "Process")
$jwtSecret = [Environment]::GetEnvironmentVariable("JWT_SECRET", "Process")

if ([string]::IsNullOrEmpty($dbPassword) -or $dbPassword -eq "CHANGE_ME_TO_STRONG_PASSWORD") {
    Write-Host "❌ Error: DB_PASSWORD not set in .env.production" -ForegroundColor Red
    exit 1
}

if ([string]::IsNullOrEmpty($jwtSecret) -or $jwtSecret -eq "CHANGE_ME_TO_RANDOM_STRING_AT_LEAST_64_CHARS") {
    Write-Host "❌ Error: JWT_SECRET not set in .env.production" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Environment variables validated" -ForegroundColor Green
Write-Host ""

# Stop existing containers
Write-Host "🛑 Stopping existing containers..." -ForegroundColor Yellow
docker-compose -f docker-compose.prod.yml down

# Build images
Write-Host "🔨 Building Docker images..." -ForegroundColor Yellow
docker-compose -f docker-compose.prod.yml build --no-cache

# Start services
Write-Host "🚀 Starting services..." -ForegroundColor Yellow
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to be ready
Write-Host "⏳ Waiting for services to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Check service status
Write-Host "📊 Service Status:" -ForegroundColor Cyan
docker-compose -f docker-compose.prod.yml ps

# Show logs
Write-Host ""
Write-Host "📋 Recent logs:" -ForegroundColor Cyan
docker-compose -f docker-compose.prod.yml logs --tail=50

Write-Host ""
Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Application should be available at:" -ForegroundColor Cyan
Write-Host "   http://cash.gutoapps.site (will redirect to HTTPS after SSL setup)" -ForegroundColor White
Write-Host ""
Write-Host "📝 Next steps:" -ForegroundColor Cyan
Write-Host "   1. Wait for SSL certificate generation (check certbot logs)" -ForegroundColor White
Write-Host "   2. Test the application at https://cash.gutoapps.site" -ForegroundColor White
Write-Host "   3. Monitor logs with: docker-compose -f docker-compose.prod.yml logs -f" -ForegroundColor White
Write-Host ""
