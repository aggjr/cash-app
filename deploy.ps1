# Deploy Script for CASH App
# Usage: ./deploy.ps1
# You will be prompted for the SSH password (fWbC)Uc@0q30rmFX'Sp0) twice.

$ServerIP = "69.62.99.34"
$User = "root"
$RemotePath = "/opt/cash-app"
$LocalZip = "bundle.tar.gz"

Write-Host "============================"
Write-Host "🚀 Starting Deployment to $ServerIP"
Write-Host "============================"

# 1. Clean up old zip
if (Test-Path $LocalZip) {
    Remove-Item $LocalZip
}

# 2. Bundle files
Write-Host "📦 Bundling files..."
# Using tar because it's available on Windows 10+ and Linux
tar -czf $LocalZip backend src public database docker-compose.yml Dockerfile nginx.conf vite.config.js package.json index.html

if (-not (Test-Path $LocalZip)) {
    Write-Error "Failed to create bundle zip!"
    exit 1
}

# 3. Upload
Write-Host "📤 Uploading to server..."
Write-Host "🔑 Please enter the password when prompted: fWbC)Uc@0q30rmFX'Sp0"
scp $LocalZip "$User@${ServerIP}:/root/$LocalZip"

if ($LASTEXITCODE -ne 0) {
    Write-Error "Upload failed. Execution stopped."
    exit $LASTEXITCODE
}

# 4. Remote commands
Write-Host "🚀 Executing remote deployment..."
Write-Host "🔑 Please enter the password again:"

# Commands flattened to avoid line-ending issues (\r)
# Also switched to 'docker compose' (v2) instead of 'docker-compose' (v1)
$RemoteCommands = "mkdir -p $RemotePath && mv /root/$LocalZip $RemotePath/ && cd $RemotePath && tar -xzf $LocalZip && docker compose down || docker-compose down; docker compose up -d --build || docker-compose up -d --build && echo '✅ Deployment finished!' && docker compose ps || docker-compose ps"

ssh "$User@${ServerIP}" $RemoteCommands

Write-Host "============================"
Write-Host "✅ Done! Access at http://$ServerIP:3000/projects/cash"
Write-Host "============================"
